# 🩺 Guia Completo de Monitoramento – SILO

Este documento fornece uma análise profunda da arquitetura de monitoramento do sistema SILO, cobrindo a integração de Páginas de Figuras, Radares e Fluxo de Dados (Pipelines).

---

## 🚀 1. Filosofia de Monitoramento: Automação em Primeiro Lugar

No SILO, o monitoramento é projetado para minimizar a carga administrativa. O princípio fundamental é: **O usuário define o Alvo (URL/Nome), e o sistema descobre e reporta os metadados e o estado.**

### Pilares da Automação:
- **Redução de redundância**: Campos como Slugs, Tamanhos de Arquivos e Identificadores Técnicos são geridos automaticamente ou recebidos via integração.
- **Webhooks como Mensageiros**: Uso de URLs de callback para que sistemas externos "avisem" o SILO sobre mudanças, eliminando o atraso de consultas periódicas.
- **Detecção Próxima ao Dado**: O sistema monitora diretamente as URLs de figuras e páginas para medir latência e disponibilidade.

---

## 🖼️ 2. Páginas e Figuras da Previsão do Tempo

Esta seção monitora a saúde das páginas públicas e internas de entrega de produtos meteorológicos.

### Como os dados são obtidos:
1. **Cadastro Mínimo**: O administrador fornece apenas o **Nome** e a **URL** da página.
2. **Identificação de Assets**: Quando em modo `items`, o crawler do SILO analisa a página em busca de imagens e arquivos.
3. **Metadados Automáticos**: O sistema detecta o tamanho do arquivo (`size`), a data de modificação e calcula o atraso (`delay`) comparando com a janela de publicação esperada.
4. **Resiliência**: Se uma URL de figura mudar ou o nome for alterado, o sistema atualiza o registro ou alerta sobre o link quebrado (Status: `offline`).

---

## 📡 3. Radares e Webhooks

O monitoramento de radares foca na disponibilidade operacional das estações de coleta.

### O Papel do Webhook:
Cada radar possui uma **Webhook URL** privada gerada pelo sistema.
- **Funcionamento**: "Funciona como um mensageiro que avisa imediatamente quando os dados forem atualizados."
- **Fluxo de Dados**: O coletor de dados (ex: scripts no CEMADEN ou DECEA) envia um payload JSON para o Webhook do radar no SILO contendo o timestamp do último log.
- **Vantagem**: O SILO não precisa "adivinhar" se o radar caiu; o próprio sistema de transmissão notifica a interrupção.

### URL de Log:
Diferente da Webhook, a **URL de Log** é um link de saída para que um técnico humano possa clicar no dashboard e ser levado diretamente à página de diagnóstico detalhado do radar.

---

## 🔄 4. Fluxo de Dados (Pipeline e Gantt)

O monitoramento de fluxo de dados é o nível mais granular, acompanhando o processamento de modelos meteorológicos minuto a minuto.

### Configuração por Produto:
Diferente dos radares, o Webhook de Fluxo de Dados é configurado na **página do Produto**. 
- **Centralização**: Como um produto (ex: WRF) pode ter dezenas de tarefas, existe um único Webhook que recebe o "Snapshot" completo do pipeline para aquele turno (ex: Rodada das 12z).

### Dinâmica da Atualização:
1. **Início da Rodada**: O script de submissão no supercomputador envia um sinal de "iniciado" para o Webhook.
2. **Tarefas em Progresso**: Conforme cada etapa (Ingestão, Pré-processamento, Execução, Pós-processamento) termina, o sistema de integração envia um novo payload atualizando o `progress` e o `status` de cada tarefa no Gantt.
3. **Visualização (Gantt Chart)**: O dashboard do SILO transforma esses payloads em uma linha do tempo visual, permitindo identificar gargalos ou atrasos em cascata em tempo quase real.

---

## 🛠️ 5. Resumo Técnico de Integração

| Componente | Entrada (Usuário) | Origem do Dado (Sistema) | Atualização |
| :--- | :--- | :--- | :--- |
| **Pág. de Figuras** | Nome, URL | Crawler/Monitor SILO | Periódica |
| **Radares** | Nome, Grupo | Webhook (POST) | Real-time |
| **Fluxo de Dados** | Webhook no Produto | Webhook (POST) da Pipeline | Real-time |

---

## 🎯 Conclusão

A arquitetura de monitoramento do SILO foi desenhada para ser um espelho fiel da operação técnica. Ao usar **Webhooks** para eventos críticos e **Crawlers** para verificação de ativos, o sistema garante que a gestão da DIPTC tenha uma visão clara do que está online, o que está atrasado e onde os recursos estão sendo consumidos, sem exigir que o técnico preencha formulários complexos a cada mudança.
