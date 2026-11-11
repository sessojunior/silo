# Conclusão do checklist do SILO — Design

## Intenção

Concluir o checklist funcional e técnico do SILO com evidência verificável. O
trabalho inclui corrigir falhas reais encontradas na auditoria, completar os
fluxos que já estão parcialmente implementados, automatizar regressões e
validar no navegador e na stack Docker os comportamentos que não podem ser
provados apenas por testes unitários.

O login com senha foi validado pelo usuário e será tratado como já aprovado;
não será reaberto como correção.

## Objetivos

- Fazer os gates de backend, frontend, OpenAPI, Compose, segurança e cobertura
  representarem o estado real do código.
- Corrigir a divergência entre a intenção do commit mais recente e o contrato
  de preferências da IA: o usuário controla somente a ativação do assistente;
  modelo e MCP permanecem configuração global/operacional.
- Garantir que o Compose de desenvolvimento consiga iniciar o Qwen compartilhado
  e que o indexer não permaneça aparentemente saudável enquanto falha.
- Cobrir os fluxos de dashboard, monitoramento, produtos, projetos, IA,
  relatórios, chat, configurações, contatos, ajuda e estados cross-cutting.
- Registrar no checklist apenas itens demonstrados por teste automatizado,
  smoke test, inspeção de navegador ou validação operacional.

## Não objetivos

- Reescrever a arquitetura do SILO ou trocar o stack atual.
- Habilitar ferramentas externas/MCP por preferência individual.
- Considerar um teste unitário com mocks como prova de funcionamento do Qwen,
  WebSocket, e-mail, GPU ou integração real.
- Marcar como concluído um item manual sem evidência correspondente.

## Restrições

- Manter Next.js/React/TypeScript no frontend e FastAPI/Python/PostgreSQL no
  backend.
- Preservar os dados e imagens não rastreadas já existentes no workspace.
- Toda correção de comportamento deve começar por teste de regressão falhando.
- A inferência continua local; nenhum dado operacional deve sair do servidor.
- O Compose de inferência é separado e publica o alias de rede `qwen`.

## Abordagens consideradas

1. **Marcar o checklist sem alterar o código.** Rejeitada: a auditoria já
   demonstrou falhas em backend, mypy, cobertura, dependências e indexer.
2. **Reescrever todos os módulos pendentes de uma vez.** Rejeitada: aumenta o
   risco e impede atribuir uma regressão a um fluxo específico.
3. **Executar por fatias independentes, cada uma com teste RED→GREEN e smoke
   próprio.** Escolhida: preserva a arquitetura, reduz o raio de cada mudança
   e permite atualizar o checklist somente com evidência.

## Decisões de implementação

- A preferência individual de modelo será removida do contrato atual. Como a
  migration que criou `model_id` já pode ter sido aplicada, será criada uma
  migration posterior que remove a coluna de forma reversível e os modelos,
  rotas, tipos e testes serão alinhados.
- O serviço `qwen` será o único destino de geração no Compose compartilhado;
  o serviço legado `ai` não será mantido como alias operacional escondido.
- O backend seguirá com a configuração de qualidade estrita existente:
  Ruff, mypy, cobertura geral mínima de 90% e áreas protegidas mínimas de 95%.
- Testes browser serão usados para validar navegação, temas, responsividade,
  loading/empty/error states, modais e fluxos reais autenticados quando a
  stack local estiver disponível.

## Critério de conclusão

O trabalho será considerado concluído quando:

1. todos os gates automatizados configurados no repositório passarem;
2. a stack Docker estiver com `qwen`, embeddings, API, indexer, worker e web
   operacionais, sem erros recorrentes nos logs;
3. os fluxos do checklist tiverem teste automatizado ou evidência manual
   registrada;
4. os itens que dependerem de credencial externa, GPU, e-mail real ou dado
   operacional forem explicitamente separados como bloqueados, nunca marcados
   falsamente como concluídos.
