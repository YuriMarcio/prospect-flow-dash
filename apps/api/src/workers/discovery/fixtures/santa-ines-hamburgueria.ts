/**
 * Resultados reais de `site:instagram.com "Hamburgueria" "Santa Inês"` (log de 13/10).
 * O log só traz título e URL, então não há snippet. #1–#6 são hamburguerias; o resto é o que o
 * Google devolveu depois de relaxar a query.
 */
export interface FixtureResult {
  position: number;
  title: string;
  link: string;
}

const ig = (handle: string) => `https://www.instagram.com/${handle}/`;
const help = (id: string) => `https://help.instagram.com/${id}/`;

export const SANTA_INES_RESULTS: FixtureResult[] = [
  { position: 1, title: "One Hamburgueria", link: ig("one.hamburgueria") },
  { position: 2, title: "Bʀᴀꜱᴀ Bᴜʀɢᴜᴇʀ", link: ig("brasaburguersbu") },
  { position: 3, title: "Gabs Burguer • Hamburgueria", link: ig("gabsburgueroficial") },
  { position: 4, title: "Sr. Honorio Hambúrgueria", link: ig("srhonorioburguer") },
  { position: 5, title: "OTTO'S BURGER & BBQ ®", link: ig("ottoburger.ofc") },
  { position: 6, title: "1111 Hamburgueria", link: ig("1111hamburgueria") },
  { position: 7, title: "Ella Langley", link: ig("ellalangleymusic") },
  { position: 8, title: "SchemerBoyz", link: ig("schemerboyz") },
  { position: 9, title: "Manuel Santamaria Sanchez", link: ig("manuelsantamariasanchez") },
  { position: 10, title: "پوشاک پیام‎", link: ig("payamposhak") },
  { position: 11, title: "Chiara Forti", link: ig("chiaraforti_") },
  { position: 12, title: "Школа моделей и актерского мастерства ПреВью ...", link: ig("previewma") },
  { position: 13, title: "Instagram on the Web", link: help("513918941996087") },
  { position: 14, title: "Vicente climatização", link: ig("viicente_climatizacao") },
  { position: 15, title: "Turn on Dark mode for Instagram", link: help("897760233943762") },
  { position: 16, title: "KCCIS NEWS", link: ig("kccisnews") },
  { position: 17, title: "JF Impresiones", link: ig("jf_impresiones_spa") },
  { position: 18, title: "Privacy Policy - How Meta collects and uses user data", link: "https://privacycenter.instagram.com/policy" },
  { position: 19, title: "LAVI moda feminina", link: ig("_lavioficial") },
  { position: 20, title: "República Mato Dentro", link: ig("republica_matodentro") },
  { position: 21, title: "S A R A H W A N G 👻 莎拉王棠云⭐️", link: ig("sarah9_23") },
  { position: 22, title: "Lost access to email or phone number linked ...", link: help("358911864194456") },
  { position: 23, title: "노윤서", link: ig("rohyoonseo") },
  { position: 24, title: "Stories", link: help("1660923094227526") },
  { position: 25, title: "SUVASTRA STUDIO", link: ig("suvastrastudio") },
  { position: 26, title: "idHAIR주엽2호점", link: ig("idhair_jy2") },
  { position: 27, title: "POWER AND SECURITY SOLUTIONS.", link: ig("gsd_security_ng") },
  { position: 28, title: "Laureen Brassier", link: ig("lau63000") },
  { position: 29, title: "Account Recovery and Login", link: help("345310197245685") },
  { position: 30, title: "About disabled Instagram accounts", link: help("366993040048856") },
  { position: 31, title: "Hélio Trading LDA", link: ig("heliotradinglda") },
  { position: 32, title: "iRestore International LLC", link: ig("irestoreint_llc") },
  { position: 33, title: "Hacked Instagram Account", link: help("368191326593075") },
  { position: 34, title: "Diamond Club Services 💎", link: ig("diamondclubservices") },
  { position: 35, title: "Sankalp Mishra", link: ig("sanki_3105") },
  { position: 36, title: "MUI Kabupaten Cianjur", link: ig("mui_cianjur") },
  { position: 37, title: "Isaac Wa Norman Shaaka 🕊", link: ig("isaac_wa_norman_shaaka") },
  { position: 38, title: "Costelaria Bela Brasa", link: ig("belabrasarestaurante") },
  { position: 39, title: "Karsiyah", link: ig("karsiyah7") },
  { position: 40, title: "Feedback", link: "https://help.instagram.com/search/" },
  { position: 41, title: "agata kryger", link: ig("krygeragata") },
  { position: 42, title: "Ade Anjar nurzaman", link: ig("amett_20") },
  { position: 43, title: "corsa_d_sw - Windt Stefan", link: ig("corsa_d_sw") },
  { position: 44, title: "Ocholi Adaji", link: ig("ocholiadaji") },
  { position: 45, title: "Kaan Sel", link: ig("kaanksel") },
  { position: 46, title: "🎣", link: "https://www.instagram.com/BoboJLe/" },
];
