# Fase 1.11 — Vetores bcryptjs legados

Data: 2026-07-21  
Fase: `1.11`  
Status: concluído

## Resultado

Foram capturados vetores sintéticos produzidos por `bcryptjs` para preservar compatibilidade da futura autenticação Python com hashes legados.

Nenhum hash real de usuário foi extraído ou exposto.

## Artefatos

- `tests/contracts/legacy/generate-bcrypt-vectors.mjs`
- `tests/contracts/legacy/assert-bcrypt-vectors.ts`
- `tests/fixtures/legacy-golden/phase1_11.auth_bcryptjs_vectors.json`

## Implementação legada caracterizada

Arquivo:

- `packages/engine/src/auth/hash.ts`

Comportamento:

- geração: `bcrypt.hash(password, 10)`
- verificação: `bcrypt.compare(password, hash)`
- biblioteca instalada: `bcryptjs 3.0.3`
- custo observado: `10`

## Cobertura dos vetores

| Vetor | Bytes UTF-8 | Trunca em bcryptjs | Observação |
|---|---:|---|---|
| `phase1_11.bcrypt.fixture_contract_password` | 12 | não | senha sintética do fixture `#Contract123`; hash coincide com `seed-contract-users.sql` |
| `phase1_11.bcrypt.unicode_under_72_bytes` | 35 | não | Unicode abaixo da fronteira de 72 bytes |
| `phase1_11.bcrypt.ascii_over_72_bytes_suffix_ignored` | 73 | sim | ASCII acima de 72 bytes; sufixo é ignorado |
| `phase1_11.bcrypt.unicode_over_72_bytes_suffix_ignored` | 73 | sim | Unicode acima de 72 bytes; primeiros 72 bytes UTF-8 definem a verificação |

Cada vetor registra:

- senha sintética;
- tamanho UTF-8;
- primeiros 72 bytes em hex;
- salt;
- hash bcrypt;
- custo;
- se `bcryptjs.truncates(password)` é verdadeiro;
- senhas equivalentes por truncamento quando aplicável;
- senhas rejeitadas.

## Validação executada

```powershell
node --check tests\contracts\legacy\generate-bcrypt-vectors.mjs
node tests\contracts\legacy\generate-bcrypt-vectors.mjs
node node_modules/tsx/dist/cli.mjs tests\contracts\legacy\assert-bcrypt-vectors.ts
```

Resultado:

```text
[legacy-contract] wrote 4 bcryptjs vectors to tests/fixtures/legacy-golden/phase1_11.auth_bcryptjs_vectors.json
[legacy-contract] validated 4 bcryptjs compatibility vectors
```

Também foi validado que o hash do vetor `phase1_11.bcrypt.fixture_contract_password` está presente em `tests/fixtures/legacy-db/seed-contract-users.sql`.

## Implicação para Python

A Fase 3.3 do plano já fixa que Python usará `bcrypt==5.0.0`. Essa versão rejeita entradas maiores que 72 bytes. Portanto, a camada de compatibilidade Python deve:

1. receber a senha como `str`;
2. codificar em UTF-8;
3. truncar explicitamente os bytes para 72 bytes somente no caminho de bcrypt legado;
4. passar bytes truncados para bcrypt;
5. nunca aplicar esse truncamento em um futuro esquema pós-rollback como Argon2id.

Essa regra é exigida pelos vetores com `truncates=true`.
