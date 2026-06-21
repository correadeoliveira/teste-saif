import { heatmapLoader } from '../data/HeatmapLoader.js';

export class BootScreen {
    constructor(onComplete) {
        this.onComplete = onComplete;
        this.bootComplete = false;
        this.terminal = document.getElementById('boot-terminal');
        this.progressBar = document.getElementById('boot-progress');
        this.bootScreen = document.getElementById('boot-screen');
        this.app = document.getElementById('app');

        // Pré-carrega summary.json em paralelo à animação de boot.
        // Não bloqueia nada — quando resolver, atualiza as linhas hardcoded.
        this._summaryPromise = heatmapLoader.loadSummary().catch(() => null);

        this.bootLines = [
            { text: '[SYS] Inicializando Saifen Core v1.0...', cls: 'info' },
            { text: '[OK]  Kernel de análise de risco carregado', cls: 'ok' },
            { text: '[OK]  Módulo de geolocalização ativo', cls: 'ok' },
            { text: '[SYS] Conectando ao banco SSP-SP (CelularesSubtraidos)...', cls: 'info' },
            { id: 'ssp-count',  text: '[...] Indexando boletins de ocorrência...', cls: 'info' },
            { id: 'ssp-kde',    text: '[...] Aguardando KDE heatmap...', cls: 'info' },
            { text: '[WARN] Região: CENTRO SP — Nível de risco: MÉDIO', cls: 'warn' },
            { text: '[SYS] Carregando camadas de mapa...', cls: 'info' },
            { text: '[OK]  Tile server DARK_NOLABELS conectado', cls: 'ok' },
            { text: '[OK]  27 Safe Points 24h mapeados', cls: 'ok' },
            { text: '[OK]  Dados de iluminação noturna carregados', cls: 'ok' },
            { text: '[SYS] Inicializando sistema de filtros...', cls: 'info' },
            { text: '[OK]  5 categorias de crime disponíveis', cls: 'ok' },
            { text: '[OK]  Feed de alertas sincronizado', cls: 'ok' },
            { text: '[WARN] 2 zonas de risco CRÍTICO detectadas no perímetro', cls: 'warn' },
            { text: '[OK]  Motor de análise de risco por grupo ativo', cls: 'ok' },
            { text: '[SYS] Verificação de integridade... CONCLUÍDA', cls: 'info' },
            { text: '[OK]  ████████████████ SISTEMA PRONTO ████████████████', cls: 'ok' },
            { text: '', cls: 'ok' },
            { text: '> Dados carregados. Iniciando interface...', cls: 'info' },
        ];
    }

    run() {
        let i = 0;
        const totalLines = this.bootLines.length;

        // Quando o summary.json chegar, sobrescreve as linhas placeholders.
        this._summaryPromise.then((summary) => {
            if (!summary) {
                this._patchLine('ssp-count', '[WARN] Dataset real não encontrado — usando simulação', 'warn');
                this._patchLine('ssp-kde',   '[INFO] Rode `python scripts/run_pipeline.py` para dados reais', 'info');
                return;
            }
            const total = summary.total_incidents?.toLocaleString('pt-BR') || '—';
            const types = summary.by_crime_type || {};
            const furto = (types.furto || 0).toLocaleString('pt-BR');
            const roubo = (types.roubo || 0).toLocaleString('pt-BR');
            this._patchLine('ssp-count', `[OK]  ${total} boletins indexados (furto: ${furto} · roubo: ${roubo})`, 'ok');
            this._patchLine('ssp-kde',   `[OK]  KDE heatmap compilado · bbox SP capital`, 'ok');
        });

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
            if (this.bootScreen.contains(e.target)) skipBoot();
        }, { once: true });

        const addLine = () => {
            if (this.bootComplete) return;
            if (i >= totalLines) {
                setTimeout(skipBoot, 500);
                return;
            }

            const line = this.bootLines[i];
            const div = document.createElement('div');
            div.className = `line ${line.cls}`;
            div.textContent = line.text;
            if (line.id) div.dataset.lineId = line.id;
            this.terminal.appendChild(div);
            this.terminal.scrollTop = this.terminal.scrollHeight;

            this.progressBar.style.width = `${((i + 1) / totalLines) * 100}%`;
            i++;

            const delay = line.text === '' ? 80 : (50 + Math.random() * 90);
            setTimeout(addLine, delay);
        };

        setTimeout(addLine, 350);
    }

    _patchLine(id, newText, newCls) {
        const idx = this.bootLines.findIndex((l) => l.id === id);
        if (idx >= 0) {
            this.bootLines[idx] = { ...this.bootLines[idx], text: newText, cls: newCls };
        }
        const el = this.terminal?.querySelector(`[data-line-id="${id}"]`);
        if (el) {
            el.textContent = newText;
            el.className = `line ${newCls}`;
        }
    }
}
