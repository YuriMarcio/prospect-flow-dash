import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, FlaskConical, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createBotMessage,
  updateBotMessage,
  updateCampaign,
  type CampaignAiConfig,
  type MessageBlock,
  type ProspectingCampaign,
} from "@/lib/prospector";
import {
  INTENTS,
  INTENT_LABELS,
  deleteIntentResponse,
  listIntentResponses,
  testAiClassification,
  upsertIntentResponse,
  type AiClassification,
  type Intent,
  type IntentResponse,
} from "@/lib/flows";
import { MessageBlocksEditor } from "./MessageBlocksEditor";

function withBlockIds(blocks: MessageBlock[]): MessageBlock[] {
  return blocks.map((block) => ({ ...block, id: block.id ?? crypto.randomUUID() }));
}

/** Card de uma intenção: resposta pré-aprovada (blocos) + personalização. */
function IntentCard({
  campaignId,
  intent,
  response,
}: {
  campaignId: string;
  intent: Intent;
  response: IntentResponse | null;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [blocks, setBlocks] = useState<MessageBlock[]>([]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["intent-responses", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["bot-messages", campaignId] });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      let messageId = response?.message_id ?? null;
      if (messageId) {
        await updateBotMessage(messageId, { blocks });
      } else {
        const created = await createBotMessage(campaignId, {
          title: `Resposta: ${INTENT_LABELS[intent]}`,
          status: "draft",
          blocks,
        });
        messageId = created.id;
      }
      return upsertIntentResponse(campaignId, intent, {
        message_id: messageId,
        personalize: response?.personalize ?? true,
        enabled: response?.enabled ?? true,
      });
    },
    onSuccess: () => {
      invalidate();
      setEditing(false);
      toast.success("Resposta salva.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const togglePersonalizeMutation = useMutation({
    mutationFn: (personalize: boolean) =>
      upsertIntentResponse(campaignId, intent, {
        message_id: response!.message_id,
        personalize,
        enabled: response!.enabled,
      }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: () => deleteIntentResponse(campaignId, intent),
    onSuccess: invalidate,
  });

  const savedBlocks = response?.bot_messages?.bot_message_blocks ?? [];
  const firstText = savedBlocks.find((b) => b.type === "text")?.content;
  const hasAudio = savedBlocks.some((b) => b.type === "audio");
  const canSave = blocks.length > 0 && blocks.every((b) => b.content.trim());

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{INTENT_LABELS[intent]}</p>
        {hasAudio && (
          <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-600">
            áudio gravado
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {response && !editing && (
            <>
              <button
                type="button"
                onClick={() => {
                  setBlocks(
                    withBlockIds(
                      [...savedBlocks].sort(
                        (a, b) =>
                          (a as { position?: number }).position! -
                          (b as { position?: number }).position!,
                      ),
                    ),
                  );
                  setEditing(true);
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => removeMutation.mutate()}
                className="text-[11px] text-muted-foreground hover:text-destructive"
              >
                Remover
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <MessageBlocksEditor blocks={blocks} onChange={setBlocks} />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <Button
              size="sm"
              disabled={!canSave || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Salvando…" : "Salvar resposta"}
            </Button>
          </div>
        </div>
      ) : response ? (
        <>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {firstText || `${savedBlocks.length} bloco(s) de mídia`}
          </p>
          <div className="flex items-center gap-2 border-t border-border pt-2">
            <Switch
              checked={response.personalize}
              onCheckedChange={(checked) => togglePersonalizeMutation.mutate(checked)}
              className="scale-75"
            />
            <span className="text-[11px] text-muted-foreground">
              Personalizar texto com IA (nome do lead + referência ao que ele disse)
            </span>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            setBlocks([]);
            setEditing(true);
          }}
          className="w-full rounded-md border border-dashed border-border py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          + Cadastrar resposta (texto e/ou áudio pré-gravado)
        </button>
      )}
    </div>
  );
}

function TestBox({ campaignId }: { campaignId: string }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AiClassification | null>(null);

  const testMutation = useMutation({
    mutationFn: () => testAiClassification(campaignId, text),
    onSuccess: setResult,
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-medium">Testar classificação</p>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder='Ex: "qual o valor?"'
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && text.trim() && testMutation.mutate()}
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!text.trim() || testMutation.isPending}
          onClick={() => testMutation.mutate()}
        >
          {testMutation.isPending ? "Testando…" : "Testar"}
        </Button>
      </div>
      {result && (
        <div className="rounded-md bg-muted/50 p-2 text-[11px] space-y-0.5">
          <p>
            Intenção: <b>{INTENT_LABELS[result.intencao] ?? result.intencao}</b> · Sentimento:{" "}
            <b>{result.sentimento}</b> · Prontidão p/ reunião:{" "}
            <b>{result.prontidao_para_reuniao}</b>
          </p>
          {result.resposta_automatica && (
            <p className="text-amber-600">
              Detectada como resposta automática (não seria respondida)
            </p>
          )}
          <p className="text-muted-foreground">{result.resumo}</p>
        </div>
      )}
    </div>
  );
}

export function AiTab({ campaign }: { campaign: ProspectingCampaign }) {
  const queryClient = useQueryClient();
  const aiConfig: CampaignAiConfig = campaign.ai_config ?? {
    enabled: false,
    auto_reply_enabled: false,
  };

  const responsesQuery = useQuery({
    queryKey: ["intent-responses", campaign.id],
    queryFn: () => listIntentResponses(campaign.id),
  });
  const responses = responsesQuery.data ?? [];

  const configMutation = useMutation({
    mutationFn: (patch: Partial<CampaignAiConfig>) =>
      updateCampaign(campaign.id, { ai_config: { ...aiConfig, ...patch } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Inteligência artificial (Gemini)</p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-xs">Classificar respostas com IA</Label>
            <p className="text-[11px] text-muted-foreground">
              Detecta intenção, sentimento, prontidão para reunião e respostas automáticas
              (secretária eletrônica) — alimenta o nó "Classificar resposta" do fluxo.
            </p>
          </div>
          <Switch
            checked={aiConfig.enabled}
            onCheckedChange={(checked) => configMutation.mutate({ enabled: checked })}
          />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
          <div>
            <Label className="text-xs">Responder automaticamente</Label>
            <p className="text-[11px] text-muted-foreground">
              Envia a resposta pré-aprovada da intenção detectada. Desligado, o sistema só
              classifica e avisa — você responde manualmente. Nunca responde quando a mensagem do
              lead for automática.
            </p>
          </div>
          <Switch
            checked={aiConfig.auto_reply_enabled}
            disabled={!aiConfig.enabled}
            onCheckedChange={(checked) => configMutation.mutate({ auto_reply_enabled: checked })}
          />
        </div>
      </div>

      {aiConfig.enabled && <TestBox campaignId={campaign.id} />}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Respostas pré-aprovadas por intenção</p>
            <p className="text-[11px] text-muted-foreground">
              A IA nunca inventa: ela escolhe a resposta da intenção e só personaliza levemente o
              texto. Grave áudios seus para as intenções mais comuns — soa mais humano. Intenção sem
              resposta cadastrada usa a de "Pedindo mais informações".
            </p>
          </div>
        </div>

        {INTENTS.map((intent) => (
          <IntentCard
            key={intent}
            campaignId={campaign.id}
            intent={intent as Intent}
            response={responses.find((r) => r.intent === intent) ?? null}
          />
        ))}
      </div>
    </div>
  );
}
