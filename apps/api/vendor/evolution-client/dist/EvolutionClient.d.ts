import type { CarouselCard, CreateInstanceOptions, EvolutionClientConfig, IEvolutionClient, InstanceStatus, ListSection, ReplyButton, WebhookOptions } from './contracts/types.js';
export declare class EvolutionClient implements IEvolutionClient {
    private readonly http;
    private readonly throwOnError;
    constructor(config: EvolutionClientConfig);
    private post;
    private get;
    private delete;
    createInstance(options: CreateInstanceOptions): Promise<Record<string, unknown>>;
    setWebhook(instanceName: string, options: WebhookOptions): Promise<Record<string, unknown>>;
    getQrCode(instanceName: string): Promise<Record<string, unknown>>;
    getInstanceStatus(instanceName: string): Promise<InstanceStatus>;
    deleteInstance(instanceName: string): Promise<Record<string, unknown>>;
    /**
     * Valida em lote quais números existem no WhatsApp.
     * Retorna apenas os válidos, limpos (sem @s.whatsapp.net).
     *
     * Sempre chame isso antes de qualquer disparo em lote —
     * enviar para números inexistentes aumenta o score de ban da instância Baileys.
     *
     * @example
     * const valid = await client.checkNumbers('prospeccao-01', ['5598999990000', '5511000000000']);
     * // → ['5598999990000']
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
//# sourceMappingURL=EvolutionClient.d.ts.map