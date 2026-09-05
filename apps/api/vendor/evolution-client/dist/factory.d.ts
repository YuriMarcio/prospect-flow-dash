import { EvolutionClient } from './EvolutionClient.js';
import type { EvolutionClientConfig } from './contracts/types.js';
/**
 * Cria um EvolutionClient a partir de variáveis de ambiente.
 *
 * Variáveis esperadas:
 *   EVOLUTION_API_URL      → URL base da instância Evolution
 *   EVOLUTION_API_KEY      → API key global
 *   EVOLUTION_THROW_ON_ERROR → "true" para lançar exceção em erros (default: false)
 *   EVOLUTION_TIMEOUT_MS   → timeout em ms (default: 15000)
 *
 * @example
 * // No projeto de prospecção:
 * import { createEvolutionClient } from '@sinal/evolution-client';
 * const client = createEvolutionClient();
 *
 * // Ou com config explícita:
 * const client = createEvolutionClient({
 *   baseUrl: 'https://evolution.seudominio.com',
 *   apiKey: process.env.EVOLUTION_API_KEY!,
 *   throwOnError: true,
 * });
 */
export declare function createEvolutionClient(config?: Partial<EvolutionClientConfig>): EvolutionClient;
//# sourceMappingURL=factory.d.ts.map