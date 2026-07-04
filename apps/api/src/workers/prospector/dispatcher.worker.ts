import { getEvolutionClient } from "../../lib/evolution";
import * as prospectorRepository from "../../modules/prospector/prospector.repository";
import * as messagesRepository from "../../modules/prospector/messages.repository";
import * as queueRepository from "../../modules/prospector/queue.repository";
import * as botLogs from "../../modules/prospector/botlogs.repository";
import * as leadsRepository from "../../modules/leads/leads.repository";
import { checkUntilDoneCompletion } from "./session.worker";
import { sendMessageBlocks } from "./send-blocks";

export async function runDispatchTick(): Promise<void> {
  const instances = await prospectorRepository.findAllConnectedInstances("whatsapp");

  for (const instance of instances) {
    const config = await prospectorRepository.getConfig(instance.owner_id);
    if (!config.is_active) continue;

    const dueItems = await queueRepository.findDueItems(new Date().toISOString(), instance.owner_id);
    for (const item of dueItems) {
      await dispatchOne(item, instance.instance_name);
    }

    await checkUntilDoneCompletion(instance.owner_id);
  }
}

async function dispatchOne(
  item: { id: string; lead_id: string; message_id: string | null },
  instanceName: string,
): Promise<void> {
  await queueRepository.update(item.id, { status: "sending" });

  try {
    const lead = await leadsRepository.findById(item.lead_id);
    if (!lead?.whatsapp) {
      await queueRepository.update(item.id, { status: "failed" });
      await botLogs.create(`Lead ${item.lead_id} sem WhatsApp. Item marcado como falho.`, "warn");
      return;
    }

    if (!item.message_id) {
      await queueRepository.update(item.id, { status: "failed" });
      await botLogs.create(`Item ${item.id} sem mensagem associada. Marcado como falho.`, "warn");
      return;
    }

    const message = await messagesRepository.findById(item.message_id);
    if (!message) {
      await queueRepository.update(item.id, { status: "failed" });
      await botLogs.create(`Mensagem ${item.message_id} não encontrada. Item marcado como falho.`, "warn");
      return;
    }

    // checkNumbers/sendText da Evolution API esperam dígitos puros (sem o "+" do E.164)
    const digitsOnly = lead.whatsapp.replace(/\D/g, "");

    const client = getEvolutionClient();
    const validNumbers = await client.checkNumbers(instanceName, [digitsOnly]);

    if (!validNumbers.includes(digitsOnly)) {
      await queueRepository.update(item.id, { status: "failed" });
      await botLogs.create(`Número ${lead.whatsapp} inválido no WhatsApp. Item marcado como falho.`, "warn");
      return;
    }

    await sendMessageBlocks(client, instanceName, digitsOnly, message.bot_message_blocks);

    if (message.status === "ab-test") {
      await messagesRepository.incrementAbUsedCount(message.id);
    }

    await queueRepository.update(item.id, { status: "sent", sent_at: new Date().toISOString() });
    await leadsRepository.update(item.lead_id, { status: "contato", column_id: "col-2" });

    await botLogs.create(`Enviado para ${lead.name} (${lead.whatsapp}).`, "info");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await queueRepository.update(item.id, { status: "failed" });
    await botLogs.create(`Falha ao enviar item ${item.id}: ${message}`, "error");
  }
}
