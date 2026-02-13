# ADR-002 — Snapshot + delta for balance projection

**Status:** Accepted  
**Date:** 2026-01-29  
**Supersedes:** naive full replay from commit 14

---

## Context

After shipping the naive projection (commit 14), benchmarking showed that
`GET /groups/{id}/balances` scales linearly with event count:

| Events | p50 |
|--------|-----|
| 1 000  | 43 ms |
| 5 000  | 198 ms |
| 10 000 | 431 ms |

A group recording 10 expenses/week hits 10 000 events in ~19 months. At that
point every balance request reads 10 000 rows and does 10 000 Python dict ops.

The problem is architectural: no amount of query tuning fixes an O(N) algorithm
when N grows unboundedly.

---

## Decision

Introduce a `snapshots` table with one row per group. A snapshot captures the
full projected state at a given `sequence_number`:

```json
{
  "balances": { "<user_id>": { "USD": 2400 } },
  "expenses": { "<expense_id>": { /* last known expense payload */ } }
}
```

The `expenses` sub-object is critical: without it, `expense_edited` and
`expense_deleted` delta events cannot be correctly reversed without reading
earlier events.

**Hot path:** load snapshot → read events where `sequence_number > snapshot.up_to_sequence`
→ apply delta. The delta is at most 49 events because `events/store.py` rebuilds
the snapshot automatically on every 50th event.

**Fallback:** groups with no snapshot fall back to full replay (new groups, or
after `snapshots` table is truncated for a rebuild).

---

## Consequences

**Positive**

- Balance reads are now O(1) in total event history. p50 at 10 000 events: 8 ms.
- The snapshot can be safely deleted and rebuilt at any time — it is derived state.
- The auto-trigger in `events/store.py` keeps the snapshot fresh with no manual intervention.

**Negative**

- The snapshot must store enough state for correct delta replay (both `balances`
  and `expenses`). A balances-only snapshot would break `expense_edited` delta handling.
- The synchronous snapshot write on the 50th event adds ~5 ms to that one request.
  This could be moved to a background task at scale.
- Snapshot consistency: a crash mid-snapshot-write leaves an inconsistent row.
  This is tolerable because the snapshot is derived — a bad snapshot can be deleted
  and rebuilt from the event log.

---

## Measurement

See [`benchmarks/replay.md`](../../backend/benchmarks/replay.md) for full
before/after numbers. The headline result: **54× improvement** at 10 000 events
(431 ms → 8 ms p50).
