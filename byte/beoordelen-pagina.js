// De pagina waarop sales de simulaties beoordeelt: één gesprek tegelijk, uitkomst eerst.
const { kader, kop1 } = require("./beheer-kader.js");
const { RATERS } = require("./beoordelen.js");
const CSS = `
#wie{position:fixed;inset:0;z-index:50;background:rgba(0,38,96,.55);display:flex;align-items:center;justify-content:center;padding:20px}#wie[hidden]{display:none}
#wie .doos{background:var(--surface);border-radius:20px;padding:26px 28px;max-width:460px;width:100%}#wie h2{margin:0 0 6px}#wie .rij{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}#wie .rij button{padding:10px 20px}
.bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:6px 0 14px}.bar .nav{display:flex;gap:6px;align-items:center}.bar .nav button{width:38px;height:38px;padding:0;border-radius:50%;background:var(--surface);color:var(--ink);border:1.5px solid var(--line);font-size:1.1rem}.bar .nav button:hover{border-color:var(--orange);color:var(--orange);background:var(--surface)}
.chip{padding:6px 14px;border-radius:48px;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);font-size:.88rem;font-weight:500;cursor:pointer}.chip:hover{border-color:var(--orange)}
.voortgang{height:8px;border-radius:8px;background:var(--line);overflow:hidden;flex:1;min-width:140px}.voortgang i{display:block;height:100%;background:var(--orange)}
.rasters{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:16px;align-items:start}@media (max-width:860px){.rasters{grid-template-columns:1fr}}
.top3{display:grid;gap:8px;margin:10px 0 4px}.top3 div{display:flex;gap:10px;align-items:center;padding:10px 14px;border:1.5px solid var(--line);border-radius:14px;background:var(--surface);font-weight:500}.top3 div:first-child{border-color:var(--navy);background:var(--soft)}.top3 b{display:inline-flex;width:26px;height:26px;border-radius:50%;background:var(--navy);color:var(--surface);align-items:center;justify-content:center;font-size:.85rem;flex:none}
.keuze{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 6px}.keuze button{padding:11px 22px}.keuze .ja{background:#1D6B35}.keuze .ja:hover{background:#17562b}.keuze .nee{background:var(--surface);color:#9B2A1C;border:1.5px solid #9B2A1C}.keuze .nee:hover{background:#FDE0DC}
.pillen{display:flex;gap:6px;flex-wrap:wrap}.pil{padding:5px 13px;border-radius:48px;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);font-size:.84rem}.pil:hover{border-color:var(--orange);color:var(--orange);background:var(--surface)}
#anders{margin-top:12px;display:grid;gap:8px}#anders[hidden]{display:none}#anders textarea{min-height:84px}
.diff{border:1.5px solid var(--line);border-radius:14px;padding:12px 14px;background:var(--surface);font-size:.92rem}.diff .r{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}.diff .t{padding:2px 10px;border-radius:48px;background:var(--soft)}.diff .t.g{background:#DFF3E4;color:#1D6B35}.diff .t.x{background:#FDE0DC;color:#9B2A1C}.diff .t.n{background:#FFF0C9;color:#7A5A00}
.vorig{margin:10px 0;padding:8px 12px;border-radius:12px;background:var(--soft);font-size:.88rem}
.slot{display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:22px;padding:16px 20px;border:1.5px solid var(--line);border-radius:16px;background:var(--surface)}.slot.vrij{border-color:var(--orange);background:var(--soft)}.slot .uit{background:var(--line);color:var(--muted);pointer-events:none}
.msgv{font-size:.78rem;color:var(--muted);margin:0 6px}.chat .msg{font-size:.95rem}
details.wie summary{cursor:pointer;font-weight:500;padding:6px 0}`;
const JS = `(()=>{
const RATERS=__RATERS__, BM=__BM__, RUN=__RUN__;
let D=null,i=0,wie=null,wacht=false;
const $=s=>document.querySelector(s), esc=t=>String(t==null?"":t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
const nm=t=>String(t||"").toLowerCase().replace(/\\s*\\(.*$/,"").trim();
async function laad(){try{const r=await (await fetch("/admin/beoordelen?json=1"+(RUN?"&run="+encodeURIComponent(RUN):""))).json(); const had=D&&D.rijen?D.rijen.length:0; D=r; if(!had&&r.rijen&&r.rijen.length){i=eerstOpen();toon();} else if(wacht){const v=volgende(i);if(v>=0&&v!==i||(v===i&&!D.rijen[i].fb)){wacht=false;i=v;toon();}} kop();}catch(e){} if(!D||(!D.klaar&&!D.geen))setTimeout(laad,4000);}
function eerstOpen(){const k=D.rijen.findIndex(r=>!r.fb);return k<0?0:k;}
function volgende(van){const n=D.rijen.length;for(let k=1;k<=n;k++){const j=(van+k)%n;if(!D.rijen[j].fb)return j;}return -1;}
function kop(){
 if(!D)return; if(D.geen){$("#kop").innerHTML="";$("#kaart").innerHTML='<p class="klein">Er is nog geen nieuwe simulatie gedraaid.</p>';D.klaar=true;D.rijen=[];D.perWie=D.perWie||{};slot(0);overzicht();return;}
 const n=D.rijen.length,b=D.rijen.filter(r=>r.fb).length,open=D.totaal-b;
 $("#kop").innerHTML='<div class="bar"><div class="nav"><button id="vo" aria-label="Vorige">&lsaquo;</button><b>Gesprek '+(n?i+1:0)+' van '+D.totaal+'</b><button id="vol" aria-label="Volgende">&rsaquo;</button></div><div class="voortgang"><i style="width:'+Math.round(100*b/Math.max(D.totaal,1))+'%"></i></div><span class="klein">'+b+' beoordeeld &middot; '+open+' nog open'+(D.klaar?"":" &middot; simulatie bezig ("+n+"/"+D.totaal+")")+'</span><button class="chip" id="wiechip">Beoordelaar: '+esc(wie||"kies")+' &#9662;</button></div>';
 $("#vo").onclick=()=>{if(n){i=(i+n-1)%n;toon();kop();}}; $("#vol").onclick=()=>{if(n){i=(i+1)%n;toon();kop();}}; $("#wiechip").onclick=kies;
 slot(open); overzicht();
}
function slot(open){
 const el=$("#slot"); if(!el)return;
 if(!D.klaar){el.className="slot";el.innerHTML='<div><b>Nieuwe simulatie nog niet mogelijk</b><div class="klein">De huidige simulatie is nog bezig.</div></div><a class="knop uit">Start nieuwe run</a>';return;}
 if(open>0){el.className="slot";el.innerHTML='<div><b>Nieuwe simulatie nog niet mogelijk</b><div class="klein">Beoordeel eerst de '+open+' gesprekken die nog open staan.</div></div><a class="knop uit">Start nieuwe run</a>';return;}
 el.className="slot vrij";el.innerHTML='<div><b>Alles is beoordeeld</b><div class="klein">Nieuwe gesprekken zijn altijd anders dan alle eerdere.</div></div><div><select id="aantal"><option>20</option><option selected>30</option><option>50</option><option>80</option></select> <a class="knop" id="nieuw" href="#">Start nieuwe run</a></div>';
 $("#nieuw").onclick=e=>{e.preventDefault();location.href="/admin/simulatie?start=1&n="+$("#aantal").value;};
}
function overzicht(){
 const per=D.perWie||{}, rijen=RATERS.map(w=>{const p=per[w]||{n:0,run:0,ok:0};return '<tr><td><b>'+esc(w)+'</b></td><td>'+p.run+'</td><td>'+p.n+'</td><td>'+(p.n?Math.round(100*p.ok/p.n)+'%':'-')+'</td></tr>';}).join("");
 const eigen=wie?D.rijen.filter(r=>r.fb&&r.fb.wie===wie):[];
 $("#overzicht").innerHTML='<h2>Wie beoordeelde wat</h2><div class="kaart sc"><table><thead><tr><th>Beoordelaar</th><th>In deze run</th><th>Totaal</th><th>Vond Byte goed</th></tr></thead><tbody>'+rijen+'</tbody></table></div>'+(wie?'<details class="wie"><summary>Mijn beoordelingen in deze run ('+eigen.length+')</summary>'+eigen.map(r=>'<p class="klein" style="margin:4px 0"><b>'+esc(r.tekst)+'</b><br>'+(r.fb.oordeel==="ok"?"Klopt":"Anders: "+esc((r.fb.bedoeld||[]).join(" / ")||r.fb.oordeel))+(r.fb.toelichting?" &mdash; "+esc(r.fb.toelichting):"")+'</p>').join("")+'</details>':"");
}
function kies(){const o=$("#wie");o.hidden=false;$("#wierij").innerHTML=RATERS.map(w=>'<button type="button" data-w="'+esc(w)+'">'+esc(w)+'</button>').join("");}
document.addEventListener("click",e=>{const b=e.target.closest("#wierij button");if(b){wie=b.dataset.w;$("#wie").hidden=true;kop();if(D&&D.rijen&&D.rijen.length)toon();}});
function toon(){
 const r=D.rijen[i]; if(!r){$("#kaart").innerHTML=D.klaar?'<p class="klein">Geen gesprekken in deze run.</p>':'<p class="klein">De eerste gesprekken worden gespeeld, dit duurt even.</p>';return;}
 const chat=r.gesprek.map(m=>'<div class="msg '+(m.r==="v"?"v":"bt")+'">'+esc(m.t)+'</div>').join("");
 const top=r.top.length?'<div class="top3">'+r.top.map((t,k)=>'<div><b>'+(k+1)+'</b><span>'+esc(t)+'</span></div>').join("")+'</div>':'<p class="klein" style="margin:8px 0">Byte toonde geen training.</p>';
 const vorig=r.fb?'<div class="vorig">Al beoordeeld door <b>'+esc(r.fb.wie||"onbekend")+'</b>: '+(r.fb.oordeel==="ok"?"klopt":r.fb.oordeel==="anders"?"anders: "+esc((r.fb.bedoeld||[]).join(" / ")):esc(r.fb.oordeel))+(r.fb.toelichting?" &mdash; "+esc(r.fb.toelichting):"")+'. Je kunt het hieronder aanpassen.</div>':"";
 $("#kaart").innerHTML='<div class="rasters"><div class="kaart pad"><h3>Byte kwam uit op</h3>'+top+'<p class="klein" style="margin:4px 0 0">'+esc(r.uitleg)+'</p>'+vorig+
 '<h3 style="margin-top:18px">Klopt dit?</h3><div class="keuze"><button type="button" class="ja" id="klopt"'+(r.top.length?"":" disabled")+'>&#10003; Klopt, #1 is goed</button><button type="button" class="nee" id="anders-knop">&#10005; Anders</button></div><div class="pillen"><button type="button" class="pil" data-o="navragen">Eerst navragen</button><button type="button" class="pil" data-o="geen">Geen aanbod</button><button type="button" class="pil" data-o="incompany">Incompany of maatwerk</button></div>'+
 '<div id="anders" hidden><h3>Wat had het moeten zijn?</h3><input type="text" class="ac b1" autocomplete="off" placeholder="1e keuze (de beste)"><input type="text" class="ac b2" autocomplete="off" placeholder="2e keuze (optioneel)"><input type="text" class="ac b3" autocomplete="off" placeholder="3e keuze (optioneel)"><div id="diff"></div><div class="tags">'+Object.keys(BM).map(k=>'<label class="tag"><input type="checkbox" name="beter" value="'+k+'"> '+esc(BM[k])+'</label>').join("")+'</div><label for="toel"><b>Schrijf uit wat Byte beter had kunnen doen</b></label><textarea id="toel" placeholder="Bijvoorbeeld: bij 15 collega\\'s had Byte incompany moeten aanraden"></textarea><div><button type="button" id="opslaan">Opslaan en volgende &rsaquo;</button></div></div></div>'+
 '<div class="kaart pad"><h3>Het gesprek</h3><div class="chat">'+chat+'</div></div></div>';
 $("#klopt").onclick=()=>stuur("ok");
 $("#anders-knop").onclick=()=>{const a=$("#anders");a.hidden=!a.hidden;if(!a.hidden)a.querySelector(".b1").focus();diff();};
 document.querySelectorAll(".pil").forEach(p=>p.onclick=()=>stuur(p.dataset.o));
 $("#opslaan").onclick=()=>stuur("anders");
 ["b1","b2","b3"].forEach(c=>$("#anders ."+c).addEventListener("input",diff)); document.querySelectorAll("#anders .ac").forEach(x=>x.addEventListener("change",diff));
}
function diff(){
 const r=D.rijen[i],mijn=["b1","b2","b3"].map(c=>$("#anders ."+c).value.trim()).filter(Boolean),el=$("#diff"); if(!el)return;
 if(!mijn.length){el.innerHTML="";return;}
 const byte=r.top.map(nm),m=mijn.map(nm);
 el.innerHTML='<div class="diff"><b>Wat is er anders?</b><div class="klein">Byte</div><div class="r">'+(r.top.length?r.top.map((t,k)=>'<span class="t '+(m.includes(nm(t))?"g":"x")+'">'+(k+1)+'. '+esc(t)+'</span>').join(""):'<span class="klein">niets getoond</span>')+'</div><div class="klein" style="margin-top:6px">Jij</div><div class="r">'+mijn.map((t,k)=>'<span class="t '+(byte.includes(nm(t))?"g":"n")+'">'+(k+1)+'. '+esc(t)+'</span>').join("")+'</div><div class="klein" style="margin-top:6px">Groen: staat bij allebei. Rood: Byte toonde het, jij niet. Geel: jij wilde het, Byte toonde het niet.</div></div>';
}
async function stuur(oordeel){
 if(!wie){kies();return;} const r=D.rijen[i]; const d=new URLSearchParams({tekst:r.tekst,oordeel,top0:r.top[0]||"",run:D.run,wie}); let b=[];
 const tg=[...document.querySelectorAll("#anders input[name=beter]:checked")].map(x=>x.value), tl=($("#toel")||{value:""}).value.trim();
 if(oordeel==="anders"){b=["b1","b2","b3"].map(c=>$("#anders ."+c).value.trim()).filter(Boolean); if(!b.length&&!tg.length&&!tl){$("#anders .b1").focus();return;} b.forEach((x,k)=>d.set("b"+(k+1),x)); tg.forEach(x=>d.append("beter",x)); if(tl)d.set("toelichting",tl);}
 else if(oordeel!=="ok"){ if(tl)d.set("toelichting",tl); }
 if(oordeel==="ok"&&!r.top.length)return;
 const res=await fetch("/admin/simfeedback",{method:"POST",body:d,redirect:"manual"});
 r.fb={wie,oordeel,bedoeld:oordeel==="ok"?[r.top[0]]:b,beter:tg,toelichting:tl}; const p=D.perWie[wie]||(D.perWie[wie]={n:0,run:0,ok:0}); p.n++;p.run++; if(oordeel==="ok")p.ok++;
 const v=volgende(i); if(v<0){kop();toon();$("#kaart").insertAdjacentHTML("afterbegin",D.klaar?'<div class="vorig"><b>Alles is beoordeeld.</b> Bedankt!</div>':'<div class="vorig"><b>Wacht even</b>, de volgende gesprekken worden nog gespeeld. Je gaat vanzelf verder zodra er een klaar is.</div>');wacht=!D.klaar;return;} i=v; toon(); kop();
}
$("#wie").hidden=false; kies(); laad();
})();`;
function pagina(namen, run, BETERMAP) {
  return kader({ titel: "Beoordelen", actief: "/admin/beoordelen", namen, inhoud: kop1("Beoordelen") + `<style>${CSS}</style>
<p class="intro">Eén gesprek tegelijk: wat Byte adviseerde, het gesprek ernaast, en jij zegt in één tik of het klopt. De stap erna is vaak even belangrijk als het advies zelf, dus schrijf het gerust uit als Byte iets beter had kunnen doen.</p>
<div id="wie"><div class="doos"><h2>Wie beoordeelt er nu?</h2><div class="klein">Je keuze wordt bij elke beoordeling opgeslagen, zodat we later kunnen zien wie wat vond.</div><div class="rij" id="wierij"></div></div></div>
<div id="kop"></div><div id="kaart"><p class="klein">Laden&hellip;</p></div><div id="slot" class="slot"></div><div id="overzicht"></div><p class="klein" style="margin-top:28px">Voor het team dat Byte verbetert: <a href="/admin/simulatie">vaste testset</a> (de vaste ruim 110 gevallen, om te controleren dat verbeteringen niets stukmaken).</p>
<script>${JS.replace("__RATERS__", JSON.stringify(RATERS)).replace("__BM__", JSON.stringify(BETERMAP)).replace("__RUN__", JSON.stringify(run || ""))}</script>` });
}
module.exports = { pagina };
