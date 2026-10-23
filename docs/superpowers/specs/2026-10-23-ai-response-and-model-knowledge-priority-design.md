# Design: Resposta da IA sem balão e prioridade do manual

## Intenção

Melhorar a leitura do chat removendo o balão visual das respostas da IA e
aproximando a apresentação do padrão de respostas do ChatGPT. Ao mesmo
tempo, tornar as respostas sobre modelos e rodadas mais fundamentadas na
base de conhecimento do produto, com prioridade preferencial para o manual.

## Objetivos

- Renderizar respostas da IA em um bloco transparente, sem fundo, borda ou
  preenchimento de balão.
- Preservar avatar e identificação do assistente, além de citações, anexos,
  visualizações e rodapé.
- Exibir o estado transitório com uma linha compacta contendo “Pensando...”
  e pontos animados.
- Manter as mensagens do usuário e seus balões inalterados.
- Para o escopo `models`, consultar manual do produto, problemas e soluções.
- Para o escopo `models`, considerar também as rodadas detectadas como
  problemáticas e as intervenções registradas no período consultado.
- Dar vantagem de ranking ao manual sem tornar a prioridade absoluta; uma
  evidência operacional muito mais relevante de problema ou solução pode
  prevalecer.
- Manter as fontes e o comportamento dos demais escopos inalterados.

## Fora de escopo e antiobjetivos

- Não replicar identidade visual proprietária do ChatGPT; usar apenas o
  padrão funcional de resposta sem balão e indicador de processamento.
- Não remover dados operacionais de rodadas, disponibilidade ou intervenções.
- Não alterar o design das mensagens do usuário.
- Não aplicar o peso do manual globalmente a perguntas de problemas,
  soluções, projetos ou relatórios.
- Não tratar conteúdo recuperado como instrução executável.

## Restrições atuais

- A renderização está concentrada em
  `apps/frontend/src/components/admin/chat/message-bubble.tsx`.
- O estado de streaming atual é detectado quando não há conteúdo nem geração
  finalizada; citações e artefatos são renderizados no mesmo componente.
- O recuperador está em `apps/backend/src/silo/ai/assistant_tools.py` e usa
  pgvector com fallback lexical.
- O plano atual desabilita a busca de conhecimento para `models`, e a
  autorização atual desse escopo permite `help` e `manual`.
- O fluxo de dados de `models` já retorna rodadas e resumo, e pode retornar
  intervenções quando há um modelo identificado; porém não inclui
  `problematicRuns` nesse escopo e a busca de intervenções não recebe recorte
  temporal.
- A ferramenta híbrida `search_silo_knowledge` recebe apenas consulta e limite;
  a priorização precisa ser determinada pelo contexto do escopo sem confiar no
  modelo para ordenar fontes.

## Abordagens consideradas

### Interface

1. Remover o balão somente das respostas da IA, preservando avatar e nome.
   Mantém identificação em chats com mais de um remetente e limita o impacto
   ao componente de mensagens.
2. Remover também avatar e nome. Fica mais próximo de uma conversa individual,
   mas reduz a clareza do remetente no chat compartilhado.
3. Manter um cartão apenas durante o carregamento. É inconsistente com a
   resposta final e preserva o excesso visual que motivou a mudança.

Decisão: opção 1.

### Recuperação de conhecimento

1. Aplicar uma vantagem de fonte no ranking do recuperador, recebendo o
   contexto do escopo de forma determinística. Permite que o manual seja
   preferido sem esconder evidência operacional forte.
2. Reservar cotas fixas de resultados por fonte. Garante presença do manual,
   mas pode consumir espaço com trechos menos relevantes.
3. Apenas instruir o modelo a preferir o manual. Não garante a ordem dos
   resultados antes da síntese e é frágil para o modelo local.

Decisão: opção 1, com prioridade preferencial do manual para `models`.

## Desenho aprovado para implementação

### Frontend

- Separar as classes de layout da mensagem própria e da mensagem da IA para
  que somente a IA perca o fundo, bordas arredondadas e padding do balão.
- Manter o avatar e o nome do assistente, mas usar o fluxo normal do conteúdo
  para Markdown compacto.
- Substituir o cartão de streaming por uma linha sem fundo, com o ícone
  animado existente ou equivalente, texto “Pensando...” e três pontos com
  animação de pulso/bounce.
- Ajustar margens de parágrafos, listas e itens de lista localmente na
  resposta da IA para aproximar o espaçamento de uma quebra de linha normal.
- Preservar seletores/testes de streaming e citações, atualizando somente o
  nome do seletor se ele deixar de representar um balão.

### Backend

- Alterar o planejamento do escopo `models` para incluir a busca de
  conhecimento.
- Autorizar `manual`, `problem` e `solution` para esse escopo; não depender do
  classificador para decidir a fonte mais confiável.
- Acrescentar `problematicRuns` ao conjunto obrigatório de dados do escopo
  `models`, usando o mesmo intervalo de datas da pergunta.
- Buscar `modelInterventions` para todo o intervalo de datas quando a pergunta
  for geral; quando houver um modelo explicitamente identificado, restringir
  as intervenções a esse modelo.
- Adicionar filtros de data opcionais a `list_model_interventions`, mantendo o
  limite de resultados e a ordenação mais recente primeiro.
- Entregar status, descrição, turno, data e intervenção das rodadas
  problemáticas no contexto da síntese, sem substituir os dados agregados de
  disponibilidade.
- Propagar o escopo ou um perfil de ranking determinístico até a busca, sem
  permitir que a consulta do usuário escolha pesos arbitrários.
- Aplicar um boost moderado ao manual antes do corte final dos resultados,
  mantendo similaridade semântica/textual e recência como sinais relevantes.
- Manter no resultado a similaridade original e, se necessário, expor o score
  final de ranking separadamente para que citações continuem auditáveis.
- Cobrir com testes o caso em que o manual vence um empate ou uma pequena
  diferença e o caso em que problema/solução muito mais relevante supera o
  boost do manual.

## Verificação esperada

- Testes frontend confirmam o estado “Pensando...” e a renderização Markdown
  sem balão, sem regressão para mensagens do usuário.
- Testes backend confirmam a ativação da busca em `models`, as fontes
  autorizadas e a prioridade preferencial do manual.
- Rodar a suíte frontend, a suíte backend relevante, lint e typecheck antes de
  considerar a mudança concluída.

