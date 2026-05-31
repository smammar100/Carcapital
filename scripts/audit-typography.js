/**
 * Typography UAT auditor — paste into the browser DevTools console on any route.
 * -----------------------------------------------------------------------------
 * Walks every text-bearing element in a root (default: <body>), reads its
 * *computed* font-size / font-weight (so it catches whatever actually renders,
 * regardless of which class produced it), and flags anything off the canonical
 * Car Capital type system:
 *
 *   Sizes  (px) : 24 display · 18 title · 14 body · 12 label · 10 micro
 *   Weights     : 400 normal · 500 medium · 600 semibold
 *   Exemption   : monospace may also be 600/700 (reg-plates, stock IDs, mono price)
 *
 * Usage in the console:
 *   auditTypography()                 // audit the whole page, console.table the offenders
 *   auditTypography(document.querySelector('[role=dialog]'))  // audit one modal/sheet
 *   copy(JSON.stringify(auditTypography()))                   // grab the result object
 *
 * A clean page returns `{ ..., offenders: [] }` and logs "✓ 0 offenders".
 */
(function defineTypographyAuditor() {
  const OK_PX = new Set([10, 12, 14, 18, 24]);
  const OK_WEIGHT = new Set([400, 500, 600]);
  const SKIP_TAGS = new Set([
    "script", "style", "svg", "path", "noscript", "br",
    "img", "input", "textarea", "select",
  ]);

  window.auditTypography = function auditTypography(root = document.body) {
    const sizeHistogram = {};
    const offenders = [];

    for (const el of root.querySelectorAll("*")) {
      if (SKIP_TAGS.has(el.tagName.toLowerCase())) continue;
      if (el.closest("svg")) continue;

      // Only score elements that own a direct (non-inherited) text node, so
      // each glyph run is attributed once to the element that renders it.
      let ownText = "";
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) ownText += node.textContent;
      }
      ownText = ownText.trim();
      if (!ownText) continue;
      if (!el.getClientRects().length) continue; // skip hidden / zero-box

      const cs = getComputedStyle(el);
      const px = Math.round(parseFloat(cs.fontSize));
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const isMono = /mono/i.test(cs.fontFamily);

      sizeHistogram[px] = (sizeHistogram[px] || 0) + 1;

      const sizeOk = OK_PX.has(px);
      const weightOk = OK_WEIGHT.has(weight) || (isMono && (weight === 600 || weight === 700));

      if (!sizeOk || !weightOk) {
        offenders.push({
          px,
          weight,
          mono: isMono,
          reason: !sizeOk ? "off-scale size" : "off-scale weight",
          text: ownText.slice(0, 40),
          selector: shortSelector(el),
        });
      }
    }

    const histogram = Object.entries(sizeHistogram)
      .sort((a, b) => b[0] - a[0])
      .map(([px, n]) => `${px}px×${n}`)
      .join("  ");

    if (offenders.length === 0) {
      console.log(`%c✓ ${location.pathname} — 0 offenders`, "color:#16a34a;font-weight:600");
      console.log(`   sizes: ${histogram}`);
    } else {
      console.log(`%c✗ ${location.pathname} — ${offenders.length} offender(s)`, "color:#dc2626;font-weight:600");
      console.log(`   sizes: ${histogram}`);
      console.table(offenders);
    }

    return { path: location.pathname, histogram, offenders };
  };

  function shortSelector(el) {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className
      ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
      : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  }

  console.log(
    "%cauditTypography() ready.%c  Run it on any route; pass an element to audit a modal.",
    "color:#2563eb;font-weight:600", "color:inherit",
  );
})();
