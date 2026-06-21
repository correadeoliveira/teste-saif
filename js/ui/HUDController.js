import { pointsOfInterest } from '../data/MockData.js';

export class HUDController {
    constructor(alertSystem, routeManager) {
        this.alertSystem = alertSystem;
        this.routeManager = routeManager;
        this.ghostMode = false;
    }

    init() {
        this.initClock();
        this.initSidePanel();
        this.initActions();
    }

    initClock() {
        const tick = () => {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            document.getElementById('clock').textContent = `${h}:${m}:${s}`;
        };
        tick();
        setInterval(tick, 1000);
    }

    initSidePanel() {
        const panel = document.getElementById('side-panel');
        const toggle = document.getElementById('panel-toggle');
        const mobileBtn = document.getElementById('mobile-panel-btn');

        toggle.addEventListener('click', () => {
            panel.classList.toggle('collapsed');
        });

        mobileBtn.addEventListener('click', () => {
            panel.classList.toggle('open-mobile');
            panel.classList.toggle('collapsed');
        });

        document.getElementById('map').addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                panel.classList.remove('open-mobile');
                panel.classList.add('collapsed');
            }
        });
    }

    initActions() {
        document.getElementById('btn-scan').addEventListener('click', () => this.performScan());
        document.getElementById('btn-ghost').addEventListener('click', () => this.toggleGhostMode());
        document.getElementById('btn-alert').addEventListener('click', () => this.alertFriends());
        document.getElementById('btn-routes').addEventListener('click', () => this.routeManager.toggleSafeRoutes(this.alertSystem));
    }

    performScan() {
        const overlay = document.getElementById('scan-overlay');
        const scanData = document.getElementById('scan-data');

        overlay.classList.remove('hidden');

        const nearbyDanger = pointsOfInterest.filter(p => p.risk === 'critical' || p.risk === 'high').length;
        const nearbySafe = pointsOfInterest.filter(p => p.type === 'police' || p.type === 'commerce24h').length;

        scanData.textContent = `${pointsOfInterest.length} pontos | ${nearbyDanger} alertas | ${nearbySafe} aliados`;

        this.alertSystem.showToast('⟐ Scan iniciado — analisando perímetro...', 'info');

        setTimeout(() => {
            overlay.classList.add('hidden');
            this.alertSystem.showToast(`Scan completo — ${nearbyDanger} zonas de risco detectadas`, nearbyDanger > 3 ? 'danger' : 'warning');
            this.alertSystem.addAlertToFeed('info', 'Scan de perímetro concluído. Dados atualizados.');
        }, 2500);
    }

    toggleGhostMode() {
        this.ghostMode = !this.ghostMode;
        const btn = document.getElementById('btn-ghost');
        const visStatus = document.getElementById('visibility-status');

        if (this.ghostMode) {
            document.body.classList.add('ghost-mode');
            btn.classList.add('active');
            visStatus.textContent = 'FANTASMA';
            visStatus.className = 's-value ghost';
            this.alertSystem.showToast('◌ Modo Fantasma ativado — visibilidade reduzida', 'info');
            this.alertSystem.addAlertToFeed('info', 'Modo Fantasma ativo. Perfil em stealth.');
        } else {
            document.body.classList.remove('ghost-mode');
            btn.classList.remove('active');
            visStatus.textContent = 'NORMAL';
            visStatus.className = 's-value';
            this.alertSystem.showToast('Modo Fantasma desativado', 'info');
            this.alertSystem.addAlertToFeed('info', 'Visibilidade restaurada para NORMAL.');
        }
    }

    alertFriends() {
        this.alertSystem.showToast('△ Alerta enviado para 3 contatos de emergência!', 'danger');
        this.alertSystem.addAlertToFeed('danger', 'ALERTA DE EMERGÊNCIA enviado para seus contatos.');

        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed; inset: 0; z-index: 9000;
            background: rgba(255, 0, 60, 0.1);
            pointer-events: none;
            animation: fade-in 0.1s ease;
        `;
        document.body.appendChild(flash);
        setTimeout(() => {
            flash.style.opacity = '0';
            flash.style.transition = 'opacity 0.4s ease';
            setTimeout(() => flash.remove(), 400);
        }, 150);
    }
}
