"""
Settlement algorithm tests.

Key assertion: settle_minflow always produces ≤ transactions as settle_pairwise,
and for the canonical example where sizes perfectly align, produces strictly fewer.
"""
from app.settlement.minflow import settle_minflow
from app.settlement.naive import settle_pairwise


# Canonical case: alice(+$20) and dave(-$20) are a perfect match.
# Greedy-by-largest settles them in one shot; sequential order misses this.
_BALANCES = {
    "alice": {"USD": 2000},   # owed $20
    "bob":   {"USD": 1000},   # owed $10
    "carol": {"USD": -1000},  # owes $10
    "dave":  {"USD": -2000},  # owes $20
}


def test_minflow_fewer_transactions_than_pairwise():
    naive_txns = settle_pairwise(_BALANCES)
    optimal_txns = settle_minflow(_BALANCES)
    assert len(optimal_txns) < len(naive_txns)
    assert len(optimal_txns) == 2
    assert len(naive_txns) == 3


def test_minflow_correctness():
    txns = settle_minflow(_BALANCES)

    net: dict[str, dict[str, int]] = {}
    for t in txns:
        net.setdefault(t.from_user, {}).setdefault(t.currency, 0)
        net[t.from_user][t.currency] -= t.amount
        net.setdefault(t.to_user, {}).setdefault(t.currency, 0)
        net[t.to_user][t.currency] += t.amount

    for uid, ccys in _BALANCES.items():
        for ccy, amt in ccys.items():
            assert amt + net.get(uid, {}).get(ccy, 0) == 0, (
                f"{uid} not fully settled"
            )


def test_minflow_at_most_n_minus_one_transactions():
    txns = settle_minflow(_BALANCES)
    nonzero = sum(
        1 for ccys in _BALANCES.values()
        for amt in ccys.values() if amt != 0
    )
    assert len(txns) <= nonzero - 1


def test_minflow_empty_balances():
    assert settle_minflow({}) == []


def test_minflow_already_settled():
    assert settle_minflow({"alice": {"USD": 0}, "bob": {"USD": 0}}) == []
