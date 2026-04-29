# Guia de Monitoramento - SILO

Este documento descreve a arquitetura de monitoramento do SILO, cobrindo páginas de figuras, radares e fluxo de dados de produtos meteorológicos.

---

## 1. Visão geral

A página `/admin/monitoring` consolida três tipos de acompanhamento:

- **Produtos**: status por produto e turno, derivado do fluxo de dados via Kafka REST Proxy ou do simulador local.
- **Páginas e Figuras**: disponibilidade e atraso de páginas/figuras cadastradas.
- **Radares**: agrupamentos, status operacional e links de diagnóstico.

O princípio geral é reduzir preenchimento manual: o usuário cadastra os alvos operacionais e o sistema recebe, calcula ou coleta os estados necessários.

---

## 2. Produtos e Fluxo de Dados

Os cards de produtos da página de monitoramento usam a mesma origem do Gantt de fluxo de dados: **Kafka REST Proxy**.

Fluxo atual:

1. A página `/admin/monitoring` carrega os produtos ativos no banco.
2. Para esses produtos, chama `getMonitoringProductsFromKafkaRest`.
3. Em modo real, a função lê mensagens dos tópicos de data-flow via REST Proxy.
4. Em modo simulado, usa os dados fake existentes e os adapta aos produtos ativos.
5. O resultado alimenta os cards de status por turno.

Configuração relevante:

```bash
KAFKA_REST_PROXY_URL=http://rest-proxy:8082
KAFKA_REST_PROXY_USE_MOCK_DATA=true
KAFKA_DATAFLOW_TOPIC_PREFIX=silo.dataflow.
```

Enquanto `KAFKA_REST_PROXY_USE_MOCK_DATA=true`, a tela funciona sem o proxy real. Para tentar ler do Kafka REST Proxy, defina `KAFKA_REST_PROXY_USE_MOCK_DATA=false` e configure `KAFKA_REST_PROXY_URL`.

Mais detalhes do contrato estão em [08-kafka.md](08-kafka.md) e [09-dataflow.md](09-dataflow.md).

---

## 3. Páginas e Figuras da Previsão do Tempo

Esta seção monitora a saúde das páginas públicas e internas de entrega de produtos meteorológicos.

Como os dados são obtidos:

1. O administrador cadastra nome, URL e metadados da página.
2. A aplicação carrega os registros do banco.
3. Quando não houver dados cadastrados, a tela ainda pode usar os seeds existentes como fallback de desenvolvimento.
4. O estado operacional pode incluir disponibilidade, atraso e informações das figuras associadas.

O objetivo é manter a visão de entrega do produto próxima da experiência real do usuário final: página disponível, figuras atualizadas e links acessíveis.

---

## 4. Radares

O monitoramento de radares foca na disponibilidade operacional das estações de coleta.

Cada radar pode ter:

- grupo operacional;
- nome e identificação;
- URL de webhook ou integração;
- URL de log para diagnóstico humano;
- status e dados complementares.

A URL de log é um link de saída para o técnico abrir o diagnóstico detalhado do radar. O webhook continua sendo um caminho válido para integrações de radar, mas não é a fonte do fluxo de dados dos produtos.

---

## 5. Diferença entre monitoramento e Gantt

O Gantt em `/admin/products/:slug/data-flow` mostra a execução detalhada de um produto, data e turno.

A página `/admin/monitoring` mostra um resumo operacional para múltiplos produtos e turnos. Para produtos, esse resumo é calculado a partir dos mesmos pipelines usados pelo Gantt:

- status agregado do pipeline;
- progresso médio das tasks;
- data de referência mais recente;
- turnos disponíveis para o produto.

Assim, o operador pode identificar rapidamente um problema no monitoramento e abrir o fluxo de dados do produto para ver qual task causou o atraso ou falha.

---

## 6. Resumo técnico

| Componente | Origem principal | Fallback atual | Atualização |
| --- | --- | --- | --- |
| Produtos | Kafka REST Proxy | Snapshots fake convertidos para Kafka/ecFlow | Conforme mensagens do tópico |
| Fluxo de Dados | Kafka REST Proxy | `pipeline-data.json` simulado | Por produto/data/turno |
| Páginas e Figuras | Banco de dados | Seeds de desenvolvimento | Conforme cadastro/verificação |
| Radares | Banco de dados/integrações | Seeds de desenvolvimento | Conforme cadastro/integração |

Arquivos principais:

- `src/app/admin/monitoring/page.tsx`
- `src/lib/dataflow/kafkaDataFlowSource.ts`
- `src/components/admin/monitoring/MonitoringPageClient.tsx`
- `src/components/admin/monitoring/ProductMonitoringCards.tsx`

---

## 7. Operação

Para operar sem Kafka real durante o desenvolvimento:

```bash
KAFKA_REST_PROXY_USE_MOCK_DATA=true
```

Para operar com Kafka REST Proxy real:

```bash
KAFKA_REST_PROXY_URL=http://rest-proxy:8082
KAFKA_REST_PROXY_USE_MOCK_DATA=false
KAFKA_DATAFLOW_TOPIC_PREFIX=silo.dataflow.
```

O Kafka não deve ser acessado diretamente por broker na aplicação. Todo acesso Kafka passa pelo REST Proxy.