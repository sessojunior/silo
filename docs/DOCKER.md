# 🐳 Docker e Deploy

Documentação completa sobre Docker, containerização e deploy em produção.

---

## 📋 **ÍNDICE**

1. [Visão Geral](#-visão-geral)
2. [Arquitetura](#-arquitetura)
3. [Configuração](#-configuração)
4. [Execução](#-execução)
5. [Deploy](#-deploy)
6. [Produção](#-produção)
7. [Troubleshooting](#-troubleshooting)

---

## 🎯 **VISÃO GERAL**

Docker é uma ferramenta que "empacota" aplicações em **containers** - ambientes isolados que funcionam da mesma forma em qualquer computador.

**Vantagens:**

- ✅ Funciona igual em qualquer máquina (desenvolvimento, teste, produção)
- ✅ Não precisa instalar Node.js, PostgreSQL, etc. manualmente
- ✅ Fácil de iniciar e parar o sistema completo
- ✅ Isola a aplicação do resto do sistema

---

## 🏗️ **ARQUITETURA**

O **Silo** usa **1 container** (e opcionalmente um Postgres):

1. **`app`** (porta 3000) - Aplicação Next.js (frontend + APIs + uploads locais)
2. **`db`** (opcional) - PostgreSQL (via Docker Compose, recomendado apenas quando você não usa Postgres gerenciado)

---

## ⚙️ **CONFIGURAÇÃO**

### **Pré-requisitos**

1. **Docker Desktop** (Windows/Mac) ou **Docker Engine** (Linux)
   - Download: https://www.docker.com/products/docker-desktop
   - Após instalar, verifique: `docker --version`

2. **Docker Compose** (geralmente já vem com o Docker Desktop)
   - Verifique: `docker compose version`

### **Variáveis de Ambiente**

O projeto possui um arquivo de exemplo pronto:

- `env.example` (formato compatível com `dotenv` e `.env` do Docker Compose)

Para evitar inconsistências, copie o arquivo para `.env` na raiz do projeto.

```bash
# Ambiente
NODE_ENV=production # development ou production

# Banco de Dados
DATABASE_URL_DEV=postgresql://usuario:senha@host:5432/silo_db
DATABASE_URL_PROD=postgresql://usuario:senha@host:5432/silo_db

# URLs da aplicação
NEXT_PUBLIC_BASE_PATH=/silo
APP_URL_DEV=http://localhost:3000
APP_URL_PROD=https://fortuna.cptec.inpe.br

BETTER_AUTH_SECRET=your_secret_key_here

# Google OAuth (opcional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=
SMTP_PASSWORD=
```

Observações:

- Para Docker Compose, evite aspas no `.env` para não incluir aspas no valor final.
- O caminho base público do sistema é configurado em `NEXT_PUBLIC_BASE_PATH` (sem barra final). Exemplos: `/silo` ou `/` (raiz).
- `APP_URL_DEV` e `APP_URL_PROD` devem ser apenas a origem (sem subdiretório). O subdiretório base é sempre definido em `NEXT_PUBLIC_BASE_PATH`.
- O `docker-compose.yml` suporta subir um PostgreSQL junto com a aplicação usando o profile `db`.
- Se você não ativar o profile `db`, as variáveis `DATABASE_URL_DEV`/`DATABASE_URL_PROD` devem apontar para um PostgreSQL externo (gerenciado ou já existente).

### **Arquivo docker-compose.yml**

Veja o arquivo real do projeto em `docker-compose.yml`.

---

## 🚀 **EXECUÇÃO**

### **Opção 1: Desenvolvimento Local (SEM Docker)**

Recomendado para desenvolvimento ativo do código:

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
Copy-Item env.example .env
# Edite o arquivo .env com suas configurações

# 3. Executar servidor
npm run dev

# ✅ Pronto! Acesse:
# Frontend: http://localhost:3000<BASE_PATH>
```

**Para parar**: Pressione `Ctrl+C` em cada terminal.

### **Opção 2: Usando Docker**

Recomendado para testar ou usar o sistema sem configurar o ambiente:

```bash
# 1. Copiar arquivo de exemplo
Copy-Item env.example .env

# 2. Editar .env com suas configurações
# Use um editor de texto (VSCode, Notepad++, etc.)

# 3. Construir e executar containers
docker compose up --build

# Isso vai:
# 1. Baixar as imagens necessárias (primeira vez demora mais)
# 2. Construir os containers do Silo
# 3. Iniciar a aplicação (porta 3000)
# 4. Mostrar logs em tempo real

# ✅ Aguarde a mensagem: "ready - started server on..."
# ✅ Acesse: http://localhost:3000<BASE_PATH>
```

**Executar em segundo plano:**

```bash
docker compose up -d --build

# Ver logs depois:
docker compose logs -f
```

### **Subir Postgres junto (profile db)**

Se você quer subir o PostgreSQL no mesmo `docker-compose.yml`, use o profile `db`:

```bash
docker compose --profile db up -d --build
```

Configuração típica no `.env`:

```bash
POSTGRES_DB=silo
POSTGRES_USER=silo
POSTGRES_PASSWORD=uma_senha_forte
POSTGRES_PORT=5432

DATABASE_URL_DEV=postgresql://silo:uma_senha_forte@db:5432/silo
DATABASE_URL_PROD=postgresql://silo:uma_senha_forte@db:5432/silo
```

---

## 🛠️ **GERENCIAMENTO**

### **Comandos Básicos**

```bash
# Ver status dos containers
docker compose ps

# Ver logs em tempo real
docker compose logs -f

# Ver logs de um container específico
docker compose logs -f app

# Parar todos os containers
docker compose down

# Parar e remover tudo (inclusive volumes)
docker compose down -v

# Reiniciar containers
docker compose restart

# Reconstruir apenas um container
docker compose up --build app
```

### **Acessar o Sistema**

Após iniciar os containers:

- **Frontend**: http://localhost:3000<BASE_PATH>
- **Uploads**: `GET <BASE_PATH>/uploads/<type>/<filename>`

---

## 🚀 **DEPLOY**

### **Estratégia de Deploy**

O projeto **Silo** é uma aplicação Next.js (frontend + APIs) com uploads locais servidos por route handlers (`/silo/uploads/...`).

---

## 🏭 **PRODUÇÃO (POSTGRES)**

### **Opção recomendada: Postgres gerenciado**

Para produção, prefira um Postgres gerenciado (ou um servidor Postgres dedicado do próprio INPE). Nesse cenário:

- O container `db` do Compose não é necessário.
- Configure `DATABASE_URL_PROD` apontando para o host real do Postgres.
- Use SSL se o provedor exigir (ex.: `?sslmode=require`).

Exemplo:

```bash
DATABASE_URL_PROD=postgresql://usuario:senha@host-producao:5432/silo?sslmode=require
```

### **Aplicar migrações no Postgres de produção**

Com `DATABASE_URL_PROD` configurada e `NODE_ENV=production`:

```bash
npm run db:migrate
```

Recomendação prática para deploy:

- Execute migrações antes de subir a nova versão da aplicação.
- Tenha backup/restore testado (dump diário, retenção e restauração validada).

### **Deploy do Frontend (Vercel)**

```bash
# Recomenda-se configurar o deploy pelo painel do provedor (ex.: Vercel)
# ou por um pipeline existente do ambiente institucional.
```

O Vercel fará deploy automaticamente apenas do frontend Next.js.

### **Arquivos de Configuração**

- `.gitignore` - Ignora arquivos desnecessários
- `.vercelignore` - Otimiza deploy no Vercel
- `.dockerignore` - Otimiza containers Docker
- `next.config.ts` - Configuração Next.js otimizada

---

## 🏭 **PRODUÇÃO**

### **Container Next.js (`app`)**

- **Porta**: 3000 (mapeada para localhost:3000)
- **Função**: Aplicação frontend e APIs
- **Volume**: `./uploads` (arquivos persistidos no host)
- **Restart**: Automático (`unless-stopped`)

### **Persistência de Dados**

- ✅ Arquivos de upload são salvos em `./uploads` (não perdem ao parar containers)
- ⚠️ Banco de dados precisa ser externo (PostgreSQL separado)

### **Configurações de Produção**

```bash
# Caminho base da aplicação (sem barra final). Exemplos: '/silo' ou '/'
NEXT_PUBLIC_BASE_PATH=/silo

# Desenvolvimento
APP_URL_DEV=http://localhost:3000

# Produção
APP_URL_PROD=https://fortuna.cptec.inpe.br
BETTER_AUTH_SECRET=your_secret_key_here
```

**⚠️ Importante para Produção:**

- URLs HTTPS obrigatórias
- Domínios reais institucionais
- Secrets complexos e únicos
- Servidor PostgreSQL dedicado
- SSL/TLS configurado
- Firewall configurado

---

## 🔧 **TROUBLESHOOTING**

### **Erro: "port is already allocated"**

```bash
# Outro programa está usando a porta 3000
# Opção 1: Parar o programa que está usando a porta
# Opção 2: Mudar a porta no docker-compose.yml

# Ver o que está usando a porta (Windows):
netstat -ano | findstr :3000

# Matar processo (Windows):
taskkill /PID <PID> /F
```

### **Erro: "Cannot connect to the Docker daemon"**

```bash
# Docker Desktop não está rodando
# Solução: Inicie o Docker Desktop e aguarde inicializar
```

### **Container não inicia**

```bash
# Ver logs detalhados
docker compose logs app

# Verificar variáveis de ambiente
docker compose config

# Verificar permissões dos volumes
docker compose exec app ls -la uploads/
```

### **Limpar tudo e recomeçar**

```bash
# Parar e remover containers, volumes e redes
docker compose down -v

# Remover imagens antigas (libera espaço)
docker system prune -a

# Reconstruir do zero
docker compose up --build
```

### **Comandos de Debug**

```bash
# Entrar dentro do container Next.js
docker compose exec app sh

# Ver configuração completa gerada
docker compose config

# Ver recursos usados pelos containers
docker stats

# Verificar logs de erro específicos
docker compose logs app | findstr ERROR
```

---

## 📊 **QUANDO USAR CADA OPÇÃO?**

| Situação                 | Recomendação                        |
| ------------------------ | ----------------------------------- |
| **Desenvolvendo código** | Desenvolvimento Local (npm run dev) |
| **Testando o sistema**   | Docker                              |
| **Primeira vez usando**  | Docker                              |
| **Deploy em servidor**   | Docker                              |
| **Debugando problemas**  | Desenvolvimento Local               |
| **Demonstração rápida**  | Docker                              |

---

**🎯 Para detalhes técnicos, consulte o Dockerfile em `/Dockerfile`**
