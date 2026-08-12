# Monitoramento e Logs

---

## Monitoramento

A página `/admin/monitoring` consolida três tipos de acompanhamento:

### Produtos e Fluxo de Dados

- Status por produto e turno (ok, delayed, offline, undefined)
- Derivado do fluxo de dados via Kafka REST Proxy
- Exibido como gráfico PERT (`gantt-task-react`) com tasks por pipeline
- Fallback para dados mock quando o SMNA está indisponível

### Páginas e Figuras

- Disponibilidade e atraso de páginas/figuras cadastradas
- Status por link: ok, delayed, offline
- Tabela com busca textual e filtros

### Radares

- Agrupamentos de radares com status operacional
- Blocos coloridos por estado (verde, amarelo, vermelho, cinza)
- Links de diagnóstico e webhook URL
- CRUD de grupos e radares via offcanvas

### API

Endpoints disponíveis em `/api/admin/monitoring/*`:

| Endpoint | Descrição |
|---|---|
| `/monitoring/picture-pages` | Lista de páginas monitoradas |
| `/monitoring/radar-groups` | Grupos de radares |
| `/monitoring/radars` | Radares individuais |

---

## Sistema de Logs

### Níveis

| Nível | Uso |
|---|---|
| `DEBUG` | Detalhes de desenvolvimento |
| `INFO` | Operações normais (padrão) |
| `WARNING` | Condições anômalas recuperáveis |
| `ERROR` | Falhas que precisam de atenção |
| `CRITICAL` | Falhas que impedem operação |

Configurado via `LOG_LEVEL` no `.env`.

### Emojis padronizados

| Categoria | Emoji | Exemplo |
|---|---|---|
| Autenticação | 🔐 | `🔐 Login successful for user@email` |
| IA / Assistente | 🤖 | `🤖 Agent response generated in 234ms` |
| Banco de dados | 🗄️ | `🗄️ Migration 0005 applied` |
| API / HTTP | 🌐 | `🌐 GET /api/admin/projects → 200` |
| Worker / Kafka | 📨 | `📨 Processing message offset 42` |
| Erro | ❌ | `❌ Failed to connect to vLLM` |
| Sucesso | ✅ | `✅ PDF report generated` |

### Regras

- **Manter:** Logs de inicialização, migrações, erros, operações de escrita
- **Remover:** Logs de heartbeat, polling repetitivo, dados sensíveis (senhas, tokens)
- Logs devem incluir contexto suficiente para debug sem expor segredos
- Usar `LOG_LEVEL=DEBUG` apenas em desenvolvimento local
