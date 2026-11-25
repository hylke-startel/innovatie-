// Voorbeeldzinnen per antwoordknop. Het taalmodel vergelijkt een getypt antwoord met deze zinnen.
// Labels moeten exact gelijk zijn aan de knoppen in public/index.html.
module.exports = {
  voor: {
    "Voor mezelf": ["voor mezelf", "ik wil zelf iets leren", "het is voor mij", "ik zoek een cursus voor mezelf", "gewoon voor mij"],
    "Voor een collega": ["voor een collega", "voor een medewerker van mij", "een collega moet bijgeschoold worden", "voor iemand anders", "voor mijn stagiair", "voor een nieuwe medewerker"],
    "Voor een heel team": ["voor mijn team", "voor de hele afdeling", "we willen met een groep collega's", "voor meerdere medewerkers", "voor ons bedrijf", "voor tien collega's"]
  },
  rol: {
    "Systeem- of netwerkbeheerder": ["ik ben systeembeheerder", "ik beheer servers en het netwerk", "ik doe het IT-beheer", "ik werk als netwerkbeheerder", "ICT-beheer", "ik ben ICT-medewerker", "ik ben applicatiebeheerder", "ik regel de IT bij ons op kantoor", "functioneel beheerder"],
    "Helpdesk / servicedesk": ["ik werk op de helpdesk", "ik zit op de servicedesk", "ik help gebruikers met IT-problemen", "IT-support", "klantenservice voor IT-vragen", "ik beantwoord IT-vragen van collega's", "eerstelijns support"],
    "Developer / programmeur": ["ik ben developer", "ik programmeer", "ik bouw software", "ik ben softwareontwikkelaar", "ik schrijf code", "ik bouw websites"],
    "Data / BI / analist": ["ik ben data-analist", "ik werk met data en rapportages", "BI-specialist", "ik maak dashboards en analyses", "ik maak rapportages in Power BI"],
    "Security-specialist": ["ik werk in cybersecurity", "ik ben security officer", "ik ben verantwoordelijk voor informatiebeveiliging", "ik werk in een SOC", "CISO", "security manager", "ik ben verantwoordelijk voor de beveiliging van onze systemen"],
    "Tester / QA": ["ik ben tester", "ik test software", "ik werk in kwaliteitsborging", "testanalist"],
    "Project- of procesmanager": ["ik ben projectleider", "ik ben projectmanager", "ik verbeter processen", "ik ben scrum master", "ik leid projecten", "ik coördineer projecten"],
    "Leidinggevende / directie": ["ik ben manager", "ik ben teamleider", "ik geef leiding", "ik zit in de directie", "ik ben eigenaar van het bedrijf", "ik ben leidinggevende", "ik run een bedrijf"],
    "Kantoor- of beleidsmedewerker": ["ik werk op kantoor", "ik ben beleidsmedewerker", "ik doe administratief werk", "ik ben secretaresse", "ik werk bij de gemeente op kantoor", "ik ben HR-medewerker", "ik ben adviseur", "ik werk in de financiële administratie"],
    "Marketing, sales of communicatie": ["ik werk in marketing", "ik ben marketeer", "ik werk in sales", "ik ben accountmanager", "ik verkoop onze producten", "ik ben salesmanager", "ik werk bij communicatie", "ik maak content en social media posts", "ik doe online marketing en SEO", "ik werk op de verkoop binnendienst", "ik ben communicatieadviseur", "business developer"],
    "Nieuw in IT / overstapper": ["ik ben nieuw in de IT", "ik wil omscholen naar IT", "ik heb nog geen IT-baan", "ik zoek werk in de IT", "ik ben werkzoekende", "carrièreswitch", "ik ben net afgestudeerd"]
  },
  niveau: {
    "Nog geen": ["ze weten er weinig van", "weinig ervaring", "nog geen ervaring", "ik heb er nooit mee gewerkt", "helemaal nieuw", "ik ben beginner", "nul", "ik ben er net mee begonnen"],
    "Basiskennis": ["een beetje", "basiskennis", "ik weet de basis", "ik heb er wel eens mee gewerkt", "redelijk", "ik weet er een beetje van", "matig", "ik ken de basics"],
    "Gevorderd, dagelijks mee bezig": ["ik werk er dagelijks mee", "gevorderd", "veel ervaring", "ik ken het goed", "een paar jaar ervaring", "ik heb er een paar jaar mee gewerkt"],
    "Expert, ik wil me specialiseren": ["expert", "ik wil me specialiseren", "ik weet er al heel veel van", "ik zoek verdieping op hoog niveau", "senior", "ik doe dit al jaren", "ik werk al meer dan tien jaar in dit vak"]
  },
  doel: {
    "Een erkend certificaat halen": ["een certificaat halen", "examen doen", "ik wil gecertificeerd worden", "een diploma", "officiële certificering", "een papiertje halen", "een erkend bewijs"],
    "Iets direct toepassen in mijn werk": ["direct toepassen in mijn werk", "praktisch aan de slag", "efficiënter werken", "ik wil het morgen kunnen gebruiken", "beter worden in mijn werk", "sneller werken"],
    "Overstappen naar een IT-baan": ["een baan in de IT vinden", "overstappen naar IT", "van werk veranderen", "carrière in IT", "omscholing", "ik wil een andere baan", "ik zoek nieuw werk"],
    "Mijn team slimmer laten werken met AI": ["mijn team met AI laten werken", "AI invoeren in onze organisatie", "collega's leren werken met ChatGPT of Copilot", "slimmer werken met AI als team"],
    "Persoonlijk groeien": ["persoonlijke ontwikkeling", "beter communiceren", "groeien als persoon", "leiderschap ontwikkelen", "zelfvertrouwen", "promotie maken", "doorgroeien in mijn functie"]
  },
  vorm: {
    "Klassikaal op locatie": ["klassikaal", "op locatie", "in een lokaal met andere cursisten", "naar Drachten komen", "fysiek in een klas", "met een trainer in de klas"],
    "Virtueel, live met een trainer": ["online", "virtueel", "vanuit huis met een trainer", "via Teams", "op afstand", "via zoom"],
    "Zelfstudie in mijn eigen tempo": ["zelfstudie", "e-learning", "in mijn eigen tempo", "wanneer het mij uitkomt", "'s avonds zelf leren", "in mijn eigen tijd"],
    "Incompany voor onze organisatie": ["incompany", "bij ons op kantoor", "een training op maat voor ons bedrijf", "voor onze organisatie op locatie", "kan de trainer bij ons komen", "een training bij ons in het bedrijf"],
    "Geen voorkeur": ["maakt niet uit", "geen voorkeur", "weet ik niet", "allebei prima"]
  },
  tijd: {
    "1 dag": ["één dag", "een dag", "kort", "niet te lang", "een halve dag", "zo kort mogelijk", "een middag"],
    "2 tot 3 dagen": ["twee of drie dagen", "een paar dagen", "2 dagen", "3 dagen"],
    "Een hele week": ["een week", "vijf dagen", "een hele week", "intensief"],
    "Flexibel, verspreid over weken": ["flexibel", "verspreid over een paar weken", "naast mijn werk", "'s avonds", "geen haast"]
  }
};
