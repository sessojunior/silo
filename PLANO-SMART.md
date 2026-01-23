# Plano de Implementação — Metas SMART em Relatórios, Produtos e Projetos

## Objetivo
Garantir que as metas exibidas nos cabeçalhos e campos de ajuda em relatórios, produtos e projetos utilizem o método SMART, com texto claro e transparente para os usuários.

## Escopo
- Relatórios: cabeçalho da página e textos de ajuda associados aos cards.
- Produtos: cabeçalhos e textos de ajuda nas seções principais do produto.
- Projetos: cabeçalho da página, listas e textos de ajuda das seções de projetos.

## Definição SMART (texto obrigatório)
As metas precisam ser apresentadas de forma explícita com os cinco critérios abaixo:
- Específico — O que exatamente você quer?
- Mensurável — Quanto falta para atingir a meta?
- Atingível — Sua meta é realista?
- Relevante — Por que esta meta é importante?
- Temporizável — Em quanto tempo você quer atingir essa meta?

## Premissas e Restrições
- Next.js 16+ (App Router), React 19+, TailwindCSS 4+ e ShadCN/UI.
- Programação funcional, sem lógica de negócio em componentes de UI.
- Sem uso de `any`, com tipagem explícita.
- Nada deve ser adiantado: Banco → Auth → Regras de domínio → API → UI.
- Alterações focadas em conteúdo e apresentação; backend apenas se necessário.

## Checklist de Descoberta
- [ ] Mapear todos os cabeçalhos de relatórios, produtos e projetos.
- [ ] Mapear todos os campos de ajuda (subtítulos, descrições e tooltips).
- [ ] Identificar pontos reutilizáveis para texto SMART.
- [ ] Confirmar consistência visual com o design existente.

## Checklist de Implementação
- [ ] Criar fonte única de texto SMART para evitar duplicação.
- [ ] Definir variações de texto por contexto (relatórios, produtos, projetos).
- [ ] Aplicar texto SMART nos cabeçalhos relevantes.
- [ ] Aplicar texto SMART nos campos de ajuda relevantes.
- [ ] Garantir contraste e legibilidade em modo claro e escuro.
- [ ] Manter linguagem simples e direta para usuários finais.

## Etapas Detalhadas
### 1) Levantamento e Inventário
- [ ] Relatórios: mapear cabeçalho e descrição atuais na [ReportsPage.tsx](file:///f:/INPE/silo/sessojunior/silo/src/components/admin/reports/ReportsPage.tsx).
- [ ] Projetos: mapear cabeçalho e textos de ajuda da lista em [page.tsx](file:///f:/INPE/silo/sessojunior/silo/src/app/admin/projects/page.tsx).
- [ ] Produtos: mapear cabeçalhos e textos de ajuda em [page.tsx](file:///f:/INPE/silo/sessojunior/silo/src/app/admin/products/%5Bslug%5D/page.tsx).
- [ ] Produtos: mapear conteúdo auxiliar em [ProductDetailsColumn.tsx](file:///f:/INPE/silo/sessojunior/silo/src/components/admin/products/ProductDetailsColumn.tsx).
- [ ] Produtos: mapear conteúdo auxiliar em [ProductManualSection.tsx](file:///f:/INPE/silo/sessojunior/silo/src/components/admin/products/ProductManualSection.tsx).

### 2) Design do Texto SMART
- [ ] Definir o bloco de texto SMART como elemento reutilizável.
- [ ] Redigir versões curtas e longas para cabeçalho e ajuda.
- [ ] Garantir português brasileiro simples e direto.
- [ ] Ajustar tamanho e espaçamento para harmonizar com headers existentes.

### 3) Planejamento de Inserção nos Cabeçalhos
- [ ] Relatórios: atualizar o texto abaixo do título da página com SMART.
- [ ] Projetos: atualizar texto de ajuda no cabeçalho principal.
- [ ] Projetos: atualizar texto de ajuda na seção de lista.
- [ ] Produtos: inserir SMART nas seções com cabeçalho principal.
- [ ] Produtos: inserir SMART na seção de manual do produto.

### 4) Planejamento de Inserção nos Campos de Ajuda
- [ ] Identificar campos de ajuda existentes nas páginas.
- [ ] Definir onde usar texto auxiliar vs. tooltip.
- [ ] Aplicar o bloco SMART mantendo o padrão visual.
- [ ] Validar consistência com componentes de UI já usados no projeto.

### 5) Validação e Aceite
- [ ] Conferir textos em modo claro e escuro.
- [ ] Verificar que não há sobreposição com conteúdo dinâmico.
- [ ] Confirmar que a linguagem está alinhada com o produto e o público.
- [ ] Validar que não há impacto funcional em navegação e filtros.

## Critérios de Aceite
- Todos os cabeçalhos relevantes exibem o bloco SMART.
- Todos os campos de ajuda relevantes exibem o bloco SMART.
- Texto consistente e legível em toda a aplicação.
- Nenhum impacto funcional nos fluxos existentes.

## Plano de Verificação
- Revisar páginas de Relatórios, Produtos e Projetos no navegador.
- Checar responsividade dos novos textos nos breakpoints usados.
- Rodar lint e typecheck após implementação.
