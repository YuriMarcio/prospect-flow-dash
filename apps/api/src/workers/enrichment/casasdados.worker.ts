import axios from "axios";
import { LeadDataType } from "@leadflow/types";

export async function enrichWithCNPJ(cnpj: string): Promise<Partial<LeadDataType> | null> {
  // 1. Limpa o CNPJ (remove pontos, barras e traços)
  const cleanCnpj = cnpj.replace(/\D/g, "");

  if (!cleanCnpj || cleanCnpj.length !== 14) {
    console.log(`[FISCAL] CNPJ inválido ou ausente: ${cnpj}`);
    return null;
  }

  console.log(`[FISCAL] Buscando dados para o CNPJ: ${cleanCnpj}...`);

  try {
    // Usando a BrasilAPI (Gratuita, rápida e sem limite agressivo)
    const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      timeout: 10000 // 10 segundos de timeout para não travar o robô
    });

    const data = response.data;

    // 2. Extraindo e formatando os nomes dos sócios (QSA)
    let partnersString = null;
    if (data.qsa && data.qsa.length > 0) {
      // Mapeia o array de sócios e junta os nomes com vírgula
      partnersString = data.qsa.map((socio: any) => socio.nome_socio).join(", ");
    }

    // 3. Montando o objeto de retorno (Partial<LeadDataType> significa que só tem alguns campos da interface)
    const fiscalData: Partial<LeadDataType> = {
      company_name: data.razao_social,
      partners: partnersString,
      fiscal_phones: data.ddd_telefone_1 || null, // A API geralmente retorna DDD + Telefone juntos
      fiscal_emails: data.email || null,
    };

    console.log(`[FISCAL] Sucesso! Empresa: ${fiscalData.company_name} | Sócios: ${fiscalData.partners}`);
    return fiscalData;

  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      console.log(`[FISCAL] CNPJ ${cleanCnpj} não encontrado na Receita.`);
    } else {
      console.error(`[FISCAL] Erro ao buscar CNPJ ${cleanCnpj}:`, error.message);
    }
    return null;
  }
}