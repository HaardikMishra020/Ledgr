# Balance Replay Benchmark

**Endpoint:** `GET /groups/{id}/balances`  
**Projection:** naive full replay (`app/projection/naive.py`)  
**Setup:** single Postgres instance (Railway hobby), FastAPI + asyncpg, Python 3.11

## Method

Seeded groups with N randomly distributed events (expense_added, expense_edited,
expense_deleted, payment_made in a ~60/15/10/15 ratio). Each run hits the balances
endpoint 50 times with a warm DB connection pool and reports p50 / p99 latency.

## Results

| Events | p50 | p99 | notes |
|--------|-----|-----|-------|
| 100 | 5 ms | 11 ms | baseline |
| 500 | 22 ms | 41 ms | |
| 1 000 | 43 ms | 79 ms | |
| 5 000 | 198 ms | 334 ms | starts to feel slow |
| 10 000 | 431 ms | 687 ms | unacceptable |

## Analysis

Latency scales **linearly with event count** — every call reads and processes every
event for the group from scratch. At 10k events a single balance request takes
~430 ms p50. A group that records 10 expenses/week hits 10k events in under 4 years;
a busy group (daily splits) could get there in 9 months.

The problem is architectural:

```
GET /balances → SELECT * FROM events WHERE group_id = ? ORDER BY created_at
              → Python dict projection over N rows
              → O(N) every request
```

## Fix (commit 21)

Replace full replay with **snapshot + delta**:

1. Periodically write a snapshot of the computed balance state at sequence S.
2. On request, load the snapshot then replay only events with `sequence_number > S`.
3. Expected result: p50 drops to ~8 ms regardless of total event history.

See `benchmarks/replay.md` update in commit 22 for before/after numbers.
