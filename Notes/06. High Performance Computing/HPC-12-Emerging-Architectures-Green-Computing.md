# Emerging Architectures, Edge, and Green Computing

Advanced computing systems trade generality for performance, latency, or energy efficiency. The durable skill is not memorizing every device; it is matching an algorithm's parallelism, data movement, precision, control flow, and failure model to an architecture.

## Specialized Accelerators

### Why specialize?

A general CPU spends transistors and energy on caches, branch prediction, speculation, and broad instruction support. An accelerator removes or narrows some of that machinery to increase throughput or efficiency for a workload class.

Evaluate an accelerator using:

- supported data types and numerical behavior;
- programming model and toolchain maturity;
- memory capacity, bandwidth, and host/device transfer path;
- synchronization and communication primitives;
- control-flow regularity and sparsity support;
- compilation/startup cost and deployment portability;
- end-to-end speedup, utilization, power, and cost—not kernel peak alone.

## FPGA Computing

Field-programmable gate arrays configure logic, on-chip memory, and interconnect into a custom data path.

- Deep pipelines provide high throughput with deterministic latency.
- Fixed-point or custom-width arithmetic can save area and energy.
- On-chip streams avoid instruction-fetch overhead and repeated memory traffic.
- Best fits: packet processing, compression, signal processing, genomics, low-latency finance, and stable kernels.
- Costs: long synthesis, difficult debugging, explicit dataflow/resource design, and lower clock rates.

High-level synthesis compiles C/C++-like kernels, but achieving performance still requires understanding initiation interval, pipeline dependencies, BRAM banking, interface bandwidth, and resource utilization.

## ASICs and Tensor Accelerators

An ASIC fixes the architecture in silicon. It offers the best efficiency/volume when the workload and market justify non-recurring design cost.

Tensor processing units and similar AI accelerators organize many multiply-accumulate units as systolic arrays or matrix engines. Data flows through neighboring units, maximizing reuse and minimizing expensive global movement.

- Dense/batched matrix operations are ideal.
- Shape padding, transposes, host transfer, and unsupported operators can erase gains.
- Reduced precision (FP16, BF16, FP8, integer) raises throughput; accumulation and scaling strategies protect accuracy.
- Sparse acceleration requires structured sparsity or hardware that can skip zeros without irregular overhead.

## Heterogeneous Integration

A node may combine CPUs, GPUs, tensor units, DPUs/SmartNICs, FPGAs, and multiple memory tiers.

The CPU handles orchestration and latency-sensitive serial work; accelerators handle suitable kernels; NIC/DPU offload handles communication, storage, or security. The challenge is placement:

- keep data near the device that repeatedly consumes it;
- pipeline transfers with computation;
- avoid format conversions and redundant copies;
- map ranks/threads/devices to the same NUMA/NIC locality;
- balance the pipeline so one specialized stage does not idle the rest.

Portable abstractions (OpenMP target, SYCL, Kokkos, RAJA) reduce source divergence, but performance portability still needs architecture-specific tuning policies.

## Neuromorphic Computing

Neuromorphic systems model event-driven neurons and synapses rather than executing conventional dense instruction streams.

### Core ideas

- **spiking neural networks (SNNs)** communicate discrete spikes over time;
- **event-driven processing** activates hardware only when events occur;
- **memristive/crossbar devices** may combine storage and analog computation;
- **synaptic plasticity** changes connection strength based on activity;
- local state and sparse communication target ultra-low power.

Strengths include sensory processing, always-on detection, robotics, and temporal/sparse workloads. Challenges include training algorithms, device variation, limited precision, mapping, benchmarks, and integration with conventional systems.

Brain-inspired does not automatically mean biologically accurate or more capable. Compare task accuracy, latency, energy per inference/event, training cost, and programmability.

## Quantum Computing Mental Model

### Qubits and circuits

A qubit is a normalized two-amplitude quantum state. Gates transform states; entanglement creates correlations that cannot be represented as independent qubits; measurement yields classical outcomes probabilistically.

Quantum speedup comes from algorithm structure—interference that amplifies useful outcomes—not from trying all answers and reading them all.

### Architecture constraints

- qubit connectivity restricts which two-qubit gates are direct;
- routing inserts SWAPs, increasing circuit depth and error;
- gate and readout fidelity constrain useful circuit length;
- coherence time bounds how long state remains reliable;
- calibration drifts, so compilation and scheduling use device properties.

## Quantum Algorithms

| Algorithm/family | Potential use | Important caveat |
|---|---|---|
| Grover/amplitude amplification | quadratic query reduction | data loading and oracle cost matter |
| Shor/phase estimation | factoring, eigenphase estimation | needs large fault-tolerant machines |
| quantum simulation | chemistry/material Hamiltonians | state preparation and measurement cost |
| variational algorithms (VQE/QAOA) | hybrid near-term optimization | noise, barren plateaus, optimizer/sample cost |
| quantum annealing | map optimization to an energy landscape | embedding and solution quality; not universal gate computing |

"Quantum supremacy" or **quantum advantage** means outperforming a defined classical method on a defined task and metric. It does not imply general usefulness. Always ask which baseline, accuracy, hardware cost, and verification method were used.

## Quantum Error Correction

Physical qubits are noisy. Quantum error-correcting codes encode a logical qubit across many physical qubits and repeatedly measure error syndromes without directly measuring the logical state.

- The surface code is prominent because it uses local interactions and has a threshold.
- Fault tolerance requires errors below threshold plus substantial qubit/time overhead.
- Logical gate sets may require expensive operations such as magic-state distillation.

Error mitigation (zero-noise extrapolation, probabilistic cancellation, symmetry checks) can improve noisy results but does not provide scalable fault tolerance.

## Quantum Simulation on Classical HPC

Classical state-vector simulation stores `2^n` complex amplitudes; each extra qubit doubles memory and much gate work. Tensor-network simulation can exploit low entanglement or circuit structure. Stabilizer methods efficiently simulate Clifford-dominated circuits.

HPC techniques include distributed state partitioning, GPU kernels, gate fusion, communication-aware qubit ordering, and checkpointing. Simulation is essential for algorithm development and verification but scales exponentially in the general case.

## Hybrid Quantum-Classical Workflows

A hybrid workflow typically:

1. prepares parameters and batches circuits classically;
2. submits to simulator/QPU queues;
3. gathers sampled measurements;
4. estimates an objective/gradient;
5. updates parameters on CPU/GPU;
6. repeats until budget or convergence criteria are met.

Latency, queueing, shot count, noise, provenance, and retry semantics matter as much as the gate kernel. Batch circuits and cache compilation/calibration artifacts where valid. Record backend, calibration window, transpilation settings, shots, seeds, and mitigation.

## Edge Computing

Edge systems place computation near sensors, users, or actuators to reduce response time, bandwidth, and dependence on a remote cloud.

### Device constraints

- limited power, thermal headroom, memory, storage, and compute;
- intermittent connectivity and physical exposure;
- heterogeneous hardware and long deployment lifetimes;
- real-time deadlines and safety requirements;
- constrained observability and remote-update bandwidth.

### Edge, fog, and cloud split

- **edge device** performs immediate filtering, inference, or control;
- **fog/regional layer** aggregates multiple devices, coordinates local state, and buffers outages;
- **cloud/HPC** trains models, runs global optimization, retains durable data, and performs fleet analytics.

Distributed intelligence may use split inference, federated learning, or hierarchical control. It saves raw-data movement but adds model/version coordination and non-IID data challenges.

### Real-time response

Real-time means meeting a deadline, not merely having low average latency. Track worst-case or high-percentile latency, jitter, queue bounds, and overload behavior. Admission control, fixed allocation, priority inversion control, and bounded algorithms matter.

### Security at the edge

- secure/measured boot and hardware root of trust;
- signed, atomic, rollback-safe updates;
- device identity and short-lived credentials;
- encrypted data and least-privilege local services;
- tamper assumptions, remote attestation, and safe offline behavior;
- privacy-aware filtering before data leaves the device.

## Green Computing

Energy efficiency is performance per joule under a useful workload and accuracy target. Power is a rate; energy is integrated power over time.

```text
energy (joules) = average power (watts) × execution time (seconds)
```

A higher-power accelerator can use less total energy if it finishes much faster. Conversely, maximizing peak utilization can waste energy when memory or communication is the bottleneck.

## Power Capping and Hardware States

- Dynamic voltage/frequency scaling reduces power, but a slower job may consume similar or more energy.
- CPU C-states idle unused cores; P-states adjust active performance.
- GPU application clocks/power limits trade frequency for efficiency.
- Scheduler-level caps shape cluster demand and avoid facility peaks.

Measure time-to-solution, energy-to-solution, and throughput per watt across representative runs. Memory-bound kernels often tolerate lower core frequency with little slowdown.

## Thermal Management and Cooling

Heat limits sustained frequency and component reliability.

- Air cooling is simple but becomes inefficient at high rack density.
- Direct-to-chip liquid cooling removes heat close to CPUs/GPUs.
- Immersion cooling can support very high density but changes serviceability/material requirements.
- Warm-water systems may enable heat reuse.

Monitor inlet/outlet temperature, hotspot throttling, fan/pump power, and facility overhead. PUE (total facility energy / IT energy) is useful but does not measure computational usefulness.

## Renewable Energy and Carbon Accounting

Operational carbon depends on energy and the time/location-dependent grid mix. Carbon-aware scheduling moves flexible workloads to cleaner times or regions, subject to deadlines, data locality, and transfer emissions.

Include:

- operational electricity and cooling;
- embodied emissions from manufacturing and replacement;
- utilization and lifetime of hardware;
- data movement and storage retention;
- whether renewable claims are hourly/location matched or annual offsets.

Avoid optimizing a proxy: reducing reported cloud cost or PUE alone may not reduce total carbon.

## Cross-Cutting Design Questions

When evaluating any advanced architecture, ask:

1. Which portion of end-to-end time and energy can it accelerate?
2. What data movement, conversion, queueing, and orchestration does it add?
3. What numerical/accuracy contract changes?
4. How does the system fail and recover?
5. What is the programming, observability, and maintenance burden?
6. Is the result better than a tuned CPU/GPU baseline on a representative workload?

## Interview / Exam Summary

- Specialization improves efficiency by narrowing supported workloads and control behavior.
- FPGA = configurable dataflow; ASIC/TPU = fixed high-efficiency matrix/data paths; neuromorphic = sparse event-driven state.
- Quantum advantage is task- and baseline-specific; fault tolerance requires error correction and large overhead.
- Hybrid quantum systems are distributed workflows with queueing, sampling, and provenance concerns.
- Edge computing optimizes locality and deadlines under severe resource/security constraints.
- Green computing optimizes energy/carbon per useful result, not low instantaneous power alone.

## Related Files

- [HPC-00-Learning-Roadmap.md](./HPC-00-Learning-Roadmap.md)
- [HPC-06-Computer-Architecture.md](./HPC-06-Computer-Architecture.md)
- [HPC-07-Parallel-Programming.md](./HPC-07-Parallel-Programming.md)
- [HPC-09-Compilers-Profiling-Tuning.md](./HPC-09-Compilers-Profiling-Tuning.md)
- [HPC-11-Data-I-O-Distributed-Resilience.md](./HPC-11-Data-I-O-Distributed-Resilience.md)
