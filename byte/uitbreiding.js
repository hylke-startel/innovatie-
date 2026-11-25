// Haalt alle trainingen van startel.nl op (course-sitemap) en maakt van wat in de handmatige lijst (catalog.js) ontbreekt
// regels in hetzelfde formaat: { name, slug, tags, lvl, days, fmt }. Zo kent Byte altijd het volledige aanbod.
const { parseTraining } = require("./scrape");

const SITEMAP = "https://startel.nl/course-sitemap.xml";
const SKIP = /\b\d+[- ]?pack\b|^examen\b|^microsoft mcp examen|examen[- ]?voucher\s*$|^voucher\b/i;   // losse examens en vouchers: geen training om aan te raden

const TAGS = [
  [/\bAI\b|copilot|chatgpt|gemini|prompt|artificial|machine learning|generatieve|agentic/i, "ai"],
  [/excel|word\b|outlook|powerpoint|office|onenote|access\b/i, "office"],
  [/microsoft 365|teams|sharepoint|onedrive|exchange|intune|endpoint|\bMS-\d|\bMD-\d|\bMS-\d/i, "m365"],
  [/power platform|power automate|power apps|\bPL-\d|low[- ]?code|automatiser/i, "auto"],
  [/power bi|data analy|dashboard|\bDP-\d|sql|data engineer|data science|datawarehouse|business intelligence/i, "data"],
  [/dynamics|business central|\bMB-\d|\bMB\d/i, "analyse"],
  [/azure|\bAZ-\d|\bAI-\d{3}/i, "azure"],
  [/cloud|aws|google cloud/i, "cloud"],
  [/devops|docker|kubernetes|\bCKA\b|\bCKAD\b|terraform|ansible|ci\/cd|\bgit\b/i, "devops"],
  [/linux|lpic|red hat|\brhcsa\b|unix/i, "linux"],
  [/netwerk|network|cisco|ccna|ccnp|routing|switch|wifi|wireless|firewall|fortinet|palo alto/i, "net"],
  [/ethical hack|pentest|hacking|forensic|\bCEH\b|\bCHFI\b|red team|exploit/i, "hack"],
  [/awareness|phishing|social engineering/i, "aware"],
  [/security|cyber|\bSC-\d|cissp|ccsp|comptia sec|beveilig|\bISO ?27001|\bNIS2|\bAVG\b|\bGDPR|privacy|compliance/i, "sec"],
  [/ITIL|servicemanagement|service management|\bBiSL|\bASL\b|\bISO ?20000|\bDevOps foundation/i, "itsm"],
  [/helpdesk|servicedesk|service desk|\bIT[- ]support|comptia a\+|klantenservice/i, "helpdesk"],
  [/test|istqb|\btmap\b|\bqa\b/i, "test"],
  [/scrum|agile|kanban|\bsafe\b|product owner|safe\b/i, "agile"],
  [/prince2|projectmanagement|projectleider|project management|\bpmp\b|\bipma\b|msp\b|programmamanagement|portfolio/i, "pm"],
  [/lean|six sigma|procesverbeter|process improvement|bpm\b|bpmn/i, "proces"],
  [/business analy|requirements|\bBABOK|\bIREB|\bBCS\b|use case|uml/i, "analyse"],
  [/leiderschap|leidinggev|teamleider|coaching|delegeren|manager/i, "lead"],
  [/communic|presenteren|samenwerk|time ?management|stress|assertiev|onderhandel|feedback|persoonlijk|omgaan met|soft skill|netwerken met impact/i, "soft"],
  [/python|java\b|javascript|typescript|c#|\.net|php|react|angular|node|programmeren|developer|software engineer|\bAPI\b|html|css|golang|rust\b|swift|kotlin|\bMB-8[12]0|\bPL-400|\bAZ-204/i, "dev"],
  [/\bweb(site|ontwikkel|design)|wordpress|frontend|front-end/i, "web"],
  [/windows server|active directory|powershell|system center|sccm|virtualisatie|vmware|hyper-v|systeembeheer|beheerder|administrator|\bAZ-104|\bMD-\d/i, "admin"],
  [/basis|beginner|introductie|fundamentals|starter|instap|omscholing|zij-?instroom/i, "basis"],
];

function tagsVoor(naam, tekst) {
  const bron = naam + " " + (tekst || "").slice(0, 300), t = [];
  for (const [re, tag] of TAGS) if (re.test(naam) || (!t.length && re.test(bron))) { if (!t.includes(tag)) t.push(tag); }
  return t.slice(0, 3);
}

const dec = s => s.replace(/&amp;/g, "&").replace(/&#8211;|&ndash;/g, "–").replace(/&#8217;|&rsquo;/g, "’").replace(/&#8220;|&#8221;/g, '"').replace(/&#039;|&#8216;/g, "'").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&euml;/g, "ë").replace(/&eacute;/g, "é").replace(/&#038;/g, "&").replace(/\s+/g, " ").trim();

function naamUitPagina(html) {
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  if (h1) { const n = dec(h1.replace(/<[^>]+>/g, " ")); if (n) return n; }
  const ti = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
  return ti ? dec(ti.replace(/\s*[|\-–]\s*Startel.*$/i, "")) : "";
}

// slugs van alle trainingen op startel.nl
async function slugsVanSitemap(fetchText) {
  const xml = await fetchText(SITEMAP);
  const out = [...xml.matchAll(/<loc>\s*https?:\/\/(?:www\.)?startel\.nl\/trainingen\/([^\/<\s]+)\/?\s*<\/loc>/gi)].map(m => m[1]);
  return [...new Set(out)];
}

// vergelijkt met de bekende slugs en leest alleen de ontbrekende pagina's; bestaande uitbreidingen (extra) blijven staan
async function ontdek({ bekend, extra = [], fetchText, log = () => {}, pauze = 150, max = 700 }) {
  const slugs = await slugsVanSitemap(fetchText);
  if (slugs.length < 100) throw new Error("sitemap gaf maar " + slugs.length + " trainingen");
  const hebben = new Set([...bekend, ...extra.map(x => x.slug)]);
  const nieuw = slugs.filter(s => !hebben.has(s)).slice(0, max);
  const lijst = extra.filter(x => slugs.includes(x.slug));   // verdwenen van de site = ook uit Byte
  let k = 0, overgeslagen = 0, mislukt = 0;
  const worker = async () => {
    while (k < nieuw.length) {
      const slug = nieuw[k++];
      try {
        const html = await fetchText("https://startel.nl/trainingen/" + slug + "/");
        const p = parseTraining(html), naam = naamUitPagina(html);
        if (!naam || p.fmt === "x" || SKIP.test(naam)) { overgeslagen++; lijst.push({ slug, skip: true }); }
        else lijst.push({ name: naam, slug, tags: tagsVoor(naam, p.intro || p.meta), lvl: p.lvl || "I", days: p.days || "", fmt: p.fmt === "z" ? "z" : "k" });
      } catch (e) { mislukt++; log(`Uitbreiding: ${slug} mislukt: ${e.message}`); }
      await new Promise(r => setTimeout(r, pauze));
    }
  };
  await Promise.all([1, 2, 3].map(worker));
  log(`Uitbreiding: ${slugs.length} op startel.nl, ${nieuw.length} nieuw gelezen (${overgeslagen} overgeslagen, ${mislukt} mislukt)`);
  return { items: lijst, opSite: slugs.length, nieuw: nieuw.length, mislukt };
}

module.exports = { ontdek, tagsVoor, slugsVanSitemap, naamUitPagina };
