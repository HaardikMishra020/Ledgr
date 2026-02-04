"""
Naive pairwise settlement.

Iterates debtors in insertion order, settling each against creditors one by one.
O(n²) in the number of participants — replaced by greedy min-cashflow in commit 24.
"""
from app.schemas.settlement import TransactionItem


def settle_pairwise(
    balances: dict[str, dict[str, int]],
) -> list[TransactionItem]:
    transactions: list[TransactionItem] = []

    currencies: set[str] = set()
    for ccys in balances.values():
        currencies.update(ccys.keys())

    for currency in currencies:
        creditors: list[list] = [
            [uid, amt]
            for uid, ccys in balances.items()
            if (amt := ccys.get(currency, 0)) > 0
        ]
        debtors: list[list] = [
            [uid, -amt]
            for uid, ccys in balances.items()
            if (amt := ccys.get(currency, 0)) < 0
        ]

        for debtor_entry in debtors:
            debtor, debt = debtor_entry
            for creditor_entry in creditors:
                creditor, credit = creditor_entry
                if debt <= 0 or credit <= 0:
                    continue
                amount = min(debt, credit)
                transactions.append(
                    TransactionItem(
                        from_user=debtor,
                        to_user=creditor,
                        amount=amount,
                        currency=currency,
                    )
                )
                debt -= amount
                creditor_entry[1] -= amount
                debtor_entry[1] = debt

    return transactions
