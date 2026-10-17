# Data model (written first, 2026-10-17)

The need, in the words of Twin Cities job postings (Sept–Oct 2026): *"Prepare quotes,
proposals, and sales presentations"*, *"assist with material takeoffs"*, *"Assessing
project scopes and making recommendations"*, *"Customer change orders"*, *"Look up parts
in catalog, create quotes or invoices as needed"*. 16 distinct employers posted a version
of this step. The ideal tool turns a customer's request plus the shop's own price list
into an estimate ready to send.

## Entities

**Request** — what the customer asked for, as they wrote it (email, voicemail notes, walk-through notes).

| field | answers |
|---|---|
| customer | who asked |
| site | where |
| scope_text | what they asked for, verbatim |

**PriceItem** — the shop's own price list, brought by the customer (CSV or pasted lines).

| field | answers |
|---|---|
| item | what is sold |
| unit | per what (sq ft, lin ft, each, hour) |
| unit_price | what the shop charges |

**Line** — one line of the estimate.

| field | answers |
|---|---|
| price_item | which PriceItem (join) — never an item not on the list |
| qty_expr | the arithmetic from numbers in the request, e.g. `12*14` |
| qty | evaluated by code from qty_expr |
| basis | the words in the request that justify this line |
| line_total | qty × unit_price, by code |

**Gap** — something the price depends on that the request does not say (height of a
tree, square footage, which shingle). Each has the question to ask the customer.

**Estimate** — lines, subtotal and total (code), assumptions, exclusions, gaps.

**Proposal** — the customer-facing letter; every number in it is filled by code from the Estimate.

## Reality check, field by field

| field | source | fillable? |
|---|---|---|
| Request.* | pasted by the customer | yes |
| PriceItem.* | the customer's own price list | yes, required: with no list the tool prices nothing, it lists what needs a price |
| Line.price_item / basis / qty_expr | Claude reading the request against the list | yes |
| qty, line_total, subtotal, total | code | yes |
| Gap | Claude | yes |
| Proposal | Claude writes words; code writes numbers | yes |

No field needs data we don't hold. Not covered: pulling the price list from their
estimating software directly; that is the custom-build line.
