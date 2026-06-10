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