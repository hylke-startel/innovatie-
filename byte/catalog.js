// Basiscatalogus van Byte. De server vult prijs, niveau, duur en omschrijving aan met actuele gegevens van startel.nl.
// Regel: naam | slug | thema-tags | niveau (B/I/A) | dagen | vorm (k = klassikaal/virtueel, z = zelfstudie)
const RAW = `AI voor beginners|ai-voor-beginners|ai,office|B|1|k
AI foar begjinners (Friestalig)|ai-foar-begjinners|ai,office|B||k
Work smarter with AI (AI-3025)|work-smarter-with-ai-ai-3025|ai,m365|B|1|k
Microsoft Copilot in 1 dag|copilot-in-een-dag|ai,m365,office|B|1|k
ChatGPT in 1 dag|chatgpt-in-1-dag|ai,office|B|1|k
ChatGPT Advanced in 1 dag|chatgpt-advanced-in-1-dag|ai|I||k
Gemini in 1 dag|gemini-in-1-dag|ai,office|B||k
AI Fundamentals|ai-fundamentals|ai|I|3|k
AI Verdieping voor Professionals|ai-verdieping-voor-professionals|ai|I||k
AI Verdieping + Technische Skills in de Praktijk|ai-verdieping-technische-skills-in-de-praktijk|ai,dev|I||k
AI voor Directie|ai-voor-directie|ai,lead|B||k
AI voor CEO's|ai-voor-ceos|ai,lead|B||k
AI voor developers|ai-voor-developers|ai,dev|I||k
AI Development met Python & OpenAI API|ai-development-met-python-openai-api|ai,dev|I||k
Advanced AI Engineering voor Developers|advanced-ai-engineering-voor-developers|ai,dev|A||k
Vibe Coding voor beginners|vibe-coding-voor-beginners|ai,dev|B||k
Vibe Coding met Claude|vibe-coding-met-claude|ai,dev|B||k
N8N voor AI enthusiasts|n8n-voor-ai-enthusiasts|ai,auto|I||k
AI Agents & Automation met Microsoft Power Platform|ai-agents-automation-met-microsoft-power-platform|ai,m365,auto|I||k
Video's maken met AI|videos-maken-met-ai|ai,office|B||k
Large Language Models (LLM)|large-language-models-llm|ai,dev|A||k
AI Compliance & EU AI Act Professional|ai-compliance-eu-ai-act-professional|ai,sec,gov|I||k
Communicatiekracht in een wereld vol AI|communicatiekracht-in-een-wereld-vol-ai|soft,ai|B||k
Introduction to AI in Azure (AI-901)|introduction-to-ai-in-azure-ai-901|ai,azure|B||k
Develop AI apps and agents on Azure (AI-103)|develop-ai-apps-and-agents-on-azure-ai-103|ai,azure,dev|I||k
Create and extend custom copilots in Copilot Studio (PL-7008)|create-and-extend-custom-copilots-in-microsoft-copilot-studio-pl-7008|ai,m365,auto|I||k
Transform business workflows with generative AI (AB-730)|transform-business-workflows-with-generative-ai-ab-730|ai,m365|B||k
Drive AI transformation in your organization (AB-731)|drive-ai-transformation-in-your-organization-ab-731|ai,lead|I||k
Architecting agentic AI business solutions (AB-100)|architecting-agentic-ai-business-solutions-ab-100|ai,m365|A||k
GitHub Copilot (GH-300)|github-copilot-gh-300|ai,dev|I||k
Microsoft Copilot Essentials (MS-4004 en MS-4018)|microsoft-copilot-essentials-combinatie-ms-4004-en-ms-4018|ai,m365,office|B||k
AI-vaardigheden voor beginners E-Learning (Nederlands)|ai-vaardigheden-voor-werknemers-e-learning-nederlands|ai,office|B||z
AI Brevet (NLAIC) E-Learning|ai-brevet-nlaic-e-learning|ai|B||z
Prompt Engineering E-Learning|prompt-engineering-zelfstudiepakket|ai|B||z
Introduction to Microsoft 365 and AI administration (AB-900)|introduction-to-microsoft-365-and-ai-administration-ab-900|m365,admin,ai|B|1|k
Microsoft 365 Administrator (MS-102)|microsoft-365-administrator-essentials-ms-102|m365,admin|A|5|k
Microsoft 365 Endpoint Administrator (MD-102)|endpoint-administrator-md-102|m365,admin|I|5|k
Managing Microsoft Teams (MS-700)|managing-microsoft-teams-ms-700|m365,admin|I|4|k
Functioneel Beheer Office 365 (FBO365)|functioneel-beheer-office-365-fbo365|m365,admin,itsm|B|2|k
Haal meer uit Microsoft 365 in één dag|haal-meer-uit-microsoft-365-in-een-dag|m365,office|B||k
Microsoft Teams|microsoft-teams|office|B||k
Basis SharePoint Training|basis-sharepoint-training|office,m365|B||k
Intermediate SharePoint Training|intermediate-sharepoint-training|office,m365|I||k
Microsoft Excel Basis|microsoft-excel-basis|office|B|1|k
Microsoft Excel Gevorderd – Tabellen en Databases|microsoft-excel-gevorderd-tabellen-en-databases|office,data|I|1|k
Microsoft Excel Gevorderd – Formules en Functies|microsoft-excel-gevorderd-formules-en-functies|office,data|I||k
Microsoft Excel Gevorderd – Draaitabellen en analyses|microsoft-excel-gevorderd-externe-koppelingen-draaitabellen-en-analyses|office,data|I||k
Microsoft Word Basis|microsoft-word-basis|office|B||k
Cursus Outlook Basis|cursus-outlook-basis|office|B||k
PowerPoint Basis|cursus-powerpoint-basis|office|B||k
Complete Digitale Basisvaardigheden|complete-digitale-basisvaardigheden|office,basis|B||k
Basisvaardigheden voor Windows en Internet|basisvaardigheden-voor-windows-en-internet|office,basis|B||k
Microsoft Project|microsoft-project|office,pm|B||k
Notuleren, professioneel en efficiënt|notuleren-professioneel-en-efficient|office,soft|B||k
Power Automate introductie|power-automate-introductie|m365,auto|B||k
Power Apps introductie|power-apps-introductie|m365,auto|B||k
Introduction to Microsoft Power Platform (PL-900)|microsoft-power-platform-fundamentals-pl-900|m365,auto|B||k
Microsoft Power Platform Developer (PL-400)|microsoft-power-platform-developer-pl-400|m365,auto,dev|A||k
Automating Administration with PowerShell (AZ-040)|automating-administration-with-powershell-az-040|admin,azure|I||k
Microsoft Configuration Manager (SCCM/MEM) beheren|administering-system-center-configuration-manager-sccm|admin|I||k
AZ-900 Microsoft Azure Fundamentals|microsoft-azure-fundamentals-az-900|azure,cloud|B|1|k
Microsoft Azure Administrator (AZ-104)|microsoft-azure-administrator-az-104|azure,cloud,admin|I|4|k
Design Microsoft Azure Infrastructure Solutions (AZ-305)|designing-microsoft-azure-infrastructure-solutions-az-305|azure,cloud|A||k
Design and Implement Microsoft Azure Network Solutions (AZ-700)|designing-and-implementing-microsoft-azure-networking-solutions-az-700|azure,net|A||k
Windows Server Hybrid Core Infrastructure (AZ-800)|administering-windows-server-hybrid-core-infrastructure-az-800|azure,admin|I||k
Windows Server Hybrid Advanced Services (AZ-801)|configuring-windows-server-hybrid-advanced-services-az-801|azure,admin|A||k
Azure Virtual Desktop (AZ-140)|configuring-and-operating-windows-virtual-desktop-on-microsoft-azure-az-140|azure,admin|I||k
Microsoft DevOps Solutions (AZ-400)|designing-and-implementing-microsoft-devops-solutions-az-400|azure,devops,dev|A||k
AWS Cloud Practitioner Essentials|aws-cloud-practitioner-essentials-cp-ess|cloud|B||k
AWS Technical Essentials|aws-technical-essentials-awse|cloud|B||k
Architecting on AWS|architecting-on-aws-awsa|cloud|I||k
CompTIA Cloud+|comptia-cloud|cloud|I||k
Docker Fundamentals|docker-fundamentals|devops,linux|B||k
Kubernetes Fundamentals|kubernetes-fundamentals|devops,cloud|I||k
Certified Kubernetes Administrator (CKA)|certified-kubernetes-administrator-cka|devops,cloud|A||k
Ansible Fundamentals|ansible-fundamentals|devops,linux|I||k
VMware vSphere: Install, Configure, Manage [V8]|vmware-vsphere-install-configure-manage-v8-vsicm8|admin,cloud|I||k
Microsoft Security, Compliance, and Identity Fundamentals (SC-900)|microsoft-security-compliance-and-identity-fundamentals-sc-900|sec,azure|B|1|k
Microsoft Security Operations Analyst (SC-200)|microsoft-security-operations-analyst-sc-200|sec|I||k
Microsoft Identity and Access Administrator (SC-300)|microsoft-identity-and-access-administrator-sc-300|sec,m365,admin|I||k
Information Security Administrator (SC-401)|information-security-administrator-sc-401|sec,m365|I||k
Microsoft Cybersecurity Architect (SC-100)|microsoft-cybersecurity-architect-sc-100|sec|A||k
EC-Council Certified Ethical Hacker v13 (CEH), incl. examen|certified-ethical-hacker-ceh|sec,hack|I|5|k
Ethical Hacking Workshop (LIVE HACKING)|ethical-hacking-workshop-live-hacking|sec,hack,aware|B||k
CompTIA Security+|comptia-security|sec|I||k
CISSP Examenvoorbereiding|certified-information-systems-security-professional-cissp|sec|I|5|k
Certified Information Systems Security Officer (CISSO)|certified-information-systems-security-officer-cisso|sec|I|5|k
Certified NIS2 Professional (NIS2/CBW)|certified-nis2-professional-cnis2|sec,gov|I||k
Certified BIO Professional examentraining|certified-bio-professional-2-daagse-examentraining-inclusief-examenvoucher|sec,gov|I|2|k
Informatiebeveiliging Foundation (ISFS)|informatiebeveiliging-foundation-isfs|sec,gov|B||k
Certified Security Awareness 1 en 2 Workshop|certified-security-awareness-1-en-2-workshop-csa-1-en-2|sec,aware,office|B||k
Certified DORA Professional (CDORA)|certified-dora-professional-cdora|sec,gov|I||k
Red Team vs Blue Team 1|red-team-vs-blue-team-1|sec,hack|I||k
Certified Network Defender (CND), incl. examen|certified-network-defender-cnd-v2-classroom-examen|sec,net|I||k
Certified AI Cybersecurity Officer (CAICSO)|certified-ai-cybersecurity-officer-caicso|sec,ai|I||k
CompTIA Security+ E-learning + Exam|comptia-security-zelfstudiepakket-examenvoucher|sec|I||z
Design and manage analytics solutions using Power BI (PL-300)|microsoft-power-bi-data-analyst-pl-300|data|I|3|k
Power BI Desktop en Online Basis|power-bi-desktop-en-online-basis|data,office|B||k
Introduction Power BI|introduction-power-bi|data|B||k
Leer écht analyseren met Power BI|leer-echt-analyseren-met-power-bi|data|I||k
Introduction to Microsoft Azure Data (DP-900)|microsoft-azure-data-fundamentals-dp-900|data,azure|B|1|k
Implement analytics solutions using Microsoft Fabric (DP-600)|microsoft-fabric-analytics-engineer-dp-600|data|A||k
Implement data engineering solutions using Microsoft Fabric (DP-700)|microsoft-fabric-data-engineer-dp-700|data|A||k
Querying Data with Microsoft Transact-SQL (DP-080)|querying-data-with-microsoft-transact-sql-dp-080|data,dev|B||k
Basiscursus T-SQL|basiscursus-t-sql|data|B||k
Data Literacy|data-literacy|data,office|B||k
Datavisualisatie & Dashboard design|datavisualisatie-dashboard-design|data|I||k
Data Management Fundamentals (DMBOK2)|data-management|data,gov|I||k
Introduction Python for Data Professionals|introduction-python-for-data-professionals|data,dev|B||k
Dimensioneel modelleren voor Power BI en Fabric|dimensioneel-modelleren-power-bi-fabric|data|A||k
DBT voor Data Engineers|dbt-voor-data-engineers|data|A||k
Data Act|data-act|data,gov|B||k
Power BI (PL-300) Zelfstudiepakket|power-bi-zelfstudiepakket|data|I||z
Microsoft Dynamics 365 Business Central Functional Consultant (MB-800) Zelfstudiepakket|microsoft-dynamics-365-business-central-functional-consultant-mb-800-zelfstudiepakket|m365,analyse|I||z
Introductie in Python|introductie-in-python|dev|B||k
Certified Python Professional (CPP)|certified-python-professional-cpp|dev|I||k
Bootcamp HTML, CSS en JavaScript|bootcamp-html-css-en-javascript|dev,web|B||k
JavaScript Fundamentals|javascript-fundamentals|dev,web|B||k
TypeScript Fundamentals|typescript-fundamentals|dev,web|I||k
React Fundamentals|react-fundamentals-introduction-to-react|dev,web|I||k
Introduction to Angular|introduction-to-angular|dev,web|I||k
C# Fundamentals|c-fundamentals|dev|B||k
ASP.NET Fundamentals|asp-net-fundamentals|dev,web|I||k
Java Basic|java-basic|dev|B||k
Spring Boot Basic|spring-boot-basic|dev|I||k
PHP Fundamentals|php-fundamentals|dev,web|B||k
Git Fundamentals Training|git-fundamentals|dev,devops|B||k
GitHub Foundations (GH-900)|github-foundations-gh-900|dev,devops|B||k
Full-Stack Developer Training|full-stack-developer-training|dev,web|I||k
Full-Stack Essentials voor professionals zonder technische achtergrond|full-stack-essentials-training-voor-professionals-zonder-technische-achtergrond|dev,basis|B||k
API Development|api-development|dev|I||k
Design Patterns in Java, C# en C++|design-patterns-in-java-c-en-c|dev|A||k
Ontwikkeling en beheer met WordPress|ontwikkeling-en-beheer-met-wordpress|web|B||k
Basistraining UX voor designers en testers|basistraining-ux-design|web,test|B||k
Apache Kafka voor Developers|apache-kafka-voor-developers|dev|A||k
Entry Level Developer E-learning collection|entry-level-developer-a-startel-special-e-learning-collection|dev,basis|B||z
Linux Essentials (LPI Essentials)|linux-essentials-lpi-essentials|linux,basis|B||k
Linux Administrator (LPIC-1 101)|linux-administrator-lpic-1-101|linux,admin|I||k
LPIC-1 Linux Administrator Fast Track|lpic-1-linux-administrator-fast-track|linux,admin|I||k
Linux Engineer (LPIC-2 201)|linux-engineer-lpic-2-201|linux,admin|A||k
Bash Programming|bash-programming|linux,dev|I||k
CompTIA Linux+|comptia-linux|linux|I||k
CompTIA A+|comptia-a|basis,helpdesk,admin|B||k
CompTIA Network+|comptia-network|net|I||k
Implementing and Administering Cisco Solutions (CCNA)|implementing-and-administering-cisco-solutions-ccna-200-301|net|I||k
Certified Hardware Technician en Operating Systems Technician (CHT en COST)|certified-hardware-technician-en-certified-operating-systems-technician-cht-en-cost|helpdesk,basis|B||k
Klantenservicevaardigheden voor Helpdesk (met live acteur)|klantenservicevaardigheden-voor-helpdesk-praktische-training-met-live-acteur|helpdesk,soft|B||k
ITIL 5 Foundation, incl. examen|itil-5-foundation-inclusief-examenvoucher|itsm,helpdesk|B|2|k
ITIL 4 naar 5 Foundation Bridge, incl. examen|itil-4-naar-5-foundation-bridge-inclusief-examenvoucher|itsm|I||k
BiSL Foundation, incl. examen|bisl-foundation-bisl-f-inclusief-examen|itsm|B|2|k
Application Services Library Foundation (ASL-F)|application-services-library-foundation-asl-f|itsm|B||k
ISTQB Foundation, incl. examen|istqb-foundation-inclusief-examen|test|B|3|k
ISTQB Foundation Agile Tester, incl. examen|istqb-foundation-agile-tester-inclusief-examen|test|I||k
ISTQB Advanced Test Analyst, incl. examen|istqb-advanced-test-analyst-inclusief-examen|test|A||k
ISTQB Advanced Test Management, incl. examen|istqb-advanced-test-manager-inclusief-examen|test,pm|A||k
ISTQB Specialist Test Automation Engineer, incl. examen|istqb-specialist-test-automation-engineer-inclusief-examen|test,dev|A||k
ISTQB Specialist Testing with Generative AI, incl. examen|istqb-specialist-testing-with-generative-ai-inclusief-examenvoucher|test,ai|I||k
TMAP Quality for crossfunctional teams, incl. examen|tmap-quality-for-crossfunctional-teams-inclusief-examenvoucher|test|B||k
Playwright training|playwright-training|test,dev|I||k
API testing-training|api-testing-training|test,dev|I||k
Testing Fundamentals voor software engineers|certified-testing-fundamentals-voor-software-engineers|test,dev|B||k
Certified Practitioner in Agile Testing (CPAT)|certified-practitioner-in-agile-testing-cpat|test|I||k
Software Tester E-Learning|software-tester-zelfstudiepakket|test,basis|B||z
PRINCE2 Foundation, 7th Edition, incl. examen|prince2-foundation-7th-edition-incl-examen|pm|B|2|k
PRINCE2 Practitioner, incl. examen|prince2-practitioner-incl-examen|pm|I||k
Scrum Master 1 Training|scrum-master-1-training|pm,agile|B|2|k
Scrum Product Owner Training|scrum-product-owner-training|pm,agile|B||k
SAFe Scrum Master (SSM), incl. examen|safe-scrum-master-ssm-inclusief-examenvoucher|pm,agile|I||k
Leading SAFe (SA), incl. examen|leading-safe-sa-inclusief-examenvoucher|pm,agile,lead|I||k
Lean Six Sigma Yellow Belt|lean-six-sigma-yellow-belt-lean-yellow|pm,proces|B||k
Lean Six Sigma Green Belt (LSSGB)|lean-six-sigma-green-belt-lean-green|pm,proces|I||k
Effectief processen verbeteren met SIPOC en PDCA|effectief-processen-verbeteren-met-sipoc-en-pdca|proces,pm|B||k
IREB Foundation|ireb-foundation|pm,analyse|B||k
BCS Foundation Certificate in Business Analysis, incl. examen|bcs-foundation-certificate-in-business-analysis-inclusief-examenvoucher|analyse,pm|B||k
Agile Scrum Foundation E-Learning|agile-scrum-foundation-zelfstudie|pm,agile|B||z
Assertiviteit: positief opkomen voor jezelf|assertiviteit-positief-opkomen-voor-jezelf|soft|B||k
Persoonlijke effectiviteit met NLP|persoonlijke-effectiviteit-met-nlp|soft|B||k
Beïnvloedingsskills en overtuigingskracht|beinvloedingsvaardigheden-en-overtuigingskracht|soft|I||k
Timemanagement, de basis|timemanagement-de-basis|soft,office|B||k
Adviesvaardigheden; meer impact als adviseur|adviesvaardigheden-meer-impact-als-adviseur|soft|I||k
Communiceren met Impact – voor IT-professionals|communiceren-met-impact-voor-it-professionals|soft,helpdesk|B||k
Gesprekstechnieken|gesprekstechnieken|soft|B||k
Feedback & Feedforward geven en ontvangen|feedback-feedforward-geven-en-ontvangen|soft,lead|B||k
Spreken voor groepen|spreken-voor-groepen|soft|B||k
Stress en veerkracht, effectief onder druk|stressvermindering-in-werk-en-privesituaties|soft|B||k
Conflicthantering|conflicthantering|soft,lead|I||k
Personal Branding|personal-branding|soft|B||k
Omgaan met verandering|omgaan-met-verandering|soft|B||k
Train de trainer|train-de-trainer|soft|I||k
Leidinggeven|leidinggeven|lead|B||k
Als manager aan de slag|als-manager-aan-de-slag|lead|B||k
Situationeel leidinggeven|situationeel-leidinggeven|lead|I||k
Teamontwikkeling en Situationeel Leiderschap|teamontwikkeling-en-situationeel-leiderschap-voor-teams|lead|I||k
Coaching op de werkvloer|coaching-op-de-werkvloer|lead|I||k
Delegeren|delegeren|lead|B||k
Leiderschap met Impact|leiderschap-met-impact|lead|I||k`;

// Omschrijving per thema-tag: helpt het taalmodel om gewone zinnen aan trainingen te koppelen.
const TAG_TEXT = {
  ai: "kunstmatige intelligentie, AI-tools zoals ChatGPT en Copilot, slimmer en sneller werken met AI",
  office: "kantoorsoftware, dagelijks werk op de computer, Excel, Word, Outlook, PowerPoint",
  m365: "Microsoft 365, Teams, SharePoint, OneDrive, samenwerken in de Microsoft-omgeving",
  admin: "systeembeheer, IT-beheerder, servers, werkplekken en gebruikers beheren",
  auto: "werkprocessen en taken automatiseren, apps bouwen zonder te programmeren, low-code",
  dev: "programmeren, software ontwikkelen, code schrijven, developer worden",
  web: "websites en webapplicaties bouwen, webontwikkeling",
  azure: "Microsoft Azure cloudplatform",
  cloud: "cloud computing, overstappen naar de cloud, cloudomgevingen beheren",
  devops: "DevOps, containers, automatisering van IT-infrastructuur en deployment",
  linux: "Linux, open source systemen en de command line",
  net: "netwerken, routers, switches, netwerkbeheer en verbindingen",
  sec: "cybersecurity, informatiebeveiliging, bescherming tegen hackers, phishing en cyberaanvallen",
  hack: "ethisch hacken, pentesten, aanvallen simuleren om zwakke plekken te vinden",
  aware: "security awareness, medewerkers bewust maken van phishing, verdachte e-mails en digitale risico's",
  gov: "wet- en regelgeving, compliance, normen, privacy en governance",
  data: "data-analyse, rapportages en dashboards maken, cijfers inzichtelijk maken, managementinformatie, Power BI",
  basis: "beginnen in de IT zonder ervaring, digitale basisvaardigheden, carrièreswitch of omscholing",
  helpdesk: "helpdesk en servicedesk, gebruikers ondersteunen, IT-support en storingen oplossen",
  itsm: "IT-servicemanagement, ITIL, beheerprocessen en dienstverlening",
  test: "software testen, kwaliteit van software controleren, tester worden",
  pm: "projectmanagement, projecten leiden, plannen en beheersen",
  agile: "agile werken, Scrum, zelfsturende teams",
  proces: "processen verbeteren, Lean, efficiënter werken als organisatie, verspilling verminderen",
  analyse: "requirements, business analyse, wensen van de organisatie vertalen",
  soft: "persoonlijke ontwikkeling, communicatie, samenwerking en omgang met collega's",
  lead: "leidinggeven, leiderschap, teamleider of manager worden, een team aansturen"
};

const CERT_RE = /incl\.|examen|\b[A-Z]{2,3}-\d{3,4}\b|ISTQB|PRINCE2|CompTIA|ITIL|LPIC|CCNA|SAFe|BiSL|TMAP|CISSP|CISSO|CEH|Certified|Lean Six|IREB|BCS|CKA/i;

function baseCatalog() {
  return RAW.split("\n").map((l, i) => {
    const [name, slug, tags, lvl, days, fmt] = l.split("|");
    return { i, name, slug, url: "https://startel.nl/trainingen/" + slug + "/", tags: tags.split(","), lvl, days, fmt,
      cert: CERT_RE.test(name), price: null, intro: "", insight: "" };
  });
}

function passage(t) {
  const topics = t.tags.map(g => TAG_TEXT[g]).filter(Boolean).join("; ");
  return `passage: ${t.name}. Onderwerpen: ${topics}. ${t.intro || ""} ${t.insight || ""}`.replace(/\s+/g, " ").trim().slice(0, 1400);
}

module.exports = { baseCatalog, passage, TAG_TEXT };
