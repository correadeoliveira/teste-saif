# Playbook de qualidade

Rode os checks na raiz do monorepo, salvo quando indicado. As suites Python
usam fixtures e validam os JSON versionados em `shared/`.

## Web

Use Node 22. O CI valida os clientes React/Vite e HTML/JS.

```bash
npm ci
node tools/check-web-imports.mjs
npm test
npm run build
python -m pip install playwright==1.60.0
python -m playwright install chromium
python web/test/smoke.py
```

O teste em Chromium roda o preview Vite e o servidor do HTML/JS com respostas
de rede simuladas. O [guia do Playwright](https://playwright.dev/python/docs/browsers)
mostra como instalar dependências do navegador no Linux.

## Mobile

Em `mobile/`, com Node 22.13 ou superior:

```bash
npm ci
npm run typecheck
npm test
npm run test:parity
npm run lint
```

A paridade compara a fixture sintética Python com as features e o score
no TypeScript e verifica que o pacote Expo usa o modelo de `shared/`.

## Pipelines

```bash
cd pipeline
pip install -e ".[test]" ruff
ruff check .
ruff format --check .
pytest -q --cov=saifen_pipeline --cov-fail-under=70
```

O teste de publicação roda o CLI com uma planilha pequena e valida
repetição, reparo de arquivo ausente, remoção de fatias obsoletas e
recuperação após falha. Rode os checks de IMU em `pipeline/behavior/`:

```bash
pip install -e ".[test]" ruff
ruff check --select E,F .
pytest -q
```

O runner IMU também regenera uma demonstração e publica métricas por sessão
no resumo do GitHub Actions.

## Supabase

```bash
python3 supabase/tests/check_sql.py
```

O [CI SQL](../../.github/workflows/supabase-ci.yml) também executa as
migrations, os checks de RPC e a verificação do limite por dispositivo com
chamadas concorrentes em PostGIS temporário. As migrations de staging e
produção rodam pelo workflow manual do repositório.

## Publicação e diagnóstico

O [playbook de heatmap](heatmap-pipeline.md) descreve critérios de
publicação, reprocessamento e recuperação. Os pipelines emitem eventos
JSON com ID de execução, etapa, resultado e duração. Os clientes registram
operações, fontes de dados e contagens agregadas no console local.
