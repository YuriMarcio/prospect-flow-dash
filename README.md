# 🚀 Como Rodar o LeadFlow

Guia simples para rodar o sistema no seu computador.

---

## ✅ Antes de começar — faça isso UMA VEZ só

### 1. Instale o Node.js
Acesse **https://nodejs.org** e baixe a versão **LTS** (o botão verde maior).

Instale normalmente como qualquer programa. Quando terminar, **reinicie o computador**.

---

## ▶️ Como rodar o sistema

### Windows
Dê **duplo clique** no arquivo `INICIAR.bat`

Duas janelas pretas vão abrir (são normais, não feche). O navegador abrirá sozinho em alguns segundos.

### Mac / Linux
Abra o Terminal dentro da pasta do projeto e execute:
```
./iniciar.sh
```
> Na primeira vez pode pedir permissão: execute `chmod +x iniciar.sh` antes.

---

## 🌐 Onde acessar

Depois de iniciar, abra o navegador em:

**http://localhost:5173**

---

## ⚙️ Configuração (apenas na primeira vez)

O arquivo `apps/api/.env` precisa ter as chaves do sistema. Ele é criado automaticamente na primeira execução, mas você precisa preenchê-lo.

Abra o arquivo `apps/api/.env` com o Bloco de Notas e preencha:

```
SUPABASE_URL=cole_aqui_a_url_do_supabase
SUPABASE_KEY=cole_aqui_a_chave_do_supabase
SERP_API_KEY=cole_aqui_a_chave_da_serpapi
```

Salve e rode o sistema normalmente.

### Limites de gasto da Descoberta (opcional)

Cada busca na SerpAPI e cada consulta de bio no ScrapeCreators gasta crédito. A Descoberta tem um limite por captura; se você não definir nada, valem os padrões abaixo. Para mudar, acrescente a linha no `apps/api/.env`:

```
DISCOVERY_MAX_SEARCH_REQUESTS=15    # buscas na SerpAPI (Instagram + Google Meu Negócio)
DISCOVERY_MAX_PAGES_PER_QUERY=3     # páginas por busca; só avança enquanto a anterior rendeu
DISCOVERY_MAX_LOOKUP_REQUESTS=20    # buscas do Instagram de um negócio pelo nome
DISCOVERY_MAX_ENRICH_CALLS=25       # consultas de bio no ScrapeCreators
DISCOVERY_SERP_NFPR=1               # 0 desliga o pedido para o Google não corrigir a busca
```

Ao fim de cada captura o log mostra um resumo com os créditos gastos por lead válido; use esse número para ajustar os limites.

Para guardar os candidatos que ficaram em dúvida (fila técnica) e os dados do Google Meu Negócio, rode uma vez o arquivo `apps/api/migrations/2026-10-13-discovery-sources.sql` no SQL Editor do Supabase. O sistema funciona sem ele, só não grava esses extras.

### Notificações de tarefas no celular/PWA (opcional)

O sistema avisa das tarefas pelo app instalado (PWA): o que vence hoje e o que está atrasado (manhã), sprint terminando, o que vence amanhã (tarde) e o que falta para fechar o dia (fim do dia). Para ligar:

1. Rode uma vez o arquivo `apps/api/migrations/2026-10-13-push-notifications.sql` no SQL Editor do Supabase.
2. Gere um par de chaves com `npx web-push generate-vapid-keys` e acrescente no `apps/api/.env` (na VPS, no `.env.docker`) e reinicie a API:

```
VAPID_PUBLIC_KEY=cole_aqui_a_chave_publica
VAPID_PRIVATE_KEY=cole_aqui_a_chave_privada
VAPID_SUBJECT=mailto:seu-email@exemplo.com    # opcional; sem ele usa o primeiro https de WEB_ORIGIN
APP_TIMEZONE=America/Sao_Paulo                # opcional; fuso dos horários dos avisos
```

3. Em **Configurações → Alertas de tarefas**, ative neste aparelho (no app instalado o sistema também convida a ativar). No iPhone/iPad só funciona com o app instalado na Tela de Início.

Guarde as chaves: se trocar o par, cada aparelho precisa abrir o app uma vez para se reinscrever. Sem as chaves a API sobe normalmente, só deixa as notificações desligadas.

---

## ❌ Para encerrar o sistema

**Windows:** Feche as duas janelas pretas que abriram (API e Web).

**Mac/Linux:** Pressione `Ctrl + C` no terminal onde iniciou.

---

## 🆘 Problemas comuns

**"Node.js não encontrado"**
→ Instale o Node.js em https://nodejs.org e reinicie o computador.

**O navegador abriu mas deu erro de conexão**
→ Aguarde mais alguns segundos e atualize a página. O sistema demora ~5 segundos para iniciar.

**Dados não aparecem / erro no dashboard**
→ Verifique se o arquivo `apps/api/.env` está preenchido corretamente.

---

*Em caso de dúvidas, entre em contato com quem te enviou o projeto.*