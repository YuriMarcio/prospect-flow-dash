import * as campaignsRepository from "./prospecting-campaigns.repository";
import * as prospectorRepository from "../prospector/prospector.repository";
import * as queueRepository from "../prospector/queue.repository";
import * as messagesRepository from "../prospector/messages.repository";
import { getEffectiveDailyLimit, isWarmingDone } from "../../workers/prospector/warming";
import {
  startSessionForCampaign,
  stopSessionForCampaign,
} from "../../workers/prospector/session.worker";

const WEEKDAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

const DEFAULT_SCHEDULE = {
  dom: { enabled: false, limit: 0 },
  seg: { enabled: true, limit: 80 },
  ter: { enabled: true, limit: 80 },
  qua: { enabled: true, limit: 80 },
  qui: { enabled: true, limit: 80 },
  sex: { enabled: true, limit: 80 },
  sab: { enabled: false, limit: 0 },
};

function formatDateBR(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

export async function listCampaignsService() {
  return campaignsRepository.findAll();
}

export async function getCampaignService(id: string) {
  const campaign = await campaignsRepository.findById(id);
  if (!campaign) throw new Error("Campanha não encontrada.");
  return campaign;
}

export async function createCampaignService(input: {
  region: string;
  segment: string | null;
  ownerUserId: string;
  createdByUserId: string;
  filters?: { cities: string[]; segments: string[] };
  schedule?: Record<string, { enabled: boolean; limit: number }>;
  windowStart?: string;
  windowEnd?: string;
}) {
  const name = `Campanha | ${input.region} | ${formatDateBR(new Date())}`;

  return campaignsRepository.create({
    name,
    ownerUserId: input.ownerUserId,
    createdByUserId: input.createdByUserId,
    region: input.region,
    segment: input.segment,
    filters: input.filters ?? { cities: input.region ? [input.region] : [], segments: input.segment ? [input.segment] : [] },
    schedule: input.schedule ?? DEFAULT_SCHEDULE,
    windowStart: input.windowStart ?? "08:00",
    windowEnd: input.windowEnd ?? "18:00",
  });
}

export async function updateCampaignService(id: string, patch: Record<string, unknown>) {
  return campaignsRepository.update(id, patch);
}

export async function toggleCampaignService(id: string) {
  return campaignsRepository.toggleActive(id);
}

export async function getCampaignStatusService(campaignId: string) {
  const campaign = await campaignsRepository.findById(campaignId);
  if (!campaign) throw new Error("Campanha não encontrada.");

  const instance = await prospectorRepository.findInstanceByChannel("whatsapp", campaign.owner_user_id);
  const connected = instance?.status === "connected";

  const todayKey = WEEKDAY_KEYS[new Date().getDay()];
  const dayConfig = campaign.schedule[todayKey];
  const todayLimit = instance && dayConfig ? getEffectiveDailyLimit(instance, dayConfig) : 0;
  const todayCount = await queueRepository.countToday(campaignId, "sent");
  const queueSize = await queueRepository.countToday(campaignId, "waiting");
  const activeMessage = await messagesRepository.findActive(campaignId);

  return {
    connected,
    is_active: campaign.is_active,
    todayCount,
    todayLimit,
    queueSize,
    activeMessage,
    warmingDone: instance ? isWarmingDone(instance) : true,
    filters: campaign.filters,
    sessionMode: campaign.session_mode,
    sessionStartAt: campaign.session_start_at,
    sessionEndAt: campaign.session_end_at,
  };
}

export { startSessionForCampaign as startCampaignSessionService, stopSessionForCampaign as stopCampaignSessionService };
