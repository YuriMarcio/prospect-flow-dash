// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only, disabled below),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Deploy target é a Vercel, não o Cloudflare Workers (que o wrapper Lovable usa por padrão) —
// desligamos o plugin do Cloudflare e plugamos o preset "vercel" do nitro no lugar dele.
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
  plugins: [nitro({ preset: "vercel" })],
  vite: {
    define: {
      // A Vercel expõe o SHA do commit pro processo de build automaticamente —
      // isso vira uma string fixa no bundle, pra dar pra ver na tela qual
      // deploy está realmente no ar.
      __APP_COMMIT__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev"),
      __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
    },
  },
});
