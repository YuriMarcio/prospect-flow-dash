/**
 * Prompts do Gemini para o pipeline de respostas. Duas responsabilidades
 * separadas: classificar a resposta do lead e personalizar levemente uma
 * resposta pré-aprovada — a IA nunca escreve resposta do zero.
 */

export const INTENTS = [
  "interessado",
  "duvida_preco",
  "recusa",
  "pedindo_mais_info",
  "reclamacao",
  "fora_do_escopo",
] as const;

export type Intent = (typeof INTENTS)[number];

export const INTENT_LABELS: Record<Intent, string> = {
  interessado: "Interessado",
  duvida_preco: "Dúvida de preço",
  recusa: "Recusa",
  pedindo_mais_info: "Pedindo mais informações",
  reclamacao: "Reclamação",
  fora_do_escopo: "Fora do escopo",
};

export function buildClassificationPrompt(input: {
  leadName: string;
  leadSegment: string | null;
  lastSentText: string;
  replyText: string;
  elapsedHuman: string;
}): string {
  return `Você analisa respostas de donos de pequenos negócios a uma mensagem de prospecção de uma consultoria, enviada por WhatsApp.

Mensagem que NÓS enviamos:
"""
${input.lastSentText || "(mensagem com mídia, sem texto)"}
"""

Resposta de ${input.leadName}${input.leadSegment ? ` (segmento: ${input.leadSegment})` : ""}, recebida ${input.elapsedHuman} após o nosso envio:
"""
${input.replyText}
"""

Classifique a resposta:
- intencao: interessado | duvida_preco | recusa | pedindo_mais_info | reclamacao | fora_do_escopo
- sentimento: positivo | neutro | negativo
- prontidao_para_reuniao: alta | media | baixa (o quanto essa pessoa parece pronta para aceitar uma reunião de apresentação agora)
- resposta_automatica: true se for mensagem automática (secretária eletrônica, aviso de fora do horário, menu de atendimento numerado, saudação genérica de bot, texto claramente idêntico a auto-reply), senão false
- resumo: 1 frase curta em português resumindo o que a pessoa disse`;
}

export function buildPersonalizationPrompt(input: {
  leadName: string;
  replyText: string;
  baseText: string;
}): string {
  return `Você personaliza uma resposta pré-aprovada de uma consultoria em uma conversa de WhatsApp.

OBJETIVO FIXO: levar o lead a aceitar uma reunião de apresentação da consultoria. Nada além disso.

REGRAS INEGOCIÁVEIS:
- Mantenha o texto-base e o sentido dele. Você só pode: ajustar a saudação usando o primeiro nome do lead e incluir NO MÁXIMO 1 referência curta ao que ele disse.
- NUNCA negocie, mencione preço, desconto ou prazo que não esteja no texto-base.
- NUNCA prometa nada que não esteja no texto-base.
- NUNCA invente informações sobre o serviço.
- Mantenha o tamanho parecido com o texto-base e o mesmo tom.

Nome do lead: ${input.leadName}
O que o lead disse: """${input.replyText}"""

TEXTO-BASE:
"""
${input.baseText}
"""

Responda apenas com o texto final personalizado.`;
}
