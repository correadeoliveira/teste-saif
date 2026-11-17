---
version: alpha
name: SAIFEN
description: Interface de terminal CRT para explorar o mapa e ler sinais de risco urbano.
colors:
  react-phosphor: "#ffcb00"
  react-secondary: "#d9a600"
  react-dim: "#8a6d00"
  react-line: "#3d3000"
  react-background: "#0a0800"
  react-panel: "#0f0c00"
  react-warning: "#ff7a1a"
  react-danger: "#ff2200"
  web-background: "#020805"
  web-panel: "rgba(4, 14, 8, 0.92)"
  web-text: "#c8d8c0"
  green-phosphor: "#00FF9F"
  green-bright: "#39FF14"
  mobile-background: "#000000"
  mobile-text: "#E6FFE6"
  mobile-warning: "#FFD93D"
  mobile-risk-high: "#FF8C42"
  mobile-danger: "#FF5454"
typography:
  react-control:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "9px"
    letterSpacing: "0.1em"
  web-body:
    fontFamily: "Share Tech Mono, Courier New, monospace"
    fontSize: "13px"
    lineHeight: 1.5
  web-display:
    fontFamily: "VT323, Share Tech Mono, monospace"
  mobile-body:
    fontFamily: "monospace"
    fontSize: "13px"
    lineHeight: "20px"
  mobile-title:
    fontFamily: "monospace"
    fontSize: "16px"
    letterSpacing: "2px"
rounded:
  react-tab: "2px"
  web-drawer-top: "12px"
spacing:
  react-legend-inset: "8px"
  mobile-hud-padding: "12px"
  mobile-screen-padding: "16px"
components:
  react-active-tab:
    textColor: "{colors.react-phosphor}"
    rounded: "{rounded.react-tab}"
  mobile-crt-button:
    textColor: "{colors.green-phosphor}"
    padding: "12px 14px"
  mobile-crt-button-danger:
    textColor: "{colors.mobile-danger}"
    padding: "12px 14px"
---

# Design System — SAIFEN

## Overview

O padrão existente é o terminal CRT. O mapa ocupa o espaço principal. Navegação, filtros e leituras ficam nas bordas, com ícones pequenos, texto monoespaçado, contornos finos e brilho concentrado nos estados ativos. O React usa fósforo âmbar. O HTML/JS e o app Expo usam fósforo verde, cada um com sua própria composição.

Esta referência parte da interface em `44d58eb`, revisão anterior ao trabalho desta sessão. Os arquivos de implementação indicados abaixo são a referência para os valores e estados de cada cliente.

## Colors

- **React.** O âmbar luminoso marca seleção e leitura principal. Os tons âmbar mais escuros sustentam legendas, divisórias e controles inativos sobre os fundos quase pretos. Laranja e vermelho assinalam risco. Azul identifica certas camadas, como a de transporte. [Paleta e componentes](src/app/App.tsx) · [Tema CSS](src/styles/theme.css)
- **HTML/JS.** O verde fosforescente identifica comandos, estados ativos e o HUD. Fundos verde-pretos, linhas verdes translúcidas e texto cinza-esverdeado dão contraste. Vermelho e âmbar recebem alertas e avisos. [Variáveis CRT](web/style.css)
- **Expo.** Preto, verde fosforescente e texto verde-claro compõem o HUD e as telas de sensores. A escala de zona usa verde vivo, amarelo, laranja e vermelho para baixo, médio, alto e crítico. O botão **PÂNICO** usa vermelho. [Paleta nativa](mobile/src/theme/colors.ts) · [Botão de pânico](mobile/src/components/PanicButton.tsx)
- **Heatmap React.** A rampa passa de âmbar para laranja e vermelho. Os limites entre faixas vêm dos quantis p70, p90 e p97 da fatia carregada. A legenda e a textura usam a mesma escala. [Escala de risco](src/map/riskScale.js)

## Typography

- **React.** JetBrains Mono sustenta a interface e o questionário. Os controles do mapa usam rótulos curtos, em caixa alta, com espaçamento aberto entre letras. A legenda compacta usa 8–9 px para cortes, amostra e faixa. Inter também está disponível no CSS de fontes. [Fontes](src/styles/fonts.css) · [Legenda e controles](src/app/App.tsx) · [Questionário](src/app/components/Questionnaire.tsx)
- **HTML/JS.** Share Tech Mono é a base dos painéis e status. VT323 aparece no logotipo do boot e em chamadas de leitura. [Tipografia CRT](web/style.css)
- **Expo.** Usa a família monoespaçada da plataforma. Títulos de tela têm tamanho 16 e espaçamento 2. Texto corrido usa tamanho 13 e entrelinha 20. Os rótulos das abas usam tamanho 10 e espaçamento 1. Esses valores são unidades do React Native. [Componentes CRT](mobile/src/components/Crt.tsx) · [Abas nativas](mobile/src/navigation/RootNavigator.tsx)

## Layout

- **React.** A interface ocupa a altura disponível num quadro central de até 430 px. O mapa ocupa o restante do quadro. A legenda fica no canto superior esquerdo quando **HEAT** está ativo e há escala. A barra `HEAT / SAFE / LUZ / BUS` fica a 16% da base e a navegação `MAPA / PONTOS / STATS` a 8%. A navegação fica transparente sobre o mapa e opaca sobre listas, que medem a área ocupada pela barra para preservar o último conteúdo. [Composição React](src/app/App.tsx)
- **HTML/JS.** A composição de tela cheia usa HUD superior, barra inferior e painel lateral de 340 px. A 900 px, o painel passa a 300 px. A 768 px, vira gaveta inferior de largura integral, acionada pelo controle móvel e limitada a 60 vh. A 480 px, o boot e a marca ficam mais compactos. [Layout e breakpoints](web/style.css)
- **Expo.** O mapa preenche a tela. No iOS, a tela mostra o mapa-base do Apple Maps e o HUD. No Android, ela também exibe a camada de calor nativa do Google Maps. O quadro de estado respeita a área segura superior. **PÂNICO** fica no canto inferior direito, acima das abas `MAPA / SENSORES`. As telas de sensores usam a mesma família de painéis e botões. [Mapa nativo](mobile/src/screens/MapScreen.tsx) · [Navegação](mobile/src/navigation/RootNavigator.tsx)

## Elevation & Depth

- **React.** As scanlines têm baixa opacidade e deixam passar os gestos no mapa. Os colchetes enquadram o mapa e o brilho do CRT realça seleção. A barra de camadas e a legenda têm fundos escuros translúcidos com desfoque localizado. O filtro escuro atua nos tiles do mapa-base. O calor mantém sua própria cor e transparência sobre as ruas. [Camadas do mapa](src/styles/index.css) · [HUD e painéis](src/app/App.tsx) · [Renderização WebGL](src/map/CrimeMap.js)
- **HTML/JS.** Scanlines, vinheta, grade discreta e brilho de fósforo se sobrepõem ao mapa. O boot usa linhas sequenciais. Pulso e piscada assinalam conexão, alertas e cursor. [Efeitos e keyframes](web/style.css)
- **Expo.** A profundidade vem do HUD preto translúcido sobre o mapa e do contorno verde fino. A reação ao toque no botão CRT é um preenchimento verde leve. [HUD e interação](mobile/src/components/Crt.tsx) · [Mapa](mobile/src/screens/MapScreen.tsx)

## Shapes

- Chips, barras e painéis CRT usam geometria retangular e bordas finas. As abas React têm raio de 2 px e o mapa é enquadrado por colchetes em L. [Componentes React](src/app/App.tsx)
- O HTML/JS usa raio de 12 px nos cantos superiores da gaveta móvel. Marcadores e indicadores usam formas próprias para distingui-los dos controles. [Estilos HTML/JS](web/style.css)

## Components

- **Barra de camadas React.** Ícone sobre rótulo. Ativação combina âmbar mais forte, preenchimento sutil, brilho e traço inferior. Cada camada mantém sua posição no grupo. [QuickBar](src/app/App.tsx)
- **Filtros React.** Chips de contorno usam losango vazado no estado inativo e cheio no ativo. Em conjunto com cor e preenchimento, o glifo torna a seleção reconhecível. [Chip](src/app/App.tsx)
- **Legenda React.** Cabeçalho recolhível, identificação da fatia, rampa proporcional, quatro faixas com limites numéricos, contagem e mediana. [RiskLegend](src/app/App.tsx)
- **Questionário React.** Uma tela rolável agrupa o conteúdo em seções expansíveis. Opções selecionadas usam borda e fundo âmbar. Ações de pular e avançar pertencem ao rodapé do fluxo. [Questionário](src/app/components/Questionnaire.tsx)
- **HUD e gaveta HTML/JS.** O HUD reúne marca e estado do sistema. A gaveta organiza camadas e filtros. Contadores, contexto e alertas têm áreas próprias. [Estrutura](web/index.html) · [Estilo CRT](web/style.css)
- **Botão e HUD Expo.** `CrtButton` define os estados normal, pressionado, desabilitado e de ação crítica. `Hud` reúne título e linhas de status dentro de uma moldura fina. O botão **PÂNICO** mantém sua posição e cor próprias. [CrtButton e Hud](mobile/src/components/Crt.tsx) · [Pânico](mobile/src/components/PanicButton.tsx)

## Do's and Don'ts

- Preserve a paleta e a tipografia do cliente em que a mudança será feita. Reuse seus controles, painéis e navegação.
- Mantenha ruas, marcadores e legenda legíveis com o calor ligado. Use a escala da fatia para relacionar cor e intensidade.
- Use os espaços de status existentes para mudanças de dados. Reserve uma nova sobreposição para uma mudança visual aprovada.
- Verifique mudanças de interface no mapa com e sem calor, nos painéis de lista e no questionário. No React, inclua uma tela estreita e a coluna de 430 px em desktop. No HTML/JS, confira os dois lados do breakpoint de 768 px. No Expo, veja o mapa e a aba de sensores com as áreas seguras da plataforma.
