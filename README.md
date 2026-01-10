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
