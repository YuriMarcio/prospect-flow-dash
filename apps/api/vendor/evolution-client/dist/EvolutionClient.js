import axios from 'axios';
import { EvolutionApiError } from './exceptions/EvolutionApiError.js';
export class EvolutionClient {
    http;
    throwOnError;
    constructor(config) {
        this.throwOnError = config.throwOnError ?? false;
        this.http = axios.create({
            baseURL: config.baseUrl.replace(/\/$/, ''),
            timeout: config.timeout ?? 15_000,
            headers: {
                apikey: config.apiKey,
                'Content-Type': 'application/json',
            },
        });
    }
    // ==========================================================================
    // HTTP base
    // ==========================================================================
    async post(endpoint, payload = {}) {
        try {
            const res = await this.http.post(endpoint, payload);
            return res.data;
        }
        catch (err) {
            if (axios.isAxiosError(err) && err.response) {
                const error = EvolutionApiError.fromResponse(endpoint, err.response.status, err.response.data);
                if (this.throwOnError)
                    throw error;
                // silencioso: loga e retorna vazio
                console.error(`[EvolutionClient] ${error.message}`);
                return {};
            }
            throw err;
        }
    }
    async get(endpoint) {
        try {
            const res = await this.http.get(endpoint);
            return res.data;
        }
        catch (err) {
            if (axios.isAxiosError(err) && err.response) {
                const error = EvolutionApiError.fromResponse(endpoint, err.response.status, err.response.data);
                if (this.throwOnError)
                    throw error;
                console.error(`[EvolutionClient] ${error.message}`);
                return {};
            }
            throw err;
        }
    }
    async delete(endpoint) {
        try {
            const res = await this.http.delete(endpoint);
            return res.data;
        }
        catch (err) {
            if (axios.isAxiosError(err) && err.response) {
                const error = EvolutionApiError.fromResponse(endpoint, err.response.status, err.response.data);
                if (this.throwOnError)
                    throw error;
                console.error(`[EvolutionClient] ${error.message}`);
                return {};
            }
            throw err;
        }
    }
    // ==========================================================================
    // Instâncias
    // ==========================================================================
    async createInstance(options) {
        return this.post('/instance/create', {
            instanceName: options.instanceName,
            qrcode: options.qrcode ?? true,
            integration: options.integration ?? 'WHATSAPP-BAILEYS',
        });
    }
    async setWebhook(instanceName, options) {
        return this.post(`/webhook/set/${instanceName}`, {
            webhook: {
                enabled: options.enabled,
                url: options.url,
                events: options.events ?? ['MESSAGES_UPSERT'],
            },
        });
    }
    async getQrCode(instanceName) {
        return this.get(`/instance/connect/${instanceName}`);
    }
    async getInstanceStatus(instanceName) {
        return this.get(`/instance/connectionState/${instanceName}`);
    }
    async deleteInstance(instanceName) {
        return this.delete(`/instance/delete/${instanceName}`);
    }
    // ==========================================================================
    // Validação de números  ← chave para prospecção
    // ==========================================================================
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
    async checkNumbers(instanceName, numbers) {
        if (numbers.length === 0)
            return [];
        const results = await this.post(`/chat/whatsappNumbers/${instanceName}`, { numbers });
        if (!Array.isArray(results)) {
            console.warn('[EvolutionClient] checkNumbers: resposta inesperada', results);
            return [];
        }
        return results
            .filter((item) => item.exists === true)
            .map((item) => item.jid.replace('@s.whatsapp.net', ''));
    }
    // ==========================================================================
    // Mensagens
    // ==========================================================================
    async sendText(instanceName, number, text, delay = 1200) {
        return this.post(`/message/sendText/${instanceName}`, { number, text, delay });
    }
    async sendImage(instanceName, number, imageUrl, caption = '') {
        return this.post(`/message/sendMedia/${instanceName}`, {
            number,
            mediatype: 'image',
            media: imageUrl,
            caption,
        });
    }
    async sendAudio(instanceName, number, audioUrl) {
        return this.post(`/message/sendWhatsAppAudio/${instanceName}`, { number, audio: audioUrl });
    }
    async sendDocument(instanceName, number, documentUrl, fileName) {
        return this.post(`/message/sendMedia/${instanceName}`, {
            number,
            mediatype: 'document',
            media: documentUrl,
            fileName,
        });
    }
    async sendButtons(instanceName, number, title, description, footer, buttons) {
        return this.post(`/message/sendButtons/${instanceName}`, {
            number,
            title,
            description,
            footer,
            buttons,
            delay: 1000,
        });
    }
    async sendButtonsWithImage(instanceName, number, title, description, imageUrl, buttons) {
        return this.post(`/message/sendButtons/${instanceName}`, {
            number,
            thumbnailUrl: imageUrl,
            title,
            description,
            buttons,
            delay: 1000,
        });
    }
    async sendCarousel(instanceName, number, body, cards) {
        console.info(`[EvolutionClient] Enviando carrossel para ${number} com ${cards.length} cards`);
        return this.post(`/message/sendCarousel/${instanceName}`, { number, body, cards, delay: 1000 });
    }
    async sendList(instanceName, number, title, description, buttonText, footer, sections) {
        return this.post(`/message/sendList/${instanceName}`, {
            number,
            title,
            description,
            buttonText,
            footerText: footer,
            sections,
        });
    }
    async sendReaction(instanceName, number, messageId, emoji) {
        return this.post(`/message/sendReaction/${instanceName}`, {
            reactionMessage: {
                key: {
                    remoteJid: `${number}@s.whatsapp.net`,
                    fromMe: false,
                    id: messageId,
                },
                reaction: emoji,
            },
        });
    }
}
//# sourceMappingURL=EvolutionClient.js.map