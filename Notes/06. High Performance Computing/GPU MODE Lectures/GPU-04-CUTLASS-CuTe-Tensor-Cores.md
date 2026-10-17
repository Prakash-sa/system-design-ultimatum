# GPU MODE Track 4 — CUTLASS, CuTe, Tensor Cores & Microarchitecture

Tools for peak-performance GEMM and attention on NVIDIA hardware: what the SM executes (SASS), how tensor cores are fed, how CUTLASS and CuTe describe tiles, threads and memory as composable layouts, and how FA3 and ThunderKittens apply them. The lectures are **not in upstream order**; they go bottom-up: microarchitecture → tensor cores → hand-built GEMM → CUTLASS → CuTe → layout algebra → CuTeDSL / PyCuTe → FA3 and ThunderKittens.

Notation: a layout is `Shape:Stride`, e.g. `(4,6):(1,4)`. Coordinates are **column-major (colexicographic)**: the leftmost mode varies fastest.

## Contents

- [Lecture 37 — SASS and GPU Microarchitecture](#lecture-37--sass-and-gpu-microarchitecture)
- [Lecture 23 — Tensor Cores](#lecture-23--tensor-cores)
- [Lecture 43 — INT8 Matmul on Turing Tensor Cores](#lecture-43--int8-matmul-on-turing-tensor-cores)
- [Lecture 15 — CUTLASS](#lecture-15--cutlass)
- [Lecture 57 — CuTe](#lecture-57--cute)
- [Lecture 103 — CuTe Layout Algebra and Category Theory](#lecture-103--cute-layout-algebra-and-category-theory)
- [Lecture 86 — CuTeDSL](#lecture-86--cutedsl)
- [Lecture 114 — PyCuTe](#lecture-114--pycute)
- [Lecture 36 — CUTLASS and FlashAttention-3](#lecture-36--cutlass-and-flashattention-3)
- [Lecture 75 — GPU Programming Fundamentals and ThunderKittens](#lecture-75--gpu-programming-fundamentals-and-thunderkittens)
- [Track summary](#track-summary)

---

## Lecture 37 — SASS and GPU Microarchitecture

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L037-SASS-GPU-Microarchitecture.pdf)

- **Steer the compiler toward good SASS;** you don't write SASS (no public H100 assembler). PTX is a virtual ISA that `ptxas` lowers non-trivially, so always inspect the SASS (`cuobjdump -sass`, Godbolt, Nsight Compute Source view).
- **Issue rate is the hidden ceiling:** each SMSP issues **1 instruction/clock** (4 per SM). Index math, predicates and address arithmetic steal slots from FMAs.
- **"Barrier" is overloaded:** scoreboard dependency barriers (hidden), `BAR`/`__syncthreads()`, and mbarriers for TMA/async copy/tensor cores.
- **Little's Law:** hiding ~200 (L2) to ~1000 (HBM) cycles of latency needs that much work in flight, from ILP + TLP.
- **Element-wise isn't automatically DRAM-bound:** the GELU case study uses vector loads, `MUFU.TANH` via inline PTX, and FMA reordering, and still falls short of full bandwidth.
- **Isolate code for analysis** with `noinline`, `__launch_bounds__`, `nanosleep`. Optimize the algorithm first, then the SASS.

## Lecture 23 — Tensor Cores

**Slides:** [external](https://drive.google.com/file/d/18sthk6IUOKbdtFphpm_jZNXoJenbWR8m/view)

- **One instruction = small `D = A·B + C` across a thread group.** Each thread holds a fixed *fragment*; describing that mapping is what CuTe TV-layouts do.
- **Generations:** Volta `mma.sync.m8n8k4` (quad-pairs, regs) → Ampere `mma.sync.m16n8k16` (1 warp, regs via `ldmatrix`) → Hopper `wgmma.mma_async` (warpgroup of 128 threads, B from smem, 64×N×16, N ≤ 256) → Blackwell `tcgen05.mma` (single thread issues, accumulator in **TMEM**).
- **The trend:** async and operands closer to the tensor core, freeing registers and issue slots for softmax, epilogue and address math.
- **Feeding it:** operands staged in **swizzled** smem (bank-conflict-free), loaded async (`cp.async`, then **TMA**) and multi-buffered.
- **Major-ness:** operands are K-major or MN-major; FP8 wgmma accepts only K-major smem operands, which forces FA3's V transpose.
- **Accumulate wider:** fp16/bf16/fp8 → fp32; int8 → int32.

## Lecture 43 — INT8 Matmul on Turing Tensor Cores

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L043-Int8-Matmul-Turing.pdf)

- **int8 is exact**, so no float tolerances. Verify matmuls cheaply with **Freivalds' check**: `C x == A (B x)` is O(n²).
- **Naive WMMA:** one warp per 16×16 fragment, ~4 TOPS against a ≈114 TOPS speed-of-light.
- **Uncoalesced B → LG Throttle stalls.** Transposing B once (O(n²)) took 1482 → 922 ms at n=15040.
- **Stall percentages are per selected cycle,** so they may not drop even when runtime does.
- **Register tiling** (3×3 fragments per warp) raises MMAs per fragment loaded from 1/2 to 3/2 (513 ms); **shared memory** tiling reaches 332 ms; register pressure then limits occupancy.
- **Avoid per-load layout shuffles:** copy fragment registers directly (194 ms), then pre-swizzle A/B in global memory into fragment order (178 ms, ~40% of SOL).

## Lecture 15 — CUTLASS

**Slides:** video only

- **Header-only C++ templates for GEMM-like kernels**, re-assemblable into fused epilogues, GETT, conv and attention.
- **CUTLASS 3.x layers:** Device (`GemmUniversalAdapter`) → Kernel (tile scheduler, warp roles) → Collective (CTA mainloop / epilogue) → CuTe (`TiledCopy`, `TiledMMA`, atoms).
- **Tiling:** CTA tile (e.g. 128×128×64) → warp/warpgroup tile → MMA atom; pipelined K mainloop; epilogue `D = α·acc + β·C` plus fused ops.
- **2.x → 3.x:** dozens of named layout/iterator types replaced by one vocabulary type, CuTe's `Layout<Shape,Stride>`.
- **Hopper schedules:** *cooperative* (2 consumer warpgroups split a tile) vs *ping-pong* (they alternate tiles so one's epilogue overlaps the other's MMA); both use a TMA producer warp.
- **Configuration is compile-time** (tile, cluster, stages, schedule, types); performance comes from picking the right instance.

## Lecture 57 — CuTe

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L057-CuTe.pdf)

- **A layout is the canonical form of a loop nest:** `for (i=2; i<=50; i+=3) A[7*i+5]` becomes base `A+19`, size 17, stride 21.
- **Layout = function coord → index** via `inner_product(coord, stride)`. Static extents (`_22`) let loops unroll and offset math fold away.
- **Hierarchy makes any fold representable:** `(2,2,2):(4,1,2)` has no flat 4×2 view, but `((2,2),2):((4,2),1)` works. One layout accepts 1-D, 2-D or nested coords: for `(8,(2,2)):(2,(1,16))`, `A(17) = A(1,2) = A(1,(0,1)) = 18`.
- **Tensor = Engine ∘ Layout**, a view, not a container. Copy, gather, broadcast (`8:0`), transpose, and NT/TN GEMM are just choices of layouts.
- **All GETTs are GEMMs:** group modes into M, N, K and batch modes, then fold to batched GEMM.
- **Partitioning = composition then slicing:** `composition(data, TV)(tid, _)` with a `(thread, value) → coord` layout.
- **MMA atoms describe hardware as layouts:** `ALayout/BLayout/CLayout : (thr, val) → coord`. Stack: MMA_Op → MMA_Traits → MMA_Atom → TiledMMA → ThrMMA (`partition_A/B/C`, `make_fragment_*`).

```cpp
TiledMMA mma = make_tiled_mma(SM80_16x8x8_F32F16F16F32_TN{}, Layout<Shape<_2,_2>>{});
ThrMMA thr = mma.get_slice(threadIdx.x);
Tensor tCrA = thr.make_fragment_A(thr.partition_A(sA));  // likewise B, C
gemm(mma, tCrA, tCrB, tCrC);
```

## Lecture 103 — CuTe Layout Algebra and Category Theory

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L103-CuTe-Layout-Algebra.pdf)

- **Vocabulary:** for `S = (4,(5,5),(2,(3,3)))`, rank 3 (modes), length 6 (entries), size 1800. `S` *refines* `S'` if entries of `S'` are replaced by nested tuples of equal size.
- **Layout function:** `Φ_L = (D·) ∘ colex⁻¹`. For `(5,3):(3,1)`, `Φ(11)`: coord `(1,2)` → `3·1 + 1·2 = 5`.
- **Same grid, different strides:** `(4,6):(6,1)` row-major, `(4,6):(1,4)` column-major, `(4,6):(1,0)` broadcast. The 2×2 labelling `0 1 / 3 2` is *not* a layout; it needs a swizzle.
- **Core operations:**

| Operation | Definition | Example |
|---|---|---|
| Coalesce | merge `s₁,s₂ : d₁,d₂ → s₁s₂ : d₁` when `s₁d₁ = d₂` | `(2,3,2,3):(12,6,1,2)` → `(2,3,6):(12,6,1)` |
| Composition `B∘A` | `Φ_{B∘A} = Φ_B ∘ Φ_A` | `(12,4):(4,1) ∘ (4,6):(6,1)` → `((2,2),6):((24,1),4)` |
| Complement `comp(L,N)` | fills the holes so `(L,L')` is a bijection onto `[0,N)` | `comp((3,7):(2,30), 210) = (2,5):(1,6)` |
| Logical divide `A ⊘ B` | `(A∘B, A∘comp(B, size A))` | `(6,8):(1,6) ⊘ (2,4):(1,6) = ((2,4),(3,2)):((1,6),(2,24))` |
| Logical product `A ⊗ B` | `(A, comp(A, size(A)·cosize(B)) ∘ B)` | `(3,3):(3,1) ⊗ (2,2):(1,4) = ((3,3),(2,2)):((3,1),(9,36))` |

- **Worked composition:** A's first mode `4:6` visits 0, 6, 12, 18, which in B's `(12,4)` coords cross B's mode boundary at 12, so it splits into `(2,2)` with strides `(6·4, 1) = (24,1)`; A's second mode `6:1` stays in B's first mode, giving stride 4. Check: `Φ_B(Φ_A(3)) = Φ_B(18) = 25`.
- **Worked complement:** `(3,7):(2,30)` hits `{0,2,4} + {0,30,…,180}`; holes are filled by stride 1 (×2) then stride 6 (×5).
- **Worked divide (1-D):** `24:1 ⊘ 4:2 = (4,(2,3)):(2,(1,8))`. Mode 0 is the tile `{0,2,4,6}`, mode 1 indexes 6 tiles at bases `{0,1,8,9,16,17}`. This is how `zipped_divide`/`local_tile` find "tile i".
- **Tractable layouts:** composition doesn't always exist; restrict to layouts derived from column-major by permuting, removing, inserting stride-0 modes and re-parenthesizing. `(4,6):(1,5)` is not tractable.
- **Category view:** tractable layouts ↔ morphisms in the category **Nest**; composition, complement, divide and product become diagram pasting, and the composition algorithm (via mutual refinement) is proven correct whenever `B∘A` exists.

## Lecture 86 — CuTeDSL

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L086-CuTeDSL-Intro.pdf)

- **Why a DSL:** C++ templates mean high mental load, huge error messages and slow compiles that block JIT and autotuning. **CUTLASS 4.0 / CuTeDSL** exposes the same CuTe model from Python with full tensor-core control (`pip install nvidia-cutlass-dsl`).
- **Two decorators:** `@cute.jit` is host-side (prepares params, builds TMA descriptors); `@cute.kernel` is the device kernel.
- **Tracing + AST rewriting:** runtime-dependent control flow becomes IR; compile-time Python is evaluated at trace time. `cutlass.Constexpr` args are baked in and key the kernel cache.
- **`Tensor` vs `TensorSSA`:** a view of memory vs an immutable thread-local value used for `load → compute → store`.
- **Blackwell block-scaled GEMM:** TMA load A/B/scales → S2T copy scales to TMEM → UMMA (`tcgen05.mma`, accumulator in TMEM) → T2R copy to registers (SIMT, sliced per thread) → store.
- **`tXaY` naming:** partitioning `tX` of tensor `aY` in memory space r/g/s/c/p/t; e.g. `tCsA` = MMA-C partitioning of A in smem.
- **Pipelines:** `PipelineTmaUmma` and `PipelineUmmaAsync` wrap mbarrier producer/consumer handshakes. Debug with `cute.printf` and `CUTE_DSL_KEEP_PTX=1`.

## Lecture 114 — PyCuTe

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L114-PyCuTe.pdf)

- **PyCuTe:** a pure-Python reference of CuTe's layout algebra that works unchanged inside CuTeDSL, running at trace time and emitting no IR.
- **Mappings to reason about:** memory layout `L`, tiler `T`, access distribution `TV`; `L∘TV` gives the memory access pattern.
- **Design tension:** scope vs closure. Ladder: flat strides ⊂ hierarchical ⊂ coordinate strides ⊂ F₂ strides ⊂ ComposedLayouts, each step trading away algebra.
- **COPY by algebra:** permute the iteration by `right_inverse` of one side; `nullspace` rejects write-after-write races; agreement of the other side gives a `V:1` vector width. It degrades to the reference loop in the worst case.
- **GEMM as layout:** say B is N-major or K-major, not "transposed". Im2col is a layout transform; implicit GEMM is a change of view.
- **Coordinate strides** (`1@0`, `2@1`) make layouts emit coordinates: predication, TMA, better tilers.
- **Swizzles as F₂ strides:** XOR as addition, so coalesce and inverses work; power-of-two F₂ layouts are isomorphic to Triton's Linear Layouts.

## Lecture 36 — CUTLASS and FlashAttention-3

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L036-CUTLASS-FlashAttention3.pdf)

- **Why FA2 stalls on H100:** ~35–40% utilization; `mma.sync` reaches only ~2/3 of peak, so **wgmma and TMA are required**.
- **Three ingredients:** new instructions (WGMMA, TMA), asynchrony (producer/consumer warp specialization with `setmaxnreg` register reallocation), and FP8.
- **Exp is a co-bottleneck:** for head dim 128 and a 128×192 tile, FP16 WGMMA takes 3072 cycles and `exp` 1536 (50%); with FP8 both take 1536. Softmax must overlap the matmuls.
- **Pingpong:** two consumer warpgroups alternate softmax and GEMM via `bar.sync` (580 → 640 TFLOPS). **Intra-warpgroup pipelining** overlaps iteration j's softmax with j+1's `QKᵀ` (→ 670 TFLOPS).
- **FP8 layout:** wgmma needs K-major operands, so V is transposed in-kernel (TMA can't change the contiguous mode) and P's accumulator layout is reshaped in registers.
- **Persistent kernels:** #SMs CTAs + tile scheduler overlap epilogues with next-tile loads and load-balance causal masking.
- **Results:** 1.6–2.0× over FA2, up to ~850 TFLOPS BF16 and ~1.3 PFLOPS FP8.

## Lecture 75 — GPU Programming Fundamentals and ThunderKittens

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L075a-GPU-Programming-Fundamentals.pdf) · [PDF](../../../Books/GPU-MODE-Lectures/L075b-ThunderKittens.pdf)

- **4 warp schedulers per SM**, each like an in-order SIMD core. Minimum to keep H100 busy: 132 × 4 × 32 = 16,896 threads; more threads only add latency hiding.
- **Wave quantization:** `<<<133,1024>>>` can be ~2× slower than `<<<128,1024>>>` on 132 SMs, since one block runs a second wave. Same reason for persistent tile schedulers.
- **The golden rule:** H100 tensor cores ~989 TFLOPS BF16 vs ~60 FMA and ~7.5 SFU `exp`, so ~16× everything else. Minimize the latency of non-tensor-core ops: fuse and tile them.
- **ThunderKittens:** a tile-based C++ library (<1 MB) with three abstractions: **16×16 tiles** with managed global/shared/register layouts, side-effect-free tile **functions** `func(dest, src...)`, and **schedules** (pipelining, producer/consumer specialization).
- **Bet:** AI kernels use few patterns, so small transparent primitives can match CUTLASS-class performance with far less code.

---

## Track summary

| Concept | Lecture | Takeaway |
|---|---|---|
| SASS & issue rate | 37 | Inspect SASS; 1 instr/clk per SMSP, overhead steals MMA slots |
| Little's Law | 37, 75 | ~200–1000 cycles of latency need ILP + TLP in flight |
| Tensor-core generations | 23 | mma.sync (warp, regs) → wgmma (warpgroup, smem, async) → tcgen05 (1 thread, TMEM) |
| Hand-built TC GEMM | 43 | Transpose → register tile → smem → pre-swizzle: 1482 → 178 ms |
| CUTLASS layers | 15 | Device → Kernel → Collective → CuTe atoms |
| Layout / Tensor | 57 | `Shape:Stride` coord→index; Tensor = Engine ∘ Layout |
| Partitioning & MMA atoms | 57 | Compose with a TV-layout, slice by thread |
| Layout algebra | 103 | Composition, complement, `A⊘B=(A∘B, A∘Bᶜ)`, `A⊗B=(A, Aᶜ∘B)` |
| CuTeDSL | 86 | CuTe in Python with fast JIT and full TC control |
| COPY & swizzles via algebra | 114 | `right_inverse` vectorizes, nullspace finds WAW; swizzles = F₂ strides |
| FA3 | 36 | WGMMA + TMA + warp specialization + pingpong + FP8 → ~850 TFLOPS BF16 |
| Waves & persistent kernels | 36, 75 | #SM CTAs + tile scheduler beat wave quantization |
| Tensor cores dominate | 75 | ~16× other compute on H100: keep them busy |

## Next

[Track 5 — Quantization, Sparsity & Numerics →](./GPU-05-Quantization-Sparsity-Numerics.md)
