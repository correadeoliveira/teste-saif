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
make evaluate           # métricas por sessão: accuracy/F1/AUC/FAR/FRR
make export-model       # shared/behavior/model.json + bundle mobile + fixture de paridade
```

O modo padrão usa sessões sintéticas rotuladas e agrupa janelas pela sessão
de cada participante. O limiar é calibrado na mediana dos scores das
sessões de validação. FAR é a fração de sessões impostoras aceitas e FRR
é a fração de sessões genuínas rejeitadas.

`export-model` valida o modelo, gera uma fixture sintética determinística
e grava o mesmo artefato em `shared/behavior/model.json` e no bundle Expo.
As métricas versionadas medem uma demonstração sintética.

Para uma base real autorizada, use `train --by-subject` e
`evaluate --by-subject` pela CLI. Cada participante aparece em um só grupo.
O modo real exclui simulações, exige ambas as classes em cada grupo e
grava modelo e métricas em `data/behavior/processed/`. O bundle do app
usa o fluxo demonstrativo.
