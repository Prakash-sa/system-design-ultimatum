# SQL Interview Questions and Answers

This guide covers the SQL concepts, query patterns, performance tradeoffs, and production concerns that commonly appear in backend and data interviews. Examples use PostgreSQL-style SQL; functions such as `DATE_TRUNC`, `INTERVAL`, `PERCENTILE_CONT`, and upsert syntax vary by database.

## Table of Contents

1. [How to Approach a SQL Interview](#how-to-approach-a-sql-interview)
2. [Reference Schema](#reference-schema)
3. [SQL Fundamentals](#sql-fundamentals)
4. [Joins and Aggregation](#joins-and-aggregation)
5. [Window Functions and Advanced Queries](#window-functions-and-advanced-queries)
6. [Indexes and Query Performance](#indexes-and-query-performance)
7. [Transactions and Concurrency](#transactions-and-concurrency)
8. [Database Design and Production SQL](#database-design-and-production-sql)
9. [Rapid Revision Checklist](#rapid-revision-checklist)

---

## How to Approach a SQL Interview

Before writing a query:

1. Clarify the schema, keys, expected output, and SQL dialect.
2. Ask how to handle `NULL`, ties, duplicates, and empty groups.
3. Build the query in stages: filter, join, aggregate, rank, then format.
4. State the expected cardinality after every join.
5. Test edge cases with a tiny example.
6. Discuss indexes and scale only after the query is correct.

When explaining a solution, distinguish between:

- **Correctness:** Does it return the requested rows for all edge cases?
- **Determinism:** If values tie, is the ordering stable?
- **Performance:** Can the database filter and join without scanning unnecessary rows?
- **Maintainability:** Is the intent clear enough for another engineer to safely change it?

---

## Reference Schema

Most examples use these tables:

```sql
CREATE TABLE departments (
    id          BIGINT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE
);

CREATE TABLE employees (
    id            BIGINT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT,
    department_id BIGINT REFERENCES departments(id),
    manager_id    BIGINT REFERENCES employees(id),
    salary        NUMERIC(12, 2) NOT NULL,
    hired_at      DATE NOT NULL
);

CREATE TABLE customers (
    id         BIGINT PRIMARY KEY,
    email      TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE orders (
    id          BIGINT PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    status      TEXT NOT NULL,
    total       NUMERIC(12, 2) NOT NULL,
    created_at  TIMESTAMP NOT NULL
);

CREATE TABLE products (
    id    BIGINT PRIMARY KEY,
    name  TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL
);

CREATE TABLE order_items (
    order_id   BIGINT REFERENCES orders(id),
    product_id BIGINT REFERENCES products(id),
    quantity   INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL,
    PRIMARY KEY (order_id, product_id)
);
```

---

## SQL Fundamentals

### Q1: What is the logical execution order of a `SELECT` query?

**Answer:**

The conceptual order is:

1. `FROM` and `JOIN`
2. `WHERE`
3. `GROUP BY`
4. `HAVING`
5. Window-function evaluation
6. `SELECT`
7. `DISTINCT`
8. `ORDER BY`
9. `LIMIT` and `OFFSET`

This explains why a `SELECT` alias usually cannot be referenced in `WHERE`: the alias does not exist yet at that logical stage. The optimizer may execute the physical plan differently while preserving the same result.

### Q2: What is the difference between `WHERE` and `HAVING`?

**Answer:**

`WHERE` filters rows before grouping. `HAVING` filters groups after aggregation.

```sql
SELECT department_id, AVG(salary) AS avg_salary
FROM employees
WHERE hired_at >= DATE '2025-01-01'
GROUP BY department_id
HAVING AVG(salary) > 100000;
```

Use `WHERE` whenever possible because reducing rows before aggregation usually requires less work.

### Q3: How does `NULL` behave in SQL?

**Answer:**

`NULL` means unknown or missing, not zero or an empty string. Comparisons such as `salary = NULL` do not return true; use `IS NULL` or `IS NOT NULL`. SQL uses three-valued logic: true, false, and unknown.

Important consequences:

- `COUNT(column)` ignores `NULL`; `COUNT(*)` counts rows.
- `NOT IN` can produce surprising results if the subquery contains `NULL`.
- Most aggregates ignore `NULL` values.
- Use `COALESCE(value, fallback)` when an explicit replacement is required.

### Q4: Why is `NOT EXISTS` often safer than `NOT IN`?

**Answer:**

If a `NOT IN` subquery returns even one `NULL`, the comparison can become unknown for every candidate row. `NOT EXISTS` expresses an anti-join and does not have that problem.

```sql
SELECT c.id, c.email
FROM customers c
WHERE NOT EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.id
);
```

### Q5: What is the difference between `UNION` and `UNION ALL`?

**Answer:**

`UNION` combines compatible result sets and removes duplicates. `UNION ALL` retains duplicates and is normally faster because it avoids the distinct step. Use `UNION` only when deduplication is part of the requirement.

### Q6: What is the difference between a primary key, unique key, and foreign key?

**Answer:**

- A **primary key** uniquely identifies each row and is implicitly non-null. A table has one primary key, which may contain multiple columns.
- A **unique constraint** prevents duplicate values in a candidate key. A table can have several unique constraints; treatment of `NULL` is dialect-specific.
- A **foreign key** requires a value to match a candidate key in another table, enforcing referential integrity.

Constraints protect correctness under every writer. Application-only validation is vulnerable to races and bypasses.

### Q7: What is the difference between `DELETE`, `TRUNCATE`, and `DROP`?

**Answer:**

| Command | Effect | Filtering | Structure remains? |
|---|---|---|---|
| `DELETE` | Removes selected rows | Supports `WHERE` | Yes |
| `TRUNCATE` | Removes all rows efficiently | No | Yes |
| `DROP TABLE` | Removes the table itself | No | No |

Locking, logging, identity reset, trigger behavior, and rollback support vary by database. Never assume `TRUNCATE` is a harmless faster `DELETE` without checking the target engine.

### Q8: What are a subquery and a CTE, and when would you use each?

**Answer:**

Both can decompose a query into stages. A CTE introduced with `WITH` often makes multi-step logic easier to read and can be recursive. A correlated subquery can elegantly express per-row existence or scalar lookup logic.

```sql
WITH department_pay AS (
    SELECT department_id, AVG(salary) AS avg_salary
    FROM employees
    GROUP BY department_id
)
SELECT e.name, e.salary, d.avg_salary
FROM employees e
JOIN department_pay d ON d.department_id = e.department_id
WHERE e.salary > d.avg_salary;
```

Do not assume a CTE is automatically faster. Materialization and inlining behavior depend on the database and version; inspect the execution plan.

### Q9: What is a view? How is it different from a materialized view?

**Answer:**

A regular view stores a query definition and evaluates it when queried. A materialized view stores the query result, making reads faster at the cost of storage and refresh complexity. Use a materialized view for expensive, read-heavy calculations that can tolerate stale data.

### Q10: What is normalization, and when would you denormalize?

**Answer:**

Normalization separates facts to reduce duplication and update anomalies:

- **1NF:** Atomic values and no repeating groups.
- **2NF:** 1NF plus no dependency on only part of a composite key.
- **3NF:** 2NF plus no non-key attribute depending on another non-key attribute.

Denormalize deliberately when measured read performance or availability requirements justify duplicated data, such as storing an asynchronously maintained `order_total`. The tradeoff is more complex writes, reconciliation, and possible temporary inconsistency.

---

## Joins and Aggregation

### Q11: Explain the main join types.

**Answer:**

- `INNER JOIN`: Only matching rows from both sides.
- `LEFT JOIN`: Every left row plus matching right rows; missing matches become `NULL`.
- `RIGHT JOIN`: The mirror of a left join; often rewritten for readability.
- `FULL OUTER JOIN`: All rows from both sides, matching where possible.
- `CROSS JOIN`: Cartesian product of both inputs.
- Self-join: A table joined to itself, such as employee to manager.

Always ask whether the relationship is one-to-one, one-to-many, or many-to-many. Unexpected row multiplication is a common source of incorrect totals.

### Q12: Find all employees and their managers, including employees without a manager.

**Answer:**

```sql
SELECT e.id,
       e.name AS employee_name,
       m.name AS manager_name
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id
ORDER BY e.id;
```

The `LEFT JOIN` retains top-level employees whose `manager_id` is `NULL`.

### Q13: Find customers who have never placed an order.

**Answer:**

```sql
SELECT c.id, c.email
FROM customers c
WHERE NOT EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.id
);
```

An equivalent pattern is a `LEFT JOIN` followed by `WHERE o.id IS NULL`, but `NOT EXISTS` usually communicates the intent more directly.

### Q14: Find duplicate customer email addresses.

**Answer:**

```sql
SELECT LOWER(TRIM(email)) AS normalized_email,
       COUNT(*) AS occurrences
FROM customers
GROUP BY LOWER(TRIM(email))
HAVING COUNT(*) > 1
ORDER BY occurrences DESC;
```

First clarify whether matching is case-sensitive and whether whitespace should matter. In production, store or index a canonical form and enforce uniqueness if duplicates are invalid.

### Q15: How do you avoid double-counting when joining multiple one-to-many tables?

**Answer:**

Aggregate each child table to the parent grain before joining. Joining orders directly to both items and payments can multiply rows when one order has several of each.

```sql
WITH item_totals AS (
    SELECT order_id, SUM(quantity * unit_price) AS item_total
    FROM order_items
    GROUP BY order_id
),
payment_totals AS (
    SELECT order_id, SUM(amount) AS paid_total
    FROM payments
    GROUP BY order_id
)
SELECT o.id, i.item_total, COALESCE(p.paid_total, 0) AS paid_total
FROM orders o
JOIN item_totals i ON i.order_id = o.id
LEFT JOIN payment_totals p ON p.order_id = o.id;
```

### Q16: Find employees who earn more than their department average.

**Answer:**

```sql
SELECT id, name, department_id, salary
FROM (
    SELECT e.*,
           AVG(salary) OVER (PARTITION BY department_id) AS dept_avg
    FROM employees e
) ranked
WHERE salary > dept_avg
ORDER BY department_id, salary DESC;
```

A grouped CTE joined back to employees is also correct. The window version retains row detail without a separate join.

### Q17: Find the second-highest distinct salary.

**Answer:**

```sql
SELECT salary
FROM (
    SELECT salary,
           DENSE_RANK() OVER (ORDER BY salary DESC) AS salary_rank
    FROM employees
) ranked
WHERE salary_rank = 2
LIMIT 1;
```

Clarify whether ties count. `DENSE_RANK` returns the second distinct salary. `ROW_NUMBER` instead identifies one physical row in second position and needs a deterministic tie-breaker.

### Q18: Find the top three salaries in each department.

**Answer:**

```sql
SELECT department_id, id, name, salary
FROM (
    SELECT e.*,
           DENSE_RANK() OVER (
               PARTITION BY department_id
               ORDER BY salary DESC
           ) AS salary_rank
    FROM employees e
) ranked
WHERE salary_rank <= 3
ORDER BY department_id, salary DESC, id;
```

Use `ROW_NUMBER` if exactly three employees per department are required. Use `DENSE_RANK` if all employees tied at one of the top three salary levels should be returned.

### Q19: Return each customer's latest order.

**Answer:**

```sql
SELECT id, customer_id, status, total, created_at
FROM (
    SELECT o.*,
           ROW_NUMBER() OVER (
               PARTITION BY customer_id
               ORDER BY created_at DESC, id DESC
           ) AS row_num
    FROM orders o
) ranked
WHERE row_num = 1;
```

The `id DESC` tie-breaker makes the result deterministic when two orders share a timestamp. PostgreSQL also supports `DISTINCT ON`; the window-function solution is more portable.

### Q20: Calculate revenue by month, including only completed orders.

**Answer:**

```sql
SELECT DATE_TRUNC('month', created_at) AS revenue_month,
       SUM(total) AS revenue
FROM orders
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY revenue_month;
```

This does not generate missing months. Join the result to a calendar table or PostgreSQL `generate_series` when zero-revenue months must appear.

---

## Window Functions and Advanced Queries

### Q21: What is a window function, and how is it different from `GROUP BY`?

**Answer:**

`GROUP BY` collapses rows into one row per group. A window function computes across related rows while retaining each input row.

```sql
SELECT id,
       customer_id,
       total,
       SUM(total) OVER (PARTITION BY customer_id) AS customer_lifetime_value
FROM orders;
```

Common window functions include `ROW_NUMBER`, `RANK`, `DENSE_RANK`, `LAG`, `LEAD`, and aggregate functions used with `OVER`.

### Q22: What is the difference between `ROW_NUMBER`, `RANK`, and `DENSE_RANK`?

**Answer:**

For scores `100, 100, 90`:

| Function | Result |
|---|---|
| `ROW_NUMBER()` | `1, 2, 3` |
| `RANK()` | `1, 1, 3` |
| `DENSE_RANK()` | `1, 1, 2` |

Use `ROW_NUMBER` to choose a fixed number of rows, `RANK` for competition ranking with gaps, and `DENSE_RANK` for ranked distinct values without gaps.

### Q23: Calculate a running total of completed-order revenue.

**Answer:**

```sql
WITH daily_revenue AS (
    SELECT created_at::date AS revenue_date,
           SUM(total) AS revenue
    FROM orders
    WHERE status = 'completed'
    GROUP BY created_at::date
)
SELECT revenue_date,
       revenue,
       SUM(revenue) OVER (
           ORDER BY revenue_date
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS running_revenue
FROM daily_revenue
ORDER BY revenue_date;
```

Specifying a `ROWS` frame avoids peer-row behavior that can surprise candidates when the ordering value is duplicated.

### Q24: Calculate month-over-month revenue growth.

**Answer:**

```sql
WITH monthly AS (
    SELECT DATE_TRUNC('month', created_at) AS month,
           SUM(total) AS revenue
    FROM orders
    WHERE status = 'completed'
    GROUP BY DATE_TRUNC('month', created_at)
),
with_previous AS (
    SELECT month,
           revenue,
           LAG(revenue) OVER (ORDER BY month) AS previous_revenue
    FROM monthly
)
SELECT month,
       revenue,
       previous_revenue,
       ROUND(
           100.0 * (revenue - previous_revenue)
           / NULLIF(previous_revenue, 0),
           2
       ) AS growth_percent
FROM with_previous
ORDER BY month;
```

`NULLIF` prevents division by zero. Clarify whether missing months should be filled before comparing adjacent calendar months.

### Q25: Compute each product's percentage of total revenue.

**Answer:**

```sql
WITH product_revenue AS (
    SELECT product_id,
           SUM(quantity * unit_price) AS revenue
    FROM order_items
    GROUP BY product_id
)
SELECT product_id,
       revenue,
       ROUND(100.0 * revenue / NULLIF(SUM(revenue) OVER (), 0), 2)
           AS revenue_percent
FROM product_revenue
ORDER BY revenue DESC;
```

The grouped CTE establishes one row per product; the window sum then calculates the grand total without collapsing those rows.

### Q26: Find the median employee salary.

**Answer:**

In PostgreSQL:

```sql
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median_salary
FROM employees;
```

`PERCENTILE_CONT` interpolates when needed. Some databases provide a `MEDIAN` function; others require ranking the middle one or two rows. State which definition and dialect you are using.

### Q27: Traverse an employee hierarchy with a recursive CTE.

**Answer:**

```sql
WITH RECURSIVE org AS (
    SELECT id, name, manager_id, 0 AS depth, ARRAY[id] AS path
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    SELECT e.id,
           e.name,
           e.manager_id,
           o.depth + 1,
           o.path || e.id
    FROM employees e
    JOIN org o ON e.manager_id = o.id
    WHERE NOT e.id = ANY(o.path)
)
SELECT id, name, manager_id, depth
FROM org
ORDER BY path;
```

The stored path prevents an accidental management cycle from recursing forever. Syntax for arrays and cycle detection varies by engine.

### Q28: Delete duplicate customers while retaining the earliest row.

**Answer:**

First preview the rows that would be removed. Then, inside a transaction:

```sql
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY LOWER(TRIM(email))
               ORDER BY created_at, id
           ) AS row_num
    FROM customers
)
DELETE FROM customers
WHERE id IN (
    SELECT id
    FROM duplicates
    WHERE row_num > 1
);
```

In a real system, update child foreign keys to the retained customer before deletion and add a unique constraint or unique expression index to prevent recurrence.

---

## Indexes and Query Performance

### Q29: What is an index, and why not index every column?

**Answer:**

An index is an auxiliary data structure that helps the database locate or order rows without scanning the whole table. B-tree indexes are common for equality, range, and ordered lookups.

Indexes have costs:

- Extra storage
- Additional work on `INSERT`, `UPDATE`, and `DELETE`
- Vacuum and maintenance overhead
- More choices for the optimizer to evaluate

Create indexes for demonstrated access patterns, constraints, joins, and selective filters—not mechanically for every column.

### Q30: How does column order matter in a composite index?

**Answer:**

For this query:

```sql
SELECT id, total, created_at
FROM orders
WHERE customer_id = 42
  AND status = 'completed'
ORDER BY created_at DESC
LIMIT 20;
```

A useful index is:

```sql
CREATE INDEX idx_orders_customer_status_created
    ON orders (customer_id, status, created_at DESC);
```

The index aligns equality predicates first and ordering next. An index on `(created_at, customer_id)` is generally much less useful for this access pattern. The leftmost-prefix rule is a helpful model, but always validate with the real engine and data distribution.

### Q31: What is a covering index?

**Answer:**

A covering index contains all columns required by a query, allowing an index-only access path when visibility and engine rules permit.

```sql
CREATE INDEX idx_orders_customer_created
    ON orders (customer_id, created_at DESC)
    INCLUDE (status, total);
```

Included columns do not participate in search ordering. Covering indexes can improve read latency but increase index size and write amplification.

### Q32: What does SARGable mean?

**Answer:**

A SARGable predicate can use an index search effectively. Avoid wrapping an indexed column in a function when an equivalent range predicate is available.

```sql
-- Usually harder to use with a normal index on created_at
WHERE DATE(created_at) = DATE '2026-09-01'

-- Index-friendly half-open range
WHERE created_at >= TIMESTAMP '2026-09-01 00:00:00'
  AND created_at <  TIMESTAMP '2026-09-02 00:00:00'
```

Expression indexes can support frequently used expressions, but they should be an intentional design choice.

### Q33: How do you investigate a slow query?

**Answer:**

1. Capture the exact query, parameters, frequency, and latency distribution.
2. Run `EXPLAIN`; use `EXPLAIN ANALYZE` safely because it executes the query.
3. Compare estimated rows with actual rows.
4. Look for large scans, bad join choices, sorts spilling to disk, repeated loops, and lock waits.
5. Verify statistics, indexes, predicate selectivity, and data skew.
6. Reduce data early, remove unnecessary work, or add an appropriate index.
7. Measure again under representative load.

An unused index is not always the bug: for a query returning most of a table, a sequential scan may be optimal.

### Q34: What is the difference between nested-loop, hash, and merge joins?

**Answer:**

| Join algorithm | Often effective when |
|---|---|
| Nested loop | Outer input is small and the inner join key has an efficient lookup |
| Hash join | Inputs are unsorted and an equality join's build side fits reasonably in memory |
| Merge join | Both inputs are already sorted or sorting is worthwhile; also useful for large inputs |

The optimizer chooses based on estimates. Bad cardinality estimates can lead to a poor algorithm, which is why statistics and SARGable predicates matter.

### Q35: Why can deep `OFFSET` pagination be slow, and what is keyset pagination?

**Answer:**

With `OFFSET 100000`, the database may still identify and discard 100,000 rows. Concurrent inserts can also shift rows between pages. Keyset pagination resumes after the last stable sort key:

```sql
SELECT id, created_at, total
FROM orders
WHERE (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

Support it with an index on `(created_at DESC, id DESC)`. Keyset pagination is fast and stable for next/previous navigation; offset remains convenient for small result sets and arbitrary page numbers.

### Q36: What is the N+1 query problem?

**Answer:**

The application fetches one list with one query, then issues one additional query per row—for example, one query for 100 orders followed by 100 customer queries. This creates network round trips and database overhead.

Fix it with an appropriate join, batch lookup such as `WHERE id IN (...)`, ORM eager loading, or a data-loader pattern. Do not create a huge join blindly if it multiplies several collections; batch loading may be safer.

---

## Transactions and Concurrency

### Q37: What does ACID mean?

**Answer:**

- **Atomicity:** A transaction's operations commit together or roll back together.
- **Consistency:** Transactions preserve declared invariants and constraints.
- **Isolation:** Concurrent transactions behave according to the selected isolation guarantees.
- **Durability:** Committed changes survive failures covered by the database's durability contract.

ACID does not mean every business workflow belongs in one distributed transaction. Cross-service processes often require idempotency, an outbox, retries, and compensating actions.

### Q38: What anomalies do isolation levels address?

**Answer:**

| Anomaly | Meaning |
|---|---|
| Dirty read | Reading another transaction's uncommitted data |
| Non-repeatable read | Re-reading a row and seeing a committed change |
| Phantom | Re-running a predicate and seeing a changed set of rows |
| Lost update | One writer silently overwrites another writer's change |
| Write skew | Concurrent transactions preserve row-level checks but jointly violate an invariant |

SQL-standard levels are Read Uncommitted, Read Committed, Repeatable Read, and Serializable, but exact guarantees differ across engines. Choose based on the invariant, not only on the level's name.

### Q39: Explain optimistic and pessimistic locking.

**Answer:**

Pessimistic locking acquires a lock before changing a row:

```sql
BEGIN;
SELECT available
FROM inventory
WHERE product_id = 42
FOR UPDATE;

UPDATE inventory
SET available = available - 1
WHERE product_id = 42;
COMMIT;
```

Optimistic locking detects conflicts at update time, often with a version column:

```sql
UPDATE documents
SET body = :body,
    version = version + 1
WHERE id = :id
  AND version = :expected_version;
```

If zero rows change, the client retries or reports a conflict. Optimistic locking is attractive when collisions are rare; pessimistic locking is useful when conflicts are likely and the locked transaction can remain short.

### Q40: What causes a deadlock, and how should an application handle one?

**Answer:**

A deadlock occurs when transactions wait cyclically for locks held by one another. The database detects the cycle and aborts a victim.

Reduce deadlocks by:

- Updating resources in a consistent order
- Keeping transactions short
- Indexing predicates so fewer rows are locked
- Avoiding user or network waits inside transactions

The application must recognize the engine's retryable deadlock error and retry the entire transaction with bounded exponential backoff and jitter.

### Q41: How do you safely decrement inventory without overselling?

**Answer:**

Use one conditional atomic update:

```sql
UPDATE inventory
SET available = available - :quantity
WHERE product_id = :product_id
  AND available >= :quantity
RETURNING available;
```

Success means one row was returned; zero rows means insufficient inventory or an invalid product. A prior `SELECT` followed by an unconditional `UPDATE` is vulnerable to a race unless both are protected by suitable locking.

### Q42: How do you make an insert idempotent?

**Answer:**

Give the operation a stable idempotency key, enforce it with a unique constraint, and handle the conflict atomically.

```sql
INSERT INTO payments (idempotency_key, customer_id, amount, status)
VALUES (:key, :customer_id, :amount, 'pending')
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING id, status;
```

On conflict, fetch the existing result and verify that immutable request fields match. MySQL uses `INSERT ... ON DUPLICATE KEY UPDATE`; SQL Server and Oracle have different options and caveats.

---

## Database Design and Production SQL

### Q43: How would you model a many-to-many relationship?

**Answer:**

Use a junction table whose foreign keys usually form its primary key:

```sql
CREATE TABLE user_roles (
    user_id    BIGINT REFERENCES users(id),
    role_id    BIGINT REFERENCES roles(id),
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_role ON user_roles(role_id, user_id);
```

The reverse index supports finding all users for a role; the primary key already supports finding roles for a user.

### Q44: Should money use `FLOAT` or `DECIMAL`/`NUMERIC`?

**Answer:**

Use an exact representation: a fixed-precision `DECIMAL`/`NUMERIC`, or integer minor units such as cents with a currency code. Binary floating-point cannot exactly represent many decimal fractions and can introduce unacceptable rounding errors. Define rounding rules and never assume every currency has two decimal places.

### Q45: How should timestamps be stored?

**Answer:**

Store an unambiguous instant—commonly UTC—and preserve the user's IANA time-zone name separately when future local-time rules matter. In PostgreSQL, `TIMESTAMP WITH TIME ZONE` represents an instant but does not retain the original zone label.

Use half-open ranges such as `[start, end)` for time intervals. They compose cleanly and avoid precision-dependent expressions like `23:59:59.999`.

### Q46: How do you prevent SQL injection?

**Answer:**

Use parameterized queries or prepared statements for values:

```sql
SELECT id, email
FROM customers
WHERE email = $1;
```

Never concatenate untrusted input into SQL. Identifiers such as a requested sort column usually cannot be bound as values, so map them through a strict allowlist. Also use least-privilege database roles, but do not treat escaping or permissions as a substitute for parameters.

### Q47: When would you partition a table?

**Answer:**

Partition when a very large table has a natural partition key and operations benefit from partition pruning or lifecycle management. Common examples include time-partitioned events and tenant-partitioned data.

Benefits include smaller per-partition indexes, faster archival or deletion, and pruning irrelevant partitions. Costs include operational complexity, restrictions on uniqueness across partitions, skew, and queries that accidentally touch every partition. Partitioning is not a replacement for indexes.

### Q48: What is the outbox pattern?

**Answer:**

When a service must update its database and publish an event, writing both independently creates a dual-write failure window. The outbox pattern writes the business change and an outbox row in the same local transaction. A relay later publishes the event and marks it processed.

Consumers should still be idempotent because delivery is normally at least once. Change data capture can act as the relay.

### Q49: How would you perform a zero-downtime schema change?

**Answer:**

Use an expand-and-contract sequence:

1. Add a backward-compatible nullable column or new table.
2. Deploy code that can tolerate both schemas.
3. Backfill in small, observable batches.
4. Write both representations if a transition requires it.
5. Switch reads and verify correctness.
6. Add validation or stricter constraints using the engine's low-locking options.
7. Stop old writes and remove the old schema in a later release.

Avoid a single deployment that renames or drops a column still used by running application instances.

### Q50: How would you design an audit log?

**Answer:**

Use an append-only table containing the actor, action, resource, timestamp, request or trace ID, and a carefully selected before/after representation. Index common investigations such as `(resource_type, resource_id, occurred_at)` and `(actor_id, occurred_at)`.

Keep sensitive values out of the log or protect them appropriately. Restrict update and delete privileges, define retention policy, and export to tamper-resistant storage when compliance requires stronger guarantees. An audit log is not the same as application debug logging.

---

## Rapid Revision Checklist

Before an interview, make sure you can explain and write:

- Join types, join cardinality, and anti-joins
- `WHERE` versus `HAVING`
- `NULL` and three-valued logic
- `GROUP BY` and conditional aggregation
- `ROW_NUMBER`, `RANK`, `DENSE_RANK`, `LAG`, and running totals
- CTEs, recursive CTEs, and correlated subqueries
- Primary, unique, foreign-key, and check constraints
- Composite and covering indexes
- SARGable predicates and `EXPLAIN ANALYZE`
- Keyset pagination
- ACID, isolation anomalies, locks, and deadlocks
- Atomic conditional updates and idempotent inserts
- Normalization, partitioning, schema migrations, and the outbox pattern
- Parameterized queries and least privilege

## Related Notes

- [Database Tradeoffs](../01.%20Core%20Concepts/01-Database-Tradeoffs.md)
- [PostgreSQL](./Postgres.md)
- [Caching Strategies](../01.%20Core%20Concepts/02-Caching-Strategies.md)
- [Data Processing](../01.%20Core%20Concepts/07-Data-Processing.md)
