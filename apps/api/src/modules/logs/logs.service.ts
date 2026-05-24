import * as logsRepository from "./logs.repository";

export async function getCampaignLogsService(campaignId: string) {
  return await logsRepository.findByCampaignId(campaignId);
}