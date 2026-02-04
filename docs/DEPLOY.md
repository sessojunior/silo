# 🚀 Deploy com Docker (Silo)

Este guia explica, de forma bem simples, como fazer deploy do Silo usando Docker.

---

## ⭐ Tutorial de Deploy (o mais importante)

Siga exatamente na ordem:

### 1) Ligar o Docker Desktop

- Abra o Docker Desktop
- Espere ele ficar “verde” (rodando)

### 2) Abrir o terminal na pasta do projeto

No Windows, abra o PowerShell dentro da pasta, por exemplo:

```
C:\INPE\silo
```

### 3) Criar o arquivo .env

Ele é o arquivo que contém as variáveis de ambiente.

```powershell
Copy-Item env.example .env
```

### 4) Editar o .env

Abra o arquivo `.env` e ajuste conforme os dados de usuário, banco de dados e senha reais:

- `BETTER_AUTH_SECRET` com um texto longo e secreto
- Se for usar o banco dentro do Docker, use:

```env
DATABASE_URL_DEV=postgresql://silo:silo@db:5432/silo
DATABASE_URL_PROD=postgresql://silo:silo@db:5432/silo
POSTGRES_DB=silo
POSTGRES_USER=silo
POSTGRES_PASSWORD=silo
POSTGRES_PORT=5432
```

- `NEXT_PUBLIC_BASE_PATH` define o caminho do site:
  - `/silo` → http://localhost:3000/silo
  - `/` → http://localhost:3000

### 5) Subir tudo com banco e volumes

Esse comando liga a aplicação e o banco, com dados persistindo:

```powershell
docker compose --profile db up -d --build
```

O que acontece aqui:

- Baixa imagens necessárias
- Monta o app com o Dockerfile
- Cria o banco PostgreSQL
- Cria volume para não perder dados
- Cria pasta de uploads no seu computador

### 6) Ver se está rodando

```powershell
docker compose ps
```

### 7) Abrir no navegador

- Se `NEXT_PUBLIC_BASE_PATH=/silo`:
  - http://localhost:3000/silo
- Se `NEXT_PUBLIC_BASE_PATH=/`:
  - http://localhost:3000

---

## ✅ Como verificar o volume do banco

Pense no volume como um baú que guarda tudo do banco.

### Ver todos os volumes

```powershell
docker volume ls
```

Procure por um volume parecido com `silo_postgres_data`.

### Ver detalhes do volume

```powershell
docker volume inspect silo_postgres_data
```

### Ver arquivos do banco dentro do container

```powershell
docker compose exec db sh -c "ls -la /var/lib/postgresql/data"
```

---

## 📦 Como verificar uploads

Uploads são arquivos que ficam no seu computador:

- Pasta local: `./uploads`
- Dentro do container: `/app/uploads`

Para conferir dentro do container:

```powershell
docker compose exec app sh -c "ls -la /app/uploads"
```

---

## 🧰 Comandos úteis (o que está rodando)

```powershell
docker compose ps
docker compose logs -f
docker compose logs -f app
docker compose logs -f db
docker ps
docker stats
```

---

## 💤 Rodar em segundo plano

```powershell
docker compose up -d --build
```

Ver logs depois:

```powershell
docker compose logs -f
```

Parar tudo:

```powershell
docker compose down
```

Parar e apagar volumes:

```powershell
docker compose down -v
```

---

## 🧠 O que é Docker Compose

Docker Compose é como um “maestro” que liga várias caixas mágicas juntas.

No Silo:

- `app` → a aplicação
- `db` → o banco de dados

O `--profile db` liga o banco junto.

---

## 🧩 O que é o Dockerfile

O Dockerfile é uma receita que diz como montar a “caixa” da aplicação:

1. Pega uma base com Node.js
2. Instala dependências
3. Copia o código
4. Faz o build do Next.js
5. Inicia o app na porta 3000

---

## 🧹 Como remover imagens e limpar espaço

Ver imagens:

```powershell
docker image ls
```

Remover uma imagem:

```powershell
docker image rm <ID_DA_IMAGEM>
```

Limpar tudo que não está sendo usado:

```powershell
docker system prune -a
```

---

## 🚚 Como rodar um container manualmente

### Banco PostgreSQL sozinho

```powershell
docker run -d --name silo-postgres `
  -e POSTGRES_DB=silo `
  -e POSTGRES_USER=silo `
  -e POSTGRES_PASSWORD=silo `
  -p 5432:5432 `
  -v postgres_data:/var/lib/postgresql/data `
  postgres:17-alpine
```

### Aplicação sozinha

```powershell
docker build -t silo-app .
docker run -d --name silo-app `
  -p 3000:3000 `
  -e NODE_ENV=production `
  -e DATABASE_URL_DEV=postgresql://silo:silo@db:5432/silo `
  -e DATABASE_URL_PROD=postgresql://silo:silo@db:5432/silo `
  -e NEXT_PUBLIC_BASE_PATH=/silo `
  -e APP_URL_DEV=http://localhost:3000 `
  -e APP_URL_PROD=https://fortuna.cptec.inpe.br `
  -e BETTER_AUTH_SECRET=seu_secret_aqui `
  -v ${PWD}\uploads:/app/uploads `
  silo-app
```

---

## ✅ Checklist rápido

- Docker Desktop está rodando
- `.env` criado e editado
- `BETTER_AUTH_SECRET` preenchido
- `docker compose --profile db up -d --build` executado
- Site abre no navegador com o caminho correto
