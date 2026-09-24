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
3. **Networking**: deixe criar a rede nova (VCN) e marque **Assign a public IPv4 address**.
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

## Quando algo não funciona

| Sintoma | Onde olhar |
|---|---|
| O site não abre (tempo esgotado) | Passo 3 (Security List) e se o IP no DuckDNS é o do servidor |
| Erro de certificado / HTTPS | `sudo docker compose -f docker-compose.prod.yml logs caddy` — o DuckDNS precisa já apontar para o IP **antes** de subir |
| Página abre mas login falha | `sudo docker compose -f docker-compose.prod.yml logs backend` |
| "Gerar PDF" demora ou falha | `sudo docker compose -f docker-compose.prod.yml logs pandoc` |
| Ver o que está rodando | `sudo docker compose -f docker-compose.prod.yml ps` |
