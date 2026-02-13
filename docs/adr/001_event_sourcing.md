# ADR-001 — Event Sourcing as the persistence model

**Status:** Accepted  
**Date:** 2026-01-12

---

## Context

Ledgr needs to track shared expenses across multiple users. The naive approach is
to store a mutable `expenses` table: each edit overwrites a row, each deletion
removes it. This is simple but loses history, makes concurrent edits racy, and
gives us no mechanism for building real-time feeds or auditing past states.

Three concrete requirements pushed toward immutability:

1. **Correctness under concurrent writes.** Two users adding an expense at the
   same time must not silently overwrite each other.
2. **Real-time sync.** WebSocket subscribers need to know *what changed*, not
   just the new state. A mutable model only gives you the latter.
3. **Audit trail.** Users want to see who edited or deleted an expense, and when.

---

## Decision

The `events` table is **append-only**. Every state change — expense added,
expense edited, expense deleted, payment recorded — is a new row. Edits and
deletes reference the original `expense_id` in their payload but do not
touch the original event.

Balances are **never stored as mutable state**. They are projected from the
event log on every read (Phase 3) and later from a snapshot + delta (Phase 5).

Per-group `sequence_number` with a unique constraint on `(group_id, sequence_number)`
provides optimistic concurrency control: two writers racing on the same group
each read the current max, try to insert with max+1, and one will get a unique
constraint violation and retry.

---

## Consequences

**Positive**

- Full audit history comes for free — you can replay to any point in time.
- Concurrent writes are handled at the DB constraint level, no application-level locks.
- WebSocket fanout is natural: broadcast the event that was just appended.
- Edits and deletes are reversible; accidental deletions don't lose data.

**Negative**

- Balance reads require a projection pass over all events (mitigated by snapshots in ADR-002).
- Schema evolution is harder: payload shape changes must be versioned (`event_version`).
- Storage grows monotonically; periodic archiving would be needed at scale.

---

## Alternatives considered

**Mutable rows + change-data-capture (CDC):** Would give real-time sync via
Postgres logical replication but still loses history and adds operational
complexity (managing a CDC pipeline).

**CQRS with separate read models:** We effectively have this — the `balances`
projection is a read model. Fully separate read-model infrastructure was deemed
over-engineering for this stage.
