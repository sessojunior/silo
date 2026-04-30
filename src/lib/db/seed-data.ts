import * as schema from "@/lib/db/schema";

// === TIPAGENS DO SCHEMA ===
export type ProductData = Pick<
  typeof schema.product.$inferInsert,
  "name" | "slug" | "available" | "priority" | "turns"
>;
export type GroupData = Omit<
  typeof schema.group.$inferInsert,
  "id" | "createdAt" | "updatedAt"
>;
export type ContactData = Omit<
  typeof schema.contact.$inferInsert,
  "id" | "createdAt" | "updatedAt"
>;
export type TestUserData = Pick<
  typeof schema.authUser.$inferInsert,
  "name" | "email" | "emailVerified" | "isActive"
> & { groupName: string };
export type ProjectData = Omit<
  typeof schema.project.$inferInsert,
  "id" | "createdAt" | "updatedAt"
>;
export type ManualData = { productSlug: string; description: string };

export type ProjectActivityData = Omit<
  typeof schema.projectActivity.$inferInsert,
  "id" | "projectId" | "createdAt" | "updatedAt"
>;

export interface DependencyItem {
  name: string;
  icon: string | null;
  description?: string;
  children?: DependencyItem[];
}

// === DADOS BÁSICOS ===
export const products: ProductData[] = [
  {
    name: "BAM",
    slug: "bam",
    available: true,
    priority: "normal",
    turns: ["0"],
  },
  {
    name: "SMEC",
    slug: "smec",
    available: true,
    priority: "high",
    turns: ["0", "12"],
  },
  {
    name: "BRAMS AMS 15KM",
    slug: "brams-ams-15km",
    available: true,
    priority: "urgent",
    turns: ["0", "6", "12", "18"],
  },
  { name: "WRF", slug: "wrf", available: true, priority: "low", turns: ["0"] },
];

export const groups: GroupData[] = [
  {
    name: "Administradores",
    description: "Administradores do sistema com acesso completo",
    icon: "icon-[lucide--shield-check]",
    color: "#DC2626",
    role: "admin", // Grupo administrativo
    active: true,
    isDefault: false,
  },
  {
    name: "Operadores",
    description: "Operadores responsáveis pelo funcionamento dos sistemas",
    icon: "icon-[lucide--settings]",
    color: "#059669",
    role: "user", // Grupo de usuários normais
    active: true,
    isDefault: false,
  },
  {
    name: "Suporte",
    description: "Equipe de suporte técnico e atendimento",
    icon: "icon-[lucide--headphones]",
    color: "#EA580C",
    role: "user", // Grupo de usuários normais
    active: true,
    isDefault: false,
  },
  {
    name: "Visitantes",
    description: "Usuários externos com acesso limitado",
    icon: "icon-[lucide--user-check]",
    color: "#64748B",
    role: "user", // Grupo de usuários normais
    active: true,
    isDefault: true,
  },
];

export const contacts: ContactData[] = [
  {
    name: "Carlos",
    role: "Coordenador de infraestrutura",
    team: "WEB",
    email: "carlos@inpe.br",
    phone: "+55 12 3208-6000",
    image: null,
    active: true,
  },
  {
    name: "Rogério",
    role: "Analista de sistemas",
    team: "Pesquisas",
    email: "rogerio@inpe.br",
    phone: "+55 12 3208-6001",
    image: null,
    active: true,
  },
  {
    name: "Luis",
    role: "Administrador de sistemas",
    team: "Supercomputação",
    email: "luis@inpe.br",
    phone: "+55 12 3208-6002",
    image: null,
    active: true,
  },
];

export const testUsers: TestUserData[] = [
  {
    name: "Alex",
    email: "alex@inpe.br",
    emailVerified: true,
    isActive: true,
    groupName: "Administradores",
  },
  {
    name: "Fabiano",
    email: "fabiano@inpe.br",
    emailVerified: true,
    isActive: true,
    groupName: "Operadores",
  },
  {
    name: "André",
    email: "andre@inpe.br",
    emailVerified: true,
    isActive: true,
    groupName: "Suporte",
  },
  {
    name: "Marcos",
    email: "marcos@inpe.br",
    emailVerified: true,
    isActive: true,
    groupName: "Operadores",
  },
];

export const problemTitles = [
  "Erro ao processar dados meteorológicos",
  "Falha na importação de arquivos",
  "Inconsistência nos resultados do modelo",
  "Problema de performance em simulações longas",
  "Dificuldade na configuração inicial",
  "Erro de permissão ao acessar diretórios",
  "Resultados divergentes entre execuções",
  "Interface gráfica não carrega corretamente",
  "Logs não estão sendo salvos",
  "Parâmetros de entrada não reconhecidos",
  "Erro ao exportar resultados",
  "Timeout durante execução do modelo",
  "Falha ao conectar com serviço externo",
  "Dados de entrada corrompidos",
  "Problema de compatibilidade com sistema operacional",
  "Erro de memória insuficiente",
  "Falha ao atualizar dependências",
  "Problema ao gerar gráficos",
  "Erro ao validar parâmetros",
  "Dificuldade para acessar manual do usuário",
];

export const problemDescriptions = [
  [
    "Ao tentar processar os dados meteorológicos, o sistema apresenta uma mensagem de erro indicando falha na leitura dos arquivos.",
    "Além disso, arquivos muito grandes podem causar estouro de memória, especialmente em ambientes com recursos limitados.",
    "Recomenda-se validar os arquivos antes de iniciar o processamento e garantir que estejam de acordo com o padrão exigido pelo sistema.",
    "Caso o erro persista, consulte os logs detalhados para identificar a linha exata do problema e, se necessário, entre em contato com o suporte técnico.",
  ],
  [
    "Durante a importação de arquivos, o sistema pode não reconhecer determinados formatos ou encontrar permissões insuficientes para leitura.",
    "É importante garantir que os arquivos estejam no diretório correto e que o usuário do sistema tenha acesso de leitura.",
    "Falhas silenciosas podem ocorrer se o nome do arquivo contiver caracteres especiais ou espaços em branco no final.",
    "Verifique também se não há arquivos duplicados, pois isso pode causar conflitos durante a importação.",
  ],
  // ... adicionar mais conforme necessário
];

export const solutionDescriptions = [
  "Verifique se os dados meteorológicos estão no formato esperado.",
  "Confirme se os arquivos possuem as permissões corretas.",
  "Reinicie o sistema e tente novamente.",
  "Otimize os parâmetros de simulação para melhorar a performance.",
  "Siga o passo a passo do manual de configuração.",
  "Ajuste as permissões dos diretórios de trabalho.",
  "Compare os resultados com execuções anteriores para identificar padrões.",
  "Limpe o cache do navegador e recarregue a página.",
  "Verifique o caminho de destino dos logs no arquivo de configuração.",
  "Consulte a documentação para os parâmetros aceitos.",
  "Atualize o software para a versão mais recente.",
  "Aumente o tempo limite de execução nas configurações.",
  "Verifique a conexão com a internet e serviços externos.",
  "Reimporte os dados de entrada após validação.",
  "Instale as dependências compatíveis com seu sistema operacional.",
  "Libere memória ou feche outros aplicativos antes de executar.",
  "Execute o comando de atualização de dependências novamente.",
  "Revise os dados utilizados para gerar os gráficos.",
  "Corrija os parâmetros conforme as mensagens de erro.",
  "Acesse o manual diretamente pelo site oficial.",
];

export const dependencyStructure: DependencyItem[] = [
  {
    name: "Equipamentos",
    icon: null,
    description:
      "Infraestrutura física e de rede necessária para o funcionamento dos produtos meteorológicos. Inclui servidores, workstations, clusters de processamento e toda a conectividade de rede interna e externa.",
    children: [
      {
        name: "Máquinas",
        icon: null,
        description:
          "Hardware de computação utilizado para processamento, armazenamento e execução dos modelos meteorológicos.",
        children: [
          {
            name: "Servidor Principal",
            icon: "icon-[lucide--server]",
            description:
              "Servidor central responsável pela coordenação dos processos, gerenciamento de dados e execução dos modelos meteorológicos. Especificações: 64GB RAM, 16 cores, 10TB armazenamento.",
          },
          {
            name: "Workstation Linux",
            icon: "icon-[lucide--computer]",
            description:
              "Estação de trabalho Linux para desenvolvimento, testes e análise de dados meteorológicos. Configurada com ferramentas de visualização e análise científica.",
          },
          {
            name: "Cluster de Processamento",
            icon: "icon-[lucide--cpu]",
            description:
              "Cluster de alta performance para processamento paralelo de modelos meteorológicos. Composto por múltiplos nós de computação com processadores de alta frequência.",
          },
        ],
      },
      {
        name: "Redes internas",
        icon: null,
        description:
          "Infraestrutura de rede interna do INPE/CPTEC para comunicação entre equipamentos e sistemas.",
        children: [
          {
            name: "Rede CPTEC",
            icon: "icon-[lucide--network]",
            description:
              "Rede principal do CPTEC com alta disponibilidade e redundância. Fornece conectividade entre todos os sistemas meteorológicos e bancos de dados.",
          },
          {
            name: "Rede Laboratório",
            icon: "icon-[lucide--network]",
            description:
              "Rede dedicada para laboratórios de pesquisa e desenvolvimento. Isolada da rede principal para testes e experimentos.",
          },
        ],
      },
      {
        name: "Redes externas",
        icon: null,
        description:
          "Conectividade externa necessária para recebimento de dados meteorológicos, comunicação com outros centros e acesso à internet.",
        children: [
          {
            name: "Internet INPE",
            icon: "icon-[lucide--globe]",
            description:
              "Conexão principal de internet do INPE com alta velocidade e redundância. Utilizada para download de dados meteorológicos globais e comunicação com centros internacionais.",
          },
          {
            name: "VPN Científica",
            icon: "icon-[lucide--shield]",
            description:
              "Rede privada virtual para comunicação segura com outros centros de pesquisa meteorológica e acesso a dados restritos.",
          },
        ],
      },
    ],
  },
  {
    name: "Dependências",
    icon: null,
    description:
      "Dependências de software, sistemas e recursos humanos necessários para o funcionamento e manutenção dos produtos meteorológicos.",
    children: [
      {
        name: "Sistema",
        icon: null,
        description:
          "Dependências de software e sistemas operacionais necessários para execução dos modelos e processamento de dados.",
        children: [
          {
            name: "Hosts",
            icon: null,
            description:
              "Máquinas específicas que hospedam os sistemas e executam os modelos meteorológicos.",
            children: [
              {
                name: "met01.cptec.inpe.br",
                icon: "icon-[lucide--computer]",
                description:
                  "Servidor principal de meteorologia do CPTEC. Responsável pela execução dos modelos de previsão numérica do tempo e processamento de dados observacionais.",
              },
              {
                name: "model02.cptec.inpe.br",
                icon: "icon-[lucide--computer]",
                description:
                  "Servidor secundário para backup e processamento paralelo. Utilizado para execução de modelos de alta resolução e simulações experimentais.",
              },
            ],
          },
          {
            name: "Softwares",
            icon: null,
            description:
              "Aplicações e bibliotecas de software necessárias para processamento, análise e visualização de dados meteorológicos.",
            children: [
              {
                name: "Python 3.9+",
                icon: "icon-[lucide--code]",
                description:
                  "Linguagem de programação principal para scripts de processamento, análise de dados e automação de tarefas meteorológicas. Versão mínima 3.9 para compatibilidade com bibliotecas científicas.",
              },
              {
                name: "NetCDF4",
                icon: "icon-[lucide--database]",
                description:
                  "Biblioteca para leitura e escrita de arquivos NetCDF, formato padrão para dados meteorológicos e climáticos. Essencial para manipulação de dados de modelos numéricos.",
              },
              {
                name: "GrADS",
                icon: "icon-[lucide--bar-chart]",
                description:
                  "Sistema de análise e visualização de dados geofísicos. Utilizado para criação de mapas meteorológicos, gráficos e análises estatísticas de dados atmosféricos.",
              },
            ],
          },
        ],
      },
      {
        name: "Recursos humanos",
        icon: null,
        description:
          "Pessoas responsáveis pelo desenvolvimento, manutenção e suporte dos sistemas meteorológicos.",
        children: [
          {
            name: "Responsáveis técnicos do INPE",
            icon: null,
            description:
              "Especialistas técnicos do INPE responsáveis pelo desenvolvimento e manutenção dos sistemas meteorológicos.",
            children: [
              {
                name: "João Silva",
                icon: "icon-[lucide--user-round]",
                description:
                  "Engenheiro de Sistemas especializado em meteorologia computacional. Responsável pela manutenção dos modelos numéricos e otimização de performance.",
              },
              {
                name: "Maria Santos",
                icon: "icon-[lucide--user-round]",
                description:
                  "Cientista da Computação com doutorado em Meteorologia. Especialista em processamento de dados atmosféricos e desenvolvimento de algoritmos de previsão.",
              },
            ],
          },
          {
            name: "Suporte",
            icon: null,
            description:
              "Equipe de suporte técnico responsável pela operação e resolução de problemas dos sistemas meteorológicos.",
            children: [
              {
                name: "Carlos Tech",
                icon: "icon-[lucide--headphones]",
                description:
                  "Técnico de suporte especializado em sistemas Linux e redes. Responsável pela manutenção preventiva e resolução de problemas de infraestrutura.",
              },
              {
                name: "Ana Support",
                icon: "icon-[lucide--headphones]",
                description:
                  "Analista de sistemas com experiência em meteorologia operacional. Responsável pelo monitoramento 24/7 e suporte aos usuários dos sistemas.",
              },
            ],
          },
        ],
      },
    ],
  },
];

export const projectsData: ProjectData[] = [
  {
    name: "Sistema de Monitoramento Meteorológico",
    shortDescription:
      "Modernização do sistema de coleta e análise de dados meteorológicos",
    description:
      "Projeto para implementar um novo sistema de monitoramento meteorológico com sensores IoT, análise em tempo real e interface web moderna. O sistema incluirá previsão baseada em machine learning e alertas automáticos.",
    startDate: "2024-01-15",
    endDate: "2024-12-15",
    priority: "high",
    status: "active",
  },
];

export const helpDocumentation = `# 📚 Manual do Usuário - Sistema SILO

## 🎯 Visão Geral
O Sistema SILO é uma plataforma web avançada desenvolvida especificamente para o gerenciamento de produtos meteorológicos do INPE/CPTEC. O sistema centraliza o monitoramento, controle e colaboração em torno dos principais modelos meteorológicos operacionais: BAM (Modelo Global), SMEC (Sistema de Meteorologia), BRAMS AMS 15KM (Modelo Regional) e WRF (Weather Research and Forecasting).

A plataforma oferece uma interface unificada que permite aos meteorologistas, pesquisadores e operadores acompanhar em tempo real o status de execução dos modelos, identificar problemas rapidamente e colaborar na resolução de questões técnicas. O sistema integra funcionalidades de dashboard, gestão de projetos, comunicação em tempo real e base de conhecimento, proporcionando um ambiente completo para operação meteorológica.

O SILO foi desenvolvido com foco na segurança institucional, utilizando autenticação baseada em domínio @inpe.br e sistema de ativação obrigatória por administradores. A arquitetura modular permite escalabilidade e adaptação às necessidades específicas do CPTEC/INPE, garantindo conformidade com os requisitos de segurança e operação institucional.

## 🏠 Acesso
O acesso ao sistema SILO é restrito exclusivamente a usuários com email institucional @inpe.br, garantindo a segurança e conformidade com as políticas do CPTEC/INPE. A URL oficial do sistema é https://fortuna.cptec.inpe.br/silo, onde os usuários podem realizar login utilizando suas credenciais institucionais.

O sistema oferece múltiplas opções de autenticação para maior flexibilidade: login tradicional com email e senha, login simplificado apenas com email (recebendo código OTP por email), e integração com Google OAuth para usuários que preferem autenticação social. Todas as opções mantêm a validação rigorosa do domínio @inpe.br.

Após o cadastro inicial, todos os novos usuários são criados com status inativo por padrão, sendo necessária a ativação manual por um administrador do sistema. Esta política de segurança garante que apenas usuários autorizados tenham acesso ao sistema, alinhando-se com os requisitos de segurança institucional do CPTEC/INPE.

## 📊 Dashboard
O Dashboard é o centro de controle do sistema SILO, oferecendo uma visão consolidada e em tempo real de todos os produtos meteorológicos operacionais. A interface principal apresenta uma timeline de 28 dias que permite acompanhar o histórico de execução de cada modelo, identificando padrões, problemas recorrentes e tendências de performance.

Os gráficos interativos utilizam a biblioteca ApexCharts para apresentar métricas de disponibilidade, distribuição de problemas por categoria, performance da equipe e estatísticas de resolução. Cada gráfico é responsivo e adapta-se automaticamente ao tema dark/light selecionado pelo usuário, proporcionando uma experiência visual consistente.

O sistema de cores padronizado utiliza uma hierarquia visual clara: vermelho para problemas críticos, laranja para execuções que precisam ser refeitas, amarelo para falhas de execução, violeta para situações sob intervenção técnica, azul para execuções suspensas, cinza para processamento em andamento, transparente para aguardando execução, e verde para execuções bem-sucedidas.

A atualização automática dos dados garante que as informações apresentadas estejam sempre atualizadas, enquanto os filtros de data e período permitem análises históricas detalhadas. O dashboard também inclui alertas visuais para situações críticas que requerem atenção imediata da equipe técnica.

## 📦 Produtos
O módulo de Produtos é o núcleo operacional do sistema SILO, gerenciando os quatro principais modelos meteorológicos do CPTEC/INPE. Cada produto possui características específicas de execução, incluindo turnos de processamento, prioridades operacionais e dependências técnicas que influenciam o planejamento e monitoramento.

O **BAM (Brazilian Atmospheric Model)** é o modelo global operacional executado no turno 0 (meia-noite), sendo fundamental para previsões de longo prazo e análises climáticas. O **SMEC (Sistema de Meteorologia e Climatologia)** opera nos turnos 0 e 12, fornecendo dados essenciais para operação meteorológica diária. O **BRAMS AMS 15KM** é o modelo regional de alta resolução executado nos turnos 0, 6, 12 e 18, oferecendo previsões detalhadas para a América do Sul. O **WRF (Weather Research and Forecasting)** complementa os outros modelos com simulações de alta resolução nos mesmos turnos do BRAMS.

Cada produto possui um sistema de status detalhado que reflete o estado atual da execução: **Concluído** indica execução bem-sucedida, **Pendente** significa aguardando execução, **Em execução** mostra processamento em andamento, **Sob intervenção** indica suporte técnico ativo, **Suspenso** representa execução pausada, **Não rodou** indica falha na execução, e **Com problemas** sinaliza execução com inconsistências que requerem investigação.

O sistema permite associação de contatos técnicos específicos para cada produto, facilitando a comunicação direta com responsáveis especializados. Além disso, cada produto possui um manual técnico editável em Markdown, documentação de dependências hierárquicas e histórico completo de problemas e soluções implementadas.

## 🚀 Projetos
O módulo de Projetos oferece uma plataforma completa para gestão de iniciativas científicas e técnicas do CPTEC/INPE. O sistema utiliza metodologia Kanban para organizar atividades em colunas de status (A Fazer, Em Progresso, Bloqueado, Em Revisão, Concluído), proporcionando visibilidade clara do progresso e facilitando a colaboração entre equipes.

Cada projeto pode conter múltiplas atividades, que por sua vez são divididas em tarefas específicas. O sistema de drag-and-drop permite reorganização intuitiva das tarefas entre diferentes status, enquanto estimativas de tempo e datas de início/fim ajudam no planejamento e controle de prazos. As atividades são categorizadas por tipo (Análise, Desenvolvimento, Testes, etc.) e priorizadas conforme a criticidade.

O sistema gera estatísticas automáticas de progresso, incluindo percentual de conclusão, tempo estimado vs. real, distribuição de tarefas por status e performance da equipe. Os gráficos de acompanhamento permitem identificar gargalos, atrasos e oportunidades de otimização do fluxo de trabalho.

A integração com o sistema de chat permite comunicação contextual dentro de cada projeto, enquanto a associação com produtos meteorológicos facilita o rastreamento de iniciativas relacionadas a melhorias operacionais específicas.

## 👥 Grupos
O sistema de Grupos implementa uma arquitetura de permissões hierárquica que organiza os usuários conforme suas funções e responsabilidades no CPTEC/INPE. Cada grupo possui características específicas de acesso e funcionalidades disponíveis, garantindo segurança e organização adequada.

O grupo **Administradores** possui acesso completo ao sistema, incluindo gestão de usuários, configurações avançadas e relatórios administrativos. Os grupos podem ter role **admin** ou **user**, definindo as permissões dos membros. O grupo "Administradores" é especial e sempre possui role **admin**. Apenas um grupo pode ter role **admin** no sistema.

Os grupos padrão incluem **Operadores**, responsáveis pela execução e monitoramento dos sistemas, tendo acesso a dashboards operacionais e ferramentas de controle. O grupo **Suporte** possui acesso limitado focado em resolução de problemas técnicos e atendimento aos usuários. Os **Visitantes** têm acesso restrito para consulta de informações públicas e documentação básica.

O sistema permite que usuários pertençam a múltiplos grupos simultaneamente, com permissões acumulativas. Cada grupo possui ícone distintivo e cor de identificação. A gestão de grupos é centralizada na interface administrativa, permitindo criação, edição e exclusão conforme necessidades organizacionais. Grupos não possuem limite de usuários.

## 💬 Chat
O sistema de Chat implementa uma plataforma de comunicação em tempo real inspirada no WhatsApp, oferecendo funcionalidades avançadas para colaboração entre equipes do CPTEC/INPE. A interface suporta conversas em grupos específicos e mensagens diretas entre usuários, facilitando a comunicação contextual e resolução rápida de problemas.

O sistema de presença mostra o status atual de cada usuário (Online, Ausente, Ocupado, Offline), permitindo que a equipe saiba quando colegas estão disponíveis para comunicação. O emoji picker integrado oferece mais de 6 categorias de emojis com funcionalidade de busca, enriquecendo a comunicação e expressão das mensagens.

As notificações em tempo real garantem que mensagens importantes sejam recebidas imediatamente, enquanto o sistema de polling inteligente otimiza o consumo de recursos, sincronizando apenas quando necessário. O histórico de mensagens é preservado com paginação automática, permitindo consulta de conversas anteriores.

O chat pode ser ativado ou desativado individualmente por cada usuário através das configurações, reduzindo consumo de banco de dados quando não necessário. A integração com grupos de usuários permite criação de salas específicas por departamento, projeto ou função, facilitando a organização da comunicação institucional.

## ⚙️ Configurações
O módulo de Configurações oferece controle completo sobre preferências pessoais e configurações de conta do usuário. A interface unificada organiza todas as opções em seções lógicas: Perfil (dados pessoais), Preferências (comportamento do sistema) e Segurança (senhas e autenticação).

Na seção de Perfil, os usuários podem editar informações pessoais, fazer upload de foto de avatar com otimização automática, e atualizar dados de contato. O sistema de upload local garante segurança institucional, processando imagens automaticamente para formato WebP com redimensionamento otimizado.

As Preferências incluem configurações de tema (dark/light), notificações por email, controle de chat (ativar/desativar), e configurações de interface. Todas as alterações são salvas automaticamente, proporcionando experiência personalizada e consistente em todas as sessões.

A seção de Segurança permite alteração de senha com validações rigorosas, configuração de autenticação de dois fatores, e visualização de sessões ativas. O sistema mantém histórico de alterações de segurança e envia notificações por email para mudanças críticas, garantindo transparência e controle sobre a conta do usuário.

## 🔧 Suporte
O sistema de Suporte integra múltiplas funcionalidades para assistência técnica e base de conhecimento. A documentação hierárquica organiza informações em seções navegáveis, permitindo busca rápida por tópicos específicos e acesso contextual a manuais técnicos.

A base de conhecimento é editável em tempo real através de editor Markdown integrado, permitindo que especialistas atualizem documentação conforme evolução dos sistemas. O sistema de busca inteligente localiza conteúdo por palavras-chave, facilitando descoberta de informações relevantes.

O chat de suporte oferece comunicação direta com equipe técnica especializada, enquanto o sistema de problemas permite criação de tickets estruturados com categorização automática e acompanhamento de status. Cada problema pode ser associado a produtos específicos e contatos técnicos responsáveis.

Os manuais específicos de cada produto meteorológico são acessíveis diretamente do módulo de Produtos, oferecendo documentação técnica detalhada sobre instalação, configuração, utilização e troubleshooting. O sistema mantém histórico de alterações na documentação, permitindo rastreamento de evolução e colaboração entre especialistas.

----

*Manual do Usuário do Sistema SILO - CPTEC/INPE*`;

export const manualData: ManualData[] = [
  {
    productSlug: "bam",
    description: `# Manual do Sistema BAM

## Introdução
O Sistema de Análise e Previsão Global (BAM) é o modelo numérico operacional do CPTEC para previsão meteorológica global. Este sistema utiliza dados atmosféricos globais para gerar previsões de tempo de curto a médio prazo.

## Configuração
O BAM requer configuração específica de parâmetros meteorológicos e condições iniciais. O sistema utiliza dados de entrada do GFS (Global Forecast System) e processa informações atmosféricas em resolução global.

## Utilização
O sistema executa automaticamente no turno 0h (meia-noite) e gera produtos de previsão meteorológica global. Os resultados são disponibilizados através de interfaces web e APIs para consulta pelos usuários autorizados.`,
  },
  {
    productSlug: "smec",
    description: `# Manual do Sistema SMEC

## Introdução
O Sistema de Meteorologia e Climatologia (SMEC) é responsável pelo processamento e análise de dados meteorológicos operacionais. Este sistema integra dados observacionais e de modelos numéricos para fornecer informações meteorológicas precisas.

## Configuração
O SMEC opera nos turnos 0h e 12h, processando dados meteorológicos em tempo real. O sistema utiliza algoritmos de análise objetiva e assimilação de dados para gerar campos meteorológicos analisados.

## Utilização
O sistema processa dados meteorológicos automaticamente e disponibiliza produtos de análise e previsão através de interfaces web. Os usuários podem acessar mapas meteorológicos, gráficos e dados numéricos através do portal web.`,
  },
  {
    productSlug: "brams-ams-15km",
    description: `# Manual do BRAMS AMS 15KM

## Introdução
O Brazilian Regional Atmospheric Modeling System com resolução de 15km é um modelo meteorológico regional de alta resolução para a América do Sul. Este sistema fornece previsões detalhadas para regiões específicas do continente.

## Configuração
O BRAMS opera nos turnos 0h, 6h, 12h e 18h com resolução horizontal de 15km. O modelo utiliza condições de contorno do BAM e processa dados meteorológicos regionais com alta precisão espacial e temporal.

## Utilização
O sistema gera previsões meteorológicas regionais com alta resolução espacial. Os produtos incluem mapas de precipitação, temperatura, vento e outros parâmetros meteorológicos específicos para a América do Sul.`,
  },
  {
    productSlug: "wrf",
    description: `# Manual do Sistema WRF

## Introdução
O Weather Research and Forecasting (WRF) é um modelo meteorológico de alta resolução implementado no CPTEC para simulações meteorológicas detalhadas. Este sistema é amplamente utilizado para pesquisa e previsão meteorológica.

## Configuração
O WRF opera no turno 0h utilizando dados de entrada do modelo global. O sistema pode ser configurado para diferentes domínios geográficos e resoluções espaciais conforme a necessidade específica da aplicação.

## Utilização
O sistema executa simulações meteorológicas de alta resolução e gera produtos específicos para análise e previsão. Os resultados são utilizados tanto para operação meteorológica quanto para pesquisa científica em meteorologia.`,
  },
];

// Funções auxiliares para gerar dados dinâmicos
export function generateProblems() {
  return [
    {
      title: "Falha na execução do modelo",
      description:
        "O modelo apresentou erro durante a execução devido a problemas de conectividade com o servidor de dados meteorológicos. O sistema não conseguiu baixar os dados de entrada necessários para o processamento.",
    },
  ];
}

export function generateSolutions() {
  return [
    {
      description:
        "Verificar a conectividade de rede e reiniciar o serviço de dados meteorológicos. Se o problema persistir, contatar a equipe de infraestrutura para verificação dos servidores.",
    },
  ];
}

// === DADOS DO CHAT ULTRA SIMPLIFICADO ===
// Mensagens de exemplo são criadas dinamicamente no seed.ts
// Não há necessidade de dados estáticos para o novo sistema

// Atividades de exemplo para projetos - organizadas por projeto
export const projectActivitiesData = {
  // PROJETO 1: Sistema de Monitoramento Meteorológico - 5 atividades
  meteorologia: [
    {
      name: "Análise e Requisitos do Sistema",
      description:
        "Levantamento detalhado dos requisitos funcionais e não funcionais para monitoramento meteorológico em tempo real",
      category: "Análise",
      estimatedDays: 5,
      startDate: "2024-01-15",
      endDate: "2024-01-20",
      priority: "high",
      status: "done",
    },
    {
      name: "Design da Interface",
      description:
        "Criação de mockups e protótipos para interface de visualização de dados meteorológicos",
      category: "Design",
      estimatedDays: 8,
      startDate: "2024-01-21",
      endDate: "2024-01-29",
      priority: "high",
      status: "done",
    },
    {
      name: "Implementação do Backend",
      description:
        "Desenvolvimento das APIs REST para coleta, processamento e disponibilização de dados meteorológicos",
      category: "Desenvolvimento",
      estimatedDays: 15,
      startDate: "2024-01-30",
      endDate: "2024-02-14",
      priority: "urgent",
      status: "progress",
    },
    {
      name: "Desenvolvimento da Interface",
      description:
        "Implementação dos componentes React para visualização de mapas, gráficos e alertas meteorológicos",
      category: "Desenvolvimento",
      estimatedDays: 12,
      startDate: "2024-02-05",
      endDate: "2024-02-17",
      priority: "urgent",
      status: "progress",
    },
    {
      name: "Testes e Deploy",
      description:
        "Validação da performance do sistema com grandes volumes de dados meteorológicos e deploy em produção",
      category: "Testes",
      estimatedDays: 6,
      startDate: "2024-02-26",
      endDate: "2024-03-04",
      priority: "medium",
      status: "todo",
    },
  ],

  // Outros projetos sem atividades
  clima: [],
  portal: [],
  previsao: [],
  infraestrutura: [],
};
