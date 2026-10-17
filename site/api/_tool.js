// Estimate Drafter: the "prepare quotes / takeoffs / scope the job" step from 16 Twin Cities
// job postings (hiring-signals, 2026-10-17). DATA_MODEL.md is the spec.
// Claude reads the request against the shop's own price list and returns which items and
// the arithmetic for each quantity, taken from numbers in the request. Code evaluates the
// arithmetic and does every price, total and tax. The model never writes a dollar figure.
const product = "estimate-drafter";
const FREE = 1, PAID = 10;

const system = `You are the estimator at a small trade business. You get the business's PRICE LIST and one or more customer REQUESTS.
For each request:
- customer and site as written ("" if not given).
- lines: every price-list item the job needs. "item" MUST be copied exactly from the price list. If the job needs something that is not on the list, use item "UNPRICED: <short description>".
  qty_expr is the arithmetic for the quantity using ONLY numbers stated in the request (e.g. "12*14" for a 12 by 14 ft deck in sq ft, "2*(30+18)" for perimeter, "3" for three trees). If the request gives no number for a quantity you need, put your best plain count only when the request makes it obvious (e.g. "the stump" = "1"); otherwise put "0" and add a gap.
  basis quotes the words in the request that justify the line.
- gaps: what the price depends on that the request does not say, each as the question to ask the customer.
- assumptions and exclusions: short, plain, the ones a careful estimator would write on this job.
- letter: a short customer-facing proposal in plain words, written as the business. Do NOT write any dollar figures or quantities' prices. Put the token {{LINES}} where the priced lines go and {{TOTAL}} where the total goes. Mention open questions from gaps. No sign-off name.
Never invent a price, a rate or a total.`;

const S = { type: "string" };
const SA = { type: "array", items: S };
const schema = {
  type: "object", additionalProperties: false, required: ["estimates"],
  properties: { estimates: { type: "array", items: { type: "object", additionalProperties: false,
    required: ["n", "customer", "site", "lines", "gaps", "assumptions", "exclusions", "letter"],
    properties: { n: { type: "integer" }, customer: S, site: S,
      lines: { type: "array", items: { type: "object", additionalProperties: false, required: ["item", "qty_expr", "basis"], properties: { item: S, qty_expr: S, basis: S } } },
      gaps: SA, assumptions: SA, exclusions: SA, letter: S } } } },
};

// "Item | unit | 4.50" or "Item, unit, $4.50" or "Item ... $4.50/sq ft"
function parsePrices(block) {
  const items = [];
  for (const line of block.split("\n")) {
    const l = line.trim();
    if (!l || /^(item|description)\b/i.test(l)) continue;
    const m = l.match(/^(.*?)[\s|,;:.\-–]*\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:\/|per\s+|[|,]\s*)?\s*([a-z .]+)?$/i);
    const parts = l.split(/\s*[|\t]\s*/);
    if (parts.length >= 3 && /[0-9]/.test(parts[2])) {
      items.push({ item: parts[0], unit: parts[1], price: parseFloat(parts[2].replace(/[$,]/g, "")) });
    } else if (m) items.push({ item: m[1].replace(/[\s|,;:.\-–$]+$/, ""), unit: (m[3] || "each").trim(), price: parseFloat(m[2].replace(/,/g, "")) });
  }
  return items.filter((x) => x.item && isFinite(x.price));
}

function evalQty(expr) {
  const e = String(expr || "").replace(/\s+/g, "").replace(/[x×]/gi, "*");
  if (!/^[0-9.+\-*/()]+$/.test(e) || e.length > 60) return null;
  try { const v = Function(`"use strict";return (${e})`)(); return isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null; } catch { return null; }
}

const money = (v) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function prepare(input, unlocked) {
  const pm = input.match(/PRICE LIST:([\s\S]*?)(?:\n-{3,}\s*\n|$)/i);
  if (!pm) return { error: "Start with a line PRICE LIST: and your prices (item | unit | price), then --- and the request." };
  const prices = parsePrices(pm[1]);
  if (!prices.length) return { error: "Couldn't read any prices. One per line: item | unit | price." };
  const tm = input.match(/^\s*TAX:\s*([0-9.]+)\s*%/im);
  const rest = input.slice(input.indexOf(pm[0]) + pm[0].length).replace(/^\s*TAX:.*$/im, "");
  const reqs = rest.split(/\n-{3,}\s*\n/).map((s) => s.trim()).filter((s) => s.length > 15);
  if (!reqs.length) return { error: "Add a customer request after the price list, separated by a line of ---." };
  const use = reqs.slice(0, unlocked ? PAID : FREE);
  const content = `PRICE LIST (item | unit):\n${prices.map((p) => `${p.item} | ${p.unit}`).join("\n")}\n\n` +
    use.map((r, i) => `=== REQUEST ${i + 1}\n${r}`).join("\n\n");
  return { content, prices, tax: tm ? parseFloat(tm[1]) : 0, shown: use.length, total: Math.min(reqs.length, PAID) };
}

function post(out, unlocked, prep) {
  const by = new Map(prep.prices.map((p) => [norm(p.item), p]));
  for (const e of out.estimates) {
    let sub = 0;
    e.lines = e.lines.map((l) => {
      const p = by.get(norm(l.item));
      const qty = evalQty(l.qty_expr);
      const total = p && qty != null ? Math.round(qty * p.price * 100) / 100 : null;
      if (total != null) sub += total;
      return { item: l.item, basis: l.basis, qty_expr: l.qty_expr, qty, unit: p ? p.unit : "", unit_price: p ? p.price : null, total,
        flag: !p ? "Not on your price list: add a price" : qty == null || qty === 0 ? "Quantity needs an answer from the customer" : "" };
    });
    e.subtotal = Math.round(sub * 100) / 100;
    e.tax_rate = prep.tax;
    e.tax = Math.round(sub * prep.tax) / 100;
    e.total = Math.round((e.subtotal + e.tax) * 100) / 100;
    const linesTxt = e.lines.filter((l) => l.total != null && l.total > 0).map((l) => `  ${l.item}: ${l.qty} ${l.unit} at ${money(l.unit_price)} = ${money(l.total)}`).join("\n");
    e.letter = e.letter.replace("{{LINES}}", "\n" + linesTxt + "\n").replace(/\{\{TOTAL\}\}/g, money(e.total) + (prep.tax ? ` (including ${prep.tax}% tax)` : ""));
    if (!unlocked) e.letter = null;
  }
  return out;
}

module.exports = {
  product, site: "https://estimate-drafter-mn.vercel.app", name: "Estimate Drafter", price_usd: 5,
  checkout_line: "Up to 10 requests a run, every run, each with the customer-ready proposal and the spreadsheet.",
  max_chars: 60000, effort: "medium", system, schema, prepare, post,
};
