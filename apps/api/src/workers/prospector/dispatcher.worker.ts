import { getEvolutionClient } from "../../lib/evolution";
import * as messagesRepository from "../../modules/prospector/messages.repository";
import * as queueRepository from "../../modules/prospector/queue.repository";
import type { DispatchQueueRow } from "../../modules/prospector/queue.repository";
import * as botLogs from "../../modules/prospector/botlogs.repository";
import * as leadsRepository from "../../modules/leads/leads.repository";
import * as leadFlowStateRepository from "../../modules/prospector/lead-flow-state.repository";
import * as campaignsRepository from "../../modules/prospecting-campaigns/prospecting-campaigns.repository";
import { checkUntilDoneCompletion } from "./session.worker";
import { sendMessageBlocks } from "./send-blocks";
import { advanceAfterSend } from "./flow-engine";

export async function runDispatchTick(): Promise<void> {
  const campaigns = await campaignsRepository.findActiveWithConnectedInstance();

  for (const campaign of campaigns) {
    const dueItems = await queueRepository.findDueItems(new Date().toISOString(), campaign.id);
    for (const item of dueItems) {
      await dispatchOne(item, campaign.instance_name);
    }

    await checkUntilDoneCompletion(campaign.id);
  }
}

async function dispatchOne(item: DispatchQueueRow, instanceName: string): Promise<void> {
  await queueRepository.update(item.id, { status: "sending" });

  try {
    const lead = await leadsRepository.findById(item.lead_id);
    if (!lead?.whatsapp) {
      await markFailed(item, `Lead ${item.lead_id} sem WhatsApp. Item marcado como falho.`);
      return;
    }

    if (!item.message_id) {
      await markFailed(item, `Item ${item.id} sem mensagem associada. Marcado como falho.`);
      return;
    }

    const message = await messagesRepository.findById(item.message_id);
    if (!message) {
      await markFailed(item, `Mensagem ${item.message_id} não encontrada. Item marcado como falho.`);
      return;
    }

    // checkNumbers/sendText da Evolution API esperam dígitos puros (sem o "+" do E.164)
    const digitsOnly = lead.whatsapp.replace(/\D/g, "");

    const client = getEvolutionClient();
    const validNumbers = await client.checkNumbers(instanceName, [digitsOnly]);

    // O WhatsApp normaliza o número (ex.: remove o 9º dígito em DDDs legados
    // como o 98), então o jid retornado raramente bate byte-a-byte com o
    // número discado. Comparar com .includes(digitsOnly) marca como inválido
    // números que na verdade existem — usamos o próprio número validado.
    const canonicalNumber = validNumbers[0];

    if (!canonicalNumber) {
      await markFailed(item, `Número ${lead.whatsapp} inválido no WhatsApp. Item marcado como falho.`);
      return;
    }

    await sendMessageBlocks(client, instanceName, canonicalNumber, message.bot_message_blocks);

    await queueRepository.update(item.id, { status: "sent", sent_at: new Date().toISOString() });
    await leadsRepository.update(item.lead_id, { status: "contato", column_id: "col-2" });

    await advanceAfterSend(item);

    await botLogs.create(`Enviado para ${lead.name} (${lead.whatsapp}).`, "info", item.prospecting_campaign_id);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(item, `Falha ao enviar item ${item.id}: ${message}`, "error");
  }
}

async function markFailed(
  item: DispatchQueueRow,
  logMessage: string,
  level: "warn" | "error" = "warn",
): Promise<void> {
  await queueRepository.update(item.id, { status: "failed" });
  await botLogs.create(logMessage, level, item.prospecting_campaign_id);

  // Envio falhou — o lead não anda mais no fluxo desta campanha
  const state = await leadFlowStateRepository.findByLeadAndCampaign(
    item.lead_id,
    item.prospecting_campaign_id,
  );
  if (state && state.status !== "completed") {
    await leadFlowStateRepository.updateState(state.id, { status: "stopped" });
  }
}
