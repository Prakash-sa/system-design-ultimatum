# System Design Tradeoffs - Complete Documentation

## Overview

The original **Tradeoffs.md** file has been reorganized into 8 focused markdown files, each covering a specific topic in depth. All original content has been preserved and enhanced with **interview questions and answers** for each section.

In addition, the notes now include a dedicated **HPC track** covering fundamentals, Slurm, MPI, storage/networking, AWS ParallelCluster, system design, and interview preparation.

## File Structure

<details>
<summary>Click to view code</summary>

```
Notes/
├── Tradeoffs.md                     # Master index (reference this first)
├── 01-Database-Tradeoffs.md         # SQL vs NoSQL, location queries, scaling
├── 02-Caching-Strategies.md         # Cache patterns, TTL, invalidation
├── 03-API-Design.md                 # REST, gRPC, GraphQL, WebSocket, SSE
├── 04-Storage-Tradeoffs.md          # Object vs Block vs File storage
├── 05-Communication-Patterns.md     # Sync vs Async, polling, message queues
├── 06-Scalability-Reliability.md    # Vertical vs Horizontal, CAP, circuit breakers
├── 07-Data-Processing.md            # Batch vs Stream, Lambda vs Kappa
├── 08-Architecture-Patterns.md      # Monolith vs Microservices
├── HPC.md                           # Master HPC guide
├── HPC-01-Fundamentals.md           # Core HPC concepts and workload types
├── HPC-02-Slurm-MPI.md              # Slurm scheduler and MPI runtime
├── HPC-03-Storage-Networking-Operations.md # Storage, network, and ops
├── HPC-04-Cloud-ParallelCluster.md  # Cloud HPC and AWS ParallelCluster
└── HPC-05-Interviews.md             # HPC interview prep
```

</details>

## What's New in Each File

### 1. Database Tradeoffs (01-Database-Tradeoffs.md)
- All original content
- **Added**: 5 detailed interview Q&A
  - Netflix recommendation system design
  - Uber location query handling
  - Database slowness - scale or shard?
  - Facebook social network normalization
  - Google Maps geospatial design

### 2. Caching Strategies (02-Caching-Strategies.md)
- All original content
- **Added**: Code examples and implementations
- **Added**: 5 detailed interview Q&A
  - Surge pricing cache strategy
  - Twitter feed caching
  - High-volume event system (1M/sec)
  - When NOT to cache
  - Dynamic TTL calculation

### 3. API Design (03-API-Design.md)
- All original content (REST, gRPC, GraphQL, WebSockets, SSE)
- **Added**: Complete API comparison table (all 6 patterns)
- **Added**: 5 detailed interview Q&A
  - Slack architecture design
  - REST vs gRPC vs GraphQL for microservices
  - Handling 100K events/second to browsers
  - GraphQL for mobile apps
  - Real-time notifications for 10M users

### 4. Storage Tradeoffs (04-Storage-Tradeoffs.md)
- All original content
- **Added**: Storage decision matrix
- **Added**: 3 detailed interview Q&A
  - Instagram photo storage design
  - Database scaling vs replacement
  - Dropbox file sharing architecture

### 5. Communication Patterns (05-Communication-Patterns.md)
- All original content
- **Added**: Message queue patterns (Pub/Sub vs Point-to-Point)
- **Added**: 5 detailed interview Q&A
  - Payment system architecture
  - Twitter tweet notifications
  - Traffic spike handling
  - WebSocket vs Long Polling
  - Retry mechanism design

### 6. Scalability & Reliability (06-Scalability-Reliability.md)
- All original content
- **Added**: Load balancing strategies table
- **Added**: Replication patterns table
- **Added**: Circuit breaker pattern visualization
- **Added**: 5 detailed interview Q&A
  - Database scaling decision
  - Netflix resilience architecture
  - Cache invalidation strategy
  - Multi-region failover design
  - Load balancer capacity planning

### 7. Data Processing (07-Data-Processing.md)
- All original content
- **Added**: Batch/Stream tools comparison tables
- **Added**: Lambda vs Kappa architecture explanations
- **Added**: 5 detailed interview Q&A
  - Real-time fraud detection
  - Daily analytics pipeline
  - E-commerce recommendations
  - Improving slow batch jobs
  - Real-time data warehouse design

### 8. Architecture Patterns (08-Architecture-Patterns.md)
- All original content
- **Added**: Architecture evolution timeline
- **Added**: 4 detailed interview Q&A
  - Monolith to microservices migration
  - Data consistency across services
  - Netflix microservices structure
  - Deployment time analysis

### 9. HPC Track (HPC.md + HPC-01 to HPC-05)
- **Added**: Ground-up HPC guide from fundamentals to system design
- **Added**: Slurm, MPI, OpenMP, GPU, storage, and network coverage
- **Added**: AWS ParallelCluster and cloud HPC design guidance
- **Added**: 50-question interview bank, model answers, mock prompts, and revision sheets

---

## Usage Guide

### For Learning
1. **Start with master index**: `Tradeoffs.md`
2. **Pick a topic**: Choose file matching your interest
3. **Read the theory**: Tables, diagrams, explanations
4. **Study the examples**: Real company examples (Netflix, Uber, Stripe, etc.)
5. **Practice Q&A**: Answer interview questions before reading solutions

### For Interviews
- Review relevant files 2-3 days before
- Focus on the Q&A sections (most likely interview questions)
- Use examples from your relevant file
- Practice explaining tradeoffs clearly

### For Reference
- Bookmark `Tradeoffs.md` for quick navigation
- Use Ctrl+F to search across individual files
- Cross-reference between files (links in master index)

---

## Key Features

✅ **No content deleted** - All original tradeoffs preserved
✅ **Enhanced with examples** - Code snippets, implementation details
✅ **Interview-focused** - 40+ Q&A across all files
✅ **Real-world companies** - Examples from Netflix, Uber, Stripe, Google, Slack, etc.
✅ **Organized by topic** - Easy to find and reference
✅ **Searchable** - Use your editor's find function
✅ **Progressive depth** - Basic tables + detailed explanations + advanced Q&A

---

## Sample Interview Questions Included

1. **Database**: Netflix recommendation system, Uber location queries, Facebook normalization
2. **Caching**: Surge pricing, high-volume events, dynamic TTL
3. **APIs**: Slack design, REST vs gRPC, 10M user notifications
4. **Storage**: Instagram photos, Dropbox file sharing
5. **Communication**: Payment systems, retry mechanisms, traffic spikes
6. **Scalability**: Database scaling, Netflix resilience, multi-region failover
7. **Data Processing**: Real-time fraud detection, analytics pipelines, recommendations
8. **Architecture**: Monolith vs microservices, data consistency, service design
9. **HPC**: Slurm vs Kubernetes, MPI scaling, cloud HPC, ParallelCluster, GPU cluster design

---

## Statistics

- **Core topic files**: 14 (8 tradeoff files + 6 HPC files)
- **Total lines of content**: ~7,000+
- **Interview Q&A**: 90+ questions with detailed answers/model answers
- **Code examples**: 50+ practical implementations
- **Real company examples**: 20+ companies cited
- **Decision matrices**: 15+ comparison tables

---

## How to Navigate

### Quick Links (From Master Index)
<details>
<summary>Click to view code (markdown)</summary>

```markdown
[Database Tradeoffs](./01-Database-Tradeoffs.md)
[Caching Strategies](./02-Caching-Strategies.md)
[API Design](./03-API-Design.md)
[Storage Tradeoffs](./04-Storage-Tradeoffs.md)
[Communication Patterns](./05-Communication-Patterns.md)
[Scalability & Reliability](./06-Scalability-Reliability.md)
[Data Processing](./07-Data-Processing.md)
[Architecture Patterns](./08-Architecture-Patterns.md)
[HPC Master Guide](./HPC.md)
[HPC Fundamentals](./HPC-01-Fundamentals.md)
[HPC Slurm and MPI](./HPC-02-Slurm-MPI.md)
[HPC Storage, Networking, and Operations](./HPC-03-Storage-Networking-Operations.md)
[Cloud HPC and AWS ParallelCluster](./HPC-04-Cloud-ParallelCluster.md)
[HPC Interview Prep](./HPC-05-Interviews.md)
```

</details>

### Search Tips
- **Search for company name**: "Netflix", "Uber", "Stripe" to find relevant examples
- **Search for Q&A**: "Q1:", "Q2:" to jump to interview questions
- **Search for concepts**: "Circuit breaker", "Saga pattern", "Cache stampede"

---

## Recommendation

**For study**: Start with files in order (01 → 08)
**For interviews**: Focus on topic relevant to the role
**For reference**: Bookmark the master index and search as needed

Happy studying! 🚀
