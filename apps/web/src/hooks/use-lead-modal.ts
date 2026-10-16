import { useCallback } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";

/**
 * O detalhe do lead vive na URL (`?lead=<id>`) em vez de num estado solto na memória. Assim:
 *  - o botão/gesto de voltar do celular fecha o detalhe e deixa o usuário na tela de onde veio;
 *  - o X faz o mesmo (volta no histórico), em vez de deixar o app num lugar imprevisível;
 *  - recarregar a página (ou o app voltar do WhatsApp) reabre o detalhe onde estava.
 */
const PARAM = "lead";
/** Marca a entrada de histórico que NÓS criamos ao abrir o detalhe; só ela pode ser desfeita com "voltar". */
const OPENED_HERE = "leadModalOpenedHere";

/** O `state` do histórico é tipado sem index signature; aqui só interessa a nossa marca. */
function wasOpenedHere(state: unknown): boolean {
  return (state as Record<string, unknown> | undefined)?.[OPENED_HERE] === true;
}

function readLeadId(search: unknown): string | null {
  const value = (search as Record<string, unknown> | undefined)?.[PARAM];
  // O parser de search do router transforma valores que parecem JSON (ex.: "123") em número
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

/** Id do lead cujo detalhe está aberto (null = fechado). */
export function useOpenLeadId(): string | null {
  return useRouterState({ select: (state) => readLeadId(state.location.search) });
}

export function useLeadModal() {
  const router = useRouter();

  const open = useCallback(
    (id: string) => {
      const { pathname, search, state } = router.state.location;
      const alreadyOpen = readLeadId(search) !== null;
      void router.navigate({
        to: pathname as never,
        search: { ...(search as Record<string, unknown>), [PARAM]: id } as never,
        // Abrir outro lead com um já aberto troca a entrada, pra um único "voltar" fechar tudo
        replace: alreadyOpen,
        state: { [OPENED_HERE]: alreadyOpen ? wasOpenedHere(state) : true } as never,
      });
    },
    [router],
  );

  const close = useCallback(() => {
    const { pathname, search, state } = router.state.location;
    if (readLeadId(search) === null) return;

    if (wasOpenedHere(state)) {
      router.history.back();
      return;
    }

    // Chegou direto com ?lead= (recarregou, voltou do WhatsApp): não há entrada nossa pra desfazer
    const { [PARAM]: _lead, ...rest } = search as Record<string, unknown>;
    void router.navigate({ to: pathname as never, search: rest as never, replace: true });
  }, [router]);

  return { open, close };
}
