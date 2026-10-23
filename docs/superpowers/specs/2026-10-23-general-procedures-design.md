# Procedimentos gerais e anexos consultáveis pela IA — Especificação

**Status:** aprovado para planejamento

## Objetivo

Criar uma base de conhecimento de procedimentos gerais, independente de um
produto ou de um problema específico, com cadastro, listagem, edição, exclusão
e anexos. A IA poderá consultar o texto dos procedimentos e, com prioridade
operacional, o conteúdo extraído dos arquivos anexados.

## Escopo

### Incluído

- Página de menu **Procedimentos gerais**.
- CRUD de procedimentos em Markdown.
- Anexos de imagens e documentos.
- Arquivos armazenados no disco/volume de uploads; o banco guarda apenas
  metadados, referências e conteúdo derivado para busca.
- Extração de texto de PDF, TXT/MD, DOCX e PPTX.
- Arquitetura extensível para novos formatos; formatos sem extrator não são
  aceitos silenciosamente.
- OCR/descrição textual para imagens, com possibilidade de análise direta por
  modelo multimodal quando esse runtime estiver configurado.
- Indexação semântica dos textos, anexos e descrições para consulta da IA.
- Citações indicando procedimento, arquivo e, quando disponível, página ou
  slide.
- Consulta somente leitura pela IA nesta primeira entrega.

### Fora do escopo desta entrega

- A IA criar, editar ou excluir procedimentos sem confirmação humana.
- Vincular um procedimento geral obrigatoriamente a um produto ou problema.
- Armazenar binários de anexos em colunas do PostgreSQL.
- Aceitar qualquer extensão de arquivo sem validação e sem extrator.

## Modelo de dados

Serão adicionadas três tabelas relacionadas:

### `general_procedure`

- `id`
- `title`
- `category` opcional
- `content` em Markdown
- `active`
- `user_id` do autor
- `created_at`
- `updated_at`

### `general_procedure_attachment`

- `id`
- `procedure_id`
- `kind`: `image` ou `document`
- `original_name`
- `stored_filename`
- `storage_kind`/caminho lógico do upload
- `mime_type`
- `size_bytes`
- `sha256`
- `sort_order`
- `extraction_status`: `pending`, `processing`, `ready` ou `error`
- `extraction_error` opcional
- `image_description`/OCR opcional
- `created_at`
- `updated_at`

O arquivo original ficará em `/uploads/procedures/` com nome gerado pelo
sistema. O nome fornecido pelo usuário será preservado apenas como metadado de
exibição.

### `general_procedure_attachment_chunk`

Para documentos maiores, o texto extraído será dividido em trechos:

- `id`
- `attachment_id`
- `chunk_index`
- `content`
- `page_number` opcional
- `slide_number` opcional
- `token_count`
- campos de embedding compatíveis com as tabelas RAG existentes
- `created_at`
- `updated_at`

O texto do procedimento também terá representação indexável. A tabela de
chunks evita carregar um PDF ou apresentação inteira no contexto da IA.

## Upload, segurança e ciclo de vida

- Validar extensão, MIME real e assinatura do arquivo antes de persistir.
- Gerar nome seguro e não usar o nome original como caminho físico.
- Aplicar limite configurável de tamanho por anexo.
- Permitir apenas imagens suportadas pelo pipeline visual e documentos com
  extrator registrado.
- Servir o arquivo por rota protegida, respeitando `procedures:view`.
- Ao excluir um anexo, remover o registro, os chunks, o embedding e o arquivo
  físico.
- Ao excluir um procedimento, excluir seus anexos e arquivos associados após
  confirmar a operação.
- Um erro de extração deve permanecer visível na página e não tornar o arquivo
  falsamente pesquisável.
- O volume de uploads deve fazer parte da rotina de backup, pois o banco não
  contém os binários.

## Extração e interpretação de imagens

O modelo textual padrão atual não interpreta pixels diretamente. Por isso o
fluxo de imagem será preparado em duas camadas:

1. validar e armazenar a imagem;
2. produzir OCR e/ou descrição textual, armazenando o resultado derivado e
   indexando-o junto ao procedimento.

Quando um modelo multimodal estiver configurado, o runtime poderá receber a
imagem original dos anexos recuperados, além da descrição indexada. Sem esse
runtime, a IA continua podendo consultar a descrição/OCR e a imagem permanece
disponível para visualização humana.

## Prioridade na consulta da IA

O manual do produto continua sendo a referência preferencial quando a pergunta
é específica de um produto. Para orientação operacional e resolução de
problemas gerais, a ordem de relevância será:

1. trechos de anexos de procedimentos relevantes;
2. texto do procedimento relevante;
3. problemas, soluções e intervenções registradas, promovidos quando houver
   correspondência específica com o caso;
4. demais fontes auxiliares.

Essa ordem será implementada por busca semântica com pesos por fonte, sem
descartar uma fonte específica somente por ser histórica. O manual relevante
receberá o peso preferencial definido na especificação anterior; uma solução
registrada muito específica poderá superar um procedimento genérico quando a
pergunta indicar claramente aquele incidente.

Cada resultado deverá preservar:

- tipo da fonte;
- título do procedimento;
- nome do anexo, quando aplicável;
- página/slide, quando disponível;
- trecho utilizado;
- score original e score após o peso de prioridade.

## Permissões e interface

- `procedures:view`: listar, abrir e consultar procedimentos e anexos.
- `procedures:manage`: cadastrar, editar, anexar, reprocessar e excluir.
- Administradores mantêm o bypass de permissões já existente.
- A página terá busca, filtro por status/categoria, listagem e formulário de
  edição.
- O formulário exibirá o estado de processamento de cada anexo e permitirá
  remover anexos individualmente.
- Procedimentos inativos não serão retornados pela IA.

## Critérios de aceite

1. Um usuário autorizado consegue cadastrar um procedimento em Markdown.
2. O usuário consegue anexar imagem, PDF, TXT/MD, DOCX e PPTX, visualizando o
   estado do processamento.
3. O arquivo físico não é gravado no banco e continua acessível pela rota
   protegida.
4. O texto do procedimento e os anexos processados aparecem na busca semântica.
5. Para uma pergunta de resolução de problema, um trecho relevante de anexo é
   priorizado sobre o texto genérico do procedimento.
6. A resposta da IA cita o procedimento e o arquivo/página ou slide quando
   houver essa informação.
7. Arquivo incompatível ou com extração falha aparece como erro e não entra na
   busca.
8. Excluir procedimento ou anexo remove também o arquivo físico e os dados de
   indexação associados.
9. Usuários sem `procedures:view` não veem a página nem conseguem consultar os
   anexos pela API.
