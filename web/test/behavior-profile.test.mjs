import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { profileHandler } from '../../tools/behavior-profile.mjs';

function request(handler, body, origin = 'http://localhost:5173') {
    const req = Readable.from([Buffer.from(body)]);
    Object.assign(req, {
        url: '/api/behavior-profile',
        method: 'POST',
        socket: { remoteAddress: '::1' },
        headers: { origin, host: 'localhost:5173', 'content-type': 'application/json' },
    });
    return new Promise((resolve) => {
        const res = {
            writableEnded: false,
            writeHead(status) { this.status = status; },
            end() {
                this.writableEnded = true;
                resolve(this.status);
            },
        };
        handler(req, res, () => resolve(404));
    });
}

test('only the local questionnaire writes a well-formed profile', async () => {
    const temp = await mkdtemp(path.join(tmpdir(), 'saifen-profile-'));
    try {
        const handler = profileHandler(pathToFileURL(temp + path.sep));
        const profile = { version: 1, completed_at: '2026-01-01T00:00:00Z', answers: { rotina: ['a'] } };
        assert.equal(await request(handler, JSON.stringify(profile)), 200);
        assert.equal(await request(handler, JSON.stringify(profile), 'http://localhost:4174'), 403);
        assert.equal(await request(handler, JSON.stringify({ ...profile, answers: 'invalid' })), 400);
        assert.equal(await request(handler, 'ê'.repeat(40_000)), 413);
        assert.equal((await readdir(temp)).length, 1);
    } finally {
        await rm(temp, { recursive: true, force: true });
    }
});
