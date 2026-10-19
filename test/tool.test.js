// The model never writes a dollar figure: code prices every line, sums, taxes. Pin that arithmetic.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const T = require("../site/api/_tool.js");
const tool = require("../tool.json");

const INPUT = "PRICE LIST:\nStump grinding | each | 185\nMulch | cubic yard | $48.00\nDeck boards | sq ft | 3.25\nTAX: 8.375%\n---\nOne request that is long enough\n---\nA second request, also long enough";

test("prepare reads the price list, tax, and caps free runs at one request", () => {
  const p = T.prepare(INPUT, false);
  assert.deepEqual(p.prices.map((x) => [x.item, x.unit, x.price]), [["Stump grinding", "each", 185], ["Mulch", "cubic yard", 48], ["Deck boards", "sq ft", 3.25]]);
  assert.equal(p.tax, 8.375);
  assert.equal(p.shown, 1);
  assert.equal(p.total, 2);
  assert.equal(T.prepare(INPUT, true).shown, 2);
});

test("post prices from the list, sums the lines, and the total is subtotal plus tax", () => {
  const p = T.prepare(INPUT, true);
  const out = T.post({ estimates: [{ n: 1, customer: "c", site: "", gaps: [], assumptions: [], exclusions: [], letter: "{{LINES}} total {{TOTAL}}",
    lines: [{ item: "Stump grinding", qty_expr: "2", basis: "" }, { item: "deck boards", qty_expr: "12x14", basis: "" },
            { item: "UNPRICED: spreading", qty_expr: "6", basis: "" }, { item: "Mulch", qty_expr: "", basis: "" }] }] }, true, p);
  const e = out.estimates[0];
  assert.deepEqual(e.lines.map((l) => l.total), [370, 546, null, null]);
  assert.equal(e.subtotal, 916);
  assert.equal(e.tax, 76.72);           // 916 * 8.375% = 76.715 -> 76.72
  assert.equal(e.total, 992.72);
  assert.match(e.lines[2].flag, /Not on your price list/);
  assert.match(e.lines[3].flag, /Quantity needs an answer/);
  assert.match(e.letter, /\$992\.72 \(including 8\.375% tax\)/);
  assert.doesNotMatch(e.letter, /\{\{/);
});

test("a free run never returns the proposal", () => {
  const p = T.prepare(INPUT, false);
  const out = T.post({ estimates: [{ n: 1, customer: "", site: "", lines: [], gaps: [], assumptions: [], exclusions: [], letter: "x {{TOTAL}}" }] }, false, p);
  assert.equal(out.estimates[0].letter, null);
});

test("the worked example on the page adds up", () => {
  for (const e of tool.example_output.estimates) {
    const sum = Math.round(e.lines.reduce((a, l) => a + (l.total || 0), 0) * 100) / 100;
    assert.equal(e.subtotal, sum, e.customer);
    for (const l of e.lines) if (l.total != null) assert.ok(Math.abs(l.qty * l.unit_price - l.total) < 0.006, l.item);
    assert.equal(e.tax, Math.round(e.subtotal * e.tax_rate) / 100);
    assert.equal(e.total, Math.round((e.subtotal + e.tax) * 100) / 100);
  }
});
