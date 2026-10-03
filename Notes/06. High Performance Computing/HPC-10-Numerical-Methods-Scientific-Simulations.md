# Numerical Methods and Scientific Simulations

HPC exists to advance a model faster, at higher resolution, or across more scenarios. The numerical method determines the computation, communication, memory, stability, and accuracy requirements; hardware choices come afterward.

## A Numerical Method Is a Contract

Before parallelizing, write down:

- governing equations and conserved quantities;
- spatial and temporal discretization;
- stability and convergence conditions;
- error tolerance and acceptable floating-point variation;
- boundary/initial conditions;
- solver stopping criteria;
- mesh or particle resolution;
- validation cases and invariants.

Parallel speed is irrelevant if decomposition, reductions, or reduced precision changes the answer outside this contract.

## Dense Linear Algebra

Dense problems store most matrix entries. High-performance implementations build algorithms from BLAS:

| Level | Kernel | Arithmetic intensity | Typical limit |
|---|---|---|---|
| BLAS-1 | vector-vector (`axpy`, dot) | low | memory bandwidth |
| BLAS-2 | matrix-vector | low/moderate | memory bandwidth |
| BLAS-3 | matrix-matrix | high | compute/vector units |

### Direct solvers

- **LU** solves general square systems using factorization plus triangular solves; pivoting protects stability but creates communication and synchronization.
- **Cholesky** is roughly twice as efficient for symmetric positive-definite matrices.
- **QR** is more stable for least squares but performs more work than normal equations.
- Blocked algorithms turn much of the work into BLAS-3. The panel factorization is the sequential/communication-sensitive portion.

Distributed dense libraries use 2D block-cyclic ownership (for example, ScaLAPACK) to balance work and spread communication.

## Sparse Linear Algebra

Sparse matrices store nonzeros and their coordinates. Storage choice must match the access pattern:

- **CSR**: compact row traversal; standard CPU SpMV format.
- **CSC**: efficient column traversal/factorization operations.
- **COO**: easy assembly and sorting, usually converted for solving.
- **ELL/SELL-C-sigma**: regularized row lengths for vectors/GPUs.
- **Block sparse**: exploits small dense blocks and reduces index overhead.

Sparse matrix-vector multiply performs few FLOPs per byte and is usually bandwidth-bound. Distributed SpMV also imports remote vector entries, so partitioning should balance nonzeros while minimizing edge cut and halo size.

## Iterative Solvers and Preconditioning

Iterative methods approach a solution through repeated SpMV, vector operations, and reductions:

| Problem | Common methods | Main concern |
|---|---|---|
| symmetric positive definite | Conjugate Gradient (CG) | global dot-product reductions |
| nonsymmetric | GMRES, BiCGStab | storage/restarts, convergence behavior |
| eigenvalues | power/Lanczos/Arnoldi | orthogonalization and reductions |
| nonlinear system | Newton–Krylov | Jacobian action and inner/outer tolerances |

A **preconditioner** transforms the system so eigenvalues are more favorable and fewer iterations are required. Examples: Jacobi/block Jacobi, incomplete LU/Cholesky, domain decomposition, algebraic multigrid.

The best preconditioner minimizes time to solution, not iteration count alone. A strong global preconditioner may reduce iterations but communicate too much at scale.

## Tensor Operations

Tensors generalize matrices to more dimensions. Performance depends on contraction order, layout, transposes, and temporary storage. Libraries map contractions to GEMM where possible. In ML/scientific AI, tensor cores accelerate mixed-precision matrix operations; accumulation precision and iterative refinement protect accuracy.

## Differential Equations

### Finite difference methods (FDM)

Approximate derivatives using values on a structured grid. They are simple, regular, and map well to stencils and GPUs. High-order stencils increase arithmetic intensity but need wider halos.

### Finite element methods (FEM)

Represent the solution with basis functions over elements and assemble/integrate a weak form. FEM handles complex geometry and varying polynomial order. Work includes element integration, sparse assembly/action, constraints, and a global solver.

### Spectral methods

Use global or high-order basis functions. Smooth solutions can converge very rapidly, but transforms and global communication (especially 3D FFT transposes) dominate at scale.

### Finite volume methods (FVM)

Integrate conservation laws over control volumes and compute fluxes across faces. FVM conserves quantities naturally and is common in CFD, especially on unstructured meshes.

## Mesh Generation and Refinement

- **Structured meshes** have implicit connectivity and regular memory access.
- **Unstructured meshes** fit complex geometry but require explicit adjacency and irregular gathers.
- **Adaptive mesh refinement (AMR)** refines only where error/features demand it; it needs dynamic load balancing, prolongation/restriction, and coarse-fine boundary handling.
- Mesh quality (skewness, aspect ratio, orthogonality) affects stability and convergence.

Partition with geometry, graphs, or space-filling curves. Repartition when refinement or moving physics creates sustained imbalance, but include migration cost in the decision.

## Boundary and Initial Conditions

Common PDE boundary conditions:

- **Dirichlet**: prescribe the value.
- **Neumann**: prescribe the normal derivative/flux.
- **Robin**: weighted combination of value and derivative.
- **Periodic**: opposite boundaries connect.
- **Inflow/outflow, wall, symmetry, absorbing**: application-specific forms.

Boundary kernels often diverge from interior kernels and may be separated for vector/GPU efficiency. Across rank boundaries, ghost/halo values act as dynamically updated boundary data.

## Time Integration

| Family | Examples | Tradeoff |
|---|---|---|
| explicit | forward Euler, Runge–Kutta | cheap steps; limited by stability/CFL |
| implicit | backward Euler, BDF | larger stable steps; global nonlinear/linear solve |
| symplectic | velocity Verlet, leapfrog | preserves Hamiltonian structure over long runs |
| operator splitting | Strang, IMEX | treats different physics with suitable solvers |

The CFL condition links stable explicit timestep to spatial resolution and signal speed. Refining a grid increases both cells and step count—one reason 3D simulations become expensive so quickly.

## Domain Decomposition

Split the physical domain across ranks; exchange ghost cells and reduce global diagnostics.

- Prefer compact subdomains because volume controls work while surface controls communication.
- Post non-blocking halo transfers, compute the interior, then complete transfers and compute boundaries.
- Use Cartesian neighborhood collectives when the topology is regular.
- For implicit solvers, domain-decomposition methods can also act as preconditioners.

## Monte Carlo Methods

Estimate an expectation using samples. Independent trials make Monte Carlo naturally parallel, and statistical error usually decreases as `1 / sqrt(N)`.

### Random number generation

Parallel streams must be reproducible and non-overlapping. Prefer counter-based generators or documented skip-ahead/substream schemes. Record generator, seed/key, and mapping from samples to ranks. Merely using `seed + rank` with a weak generator is unsafe.

### Sampling and variance reduction

- **importance sampling** draws more often where contribution is high;
- **stratified/Latin hypercube sampling** covers the domain more evenly;
- **control variates** use a correlated quantity with known expectation;
- **antithetic variates** pair negatively correlated samples;
- **quasi-Monte Carlo** uses low-discrepancy sequences;
- **multilevel Monte Carlo** combines many cheap coarse samples with fewer expensive fine samples.

Variance reduction can outperform adding hardware because it reduces the number of required samples.

### Particle transport

Neutron/photon transport follows particles through stochastic interactions. Challenges include branch divergence, irregular memory access, tallies with contention, and load imbalance as particle histories vary. Batching by material/state and hierarchical reductions improve locality.

## Optimization Algorithms

### Gradient-based and convex optimization

- Gradient descent variants trade convergence rate, memory, and synchronization.
- Newton/quasi-Newton methods use curvature; distributed Hessian operations can be expensive.
- Convex problems offer a global optimum; constraints are handled with projections, penalties, barrier/interior-point, or Lagrangian methods.
- Distributed optimization often pays for global gradient aggregation; communication compression and local steps change convergence behavior.

### Global and derivative-free methods

| Method | Parallel pattern | Key limitation |
|---|---|---|
| genetic algorithms | evaluate population members concurrently | many evaluations, hyperparameters |
| simulated annealing | independent chains or parallel tempering | slow convergence schedules |
| particle swarm | parallel fitness with shared/global best | communication and premature convergence |
| Bayesian optimization | parallel candidate evaluation | surrogate scaling, batch selection |
| branch and bound | dynamic task tree | irregularity and global incumbent updates |

These methods are useful for expensive black-box objectives, discontinuities, or many local optima. They do not remove the need to define constraints and convergence criteria.

## Computational Fluid Dynamics

CFD discretizes conservation of mass, momentum, and energy. For incompressible flow, the Navier–Stokes equations couple velocity to pressure through a divergence-free constraint.

### Major workload components

- mesh/geometry preprocessing;
- flux or stencil evaluation;
- pressure/velocity or coupled linear solves;
- turbulence and multiphase models;
- boundary conditions;
- timestep control and convergence checks;
- checkpointing and field output.

### Turbulence and boundary layers

- **DNS** resolves all scales and is extremely expensive as Reynolds number grows.
- **LES** resolves large eddies and models small scales.
- **RANS** models turbulent statistics and is cheapest for engineering workflows.
- Thin boundary layers demand anisotropic near-wall resolution; poor mesh quality harms convergence.

Multiphase models add interfaces, particles, phase coupling, and often smaller stable timesteps. Aerodynamics and hydrodynamics use the same conservation machinery but differ in compressibility, free surfaces, cavitation, and dominant boundary conditions.

## Molecular Dynamics

Advance particles under forces derived from a potential:

1. build/update neighbor lists;
2. compute short-range pair forces;
3. compute long-range electrostatics if needed;
4. integrate positions/velocities (often velocity Verlet);
5. apply constraints, thermostat/barostat, and collect observables.

Spatial decomposition assigns regions to ranks. Particles migrate between regions and halos exchange nearby particles. Neighbor lists avoid all-pairs work by tracking particles within cutoff + skin distance. Particle-mesh Ewald methods handle long-range forces using grids and FFTs. Solvation and biomolecular constraints add specialized kernels and load imbalance.

## Weather and Climate Models

Weather systems couple atmosphere, land, ocean, sea ice, chemistry, and radiation on spherical grids.

- **Data assimilation** combines observations with a forecast state (3D/4D-Var, ensemble Kalman methods).
- **Ensemble forecasting** runs perturbed initial states/models to quantify uncertainty.
- **Grid refinement/nesting** increases resolution over regions of interest.
- **Global forecasting** requires scalable spherical discretizations and huge I/O pipelines.
- Climate runs prioritize conservation and long-term statistical fidelity; operational weather prioritizes strict forecast deadlines.

## Astrophysics

- **N-body/gravitational dynamics**: direct all-pairs for smaller systems; Barnes–Hut/FMM or particle-mesh for scale.
- **Magnetohydrodynamics (MHD)**: couples fluid equations to magnetic fields and must control divergence error.
- **Radiation transport**: angular/frequency dimensions add enormous state and complex sweeps.
- **Cosmology**: evolving expansion plus gravity, gas, and subgrid physics across huge dynamic ranges.
- **Stellar evolution and galaxy formation**: multiphysics, stiff reactions, adaptive grids/particles, long timescales.

## Verification, Validation, and Reproducibility

- **Verification** asks whether the equations were solved correctly: manufactured solutions, convergence order, conservation, regression tests.
- **Validation** asks whether the equations represent reality: experiments, observations, and uncertainty quantification.
- Bitwise equality is often unrealistic across decompositions and accelerators. Use physics-aware tolerances, invariants, and statistical checks.
- Archive mesh/input versions, solver settings, partitioning, code revision, libraries, machine, and random-stream scheme.

## Interview / Exam Summary

- Numerical accuracy/stability is a requirement, not a post-processing check.
- Sparse solvers are usually bandwidth/communication-bound; preconditioning decides time to solution.
- Explicit methods trade global solves for stability-limited timesteps; implicit methods do the reverse.
- Compact domain decompositions reduce surface-to-volume communication.
- Monte Carlo scales well, but RNG stream design and variance dominate correctness/cost.
- Each scientific domain maps to recurring kernels: stencils/fluxes, SpMV, FFTs, particles, reductions, and I/O.

## Related Files

- [HPC-00-Learning-Roadmap.md](./HPC-00-Learning-Roadmap.md)
- [HPC-07-Parallel-Programming.md](./HPC-07-Parallel-Programming.md)
- [HPC-08-Parallel-Algorithms-Performance.md](./HPC-08-Parallel-Algorithms-Performance.md)
- [HPC-03-Storage-Networking-Operations.md](./HPC-03-Storage-Networking-Operations.md)
