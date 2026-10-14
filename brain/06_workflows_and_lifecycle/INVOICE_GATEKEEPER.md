# Export Document Gatekeeper (F13)

Status: Specified, not implemented. Result persistence uses planned `invoice_checks` (see DATA_DICTIONARY §5).

## Purpose
Catch paperwork that would contradict the compliance picture *before* the shipment leaves — the mismatch between
the invoice and the Green List/registration entry is a common cause of detention.

## Inputs
Order id plus commercial-invoice fields: `manufacturer_name`, `manufacturer_address`, `fei_number`, `product_code`,
`quantity`, `declared_value_usd`, `ship_date`, `consignee`.

## Checks

| # | Check | Severity | Source |
|---|---|---|---|
| G1 | Latest evaluation exists and is not stale | BLOCK | orders / findings |
| G2 | No `blocker` in latest findings | **BLOCK** | assessment_findings |
| G3 | `manufacturer_name` matches `factories.legal_name` (normalised: case, punctuation, "Pvt/Ltd") | BLOCK | factories |
| G4 | `fei_number` equals `factories.fda_establishment_number` | BLOCK | factories |
| G5 | Manufacturer **address** equals the address recorded in ER-REG-001 evidence (Green List is firm *and* address specific) | WARN (BLOCK if no address on file) | evidence notes |
| G6 | `fda_green_list_status = TRUE` | BLOCK | factories |
| G7 | `product_code` equals `orders.product_code` | WARN | orders |
| G8 | `quantity` equals `orders.quantity` | WARN | orders |
| G9 | `declared_value_usd` within ±5 % of `orders.financial_value_usd` | WARN | orders |
| G10 | Evidence for ER-REG-001/002/003 not expiring before `ship_date` | BLOCK | factory_evidence |
| G11 | Latest time feasibility is not NOT_FEASIBLE if shipment date is still in the future | WARN | F8 |

## Result
`PASS` (no findings), `WARN` (only warnings), `BLOCK` (≥1 block). Output lists each failed check with fix guidance.
BLOCK is advisory: the system does not generate customs filings; it tells the user not to ship until resolved.

## Notes
- Normalisation must be documented and covered by tests.
- No automatic Green List lookup in V2; G6 trusts the user-maintained flag backed by ER-REG-001 evidence with retrieval date.
