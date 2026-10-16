import { isStandalone } from "@/lib/push";

/**
 * Ao tocar no WhatsApp (ou outro link externo) de dentro do app instalado, o celular pode descartar o
 * app enquanto o usuário está fora; ao voltar ele reabre na `start_url` ("/", o Dashboard) e a tela onde
 * ele estava se perde. Guardamos "de onde ele saiu" e restauramos na volta.
 */
const KEY = "zapediu:return-point";
const MAX_AGE_MS = 60 * 60_000;

interface ReturnPoint {
  href: string;
  at: number;
}

/** Chamar logo antes de mandar o usuário pra fora do app. */
export function saveReturnPoint(): void {
  try {
    const point: ReturnPoint = { href: window.location.pathname + window.location.search, at: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(point));
  } catch {
    // localStorage indisponível (modo privado): sem restauração, mas nada quebra
  }
}

/** A página sobreviveu à ida ao WhatsApp: não há nada a restaurar. */
export function clearReturnPoint(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // idem
  }
}

/**
 * Lê (e apaga) o ponto de retorno. Só devolve algo se o app reabriu do zero na tela inicial, instalado,
 * pouco depois da saída — qualquer outra entrada (link, notificação, aba normal) segue o rumo dela.
 */
export function takeReturnPoint(): string | null {
  let point: ReturnPoint | null = null;
  try {
    const raw = window.localStorage.getItem(KEY);
    point = raw ? (JSON.parse(raw) as ReturnPoint) : null;
  } catch {
    point = null;
  }
  clearReturnPoint();

  if (!point || typeof point.href !== "string" || !point.href.startsWith("/")) return null;
  if (Date.now() - point.at > MAX_AGE_MS) return null;
  if (!isStandalone() || window.location.pathname !== "/" || window.location.search) return null;
  return point.href;
}
