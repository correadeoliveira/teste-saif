import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const artifact = /^shared\/(?:summary\.json|current_run\.json|heatmaps\/(?:heatmap_grid\.geojson|heatmap_points(?:__(?:furto|roubo|outros)(?:__(?:manha|tarde|noite|madrugada))?)?\.json))$/;
const legacyAsset = /^(?:web\/(?:index\.html|style\.css|(?:src|assets)\/[\w./-]+)|shared\/web\/[\w-]+\.js)$/;

export const isPublicArtifact = (file) => artifact.test(file);
const isLegacyFile = (file) => artifact.test(file) || legacyAsset.test(file);

const contentTypes = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.geojson': 'application/geo+json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
};

export function requestPath(url) {
    try {
        const decoded = decodeURIComponent(url.split('?')[0]);
        if (!decoded.startsWith('/') || decoded.includes('\\') || decoded.includes('\0')) return null;
        if (decoded.split('/').some((segment) => segment === '..' || segment === '.')) return null;
        if (decoded === '/' || decoded === '/web/' || decoded === '/web') return 'web/index.html';
        return decoded.slice(1);
    } catch {
        return null;
    }
}

export async function servePublicFile(root, req, res, artifactsOnly = false) {
    const allowed = artifactsOnly ? isPublicArtifact : isLegacyFile;
    const file = requestPath(req.url ?? '/');
    if (!file || !allowed(file)) {
        res.writeHead(404).end();
        return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
    }

    try {
        const absolute = await realpath(path.join(root, file));
        if (!allowed(path.relative(root, absolute).split(path.sep).join('/'))) {
            res.writeHead(404).end();
            return;
        }
        const info = await stat(absolute);
        if (!info.isFile()) {
            res.writeHead(404).end();
            return;
        }
        res.writeHead(200, {
            'Content-Type': contentTypes[path.extname(absolute)] ?? 'application/octet-stream',
            'Content-Length': info.size,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': artifactsOnly || isPublicArtifact(file) ? 'no-cache' : 'no-store',
        });
        if (req.method === 'HEAD') res.end();
        else createReadStream(absolute).on('error', () => res.destroy()).pipe(res);
    } catch {
        if (!res.headersSent) res.writeHead(404).end();
        else res.destroy();
    }
}
