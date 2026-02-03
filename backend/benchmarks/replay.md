# Balance Replay Benchmark

**Endpoint:** `GET /groups/{id}/balances`  
**Setup:** single Postgres instance (Railway hobby), FastAPI + asyncpg, Python 3.11

---

## Before — naive full replay (commits 14–20)

Projection: `app/projection/naive.py` — reads every event on every request.

| Events | p50 | p99 | notes |
|--------|-----|-----|-------|
| 100 | 5 ms | 11 ms | baseline |
| 500 | 22 ms | 41 ms | |
| 1 000 | 43 ms | 79 ms | |
| 5 000 | 198 ms | 334 ms | starts to feel slow |
| 10 000 | 431 ms | 687 ms | unacceptable |

Latency scales **linearly with event count** — O(N) every request. A busy group
recording 10 expenses/week hits 10k events in under 4 years.

---

## After — snapshot + delta replay (commits 21–22)

Projection: `app/projection/delta.py` — loads snapshot, replays ≤ 49 delta events.  
Snapshot rebuilt automatically every 50 events by `events/store.py`.

| Events | delta events read | p50 | p99 |
|--------|-------------------|-----|-----|
| 1 000 | ≤ 49 | 7 ms | 13 ms |
| 5 000 | ≤ 49 | 7 ms | 13 ms |
| 10 000 | ≤ 49 | 8 ms | 15 ms |
| 100 000 | ≤ 49 | 8 ms | 16 ms |

**54× improvement** at 10k events (431 ms → 8 ms p50).  
Latency is now **O(1) in total event history** — only the delta since the last
snapshot is read, capped at 49 rows.

---

## Worst case (no snapshot yet)

A fresh group with no snapshot falls back to full replay. The first request after
a group reaches the next 50-event boundary triggers a synchronous snapshot write,
after which all subsequent requests hit the fast path.
