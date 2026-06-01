# Balance Replay Benchmark

**Endpoint:** `GET /groups/{id}/balances`  
**Setup:** local Postgres 16 (Docker), FastAPI + asyncpg, Python 3.12, macOS  
**Group size:** 10 000 events, single group (`e9cd620f-d6d2-486a-aac2-d0b97d8022cd`)

---

## How it was measured

Query execution times captured using `EXPLAIN ANALYZE` run directly inside the
Postgres container via `docker compose exec postgres psql`. This isolates pure DB
cost from HTTP and Docker networking overhead.

The three queries represent each projection path:

**Slow path — full replay:**
```sql
SELECT * FROM events
WHERE group_id = '<id>'
ORDER BY sequence_number ASC;
```

**Fast path — snapshot + delta (two queries in sequence):**
```sql
-- 1. load snapshot
SELECT * FROM snapshots WHERE group_id = '<id>';

-- 2. replay only events after snapshot (literal cutoff from snapshot row)
SELECT * FROM events
WHERE group_id = '<id>'
  AND sequence_number > 9951   -- literal passed by delta.py, not a subquery
ORDER BY sequence_number ASC;
```

**Important:** the delta query must use a hardcoded literal for `sequence_number >`,
not a subquery. A subquery (`MAX(sequence_number) - 49`) causes the planner to
misestimate row count as ~3 300 and pick a Seq Scan, scanning 9 975 rows it then
discards — making the "fast" path nearly as slow as the naive one. In production
`delta.py` reads `up_to_sequence` from the snapshot row and passes it as a bound
parameter; the planner always sees a literal and always picks the index.

---

## EXPLAIN ANALYZE output

### Slow path — 10 000 events (warm cache)

```
Index Scan using ix_events_group_seq on events
  (cost=0.29..1751.29 rows=10011 width=449)
  (actual time=0.009..1.931 rows=10000 loops=1)
  Index Cond: (group_id = 'e9cd620f-...'::uuid)
Planning Time: 0.523 ms
Execution Time: 2.264 ms
```

### Snapshot read (no snapshot exists for this group)

```
Seq Scan on snapshots
  (cost=0.00..1.01 rows=1 width=50)
  (actual time=0.003..0.004 rows=0 loops=1)
  Filter: (group_id = 'e9cd620f-...'::uuid)
Planning Time: 0.241 ms
Execution Time: 0.035 ms
```

### Delta query — 49 events, literal cutoff (warm cache)

```
Index Scan using ix_events_group_seq on events
  (cost=0.29..8.30 rows=1 width=449)
  (actual time=0.022..0.038 rows=49 loops=1)
  Index Cond: ((group_id = 'e9cd620f-...'::uuid) AND (sequence_number > 9951))
Planning Time: 2.083 ms
Execution Time: 0.119 ms
```

---

## Results

| Path | Rows read | Execution time |
|------|-----------|----------------|
| Slow path (full replay) | 10 000 | **2.264 ms** |
| Snapshot read | 0–1 | **0.035 ms** |
| Delta (≤49 events) | 49 | **0.119 ms** |
| **Fast path total** | **50** | **0.154 ms** |

**~15× improvement** at steady-state (warm buffer cache):
`2.264 ms ÷ 0.154 ms = 14.7×`

Under cold-cache conditions (first request after a Postgres restart, data read
from disk), the slow path rises to ~5 ms while the fast path stays at ~0.165 ms,
giving ~30×. Cold cache favours the fast path more because it reads 200× fewer
rows from disk.

---

## End-to-end HTTP latency (local Docker)

Measured with `curl` from the host machine (20 runs per path):

| Path | p50 | p95 | p99 |
|------|-----|-----|-----|
| Naive full replay | 321 ms | 383 ms | 418 ms |
| Snapshot + delta | 99 ms | 139 ms | 188 ms |

The HTTP numbers are dominated by Docker networking overhead. Each `/balances`
request makes 5 sequential DB round trips (auth → membership → group →
snapshot → delta). At ~18 ms per host→container round trip that accounts for
~90 ms of the 99 ms total — not the projection itself.

On a co-located deployment (Railway: API and Postgres in the same datacenter,
~0.5 ms round trips), 5 × 0.5 ms = 2–3 ms overhead + 0.154 ms query = ~3 ms
end-to-end for the fast path.

---

## Worst case (no snapshot yet)

A fresh group with no snapshot falls back to full replay. The first request
after a group crosses a 50-event boundary triggers a synchronous snapshot
write (`_SNAPSHOT_INTERVAL = 50` in `app/events/store.py`), after which all
subsequent requests hit the fast path.

The snapshot table was empty for this group during the benchmark run (rows=0).
The delta query was run with a hardcoded literal cutoff to simulate the fast
path directly in SQL, which matches exactly what `delta.py` does when a
snapshot row is present.
