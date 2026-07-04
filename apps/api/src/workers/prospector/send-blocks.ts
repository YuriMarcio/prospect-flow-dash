import type { EvolutionClient } from "@sinal/evolution-client";
import type { BotMessageBlockRow } from "../../modules/prospector/messages.repository";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envia os blocos de uma mensagem (texto/imagem/áudio) na ordem configurada,
 * com um respiro entre cada um para não chegar tudo colado no WhatsApp.
 */
export async function sendMessageBlocks(
  client: EvolutionClient,
  instanceName: string,
  number: string,
  blocks: BotMessageBlockRow[],
): Promise<void> {
  for (const [index, block] of blocks.entries()) {
    if (index > 0) await sleep(800);

    if (block.type === "text") {
      await client.sendText(instanceName, number, block.content);
    } else if (block.type === "image") {
      await client.sendImage(instanceName, number, block.content, block.caption ?? "");
    } else if (block.type === "audio") {
      await client.sendAudio(instanceName, number, block.content);
    }
  }
}
