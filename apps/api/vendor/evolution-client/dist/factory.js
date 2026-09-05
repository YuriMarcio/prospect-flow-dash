import { EvolutionClient } from './EvolutionClient.js';
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
export function createEvolutionClient(config) {
    const baseUrl = config?.baseUrl ?? process.env['EVOLUTION_API_URL'];
    const apiKey = config?.apiKey ?? process.env['EVOLUTION_API_KEY'];
    if (!baseUrl)
        throw new Error('[EvolutionClient] EVOLUTION_API_URL não definida');
    if (!apiKey)
        throw new Error('[EvolutionClient] EVOLUTION_API_KEY não definida');
    return new EvolutionClient({
        baseUrl,
        apiKey,
        throwOnError: config?.throwOnError ?? process.env['EVOLUTION_THROW_ON_ERROR'] === 'true',
        timeout: config?.timeout ?? Number(process.env['EVOLUTION_TIMEOUT_MS'] ?? 15_000),
    });
}
//# sourceMappingURL=factory.js.map