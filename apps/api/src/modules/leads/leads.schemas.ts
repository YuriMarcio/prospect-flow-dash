import { z } from "zod";

const optionalText = z.string().trim().optional().nullable();

/** Cadastro manual de lead (Kanban geral ou painel de uma campanha). */
export const createLeadSchema = z.object({
  name: z.string({ required_error: "Informe o nome do lead." }).trim().min(1, "Informe o nome do lead."),
  whatsapp: optionalText,
  instagram: optionalText,
  city: optionalText,
  category: optionalText,
  address: optionalText,
  notes: optionalText,
  /** Campanha (painel do território) que recebe o lead. Sem isso ele fica no Kanban geral. */
  prospectingCampaignId: z.string().min(1).optional().nullable(),
  status: z.enum(["novo", "contato", "qualificado", "negociacao", "ganho", "perdido"]).optional(),
  columnId: z.string().min(1).optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
