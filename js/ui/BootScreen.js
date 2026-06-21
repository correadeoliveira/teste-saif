export class BootScreen {
    constructor(onComplete) {
        this.onComplete = onComplete;
        this.bootComplete = false;
        this.terminal = document.getElementById('boot-terminal');
        this.progressBar = document.getElementById('boot-progress');
        this.bootScreen = document.getElementById('boot-screen');
        this.app = document.getElementById('app');
        
        this.bootLines = [
            { text: '[SYS] Inicializando ShadowPath Core Engine...', cls: 'info' },
            { text: '[OK]  Kernel de segurança carregado', cls: 'ok' },
            { text: '[OK]  Módulo de geolocalização ativado', cls: 'ok' },
            { text: '[SYS] Conectando à rede de vigilância urbana...', cls: 'info' },
            { text: '[OK]  142 pontos de monitoramento detectados', cls: 'ok' },
            { text: '[OK]  Heatmap de criminalidade compilado', cls: 'ok' },
            { text: '[WARN] Região atual: CENTRO SP — Nível de ameaça: MÉDIO', cls: 'warn' },
            { text: '[SYS] Carregando camada de mapa escuro...', cls: 'info' },
            { text: '[OK]  Tile server DARK_MATTER conectado', cls: 'ok' },
            { text: '[OK]  Rotas seguras calculadas (3 disponíveis)', cls: 'ok' },
            { text: '[SYS] Inicializando interface HUD...', cls: 'info' },
            { text: '[OK]  Painel de controle online', cls: 'ok' },
            { text: '[OK]  Feed de alertas sincronizado', cls: 'ok' },
            { text: '[WARN] 2 zonas de risco CRÍTICO detectadas no perímetro', cls: 'warn' },
            { text: '[OK]  Sistema de scan ativado', cls: 'ok' },
            { text: '[SYS] Verificação de integridade... OK', cls: 'info' },
            { text: '[OK]  ████████████████ SISTEMA PRONTO ████████████████', cls: 'ok' },
            { text: '', cls: 'ok' },
            { text: '> Operador autenticado. Bem-vindo, Protagonista.', cls: 'info' },
            { text: '> Iniciando mapa tático...', cls: 'info' },
        ];
    }

    run() {
        let i = 0;
        const totalLines = this.bootLines.length;

        const skipBoot = () => {
            if (this.bootComplete) return;
            this.bootComplete = true;
            this.bootScreen.classList.add('fade-out');
            this.app.classList.remove('hidden');
            setTimeout(() => { this.bootScreen.style.display = 'none'; }, 600);
            if (this.onComplete) this.onComplete();
        };

        document.addEventListener('keydown', skipBoot, { once: false });
        document.addEventListener('click', (e) => {
            if (this.bootScreen.contains(e.target)) {
                skipBoot();
            }
        }, { once: true });

        const addLine = () => {
            if (this.bootComplete) return;
            if (i >= totalLines) {
                setTimeout(skipBoot, 600);
                return;
            }

            const line = this.bootLines[i];
            const div = document.createElement('div');
            div.className = `line ${line.cls}`;
            div.textContent = line.text;
            this.terminal.appendChild(div);
            this.terminal.scrollTop = this.terminal.scrollHeight;

            this.progressBar.style.width = `${((i + 1) / totalLines) * 100}%`;
            i++;

            const delay = line.text === '' ? 100 : (60 + Math.random() * 100);
            setTimeout(addLine, delay);
        };

        setTimeout(addLine, 400);
    }
}