import "dotenv/config";

import { createEvolutionClient, type EvolutionClient } from "@sinal/evolution-client";

let client: EvolutionClient | null = null;

export function getEvolutionClient(): EvolutionClient {
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
    throw new Error(
      "Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no .env para usar o bot de prospecção.",
    );
  }

  // throwOnError vem do env EVOLUTION_THROW_ON_ERROR=true (configurado no .env)
  client ??= createEvolutionClient();
  return client;
}
