import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUp,
  BarChart3,
  Bot,
  CalendarClock,
  CheckSquare,
  FileText,
  KanbanSquare,
  Lightbulb,
  Loader2,
  Mic,
  Network,
  NotebookText,
  Paperclip,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useObjectivesStore } from "@/store/objectives";
import { useObjectivesSync } from "@/hooks/use-objectives-sync";
import {
  cancelPlanningSession,
  confirmPlanningSession,
  getActivePlanningSession,
  sendPlannerTurn,
  type PlanningSession,
} from "@/lib/objectivePlanning";
import {
  cancelWorkspacePlanningSession,
  confirmWorkspacePlanningSession,
  getActiveWorkspacePlanningSession,
  sendWorkspacePlannerTurn,
  type WorkspacePlanningSession,
} from "@/lib/workspacePlanning";
import { createWorkspacePage, updateWorkspacePageBlocks } from "@/lib/workspaceApi";
import { markdownToBlocks } from "@/lib/markdownToBlocks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlannerMode = "objectives" | "workspace";

interface QuickAction {
  icon: typeof CheckSquare;
  title: string;
  chipLabel: string;
  description: string;
  mode: PlannerMode | null;
  accent: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: CheckSquare,
    title: "Criar tarefa automática",
    chipLabel: "Criar tarefa",
    description: "Transforme ideias em objetivos e tarefas no seu Kanban.",
    mode: "objectives",
    accent: "bg-destructive/10 text-destructive",
  },
  {
    icon: Network,
    title: "Gerar mapa mental do projeto",
    chipLabel: "Mapa mental",
    description: "Organize ideias e estratégias visualmente.",
    mode: null,
    accent: "bg-primary/10 text-primary",
  },
  {
    icon: FileText,
    title: "Montar página no Workspace",
    chipLabel: "Workspace",
    description: "Crie páginas, documentos e planos de projeto.",
    mode: "workspace",
    accent: "bg-info/10 text-info",
  },
  {
    icon: BarChart3,
    title: "Analisar métricas e gargalos",
    chipLabel: "Analisar dados",
    description: "Obtenha insights dos seus dados e funil.",
    mode: null,
    accent: "bg-success/10 text-success",
  },
  {
    icon: Target,
    title: "Diagnosticar operação comercial",
    chipLabel: "Diagnóstico",
    description: "Analise sua estrutura e receba recomendações.",
    mode: null,
    accent: "bg-warning/10 text-warning-foreground dark:text-warning",
  },
];

const MODULES = [
  { label: "Leads", icon: Users },
  { label: "Kanban", icon: KanbanSquare },
  { label: "Agenda", icon: CalendarClock },
  { label: "Automação", icon: Bot },
  { label: "Analytics", icon: BarChart3 },
  { label: "Workspace", icon: NotebookText },
  { label: "Mapas Mentais", icon: Network },
];

const TIPS = [
  "Peça pra IA criar vários objetivos de uma vez — ela separa cada um certinho.",
  "Você pode pedir uma tarefa avulsa, sem vincular a nenhum objetivo.",
  "Fale prazos do jeito natural: \"até sexta\", \"esse mês\", \"daqui 2 semanas\".",
  "Pra montar uma página, é só falar o assunto — a IA já propõe uma estrutura.",
  "Antes de confirmar, o plano fica editável — você pode pedir ajustes na conversa.",
];

const NOT_AVAILABLE_MSG =
  "Essa capacidade ainda não está disponível — por enquanto a IA cria objetivos/tarefas e monta páginas no Workspace.";

const MODE_PLACEHOLDER: Record<PlannerMode, string> = {
  objectives: "Peça para criar objetivos ou tarefas…",
  workspace: "Peça para montar uma página sobre algum assunto…",
};

function formatHistoryTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `Hoje, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Ontem, ${time}`;
  return `${date.toLocaleDateString("pt-BR")}, ${time}`;
}

export function AssistenteIAPage() {
  const displayName = useAuthStore((s) => s.displayName);
  const firstName = displayName?.split(" ")[0] ?? "";
  const navigate = useNavigate();

  useObjectivesSync();
  const columns = useObjectivesStore((s) => s.columns);
  const objectives = useObjectivesStore((s) => s.objectives);

  const queryClient = useQueryClient();

  const [mode, setMode] = useState<PlannerMode | null>(null);

  const objectivesSessionQuery = useQuery({
    queryKey: ["objective-planning-session"],
    queryFn: getActivePlanningSession,
    retry: 1,
  });
  const workspaceSessionQuery = useQuery({
    queryKey: ["workspace-planning-session"],
    queryFn: getActiveWorkspacePlanningSession,
    retry: 1,
  });

  const objectivesSession = objectivesSessionQuery.data;
  const workspaceSession = workspaceSessionQuery.data;

  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState("");
  const [tipIndex, setTipIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (columns.length && !selectedColumnId) {
      setSelectedColumnId(columns.find((c) => !c.isDone)?.id ?? columns[0].id);
    }
  }, [columns, selectedColumnId]);

  const activeTurnsLength =
    mode === "objectives" ? objectivesSession?.turns.length : mode === "workspace" ? workspaceSession?.turns.length : 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeTurnsLength]);

  async function handleSend(rawText: string) {
    const text = rawText.trim();
    if (!text || !mode || sending) return;

    if (mode === "objectives") {
      if (!objectivesSession) return;
      setInputValue("");
      setSending(true);
      try {
        const updated = await sendPlannerTurn(objectivesSession.id, text);
        queryClient.setQueryData<PlanningSession>(["objective-planning-session"], updated);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
        setInputValue(text);
      } finally {
        setSending(false);
      }
      return;
    }

    if (!workspaceSession) return;
    setInputValue("");
    setSending(true);
    try {
      const updated = await sendWorkspacePlannerTurn(workspaceSession.id, text);
      queryClient.setQueryData<WorkspacePlanningSession>(["workspace-planning-session"], updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
      setInputValue(text);
    } finally {
      setSending(false);
    }
  }

  async function handleConfirmObjectives() {
    if (!objectivesSession || !selectedColumnId) return;
    setConfirming(true);
    try {
      const result = await confirmPlanningSession(objectivesSession.id, selectedColumnId);
      toast.success(`${result.createdObjectiveIds.length} item(ns) criado(s) no board de Objetivos.`);
      queryClient.invalidateQueries({ queryKey: ["objectives"] });
      queryClient.invalidateQueries({ queryKey: ["objective-columns"] });
      objectivesSessionQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar o plano.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleConfirmWorkspacePage() {
    if (!workspaceSession?.draft) return;
    setConfirming(true);
    try {
      const { draft } = workspaceSession;
      const page = await createWorkspacePage({
        id: crypto.randomUUID(),
        parentId: null,
        title: draft.title,
        icon: draft.icon,
      });
      await updateWorkspacePageBlocks(page.id, markdownToBlocks(draft.markdown));
      await confirmWorkspacePlanningSession(workspaceSession.id, page.id);
      toast.success(`Página "${draft.title}" criada no Workspace.`, {
        action: { label: "Abrir", onClick: () => navigate({ to: "/workspace", search: { pageId: page.id } }) },
      });
      workspaceSessionQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a página.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleNewConversation() {
    if (mode === "objectives" && objectivesSession) {
      try {
        await cancelPlanningSession(objectivesSession.id);
        objectivesSessionQuery.refetch();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível iniciar uma nova conversa.");
      }
      return;
    }
    if (mode === "workspace" && workspaceSession) {
      try {
        await cancelWorkspacePlanningSession(workspaceSession.id);
        workspaceSessionQuery.refetch();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível iniciar uma nova conversa.");
      }
    }
  }

  function handleQuickAction(action: QuickAction) {
    if (!action.mode) {
      toast.info(NOT_AVAILABLE_MSG);
      return;
    }
    setMode(action.mode);
  }

  const recentObjectives = [...objectives]
    .filter((o) => o.kind === "objective")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const hasMessages = mode !== null && Boolean(activeTurnsLength);
  const turnsToShow = mode === "objectives" ? objectivesSession?.turns : mode === "workspace" ? workspaceSession?.turns : undefined;
  const canSend = mode === "objectives" ? Boolean(objectivesSession) : mode === "workspace" ? Boolean(workspaceSession) : false;

  return (
    <div className="p-6 h-full flex flex-col lg:flex-row gap-6 animate-fade-in">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Assistente IA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie tarefas, organize ideias e analise seu negócio com ajuda da IA.
          </p>
        </div>

        <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
            {!hasMessages ? (
              <div className="max-w-5xl mx-auto">
                <div className="flex flex-col items-center text-center py-8">
                  <div className="relative mb-5">
                    <div className="absolute inset-0 rounded-full bg-destructive/20 blur-2xl" />
                    <Sparkles className="relative h-12 w-12 text-destructive" />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Olá{firstName ? `, ${firstName}` : ""}!<br />Como posso ajudar hoje?
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    Posso criar tarefas, gerar mapas mentais, montar páginas no Workspace, analisar dados e te ajudar
                    a entender melhor o seu negócio.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.title}
                      onClick={() => handleQuickAction(action)}
                      className={cn(
                        "group text-left rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all",
                        !action.mode && "opacity-70",
                      )}
                    >
                      <div className={cn("h-9 w-9 rounded-lg grid place-items-center mb-3", action.accent)}>
                        <action.icon className="h-4.5 w-4.5" />
                      </div>
                      <p className="text-sm font-medium leading-snug">{action.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">{action.description}</p>
                      <ArrowUp className="h-3.5 w-3.5 mt-3 rotate-45 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </div>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">A IA pode acessar seus módulos:</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {MODULES.map((m) => (
                      <span
                        key={m.label}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
                      >
                        <m.icon className="h-3 w-3" />
                        {m.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-4">
                {turnsToShow!.map((turn, i) => (
                  <div key={i} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                        turn.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm",
                      )}
                    >
                      {turn.text}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {mode === "objectives" && objectivesSession?.draft && objectivesSession.draft.length > 0 && objectivesSession.status === "active" && (
            <div className="border-t border-border bg-muted/30 p-4">
              <div className="max-w-5xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Plano proposto ({objectivesSession.draft.length} item{objectivesSession.draft.length === 1 ? "" : "s"})
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                  {objectivesSession.draft.map((objective, i) => (
                    <div key={i} className="rounded-lg border border-border bg-card px-3 py-2">
                      <p className="text-sm font-medium">
                        {objective.kind === "task" && <span className="text-muted-foreground">Tarefa: </span>}
                        {objective.title}
                      </p>
                      {objective.dueDate && (
                        <p className="text-xs text-muted-foreground">Prazo: {objective.dueDate}</p>
                      )}
                      {objective.tasks.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {objective.tasks.map((task, j) => (
                            <li key={j} className="text-xs text-muted-foreground pl-3 border-l border-border">
                              {task.title}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedColumnId} onValueChange={setSelectedColumnId}>
                    <SelectTrigger className="h-9 flex-1 max-w-52">
                      <SelectValue placeholder="Coluna do board" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleConfirmObjectives} disabled={confirming || !selectedColumnId}>
                    {confirming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirmar plano
                  </Button>
                </div>
              </div>
            </div>
          )}

          {mode === "objectives" && objectivesSession?.status === "confirmed" && (
            <div className="border-t border-border bg-success/10 p-4 text-center">
              <p className="text-sm text-success">Plano confirmado e criado no board de Objetivos.</p>
            </div>
          )}

          {mode === "workspace" && workspaceSession?.draft && workspaceSession.status === "active" && (
            <div className="border-t border-border bg-muted/30 p-4">
              <div className="max-w-5xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Página proposta
                </p>
                <div className="rounded-lg border border-border bg-card p-3 mb-3">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <span>{workspaceSession.draft.icon}</span>
                    {workspaceSession.draft.title}
                  </p>
                  {workspaceSession.draft.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{workspaceSession.draft.description}</p>
                  )}
                  <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground font-sans border-t border-border pt-2">
                    {workspaceSession.draft.markdown}
                  </pre>
                </div>
                <Button size="sm" onClick={handleConfirmWorkspacePage} disabled={confirming}>
                  {confirming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Criar página no Workspace
                </Button>
              </div>
            </div>
          )}

          {mode === "workspace" && workspaceSession?.status === "confirmed" && (
            <div className="border-t border-border bg-success/10 p-4 text-center">
              <p className="text-sm text-success">Página criada no Workspace.</p>
            </div>
          )}

          <div className="border-t border-border p-4">
            <div className="max-w-5xl mx-auto">
              {hasMessages && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    {mode === "objectives" ? "Criando objetivos/tarefas" : "Montando página no Workspace"}
                  </span>
                  <button
                    onClick={handleNewConversation}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Nova conversa
                  </button>
                </div>
              )}
              <div className="flex items-end gap-1.5 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
                <button
                  onClick={() => toast.info(NOT_AVAILABLE_MSG)}
                  className="h-8 w-8 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Mais opções"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onFocus={() => setMode((m) => m ?? "objectives")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(inputValue);
                    }
                  }}
                  placeholder={mode ? MODE_PLACEHOLDER[mode] : "Peça para criar tarefas, mapas mentais, páginas ou análises…"}
                  rows={1}
                  className="flex-1 resize-none bg-transparent outline-none text-sm py-1.5 max-h-32 placeholder:text-muted-foreground"
                />
                <button
                  onClick={() => toast.info(NOT_AVAILABLE_MSG)}
                  className="h-8 w-8 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Anexar arquivo"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toast.info("Gravação por voz vem numa próxima etapa — por enquanto, digite.")}
                  className="h-8 w-8 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Gravar áudio"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleSend(inputValue)}
                  disabled={!inputValue.trim() || sending || !canSend}
                  className="h-8 w-8 shrink-0 grid place-items-center rounded-full bg-foreground text-background disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Enviar"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.title}
                    onClick={() => handleQuickAction(action)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      mode === action.mode && action.mode
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <action.icon className="h-3 w-3" />
                    {action.chipLabel}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside className="w-full lg:w-80 shrink-0 space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Histórico recente</h3>
          </div>
          {recentObjectives.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum objetivo criado pela IA ainda.</p>
          ) : (
            <div className="space-y-3">
              {recentObjectives.map((o) => (
                <div key={o.id} className="flex items-start gap-2.5">
                  <div className="h-7 w-7 shrink-0 rounded-lg bg-destructive/10 text-destructive grid place-items-center">
                    <CheckSquare className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-snug">Objetivo criado</p>
                    <p className="text-xs text-muted-foreground leading-snug truncate">"{o.title}"</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{formatHistoryTime(o.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-2">Contexto atual</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A IA usa o histórico dessa conversa e os nomes da sua equipe pra sugerir responsáveis e prazos com mais
            precisão.
          </p>
        </div>

        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-warning-foreground dark:text-warning">
              <Lightbulb className="h-3.5 w-3.5" />
              <h3 className="text-sm font-semibold">Dica do dia</h3>
            </div>
            <button
              onClick={() => setTipIndex((i) => (i + 1) % TIPS.length)}
              className="h-6 w-6 grid place-items-center rounded hover:bg-accent text-muted-foreground"
              title="Outra dica"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">"{TIPS[tipIndex]}"</p>
        </div>
      </aside>
    </div>
  );
}
