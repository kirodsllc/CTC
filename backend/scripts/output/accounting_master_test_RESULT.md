# Accounting Master Test PROOF

- TEST_RUN_ID: `TEST-1768286256147`
- StartedAt: 2026-01-13T06:37:36.147Z
- FinishedAt: 2026-01-13T06:37:36.405Z
- OVERALL_STATUS: **PASS**
- EXIT_CODE: **0**

## Created Documents
- DPO: DPO-2026-021 (cd4cbcf9-0bd9-4b78-9fbf-ba3468828bbe)
- PO: PO-2601-002 (651b1763-3af6-4ed1-b579-2e88df572726)
- Invoice CASH: INV-2026-035 (8baea9b0-4335-4d69-be0b-3491f74e50ca)
- Invoice CREDIT: INV-2026-036 (3fda9797-1596-4ecd-b49f-f6d4c4e692e1)
- Adjustment IN: 827a352e-b54a-4e5d-baee-2191514602a9
- Adjustment OUT: e4ec071f-9588-48db-9e6b-c9d9785d29c8

## Vouchers (posted only; TEST_RUN_ID only)
### JV0107 (journal)
- narration: TEST-1768286256147 | DPO=DPO-2026-021
- totalDebit: 1000
- totalCredit: 1000

| sort | account | debit | credit | description |
|---:|---|---:|---:|---|
| 0 | 101001-Inventory | 1000 | 0 | TEST-1768286256147 | DPO DPO-2026-021 | DR Inventory 1000 |
| 1 | 301001-Supplier Payable (Control) | 0 | 1000 | TEST-1768286256147 | DPO DPO-2026-021 | CR Supplier Payable 1000 |

### PV0033 (payment)
- narration: TEST-1768286256147 | PAY DPO=DPO-2026-021
- totalDebit: 500
- totalCredit: 500

| sort | account | debit | credit | description |
|---:|---|---:|---:|---|
| 0 | 301001-Supplier Payable (Control) | 500 | 0 | TEST-1768286256147 | PAY DPO DPO-2026-021 | DR Supplier Payable 500 |
| 1 | 101002-Abdbdbdbd | 0 | 500 | TEST-1768286256147 | PAY DPO DPO-2026-021 | CR Cash 500 |

### JV0108 (journal)
- narration: TEST-1768286256147 | PO=PO-2601-002
- totalDebit: 2000
- totalCredit: 2000

| sort | account | debit | credit | description |
|---:|---|---:|---:|---|
| 0 | 101001-Inventory | 2000 | 0 | TEST-1768286256147 | PO PO-2601-002 | DR Inventory 2000 |
| 1 | 301001-Supplier Payable (Control) | 0 | 2000 | TEST-1768286256147 | PO PO-2601-002 | CR Supplier Payable 2000 |

### RV0019 (receipt)
- narration: TEST-1768286256147 | INV=INV-2026-035 | CASH
- totalDebit: 7500
- totalCredit: 7500

| sort | account | debit | credit | description |
|---:|---|---:|---:|---|
| 0 | 101002-Abdbdbdbd | 7500 | 0 | TEST-1768286256147 | INV INV-2026-035 | DR Cash 7500 |
| 1 | 401001-Sales Revenue - TEST | 0 | 7500 | TEST-1768286256147 | INV INV-2026-035 | CR Sales Revenue 7500 |

### JV0109 (journal)
- narration: TEST-1768286256147 | INV=INV-2026-035 | COGS
- totalDebit: 5000
- totalCredit: 5000

| sort | account | debit | credit | description |
|---:|---|---:|---:|---|
| 0 | 901001-Cost of Goods Sold | 5000 | 0 | TEST-1768286256147 | INV INV-2026-035 | DR COGS 5000 |
| 1 | 101001-Inventory | 0 | 5000 | TEST-1768286256147 | INV INV-2026-035 | CR Inventory 5000 |

### JV0110 (journal)
- narration: TEST-1768286256147 | INV=INV-2026-036 | CREDIT
- totalDebit: 6000
- totalCredit: 6000

| sort | account | debit | credit | description |
|---:|---|---:|---:|---|
| 0 | 201001-Accounts Receivable | 6000 | 0 | TEST-1768286256147 | INV INV-2026-036 | DR AR 6000 |
| 1 | 401001-Sales Revenue - TEST | 0 | 6000 | TEST-1768286256147 | INV INV-2026-036 | CR Sales Revenue 6000 |

### JV0111 (journal)
- narration: TEST-1768286256147 | INV=INV-2026-036 | COGS
- totalDebit: 4000
- totalCredit: 4000

| sort | account | debit | credit | description |
|---:|---|---:|---:|---|
| 0 | 901001-Cost of Goods Sold | 4000 | 0 | TEST-1768286256147 | INV INV-2026-036 | DR COGS 4000 |
| 1 | 101001-Inventory | 0 | 4000 | TEST-1768286256147 | INV INV-2026-036 | CR Inventory 4000 |

### JV0112 (journal)
- narration: TEST-1768286256147 | ADJ=827a352e-b54a-4e5d-baee-2191514602a9 | IN
- totalDebit: 200
- totalCredit: 200

| sort | account | debit | credit | description |
|---:|---|---:|---:|---|
| 0 | 101001-Inventory | 200 | 0 | TEST-1768286256147 | ADJ IN 827a352e-b54a-4e5d-baee-2191514602a9 | DR Inventory 200 |
| 1 | 502001-Inventory Adjustment Gain/Loss | 0 | 200 | TEST-1768286256147 | ADJ IN 827a352e-b54a-4e5d-baee-2191514602a9 | CR Adj Gain/Loss 200 |

### JV0113 (journal)
- narration: TEST-1768286256147 | ADJ=e4ec071f-9588-48db-9e6b-c9d9785d29c8 | OUT
- totalDebit: 100
- totalCredit: 100

| sort | account | debit | credit | description |
|---:|---|---:|---:|---|
| 0 | 502001-Inventory Adjustment Gain/Loss | 100 | 0 | TEST-1768286256147 | ADJ OUT e4ec071f-9588-48db-9e6b-c9d9785d29c8 | DR Adj Gain/Loss 100 |
| 1 | 101001-Inventory | 0 | 100 | TEST-1768286256147 | ADJ OUT e4ec071f-9588-48db-9e6b-c9d9785d29c8 | CR Inventory 100 |

## Checks
### Trial Balance
- totalDebit=26300 totalCredit=26300 diff=0 pass=YES

### Income Statement
- revenue expected=13500 actual=13500 diff=0
- cogs expected=9000 actual=9000 diff=0
- grossProfit expected=4500 actual=4500 diff=0
- pass=YES

### Balance Sheet
- assets=7100 liabilities=2500 equity=4600 netIncome=4600
- diff=0 pass=YES
