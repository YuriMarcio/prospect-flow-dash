/**
 * Confere o provedor de perfis do Instagram com perfis reais, sem rodar uma captura.
 *
 *   npm run check:profiles -w api -- zelandiaburger outroperfil
 *
 * Mostra o provedor escolhido, o tempo de cada consulta e o que o LeadFlow extrai da bio.
 * Cada perfil consultado gasta 1 resultado do plano do provedor. Nunca imprime a chave.
 */
import "dotenv/config";
import { profileToLeadFields, providerRejection } from "../src/workers/instagram/instagram.profile";
import { fetchInstagramProfile, resolveProfileProvider } from "../src/workers/instagram/instagram.provider";

const handles = process.argv.slice(2).map((arg) => arg.replace(/^@/, "").trim()).filter(Boolean);

if (handles.length === 0) {
  console.error("Uso: npm run check:profiles -w api -- <perfil> [<perfil> ...]");
  process.exit(1);
}

const provider = resolveProfileProvider();
if (!provider) {
  console.error("Nenhum provedor configurado: defina APIFY_TOKEN (ou SCRAPECREATORS_API_KEY) em apps/api/.env");
  process.exit(1);
}

console.log(`Provedor: ${provider}${process.env.PROFILE_PROVIDER ? " (forçado por PROFILE_PROVIDER)" : ""}\n`);

for (const handle of handles) {
  const startedAt = Date.now();
  try {
    const profile = await fetchInstagramProfile(handle);
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

    if (!profile) {
      console.log(`@${handle}  ${seconds}s  perfil não encontrado`);
      continue;
    }

    const fields = profileToLeadFields(profile);
    console.log(
      [
        `@${handle}  ${seconds}s`,
        `  nome: ${profile.full_name ?? "—"} | seguidores: ${profile.follower_count ?? "—"}`,
        `  bio (${(profile.biography ?? "").length} caracteres): ${(profile.biography ?? "").replace(/\s+/g, " ").slice(0, 100)}`,
        `  links da bio: ${(profile.bio_links ?? []).map((link) => link.url).join(", ") || "—"}`,
        `  → WhatsApp: ${fields.whatsapp ?? "—"} | linktree/site: ${fields.linktree ?? "—"} | delivery: ${fields.delivery_link ?? "—"}`,
      ].join("\n"),
    );
  } catch (err) {
    const rejected = providerRejection(err);
    const message = err instanceof Error ? err.message : String(err);
    console.log(
      rejected
        ? `@${handle}  RECUSADO (HTTP ${rejected}): chave inválida, sem permissão ou limite de uso/créditos esgotado`
        : `@${handle}  erro: ${message}`,
    );
    if (rejected) break;
  }
}
