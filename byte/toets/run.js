// Draait de toetsset tegen de echte poortwachter. Nodig: ANTHROPIC_API_KEY (zoals in Railway).
//   ANTHROPIC_API_KEY=sk-... node toets/run.js        (of: npm run toets)
const ai = require("../ai.js"), gevallen = require("./gevallen.js");
const NAAM = { l: "leerwens", s: "vraag_over_startel", o: "opdracht", b: "buiten_onderwerp", m: "misbruik" };
(async () => {
  if (!ai.aan()) { console.error("Zet ANTHROPIC_API_KEY om de toets te draaien."); process.exit(2); }
  let fout = 0; const rijen = [];
  for (let i = 0; i < gevallen.length; i += 6) {
    const groep = gevallen.slice(i, i + 6);
    await Promise.all(groep.map(async ([tekst, w]) => {
      try { const o = await ai._intern.poort(tekst, ""); const ok = o.soort === NAAM[w]; if (!ok) fout++; rijen.push([ok, tekst, NAAM[w], o.soort]); }
      catch (e) { fout++; rijen.push([false, tekst, NAAM[w], "fout: " + e.message]); }
    }));
  }
  rijen.sort((a, b) => a[0] - b[0]).forEach(([ok, t, w, g]) => console.log(`${ok ? "ok   " : "FOUT "} "${t}"  verwacht: ${w}${ok ? "" : "  kreeg: " + g}`));
  console.log(`\n${gevallen.length - fout} van ${gevallen.length} goed`);
  process.exit(fout ? 1 : 0);
})();
