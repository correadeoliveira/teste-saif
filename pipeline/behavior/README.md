# `pipeline/behavior/` — IMU → features → Logistic Regression

Pacote **irmão** de `saifen_pipeline` (KDE de crimes). Não misture os dois.
`npm run train` na raiz do monorepo continua sendo o heatmap KDE.

```bash
cd pipeline/behavior
make setup              # pip install -e ".[test]"  (sklearn só aqui)
make generate-demo      # sessões sintéticas genuine/impostor
make collect            # copia data/behavior/incoming → data/behavior/raw
make preprocess         # window 2s, overlap 50%, features
make train              # StandardScaler + LogisticRegression (split por sessão)
make evaluate           # accuracy/F1/AUC/FAR/FRR
make export-model       # shared/behavior/model.json + bundle mobile + fixture de paridade
```

Split é **por `session_id`**: janelas da mesma sessão nunca aparecem em train e test.

Contrato do modelo: `shared/behavior/model.json` (consumido por `mobile/src/services/inference.ts`).
