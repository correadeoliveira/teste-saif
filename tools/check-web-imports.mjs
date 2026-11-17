import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HeatmapLoader } from '../shared/web/heatmap-loader.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const src = path.join(root, 'web/src');
for (const file of readdirSync(src, { recursive: true }).filter((name) => name.endsWith('.js'))) {
    const fullPath = path.join(src, file);
    const refs = readFileSync(fullPath, 'utf8').matchAll(/\b(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g);
    for (const [, ref] of refs) {
        if (!existsSync(path.resolve(path.dirname(fullPath), ref))) {
            throw new Error(`Import em ${file} não encontrado: ${ref}`);
        }
    }
}

// Exercise the same validation as the clients against the committed artifact.
globalThis.fetch = async (url) => new Response(readFileSync(path.join(root, url)));
await new HeatmapLoader().loadPoints();
console.log('web imports and heatmap contract ok');
