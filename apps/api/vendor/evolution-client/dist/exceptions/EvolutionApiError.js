export class EvolutionApiError extends Error {
    endpoint;
    statusCode;
    responseBody;
    constructor(message, endpoint, statusCode, responseBody = null) {
        super(message);
        this.endpoint = endpoint;
        this.statusCode = statusCode;
        this.responseBody = responseBody;
        this.name = 'EvolutionApiError';
        // Mantém stack trace correto no Node
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, EvolutionApiError);
        }
    }
    static fromResponse(endpoint, status, body) {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        return new EvolutionApiError(`Evolution API error [${status}] on ${endpoint}: ${bodyStr}`, endpoint, status, body);
    }
}
//# sourceMappingURL=EvolutionApiError.js.map