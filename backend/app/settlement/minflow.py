"""
Greedy min-cashflow settlement via max-heap.

Always matches the largest creditor against the largest debtor.
Produces at most n-1 transactions for n participants — optimal for this problem.

Contrast with pairwise netting (commit 23) which processes in insertion order
and can create more transactions when debts don't cleanly cancel.
"""
import heapq

from app.schemas.settlement import TransactionItem


def settle_minflow(
    balances: dict[str, dict[str, int]],
) -> list[TransactionItem]:
    transactions: list[TransactionItem] = []

    currencies: set[str] = set()
    for ccys in balances.values():
        currencies.update(ccys.keys())

    for currency in currencies:
        # Build max-heaps using negation (Python's heapq is a min-heap)
        creditors: list[tuple[int, str]] = []
        debtors: list[tuple[int, str]] = []

        for uid, ccys in balances.items():
            amt = ccys.get(currency, 0)
            if amt > 0:
                heapq.heappush(creditors, (-amt, uid))
            elif amt < 0:
                heapq.heappush(debtors, (amt, uid))  # already negative

        while creditors and debtors:
            neg_credit, creditor = heapq.heappop(creditors)
            neg_debt, debtor = heapq.heappop(debtors)

            credit = -neg_credit
            debt = -neg_debt

            amount = min(credit, debt)
            transactions.append(
                TransactionItem(
                    from_user=debtor,
                    to_user=creditor,
                    amount=amount,
                    currency=currency,
                )
            )

            remaining_credit = credit - amount
            remaining_debt = debt - amount

            if remaining_credit > 0:
                heapq.heappush(creditors, (-remaining_credit, creditor))
            if remaining_debt > 0:
                heapq.heappush(debtors, (-remaining_debt, debtor))

    return transactions
