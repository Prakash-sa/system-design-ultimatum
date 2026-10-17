# GPU MODE Lectures — Study Plan

A study path through all 60 lectures of the [GPU MODE](https://github.com/gpu-mode/lectures) series, grouped into eight tracks. Slide PDFs are in [`Books/GPU-MODE-Lectures/`](../../../Books/GPU-MODE-Lectures/) and the videos are on [YouTube](https://www.youtube.com/@GPUMODE). The companion textbook is *Programming Massively Parallel Processors* (PMPP).

**How to study a lecture:** read the track note → watch the video with the PDF open → profile one kernel yourself.

## Tracks

| # | Track | Lectures | Focus |
|---|-------|----------|-------|
| 1 | [CUDA Foundations](./GPU-01-CUDA-Foundations.md) | 1–5, 8, 16, 41 | Execution model, memory hierarchy, profiling |
| 2 | [Parallel Algorithms & Fused Kernels](./GPU-02-Parallel-Algorithms.md) | 9, 12, 13, 18–21, 24 | Reduce, scan, Flash/Ring Attention, fusion |
| 3 | [Triton, Compilers & Kernel DSLs](./GPU-03-Triton-Compilers-DSLs.md) | 10, 14, 28, 29, 42, 79, 104, 106, Bonus | Writing kernels at a higher level |
| 4 | [CUTLASS, CuTe, Tensor Cores](./GPU-04-CUTLASS-CuTe-Tensor-Cores.md) | 15, 23, 36, 37, 43, 57, 75, 86, 103, 114 | Peak GEMM/attention on modern NVIDIA hardware |
| 5 | [Quantization, Sparsity & Numerics](./GPU-05-Quantization-Sparsity-Numerics.md) | 7, 11, 30, 33, 34, 38, 69, 84 | Low precision and skipping work |
| 6 | [Multi-GPU & Distributed](./GPU-06-Multi-GPU-Distributed.md) | 6, 17, 39, 67, 70, 78 | NCCL/NVSHMEM collectives, parallelism strategies |
| 7 | [LLM Systems & Inference](./GPU-07-LLM-Systems-Inference.md) | 22, 32, 35, 40, 71, 72, 74 | Serving engines, long context, attention variants |
| 8 | [Beyond NVIDIA](./GPU-08-Beyond-NVIDIA.md) | 25, 26, 27, 31 | AMD, Intel, Apple, WebGPU |

```text
1 Foundations ──► 2 Algorithms ──┬──► 3 Triton & DSLs ──┐
      │                          ├──► 4 CUTLASS / CuTe ─┴──► 5 Quantization ──┐
      │                          └──► 6 Multi-GPU ────────────────────────────┴──► 7 LLM Systems
      └──► 8 Beyond NVIDIA
```

## Lecture Index

| Lecture | Title | Track | Slides |
|---------|-------|-------|--------|
| 1 | Profiling and Integrating CUDA Kernels in PyTorch | [1](./GPU-01-CUDA-Foundations.md) | [PDF](../../../Books/GPU-MODE-Lectures/L001-Profiling-CUDA-in-PyTorch.pdf) |
| 2 | Recap Ch. 1–3 from the PMPP Book | [1](./GPU-01-CUDA-Foundations.md) | [PDF](../../../Books/GPU-MODE-Lectures/L002-PMPP-Ch1-3-Recap.pdf) |
| 3 | Getting Started With CUDA | [1](./GPU-01-CUDA-Foundations.md) | — |
| 4 | Intro to Compute and Memory Architecture | [1](./GPU-01-CUDA-Foundations.md) | [PDF](../../../Books/GPU-MODE-Lectures/L004-Compute-and-Memory-Architecture.pdf) |
| 5 | Going Further with CUDA for Python Programmers | [1](./GPU-01-CUDA-Foundations.md) | — |
| 6 | Optimizing PyTorch Optimizers | [6](./GPU-06-Multi-GPU-Distributed.md) | — |
| 7 | Advanced Quantization | [5](./GPU-05-Quantization-Sparsity-Numerics.md) | — |
| 8 | CUDA Performance Checklist | [1](./GPU-01-CUDA-Foundations.md) | — |
| 9 | Reductions | [2](./GPU-02-Parallel-Algorithms.md) | — |
| 10 | Build a Prod Ready CUDA Library | [3](./GPU-03-Triton-Compilers-DSLs.md) | — |
| 11 | Sparsity | [5](./GPU-05-Quantization-Sparsity-Numerics.md) | [PDF](../../../Books/GPU-MODE-Lectures/L011-Sparsity.pdf) |
| 12 | Flash Attention | [2](./GPU-02-Parallel-Algorithms.md) | — |
| 13 | Ring Attention | [2](./GPU-02-Parallel-Algorithms.md) | [PDF](../../../Books/GPU-MODE-Lectures/L013-Ring-Attention.pdf) |
| 14 | Practitioner's Guide to Triton | [3](./GPU-03-Triton-Compilers-DSLs.md) | — |
| 15 | CUTLASS | [4](./GPU-04-CUTLASS-CuTe-Tensor-Cores.md) | — |
| 16 | Hands-on Profiling | [1](./GPU-01-CUDA-Foundations.md) | — |
| Bonus | CUDA C++ llm.cpp | [3](./GPU-03-Triton-Compilers-DSLs.md) | — |
| 17 | GPU Collective Communication (NCCL) | [6](./GPU-06-Multi-GPU-Distributed.md) | [PDF](../../../Books/GPU-MODE-Lectures/L017-NCCL-Collectives.pdf) |
| 18 | Fused Kernels | [2](./GPU-02-Parallel-Algorithms.md) | — |
| 19 | Data Processing on GPUs | [2](./GPU-02-Parallel-Algorithms.md) | — |
| 20 | Scan Algorithm | [2](./GPU-02-Parallel-Algorithms.md) | — |
| 21 | Scan Algorithm Part 2 | [2](./GPU-02-Parallel-Algorithms.md) | — |
| 22 | Speculative Decoding in vLLM | [7](./GPU-07-LLM-Systems-Inference.md) | — |
| 23 | Tensor Cores | [4](./GPU-04-CUTLASS-CuTe-Tensor-Cores.md) | — |
| 24 | Scan at the Speed of Light | [2](./GPU-02-Parallel-Algorithms.md) | — |
| 25 | Speaking Composable Kernel (AMD) | [8](./GPU-08-Beyond-NVIDIA.md) | [PDF](../../../Books/GPU-MODE-Lectures/L025-AMD-Composable-Kernel.pdf) |
| 26 | SYCL Mode (Intel GPU) | [8](./GPU-08-Beyond-NVIDIA.md) | — |
| 27 | gpu.cpp | [8](./GPU-08-Beyond-NVIDIA.md) | — |
| 28 | Liger Kernel | [3](./GPU-03-Triton-Compilers-DSLs.md) | — |
| 29 | Triton Internals | [3](./GPU-03-Triton-Compilers-DSLs.md) | [PDF](../../../Books/GPU-MODE-Lectures/L029-Triton-Internals.pdf) |
| 30 | Quantized Training | [5](./GPU-05-Quantization-Sparsity-Numerics.md) | [PDF](../../../Books/GPU-MODE-Lectures/L030-Quantized-Training.pdf) |
| 31 | Beginner's Guide to Metal Kernels | [8](./GPU-08-Beyond-NVIDIA.md) | [PDF](../../../Books/GPU-MODE-Lectures/L031-Metal-Kernels.pdf) |
| 32 | Unsloth — LLM Systems Engineering | [7](./GPU-07-LLM-Systems-Inference.md) | — |
| 33 | BitBLAS | [5](./GPU-05-Quantization-Sparsity-Numerics.md) | [PDF](../../../Books/GPU-MODE-Lectures/L033-BitBLAS.pdf) |
| 34 | Low Bit Triton Kernels | [5](./GPU-05-Quantization-Sparsity-Numerics.md) | — |
| 35 | SGLang Performance Optimization | [7](./GPU-07-LLM-Systems-Inference.md) | [PDF](../../../Books/GPU-MODE-Lectures/L035-SGLang-Performance.pdf) |
| 36 | CUTLASS and Flash Attention 3 | [4](./GPU-04-CUTLASS-CuTe-Tensor-Cores.md) | [PDF](../../../Books/GPU-MODE-Lectures/L036-CUTLASS-FlashAttention3.pdf) |
| 37 | SASS & GPU Microarchitecture | [4](./GPU-04-CUTLASS-CuTe-Tensor-Cores.md) | [PDF](../../../Books/GPU-MODE-Lectures/L037-SASS-GPU-Microarchitecture.pdf) |
| 38 | Lowbit Kernels for ARM CPU | [5](./GPU-05-Quantization-Sparsity-Numerics.md) | [PDF](../../../Books/GPU-MODE-Lectures/L038-Lowbit-Kernels-ARM.pdf) |
| 39 | TorchTitan | [6](./GPU-06-Multi-GPU-Distributed.md) | — |
| 40 | FlashInfer | [7](./GPU-07-LLM-Systems-Inference.md) | — |
| 41 | CUDA Docs for Humans | [1](./GPU-01-CUDA-Foundations.md) | — |
| 42 | Mosaic GPU | [3](./GPU-03-Triton-Compilers-DSLs.md) | — |
| 43 | int8 Matmul on Turing | [4](./GPU-04-CUTLASS-CuTe-Tensor-Cores.md) | [PDF](../../../Books/GPU-MODE-Lectures/L043-Int8-Matmul-Turing.pdf) |
| 57 | CuTe | [4](./GPU-04-CUTLASS-CuTe-Tensor-Cores.md) | [PDF](../../../Books/GPU-MODE-Lectures/L057-CuTe.pdf) |
| 67 | NCCL & NVSHMEM | [6](./GPU-06-Multi-GPU-Distributed.md) | — |
| 69 | Quartet: 4-bit Training | [5](./GPU-05-Quantization-Sparsity-Numerics.md) | — |
| 70 | Fault-Tolerant Communication Collectives | [6](./GPU-06-Multi-GPU-Distributed.md) | — |
| 71 | FlexOlmo | [7](./GPU-07-LLM-Systems-Inference.md) | [PDF](../../../Books/GPU-MODE-Lectures/L071-FlexOlmo.pdf) |
| 72 | Efficient Long-Context Modeling | [7](./GPU-07-LLM-Systems-Inference.md) | [PDF](../../../Books/GPU-MODE-Lectures/L072-Long-Context-StreamingLLM.pdf) |
| 74 | Positional Encodings and PaTH Attention | [7](./GPU-07-LLM-Systems-Inference.md) | [PDF](../../../Books/GPU-MODE-Lectures/L074-PaTH-Attention.pdf) |
| 75 | GPU Programming Fundamentals + ThunderKittens | [4](./GPU-04-CUTLASS-CuTe-Tensor-Cores.md) | [PDF](../../../Books/GPU-MODE-Lectures/L075a-GPU-Programming-Fundamentals.pdf) · [PDF](../../../Books/GPU-MODE-Lectures/L075b-ThunderKittens.pdf) |
| 78 | Iris: Multi-GPU Programming in Triton | [6](./GPU-06-Multi-GPU-Distributed.md) | [PDF](../../../Books/GPU-MODE-Lectures/L078-Iris-Multi-GPU-Triton.pdf) |
| 79 | Mirage (MPK): Mega Kernels | [3](./GPU-03-Triton-Compilers-DSLs.md) | [PDF](../../../Books/GPU-MODE-Lectures/L079-Mirage.pdf) |
| 84 | Numerics and AI | [5](./GPU-05-Quantization-Sparsity-Numerics.md) | [PDF](../../../Books/GPU-MODE-Lectures/L084-Numerics-and-AI.pdf) |
| 86 | Introduction to CuTeDSL | [4](./GPU-04-CUTLASS-CuTe-Tensor-Cores.md) | [PDF](../../../Books/GPU-MODE-Lectures/L086-CuTeDSL-Intro.pdf) |
| 103 | CuTe Layout Algebra | [4](./GPU-04-CUTLASS-CuTe-Tensor-Cores.md) | [PDF](../../../Books/GPU-MODE-Lectures/L103-CuTe-Layout-Algebra.pdf) |
| 104 | Gluon: Tile-Based GPU Programming | [3](./GPU-03-Triton-Compilers-DSLs.md) | [PDF](../../../Books/GPU-MODE-Lectures/L104-Gluon.pdf) |
| 106 | HF Kernels | [3](./GPU-03-Triton-Compilers-DSLs.md) | — |
| 114 | PyCuTe | [4](./GPU-04-CUTLASS-CuTe-Tensor-Cores.md) | [PDF](../../../Books/GPU-MODE-Lectures/L114-PyCuTe.pdf) |

Lectures without a PDF are video only or have slides hosted externally. The track notes link to those slides.

[Start Track 1 →](./GPU-01-CUDA-Foundations.md)
