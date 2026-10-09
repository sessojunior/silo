# Correção do Agentic RAG e do fluxo de artefatos

## Objetivo

Transformar o suporte parcial de RAG e agente híbrido do SILO em um fluxo confiável, controlado e verificável, mantendo fallback determinístico quando o modelo, embeddings ou recuperação vetorial falharem. Corrigir também a entrega de PDFs identificada na auditoria anterior.

## Escopo

- Padronizar a configuração do modelo de chat e do modelo de embeddings.
- Corrigir a recuperação vetorial e textual sem carregar todas as fontes em memória.
- Usar embeddings de problemas, soluções, ajuda e manuais.
- Preservar proveniência, permissões e citações reais.
- Implementar recuperação agentic limitada, com orçamento e fallback.
- Corrigir persistência e entrega HTTP de PDFs.
- Adicionar testes unitários, integração, HTTP e carga básica.

## Fora do escopo

- Execução de ferramentas de escrita pelo agente.
- Execução de shell, filesystem, SQL arbitrário ou chamadas HTTP arbitrárias pelo modelo.
- Troca obrigatória do modelo Qwen atual.
- Migração para serviço externo de banco, fila ou observabilidade.

## Decisão arquitetural

O modo `hybrid` será suportado por feature flag e terá fallback determinístico. O modo determinístico continuará disponível para rollback. O agente poderá escolher somente ferramentas de leitura, terá limite de rodadas, limite de chamadas, timeout, deduplicação e validação de argumentos.

## Fluxo desejado

```text
pergunta
  -> classificação e plano
  -> consulta determinística inicial
  -> agente seleciona busca complementar quando necessário
  -> recuperação vetorial/textual filtrada
  -> avaliação de relevância e possível reformulação
  -> contexto com proveniência
  -> síntese grounded
  -> validação de números e citações
  -> resposta ou abstention/fallback
```

## Segurança

Documentos recuperados serão tratados como dados não confiáveis. O conteúdo recuperado não poderá alterar regras do sistema nem autorizar novas ferramentas. Toda fonte será filtrada pelas permissões disponíveis no contexto da requisição.

## Critérios de aceite

- `search_silo_knowledge` usa recuperação vetorial nativa quando embeddings estão disponíveis.
- Problemas e soluções participam da busca semântica.
- Falha de embeddings não derruba o chat e produz fallback textual observável.
- O modo híbrido executa somente ferramentas permitidas e limitadas.
- Citações carregam fonte e identificação do trecho recuperado.
- PDF retornado pelo chat pode ser baixado pelo frontend e seu checksum corresponde aos bytes servidos.
- Os testes de regressão reproduzem cada falha encontrada na auditoria.
