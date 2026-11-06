# Arquitetura do Qwen compartilhado

## Intenção

Retirar o servidor do modelo de linguagem da hierarquia Docker específica do
SILO, mantendo no SILO o banco, os documentos, os embeddings, o indexador e os
serviços da aplicação. O modelo será disponibilizado por um serviço neutro
chamado `qwen`, que poderá atender o SILO e outros projetos.

## Decisão

- O Qwen será executado em um Compose separado, no serviço `qwen`.
- O serviço usará a GPU 0 por padrão.
- `embeddings` continuará no Compose do SILO e poderá usar a GPU 1.
- API, indexador e demais componentes do SILO acessarão o Qwen pela rede Docker
  externa `shared-inference`.
- Os embeddings e dados vetoriais continuarão isolados no banco e na hierarquia
  do SILO.
- O nome explícito do modelo servido será `qwen`, evitando que clientes
  dependam do caminho completo do repositório Hugging Face.
- Outros projetos no mesmo host poderão entrar na rede externa
  `shared-inference` e chamar `http://qwen:8000/v1`, sem acessar volumes ou dados
  do SILO.

## Fora do escopo

Esta mudança não cria ainda um gateway de autenticação ou quotas por projeto,
não altera o modelo de embeddings e não configura tensor parallelism entre as
duas GPUs. Para projetos fora do host Docker, é necessário um gateway privado
com autenticação e TLS; a rede compartilhada atende apenas consumidores no mesmo
host.
