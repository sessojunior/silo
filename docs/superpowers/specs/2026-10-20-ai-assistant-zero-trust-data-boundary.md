# Especificação de limite de dados do Assistente de IA

## Objetivo

O Assistente de IA deve operar em modo default-deny. O modelo só pode receber:

1. o conteúdo da mensagem enviada pelo usuário;
2. o histórico autorizado da conversa;
3. resultados de consultas previamente definidas sobre dados autorizados do SILO.

O modelo não pode escolher tabelas, escrever SQL, acessar arquivos, uploads, variáveis de ambiente, segredos, processos, shell, sistema operacional, serviços externos ou URLs arbitrárias.

## Limite de confiança

“Absoluta certeza” não é obtida apenas com prompt ou código de aplicação. A garantia deve ser composta por controles independentes: allowlist de capacidades, gateway de dados, usuário PostgreSQL somente leitura, isolamento de processo/container, política de rede e testes adversariais.

O vLLM ainda precisa receber uma requisição interna para gerar texto e precisa ler seus próprios pesos do volume de modelo. Isso é uma dependência de infraestrutura explicitamente permitida, não um acesso concedido ao modelo aos dados do sistema. O vLLM não deve ter acesso ao banco, aos uploads ou à rede externa.

## Capacidades permitidas

| Capacidade | Permitida | Regra |
|---|---:|---|
| Mensagem atual | Sim | Limite de tamanho e validação do contrato da API |
| Histórico da conversa | Sim | Somente thread do usuário autenticado |
| Banco de dados | Sim | Somente consultas fixas, projetadas e autorizadas |
| Persistência da conversa | Sim | Somente repositórios internos para mensagens/auditoria |
| SQL arbitrário | Não | Rejeitar por construção |
| Arquivos e uploads | Não | Sem volume montado no executor do assistente |
| Rede externa | Não | Egress bloqueado; somente transporte interno para vLLM |
| URLs escolhidas pelo modelo | Não | Não existem ferramentas HTTP expostas |
| Shell, subprocessos e código | Não | Dependências e políticas de container |
| PDFs, imagens, áudio e artefatos | Não | Assistente limitado a resposta textual e citações |

## Fluxo autorizado

```text
chat autenticado
  -> política de acesso
  -> gateway de conversa + gateway de dados read-only
  -> prompt composto somente com chat e dados autorizados
  -> transporte interno allowlisted para vLLM
  -> validação da resposta
  -> persistência controlada da mensagem
```

Qualquer falha de política, ferramenta desconhecida, consulta não autorizada, endpoint inválido ou tentativa de efeito colateral deve interromper a execução em estado de erro. Não deve haver fallback que pareça uma resposta do modelo.

## Controles obrigatórios

### 1. Política de capacidades

Criar um objeto imutável de capacidades para o runtime. O contexto recebido por ferramentas não deve conter uma conexão genérica de escrita, filesystem ou cliente HTTP. A política deve ser verificada no ponto de entrada de cada operação.

### 2. Gateway de dados

Encapsular consultas do assistente em um gateway com métodos explícitos. As ferramentas recebem somente esse gateway. Nenhuma ferramenta recebe SQL ou nomes de tabela vindos do modelo.

### 3. Banco

Usar um usuário PostgreSQL exclusivo para leitura do assistente, com `SELECT` apenas nas views/tabelas autorizadas. Aplicar transação `READ ONLY`, timeout de consulta, limite de linhas e RLS/escopo por usuário quando aplicável.

A gravação de mensagens deve usar uma operação separada e fixa da aplicação. O modelo não poderá usar essa conexão para executar comandos.

### 4. Remoção de efeitos colaterais

Retirar do caminho do assistente geração de PDF, leitura/exclusão de uploads, arquivos temporários, imagens, áudio e artefatos. Visualizações eventualmente necessárias devem ser dados estruturados em memória, sem gravação em disco, e só devem permanecer se forem explicitamente aprovadas como parte do contrato.

### 5. Rede

Permitir somente os destinos internos e fixos do vLLM e do embedding, sem URL configurável pelo usuário, sem proxy herdado do ambiente e sem egress externo. Em produção, não publicar portas do vLLM no host.

### 6. Isolamento de execução

Executar o assistente em processo/serviço sem volume de uploads, com root filesystem somente leitura, capacidades Linux removidas, `no-new-privileges`, `/tmp` efêmero limitado, limites de CPU/memória/tempo e rede Docker interna. O serviço não deve compartilhar credenciais do restante da API.

### 7. Conteúdo não confiável

Mensagens do usuário e textos recuperados do banco devem ser tratados como dados, nunca como instruções de sistema. Testar prompt injection armazenado no banco, instruções para revelar segredos e tentativas de induzir chamadas não permitidas.

## Evidências de aceitação

A implementação só será considerada concluída quando houver evidência de que:

- o executor não possui caminho de código para filesystem, shell ou HTTP arbitrário;
- uma tentativa de `INSERT`, `UPDATE`, `DELETE`, DDL ou SQL não allowlisted falha;
- o usuário read-only do banco não consegue escrever;
- o container do assistente não possui volume de uploads;
- uma tentativa de conexão a rede externa falha;
- endpoints de modelo fora da allowlist são rejeitados no startup;
- ferramentas desconhecidas e argumentos inválidos são rejeitados;
- prompt injection em dados do banco não altera as capacidades;
- somente mensagens e auditoria são persistidas;
- falhas ficam claramente marcadas como erro de acesso/execução, nunca como resposta de contingência apresentada como resposta do modelo.

## Fora do escopo

Esta especificação não protege contra comprometimento do kernel, do host Docker, do administrador do banco ou da imagem de container. Esses riscos exigem controles de infraestrutura, assinatura de imagens, hardening do host, gestão de segredos e auditoria operacional.
