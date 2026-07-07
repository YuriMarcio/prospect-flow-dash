import * as ownerNotificationsRepository from "../../modules/prospector/owner-notifications.repository";
import * as botLogs from "../../modules/prospector/botlogs.repository";
import { getUserById } from "../../modules/auth/auth.service";
import type { ProspectingCampaignRow } from "../../modules/prospecting-campaigns/prospecting-campaigns.repository";
import { getEvolutionClient } from "../../lib/evolution";
import type { AiClassification } from "./ai-classifier";
import { INTENT_LABELS, type Intent } from "./prompts";

interface NotificationConfig {
  enabled: boolean;
  phone: string | null;
  notify_on: string[];
  cooldown_minutes: number;
}

/**
 * Avisa o dono da campanha no WhatsApp dele (pela própria instância) quando um
 * lead responde. Anti-spam: no máximo 1 aviso por lead dentro do cooldown.
 */
export async function notifyOwner(input: {
  campaign: ProspectingCampaignRow;
  instanceName: string;
  lead: { id: string; name: string };
  replyText: string;
  ai: AiClassification | null;
}): Promise<void> {
  const config = input.campaign.notification_config as NotificationConfig | null;
  if (!config?.enabled) return;

  const highReadiness = input.ai?.prontidao_para_reuniao === "alta";
  const notifyOn = config.notify_on ?? [];
  const shouldNotify = notifyOn.includes("reply") || (notifyOn.includes("high_readiness") && highReadiness);
  if (!shouldNotify) return;

  const cooldownMinutes = config.cooldown_minutes ?? 60;
  const since = new Date(Date.now() - cooldownMinutes * 60_000).toISOString();
  if (await ownerNotificationsRepository.wasNotifiedSince(input.lead.id, since)) return;

  let phone = config.phone;
  if (!phone) {
    const owner = await getUserById(input.campaign.owner_user_id);
    phone = owner?.phone ?? null;
  }
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (!digits) {
    await botLogs.create(
      "Notificação de resposta habilitada, mas sem telefone de destino (configure na aba Notificações ou no perfil).",
      "warn",
      input.campaign.id,
    );
    return;
  }

  const lines = [
    `🔔 *${input.lead.name}* respondeu na campanha *${input.campaign.name}*`,
  ];
  if (input.ai) {
    const intentLabel = INTENT_LABELS[input.ai.intencao as Intent] ?? input.ai.intencao;
    lines.push(
      `Intenção: ${intentLabel} · Sentimento: ${input.ai.sentimento} · Prontidão p/ reunião: ${input.ai.prontidao_para_reuniao.toUpperCase()}${highReadiness ? " 🔥" : ""}`,
    );
    if (input.ai.resumo) lines.push(`Resumo: ${input.ai.resumo}`);
  }
  lines.push(`"${input.replyText.slice(0, 300)}"`);

  const client = getEvolutionClient();
  await client.sendText(input.instanceName, digits, lines.join("\n"));

  await ownerNotificationsRepository.insertNotification({
    prospecting_campaign_id: input.campaign.id,
    lead_id: input.lead.id,
    reason: highReadiness ? "high_readiness" : "reply",
  });

  await botLogs.create(`Dono avisado no WhatsApp sobre a resposta de ${input.lead.name}.`, "info", input.campaign.id);
}
