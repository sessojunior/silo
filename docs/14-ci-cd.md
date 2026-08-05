# CI/CD do SILO

Documentacao da pipeline atual de validacao, build, seguranca e deploy.

---

## Objetivos da pipeline

1. Validar o frontend, o backend Python e os legados de migracao.
2. Construir imagens do backend e do web.
3. Rodar testes de rota e validacoes do browser contra a API Python em `"/silo"` e `"/"`.
4. Publicar SBOM e executar scanner de dependencias.
5. Fazer deploy por SSH usando a imagem ja publicada.

---

## GitHub Actions

O workflow atual possui quatro blocos:

- `node` - lint, typecheck, build, testes e audit do ecossistema JS.
- `python` - `py:sync`, format, lint, typecheck, testes, coverage e OpenAPI em Linux e Windows; o build da imagem Python roda no Linux.
- `security` - audit Node com allowlist documentada, audit Python e SBOM.

---

## GitLab CI

O pipeline principal possui:

- `validate:node`
- `validate:python`
- `security:scan`
- `build:image`
- `deploy:staging`
- `deploy:production`

O deploy usa `docker-compose.deploy.yml` e o script `scripts/gitlab/deploy.sh`.

---

## Hospedagem

O projeto nao usa Vercel. A entrega do web e da API acontece pelo fluxo de Docker Compose, GitLab CI e imagens publicadas.

---

## Regras de seguranca

- Nao usar `npx turbo` na pipeline.
- Nao misturar backend Python e legado Node na mesma validacao sem proposito de comparacao.
- Falhas de alta ou critica no audit bloqueiam o ciclo.
