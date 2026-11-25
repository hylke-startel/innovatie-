// Leest een trainingspagina van startel.nl uit (zonder DOM, werkt in Node en in de browser).
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", eacute: "é", euml: "ë", iuml: "ï", ouml: "ö", uuml: "ü", egrave: "è", agrave: "à" };
function decode(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
}
function cut(s, n) {
  s = (s || "").trim(); if (s.length <= n) return s;
  const c = s.slice(0, n); const p = Math.max(c.lastIndexOf(". "), c.lastIndexOf("! "), c.lastIndexOf("? "));
  return p > n * 0.5 ? c.slice(0, p + 1) : c.replace(/\s+\S*$/, "") + "…";
}
const FMT = { "Klassikale / virtuele training": "k", "Klassikale training": "k", "Virtuele training": "k", "Zelfstudie": "z", "E-learning": "z", "Examen": "x" };
const LVL = { Beginner: "B", Intermediate: "I", Advanced: "A", Expert: "A" };

function parseTraining(html) {
  const meta = decode((html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) || [])[1] || "");
  let body = html.replace(/<(script|style|noscript|header|nav|footer|form|svg)\b[\s\S]*?<\/\1>/gi, " ");
  // Blokken scheiden zodat woorden uit aparte elementen niet aan elkaar plakken
  body = body.replace(/<\/(p|li|h[1-6]|div|span|a|strong|br)>|<br\s*\/?>/gi, " $& ");
  const t = decode(body.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  const s = Math.max(0, t.indexOf("Home »"));
  const seg = t.slice(s, s + 6000);
  const fmtRaw = (seg.match(/(Klassikale \/ virtuele training|Klassikale training|Virtuele training|Zelfstudie|E-learning|Examen)/) || [])[1] || "";
  const lvlRaw = (seg.match(/\b(Beginner|Intermediate|Advanced|Expert)\b/) || [])[1] || "";
  const fmt = FMT[fmtRaw] || "";
  const days = fmt === "k" ? ((seg.match(/\b(\d+)\s*dag(en)?\b/) || [])[1] || "") : "";
  const price = ((seg.match(/€\s?([\d.]+(?:,\d{2})?)/) || [])[1] || "").replace(/\./g, "");
  const lang = (seg.match(/\b(Nederlands|Engels|English|Fries)\b/) || [])[1] || "";
  let intro = "";
  const li = lang ? seg.indexOf(lang) : -1;
  if (li > 0) intro = seg.slice(li + lang.length).split(/ \d[.,]\d (?:Klassikaal|Zelfstudie|Virtueel|E-learning|Examen)| € /)[0].trim();
  intro = intro.replace(/^\).*?\b(Nederlands|Engels|English)\s+/, "");
  const ins = t.match(/verkrijg je inzicht in:(.*?)(Wij helpen je|Heb je een vraag|Neem dan contact)/);
  return {
    meta, fmt, lvl: LVL[lvlRaw] || "", days, price: price ? Number(price.replace(",", ".")) : null, lang,
    intro: cut(intro || meta, 420), insight: cut(ins ? ins[1] : "", 260)
  };
}

if (typeof module !== "undefined") module.exports = { parseTraining };
