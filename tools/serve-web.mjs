import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { servePublicFile } from './public-files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.argv[2] ?? 8000);
const host = process.env.SAIFEN_WEB_HOST || '127.0.0.1';
createServer((req, res) => {
    if (req.url === '/' || req.url === '/web') {
        res.writeHead(302, { Location: '/web/' }).end();
        return;
    }
    void servePublicFile(root, req, res);
})
    .on('error', (error) => {
        console.error(error.code ?? 'web_server_error');
        process.exitCode = 1;
    })
    .listen(port, host, () => console.log(`SAIFEN web: http://${host}:${port}/web/`));
