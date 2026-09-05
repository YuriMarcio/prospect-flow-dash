export declare class EvolutionApiError extends Error {
    readonly endpoint: string;
    readonly statusCode: number;
    readonly responseBody: unknown;
    constructor(message: string, endpoint: string, statusCode: number, responseBody?: unknown);
    static fromResponse(endpoint: string, status: number, body: unknown): EvolutionApiError;
}
//# sourceMappingURL=EvolutionApiError.d.ts.map