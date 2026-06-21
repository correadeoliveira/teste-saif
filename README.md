# ShadowPath (Vigilante Urbano)

Protótipo de aplicativo mobile/web com estética cyberpunk forte, inspirado em Watch Dogs, Cowboy Bebop e sci-fi noir. O objetivo do sistema é fornecer uma interface de navegação tática urbana voltada para segurança em grandes cidades brasileiras (focado em São Paulo).

---

## 🚀 Como Executar

1. Baixe os arquivos do repositório.
2. Abra o arquivo `index.html` diretamente em seu navegador (ou utilize uma extensão como Live Server no VS Code).

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 & CSS3 (Vanilla)**: Estrutura semântica e folha de estilos contendo variáveis para design system, animações customizadas e filtros de tela CRT.
- **JavaScript (ES6)**: Lógica de inicialização de UI, manipulação de estados e controle do mapa.
- **Leaflet.js & Leaflet.heat**: Biblioteca open-source para mapas interativos e geração de heatmap (mapa de calor) dinâmico de criminalidade.

---

## 🌟 Funcionalidades Implementadas

1. **HUD e Estética Cyberpunk**:
   - Efeitos visuais de Scanlines CRT, vinheta, textos com efeito glitch e brilhos neon.
   - Design responsivo adaptado para dispositivos móveis com painel deslizante.
2. **Mapa Tático Interativo (São Paulo)**:
   - Fundo escuro estilizado e heatmap dinâmico com níveis de periculosidade customizados (Cracolândia, Sé, República, etc.).
   - 30+ marcadores personalizados para estações de metrô, pontos de ônibus, câmeras de segurança, postos policiais e comércios 24h (pontos de escape).
3. **Indicador de Ameaça Dinâmico**:
   - Calcula a proximidade a zonas de risco em tempo real conforme o usuário navega pelo mapa, alterando o nível no HUD superior (BAIXO, MÉDIO, ALTO, CRÍTICO).
4. **Modos e Ações do Operador**:
   - **Scan Rápido**: Animação de radar que analisa e quantifica ameaças no perímetro.
   - **Modo Fantasma (Stealth)**: Altera a tonalidade visual do aplicativo e o status do operador para reduzir rastreamento.
   - **Alertar Amigos**: Dispara um SOS visual e simula o envio de localização para contatos de emergência.
   - **Rotas Seguras**: Destaca caminhos alternativos mais iluminados e policiados no mapa usando polilinhas neon pulsantes.
5. **Feed de Alertas e Contexto**:
   - Log lateral atualizado dinamicamente com novos alertas simulados da cidade.
   - Análise contextual gerada por "Inteligência Artificial" com efeito de digitação.

---

## 🧠 Aprendizados do Projeto

Durante a criação do ShadowPath, foram explorados e consolidados diversos conceitos de desenvolvimento frontend moderno:

- **Customização Avançada de Mapas**: Como utilizar e estilizar o Leaflet de forma a fugir do padrão geográfico comum, transformando mapas reais em interfaces de jogos (HUD).
- **Tratamento de Mapas de Calor (Heatmaps)**: Implementação prática de arrays de dados geográficos com pesos de intensidade para renderização de gradientes táticos.
- **CSS Avançado e Efeitos Visuais**:
  - Uso de gradientes repetidos e animações de posição para criar scanlines dinâmicos.
  - Implementação de filtros (brightness, saturate, hue-rotate) manipulados via JS para criar transições suaves de modos como o "Modo Fantasma".
  - Manipulação de variáveis CSS (`--variables`) para alterar dinamicamente o tema visual do sistema em tempo real.
- **Animações de Performance**: Uso de keyframes CSS eficientes para efeitos de radar/scan e transições de painéis deslizantes responsivos (com uso de `transform: translate` em vez de alterar dimensões de largura).
- **Tipografia e Imersão**: Utilização combinada de fontes monoespaçadas e de exibição (`Share Tech Mono`, `Orbitron`, `JetBrains Mono`) com técnicas de simulação de terminal para criar uma narrativa de interface interativa (Onboarding/Boot sequence).
