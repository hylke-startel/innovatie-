// Beoordelen van simulaties door sales: nieuwe testgesprekken verzinnen (nooit dezelfde als eerder), spelen, en één gesprek tegelijk laten beoordelen.
const RATERS = ["Hylke", "Johannes", "Fredou", "Thom", "Eliano", "Pieter"];
const norm = t => String(t || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const woorden = t => new Set(norm(t).split(" ").filter(w => w.length > 2));
// dezelfde of bijna dezelfde tekst (meer dan 60% gelijke woorden) telt als eerder gezien
function lijktOp(a, b) {
  if (norm(a) === norm(b)) return true;
  const A = woorden(a), B = woorden(b); if (!A.size || !B.size) return false;
  let s = 0; for (const w of A) if (B.has(w)) s++;
  return s / (A.size + B.size - s) >= 0.6;
}
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const HOEKEN = [
  "iemand die een bepaalde functie noemt en niet weet waar te beginnen", "een leidinggevende die voor een team van 5 tot 40 mensen zoekt", "een beginner die bang is dat het te moeilijk is",
  "iemand die een certificaat of examen wil halen", "een heel korte, vage vraag van maximaal vijf woorden", "een lang bericht met veel context en een aantal wensen tegelijk",
  "iemand met typefouten en spreektaal", "een HR-medewerker die een leertraject voor de organisatie zoekt", "een ervaren specialist die verdieping zoekt",
  "iemand die een training zoekt bij een baanwissel of carrièrestap", "iemand die twee onderwerpen door elkaar noemt", "iemand die een tool noemt die Startel mogelijk niet geeft",
  "iemand uit de zorg, overheid, onderwijs of industrie met een eigen vakwoord", "iemand die over beveiliging of privacy wil leren", "iemand die met data of rapportages werkt",
  "iemand die in een softwarepakket vastloopt (Excel, Outlook, Teams, SharePoint)", "iemand die soft skills zoekt (communiceren, leidinggeven, plannen, samenwerken)", "iemand die iets met AI wil maar nog niet weet wat",
  "iemand die wil automatiseren of programmeren", "iemand die netwerk, cloud of beheer doet", "iemand die kort en zakelijk schrijft", "iemand die vooral de tijd of vorm noemt (een dag, online, avond)",
  "een ondernemer of zzp'er", "iemand die net begonnen is bij een nieuwe werkgever", "iemand die een vraag stelt in de vorm van een probleem op het werk", "iemand die een bepaalde Microsoft-rol of -certificering noemt",
];
const SYSTEEM_VERZIN = `Je bedenkt realistische openingsberichten van bezoekers van de chat op startel.nl, een opleider in IT, AI, Microsoft/Office, data, security, cloud, projectmanagement en soft skills. Elke bezoeker zoekt een training.
Geef alleen een JSON-array. Elk element: {"tekst": "het eerste bericht van de bezoeker, zoals hij het in de chat typt, Nederlands, 3 tot 45 woorden", "achtergrond": "één zin met wat de bezoeker nog niet zei maar wel weet: functie, niveau, teamgrootte, tools, doel"}.
Varieer sterk in onderwerp, lengte, toon en detail. Geen herhaling van de voorbeelden die je krijgt, ook niet in andere woorden.`;
async function genereer(ai, n, bekend) {
  const nieuw = [];
  for (let ronde = 0; ronde < 6 && nieuw.length < n; ronde++) {
    const hoeken = shuffle(HOEKEN).slice(0, 8), ex = shuffle(bekend.concat(nieuw.map(x => x.tekst))).slice(0, 40);
    let uit = ""; try { uit = await ai.maakTekst(SYSTEEM_VERZIN, `Verzin ${Math.min(16, n - nieuw.length + 4)} verschillende berichten. Haal inspiratie uit deze invalshoeken, ieder bericht een andere:\n- ${hoeken.join("\n- ")}\n\nBestaande berichten, NIET herhalen:\n- ${ex.join("\n- ")}`, 3500); } catch (e) { if (!nieuw.length && ronde === 0) throw e; break; }
    let arr = []; try { arr = JSON.parse(uit.slice(uit.indexOf("["), uit.lastIndexOf("]") + 1)); } catch {}
    for (const x of arr) {
      const t = String((x && x.tekst) || "").replace(/\s+/g, " ").trim().slice(0, 320); if (t.length < 8) continue;
      if (bekend.some(b => lijktOp(t, b)) || nieuw.some(b => lijktOp(t, b.tekst))) continue;
      nieuw.push({ tekst: t, achtergrond: String(x.achtergrond || "").slice(0, 300) }); if (nieuw.length >= n) break;
    }
  }
  return nieuw;
}
const SYSTEEM_BEZOEKER = `Je speelt een bezoeker van startel.nl die een training zoekt. Je krijgt je eigen eerste bericht, wat je nog meer weet, en de vraag van de adviseur. Antwoord kort (hooguit 20 woorden), zoals een echte bezoeker typt, zonder aanhalingstekens. Geef een concreet antwoord dat past bij je achtergrond; weet je het echt niet, zeg dat dan gewoon.`;
function maak(dep) {
  const { ai, simKandidaten, match, getCatalog, rangschik } = dep;
  async function speel(g, watTekst) {
    const r = { tekst: g.tekst, soort: "v", nieuw: true, achtergrond: g.achtergrond, gesprek: [{ r: "v", t: g.tekst }], top: [], wat: "", ok: false, deels: false };
    try {
      let volledig = g.tekst, nu = g.tekst, sessie, uit;
      for (let beurt = 0; beurt < 3; beurt++) {
        const kand = await simKandidaten(volledig);
        uit = await ai.begrijp({ tekst: nu, sessie }, kand); sessie = uit.sessie;
        if (uit.soort !== "leerwens") { r.wat = "geweigerd: " + uit.soort; r.gesprek.push({ r: "b", t: uit.antwoord || "(afgewezen)" }); return r; }
        const vraag = uit.navraag || uit.vervolgvraag, bt = [uit.reactie, vraag].filter(Boolean).join(" ");
        if (bt) r.gesprek.push({ r: "b", t: bt });
        if (!vraag || beurt === 2) break;
        const a = (await ai.maakTekst(SYSTEEM_BEZOEKER, `Je eerste bericht: ${g.tekst}\nWat je verder weet: ${g.achtergrond || "(niets bijzonders)"}\nVraag van de adviseur: ${vraag}\nJouw antwoord:`, 120)).replace(/^["“]|["”]$/g, "").trim();
        if (!a) break; r.gesprek.push({ r: "v", t: a }); volledig += " " + a; nu = a;
      }
      if (uit.navraag && !uit.reactie && uit.past !== "nee") { r.wat = "navraag: " + uit.navraag; return r; }
      const cat = getCatalog(), res = await match(volledig), top = res[0] ? res[0].s : 0, low = res.length ? res[res.length - 1].s : 0, span = Math.max(top - low, 1e-6);
      const sem = new Map(res.map(x => [x.i, (x.s - low) / span]));
      r.top = rangschik(cat, { tekst: volledig, uit, sem }).slice(0, 3).map(x => x.t.name);
      r.wat = uit.past === "nee" ? "geen aanbod gemeld" : "advies" + (uit.voorstel != null && cat[uit.voorstel] ? " (direct voorstel: " + cat[uit.voorstel].name + ")" : "");
      if (uit.past === "nee") r.top = [];
    } catch (e) { r.wat = "fout: " + String(e.message).slice(0, 100); }
    return r;
  }
  return { speel };
}
module.exports = { RATERS, genereer, lijktOp, maak, norm };
