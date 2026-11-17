import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const MAX_BYTES = 64 * 1024;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const LOCAL_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function localOrigin(req) {
    if (!LOCAL_ADDRESSES.has(req.socket.remoteAddress)) return false;
    try {
        const origin = new URL(req.headers.origin);
        return origin.protocol === 'http:' && LOCAL_HOSTS.has(origin.hostname)
            && origin.host === req.headers.host;
    } catch {
        return false;
    }
}

function validProfile(profile) {
    if (profile?.version !== 1 || typeof profile.completed_at !== 'string'
        || !Number.isFinite(Date.parse(profile.completed_at))) return false;
    const { answers } = profile;
    return answers && typeof answers === 'object' && !Array.isArray(answers)
        && Object.entries(answers).every(([key, values]) =>
            /^[a-z_]{1,40}$/.test(key) && Array.isArray(values)
            && values.every((value) => typeof value === 'string' && value.length <= 512));
}

export function profileHandler(directory) {
    return (req, res, next) => {
        if (req.url?.split('?')[0] !== '/api/behavior-profile') return next();

        function respond(status, payload) {
            res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify(payload));
        }

        if (req.method !== 'POST') return respond(405, { error: 'method_not_allowed' });
        if (!localOrigin(req)) return respond(403, { error: 'local_origin_required' });
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
            return respond(415, { error: 'json_required' });
        }

        let size = 0;
        const chunks = [];
        req.on('error', () => {
            if (!res.writableEnded) respond(400, { error: 'request_error' });
        });
        req.on('data', (chunk) => {
            if (res.writableEnded) return;
            size += chunk.length;
            if (size > MAX_BYTES) {
                chunks.length = 0;
                respond(413, { error: 'payload_too_large' });
            } else {
                chunks.push(chunk);
            }
        });
        req.on('end', async () => {
            if (res.writableEnded) return;
            let profile;
            try {
                profile = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            } catch {
                return respond(400, { error: 'invalid_json' });
            }
            if (!validProfile(profile)) return respond(400, { error: 'invalid_profile' });
            try {
                await mkdir(directory, { recursive: true, mode: 0o700 });
                await writeFile(new URL(`profile_${randomUUID()}.json`, directory), JSON.stringify({
                    received_at: new Date().toISOString(),
                    profile: { version: profile.version, completed_at: profile.completed_at, answers: profile.answers },
                }), { flag: 'wx', mode: 0o600 });
                respond(200, { ok: true });
            } catch {
                respond(500, { error: 'profile_write_failed' });
            }
        });
    };
}
