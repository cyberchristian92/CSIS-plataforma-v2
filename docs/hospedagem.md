# Hospedar o CSIS de graça (Oracle Cloud + DuckDNS)

Resultado: a plataforma no ar em `https://<seu-nome>.duckdns.org`, com HTTPS, cadastro, e-mail e
geração de PDF, num servidor que não custa nada.

| Peça | Serviço | Custo |
|---|---|---|
| Servidor (4 núcleos ARM, 24 GB de RAM, até 200 GB de disco) | Oracle Cloud "Always Free" | grátis, sem prazo |
| Endereço | DuckDNS (`algo.duckdns.org`) | grátis |
| HTTPS | Let's Encrypt, via Caddy (automático) | grátis |
| E-mail | Brevo (300 e-mails/dia) | grátis |

Por que a Oracle: é o único plano gratuito com memória e disco para o banco, uploads de vários GB
e o motor de PDF (TeX Live, ~5 GB). Render, Railway, Fly etc. no plano grátis não comportam.

Quando tiver domínio próprio (`.com.br`), basta apontá-lo para o mesmo IP e trocar `DOMINIO` no
`.env.prod` — ver [Trocar para domínio próprio](#trocar-para-domínio-próprio).

**Sem servidor na nuvem?** Dá para hospedar no seu notebook ou num PC em casa, mesmo sem IP
público (CGNAT) — ver [Alternativa: sua própria máquina + túnel](#alternativa-sua-própria-máquina--túnel).

---

## 1. Criar a conta na Oracle Cloud

1. Acesse <https://www.oracle.com/br/cloud/free/> → **Comece gratuitamente**.
2. **Região inicial (home region)**: escolha com cuidado, não dá para trocar depois. Para o
   Brasil, `Brazil East (São Paulo)` ou `Brazil Southeast (Vinhedo)`.
3. O cadastro pede cartão de crédito **só para verificação** (pode aparecer uma cobrança
   temporária de ~US$ 1, estornada). Nada é cobrado enquanto você usar só recursos "Always Free".

> **Dica importante — evite perder a máquina.** Em contas 100% gratuitas, a Oracle pode
> recolher máquinas que ficam ociosas por 7 dias (CPU quase parada), e às vezes diz "Out of
> capacity" ao criar a máquina ARM. Os dois problemas somem ao converter a conta para
> **Pay As You Go** (menu *Billing → Upgrade and Manage Payment*): os recursos Always Free
> continuam grátis. Se fizer isso, crie um **orçamento com alerta** (*Billing → Budgets*, ex.:
> US$ 1) para ser avisado se algo sair do gratuito.

## 2. Criar o servidor

No painel: **☰ → Compute → Instances → Create instance**.

1. **Name**: `csis`.
2. **Image and shape → Edit**:
   - *Image*: **Canonical Ubuntu 24.04**.
   - *Shape*: **Ampere → VM.Standard.A1.Flex**, **4 OCPUs** e **24 GB** de memória.
     (Se der "Out of capacity", tente outro *Availability domain*, tente mais tarde, ou use
     2 OCPUs / 12 GB — também funciona.)
3. **Networking**: *Create new virtual cloud network* + *Create new public subnet*. Se aparecer
   **Assign a public IPv4 address**, marque. Se não aparecer (o assistente novo às vezes não
   mostra), atribua depois de criar: instância → *Attached VNICs* → *IPv4 Addresses* → ⋮ →
   *Edit* → *Ephemeral public IP*.
4. **Add SSH keys**: **Generate a key pair for me → Save private key**. Guarde o arquivo
   (`ssh-key-….key`) — é a única forma de entrar no servidor.
5. **Boot volume**: marque *Specify a custom boot volume size* e coloque **150 GB**
   (o limite gratuito é 200 GB no total).
6. **Create**. Quando ficar verde (*Running*), anote o **Public IP address**.

## 3. Abrir as portas 80 e 443

Na página da instância: clique na **Subnet** → **Security Lists** → **Default Security List** →
**Add Ingress Rules**, e adicione duas regras:

| Source CIDR | IP Protocol | Destination Port Range |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

(O firewall *dentro* do Ubuntu o script do passo 6 já libera sozinho.)

## 4. Criar o endereço no DuckDNS

1. Acesse <https://www.duckdns.org> e entre com sua conta do GitHub ou Google.
2. Em **sub domain**, escolha um nome (ex.: `csis-suaempresa`) → **add domain**.
3. No campo **current ip** desse domínio, coloque o **IP público** do servidor → **update ip**.

Seu endereço será `csis-suaempresa.duckdns.org`.

## 5. Entrar no servidor

No Mac/Linux (Terminal), na pasta onde salvou a chave:

```bash
chmod 600 ssh-key-*.key
ssh -i ssh-key-*.key ubuntu@<IP-PUBLICO>
```

(No Windows: PowerShell, mesmo comando.)

## 6. Instalar e subir a plataforma

Já dentro do servidor:

```bash
git clone https://github.com/cyberchristian92/CSIS-plataforma-v2.git
cd CSIS-plataforma-v2
bash deploy/instalar.sh
```

O script instala o Docker, libera as portas no firewall do Ubuntu, pergunta **o endereço**
(`csis-suaempresa.duckdns.org`) e **o e-mail do primeiro administrador**, gera senhas aleatórias
em `.env.prod` e sobe tudo. **Anote a senha do administrador que ele mostra.**

A primeira vez leva uns 15–25 minutos (o motor de PDF baixa o TeX Live). Depois, abra
`https://csis-suaempresa.duckdns.org`, entre com o e-mail e a senha anotados, e:

1. **Troque a senha** (menu do usuário).
2. **Renomeie o workspace** com o nome da sua empresa — é esse nome que aparece na aba do
   navegador, na tela de cadastro e nos e-mails.

## 7. Ligar o envio de e-mails (Brevo)

Sem isso tudo funciona, mas os links de convite aparecem na tela para você copiar e mandar por
WhatsApp/e-mail manualmente.

1. Crie conta em <https://www.brevo.com> (plano Free).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: cadastre e confirme o e-mail
   remetente (ex.: seu Gmail).
3. **SMTP & API → SMTP → Generate a new SMTP key**. Anote *Login* e a chave.
4. No servidor, edite o `.env.prod` (`nano .env.prod`), tire o `#` das linhas de SMTP e preencha:

   ```
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=<login do Brevo>
   SMTP_PASS=<chave SMTP>
   SMTP_FROM="Nome da Empresa <email-remetente-confirmado@...>"
   ```

5. Aplique: `sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d`.

## Atualizar para a versão mais nova

```bash
cd CSIS-plataforma-v2
bash deploy/atualizar.sh
```

Baixa o código novo do GitHub, reconstrói o que mudou e aplica as migrations do banco sozinho.

## Backup

- **Banco**: o serviço `backup` grava uma cópia por dia em `CSIS-plataforma-v2/backups/`
  (guarda as 14 últimas).
- **Arquivos enviados** ficam no volume Docker `uploads`. Para gerar uma cópia:

  ```bash
  sudo docker run --rm -v csis-plataforma-v2_uploads:/u -v "$PWD/backups":/b alpine \
    tar czf /b/uploads-$(date +%F).tar.gz -C /u .
  ```

- **Tire as cópias do servidor de vez em quando** — backup que mora na mesma máquina não protege
  contra perder a máquina. Do seu computador:

  ```bash
  scp -i ssh-key-*.key -r ubuntu@<IP-PUBLICO>:CSIS-plataforma-v2/backups ./backups-csis
  ```

## Trocar para domínio próprio

1. Aponte o domínio (registro `A`) para o IP do servidor.
2. No `.env.prod`, troque `DOMINIO=` pelo domínio novo.
3. `sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d` — o Caddy tira o
   certificado novo sozinho.

## Alternativa: sua própria máquina + túnel

Para quando a Oracle diz "Out of capacity", ou para uma demonstração rápida: a plataforma roda
na sua máquina (notebook, PC velho com Ubuntu Server) e um **túnel** entrega um endereço público
com HTTPS. Não precisa abrir porta no roteador nem ter IP público.

**Limite:** o site só fica no ar enquanto a máquina estiver ligada, acordada e com internet.
Num notebook, desligue o repouso automático na tomada (Mac: `caffeinate -dims` num terminal
aberto; Ubuntu: `sudo systemctl mask sleep.target suspend.target`).

### 1. Subir a plataforma

Precisa do Docker (seção 1 do [guia de desenvolvimento](desenvolvimento.md)).

```bash
git clone https://github.com/cyberchristian92/CSIS-plataforma-v2.git
cd CSIS-plataforma-v2
cp .env.prod.example .env.prod
```

Edite o `.env.prod`: `SEED_ADMIN_EMAIL` com seu e-mail, e gere as senhas com
`openssl rand -hex 24` (para `DB_SENHA` e `SEED_ADMIN_SENHA`) e `openssl rand -hex 48`
(para `JWT_SECRET`). O `DOMINIO` você preenche no passo 3. Depois:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.tunel.yml \
  --env-file .env.prod up -d --build
```

O `docker-compose.tunel.yml` troca só o Caddy: em vez de 80/443 com Let's Encrypt, ele atende
HTTP em `127.0.0.1:8080` (só acessível pela própria máquina) e o túnel cuida do HTTPS. Teste em
<http://localhost:8080>.

### 2. Ligar o túnel

**Tailscale Funnel** — grátis, endereço fixo `https://<máquina>.<sua-rede>.ts.net`:

1. Instale o Tailscale ([Mac/Windows](https://tailscale.com/download); Linux:
   `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up`) e entre com sua conta.
2. No painel (<https://login.tailscale.com/admin/dns>), ative **MagicDNS** e
   **HTTPS Certificates**.
3. `tailscale funnel --bg 8080` (no Linux, com `sudo`). Na primeira vez ele mostra um link para
   autorizar o Funnel — abra, autorize e rode de novo. O comando mostra o endereço público.
   (No Mac, o comando fica em `/Applications/Tailscale.app/Contents/MacOS/Tailscale`.)

**Cloudflare Tunnel** — alternativa sem conta para testar:
`cloudflared tunnel --url http://localhost:8080`. O endereço (`*.trycloudflare.com`) muda a cada
vez que o comando reinicia; para um endereço fixo, é preciso um domínio próprio na Cloudflare.

### 3. Apontar a plataforma para o endereço do túnel

No `.env.prod`, ponha `DOMINIO=` com o endereço do túnel, sem `https://`
(ex.: `DOMINIO=notebook.tail1234.ts.net`), e reinicie a API:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.tunel.yml \
  --env-file .env.prod up -d backend
```

Abra o endereço público, entre com `SEED_ADMIN_EMAIL` / `SEED_ADMIN_SENHA` e troque a senha.

## Quando algo não funciona

| Sintoma | Onde olhar |
|---|---|
| O site não abre (tempo esgotado) | Passo 3 (Security List) e se o IP no DuckDNS é o do servidor |
| Erro de certificado / HTTPS | `sudo docker compose -f docker-compose.prod.yml logs caddy` — o DuckDNS precisa já apontar para o IP **antes** de subir |
| Página abre mas login falha | `sudo docker compose -f docker-compose.prod.yml logs backend` |
| "Gerar PDF" demora ou falha | `sudo docker compose -f docker-compose.prod.yml logs pandoc` |
| Ver o que está rodando | `sudo docker compose -f docker-compose.prod.yml ps` |
