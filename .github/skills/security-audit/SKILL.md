---
name: security-audit
description: "Use when: cybersegurança, verificação de vulnerabilidades, revisão de autenticação, uploads, sessões, permissões, rate limit, CORS, CSRF, segredos ou qualquer mudança com impacto em segurança."
---

# Security Audit

Use esta skill quando a mudança tocar superfícies sensíveis.

## Checklist rápido
- Verifique autenticação e autorização.
- Evite confiar em headers, cookies ou caminhos fornecidos pelo cliente.
- Revise uploads, downloads, proxying, path traversal e exposição de arquivos.
- Revise rate limiting, sessões e cross-origin.
- Não registre segredos, tokens ou dados sensíveis.
- Faça a menor mudança segura e valide o slice alterado.
