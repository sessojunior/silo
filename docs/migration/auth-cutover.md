# Comunicação de cutover de autenticação — Fase 5

Data de criação: 2026-07-22

## Decisão operacional

Na troca da autenticação Better Auth/Node para FastAPI/Python:

- sessões ativas podem ser reiniciadas;
- códigos OTP pendentes podem ser invalidados;
- o novo cookie de sessão emitido pela API Python é `silo_session`;
- durante a janela de rollback, o proxy do frontend aceita `silo_session` e cookies Better Auth;
- registros existentes nas tabelas `user`, `account` e `session` são preservados.

## Mensagem para usuários

Durante a janela de migração do SILO, alguns usuários poderão precisar entrar novamente no sistema. Códigos de verificação por e-mail emitidos antes da troca podem deixar de funcionar; nesse caso, solicite um novo código pela tela de login ou recuperação de senha.

## Rollback

Se o tráfego voltar para a API Node, usuários que ainda possuem cookie Better Auth continuam autenticados. Usuários autenticados apenas com `silo_session` precisarão fazer login novamente. Nenhuma sessão legada deve ser apagada antes do fim da janela de rollback.

## Controles compensatórios

- `GET /api/auth/get-session` aceita cookies Better Auth e `silo_session` enquanto houver coexistência.
- `POST /api/auth/sign-out` expira `silo_session` e os cookies Better Auth conhecidos.
- Endpoints mutáveis com cookie de sessão são protegidos contra `Origin`/`Referer` não confiáveis.
- OTPs Python são gravados em `verification` com identificadores `silo:*`, evitando alteração de schema e colisão com rollback.
