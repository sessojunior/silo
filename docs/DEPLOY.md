# 🚀 Deploy do Silo com Docker

Este guia explica, de forma bem simples, como fazer deploy do Silo usando Docker.

---

## ⭐ Tutorial de Deploy

Siga exatamente na ordem:

### 1) Ligar o Docker Desktop (Windows)

- Abra o Docker Desktop (Windows)
- Espere ele ficar “verde” (rodando)

### 2) Abrir o terminal na pasta do projeto

```bash
cd C:\INPE\silo
```

### 2.1) Criar a rede Docker (Frontend)

O projeto exige uma rede externa chamada `frontend` para comunicação com proxies e outros serviços. No seu terminal, execute:

```bash
docker network create frontend
```

> [!IMPORTANT]
> Este passo é obrigatório uma única vez na máquina. Sem isso, o comando de deploy falhará informando que a rede não foi encontrada.

### 3) Criar o arquivo .env

Ele é o arquivo que contém as variáveis de ambiente.

```bash
cp env.example .env
```

### 4) Editar o .env

Abra o arquivo `.env` e ajuste conforme os dados de usuário, banco de dados e senha reais:

- `BETTER_AUTH_SECRET` com um texto longo e secreto ou gerar o secret com um destes: `npx @better-auth/cli secret` ou `openssl rand -base64 32`.
- Se for usar o banco de dados dentro do Docker, use as seguintes configurações, adaptando os valores das variáveis conforme necessário:

```env
NODE_ENV=production

DATABASE_URL_PROD=postgresql://silo:silo@db:5432/silo
POSTGRES_DB=silo
POSTGRES_USER=silo
POSTGRES_PASSWORD=silo
POSTGRES_PORT=5432
```

- `NEXT_PUBLIC_BASE_PATH` define o caminho do site:
  - `/silo` → <http://localhost:3000/silo>
  - `/` → <http://localhost:3000>

### 5) Subir tudo com banco e volumes

Execute o script de deploy automatizado (funciona em Windows, Linux e Mac):

```bash
npm run deploy
```

Ou, se preferir o comando manual:

```bash
docker compose --profile db up -d --build
```

O que acontece aqui:

1. **Build**: Monta o container do Silo.
2. **Start**: O container inicia e executa automaticamente:
   - `npm run db:migrate` (Cria as tabelas se não existirem)
   - `npm run db:seed` (Cria o usuário admin `Mario Junior` se o banco estiver vazio)
   - `npm run start` (Inicia o servidor Next.js)

Tudo isso acontece de forma automática graças ao script `entrypoint.sh`. Esse arquivo executa migrações, seed e inicia a aplicação.

### 6) Ver se está rodando

```bash
docker compose ps
```

### 7) Abrir no navegador

- Se `NEXT_PUBLIC_BASE_PATH=/silo`:
  - <http://localhost:3000/silo>
- Se `NEXT_PUBLIC_BASE_PATH=/`:
  - <http://localhost:3000>

---

## ✅ Como verificar o volume do banco

Pense no volume como um baú que guarda tudo do banco.

### Ver todos os volumes

```bash
docker volume ls
```

Procure por um volume parecido com `silo_postgres_data`.

### Ver detalhes do volume

```bash
docker volume inspect silo_postgres_data
```

### Ver arquivos do banco dentro do container

```bash
docker compose exec db sh -c "ls -la /var/lib/postgresql/data"
```

---

## 📦 Como verificar uploads

Uploads são arquivos persistidos em um volume do Docker:

- Volume: `uploads_data` (Gerenciado pelo Docker)
- Dentro do container: `/app/uploads`

Para conferir dentro do container:

```bash
docker compose exec silo sh -c "ls -la /app/uploads"
```

---

## 🧰 Comandos úteis (o que está rodando)

```bash
docker compose ps
docker compose logs -f
docker compose logs -f silo
docker compose logs -f db
docker ps
docker stats
```

---

## 💤 Rodar em segundo plano

```bash
docker compose up -d --build
```

Ver logs depois:

```bash
docker compose logs -f
```

Parar tudo:

```bash
docker compose down
```

Parar e apagar volumes:

```bash
docker compose down -v
```

---

## 🧠 O que é Docker Compose

Docker Compose é um “maestro” que, a partir de uma única receita (o arquivo docker-compose.yml), sabe ligar, conectar e manter vários programas (containers) trabalhando juntos sem que você precise abrir uma tela de configuração para cada um.

No Silo:

- `app` → a aplicação
- `db` → o banco de dados

O `--profile db` liga o banco junto.

---

## 🧩 O que é o Dockerfile

O Dockerfile é um arquivo de texto que lista, passo a passo, todos os ingredientes e configurações necessários para “embalar” sua aplicação dentro de uma imagem Docker — como se fosse a fórmula exata para que o Docker saiba exatamente como montar e preparar o ambiente onde seu código vai rodar.

1. Pega uma base com Node.js
2. Instala dependências
3. Copia o código
4. Faz o build do Next.js
5. Inicia o app na porta 3000

---

## 🧹 Como remover imagens e limpar espaço

Ver imagens:

```bash
docker images
```

Remover tudo que não está sendo usado (cuidado):

```bash
docker system prune -a
```

---

## 🔧 Troubleshooting

### Container reiniciando ou falha no Entrypoint

Se o container do `app` ficar reiniciando ou falhar logo após o build, verifique os logs:

```bash
docker compose logs silo
```

Se o erro for relacionado a **módulos não encontrados** (`drizzle-kit not found`, `tsx not found`, `dotenv not found`) ou **reinstalação do TypeScript** a cada boot, verifique o `package.json`.

As ferramentas de migração, seed e configuração (`drizzle-kit`, `tsx`, `dotenv`, `typescript`) devem estar listadas em **`dependencies`** (e não `devDependencies`), pois o Dockerfile remove dependências de desenvolvimento em produção.
