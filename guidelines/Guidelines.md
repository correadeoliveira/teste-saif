**Add your own guidelines here**

Regras do monorepo SAIFEN: ver [AGENTS.md](../AGENTS.md) e [docs/agents/quality.md](../docs/agents/quality.md).

Resumo:

- Cwd = raiz do repositório, salvo quando o README do pacote pedir `cd`.
- O app **não treina**. KDE e Logistic Regression são CLI em `pipeline/`.
- Ano da fonte SSP = 2026. Preferir `SPDadosCriminais_2026.xlsx`.
- Não baixar SSP automaticamente. Não commitar sem pedido explícito.
- Commits: conventional (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`).
