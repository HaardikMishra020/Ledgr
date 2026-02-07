"""
FX rate fetcher and daily job.

Fetches from open.er-api.com (free, no API key). Falls back to hardcoded stub
rates if the API is unavailable so the service stays up during network issues.
Stores both (base→quote) and (quote→base) rows so expense handlers can look up
any direction in one query.
"""
import asyncio
import logging
from datetime import date
from decimal import Decimal

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.fx_rate import FxRate

logger = logging.getLogger(__name__)

_TRACKED = {"USD", "EUR", "GBP", "INR", "JPY", "CAD", "AUD"}
_FETCH_URL = "https://open.er-api.com/v6/latest/USD"


async def fetch_and_store_rates(db: AsyncSession) -> None:
    today = date.today()

    existing = await db.scalar(
        select(FxRate).where(FxRate.base == "USD", FxRate.as_of == today)
    )
    if existing:
        return

    raw = await _fetch_usd_rates()
    rows = []
    for quote, rate_val in raw.items():
        rate = Decimal(str(rate_val))
        rows.append(FxRate(base="USD", quote=quote, rate=rate, as_of=today))
        if rate != 0:
            rows.append(FxRate(base=quote, quote="USD", rate=Decimal("1") / rate, as_of=today))

    for row in rows:
        db.add(row)
    await db.commit()
    logger.info("fx rates stored for %s (%d pairs)", today, len(rows))


async def get_rate(base: str, quote: str, db: AsyncSession) -> Decimal:
    if base == quote:
        return Decimal("1")
    today = date.today()
    row = await db.scalar(
        select(FxRate)
        .where(FxRate.base == base, FxRate.quote == quote, FxRate.as_of <= today)
        .order_by(FxRate.as_of.desc())
    )
    return row.rate if row else Decimal("1")


async def run_daily_fx_job() -> None:
    logger.info("FX job started")
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await fetch_and_store_rates(db)
        except Exception:
            logger.exception("FX fetch failed")
        await asyncio.sleep(86_400)


async def _fetch_usd_rates() -> dict[str, float]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(_FETCH_URL)
            r.raise_for_status()
            data = r.json()
            return {q: v for q, v in data["rates"].items() if q in _TRACKED}
    except Exception:
        logger.warning("FX API unreachable, using stub rates")
        return _stub_rates()


def _stub_rates() -> dict[str, float]:
    return {
        "USD": 1.0,
        "EUR": 0.9150,
        "GBP": 0.7850,
        "INR": 83.12,
        "JPY": 149.50,
        "CAD": 1.3550,
        "AUD": 1.5290,
    }
