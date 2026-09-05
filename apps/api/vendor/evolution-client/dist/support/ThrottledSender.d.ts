export interface ThrottledSenderOptions {
    /** Delay mínimo em ms entre disparos. Default: 8000 */
    minMs?: number;
    /** Delay máximo em ms entre disparos. Default: 15000 */
    maxMs?: number;
}
export interface BatchResult<T> {
    item: T;
    response: unknown;
    error: string | null;
}
export interface BatchCallbacks<T> {
    onSent?: (item: T, response: unknown, index: number, total: number) => void;
    onError?: (item: T, error: Error, index: number) => void;
}
export declare class ThrottledSender {
    private readonly minMs;
    private readonly maxMs;
    constructor(options?: ThrottledSenderOptions);
    private delay;
    batch<T>(items: T[], callback: (item: T) => Promise<unknown>, callbacks?: BatchCallbacks<T>): Promise<BatchResult<T>[]>;
    estimateSeconds(count: number): {
        minSeconds: number;
        maxSeconds: number;
    };
}
//# sourceMappingURL=ThrottledSender.d.ts.map