import { BootScreen } from '../ui/BootScreen.js';
import { AlertSystem } from '../ui/AlertSystem.js';
import { HUDController } from '../ui/HUDController.js';
import { TacticalMap } from '../map/TacticalMap.js';

export class App {
    constructor() {
        this.bootScreen = null;
        this.alertSystem = null;
        this.tacticalMap = null;
        this.hudController = null;
    }

    start() {
        this.bootScreen = new BootScreen(() => this.initCoreSystems());
        this.bootScreen.run();
    }

    initCoreSystems() {
        // Init Map
        this.tacticalMap = new TacticalMap();
        this.tacticalMap.init();

        // Init UI Systems
        this.alertSystem = new AlertSystem();
        this.alertSystem.init();

        // Init HUD Actions
        this.hudController = new HUDController(this.alertSystem, this.tacticalMap.routeManager);
        this.hudController.init();
    }
}
