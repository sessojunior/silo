---
name: web-version-config
description: "Use when changing the version shown in the SILO web sidebar or any app version metadata in apps/web. Keep it centralized in apps/web/src/lib/config.ts and do not use env vars, CI metadata, package.json, or extra abstractions."
argument-hint: "Version value or related UI change"
---

# Web Version Config

## Quando usar

- Alterar a versão exibida no sidebar do web.
- Ajustar a regra de automação da IA para essa versão.

## Regra

- A versão vive somente em `apps/web/src/lib/config.ts` como `config.appVersion`.
- Não usar `process.env`, CI, `package.json` ou scripts para derivar essa versão.
- Se a UI mudar e a versão precisar acompanhar, atualizar o mesmo arquivo no mesmo change.

## Procedimento

1. Editar `apps/web/src/lib/config.ts`.
2. Consumir `config.appVersion` no componente que exibe a versão.
3. Validar com lint e typecheck do web.

## Padrão esperado

- Código curto e linear.
- Uma única fonte de verdade.
- Sem camadas extras para um valor fixo.