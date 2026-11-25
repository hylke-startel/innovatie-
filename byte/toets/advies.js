// Benadering van de adviesstap uit public/index.html (score/ranked), voor de simulatietoets op de server.
// Houd dit gelijk aan de browsercode als de ranking daar verandert.
const THEMES = { ai:["ai"], m365:["m365","admin"], cloud:["cloud","azure"], sec:["sec","hack","aware","gov"], data:["data"], dev:["dev","web"], linux:["linux","devops"], net:["net"], test:["test"], pm:["pm","agile","itsm","proces","analyse"], office:["office","basis"], soft:["soft","lead"] };
const ROLES = {
  "Systeem- of netwerkbeheerder": ["admin","m365","azure","cloud","net","linux"], "Helpdesk / servicedesk": ["helpdesk","itsm","basis","m365"],
  "Developer / programmeur": ["dev","web","devops","ai"], "Data / BI / analist": ["data","analyse"], "Security-specialist": ["sec","hack","gov"],
  "Tester / QA": ["test"], "Project- of procesmanager": ["pm","agile","proces","analyse"], "Leidinggevende / directie": ["lead","gov"] };
const STOP = new Set("een het de van voor met een ook wat wil willen ons onze wij ik ben bij naar maar echt graag leren leer jullie hebben heb zijn kan kun hoe dat die dit deze mijn mijn alle ze".split(" "));
const NIV = { "Nog geen": 0, "Basiskennis": 0, "Gevorderd, dagelijks mee bezig": 1, "Expert, ik wil me specialiseren": 2 };
function rangschik(catalog, { tekst, uit, sem }) {
  const thema = new Set(uit.thema || []), rolTags = uit.rol && ROLES[uit.rol] || [];
  const words = new Set(String(tekst + " " + (uit.zoekterm || "")).toLowerCase().split(/[^a-z0-9#+.\-éèëïöü]+/).filter(w => w.length >= 3 && !STOP.has(w)));
  const tt = [...thema].flatMap(id => THEMES[id] || []);
  const want = uit.niveau in NIV ? NIV[uit.niveau] : null;
  return catalog.map((t, i) => {
    let s = 0; const tags = new Set(t.tags), name = t.name.toLowerCase();
    tt.forEach(x => { if (tags.has(x)) s += 4; });
    rolTags.forEach(x => { if (tags.has(x)) s += 2; });
    words.forEach(w => { if (name.includes(w)) s += 6; });
    const have = "BIA".indexOf(t.lvl);
    if (want !== null) { const d = Math.abs(have - want); s += d === 0 ? 3 : d === 1 ? 0 : -4; if (uit.niveau === "Basiskennis" && have === 1) s += 1; }
    if (t.fmt === "z" && uit.vorm !== "Zelfstudie") s -= 3;
    const sm = sem.get(i) || 0; s += 10 * sm;
    ["github", "studio"].forEach(q => { if (name.includes(q) && ![...words].some(w => w.includes(q))) s -= 5; });
    if (tt.length && !tt.some(x => tags.has(x)) && ![...words].some(w => name.includes(w)) && sm < 0.6) s -= 6;
    if (uit.certificaat && !t.cert) s -= 100;
    return { i, t, s };
  }).sort((a, b) => b.s - a.s);
}
module.exports = { rangschik };
