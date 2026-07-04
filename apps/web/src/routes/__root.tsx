import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  redirect,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AppLayout } from "@/layouts/AppLayout";
import { LeadModal } from "@/components/LeadModal";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página não encontrada.</p>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/login") return;
    // O cookie de sessão pertence ao domínio da API, não ao do web app, e o
    // localStorage não existe durante o SSR — então não há como validar a
    // sessão no servidor. Só checamos no cliente (lendo o localStorage
    // diretamente, sem depender do timing de hidratação do Zustand) e
    // deixamos o SSR passar; se não estiver autenticado, o próprio cliente
    // redireciona logo após montar.
    if (typeof window === "undefined") return;

    let authenticated = false;
    try {
      const raw = window.localStorage.getItem("crm-auth");
      authenticated = raw ? JSON.parse(raw)?.state?.isAuthenticated === true : false;
    } catch {
      authenticated = false;
    }

    if (!authenticated) {
      throw redirect({ to: "/login" });
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ProspectAI — CRM Cold Call" },
      { name: "description", content: "CRM moderno para prospecção cold call de negócios locais." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLoginRoute = pathname === "/login";

  return (
    <QueryClientProvider client={queryClient}>
      {isLoginRoute ? <Outlet /> : <AppLayout />}
      <LeadModal />
      <Toaster />
    </QueryClientProvider>
  );
}
