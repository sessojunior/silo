# PLAN-AI

Fonte viva do plano incremental do Assistente de IA do Silo.

## Objetivo

Criar um assistente conversacional focado apenas em temas do projeto: modelos, pendências, relatórios, problemas, soluções, projetos, atividades e monitoramento. O recurso deve rejeitar perguntas genéricas e fora do escopo do Silo.

## Direção

- O assistente não é um relatório automático.
- A interface deve reaproveitar a UI de chat já existente.
- O item de menu fica acima de `Relatórios` no sidebar, com o nome `Assistente de IA`.
- O modelo inicial é `Qwen2.5-14B-Instruct`, self-hosted, com contrato estruturado.

## Camadas

- `packages/engine`: contratos, schemas, exemplos, tipos de scope e regras de validação.
- `apps/api`: orquestração do contexto, guardrail de domínio e geração da resposta.
- `apps/web`: página de chat do assistente, reaproveitando o visual do chat atual.
- `apps/worker`: apoio futuro para sumarização e contexto de longo prazo.

## Estado atual

- Primeira fatia iniciada com contrato compartilhado, roteamento inicial e base de resposta restrita ao domínio.
- Sidebar já recebeu o item `Assistente de IA` acima de `Relatórios`.
- O composer do chat foi ajustado para permitir uso mais limpo na tela do assistente.

## Próximos slices

1. Criar a página `/admin/ai-assistant` usando a mesma linguagem visual do chat.
2. Expor exemplos de perguntas, histórico e resposta da API no feed de conversa.
3. Integrar o prompt com recuperação de contexto dos relatórios e problemas do Silo.
4. Persistir threads e feedback se o uso justificar.
