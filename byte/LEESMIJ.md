# Byte: trainingsadviseur van Startel

Byte voert een adviesgesprek met knoppen en open vragen en adviseert trainingen uit het aanbod van startel.nl.
Getypte zinnen worden begrepen door een klein meertalig taalmodel dat op de eigen server draait.
Er gaat niets naar Claude, OpenAI of een andere externe AI-dienst, en er zijn geen kosten per gesprek.

## Hoe het werkt

- `public/index.html`: de chatbot (Byte)
- `server.js`: webserver met drie taken
  1. de chatbot serveren
  2. bij het opstarten en daarna elke 24 uur de trainingspagina's van startel.nl uitlezen (prijs, niveau, duur, omschrijving)
  3. getypte zinnen koppelen aan trainingen met het taalmodel `Xenova/multilingual-e5-small`
- `catalog.js`: de vaste lijst trainingen met thema's (195 kerntrainingen)
- `intents.js`: voorbeeldzinnen per antwoordknop, zodat Byte getypte antwoorden op zijn vragen herkent. Herkent Byte iets vaak niet, voeg dan hier een voorbeeldzin toe.
- `scrape.js`: leest een trainingspagina van startel.nl uit

Werkt het taalmodel of het uitlezen van startel.nl tijdelijk niet, dan blijft Byte gewoon werken op trefwoorden en de vaste lijst.

## Uitrollen op Railway

1. Zet deze map in een (privé) GitHub-repository.
2. Railway: **New Project → Deploy from GitHub repo** en kies de repository.
3. Na het uitrollen: **Settings → Networking → Generate Domain**.
4. Aanrader: **Add Volume** met mount path `/app/data`. Dan bewaart Railway het model (ca. 120 MB) en de catalogus tussen deploys, zodat Byte na een update direct klaar is.

De eerste start duurt 1 à 2 minuten: het model wordt gedownload en alle trainingen worden ingelezen.
Status bekijken: `https://<jouw-domein>/api/status` (model `klaar` en `indexed: true` betekent dat alles draait).

## Geheugen en kosten

De server gebruikt ongeveer 400 tot 600 MB geheugen. Dat past binnen het Hobby-plan van Railway.
Er zijn geen kosten per gesprek.

## Trainingen toevoegen

Voeg een regel toe aan `RAW` in `catalog.js`: `naam | slug | thema-tags | niveau | dagen | vorm`.
De slug is het laatste deel van de URL op startel.nl, bijvoorbeeld `microsoft-excel-basis`.
Prijs, niveau en omschrijving haalt de server zelf op.

De site staat op noindex, zodat zoekmachines de testversie niet oppikken.

## Proef: open vragen via AI

Met `?ai=1` achter de link (één keer, daarna onthoudt de browser het; `?ai=0` zet het weer uit) beantwoordt Byte getypte vragen in de adviesfase met Claude Haiku. De klikvragen en knoppen werken zoals altijd.

Instellen in Railway → Variables:
- `ANTHROPIC_API_KEY`: de API-sleutel uit de Claude Console (verplicht)
- `BYTE_AI_MODEL`: standaard `claude-haiku-5-5`
- `BYTE_AI_DAG_MAX`: maximaal aantal AI-antwoorden per dag voor iedereen samen (standaard 300)
- `BYTE_AI=uit`: zet de AI in één keer uit

De grenzen staan in `ai.js`: alleen trainingsadvies, alleen trainingen uit een vooraf gekozen lijst van 15 (de server controleert elke gekozen training), geen prijzen of data uit de AI-tekst, limieten per gesprek, per bezoeker en per dag. Lukt de AI niet, dan valt Byte terug op zijn eigen werkwijze.

## Byte v2 (proef, `?v=2`): gesprek, bewegende Byte en grenzen

- **Byte beweegt**: één SVG met losse onderdelen (lijf, ogen, mond, armen, benen, laptop). De toestand staat in `data-st`: rust, zwaai, denk, typ, juich, blij, meeleef. Bij "minder beweging" staat hij stil.
- **Gesprek**: tekst verschijnt woord voor woord; een getypt bericht gaat altijd eerst langs de AI.
- **Grenzen** (zie de kop van `ai.js`): poortwachter vóór elk getypt bericht, vaste weigerteksten (nooit door de AI geschreven), controle van elk AI-antwoord vóór het tonen, en het gesprek wordt op de server bewaard (de browser stuurt alleen een sessienummer mee).
- Extra instelling: `BYTE_AI_CHECK_MODEL` (standaard `claude-haiku-5-5`) voor poortwachter en controle.
