# `mobile/` — App Expo (React Native)

> Cliente mobile do SAIFEN. Reaproveita todos os artefatos KDE de
> `shared/heatmaps/` e usa Supabase para reportar BOs em tempo real
> a partir do GPS do dispositivo.
>
> **Status:** stub. Arquivos esqueléticos prontos para `expo install`
> + `expo start`. Nenhum binário foi gerado.

## Setup

```bash
cd mobile/
npm install                            # ou: pnpm install / bun install
npx expo install                       # garante versões SDK-compatíveis
```

## Rodar em desenvolvimento

```bash
npm start                              # abre Expo Dev Tools
npm run ios                            # simulator iOS
npm run android                        # emulator Android
npm run web                            # versão web (opcional, com react-native-web)
```

## Estrutura

```
mobile/
├── package.json               # deps Expo + Supabase + Maps
├── app.json                   # Expo config (nome, ícone, splash, permissões)
├── tsconfig.json              # TypeScript strict
├── babel.config.js
├── App.tsx                    # entrypoint (root navigator)
├── assets/                    # ícones, splash
└── src/
    ├── theme/colors.ts        # paleta cyberpunk (idêntica ao web)
    ├── services/
    │   ├── supabase.ts        # cliente + fallback
    │   ├── heatmap.ts         # consome Supabase OU shared/heatmaps/ remoto
    │   └── location.ts        # GPS + permissões
    ├── screens/
    │   └── MapScreen.tsx      # mapa com heatmap + posição do usuário
    ├── components/            # botões, cards, overlays
    └── navigation/            # stack/tab navigators (futuro)
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
- [ ] `react-native-maps` com heatmap layer ou Mapbox SDK nativo.
- [ ] Background location + push notifications quando entra em zona crítica.
- [ ] Sensores do device (acelerômetro, microfone) para inferir incidentes.
- [ ] Build com EAS (`eas build --profile preview`).
