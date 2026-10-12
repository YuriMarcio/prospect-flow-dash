import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Sprint } from "@/lib/objectives";
import { parseLocalDate, toIsoDate } from "@/lib/objectiveMeta";

export interface SprintFormValues {
  name: string;
  startDate: string;
  endDate: string;
}

function initialValues(sprint: Sprint | null, suggestedName: string): SprintFormValues {
  if (sprint) return { name: sprint.name, startDate: sprint.startDate, endDate: sprint.endDate };
  // Sugestão de uma semana começando hoje — o período é livre, é só um ponto de partida.
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { name: suggestedName, startDate: toIsoDate(start), endDate: toIsoDate(end) };
}

/** Cria (sprint = null) ou edita uma sprint, com o período definido de/até. */
export function SprintDialog({
  open,
  onOpenChange,
  sprint,
  suggestedName,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint: Sprint | null;
  suggestedName: string;
  submitting: boolean;
  onSubmit: (values: SprintFormValues) => void;
}) {
  const [values, setValues] = useState<SprintFormValues>(() => initialValues(sprint, suggestedName));

  useEffect(() => {
    if (open) setValues(initialValues(sprint, suggestedName));
    // Só reinicia ao abrir (ou ao trocar de sprint) — não a cada digitação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sprint?.id]);

  const rangeInvalid = Boolean(values.startDate && values.endDate && values.endDate < values.startDate);
  const canSubmit = values.name.trim() && values.startDate && values.endDate && !rangeInvalid;

  function setStart(startDate: string) {
    // Empurra o fim junto se o início passar dele, em vez de deixar o formulário inválido.
    setValues((v) => ({ ...v, startDate, endDate: v.endDate && v.endDate < startDate ? startDate : v.endDate }));
  }

  const durationDays =
    values.startDate && values.endDate && !rangeInvalid
      ? Math.round((parseLocalDate(values.endDate).getTime() - parseLocalDate(values.startDate).getTime()) / 86_400_000) + 1
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit({ ...values, name: values.name.trim() });
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{sprint ? "Editar sprint" : "Nova sprint"}</DialogTitle>
            <DialogDescription>Defina o nome e de quando a quando a sprint acontece.</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label className="text-xs">Nome da sprint *</Label>
            <Input
              autoFocus
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              placeholder="Ex.: Sprint 03"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Início *</Label>
              <Input type="date" value={values.startDate} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fim *</Label>
              <Input
                type="date"
                min={values.startDate || undefined}
                value={values.endDate}
                onChange={(e) => setValues((v) => ({ ...v, endDate: e.target.value }))}
              />
            </div>
          </div>

          {rangeInvalid ? (
            <p className="text-xs text-destructive">O fim da sprint não pode ser antes do início.</p>
          ) : (
            durationDays !== null && (
              <p className="text-xs text-muted-foreground">
                Duração: {durationDays} {durationDays === 1 ? "dia" : "dias"}
              </p>
            )
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit || submitting}>
              {sprint ? "Salvar sprint" : "Criar sprint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
