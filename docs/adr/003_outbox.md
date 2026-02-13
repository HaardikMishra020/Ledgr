# ADR-003 — Transactional outbox for WebSocket fanout

**Status:** Accepted  
**Date:** 2026-02-06  
**Supersedes:** direct Redis publish from request handler (commit 26)

---

## Context

When a user adds an expense, connected WebSocket clients need to receive the
update so they can refresh their balances and activity feed without polling.

The naive implementation (commit 26) published directly to Redis from the
request handler, after `await db.commit()`:

```
1. INSERT event → DB commit
2. redis.publish(group_channel, message)        ← can fail or race
3. return HTTP response
```

Two failure modes make this unreliable:

**Lost publish.** If the process crashes or the Redis connection drops between
step 1 and step 2, the event is durably stored in Postgres but the Redis
publish never happens. Subscribers miss the update silently.

**Phantom publish.** Less common but possible: if the DB commit fails after the
publish is sent (e.g., a constraint violation caught late), subscribers receive
an event that was never actually written.

---

## Decision

Use the **transactional outbox pattern**:

1. `events/store.py` writes the `Event` row and an `EventOutbox` row in the
   **same database transaction** (`db.flush()` before `db.commit()`).
2. A background worker (`ws/worker.py`) polls `event_outbox` for rows where
   `published_at IS NULL`, publishes each to Redis, then marks the row as published.

```
Request handler:
  flush(Event, EventOutbox)  ← atomic
  commit()
  return HTTP 201

Worker (every 1 s):
  SELECT * FROM event_outbox WHERE published_at IS NULL LIMIT 100
  for each row:
    redis.publish(...)
    row.published_at = now()
  commit()
```

The `EventOutbox` row exists if and only if its parent `Event` was committed.
A crash at any point leaves the outbox row unprocessed — the worker picks it
up on restart.

The `event_outbox` table has a partial index on `(published_at) WHERE published_at IS NULL`
so the worker query is a tiny index scan even when millions of rows are published.

---

## Consequences

**Positive**

- **At-least-once delivery:** subscribers never miss an event due to a Redis
  connection failure or process crash.
- **No phantom publishes:** a failed DB transaction never produces an outbox row,
  so nothing is published for aborted writes.
- Clean separation: the request handler has no Redis dependency; its only job is
  to append events durably.

**Negative**

- **Latency:** real-time delivery is delayed by up to the worker poll interval
  (currently 1 second). For an expense-splitting app this is acceptable; a
  trading system would need a sub-100 ms push trigger.
- **Duplicate delivery:** if the worker crashes after publishing but before
  marking `published_at`, it will re-publish on restart. Clients should be
  idempotent (re-fetch on any message rather than applying deltas directly).
- **Extra table + worker:** operational surface grows. The worker must be
  colocated with the API process or have its own DB connection pool.

---

## Alternatives considered

**Postgres LISTEN/NOTIFY:** avoids the outbox table but doesn't survive Redis
restarts and requires a persistent LISTEN connection per instance.

**Debezium / CDC:** would tail the Postgres WAL and publish to Kafka/Redis.
Correct and scalable, but adds significant infrastructure for a project at
this stage.

**Exactly-once via Redis Streams with consumer groups:** would eliminate
duplicate delivery but requires clients to track their stream offset. Out of
scope for current phase.
