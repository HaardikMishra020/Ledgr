"""
Seed a group with N expense events for benchmarking.

Usage:
    TOKEN=<jwt> GROUP_ID=<uuid> python backend/benchmarks/seed.py

Optional env vars:
    BASE_URL  (default: http://localhost:8000)
    N         (default: 10000)
"""
import asyncio
import os
import sys

import httpx

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")
TOKEN    = os.environ["TOKEN"]
GROUP_ID = os.environ["GROUP_ID"]
N        = int(os.environ.get("N", 10_000))

HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
CONCURRENCY = 1


async def seed() -> None:
    semaphore = asyncio.Semaphore(CONCURRENCY)
    errors = 0

    async def post_one(client: httpx.AsyncClient, i: int) -> None:
        nonlocal errors
        async with semaphore:
            r = await client.post(
                f"/groups/{GROUP_ID}/expenses",
                json={
                    "description": f"bench expense {i}",
                    "amount": 1000,
                    "currency": "USD",
                },
            )
            if r.status_code not in (200, 201):
                errors += 1
                if errors <= 3:
                    print(f"  error on {i}: {r.status_code} {r.text[:120]}", file=sys.stderr)

    async with httpx.AsyncClient(
        base_url=BASE_URL, headers=HEADERS, timeout=30
    ) as client:
        tasks = [post_one(client, i) for i in range(N)]
        total = len(tasks)

        for batch_start in range(0, total, 200):
            batch = tasks[batch_start : batch_start + 200]
            await asyncio.gather(*batch)
            done = min(batch_start + 200, total)
            print(f"  {done}/{total} expenses posted  ({errors} errors so far)")

    if errors:
        print(f"\nFinished with {errors} errors.", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"\nDone — {N} expenses seeded into group {GROUP_ID}")


if __name__ == "__main__":
    asyncio.run(seed())
