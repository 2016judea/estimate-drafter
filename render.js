function renderOutput(out, el, unlocked) {
  const m = v => v == null ? "" : "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const h = [];
  for (const e of out.estimates || []) {
    h.push(`<article class="est"><div class="who"><b>${esc(e.customer || "Customer")}</b> <span class="hint">${esc(e.site)}</span></div>
    <table class="lines"><thead><tr><th>Line</th><th class="r nq">Qty</th><th class="r nq">Price</th><th class="r">Total</th></tr></thead><tbody>
    ${e.lines.map(l => `<tr><td>${esc(l.item)}<div class="basis">&ldquo;${esc(l.basis)}&rdquo;</div><div class="qp">${l.qty ?? "?"} ${esc(l.unit)}${l.unit_price != null ? ` × ${m(l.unit_price)}` : ""}</div>${l.flag ? `<div class="flag">${esc(l.flag)}</div>` : ""}</td>
      <td class="r nq">${l.qty ?? "?"} <span class="hint">${esc(l.unit)}</span></td><td class="r nq">${m(l.unit_price)}</td><td class="r">${m(l.total)}</td></tr>`).join("")}
    </tbody><tfoot><tr><td class="cs">Subtotal</td><td class="nq"></td><td class="nq"></td><td class="r">${m(e.subtotal)}</td></tr>
    ${e.tax_rate ? `<tr><td class="cs">Tax ${e.tax_rate}%</td><td class="nq"></td><td class="nq"></td><td class="r">${m(e.tax)}</td></tr>` : ""}
    <tr class="tot"><td class="cs">Total</td><td class="nq"></td><td class="nq"></td><td class="r">${m(e.total)}</td></tr></tfoot></table>
    ${e.gaps.length ? `<div class="gaps"><b>Ask the customer</b><ul>${e.gaps.map(g => `<li>${esc(g)}</li>`).join("")}</ul></div>` : ""}
    <details><summary>Assumptions and exclusions</summary><ul>${[...e.assumptions, ...e.exclusions.map(x => "Not included: " + x)].map(a => `<li>${esc(a)}</li>`).join("")}</ul></details>
    ${e.letter ? `<details ${out.example ? "" : "open"}><summary>The proposal, ready to send</summary><pre class="draft">${esc(e.letter)}</pre><button class="ghost copy" data-t="${esc(e.letter)}">Copy proposal</button></details>`
      : `<div class="lock">The customer-ready proposal with these numbers written in: <a href="#pay" onclick="track('paywall_click',{why:'letter'})">$5 unlocks it</a>.</div>`}
    </article>`);
  }
  if ((out.estimates || []).some(e => e.letter)) h.push(`<div class="row"><button class="ghost" id="csv">Download the lines</button></div>`);
  el.innerHTML = h.join("");
  el.querySelectorAll(".copy").forEach(b => b.onclick = () => { navigator.clipboard.writeText(b.dataset.t); b.textContent = "Copied"; track("copy_letter"); });
  const c = el.querySelector("#csv");
  if (c) c.onclick = () => {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["customer", "item", "qty", "unit", "unit_price", "total", "basis", "flag"].join(",")];
    for (const e of out.estimates) for (const l of e.lines) rows.push([e.customer, l.item, l.qty, l.unit, l.unit_price, l.total, l.basis, l.flag].map(q).join(","));
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" })); a.download = "estimate.csv"; a.click(); track("download");
  };
}
