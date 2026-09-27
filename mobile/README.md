# `mobile/` — App Expo (React Native)

> Cliente mobile do SAIFEN. Reaproveita todos os artefatos KDE de
> `shared/heatmaps/` e usa Supabase para reportar BOs em tempo real
> a partir do GPS do dispositivo.
>
> **Status:** Expo SDK 52 (managed). Typecheck passa; binário nativo
> ainda não é gerado (Expo Go no MVP). Heatmap no iOS com
> `PROVIDER_DEFAULT` pode não renderizar o overlay (limitação do
> `react-native-maps`).

## Node

Use **Node 20** (mesma versão do CI). Há `.nvmrc` na raiz e em `mobile/`.

```bash
nvm use        # ou: nvm use 20
node -v        # esperado: v20.x
```

SDK 52 não é testado contra Node 26+. Evite a versão atual do host se
não for 18/20.

## Setup

```bash
cd mobile/
nvm use 20
npm install                            # lockfile: package-lock.json
npx expo install                       # garante versões SDK-compatíveis
```

## Rodar em desenvolvimento

```bash
npm start                              # abre Expo Dev Tools (QR → Expo Go no iPhone)
npm run ios                            # simulator iOS
npm run android                        # emulator Android
npm run web                            # versão web (opcional, com react-native-web)
```

## Expo doctor

Assets, navigation peers e `expo-sensors` estão alinhados ao SDK 52.
Dois avisos pré-existentes permanecem de propósito (não mexer sem necessidade):

- `react-native@0.76.0` (SDK sugere 0.76.9)
- `@react-native-async-storage/async-storage@2.1.0` (SDK sugere 1.23.1)

Use Node 20. `npm run test:parity` compara features/score com o fixture Python.

## Estrutura

```
mobile/
├── package.json
├── app.json
├── App.tsx                    # SafeAreaProvider + RootNavigator
├── assets/                    # ícones, splash, behavior/model.json
└── src/
    ├── theme/colors.ts
    ├── navigation/RootNavigator.tsx
    ├── services/              # location, heatmap, supabase, sensors, recorder, inference
    ├── hooks/useSensorStream.ts
    ├── screens/               # Home, Map, SensorTest, Enrollment, Collecting, ...
    └── components/Crt.tsx
```

## Cadeia de fallbacks (igual ao web)

```
1. Supabase RPC (get_heatmap_grid, nearby_crimes)
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

## Próximos passos (não implementados ainda)

- [ ] Reportar BO via `POST /crimes` quando usuário pressiona botão de pânico.
- [ ] Background location + push notifications quando entra em zona crítica.
- [ ] Build com EAS (`eas build --profile preview`).
- [x] Sensores IMU (acel+giro) + JSONL local + enrollment/verification baseline.
