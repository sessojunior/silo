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

O **Silo** usa **1 container**:

1. **`app`** (porta 3000) - Aplicação Next.js (frontend + APIs + uploads locais)

---

## ⚙️ **CONFIGURAÇÃO**

### **Pré-requisitos**

1. **Docker Desktop** (Windows/Mac) ou **Docker Engine** (Linux)
   - Download: https://www.docker.com/products/docker-desktop
   - Após instalar, verifique: `docker --version`

2. **Docker Compose** (geralmente já vem com o Docker Desktop)
   - Verifique: `docker-compose --version`

### **Variáveis de Ambiente**

Crie um arquivo `.env` na raiz do projeto:

```bash
# Banco de Dados
DATABASE_URL='postgresql://usuario:senha@host:5432/banco'

# URLs do sistema
APP_URL='http://localhost:3000'

# Google OAuth (opcional)
GOOGLE_CLIENT_ID=''
GOOGLE_CLIENT_SECRET=''

# Email SMTP
SMTP_HOST='smtp.seuservidor.com'
SMTP_PORT='587'
SMTP_SECURE=false # Defina como true se usar SSL (porta 465)
SMTP_USERNAME='seu-email@dominio.com'
SMTP_PASSWORD='sua-senha'
```

### **Arquivo docker-compose.yml**

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=${NODE_ENV:-development}
      - DATABASE_URL=${DATABASE_URL}
      - APP_URL=${APP_URL:-http://localhost:3000}
      # ... outras variáveis de ambiente
    volumes:
      - ./.next:/app/.next  # Cache do Next.js
    restart: unless-stopped
```

---

## 🚀 **EXECUÇÃO**

### **Opção 1: Desenvolvimento Local (SEM Docker)**

Recomendado para desenvolvimento ativo do código:

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp env.example .env
# Edite o arquivo .env com suas configurações

# 3. Executar servidor
npm run dev

# ✅ Pronto! Acesse:
# Frontend: http://localhost:3000
```

**Para parar**: Pressione `Ctrl+C` em cada terminal.

### **Opção 2: Usando Docker**

Recomendado para testar ou usar o sistema sem configurar o ambiente:

```bash
# 1. Copiar arquivo de exemplo
cp env.docker.example .env

# 2. Editar .env com suas configurações
# Use um editor de texto (VSCode, Notepad++, etc.)

# 3. Construir e executar containers
docker-compose up --build

# Isso vai:
# 1. Baixar as imagens necessárias (primeira vez demora mais)
# 2. Construir os containers do Silo
# 3. Iniciar a aplicação (porta 3000)
# 4. Mostrar logs em tempo real

# ✅ Aguarde a mensagem: "ready - started server on..."
# ✅ Acesse: http://localhost:3000
```

**Executar em segundo plano:**

```bash
docker-compose up -d --build

# Ver logs depois:
docker-compose logs -f
```

---

## 🛠️ **GERENCIAMENTO**

### **Comandos Básicos**

```bash
# Ver status dos containers
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Ver logs de um container específico
docker-compose logs -f app

# Parar todos os containers
docker-compose down

# Parar e remover tudo (inclusive volumes)
docker-compose down -v

# Reiniciar containers
docker-compose restart

# Reconstruir apenas um container
docker-compose up --build app
```

### **Acessar o Sistema**

Após iniciar os containers:

- **Frontend**: http://localhost:3000
- **Uploads**: `GET /files/<type>/<filename>`

---

## 🚀 **DEPLOY**

### **Estratégia de Deploy**

O projeto **Silo** está configurado para deploy separado:

- **Frontend Next.js**: Deploy no Vercel ou em servidor próprio
- **FileServer**: Deploy em servidor próprio (CPTEC/INPE)

### **Deploy do Frontend (Vercel)**

```bash
# Deploy automático via Git
git add .
git commit -m "Deploy: configuração otimizada"
git push origin main
```

O Vercel fará deploy automaticamente apenas do frontend Next.js.

### **Arquivos de Configuração**

- `.gitignore` - Ignora arquivos desnecessários
- `.vercelignore` - Otimiza deploy no Vercel
- `.dockerignore` - Otimiza containers Docker
- `vercel.json` - Configuração específica do Vercel
- `next.config.ts` - Configuração Next.js otimizada

---

## 🏭 **PRODUÇÃO**

### **Container Next.js (`app`)**

- **Porta**: 3000 (mapeada para localhost:80)
- **Função**: Aplicação frontend e APIs
- **Volume**: `./.next` (cache do Next.js persiste entre rebuilds)
- **Restart**: Automático (`unless-stopped`)

### **Persistência de Dados**

- ✅ Cache do Next.js (`.next/`) persiste entre rebuilds para melhor performance
- ✅ Arquivos de upload são salvos em `./uploads` (não perdem ao parar containers)
- ⚠️ Banco de dados precisa ser externo (PostgreSQL separado)

### **Configurações de Produção**

```bash
# Desenvolvimento
APP_URL='http://localhost:3000'

# Produção
APP_URL='https://silo.cptec.inpe.br'
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
docker-compose logs app

# Verificar variáveis de ambiente
docker-compose config

# Verificar permissões dos volumes
docker-compose exec app ls -la uploads/
```

### **Limpar tudo e recomeçar**

```bash
# Parar e remover containers, volumes e redes
docker-compose down -v

# Remover imagens antigas (libera espaço)
docker system prune -a

# Reconstruir do zero
docker-compose up --build
```

### **Comandos de Debug**

```bash
# Entrar dentro do container Next.js
docker-compose exec app sh

# Ver configuração completa gerada
docker-compose config

# Ver recursos usados pelos containers
docker stats

# Verificar logs de erro específicos
docker-compose logs app | grep ERROR
```

---

## 📊 **QUANDO USAR CADA OPÇÃO?**

| Situação | Recomendação |
|----------|--------------|
| **Desenvolvendo código** | Desenvolvimento Local (npm run dev) |
| **Testando o sistema** | Docker |
| **Primeira vez usando** | Docker |
| **Deploy em servidor** | Docker |
| **Debugando problemas** | Desenvolvimento Local |
| **Demonstração rápida** | Docker |

---

**🎯 Para detalhes técnicos, consulte o Dockerfile em `/Dockerfile`**
