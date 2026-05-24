export interface LeadDataType {
  // --- Dados Base (iFood) ---
  name: string;
  description: string;
  cnpj: string;
  address: string;
  ifood_url: string;
  
  // --- Dados Sociais (Instagram) ---
  instagram_url?: string;
  whatsapp?: string | null;
  linktree?: string | null;
  digital_menu?: string | null;

  // --- Dados Fiscais (Casa dos Dados / Receita) ---
  company_name?: string | null; // Razão Social verdadeira
  partners?: string | null;     // Quadro de Sócios (Nomes)
  fiscal_phones?: string | null;// Telefones atrelados ao CNPJ
  fiscal_emails?: string | null;// Emails atrelados ao CNPJ
}