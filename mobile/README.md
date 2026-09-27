# `mobile/` — App Expo (React Native)

> Cliente mobile do SAIFEN. Reaproveita todos os artefatos KDE de
> `shared/heatmaps/` e usa Supabase para reportar BOs em tempo real
> a partir do GPS do dispositivo.
>
> **Status:** Expo SDK 57 (managed). Typecheck passa. Pânico e alerta de
> zona crítica já estão no app. Background location exige build EAS
> (`eas.json` perfil `preview`) — no Expo Go o GPS fica só em foreground.

## Node

SDK 57 exige **Node ≥ 22.13**. Há `.nvmrc` na raiz e em `mobile/` (`22`).

```bash
nvm use        # ou: nvm use 22
node -v        # esperado: v22.13+ (ex.: v22.23.x)
```

## Setup

```bash
cd mobile/
nvm use 22
npm install                            # lockfile: package-lock.json
npx expo install                       # garante versões SDK-compatíveis
```

## Rodar em desenvolvimento (iPhone físico)

O projeto é **Expo Go**. Não existe app nativo instalado no iPhone neste
MVP. A URL `exp://…` **não é um site**: Safari / Chrome não abrem o SAIFEN.

### 1. Mac

```bash
cd mobile
nvm use 22
npx expo start
```

O terminal mostra um QR code e uma URL no formato:

```
exp://192.168.x.x:8081
```

iPhone e Mac precisam estar no **mesmo Wi-Fi**.

Se a LAN falhar (mesmo Wi-Fi, mas o celular não alcança o Mac):

```bash
npx expo start --tunnel
```

### 2. iPhone — abrir no Expo Go (não no navegador)

1. Instale **Expo Go** na App Store (SDK do app e do projeto precisam
   bater; hoje: **SDK 57**).
2. **Não cole** `exp://…` no Safari.
3. Abra o projeto de um destes jeitos:
   - **Câmera do iOS:** aponte para o QR do terminal → toque na
     notificação / banner **Abrir no Expo Go**.
   - **Dentro do Expo Go:** ícone de scan (QR) → aponte para o QR.
   - **Expo Go → Enter URL manually:** cole `exp://192.168.x.x:8081`
     (ainda no Expo Go, não no navegador).

Se o iPhone disser *Project is incompatible with this version of Expo Go*,
o SDK do projeto e o do Expo Go estão diferentes. Este repo está em SDK 57.

### 3. Fluxo no app (depois que abrir)

O app abre na aba **MAPA**. IMU e perfil ficam na aba **SENSORES**.

| Aba / tela | Para quê |
|------------|----------|
| **MAPA** | Home: heatmap KDE, HUD de zona, botão **PÂNICO**. |
| **SENSORES** | Hub do IMU (enrollment, verification, debug). |
| **TEST SENSORS** | Smoke test: 10s de accel+gyro → JSONL local. |
| **ENROLLMENT** | 3 sessões genuine de 10s (padrão da sua mão). |
| **VERIFICATION** | 10s → `model.json` bundled → ACCEPT/REJECT. |
| **DEBUG** | IMU ao vivo + replay sintético no modelo. |

**TEST SENSORS**

- **START 10s** — sensores reais do iPhone (~50 Hz).
- **SIMULAR 10s** — IMU sintético, sem mexer o aparelho.
- Sucesso típico: `saved ~500 samples @ ~50 Hz` e um path
  `…/Documents/…/behavior/local-user/<session>.jsonl`.
- **EXPORT JSONL / EXPORT META** — share sheet do iOS para mandar o
  arquivo ao Mac (AirDrop, Arquivos, etc.). Opcional no smoke test.

O Test Sensors **não** conta para o cupom de enrollment. Quando o IMU
estiver ok, volte para a aba **SENSORES**.

**Mapa — pânico e zona crítica**

- **PÂNICO** (canto inferior direito) → confirma tipo (outros/furto/roubo)
  → `POST /rest/v1/rpc/report_crime`. Sem Supabase, o relato entra numa
  fila local e sobe no próximo sync.
- O HUD mostra **Zona: BAIXO/MÉDIO/ALTO/CRÍTICO**. Ao entrar em zona
  crítica o app dispara uma notificação local.
- No **Expo Go** o GPS é só em foreground (`alertas foreground` no HUD).
  Background location precisa do build EAS (`alertas background`).

**Próximo passo de produto**

1. Aba **SENSORES** → **ENROLLMENT** → **COLETAR SESSÃO** (3×, telefone na mão).
2. Quando o perfil ficar `ready` → **VERIFICATION** → capturar 10s.
3. Tela **RESULT**: score + ACCEPT/REJECT (inferência local, offline).

O treino do Logistic Regression continua no Mac
(`make -C pipeline/behavior train && make -C pipeline/behavior export-model`).
O app infere com o `model.json` já bundled até você substituí-lo.

## Onde os dados ficam

| Dado | Onde |
|------|------|
| Amostras IMU (JSONL + `.meta.json`) | **Só no iPhone**: `Documents/…/behavior/<subject>/<session>.jsonl` |
| Cupom de enrollment (sessões, status) | **AsyncStorage** no aparelho, e **Supabase** `behavior_profiles` se o `.env` estiver preenchido |
| Heatmap KDE | `shared/heatmaps/` no repo; opcionalmente RPC Supabase |
| Relato de pânico | RPC `report_crime` → tabela `crimes` (`source_file = mobile-panic`). Fila local se offline |
| Modelo LR | `mobile/assets/behavior/model.json` (bundled). Treino no Mac. |

O IMU bruto **não** sobe para o banco (tamanho + privacidade). Sobe só o
perfil: `device_id`, `subject_id`, `genuine_sessions`, `status`.

Na tela **ENROLLMENT** → **SYNC SUPABASE**. Sem `EXPO_PUBLIC_SUPABASE_*`
o HUD mostra `supabase: local-only` e o app segue offline.

Aplique as migrations `20260621000005_create_behavior_profiles.sql` e
`20260621000006_report_crime_and_zone_risk.sql` no projeto (SQL Editor ou
`supabase db push`) **antes** do primeiro sync / pânico.

## Qualidade

```bash
cd mobile
nvm use 22
npm run typecheck
npm test                 # zone, fila de pânico, enrollment (Node, sem Expo)
npm run test:parity      # features/score vs fixture Python
npm run lint
```

`npm run test:zone` roda só `zone.test.ts`. Playbook: [docs/agents/quality.md](../docs/agents/quality.md).

## Expo doctor

`npx expo-doctor` deve passar no SDK 57. `npm run test:parity` compara
features/score com o fixture Python.

## Estrutura

```
mobile/
├── package.json
├── app.json
├── eas.json                   # perfis EAS (development / preview / production)
├── eslint.config.js
├── test/                      # mocks CJS para `npm test`
├── App.tsx                    # SafeAreaProvider + zone monitor + RootNavigator
├── assets/                    # ícones, splash, behavior/model.json
└── src/
    ├── theme/colors.ts
    ├── navigation/            # tabs: Mapa (home) + Sensores (stack IMU)
    ├── services/              # location, heatmap, crimes, zone, supabase, sensors
    ├── tasks/locationTask.ts  # background GPS (EAS)
    ├── hooks/useSensorStream.ts
    ├── screens/               # Map, Sensors hub, SensorTest, Enrollment, Collecting, ...
    └── components/            # Crt, PanicButton
```

## Cadeia de fallbacks (igual ao web)

```
1. Supabase RPC (get_heatmap_grid, nearby_crimes, zone_risk, report_crime)
2. fetch( SHARED_HEATMAPS_URL )       ← em dev, server local
3. require('../../../shared/heatmaps/heatmap_points.json')  ← bundled
```

Em produção, o app só deve usar opção 1. Opções 2 e 3 são para
desenvolvimento sem backend ativo.

## Configuração (.env)

Crie `mobile/.env` (não commitar):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Em dev — URL de onde o app baixa os JSONs estáticos
EXPO_PUBLIC_SHARED_BASE=http://192.168.1.42:8000/shared
```

> Prefixe com `EXPO_PUBLIC_` para que sejam expostas ao bundle.

## Build EAS (preview)

Background location, serviço em foreground no Android e o heatmap nativo
não cabem no Expo Go. O perfil `preview` gera um binário interno.

```bash
cd mobile
nvm use 22
npm i -g eas-cli            # ou: npx eas-cli
eas login
# projeto já linkado: @correadeoliveira/saifen
eas build --profile preview --platform ios
# Android (APK):
eas build --profile preview --platform android
```

Apple Developer / Google Play credentials entram no fluxo do EAS na
primeira vez. Builds internos (`distribution: internal`) não vão para as
lojas.

No dispositivo, instale o artefato (TestFlight interno / link Expo) e
conceda **Localização sempre** + notificações.

## Próximos passos

- [x] Reportar BO via `POST /rest/v1/rpc/report_crime` no botão de pânico.
- [x] Background location + notificação local ao entrar em zona crítica (EAS).
- [x] Perfil EAS preview (`eas.json`). Rodar `eas init` + `eas build --profile preview`.
- [x] Sensores IMU (acel+gyro) + JSONL local + enrollment/verification baseline.
- [x] Cupom de profile (`behavior_profiles`) → Supabase quando configurado.
