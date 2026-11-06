# Seleção de modelo de IA e MCP — Design

## Intenção

Eliminar preferências redundantes da tela de IA. O usuário deve escolher entre
modelos aprovados e configurados pelo backend; o uso de MCP deve ser automático
quando a política global disponibilizar ferramentas aprovadas.

## Objetivos

- Exibir no frontend somente modelos fornecidos pelo backend.
- Persistir a escolha por usuário como um identificador validado.
- Usar o modelo padrão como fallback para escolhas ausentes ou inválidas.
- Remover `mcpEnabled` da interface e deixar o backend decidir a capacidade MCP.
- Preservar as colunas booleanas antigas durante a transição, sem usá-las como
  autorização efetiva.

## Fora de escopo

- Permitir que o usuário informe nome, URL ou credencial de modelo.
- Criar um catálogo administrativo de modelos.
- Alterar a lista de ferramentas MCP aprovadas ou suas permissões.

## Abordagens

1. Manter os dois toggles atuais: rejeitado porque não representa escolhas reais.
2. Criar lista fixa no frontend: rejeitado porque pode expor opções não
   configuradas no runtime.
3. **Escolhida:** o backend monta a lista com o modelo padrão (`VLLM_MODEL`) e o
   modelo opcional aprovado (`AI_CUSTOM_MODEL`), valida `modelId`, persiste a
   escolha e remove o gate de MCP por usuário. É a menor mudança segura e mantém
   a configuração centralizada.

## Decisões de implementação

- A API de preferências retornará `availableModels` e `modelId`.
- O PUT aceitará `modelId` e os campos gerais já existentes; `mcpEnabled` e
  `customModelEnabled` deixam de ser enviados pelo frontend.
- A política de capacidades usará MCP quando `AI_MCP_ENABLED` estiver ativo e
  houver ferramentas aprovadas, sem consultar `user_preferences.mcp_enabled`.
- A escolha de modelo será validada contra o catálogo aprovado; ausente ou
  inválida usará o modelo padrão.
- Migração adicionará `model_id` nullable; campos antigos permanecem para
  compatibilidade com dados e fixtures legados.
