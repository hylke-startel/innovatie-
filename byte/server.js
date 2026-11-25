// Byte: webserver met eigen taalmodel voor Railway.
// - Serveert de chatbot uit /public
// - Haalt actuele trainingsgegevens van startel.nl op (bij start en elke 24 uur)
// - Koppelt getypte zinnen aan trainingen met een klein meertalig taalmodel (geen externe AI, geen tokens)
const http = require("http");
const fs = require("fs");
const path = require("path");
const { baseCatalog, passage } = require("./catalog");
const { parseTraining } = require("./scrape");
const uitbreiding = require("./uitbreiding");
const INTENTS = require("./intents");
const { kader, kop1 } = require("./beheer-kader.js");
const ai = require("./ai");
const beoordelen = require("./beoordelen");
const { pagina: beoordeelPagina } = require("./beoordelen-pagina");

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const CACHE_FILE = path.join(DATA_DIR, "catalog.json");
const MODEL = process.env.BYTE_MODEL || "Xenova/multilingual-e5-small";
const REFRESH_MS = 24 * 60 * 60 * 1000;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "application/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8" };

const EXTRA_FILE = path.join(DATA_DIR, "catalog-extra.json");
let extra = [];   // trainingen die op startel.nl staan maar niet in de handmatige lijst: { name, slug, tags, lvl, days, fmt } of { slug, skip }
let extraStatus = { opSite: null, nieuw: 0, mislukt: 0, laatst: null, fout: null };
function volledig() {
  const base = baseCatalog();
  const mk = (x, n) => ({ i: base.length + n, name: x.name, slug: x.slug, url: "https://startel.nl/trainingen/" + x.slug + "/", tags: x.tags || [], lvl: x.lvl || "I", days: x.days || "", fmt: x.fmt || "k",
    cert: /incl\.|examen|\b[A-Z]{2,3}-\d{3,4}\b|ISTQB|PRINCE2|CompTIA|ITIL|LPIC|CCNA|SAFe|BiSL|TMAP|CISSP|CISSO|CEH|Certified|Lean Six|IREB|BCS|CKA/i.test(x.name), price: null, intro: "", insight: "" });
  return base.concat(extra.filter(x => !x.skip).map(mk));
}
let catalog = baseCatalog();
let catalogUpdated = null;
let vectors = null;       // Float32Array per training
let bias = null;          // hoe "algemeen" een training is; voorkomt dat dezelfde training overal bovenaan staat
const GENERIC = ["ik wil iets nieuws leren", "ik zoek een training", "wat kan ik het beste doen", "ik wil beter worden in mijn werk", "ik heb hulp nodig", "ik wil me ontwikkelen", "welke cursus past bij mij", "ik werk op kantoor", "ik heb een vraag", "mijn collega's en ik willen verder", "ik wil efficiënter werken", "we hebben een probleem op het werk"];
let embedder = null;
let intentVecs = null;    // { set: [{ label, vecs: [...] }] }
let modelState = "laden"; // laden | klaar | fout

const log = (...a) => console.log(new Date().toISOString(), ...a);

/* ---------- Catalogus ---------- */
function merge(base, extra) {
  return base.map(t => {
    const e = extra[t.slug];
    if (!e) return t;
    return { ...t,
      lvl: e.lvl || t.lvl, days: e.days || t.days, fmt: e.fmt === "x" ? t.fmt : (e.fmt || t.fmt),
      price: e.price ?? t.price, intro: e.intro || t.intro, insight: e.insight || t.insight };
  });
}

function loadCache() {
  try {
    try { extra = JSON.parse(fs.readFileSync(EXTRA_FILE, "utf8")).items || []; } catch { extra = []; }
    const c = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    catalog = merge(volledig(), c.items || {});
    catalogUpdated = c.updated || null;
    log(`Catalogus uit cache geladen (${Object.keys(c.items || {}).length} trainingen, ${catalogUpdated})`);
  } catch { log("Nog geen cache, start met de basiscatalogus"); }
}

async function fetchText(url) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "ByteTrainingsadviseur/1.0 (+https://startel.nl)" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally { clearTimeout(timer); }
}

async function refreshCatalog() {
  // eerst: staat er op startel.nl iets wat Byte nog niet kent? Dan komt het er automatisch bij
  try {
    const r = await uitbreiding.ontdek({ bekend: baseCatalog().map(t => t.slug), extra, fetchText, log });
    extra = r.items; extraStatus = { opSite: r.opSite, nieuw: r.nieuw, mislukt: r.mislukt, laatst: new Date().toISOString(), fout: null };
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(EXTRA_FILE, JSON.stringify({ updated: extraStatus.laatst, items: extra })); } catch (e) { log("Uitbreiding schrijven mislukt:", e.message); }
  } catch (e) { extraStatus.fout = new Date().toISOString() + " " + e.message; log("Uitbreiding mislukt:", e.message); }
  const base = volledig(); const items = {}; let ok = 0, k = 0;
  const worker = async () => {
    while (k < base.length) {
      const t = base[k++];
      try { const p = parseTraining(await fetchText(t.url)); if (p.intro || p.price) { items[t.slug] = p; ok++; } }
      catch (e) { log(`Kon ${t.slug} niet ophalen: ${e.message}`); }
      await new Promise(r => setTimeout(r, 150)); // vriendelijk voor startel.nl
    }
  };
  await Promise.all([1, 2, 3].map(worker));
  if (ok < base.length * 0.5) { log(`Verversen afgebroken: maar ${ok} van ${base.length} pagina's gelukt`); return false; }
  catalog = merge(base, items);
  catalogUpdated = new Date().toISOString();
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(CACHE_FILE, JSON.stringify({ updated: catalogUpdated, items })); }
  catch (e) { log("Cache schrijven mislukt:", e.message); }
  log(`Catalogus ververst: ${ok} van ${base.length} trainingen`);
  return true;
}

/* ---------- Taalmodel ---------- */
async function embed(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 16) {
    const t = await embedder(texts.slice(i, i + 16), { pooling: "mean", normalize: true });
    const [n, d] = t.dims;
    for (let j = 0; j < n; j++) out.push(t.data.slice(j * d, (j + 1) * d));
  }
  return out;
}

async function loadModel() {
  try {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.cacheDir = process.env.MODEL_CACHE || path.join(DATA_DIR, "models");
    log(`Taalmodel laden: ${MODEL}`);
    embedder = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
    modelState = "klaar";
    log("Taalmodel geladen");
  } catch (e) {
    modelState = "fout"; log("Taalmodel laden mislukt, nieuwe poging over 10 minuten:", e.message);
    setTimeout(async () => { await loadModel(); await indexCatalog(); }, 10 * 60 * 1000);
  }
}

async function indexIntents() {
  if (!embedder || intentVecs) return;
  const out = {};
  for (const [set, opts] of Object.entries(INTENTS)) {
    out[set] = [];
    for (const [label, examples] of Object.entries(opts)) out[set].push({ label, vecs: await embed(examples.map(e => "query: " + e)) });
  }
  intentVecs = out;
  log("Antwoordvoorbeelden geïndexeerd");
}

async function classify(text, set) {
  const [q] = await embed(["query: " + text]);
  return intentVecs[set].map(o => ({ label: o.label, s: Math.round(Math.max(...o.vecs.map(v => dot(q, v))) * 1000) / 1000 }))
    .sort((a, b) => b.s - a.s);
}

async function indexCatalog() {
  if (!embedder) return;
  const t0 = Date.now();
  await indexIntents();
  const v = await embed(catalog.map(passage));
  const g = await embed(GENERIC.map(q => "query: " + q));
  bias = v.map(p => g.reduce((s, q) => s + dot(p, q), 0) / g.length);
  vectors = v;
  log(`${vectors.length} trainingen geïndexeerd in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

async function match(text) {
  const [q] = await embed(["query: " + text]);
  const scores = vectors.map((v, i) => dot(q, v) - 0.5 * bias[i]);
  const order = scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]);
  return order.slice(0, 30).map(([s, i]) => ({ i, s: Math.round(s * 1000) / 1000 }));
}

/* ---------- HTTP ---------- */
function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, limit = 4000) {
  return new Promise((resolve, reject) => {
    let b = ""; req.on("data", c => { b += c; if (b.length > limit) { reject(new Error("te groot")); req.destroy(); } });
    req.on("end", () => resolve(b)); req.on("error", reject);
  });
}

const hits = new Map(); // eenvoudige rate limit per IP
function limited(ip) {
  const now = Date.now(), w = hits.get(ip) || [];
  const recent = w.filter(t => now - t < 60000); recent.push(now); hits.set(ip, recent);
  return recent.length > 150;
}


/* ---- terugbelverzoeken en geleverde adviezen (voor het beheerdashboard; later HubSpot) ---- */
const VERZOEKEN = path.join(DATA_DIR, "terugbel.jsonl"), CONTACT = path.join(DATA_DIR, "contact.jsonl"), ADVIEZEN = path.join(DATA_DIR, "adviezen.jsonl"), GESPREKKEN = path.join(DATA_DIR, "gesprekken.jsonl"), FEEDBACK = path.join(DATA_DIR, "feedback.jsonl"), SIMULATIES = path.join(DATA_DIR, "simulaties.jsonl"), SIMFB = path.join(DATA_DIR, "simfeedback.jsonl"), TOETSEN = path.join(DATA_DIR, "toetsen.jsonl"), TOETSFB = path.join(DATA_DIR, "toetsfeedback.jsonl");
const tekstVeld = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
function bewaar(file, obj) { try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.appendFileSync(file, JSON.stringify(obj) + "\n"); return true; } catch (e) { log("Opslaan mislukt:", e.message); return false; } }
function lees(file, max) { try { return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).slice(-max).map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean); } catch { return []; } }
const clientIp = req => (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
const perUur = new Map();
function teVaak(ip, soort, max) { const k = soort + ip, nu = Date.now(), l = (perUur.get(k) || []).filter(t => nu - t < 3600e3); l.push(nu); perUur.set(k, l); return l.length > max; }
const esc = x => String(x == null ? "" : x).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function adminToegang(req, res) {
  const sleutel = process.env.BYTE_ADMIN_KEY;
  if (!sleutel) { send(res, 404, "Niet gevonden", "text/plain; charset=utf-8"); return false; }
  const h = String(req.headers.authorization || ""); let ok = false;
  if (h.startsWith("Basic ")) { const pw = Buffer.from(h.slice(6), "base64").toString().split(":").slice(1).join(":"); const a = Buffer.from(pw), b = Buffer.from(sleutel); ok = a.length === b.length && require("crypto").timingSafeEqual(a, b); }
  if (!ok) { res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Byte beheer"', "content-type": "text/plain; charset=utf-8" }); res.end("Inloggen is nodig"); return false; }
  return true;
}

// ---- simulatietoets: ~110 openingsberichten door poort + begrijp + ranking, vergeleken met het bedoelde advies ----
let simulatie = null;
const escH = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
async function simKandidaten(tekst) {
  const kand = (await match(tekst.slice(-700))).slice(0, 8).map(x => ({ i: x.i, t: catalog[x.i] }));
  for (const [re, zinnen] of ROL_RICHTINGEN) if (re.test(tekst)) { for (const z of zinnen) for (const x of (await match(z)).slice(0, 2)) if (!kand.some(k => k.i === x.i) && kand.length < 14) kand.push({ i: x.i, t: catalog[x.i] }); break; }
  return kand;
}
async function simGeval([tekst, soort, bedoeld]) {
  const r = { tekst, soort, bedoeld, top: [], wat: "", ok: false, deels: false, handmatig: soort === "i" };
  try {
    const kand = await simKandidaten(tekst);
    const uit = await ai.begrijp({ tekst }, kand);
    if (uit.soort !== "leerwens") { r.wat = "geweigerd: " + uit.soort; r.ok = false; return r; }
    if (uit.navraag) { r.wat = "navraag: " + uit.navraag; r.ok = soort === "n"; return r; }
    const res = await match(tekst), top = res[0] ? res[0].s : 0, low = res.length ? res[res.length - 1].s : 0, span = Math.max(top - low, 1e-6);
    const sem = new Map(res.map(x => [x.i, (x.s - low) / span]));
    const lijst = require("./toets/advies.js").rangschik(catalog, { tekst, uit, sem }).slice(0, 3);
    r.top = lijst.map(x => x.t.name); r.wat = uit.past === "nee" ? "geen aanbod gemeld" : "advies" + (uit.voorstel != null ? " (direct voorstel: " + catalog[uit.voorstel].name + ")" : "") + (uit.vervolgvraag ? ", vraagt door: " + uit.vervolgvraag : "");
    if (soort === "i") return r;
    if (soort === "g") { r.ok = uit.past === "nee"; return r; }
    if (soort === "n") { r.ok = false; r.deels = true; r.wat += " (had moeten navragen)"; return r; }
    const hit = b => r.top.some(n => n.toLowerCase().includes(b.toLowerCase()));
    r.ok = bedoeld.some(b => r.top[0].toLowerCase().includes(b.toLowerCase()));
    r.deels = !r.ok && bedoeld.some(hit);
  } catch (e) { r.wat = "fout: " + String(e.message).slice(0, 100); }
  return r;
}
const BETER = [["incompany", "Incompany aanraden"], ["navragen", "Eerst navragen"], ["adviseur", "Doorverwijzen naar adviseur"], ["niveau", "Ander niveau kiezen"], ["onderwerp", "Ander onderwerp begrijpen"], ["aantal", "Meer of minder trainingen tonen"], ["toon", "Andere toon of tekst"]];
const BETERMAP = Object.fromEntries(BETER);
const beterTags = f => f.getAll("beter").filter(x => BETERMAP[x]);
function startSimulatie() {
  const fbMap = new Map(); lees(SIMFB, 2000).forEach(x => fbMap.set(x.tekst, x));
  const gevallen = [...require("./toets/simulatie.js")].map(([t, soort, bedoeld]) => { const o = fbMap.get(t); if (!o) return [t, soort, bedoeld]; return o.oordeel === "navragen" ? [t, "n", []] : o.oordeel === "geen" ? [t, "g", []] : (o.oordeel === "incompany" || !o.bedoeld.length) ? [t, "i", []] : [t, "a", o.bedoeld.map(n => n.replace(/\s*\(.*$/, ""))]; });
  const gl = new Map(); lees(GESPREKKEN, 4000).forEach(x => gl.set(x.gid, x));
  lees(FEEDBACK, 4000).filter(x => x.bedoeld && x.bedoeld.length && ["fout", "deels"].includes(x.oordeel)).forEach(x => { const g = gl.get(x.gid), eerste = g && (g.gesprek.find(m => m.r === "v") || {}).t; if (eerste) gevallen.push([eerste, "a", x.bedoeld.map(n => n.replace(/\s*\(.*$/, ""))]); });
  simulatie = { klaar: false, start: Date.now(), totaal: gevallen.length, rijen: [] };
  const sim = simulatie;
  (async () => { for (let i = 0; i < gevallen.length; i += 4) await Promise.all(gevallen.slice(i, i + 4).map(async g => sim.rijen.push(await simGeval(g)))); sim.klaar = true; bewaar(SIMULATIES, { t: new Date(sim.start).toISOString(), klaar: new Date().toISOString(), totaal: sim.totaal, rijen: sim.rijen }); })();
}
// ---- nieuwe simulaties: telkens andere testgesprekken, door sales te beoordelen ----
const LOPEND = path.join(DATA_DIR, "sim-lopend.json"), bg = beoordelen.maak({ ai, simKandidaten, match: (...a) => match(...a), getCatalog: () => catalog, rangschik: (...a) => require("./toets/advies.js").rangschik(...a) });
function bekendeTeksten() {
  const b = new Set([...require("./toets/simulatie.js")].map(x => x[0]));
  lees(SIMULATIES, 200).forEach(h => (h.rijen || []).forEach(r => r.tekst && b.add(r.tekst)));
  lees(GESPREKKEN, 4000).forEach(g => { const e = (g.gesprek || []).find(m => m.r === "v"); if (e) b.add(e.t); });
  lees(SIMFB, 4000).forEach(x => x.tekst && b.add(x.tekst));
  if (simulatie && simulatie.nieuw) simulatie.rijen.forEach(r => b.add(r.tekst));
  return [...b];
}
function afronden(sim, onderbroken) { sim.klaar = true; const o = { t: new Date(sim.start).toISOString(), klaar: new Date().toISOString(), totaal: sim.totaal, rijen: sim.rijen, nieuw: true }; if (onderbroken) o.onderbroken = true; bewaar(SIMULATIES, o); try { fs.unlinkSync(LOPEND); } catch {} }
// een run die door een nieuwe versie midden in het draaien is afgebroken: bewaar wat er al was
try { if (fs.existsSync(LOPEND)) { const o = JSON.parse(fs.readFileSync(LOPEND, "utf8")); if (o && o.rijen && o.rijen.length) { o.nieuw = true; o.onderbroken = true; o.totaal = o.rijen.length; o.klaar = new Date().toISOString(); delete o.fase; bewaar(SIMULATIES, { t: new Date(o.start).toISOString(), klaar: o.klaar, totaal: o.totaal, rijen: o.rijen, nieuw: true, onderbroken: true }); } fs.unlinkSync(LOPEND); } } catch (e) { log("Lopende run herstellen mislukt:", e.message); }
function startNieuweRun(n) {
  const sim = simulatie = { klaar: false, start: Date.now(), totaal: n, rijen: [], nieuw: true, fase: "verzinnen" };
  const sla = () => { try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(LOPEND, JSON.stringify({ start: sim.start, rijen: sim.rijen })); } catch {} };
  (async () => {
    let gevallen = [];
    try { gevallen = await beoordelen.genereer(ai, n, bekendeTeksten()); } catch (e) { log("Testgesprekken verzinnen mislukt:", e.message); }
    sim.totaal = gevallen.length; sim.fase = "spelen";
    for (let i = 0; i < gevallen.length; i += 4) { await Promise.all(gevallen.slice(i, i + 4).map(async g => sim.rijen.push(await bg.speel(g)))); sla(); }
    afronden(sim);
  })().catch(e => { log("Run mislukt:", e.message); afronden(sim, true); });
}
function laatsteNieuweRun(run) {
  const gesch = lees(SIMULATIES, 200).filter(h => h.nieuw).reverse();
  if (run) { const h = gesch.find(x => x.t === run); if (h) return { ...h, start: Date.parse(h.t), klaar: true }; }
  if (simulatie && simulatie.nieuw) return simulatie;
  return gesch[0] ? { ...gesch[0], start: Date.parse(gesch[0].t), klaar: true } : null;
}
function beoordeelJson(run) {
  const act = laatsteNieuweRun(run); if (!act) return { geen: true, klaar: true, perWie: perWie([]) };
  const fbm = new Map(); lees(SIMFB, 4000).forEach(x => fbm.set(x.tekst, x));
  const rijen = act.rijen.map((r, i) => { const f = fbm.get(r.tekst); return { i, tekst: r.tekst, gesprek: r.gesprek || [{ r: "v", t: r.tekst }], top: r.top || [], uitleg: watTekst(r), fb: f ? { wie: f.wie || "", oordeel: f.oordeel, bedoeld: f.bedoeld || [], beter: f.beter || [], toelichting: f.toelichting || "" } : null }; });
  return { geen: false, run: new Date(act.start).toISOString(), klaar: !!act.klaar, totaal: act.klaar ? rijen.length : act.totaal, rijen, perWie: perWie(rijen) };
}
function perWie(rijen) {
  const p = {}; beoordelen.RATERS.forEach(w => p[w] = { n: 0, run: 0, ok: 0 });
  lees(SIMFB, 6000).forEach(x => { if (p[x.wie]) { p[x.wie].n++; if (x.oordeel === "ok") p[x.wie].ok++; } });
  rijen.forEach(r => { if (r.fb && p[r.fb.wie]) p[r.fb.wie].run++; });
  return p;
}
// slot: een nieuwe run kan pas als de vorige nieuwe run helemaal beoordeeld is
function slotOpen() {
  if (simulatie && simulatie.nieuw && !simulatie.klaar) return -1;
  const act = laatsteNieuweRun(""); if (!act) return 0;
  const fbm = new Set(); lees(SIMFB, 6000).forEach(x => fbm.add(x.tekst));
  return act.rijen.filter(r => !fbm.has(r.tekst)).length;
}
function simActief(run) {
  const geschiedenis = lees(SIMULATIES, 60).reverse().filter(h => !h.nieuw);
  const bewaard = run ? geschiedenis.find(h => h.t === run) : null;
  const actief = bewaard ? { klaar: true, start: Date.parse(bewaard.t), totaal: bewaard.totaal, rijen: bewaard.rijen, bewaard: true } : ((simulatie && !simulatie.nieuw ? simulatie : null) || (geschiedenis[0] ? { klaar: true, totaal: geschiedenis[0].totaal, rijen: geschiedenis[0].rijen, start: Date.parse(geschiedenis[0].t), bewaard: true } : null));
  return { geschiedenis, actief };
}
const watTekst = r => {
  const w = String(r.wat || "");
  if (/^navraag: /.test(w)) return `Byte vroeg eerst door: "${w.slice(9)}"`;
  if (/^geweigerd: /.test(w)) return `Byte wees dit bericht af (${w.slice(11)})`;
  if (/^geen aanbod/.test(w)) return "Byte meldde dat Startel hier niets voor heeft";
  if (/^fout: /.test(w)) return "Er ging iets mis bij dit bericht: " + w.slice(6);
  let t = "Byte gaf advies"; const v = w.match(/direct voorstel: ([^)]*)\)/), q = w.match(/vraagt door: (.*?)(?: \(had moeten navragen\))?$/);
  if (v) t += ", en stelde direct een training voor"; if (q) t += `, en vroeg daarna door: "${q[1]}"`; if (/had moeten navragen/.test(w)) t += ", maar had eerst moeten navragen";
  return t;
};
function simRijHtml(r, i, fbm) {
  const o = r.handmatig ? "nog" : r.ok ? "goed" : r.deels ? "deels" : "fout", fo = fbm.get(r.tekst), oT = r.handmatig ? "handmatig" : o;
  const okV = /^navraag/.test(r.wat) ? "navragen" : (r.top.length ? "ok" : /^(geweigerd|geen aanbod)/.test(r.wat) ? "geen" : ""), g = !!fo && (fo.oordeel === "ok" || okV === fo.oordeel);
  const stat = !fo ? "" : g ? `<span class="b goed">goedgekeurd</span>` : `<span class="b fout">afgekeurd</span><br><span class="klein">${fo.oordeel === "navragen" ? "eerst navragen" : fo.oordeel === "geen" ? "geen aanbod, adviseur" : fo.oordeel === "incompany" ? "incompany of maatwerk aanraden" : fo.bedoeld.length ? escH(fo.bedoeld.join(" / ")) : "geen training"}${(fo.beter || []).length ? "<br>" + escH(fo.beter.map(x => BETERMAP[x]).join(", ")) : ""}${fo.toelichting ? "<br>" + escH(fo.toelichting) : ""}</span>`;
  const adv = r.top.length ? r.top.map((n, j) => `<div>${j === 0 ? "<b>" : '<span class="klein">'}${j + 1}. ${escH(n)}${j === 0 ? "</b>" : "</span>"}</div>`).join("") : '<div class="klein">Geen training getoond</div>';
  return `<tr data-i="${i}"><td><span class="b ${o}">${oT}</span></td><td>${escH(r.tekst)}</td><td>${r.soort === "i" ? "Incompany of maatwerk aanraden (nog niet automatisch te toetsen)" : r.soort === "a" ? escH(r.bedoeld.join(" of ")) : r.soort === "n" ? "Eerst navragen wat de bezoeker bedoelt" : "Geen aanbod, doorverwijzen naar een adviseur"}</td><td>${adv}<div class="klein" style="margin-top:4px">${escH(watTekst(r))}</div></td><td><div class="beo" data-tekst="${escH(r.tekst)}" data-top0="${escH(r.top[0] || "")}" data-ok="${okV}"><div class="knoppen"><button type="button" class="vk${g ? " aan" : ""}" title="Goedgekeurd: het advies van Byte is prima" aria-label="Goedgekeurd">&#10003;</button><button type="button" class="kr${fo && !g ? " aan" : ""}" title="Afgekeurd: dit had het moeten zijn" aria-label="Afgekeurd">&#10005;</button></div><div class="st">${stat}</div>
<div class="uit" hidden><div class="klein" style="margin-top:2px">Jouw top 3 (typ een paar letters)</div><input type="text" class="b1 ac" autocomplete="off" placeholder="1e keuze (de beste)"><input type="text" class="b2 ac" autocomplete="off" placeholder="2e keuze (optioneel)"><input type="text" class="b3 ac" autocomplete="off" placeholder="3e keuze (optioneel)"><div class="tags">${BETER.map(([id, t]) => `<label class="tag"><input type="checkbox" name="beter" value="${id}"> ${escH(t)}</label>`).join("")}</div><input type="text" class="toel" placeholder="Wat had Byte beter kunnen doen? (optioneel)"><div class="snel"><button type="button" class="pil" data-o="navragen">Eerst navragen</button><button type="button" class="pil" data-o="geen">Geen aanbod</button><button type="button" class="pil" data-o="incompany">Incompany of maatwerk</button><button type="button" class="pil opsl" data-o="anders">Opslaan</button></div></div></div></td></tr>`;
}
function simulatieJson(van) {
  const { actief } = simActief(""); if (!actief) return { rijen: [], klaar: true, totaal: 0, goed: 0, deels: 0, fout: 0, n: 0 };
  const fbm = new Map(); lees(SIMFB, 2000).forEach(x => fbm.set(x.tekst, x));
  const r = actief.rijen, goed = r.filter(x => x.ok).length, deels = r.filter(x => !x.ok && x.deels).length;
  const hand = r.filter(x => x.handmatig).length; return { klaar: !!actief.klaar, totaal: actief.totaal, n: r.length, goed, deels, fout: r.length - goed - deels - hand, rijen: r.slice(van).map((x, j) => simRijHtml(x, van + j, fbm)) };
}
function simulatiePagina(run) {
  const { geschiedenis, actief } = simActief(run), tijdS = t => new Date(t).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" });
  const tel = rijen => { const g = rijen.filter(r => r.ok).length, d = rijen.filter(r => !r.ok && r.deels).length, h = rijen.filter(r => r.handmatig).length; return [g, d, rijen.length - g - d - h]; };
  const hist = geschiedenis.length ? `<h2>Eerdere runs</h2><div class="kaart sc"><table><thead><tr><th>Gedraaid</th><th>Goed</th><th>Deels</th><th>Fout</th><th></th></tr></thead><tbody>${geschiedenis.map(h => { const [g, d, f] = tel(h.rijen); return `<tr><td>${tijdS(h.t)}</td><td>${g}</td><td>${d}</td><td>${f}</td><td><a href="/admin/simulatie?run=${encodeURIComponent(h.t)}">Bekijk</a></td></tr>`; }).join("")}</tbody></table></div>` : "";
  if (!actief) return kader({ titel: "Simulatie", actief: "/admin/simulatie", inhoud: kop1("Simulatie") + `<p class="intro">Ruim 110 openingsberichten van bezoekers, elk met het advies dat het had moeten zijn. Gesprekken die je in <a href="/admin/gesprekken">Gesprekken</a> als fout of deels beoordeelt, doen automatisch mee. Het draaien kost enkele minuten en gebruikt ongeveer een AI-aanvraag per bericht.</p><a class="knop" href="/admin/simulatie?start=vast">Start de vaste testset</a>` });
  const s = actief, fbm = new Map(); lees(SIMFB, 2000).forEach(x => fbm.set(x.tekst, x));
  const volgorde = s.rijen.map((r, i) => i); if (s.klaar) volgorde.sort((a, b) => (s.rijen[a].ok - s.rijen[b].ok) || (s.rijen[a].deels - s.rijen[b].deels));
  const rijen = volgorde.map(i => simRijHtml(s.rijen[i], i, fbm)).join(""), n = s.rijen.length, goed = s.rijen.filter(r => r.ok).length, deels = s.rijen.filter(r => !r.ok && r.deels).length, hand = s.rijen.filter(r => r.handmatig).length;
  const inhoud = kop1("Simulatie") + `<p class="intro">${s.bewaard ? "Run van " + tijdS(s.start) + ". " : ""}<b>Goed</b>: Byte zet de verwachte training bovenaan. <b>Deels</b>: de verwachte training staat wel in de top 3. <b>Fout</b>: hij ontbreekt of Byte deed iets anders dan verwacht. De ranking is een benadering van wat de bezoeker in de browser ziet.</p>
<div class="tegels"><div class="tegel"><b id="t-goed">${goed}</b><span>goed</span></div><div class="tegel"><b id="t-deels">${deels}</b><span>deels</span></div><div class="tegel"><b id="t-fout">${n - goed - deels - hand}</b><span>fout</span></div>${hand ? `<div class="tegel"><b id="t-hand">${hand}</b><span>handmatig (incompany of maatwerk)</span></div>` : ""}<div class="tegel"><b id="t-n">${n}/${s.totaal}</b><span id="t-s">${s.klaar ? "klaar" : "bezig, je kunt gewoon doorwerken"}</span></div></div>
<div class="kaart sc" style="margin-top:14px"><table><thead><tr><th></th><th>Bericht van de bezoeker</th><th>Dit hoort Byte te doen</th><th>Dit deed Byte (voorgestelde trainingen)</th><th>Jouw oordeel</th></tr></thead><tbody id="rijen">${rijen}</tbody></table></div>
<style>.beo{min-width:170px}.knoppen{display:flex;gap:6px}.knoppen button{width:36px;height:36px;padding:0;border-radius:50%;border:1.5px solid var(--line);background:var(--surface);color:var(--muted);font-size:1.1rem;line-height:1}.knoppen .vk:hover,.knoppen .vk.aan{background:var(--ok-bg,#DFF3E4);color:#1D6B35;border-color:#1D6B35}.knoppen .kr:hover,.knoppen .kr.aan{background:#FDE0DC;color:#9B2A1C;border-color:#9B2A1C}.beo .st{margin-top:6px}.uit{margin-top:8px;display:grid;gap:6px;max-width:230px}.uit[hidden]{display:none}.uit input[type=text]{padding:7px 12px;border-radius:10px;font-size:.9rem}.snel{display:flex;gap:6px;flex-wrap:wrap}.pil{padding:5px 12px;border-radius:48px;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);font-size:.82rem}.pil:hover{border-color:var(--orange);color:var(--orange);background:var(--surface)}.pil.opsl{background:var(--orange);color:#fff;border-color:var(--orange)}.sc{overflow:visible}@media (max-width:900px){.sc{overflow-x:auto}}</style>
<div id="klaarbalk" hidden class="tegel" style="margin-top:14px;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap"><span>De simulatie is klaar. Je beoordelingen blijven staan.</span><a class="knop" href="/admin/simulatie">Sorteer op uitkomst</a></div>
<script>(()=>{const run=${JSON.stringify(run || "")}, BM=${JSON.stringify(BETERMAP)}, tb=document.getElementById("rijen");
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
async function stuur(box,oordeel,b){const d=new URLSearchParams({tekst:box.dataset.tekst,oordeel,top0:box.dataset.top0,run});(b||[]).forEach((x,i)=>d.set("b"+(i+1),x)); const tg=[...box.querySelectorAll("input[name=beter]:checked")].map(x=>x.value), tl=(box.querySelector(".toel")||{value:""}).value.trim(); if(oordeel!=="ok"){tg.forEach(x=>d.append("beter",x)); if(tl)d.set("toelichting",tl);}
 await fetch("/admin/simfeedback",{method:"POST",body:d,redirect:"manual"}); const st=box.querySelector(".st"); box.querySelector(".uit").hidden=true;
 const vk=box.querySelector(".vk"),kr=box.querySelector(".kr"); const goed=oordeel==="ok"||box.dataset.ok===oordeel; vk.classList.toggle("aan",goed); kr.classList.toggle("aan",!goed);
 st.innerHTML=goed?'<span class="b goed">goedgekeurd</span>':'<span class="b fout">afgekeurd</span><br><span class="klein">'+(oordeel==="navragen"?"eerst navragen":oordeel==="geen"?"geen aanbod, adviseur":oordeel==="incompany"?"incompany of maatwerk aanraden":(b&&b.length?esc(b.join(" / ")):"geen training"))+(tg.length&&oordeel!=="ok"?"<br>"+esc(tg.map(x=>BM[x]).join(", ")):"")+(tl&&oordeel!=="ok"?"<br>"+esc(tl):"")+"</span>";}
document.addEventListener("click",e=>{const box=e.target.closest(".beo"); if(!box)return;
 if(e.target.closest(".vk")){const k=box.dataset.ok; if(!k){box.querySelector(".st").innerHTML='<span class="klein">Geen advies om goed te keuren</span>'; return;} return stuur(box,k);}
 if(e.target.closest(".kr")){const u=box.querySelector(".uit"); u.hidden=!u.hidden; if(!u.hidden) u.querySelector(".b1").focus(); return;}
 const o=e.target.closest(".pil"); if(!o)return; const k=o.dataset.o;
 if(k==="anders"){const b=[".b1",".b2",".b3"].map(q=>box.querySelector(q).value.trim()).filter(Boolean); if(!b.length&&!box.querySelector("input[name=beter]:checked")&&!box.querySelector(".toel").value.trim()){box.querySelector(".b1").focus();return;} return stuur(box,"anders",b);}
 stuur(box,k);});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.closest(".uit")&&!e.defaultPrevented){e.preventDefault(); e.target.closest(".uit").querySelector(".opsl").click();}});
${s.klaar ? "" : `let van=tb.rows.length; const tik=async()=>{try{const r=await (await fetch("/admin/simulatie?json=1&van="+van)).json();
 if(r.rijen.length){tb.insertAdjacentHTML("beforeend",r.rijen.join("")); van=r.n;}
 document.getElementById("t-goed").textContent=r.goed; document.getElementById("t-deels").textContent=r.deels; document.getElementById("t-fout").textContent=r.fout; document.getElementById("t-n").textContent=r.n+"/"+r.totaal; document.getElementById("t-s").textContent=r.klaar?"klaar":"bezig, je kunt gewoon doorwerken";
 if(r.klaar){document.getElementById("klaarbalk").hidden=false; return;}}catch(e){} setTimeout(tik,4000);}; setTimeout(tik,4000);`}
})();</script>${s.klaar ? '<p style="margin-top:16px"><a class="knop" href="/admin/simulatie?start=vast">Vaste testset opnieuw draaien</a></p>' : ""}` + hist;
  return kader({ titel: "Simulatie", actief: "/admin/simulatie", inhoud, namen: catalog.map(t => t.name).sort() });
}

// ---- gesprekken en feedback ----
function gesprekkenPagina(rawUrl) {
  const q = new URL(rawUrl, "http://x").searchParams, g = (q.get("g") || "").replace(/[^a-z0-9]/gi, ""), f = q.get("f") || "";
  const tijd = t => new Date(t).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" });
  const alle = lees(GESPREKKEN, 4000), laatste = new Map(); alle.forEach(x => laatste.set(x.gid, x));
  const fb = lees(FEEDBACK, 4000), fbPer = new Map(); fb.forEach(x => { (fbPer.get(x.gid) || fbPer.set(x.gid, []).get(x.gid)).push(x); });
  const oordeelVan = id => { const l = (fbPer.get(id) || []).filter(x => x.oordeel).pop(); return l ? l.oordeel : ""; };
  const pagina = inhoud => kader({ titel: "Gesprekken", actief: "/admin/gesprekken", inhoud, namen: catalog.map(t => t.name).sort() });
  if (g) {
    const x = laatste.get(g); if (!x) return pagina(kop1("Gesprek niet gevonden") + `<p><a href="/admin/gesprekken">Terug naar alle gesprekken</a></p>`);
    const dl = `<datalist id="tr">${catalog.map(t => t.name).sort().map(n => `<option value="${esc(n)}">`).join("")}</datalist>`;
    const eerder = (fbPer.get(g) || []).map(y => `<p class="klein" style="margin:0 0 6px">${tijd(y.t)}: <span class="b ${y.oordeel || "nog"}">${esc(y.oordeel || "opmerking")}</span>${y.bedoeld.length ? " top 3 volgens collega: " + esc(y.bedoeld.map((n, i) => (i + 1) + ". " + n).join("  ")) : ""}${(y.beter || []).length ? " · beter: " + esc(y.beter.map(x => BETERMAP[x]).join(", ")) : ""}${y.toelichting ? ". " + esc(y.toelichting) : ""}</p>`).join("");
    return pagina(`<p class="klein"><a href="/admin/gesprekken">&larr; Alle gesprekken</a></p>` + kop1("Gesprek van " + tijd(x.t)) + `<p class="intro">${esc([x.profiel.thema, x.profiel.niveau, x.profiel.voor, x.profiel.rol].filter(Boolean).join(" · ")) || "Geen profiel ingevuld"}</p>${q.get("opgeslagen") ? '<p><span class="b goed">Feedback opgeslagen</span></p>' : ""}
<div class="kaart pad"><div class="chat">${x.gesprek.map(m => `<div class="msg ${m.r === "v" ? "v" : "bt"}">${esc(m.t)}</div>`).join("")}</div></div>
<h2>Advies van Byte</h2><div class="kaart pad">${x.trainingen.length ? esc(x.trainingen.join(", ")) : "<span class='klein'>Dit gesprek is geëindigd zonder advies.</span>"}</div>
<h2>Feedback</h2><div class="kaart pad">${eerder}<form class="fb" method="post" action="/admin/feedback"><input type="hidden" name="gid" value="${esc(g)}">
<label>Was dit het juiste advies?</label><label class="r"><input type="radio" name="oordeel" value="goed"> Goed</label><label class="r"><input type="radio" name="oordeel" value="deels"> Deels: er had meer of iets anders bij gekund</label><label class="r"><input type="radio" name="oordeel" value="fout"> Fout</label>
<label>Wat had jouw top 3 moeten zijn? (typ een paar letters, kies uit het aanbod)</label><input type="text" name="b1" class="ac" autocomplete="off" placeholder="1e keuze (de beste)"><div style="height:8px"></div><input type="text" name="b2" class="ac" autocomplete="off" placeholder="2e keuze (optioneel)"><div style="height:8px"></div><input type="text" name="b3" class="ac" autocomplete="off" placeholder="3e keuze (optioneel)">
<label>Wat had Byte beter kunnen doen?</label><div class="tags">${BETER.map(([id, t]) => `<label class="tag"><input type="checkbox" name="beter" value="${id}"> ${esc(t)}</label>`).join("")}</div>
<label>Toelichting</label><textarea name="toelichting" rows="3" placeholder="Bijvoorbeeld: bij 15 collega's had Byte incompany moeten aanraden"></textarea><div style="margin-top:18px"><button>Feedback opslaan</button></div></form></div>`);
  }
  let lijst = [...laatste.values()].reverse();
  if (f === "nog") lijst = lijst.filter(x => !oordeelVan(x.gid)); else if (f === "fout") lijst = lijst.filter(x => ["fout", "deels"].includes(oordeelVan(x.gid)));
  const rij = x => { const o = oordeelVan(x.gid), eerste = (x.gesprek.find(m => m.r === "v") || {}).t || ""; return `<tr><td class="klein" style="white-space:nowrap">${tijd(x.t)}</td><td><a class="lijstlink" href="/admin/gesprekken?g=${esc(x.gid)}">${esc(eerste.slice(0, 120))}</a><br><span class="klein">${x.gesprek.filter(m => m.r === "v").length} berichten van de bezoeker</span></td><td>${x.trainingen.length ? esc(x.trainingen.join(", ")) : '<span class="klein">geen advies</span>'}</td><td><span class="b ${o || "nog"}">${o || "nog niet beoordeeld"}</span></td></tr>`; };
  const fl = (id, t) => `<a href="/admin/gesprekken${id ? "?f=" + id : ""}"${f === id ? ' class="nu"' : ""}>${t}</a>`;
  return pagina(kop1("Gesprekken") + `<p class="intro">${laatste.size} gesprekken met Byte. Open een gesprek om het advies te beoordelen. Gesprekken met een bedoeld advies komen automatisch in de <a href="/admin/simulatie">simulatie</a>.</p><div class="filters">${fl("", "Alle")}${fl("nog", "Nog niet beoordeeld")}${fl("fout", "Fout of deels")}</div>
<div class="kaart sc"><table><thead><tr><th>Wanneer</th><th>Eerste bericht</th><th>Advies</th><th>Oordeel</th></tr></thead><tbody>${lijst.slice(0, 300).map(rij).join("") || '<tr><td colspan="4" class="klein">Nog geen gesprekken</td></tr>'}</tbody></table></div>`);
}

// ---- weekrapport: alle feedback in een tekst die je aan Claude kunt geven ----
function weekrapportPagina(rawUrl) {
  const dagen = Math.max(1, Math.min(365, parseInt(new URL(rawUrl, "http://x").searchParams.get("dagen"), 10) || 7)), vanaf = Date.now() - dagen * 864e5;
  const recent = x => Date.parse(x.t) >= vanaf;
  const gl = new Map(); lees(GESPREKKEN, 4000).forEach(x => gl.set(x.gid, x));
  const fb = lees(FEEDBACK, 4000).filter(recent), sf = lees(SIMFB, 2000).filter(recent);
  const laatsteRun = lees(SIMULATIES, 1).pop(), runPer = new Map((laatsteRun ? laatsteRun.rijen : []).map(r => [r.tekst, r]));
  const tf = lees(TOETSFB, 2000).filter(recent);
  const tags = new Map(); [...fb, ...sf].forEach(x => (x.beter || []).forEach(t => tags.set(t, (tags.get(t) || 0) + 1)));
  const r = [];
  r.push(`# Byte-feedback van de afgelopen ${dagen} dagen`, "", `Gesprekken beoordeeld: ${new Set(fb.map(x => x.gid)).size}. Simulatieregels beoordeeld: ${new Set(sf.map(x => x.tekst)).size}.`);
  if (tags.size) r.push("", "Wat collega's vaker vonden dat Byte beter kon doen: " + [...tags].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${BETERMAP[t]} (${n}x)`).join(", ") + ".");
  r.push("", "## Echte gesprekken", "");
  if (!fb.length) r.push("Geen feedback in deze periode.", "");
  fb.forEach(x => { const g = gl.get(x.gid), bez = g ? g.gesprek.filter(m => m.r === "v").map(m => m.t) : [];
    r.push(`### ${new Date(x.t).toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" })}: ${x.oordeel || "opmerking"}`, `- Bezoeker typte: ${bez.length ? bez.map(t => `"${t}"`).join(" → ") : "(gesprek niet bewaard)"}`, `- Byte adviseerde: ${g && g.trainingen.length ? g.trainingen.join(", ") : "geen advies"}`);
    if (x.bedoeld.length) r.push(`- Top 3 volgens collega: ${x.bedoeld.map((n, i) => (i + 1) + ". " + n).join(" ")}`);
    if ((x.beter || []).length) r.push(`- Byte had beter kunnen: ${x.beter.map(t => BETERMAP[t]).join(", ")}`);
    if (x.toelichting) r.push(`- Toelichting: ${x.toelichting}`); r.push(""); });
  r.push("## Testgevallen uit de simulatie", "");
  if (!sf.length) r.push("Geen feedback in deze periode.", "");
  sf.forEach(x => { const run = runPer.get(x.tekst), o = { ok: "goedgekeurd", anders: "afgekeurd", navragen: "afgekeurd, had eerst moeten navragen", geen: "afgekeurd, had moeten doorverwijzen", incompany: "afgekeurd, had incompany of maatwerk moeten aanraden" }[x.oordeel];
    r.push(`### "${x.tekst}": ${o}`, `- Byte gaf: ${run ? (run.top.length ? run.top.join(" | ") : "geen training") + " (" + run.wat + ")" : "onbekend"}`);
    if (x.oordeel === "anders" && !x.bedoeld.length) r.push("- Geen training als antwoord: zie wat Byte beter kon doen.");
    if (x.oordeel === "anders" && x.bedoeld.length) r.push(`- Top 3 volgens collega: ${x.bedoeld.map((n, i) => (i + 1) + ". " + n).join(" ")}`);
    if ((x.beter || []).length) r.push(`- Byte had beter kunnen: ${x.beter.map(t => BETERMAP[t]).join(", ")}`);
    if (x.toelichting) r.push(`- Toelichting: ${x.toelichting}`); r.push(""); });
  r.push("## Toets: soort bericht", "");
  if (!tf.length) r.push("Geen feedback in deze periode.", "");
  tf.forEach(x => { r.push(`### "${x.tekst}"`, `- Byte sorteerde het als: ${TOETS_NAAM[x.kreeg] || x.kreeg}`, `- Volgens collega had dat moeten zijn: ${TOETS_NAAM[x.soort] || x.soort}${x.soort === x.kreeg ? " (Byte had het dus goed)" : ""}`); if (x.toelichting) r.push(`- Toelichting: ${x.toelichting}`); r.push(""); });
  const tekst = r.join("\n");
  const opdracht = `Lees de Byte-feedback hieronder door. Zoek terugkerende patronen, bepaal per patroon wat er in Byte moet veranderen (de instructies in ai.js, de ranking in public/index.html of de zoekstap in server.js), pas Byte daarop aan en voeg de beoordeelde gevallen toe aan toets/simulatie.js of toets/gevallen.js. Draai daarna npm run vangnet en vat samen wat je hebt veranderd.\n\n`;
  const fl = (n, t) => `<a href="/admin/weekrapport?dagen=${n}"${n === dagen ? ' class="nu"' : ""} style="padding:6px 14px;border-radius:48px;border:1.5px solid var(--line);text-decoration:none;color:var(--ink);font-size:.9rem;background:${n === dagen ? "var(--peach)" : "var(--surface)"}">${t}</a>`;
  return kader({ titel: "Weekrapport", actief: "/admin/weekrapport", inhoud: kop1("Weekrapport") + `<p class="intro">Alle feedback van collega's in één tekst. Kopieer hem en geef hem aan Claude met de opdracht hieronder, bijvoorbeeld één keer per week.</p>
<div class="filters" style="display:flex;gap:8px;margin-bottom:16px">${fl(7, "Laatste 7 dagen")}${fl(30, "Laatste 30 dagen")}${fl(365, "Alles")}</div>
<div class="kaart pad"><button id="kopie" type="button">Kopieer voor Claude</button> <span class="klein" id="ok"></span><textarea id="tekst" readonly rows="22" style="margin-top:14px;font:13px/1.5 ui-monospace,Menlo,monospace">${esc(opdracht + tekst)}</textarea></div>
<script>document.getElementById("kopie").onclick=async()=>{const t=document.getElementById("tekst");t.select();try{await navigator.clipboard.writeText(t.value);document.getElementById("ok").textContent="Gekopieerd";}catch(e){document.execCommand&&document.execCommand("copy");document.getElementById("ok").textContent="Geselecteerd, druk op Ctrl+C";}};</script>` });
}

// ---- toets: soort bericht, op de achtergrond, bewaard en te beoordelen ----
const TOETS_SOORTEN = [["leerwens", "Wil iets leren: advies geven"], ["vraag_over_startel", "Vraag over Startel"], ["opdracht", "Opdracht aan Byte (iets maken of doen)"], ["buiten_onderwerp", "Buiten het onderwerp"], ["misbruik", "Misbruik of onzin"]];
const TOETS_NAAM = Object.fromEntries(TOETS_SOORTEN), TOETS_LETTER = { l: "leerwens", s: "vraag_over_startel", o: "opdracht", b: "buiten_onderwerp", m: "misbruik" };
let toetsRun = null;
function startToets() {
  const fb = new Map(); lees(TOETSFB, 2000).forEach(x => fb.set(x.tekst, x));
  const gevallen = require("./toets/gevallen.js").map(([t, w]) => [t, fb.has(t) ? fb.get(t).soort : TOETS_LETTER[w]]);
  const run = toetsRun = { klaar: false, start: Date.now(), totaal: gevallen.length, rijen: [] };
  (async () => { for (let i = 0; i < gevallen.length; i += 6) await Promise.all(gevallen.slice(i, i + 6).map(async ([t, w]) => {
    try { const o = await ai._intern.poort(t, ""); run.rijen.push({ tekst: t, verwacht: w, kreeg: o.soort, ok: o.soort === w }); } catch (e) { run.rijen.push({ tekst: t, verwacht: w, kreeg: "fout: " + String(e.message).slice(0, 80), ok: false }); } }));
    run.klaar = true; bewaar(TOETSEN, { t: new Date(run.start).toISOString(), totaal: run.totaal, rijen: run.rijen }); })();
}
function toetsActief(run) {
  const geschiedenis = lees(TOETSEN, 30).reverse(), b = run ? geschiedenis.find(h => h.t === run) : null;
  const actief = b ? { klaar: true, start: Date.parse(b.t), totaal: b.totaal, rijen: b.rijen, bewaard: true } : (toetsRun || (geschiedenis[0] ? { klaar: true, start: Date.parse(geschiedenis[0].t), totaal: geschiedenis[0].totaal, rijen: geschiedenis[0].rijen, bewaard: true } : null));
  return { geschiedenis, actief };
}
function toetsRijHtml(r, i, fb) {
  const o = fb.get(r.tekst), g = !!o && o.soort === r.kreeg, naam = x => TOETS_NAAM[x] || x;
  const stat = !o ? "" : g ? '<span class="b goed">goedgekeurd</span>' : `<span class="b fout">afgekeurd</span><br><span class="klein">had moeten zijn: ${escH(naam(o.soort))}${o.toelichting ? "<br>" + escH(o.toelichting) : ""}</span>`;
  return `<tr data-i="${i}"><td><span class="b ${r.ok ? "goed" : "fout"}">${r.ok ? "goed" : "fout"}</span></td><td>${escH(r.tekst)}</td><td>${escH(naam(r.verwacht))}</td><td>${escH(naam(r.kreeg))}</td><td><div class="beo" data-tekst="${escH(r.tekst)}" data-kreeg="${escH(r.kreeg)}"><div class="knoppen"><button type="button" class="vk${g ? " aan" : ""}" title="Goedgekeurd: Byte heeft dit goed beoordeeld" aria-label="Goedgekeurd">&#10003;</button><button type="button" class="kr${o && !g ? " aan" : ""}" title="Afgekeurd: dit had het moeten zijn" aria-label="Afgekeurd">&#10005;</button></div><div class="st">${stat}</div>
<div class="uit" hidden><div class="klein">Wat had Byte moeten doen met dit bericht?</div><div class="snel" style="flex-direction:column;align-items:flex-start">${TOETS_SOORTEN.map(([id, t]) => `<label class="tag"><input type="radio" name="soort-${i}" value="${id}"> ${escH(t)}</label>`).join("")}</div><input type="text" class="toel" placeholder="Wat had Byte moeten antwoorden? (optioneel)"><div class="snel"><button type="button" class="pil opsl">Opslaan</button></div></div></div></td></tr>`;
}
function toetsJson(van) {
  const { actief } = toetsActief(""); if (!actief) return { rijen: [], klaar: true, totaal: 0, goed: 0, fout: 0, n: 0 };
  const fb = new Map(); lees(TOETSFB, 2000).forEach(x => fb.set(x.tekst, x)); const r = actief.rijen, goed = r.filter(x => x.ok).length;
  return { klaar: !!actief.klaar, totaal: actief.totaal, n: r.length, goed, fout: r.length - goed, rijen: r.slice(van).map((x, j) => toetsRijHtml(x, van + j, fb)) };
}
function toetsPagina(run) {
  const { geschiedenis, actief } = toetsActief(run), tijdS = t => new Date(t).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" });
  const hist = geschiedenis.length ? `<h2>Eerdere runs</h2><div class="kaart sc"><table><thead><tr><th>Gedraaid</th><th>Goed</th><th>Fout</th><th></th></tr></thead><tbody>${geschiedenis.map(h => { const g = h.rijen.filter(r => r.ok).length; return `<tr><td>${tijdS(h.t)}</td><td>${g}</td><td>${h.rijen.length - g}</td><td><a href="/admin/toets?run=${encodeURIComponent(h.t)}">Bekijk</a></td></tr>`; }).join("")}</tbody></table></div>` : "";
  if (!actief) return kader({ titel: "Toets", actief: "/admin/toets", inhoud: kop1("Toets") + `<p class="intro">Controleert of Byte elk bericht goed sorteert: leerwens, vraag over Startel, opdracht, buiten het onderwerp of misbruik. Ongeveer 75 berichten, een halve minuut tot een minuut. Je kunt de pagina openhouden en gewoon doorwerken.</p><a class="knop" href="/admin/toets?start=1">Start de toets</a>` });
  const s = actief, fb = new Map(); lees(TOETSFB, 2000).forEach(x => fb.set(x.tekst, x));
  const volgorde = s.rijen.map((r, i) => i); if (s.klaar) volgorde.sort((a, b) => s.rijen[a].ok - s.rijen[b].ok);
  const n = s.rijen.length, goed = s.rijen.filter(r => r.ok).length;
  const inhoud = kop1("Toets") + `<p class="intro">${s.bewaard ? "Run van " + tijdS(s.start) + ". " : ""}Elk bericht gaat door de poortwachter van Byte. <b>Goed</b>: Byte sorteert het zoals verwacht. <b>Fout</b>: Byte deed iets anders. Vind je dat Byte het eigenlijk goed had, of dat de verwachting niet klopt, geef dan hier je oordeel. Dat telt bij de volgende run.</p>
<div class="tegels"><div class="tegel"><b id="t-goed">${goed}</b><span>goed</span></div><div class="tegel"><b id="t-fout">${n - goed}</b><span>fout</span></div><div class="tegel"><b id="t-n">${n}/${s.totaal}</b><span id="t-s">${s.klaar ? "klaar" : "bezig, je kunt gewoon doorwerken"}</span></div></div>
<div class="kaart sc" style="margin-top:14px"><table><thead><tr><th></th><th>Bericht</th><th>Verwacht</th><th>Dit deed Byte</th><th>Jouw oordeel</th></tr></thead><tbody id="rijen">${volgorde.map(i => toetsRijHtml(s.rijen[i], i, fb)).join("")}</tbody></table></div>
<style>.beo{min-width:170px}.knoppen{display:flex;gap:6px}.knoppen button{width:36px;height:36px;padding:0;border-radius:50%;border:1.5px solid var(--line);background:var(--surface);color:var(--muted);font-size:1.1rem;line-height:1}.knoppen .vk:hover,.knoppen .vk.aan{background:#DFF3E4;color:#1D6B35;border-color:#1D6B35}.knoppen .kr:hover,.knoppen .kr.aan{background:#FDE0DC;color:#9B2A1C;border-color:#9B2A1C}.beo .st{margin-top:6px}.uit{margin-top:8px;display:grid;gap:6px;max-width:250px}.uit[hidden]{display:none}.uit input[type=text]{padding:7px 12px;border-radius:10px;font-size:.9rem}.snel{display:flex;gap:6px;flex-wrap:wrap}.pil{padding:5px 12px;border-radius:48px;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);font-size:.82rem}.pil.opsl{background:var(--orange);color:#fff;border-color:var(--orange)}.uit label.tag{display:flex;text-align:left}</style>
<div id="klaarbalk" hidden class="tegel" style="margin-top:14px;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap"><span>De toets is klaar. Je beoordelingen blijven staan.</span><a class="knop" href="/admin/toets">Sorteer op uitkomst</a></div>
<script>(()=>{const run=${JSON.stringify(run || "")}, tb=document.getElementById("rijen"), NAAM=${JSON.stringify(TOETS_NAAM)};
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
async function stuur(box,soort,tl){const d=new URLSearchParams({tekst:box.dataset.tekst,soort,kreeg:box.dataset.kreeg}); if(tl)d.set("toelichting",tl);
 await fetch("/admin/toetsfeedback",{method:"POST",body:d}); box.querySelector(".uit").hidden=true; const goed=soort===box.dataset.kreeg;
 box.querySelector(".vk").classList.toggle("aan",goed); box.querySelector(".kr").classList.toggle("aan",!goed);
 box.querySelector(".st").innerHTML=goed?'<span class="b goed">goedgekeurd</span>':'<span class="b fout">afgekeurd</span><br><span class="klein">had moeten zijn: '+esc(NAAM[soort]||soort)+(tl?"<br>"+esc(tl):"")+"</span>";}
document.addEventListener("click",e=>{const box=e.target.closest(".beo"); if(!box)return;
 if(e.target.closest(".vk")) return stuur(box,box.dataset.kreeg,"");
 if(e.target.closest(".kr")){const u=box.querySelector(".uit"); u.hidden=!u.hidden; return;}
 if(e.target.closest(".opsl")){const r=box.querySelector("input[type=radio]:checked"); if(!r){box.querySelector(".klein").textContent="Kies eerst wat het had moeten zijn"; return;} stuur(box,r.value,box.querySelector(".toel").value.trim());}});
${s.klaar ? "" : `let van=tb.rows.length; const tik=async()=>{try{const r=await (await fetch("/admin/toets?json=1&van="+van)).json();
 if(r.rijen.length){tb.insertAdjacentHTML("beforeend",r.rijen.join("")); van=r.n;}
 document.getElementById("t-goed").textContent=r.goed; document.getElementById("t-fout").textContent=r.fout; document.getElementById("t-n").textContent=r.n+"/"+r.totaal; document.getElementById("t-s").textContent=r.klaar?"klaar":"bezig, je kunt gewoon doorwerken";
 if(r.klaar){document.getElementById("klaarbalk").hidden=false; return;}}catch(e){} setTimeout(tik,3000);}; setTimeout(tik,3000);`}
})();</script>${s.klaar ? '<p style="margin-top:16px"><a class="knop" href="/admin/toets?start=1">Opnieuw draaien</a></p>' : ""}` + hist;
  return kader({ titel: "Toets", actief: "/admin/toets", inhoud });
}
function aanvragenPagina() {
  const v = lees(VERZOEKEN, 500).reverse(), c = lees(CONTACT, 5000);
  const tijd = t => new Date(t).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" });
  const tabel = (kop, rijen, leeg) => `<div class="kaart sc"><table><thead><tr>${kop.map(k => `<th>${k}</th>`).join("")}</tr></thead><tbody>${rijen.map(r => "<tr>" + r.map(x => `<td>${x}</td>`).join("") + "</tr>").join("") || `<tr><td colspan="${kop.length}" class="klein">${leeg}</td></tr>`}</tbody></table></div>`;
  const perGid = new Map();
  c.forEach(x => { const g = perGid.get(x.gid) || { gid: x.gid, eerst: x.t, laatst: x.t, getoond: new Set(), acties: new Set() }; g.laatst = x.t; if (x.soort === "getoond") g.getoond.add(x.reden || "advies"); else g.acties.add(x.soort); perGid.set(x.gid, g); });
  const gesprekken = [...perGid.values()].sort((a, b) => (a.laatst < b.laatst ? 1 : -1));
  const gidsMet = soort => new Set(c.filter(x => x.soort === soort).map(x => x.gid)).size;
  const NAAM = { bel: "Klikte op bellen", mail: "Klikte op mailen", formulier: "Opende het terugbelformulier", link: "Klikte op een link" };
  const link = gid => gid ? `<a href="/admin/gesprekken?g=${esc(gid)}">Bekijk gesprek</a>` : "";
  const redenen = new Map(); gesprekken.forEach(g => g.getoond.forEach(r => redenen.set(r, (redenen.get(r) || 0) + 1)));
  const inhoud = kop1("Aanvragen") + `<p class="intro">Alles wat bezoekers aan contact met een adviseur doen: gegevens die ze achterlieten en op welke knoppen ze klikten. Een echte afspraak in HubSpot staat hier nog niet bij, alleen een klik. Gegevens staan in ${esc(DATA_DIR)}.</p>
<div class="tegels"><div class="tegel"><b>${v.length}</b><span>gegevens achtergelaten (terugbellen)</span></div><div class="tegel"><b>${gidsMet("bel")}</b><span>gesprekken met een klik op bellen</span></div><div class="tegel"><b>${gidsMet("mail")}</b><span>gesprekken met een klik op mailen</span></div><div class="tegel"><b>${gidsMet("getoond")}</b><span>gesprekken waarin een adviseur werd aangeraden</span></div></div>
<h2>Achtergelaten gegevens</h2>${tabel(["Wanneer", "Naam", "Contact", "Bericht", "Wat Byte adviseerde", ""], v.map(x => [tijd(x.t), esc(x.naam), esc(x.contact), esc(x.bericht), esc((x.adviezen || []).join(", ")) + (x.samenvatting ? `<br><span class="klein">${esc(x.samenvatting)}</span>` : ""), link(x.gid)]), "Nog niemand heeft gegevens achtergelaten")}
<h2>Waarom werd een adviseur aangeraden</h2>${tabel(["Reden", "Gesprekken"], [...redenen].sort((a, b) => b[1] - a[1]).map(([r, n]) => [esc(r), n]), "Nog niets")}
<h2>Contactmomenten per gesprek</h2>${tabel(["Laatst", "Reden", "Wat de bezoeker deed", ""], gesprekken.slice(0, 200).map(g => [tijd(g.laatst), esc([...g.getoond].join(", ")), [...g.acties].map(a => NAAM[a] || a).join("<br>") || '<span class="klein">Alleen gezien, geen actie</span>', link(g.gid)]), "Nog geen contactmomenten")}`;
  return kader({ titel: "Aanvragen", actief: "/admin/aanvragen", inhoud });
}
function dashboard() {
  const v = lees(VERZOEKEN, 500).reverse(), a = lees(ADVIEZEN, 2000).reverse(), gs = new Set(lees(GESPREKKEN, 4000).map(x => x.gid));
  const tel = (lijst) => { const m = new Map(); lijst.forEach(x => m.set(x, (m.get(x) || 0) + 1)); return [...m].sort((x, y) => y[1] - x[1]).slice(0, 10); };
  const topT = tel(a.flatMap(x => x.trainingen || [])), topO = tel(a.map(x => x.thema).filter(Boolean));
  const tijd = t => new Date(t).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" });
  const tabel = (kop, rijen, leeg) => `<div class="kaart sc"><table><thead><tr>${kop.map(k => `<th>${k}</th>`).join("")}</tr></thead><tbody>${rijen.map(r => "<tr>" + r.map(c => `<td>${c}</td>`).join("") + "</tr>").join("") || `<tr><td colspan="${kop.length}" class="klein">${leeg}</td></tr>`}</tbody></table></div>`;
  const inhoud = kop1("Overzicht") + `<p class="intro">Wat Byte doet, wat bezoekers vragen en wie teruggebeld wil worden. Alleen voor Startel-medewerkers. Gegevens staan in ${esc(DATA_DIR)}.</p>
<div class="tegels"><div class="tegel"><b>${gs.size}</b><span>gesprekken bewaard</span></div><div class="tegel"><b>${a.length}</b><span>adviezen uitgebracht</span></div><div class="tegel"><b>${v.length}</b><span>terugbelverzoeken</span></div></div>
<h2>Terugbelverzoeken</h2>${tabel(["Wanneer", "Naam", "Contact", "Bericht", "Wat Byte adviseerde"], v.map(x => [tijd(x.t), esc(x.naam), esc(x.contact), esc(x.bericht), esc((x.adviezen || []).join(", ")) + (x.samenvatting ? `<br><span class="klein">${esc(x.samenvatting)}</span>` : "")]), "Nog geen verzoeken")}
<h2>Wat vooral wordt geadviseerd</h2><div class="twee"><div><h3>Meest geadviseerde trainingen</h3>${tabel(["Training", "Keer"], topT.map(([n, c]) => [esc(n), c]), "Nog niets")}</div><div><h3>Meest gekozen onderwerpen</h3>${tabel(["Onderwerp", "Keer"], topO.map(([n, c]) => [esc(n), c]), "Nog niets")}</div></div>
<h2>Laatste adviezen</h2>${tabel(["Wanneer", "Onderwerp en profiel", "Wat de bezoeker vertelde", "Adviezen"], a.slice(0, 100).map(x => [tijd(x.t), esc([x.thema, x.niveau, x.voor, x.rol].filter(Boolean).join(" · ")), esc(x.verteld), esc((x.trainingen || []).join(", "))]), "Nog geen adviezen")}`;
  return kader({ titel: "Overzicht", actief: "/admin", inhoud });
}

// functie -> richtingen die daar ook bij passen (alleen om kandidaten uit het eigen aanbod te zoeken)
const ROL_RICHTINGEN = [
  [/marketeer|marketing|communicatie|content|social media|webredactie|pr\b|brand/i, ["video's en content maken met AI", "AI en Copilot voor dagelijks werk", "datavisualisatie en dashboards", "presenteren en communiceren"]],
  [/\bhr\b|p&o|recruit|personeel|opleidingsadviseur/i, ["AI en Copilot voor dagelijks werk", "data en rapportages in Excel en Power BI", "communicatie en gesprekken voeren", "leiderschap en teamontwikkeling"]],
  [/projectleider|projectmanager|scrum|product owner|programmamanager/i, ["Agile, Scrum en projectmanagement", "AI en Copilot voor dagelijks werk", "leiderschap en samenwerken", "dashboards en rapportages"]],
  [/financ|boekhoud|controller|administrat|office manager|secretar|assistent/i, ["Excel voor gevorderden", "Power BI en rapportages", "AI en Copilot voor dagelijks werk", "Microsoft 365 en Teams"]],
  [/leidinggev|manager|teamleider|directeur|\bmt\b/i, ["leiderschap en coachen", "AI en Copilot voor dagelijks werk", "communicatie en feedback geven", "dashboards en sturen op data"]],
];

const server = http.createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];
  try {
    if (url === "/health") return send(res, 200, "ok", "text/plain");
    if (url === "/api/status") return send(res, 200, { model: modelState, indexed: !!vectors, trainingen: catalog.length, bijgewerkt: catalogUpdated, ai: ai.aan() ? ai.MODEL : false, aiFout: ai.status.fout, aiLaatsteSucces: ai.status.ok, aiFoutenAchtereen: ai.status.fouten, aiNotitie: ai.status.notitie, aanbod: { inByte: catalog.length, opStartelNl: extraStatus.opSite, handmatig: baseCatalog().length, automatischErbij: extra.filter(x => !x.skip).length, laatsteSync: extraStatus.laatst, fout: extraStatus.fout } });
    // proef: open vragen in de adviesfase via een AI-model (zie ai.js voor de grenzen)
    if (url === "/api/ai/begrijp" && req.method === "POST") {
      if (!ai.aan()) return send(res, 503, { error: "AI staat uit" });
      let b; try { b = JSON.parse(await readBody(req, 8000)); } catch { return send(res, 400, { error: "Ongeldig verzoek" }); }
      const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      const te = ai.magNog(ip); if (te) return send(res, 429, { error: "Even rustig aan" });
      try { // het aanbod van startel.nl dat het dichtst bij het bericht ligt gaat mee, zodat Byte eerlijk kan zeggen wat er wel en niet is
        const kand = vectors && typeof b.tekst === "string" && b.tekst.trim() ? (await match((ai.sessieTekst(b.sessie) + " " + (Array.isArray(b.eerder) ? b.eerder.slice(-4).map(x => String(x).slice(0, 300)).join(" ") : "") + " " + b.tekst).trim().slice(-700))).slice(0, 8).map(x => ({ i: x.i, t: catalog[x.i] })) : [];
        // bij een functie zonder onderwerp: ook trainingen uit aangrenzende richtingen meegeven, zodat Byte meer kan aanbieden dan het voor de hand liggende
        if (kand.length && typeof b.tekst === "string") for (const [re, zinnen] of ROL_RICHTINGEN) if (re.test(b.tekst)) { for (const z of zinnen) for (const x of (await match(z)).slice(0, 2)) if (!kand.some(k => k.i === x.i) && kand.length < 14) kand.push({ i: x.i, t: catalog[x.i] }); break; }
        const uit = await ai.begrijp(b, kand); log(`AI begrijp: ${uit.soort}/${uit.past}${uit.gebruik ? ", " + uit.gebruik.input_tokens + " in / " + uit.gebruik.output_tokens + " uit" : ""}`); delete uit.gebruik; return send(res, 200, uit); }
      catch (e) { log("AI-fout (begrijp):", e.message); if (e.code !== 503) ai.status.fout = new Date().toISOString() + " " + String(e.message).slice(0, 300); return send(res, e.code === 400 ? 400 : e.code === 429 ? 429 : 503, { error: "AI niet beschikbaar" }); }
    }
    if (url === "/api/ai" && req.method === "POST") {
      if (!ai.aan()) return send(res, 503, { error: "AI staat uit" });
      if (!vectors) return send(res, 503, { error: "Nog niet klaar" });
      let b; try { b = JSON.parse(await readBody(req, 16000)); } catch { return send(res, 400, { error: "Ongeldig verzoek" }); }
      const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      const te = ai.magNog(ip); if (te) return send(res, 429, { error: te === "dag" ? "Daglimiet bereikt" : "Even rustig aan" });
      // 15 kandidaten: wat bij de vraag en het profiel past, plus wat al getoond is
      const vraagTekst = String(b.tekst || "").slice(0, 500), prof = b.profiel || {};
      const zoek = [vraagTekst, ai.sessieTekst(b.sessie), prof.thema, prof.rol, prof.doel].filter(Boolean).join(". ").slice(0, 900);
      const getoond = (Array.isArray(b.getoond) ? b.getoond : []).filter(i => Number.isInteger(i) && catalog[i]).slice(0, 6);
      const best = (await match(zoek)).map(x => x.i);
      const idx = [...new Set([...getoond, ...best])].slice(0, 15);
      try {
        const uit = await ai.vraag({ ...b, getoond }, idx.map(i => ({ i, t: catalog[i] })));
        log(`AI: ${uit.gebruik ? uit.gebruik.input_tokens + " in / " + uit.gebruik.output_tokens + " uit" : ""}${uit.geweigerd ? " (geweigerd: " + uit.geweigerd + ")" : ""}`);
        return send(res, 200, { sessie: uit.sessie, tekst: uit.tekst, trainingen: uit.trainingen, adviseur: uit.adviseur, geweigerd: !!uit.geweigerd, kennis: !!uit.kennis, waarom: uit.geweigerd || undefined, thema: uit.thema || [] });
      } catch (e) { log("AI-fout:", e.message); if (!ai.status.fout || e.code !== 503) ai.status.fout = new Date().toISOString() + " " + String(e.message).slice(0, 300); return send(res, e.code === 400 ? 400 : e.code === 429 ? 429 : 503, { error: "AI niet beschikbaar" }); }
    }
    if (url === "/admin/toets") {
      if (!adminToegang(req, res)) return;
      const qp = new URL(req.url, "http://x").searchParams;
      if (qp.get("start") && !ai.aan()) return send(res, 503, "AI staat uit", "text/plain; charset=utf-8");
      if (qp.get("start") && (!toetsRun || toetsRun.klaar)) startToets();
      if (qp.get("json")) return send(res, 200, toetsJson(Math.max(0, parseInt(qp.get("van"), 10) || 0)), "application/json; charset=utf-8");
      return send(res, 200, toetsPagina(qp.get("run")), "text/html; charset=utf-8");
    }
    if (url === "/admin/toetsfeedback" && req.method === "POST") {
      if (!adminToegang(req, res)) return;
      const oh = String(req.headers.origin || req.headers.referer || ""); if (oh && !oh.includes(String(req.headers.host))) return send(res, 403, "Niet toegestaan", "text/plain; charset=utf-8");
      const f = new URLSearchParams(await readBody(req, 4000)), tekst = tekstVeld(f.get("tekst"), 500), soort = TOETS_SOORTEN.some(x => x[0] === f.get("soort")) ? f.get("soort") : "";
      if (tekst && soort) bewaar(TOETSFB, { t: new Date().toISOString(), tekst, soort, kreeg: tekstVeld(f.get("kreeg"), 40), toelichting: tekstVeld(f.get("toelichting"), 400) });
      return send(res, 200, { ok: true });
    }
    if (url === "/admin/simulatie") {
      if (!adminToegang(req, res)) return;
      const qs = new URL(req.url, "http://x").searchParams, st = qs.get("start");
      if (st && !ai.aan()) return send(res, 503, "AI staat uit", "text/plain; charset=utf-8");
      if (st && !vectors) return send(res, 503, "Nog niet klaar met opstarten, probeer over een minuut opnieuw", "text/plain; charset=utf-8");
      if (st === "1") {
        const open = slotOpen();
        if (open !== 0) return send(res, 409, kader({ titel: "Simulatie", actief: "/admin/beoordelen", inhoud: kop1("Nieuwe simulatie nog niet mogelijk") + `<p class="intro">${open < 0 ? "De huidige simulatie is nog bezig." : "Beoordeel eerst de " + open + " gesprekken die nog open staan."} Daarna kun je een nieuwe run starten.</p><a class="knop" href="/admin/beoordelen">Naar beoordelen</a>`, namen: [] }), "text/html; charset=utf-8");
        startNieuweRun(Math.min(100, Math.max(5, parseInt(qs.get("n"), 10) || 30)));
        res.writeHead(303, { location: "/admin/beoordelen" }); return res.end();
      }
      if (st === "vast" && (!simulatie || simulatie.klaar)) startSimulatie();
      { if (qs.get("json")) return send(res, 200, simulatieJson(Math.max(0, parseInt(qs.get("van"), 10) || 0)), "application/json; charset=utf-8"); return send(res, 200, simulatiePagina(qs.get("run")), "text/html; charset=utf-8"); }
    }
    if (url === "/admin/beoordelen") {
      if (!adminToegang(req, res)) return;
      const qb = new URL(req.url, "http://x").searchParams;
      if (qb.get("json")) return send(res, 200, beoordeelJson(qb.get("run") || ""), "application/json; charset=utf-8");
      return send(res, 200, beoordeelPagina(catalog.map(t => t.name).sort(), qb.get("run") || "", BETERMAP), "text/html; charset=utf-8");
    }
    if (url === "/admin/simfeedback" && req.method === "POST") {
      if (!adminToegang(req, res)) return;
      const oh = String(req.headers.origin || req.headers.referer || ""); if (oh && !oh.includes(String(req.headers.host))) return send(res, 403, "Niet toegestaan", "text/plain; charset=utf-8");
      const f = new URLSearchParams(await readBody(req, 8000)), tekst = tekstVeld(f.get("tekst"), 500), oordeel = ["ok", "anders", "navragen", "geen", "incompany"].includes(f.get("oordeel")) ? f.get("oordeel") : "";
      let bedoeld = oordeel === "ok" ? [tekstVeld(f.get("top0"), 140)] : oordeel === "anders" ? [1, 2, 3].map(n => tekstVeld(f.get("b" + n), 140)) : [];
      bedoeld = bedoeld.filter(Boolean);
      const beterT = beterTags(f), toelT = tekstVeld(f.get("toelichting"), 1000);
      if (tekst && oordeel && (oordeel === "ok" ? bedoeld.length : oordeel === "anders" ? bedoeld.length || beterT.length || toelT : true)) bewaar(SIMFB, { t: new Date().toISOString(), tekst, oordeel, bedoeld, beter: beterTags(f), toelichting: tekstVeld(f.get("toelichting"), 1000), wie: beoordelen.RATERS.includes(f.get("wie")) ? f.get("wie") : "", run: tekstVeld(f.get("run"), 40) });
      const terug = tekstVeld(f.get("run"), 40); res.writeHead(303, { location: "/admin/simulatie" + (terug ? "?run=" + encodeURIComponent(terug) : "") }); return res.end();
    }
    if (url === "/admin/weekrapport") { if (!adminToegang(req, res)) return; return send(res, 200, weekrapportPagina(req.url), "text/html; charset=utf-8"); }
    if (url === "/admin/aanvragen") { if (!adminToegang(req, res)) return; return send(res, 200, aanvragenPagina(), "text/html; charset=utf-8"); }
    if (url === "/admin/gesprekken") { if (!adminToegang(req, res)) return; return send(res, 200, gesprekkenPagina(req.url), "text/html; charset=utf-8"); }
    if (url === "/admin/feedback" && req.method === "POST") {
      if (!adminToegang(req, res)) return;
      const oh = String(req.headers.origin || req.headers.referer || ""); if (oh && !oh.includes(String(req.headers.host))) return send(res, 403, "Niet toegestaan", "text/plain; charset=utf-8");
      const f = new URLSearchParams(await readBody(req, 8000)), gid = tekstVeld(f.get("gid"), 40).replace(/[^a-z0-9]/gi, "");
      const oordeel = ["goed", "deels", "fout"].includes(f.get("oordeel")) ? f.get("oordeel") : "";
      const bedoeld = [1, 2, 3].map(n => tekstVeld(f.get("b" + n), 140)).filter(Boolean), beter = beterTags(f);
      if (gid && (oordeel || bedoeld.length || beter.length || f.get("toelichting"))) bewaar(FEEDBACK, { t: new Date().toISOString(), gid, oordeel, bedoeld, beter, toelichting: tekstVeld(f.get("toelichting"), 600) });
      res.writeHead(303, { location: "/admin/gesprekken?g=" + gid + "&opgeslagen=1" }); return res.end();
    }
    if (url === "/admin") { if (!adminToegang(req, res)) return; return send(res, 200, dashboard(), "text/html; charset=utf-8"); }
    if (url === "/api/log" && req.method === "POST") {
      const ip = clientIp(req); if (teVaak(ip, "log", 90)) return send(res, 429, { error: "Even rustig aan" });
      let b; try { b = JSON.parse(await readBody(req, 40000)); } catch { return send(res, 400, { error: "Ongeldig verzoek" }); }
      const tr = (Array.isArray(b.trainingen) ? b.trainingen : []).slice(0, 6).map(x => tekstVeld(x, 120)).filter(Boolean);
      const gesprek = (Array.isArray(b.gesprek) ? b.gesprek : []).slice(0, 80).map(m => ({ r: m && m.r === "b" ? "b" : "v", t: tekstVeld(m && m.t, 400) })).filter(m => m.t);
      if (!tr.length && !gesprek.some(m => m.r === "v")) return send(res, 400, { error: "Niets te bewaren" });
      const pr = b.profiel && typeof b.profiel === "object" ? b.profiel : {};
      const profiel = { thema: tekstVeld(pr.thema, 120), niveau: tekstVeld(pr.niveau, 60), voor: tekstVeld(pr.voor, 60), rol: tekstVeld(pr.rol, 60), verteld: tekstVeld(pr.verteld, 400) };
      const gid = tekstVeld(b.gid, 40).replace(/[^a-z0-9]/gi, "");
      if (tr.length) bewaar(ADVIEZEN, { t: new Date().toISOString(), sessie: tekstVeld(b.sessie, 40), gid, trainingen: tr, ...profiel });
      if (gid && gesprek.length) bewaar(GESPREKKEN, { t: new Date().toISOString(), gid, trainingen: tr, profiel, gesprek });
      return send(res, 200, { ok: true });
    }
    if (url === "/api/contact" && req.method === "POST") {
      const ip = clientIp(req); if (teVaak(ip, "contact", 200)) return send(res, 429, { error: "Te vaak" });
      let b; try { b = JSON.parse(await readBody(req, 2000)); } catch { return send(res, 400, { error: "Ongeldig verzoek" }); }
      const soort = ["getoond", "bel", "mail", "formulier", "link"].includes(b.soort) ? b.soort : null;
      const gid = tekstVeld(b.gid, 40).replace(/[^a-z0-9]/gi, "");
      if (!soort || !gid) return send(res, 400, { error: "Ongeldig verzoek" });
      bewaar(CONTACT, { t: new Date().toISOString(), gid, soort, reden: tekstVeld(b.reden, 60) });
      return send(res, 200, { ok: true });
    }
    if (url === "/api/terugbel" && req.method === "POST") {
      const ip = clientIp(req); if (teVaak(ip, "terugbel", 5)) return send(res, 429, { error: "Je hebt al een paar verzoeken gedaan. Bel ons gerust op 050 502 8888." });
      let b; try { b = JSON.parse(await readBody(req, 6000)); } catch { return send(res, 400, { error: "Ongeldig verzoek" }); }
      if (b.website) return send(res, 200, { ok: true });   // verborgen veld: alleen bots vullen dit in
      const naam = tekstVeld(b.naam, 80), contact = tekstVeld(b.contact, 120), bericht = tekstVeld(b.bericht, 500);
      const mail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact), tel = /^\+?[\d\s\-()]{8,18}$/.test(contact) && contact.replace(/\D/g, "").length >= 9;
      if (!naam) return send(res, 400, { error: "Vul je naam in" });
      if (!mail && !tel) return send(res, 400, { error: "Vul een geldig telefoonnummer of e-mailadres in" });
      const adv = (Array.isArray(b.adviezen) ? b.adviezen : []).slice(0, 6).map(x => tekstVeld(x, 120)).filter(Boolean);
      const ok = bewaar(VERZOEKEN, { t: new Date().toISOString(), naam, contact, gid: tekstVeld(b.gid, 40).replace(/[^a-z0-9]/gi, ""), soort: mail ? "mail" : "telefoon", bericht, adviezen: adv, samenvatting: tekstVeld(b.samenvatting, 400), sessie: tekstVeld(b.sessie, 40) });
      if (!ok) return send(res, 500, { error: "Opslaan lukte niet. Bel ons gerust op 050 502 8888." });
      log("Terugbelverzoek ontvangen"); return send(res, 200, { ok: true });
    }
    if (url === "/api/catalog") return send(res, 200, { updated: catalogUpdated,
      items: catalog.map(({ name, url, tags, lvl, days, fmt, cert, price }) => ({ name, url, tags, lvl, days, fmt, cert, price })) });
    if (url === "/api/classify" && req.method === "POST") {
      const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      if (limited(ip)) return send(res, 429, { error: "Even rustig aan, probeer het zo opnieuw." });
      if (!intentVecs) return send(res, 503, { ready: false, model: modelState });
      let text = "", set = "";
      try { const b = JSON.parse(await readBody(req)); text = String(b.text || "").trim().slice(0, 300); set = String(b.set || ""); } catch { return send(res, 400, { error: "Ongeldig verzoek" }); }
      if (!text || !intentVecs[set]) return send(res, 400, { error: "Ongeldig verzoek" });
      return send(res, 200, { ready: true, results: await classify(text, set) });
    }
    if (url === "/api/match" && req.method === "POST") {
      const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      if (limited(ip)) return send(res, 429, { error: "Even rustig aan, probeer het zo opnieuw." });
      if (!vectors) return send(res, 503, { ready: false, model: modelState });
      let text = "";
      try { text = String(JSON.parse(await readBody(req)).text || "").trim().slice(0, 500); } catch { return send(res, 400, { error: "Ongeldig verzoek" }); }
      if (!text) return send(res, 400, { error: "Lege tekst" });
      return send(res, 200, { ready: true, results: await match(text) });
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Niet toegestaan", "text/plain");
    let p = decodeURIComponent(url); if (p === "/") p = "/index.html";
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT + path.sep)) return send(res, 404, "Niet gevonden", "text/plain; charset=utf-8");
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, "Niet gevonden", "text/plain; charset=utf-8");
      send(res, 200, data, TYPES[path.extname(file).toLowerCase()] || "application/octet-stream");
    });
  } catch (e) { log("Fout:", e.message); send(res, 500, { error: "Er ging iets mis" }); }
});

server.listen(PORT, () => log(`Byte draait op poort ${PORT}`));

(async () => {
  loadCache();
  await loadModel();
  await indexCatalog();
  if (!catalogUpdated || !fs.existsSync(EXTRA_FILE) || Date.now() - Date.parse(catalogUpdated) > REFRESH_MS) {
    if (await refreshCatalog()) await indexCatalog();
  }
  setInterval(async () => { if (await refreshCatalog()) await indexCatalog(); }, REFRESH_MS);
})();
