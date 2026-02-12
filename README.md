# Ledgr

Event-sourced expense splitting. Backend-first, built to demonstrate distributed systems patterns.

## Tech stack

- **API:** FastAPI + SQLAlchemy 2.0 (async)
- **DB:** PostgreSQL
- **Cache / queue:** Redis
- **Frontend:** Next.js (App Router)
- **Deploy:** Railway (api + db) + Vercel (web) + Upstash (redis)

## Architecture

- Event store is append-only — balances are projected from events, never stored as mutable state.
- Money in integer minor units (no floats).
- Per-group monotonic `sequence_number` → optimistic concurrency control.
- Outbox pattern for reliable WebSocket fanout.
- Greedy heap-based min-cashflow settlement.

## Local dev

```bash
docker compose up
```

## Performance

### Balance projection — before and after snapshots

The `/groups/{id}/balances` endpoint projects net balances from the event log.

| Approach | Events | p50 | p99 |
|---|---|---|---|
| Naive full replay | 10 000 | 431 ms | 687 ms |
| Snapshot + delta | 10 000 | 8 ms | 15 ms |

**54× improvement.** After snapshot + delta replay (commit 21), latency is O(1) in
total event history — only ≤ 49 delta events are read per request.

### Load test — sustained 50 VU on Railway hobby tier

Test: `k6 run benchmarks/k6_balance_load.js` against a group with ~2 000 events.

| Metric | Result |
|---|---|
| Requests | 12 400 total |
| Throughput | 1 847 req/s |
| p50 latency | 12 ms |
| p95 latency | 28 ms |
| p99 latency | 67 ms |
| Error rate | 0 % |

See [`backend/benchmarks/replay.md`](backend/benchmarks/replay.md) for the full
before/after projection comparison.

## Phases

| Phase | Focus |
|---|---|
| 0 | Scaffold |
| 1 | Auth & groups |
| 2 | Event store |
| 3 | Naive projection |
| 4 | Correctness guardrails |
| 5 | Snapshots |
| 6 | Settlement |
| 7 | Real-time |
| 8 | Multi-currency |
| 9 | Frontend |
| 10 | Ship |

## ADRs

- [ADR-001 Event sourcing](docs/adr/001_event_sourcing.md)
- [ADR-002 Snapshots](docs/adr/002_snapshots.md)
- [ADR-003 Outbox pattern](docs/adr/003_outbox.md)
