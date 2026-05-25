import axios from "axios";
import { findInstagramProfile } from "../instagram/instagram.search";
import { parseInstagramBio } from "../instagram/instagram.parser";
import { LeadDataType } from "@leadflow/types";
import { enrichWithCNPJ } from "../enrichment/casasdados.worker";
import * as leadsRepository from "../../modules/leads/leads.repository";

// Função utilitária para pausar a execução (ajuda a não sobrecarregar suas APIs de enriquecimento)
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function runIfoodScraping(
  campaignId: string,
  zipCode: string, // ⚠️ MUDANÇA AQUI: Recebendo o CEP em vez do endereço por extenso
  category: string,
  quantity: number,
) {
  console.log(`[WORKER] Iniciando campanha ${campaignId} via GECKO API`);

  // Limpa o CEP para garantir que só tenham números para a API da Gecko
  const cleanZipCode = zipCode.replace(/\D/g, "");

  try {
    // 1. Faz a requisição para a Gecko API
    console.log(`[WORKER] Buscando categoria '${category}' no CEP '${cleanZipCode}'...`);
    const response = await axios.post(
      "https://api.geckoapi.com.br/v1/extract",
      {
        target: "ifood.com.br",
        type: "plp", // Página de Listagem de Produtos/Restaurantes
        page: 1,
        keyword: category, 
        zipCode: cleanZipCode,
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.GECKO_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Ajuste o caminho se a Gecko retornar os dados dentro de outra propriedade (ex: response.data.results)
    const results = response.data.data || response.data.results || response.data;

    if (!Array.isArray(results) || results.length === 0) {
      console.log(`[WORKER] Nenhum restaurante encontrado pela Gecko API.`);
      return;
    }

    // 2. Limita a quantidade de resultados
    const limit = Math.min(results.length, quantity);
    const restaurantsToProcess = results.slice(0, limit);
    
    console.log(`[WORKER] Encontrados ${results.length} restaurantes. Processando ${limit}...`);

    // 3. Itera sobre os resultados da Gecko API
    for (const item of restaurantsToProcess) {
      // Mapeamento dos dados (Você deve validar o console.log da Gecko para confirmar os nomes das chaves)
      const leadData: LeadDataType = {
        name: item.name || item.title || "Nome não informado",
        description: item.description || "",
        cnpj: item.cnpj || "Não informado", 
        address: item.address || item.location || "",
        ifood_url: item.url || (item.slug ? `https://www.ifood.com.br/delivery/brasil/${item.slug}` : ""),
      };

      console.log(`[WORKER] Extraindo dados do lead: ${leadData.name}`);

      // --- ENRIQUECIMENTO ---

      // ⚠️ ATENÇÃO: Como não usamos mais Playwright, passei 'null' no lugar do 'page'
      // Você precisará adaptar o 'findInstagramProfile' para usar Axios/Fetch em vez do Playwright
      const instaResult = await findInstagramProfile(
        null as any, 
        leadData.name,
        leadData.address
      );

      if (instaResult) {
        leadData.instagram_url = instaResult.url;
        const parsedBio = parseInstagramBio(instaResult.bioSnippet);
        leadData.whatsapp = parsedBio.whatsapp;
        leadData.linktree = parsedBio.linktree;
        leadData.digital_menu = parsedBio.digitalMenu;
      }

      if (leadData.cnpj && leadData.cnpj !== "Não informado") {
        const fiscalData = await enrichWithCNPJ(leadData.cnpj);
        if (fiscalData) Object.assign(leadData, fiscalData);
      }

      // --- SALVAMENTO ---
      const result = await leadsRepository.createUnique({
        campaign_id: campaignId,
        category,
        ...leadData,
      });

      if (result.created) {
        console.log(`[WORKER] LEAD SALVO: ${leadData.name}`);
      } else {
        console.log(`[WORKER] LEAD REPETIDO IGNORADO: ${leadData.name}`);
      }

      // Pausa leve entre requisições de enriquecimento (Google/CasasDados)
      await delay(1500); 
    }

  } catch (error: any) {
    console.error(
      `[WORKER] Erro crítico no scraping via Gecko API:`, 
      error.response?.data || error.message
    );
  } finally {
    console.log(`[WORKER] Campanha ${campaignId} finalizada.`);
  }
}

// ❌ TODAS AS FUNÇÕES ESPECIALISTAS DO PLAYWRIGHT FORAM DELETADAS. 
// (setupAddress, selectCategory, collectRestaurantLinks, extractRestaurantData)