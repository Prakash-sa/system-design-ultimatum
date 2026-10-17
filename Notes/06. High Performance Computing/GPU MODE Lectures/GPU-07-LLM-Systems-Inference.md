# GPU MODE Track 7 — LLM Systems & Inference

This track moves from single kernels to the systems that serve and train LLMs: speculative decoding, Unsloth, SGLang, FlashInfer, and three ScaleML talks (FlexOlmo, StreamingLLM, PaTH). The common thread: **LLM decode is memory-bound and latency-sensitive**, so most wins come from doing more useful work per weight/KV byte read, hiding CPU and launch overhead, and bounding the KV cache.

## Contents

- [Lecture 22 — Speculative Decoding in vLLM](#lecture-22--speculative-decoding-in-vllm)
- [Lecture 32 — Unsloth: LLM Systems Engineering](#lecture-32--unsloth-llm-systems-engineering)
- [Lecture 35 — SGLang Performance Optimization](#lecture-35--sglang-performance-optimization)
- [Lecture 40 — FlashInfer](#lecture-40--flashinfer)
- [Lecture 71 — FlexOlmo: Open LMs for Flexible Data Use](#lecture-71--flexolmo-open-lms-for-flexible-data-use)
- [Lecture 72 — Efficient Long-Context Modeling (StreamingLLM)](#lecture-72--efficient-long-context-modeling-streamingllm)
- [Lecture 74 — Positional Encodings and PaTH Attention](#lecture-74--positional-encodings-and-path-attention)
- [Track summary](#track-summary)
- [Next](#next)

## Lecture 22 — Speculative Decoding in vLLM

**Slides:** [external](https://docs.google.com/presentation/d/1p1xE-EbSAnXpTSiSI0gmy_wdwxN5XaULO3AnCWWoRe4/edit#slide=id.p)

- **Why it works:** decode is memory-bound, so verifying `k+1` positions in one target forward pass costs roughly the same as generating one token. A cheap *proposer* guesses `k` tokens; each correct guess is a free token.
- **Draft → verify loop:** propose `k` tokens, score all of them in one target pass, accept a prefix, and always emit one extra target token (a correction at the first rejection, or a bonus if all were accepted).
- **Lossless acceptance:** accept draft `x` with probability `min(1, p(x)/q(x))`; on rejection, resample from normalized `max(0, p − q)`. Output is *exactly* the target distribution. Greedy reduces to "accept while argmax matches".
- **Expected tokens per target pass:** `(1 − α^(k+1)) / (1 − α)` for acceptance rate `α`. Gains saturate quickly in `k`; a large `k` with low `α` wastes compute.
- **Proposers:** a small same-family draft model (shared tokenizer required); n-gram / prompt lookup (cheap, strong for RAG and code editing); extra heads on the target (Medusa, EAGLE, MLP speculators).
- **Systems costs:** the draft model needs its own KV cache, rejected KV slots must be rolled back, and scoring `k+1` positions is a per-sequence "mini-prefill" (batch expansion or native multi-token scoring).
- **When it hurts:** at large batch the target is already compute-bound, so verification FLOPs are no longer free. Best at low batch and latency-critical serving. Higher temperature lowers acceptance.

## Lecture 32 — Unsloth: LLM Systems Engineering

**Slides:** [external](https://docs.google.com/presentation/d/1BvgbDwvOY6Uy6jMuNXrmrz_6Km_CBW0f2espqeQaWfc/edit?usp=sharing)

- **Goal:** fast, memory-lean LoRA/QLoRA fine-tuning on a single GPU by hand-writing hot paths instead of relying on generic autograd.
- **Manual LoRA backprop:** derive gradients of `W x + B A x` by hand, compute `B (A x)` and never materialize `B A`, and fuse 4-bit dequantization into the matmul path.
- **Fused Triton kernels** with hand-written backward for the memory-bound ops: RMSNorm, RoPE, SwiGLU/GeGLU, cross-entropy. This saves activation memory and launches.
- **Chunked cross-entropy:** with 128K–256K vocabularies, the `[tokens × vocab]` logits dominate memory. Compute log-sum-exp in chunks so full FP32 logits are never materialized.
- **Smarter checkpointing:** asynchronously offload checkpointed activations to CPU and bring them back for backward, trading PCIe bandwidth for HBM.
- **Numerics bugs are systems work:** tokenizer/chat-template mismatches, RoPE precision in low-precision dtypes, approximate vs exact GELU, and gradient-accumulation loss normalization (summing per-micro-batch means is not the full-batch mean when lengths vary).
- **Rule:** matmuls stay in cuBLAS; everything elementwise or reduction-shaped around them is fair game for Triton.

## Lecture 35 — SGLang Performance Optimization

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L035-SGLang-Performance.pdf)

- **SGLang** is an LLM/VLM serving engine (LMSYS), first to support prefix cache (RadixAttention) and compressed-FSM constrained decoding. The talk covers CPU overlap scheduling, FlashInfer integration, and TurboMind GEMM.
- **CPU overhead is real:** an unoptimized engine can spend more than 50% of its time on CPU scheduling (batch construction, sampling bookkeeping, detokenization) while the GPU idles.
- **Overlapped scheduler:** schedule batch `i+1` on the CPU while the GPU runs batch `i`.
- **Breaking the dependency:** *delay the finish check* — assume each request continues and schedule it again; worst case is one wasted token. **Future tokens** are placeholders for not-yet-sampled tokens so the next step can be enqueued early.
- **FlashInfer as default attention backend (since v0.2):** planned JIT attention variants, FA3-style kernels with paged KV, and a **Stream-K-inspired scheduler** that spreads variable-length work evenly across SMs (helps most when length variance is high).
- **TurboMind INT4 GEMM:** `ldmatrix` assumes 16-bit operands, so INT4 lands misaligned. Fix offline: bit-extend 4→16-bit, run the standard LDSM fragment pipeline, repack to 4-bit, store. Runtime loads go straight into MMA fragment order: no bank conflicts, no swizzle, lower register pressure.
- **Reported results:** FP16×INT4 vs cuBLAS FP16×FP16 over 32 shapes from 7B–72B models was never slower on A100 / RTX 4090.

## Lecture 40 — FlashInfer

**Slides:** video only

- **What it is:** a kernel library for LLM serving (attention prefill/decode/append, sampling, norms, activations) used by SGLang and vLLM.
- **KV cache as block-sparse:** paged KV, radix-tree prefix sharing, and ragged batches are all a *block-sparse row* (BSR) matrix over (query, KV-page) blocks, so one kernel family serves every layout.
- **Cascade attention:** for a long shared prefix, compute attention over the prefix once and over each unique suffix separately, then merge.
- **Attention-state merge** (the identity behind cascade, split-K / FlashDecoding, and Stream-K reduction): partials `(o, lse)` over disjoint keys combine exactly:

  ```text
  lse = log(exp(lse1) + exp(lse2))
  o   = o1 * exp(lse1 - lse) + o2 * exp(lse2 - lse)
  ```

- **JIT attention variants:** a CUDA/CUTLASS template with hooks for logits transforms (soft-capping, ALiBi), masks (sliding window), and query/key transforms (RoPE fusion) — FlexAttention's idea applied to serving.
- **Plan / run split:** the CPU *plan* computes a load-balanced partition from sequence lengths once per step; *run* launches fixed-shape kernels, keeping them CUDA-Graph-capturable.
- **Decode and sampling:** with GQA, query heads sharing a KV head are grouped so each KV tile loads once. Top-k / top-p / min-p sampling avoids a full vocabulary sort.

## Lecture 71 — FlexOlmo: Open LMs for Flexible Data Use

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L071-FlexOlmo.pdf)

- **Reframe of MoE:** use MoE to **train on datasets owned by different parties** without pooling the data. Owners may refuse access, require data to stay in place, set expirations, or demand opt-out.
- **Why BTX-style MoE merging fails:** the router normally needs joint training on all datasets after merging, which breaks the data constraint.
- **Learning to coordinate:** each owner trains its expert alongside a *frozen copy of the public expert/trunk*, keeping experts in one representation space.
- **Nonparametric router:** one embedding row per expert, supplied independently by each owner. Merging is concatenating rows; **opt-out is deleting an expert and its row with no retraining**.
- **Setup:** 7B params, pre-trained on shared data for 1T tokens, then 50B tokens of continual pre-training per silo (math, code, news, Reddit, papers, creative writing, educational text).
- **Results:** **41% relative gain** over the public-only model, **retaining 90%** of the benefit of unrestricted joint training. Opting out the news expert barely affects the others.
- **Systems angle:** experts can be trained in separate clusters and added or removed at serving time; expert-parallel inference (all-to-all, grouped GEMM) applies unchanged.

## Lecture 72 — Efficient Long-Context Modeling (StreamingLLM)

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L072-Long-Context-StreamingLLM.pdf)

- **Problem:** streaming dialogue needs unbounded length, but KV memory grows linearly and models fail beyond their pre-training window.
- **KV size:** per token `2 (K,V) × layers × kv_heads × head_dim × bytes`. Llama-2-7B FP16 = 0.5 MB/token, so batch 4 at 32K is 64 GB, more than the weights.
- **Baselines:** dense attention fails past the window (PPL 5641); window attention collapses once initial tokens are evicted (PPL 5158); sliding window with recomputation works (PPL 5.43) but costs `O(TL²)`. StreamingLLM: `O(TL)`, PPL 5.40.
- **Attention sinks:** initial tokens get large attention scores regardless of meaning, because softmax must put mass somewhere and the first tokens are visible to every later token. Replacing them with `"\n"` also works, so the role is positional.
- **Recipe:** keep ~4 sink tokens plus a rolling window of recent tokens; evict the middle. No fine-tuning. Positions are assigned by position *within the cache*, so keys are cached pre-RoPE and rotated after retrieval.
- **Results:** stable language modeling up to 4M tokens (Llama-2, MPT, Falcon, Pythia), up to 22.2× faster than sliding window with recomputation.
- **Dedicated sink token:** pre-training with one learnable sink lets a model stream with a single sink; GPT-OSS adds a learnable sink per head.
- **Limitation:** this bounds memory, not recall — evicted tokens can no longer be attended.

## Lecture 74 — Positional Encodings and PaTH Attention

**Slides:** [PDF](../../../Books/GPU-MODE-Lectures/L074-PaTH-Attention.pdf)

- **RoPE:** rotate channel pair `m` by `pos · θ_m`, `θ_m = 10000^{−2m/d}`. Since `R_i^T R_j = R_{j−i}`, logits depend only on **relative** position. High-frequency channels encode position patterns; low-frequency channels carry semantics.
- **Length-extension ladder:** *PI* uses position `i/s`; *NTK-aware* scales frequencies non-uniformly (keep high, interpolate low); *NTK-by-parts* decides per channel via a ramp; *YaRN* adds attention temperature `1/t = 0.1 ln(s) + 1`.
- **Expressivity limit:** RoPE transformers are in **TC⁰**. Tasks like composing permutations of 5 elements (S5, NC¹-complete) need data-dependent, non-commutative state updates; RoPE rotations are position-only and commute.
- **PaTH:** replace fixed rotations with a cumulative product of data-dependent Householder matrices `H_t = I − β_t w_t w_tᵀ`, `β_t ∈ (0, 2)`. Logit: `k_jᵀ (Π_{s=j+1..i} H_s) q_i`. Stated NC¹-complete under AC⁰ reduction.
- **Evidence:** PaTH solves multiquery Swap-5 where RoPE does not; flip-flop LM in-distribution error 0% vs RoPE 6.9%.
- **Making it fast:** a FlashAttention-style blocked algorithm with UT-transform / WY representation (as in DeltaNet) for inter-block products.
- **Inference:** update cached keys in place, `k_i ← (I − β_t w_t w_tᵀ) k_i`; decoding stays ordinary softmax attention (FlashDecoding/PagedAttention compatible) at the cost of a rank-1 update to the KV cache each step.
- **PaTH-FoX and results:** adding the Forgetting Transformer's forget gate; at 760M / 50B tokens PaTH(-FoX) beats RoPE on average zero-shot accuracy (54.2 vs 52.7), and PaTH-FoX keeps the lowest perplexity out to 64K.

## Track summary

| Concept | Lecture | Takeaway |
|---|---|---|
| Speculative decoding | 22 | Verifying `k+1` drafts costs about one decode step; rejection sampling keeps outputs exact; gains shrink at high batch. |
| Fused Triton ops, chunked CE | 32 | Keep GEMMs in cuBLAS, fuse memory-bound ops around them; never materialize full logits. |
| Overlapped CPU scheduling | 35 | Hide scheduler time behind GPU work via delayed finish checks and future tokens. |
| Offline INT4 packing | 35 | Run the 16-bit LDSM pipeline offline so packed weights load straight into MMA fragments. |
| Block-sparse KV, cascade, LSE merge | 35, 40 | One kernel family for all cache layouts; merge partials exactly with `(o, lse)`. |
| Plan / run | 40 | CPU plan keeps variable-length kernels CUDA-Graph-friendly. |
| Modular MoE over data silos | 71 | Independent experts plus nonparametric router: contribution without sharing, free opt-out. |
| KV sizing and attention sinks | 72 | `2·L·H_kv·d·bytes` per token; keep ~4 sinks plus a recent window to bound memory, not recall. |
| RoPE extensions, PaTH | 74 | Treat channels per frequency (PI/NTK/YaRN); data-dependent Householder products beat RoPE's TC⁰ limit. |

## Next

Continue with [GPU MODE Track 8 — Beyond NVIDIA](./GPU-08-Beyond-NVIDIA.md).
