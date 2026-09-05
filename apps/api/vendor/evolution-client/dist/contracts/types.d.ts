export interface EvolutionClientConfig {
    baseUrl: string;
    apiKey: string;
    /** Lançar EvolutionApiError em respostas 4xx/5xx. Default: false */
    throwOnError?: boolean;
    /** Timeout em ms. Default: 15000 */
    timeout?: number;
}
export interface CreateInstanceOptions {
    instanceName: string;
    qrcode?: boolean;
    integration?: 'WHATSAPP-BAILEYS' | 'WHATSAPP-BUSINESS';
}
export interface WebhookOptions {
    enabled: boolean;
    url: string;
    events?: string[];
}
export interface InstanceStatus {
    instance: {
        instanceName: string;
        state: 'open' | 'close' | 'connecting';
    };
}
export interface WhatsAppNumberResult {
    jid: string;
    exists: boolean;
}
export interface ReplyButton {
    type: 'reply';
    displayText: string;
    id: string;
}
export interface CarouselCard {
    title?: string;
    body: string;
    footer?: string;
    imageUrl?: string;
    buttons: ReplyButton[];
}
export interface ListSection {
    title: string;
    rows: Array<{
        title: string;
        description?: string;
        rowId: string;
    }>;
}
export interface IEvolutionClient {
    createInstance(options: CreateInstanceOptions): Promise<Record<string, unknown>>;
    setWebhook(instanceName: string, options: WebhookOptions): Promise<Record<string, unknown>>;
    getQrCode(instanceName: string): Promise<Record<string, unknown>>;
    getInstanceStatus(instanceName: string): Promise<InstanceStatus>;
    deleteInstance(instanceName: string): Promise<Record<string, unknown>>;
    /**
     * Valida em lote quais números existem no WhatsApp.
     * Retorna apenas os números válidos, limpos (sem @s.whatsapp.net).
     */
    checkNumbers(instanceName: string, numbers: string[]): Promise<string[]>;
    sendText(instanceName: string, number: string, text: string, delay?: number): Promise<unknown>;
    sendImage(instanceName: string, number: string, imageUrl: string, caption?: string): Promise<unknown>;
    sendAudio(instanceName: string, number: string, audioUrl: string): Promise<unknown>;
    sendDocument(instanceName: string, number: string, documentUrl: string, fileName: string): Promise<unknown>;
    sendButtons(instanceName: string, number: string, title: string, description: string, footer: string, buttons: ReplyButton[]): Promise<unknown>;
    sendButtonsWithImage(instanceName: string, number: string, title: string, description: string, imageUrl: string, buttons: ReplyButton[]): Promise<unknown>;
    sendCarousel(instanceName: string, number: string, body: string, cards: CarouselCard[]): Promise<unknown>;
    sendList(instanceName: string, number: string, title: string, description: string, buttonText: string, footer: string, sections: ListSection[]): Promise<unknown>;
    sendReaction(instanceName: string, number: string, messageId: string, emoji: string): Promise<unknown>;
}
//# sourceMappingURL=types.d.ts.map