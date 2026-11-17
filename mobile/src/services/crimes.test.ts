import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { resetMemory, resetSupabaseMock, setRpcHandler } from "../../test/preload-mocks";
import { flushPanicQueue, reportPanic } from "./crimes";

function online(): void {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
}

function offline(): void {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
}

describe("reportPanic", () => {
    beforeEach(() => {
        resetMemory();
        resetSupabaseMock();
        offline();
    });

    afterEach(() => {
        offline();
        resetSupabaseMock();
        resetMemory();
    });

    it("rejeita coordenadas inválidas", async () => {
        const result = await reportPanic({ lat: Number.NaN, lng: -46.63 });
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.error, "invalid_coords");
    });

    it("enfileira offline quando o Supabase não está configurado", async () => {
        const result = await reportPanic({ lat: -23.55, lng: -46.63, crimeType: "roubo" });
        assert.equal(result.ok, true);
        if (result.ok) {
            assert.equal(result.queued, true);
            assert.equal(result.crime_type, "roubo");
            assert.match(result.bo_number, /^LOCAL-/);
        }
    });

    it("envia online e não deixa na fila", async () => {
        online();
        setRpcHandler(async () => ({
            data: {
                ok: true,
                id: 42,
                bo_number: "PANIC-abc",
                crime_type: "furto",
                period: "tarde",
            },
            error: null,
        }));
        const result = await reportPanic({ lat: -23.55, lng: -46.63, crimeType: "furto" });
        assert.deepEqual(result, {
            ok: true,
            id: 42,
            bo_number: "PANIC-abc",
            crime_type: "furto",
            period: "tarde",
            queued: false,
        });
    });

    it("propaga device_required sem enfileirar", async () => {
        online();
        setRpcHandler(async () => ({
            data: { ok: false, error: "device_required" },
            error: null,
        }));
        const result = await reportPanic({ lat: -23.55, lng: -46.63 });
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.error, "device_required");
    });

    it("propaga rate_limited sem enfileirar", async () => {
        online();
        setRpcHandler(async () => ({
            data: { ok: false, error: "rate_limited", retry_after_sec: 90 },
            error: null,
        }));
        const result = await reportPanic({ lat: -23.55, lng: -46.63 });
        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.equal(result.error, "rate_limited");
            assert.equal(result.retry_after_sec, 90);
        }
    });

    it("enfileira erro de rede e flush esvazia a fila", async () => {
        online();
        setRpcHandler(async () => ({ data: null, error: { message: "boom" } }));
        const queued = await reportPanic({ lat: -23.55, lng: -46.63 });
        assert.equal(queued.ok, true);
        if (queued.ok) assert.equal(queued.queued, true);

        setRpcHandler(async () => ({
            data: { ok: true, id: 1, bo_number: "PANIC-ok", crime_type: "outros", period: "noite" },
            error: null,
        }));
        await flushPanicQueue();
        const again = await reportPanic({ lat: -23.56, lng: -46.64 });
        assert.equal(again.ok, true);
        if (again.ok) assert.equal(again.queued, false);
    });
    it("serializa envios offline e preserva a fila quando um flush precisa ser repetido", async () => {
        const first = { lat: -23.55, lng: -46.63 };
        const second = { lat: -23.56, lng: -46.64 };
        await Promise.all([reportPanic(first), reportPanic(second)]);

        online();
        const sent: number[] = [];
        let blocked = true;
        setRpcHandler(async (_fn: string, args: { p_lat: number }) => {
            sent.push(args.p_lat);
            const result = blocked && args.p_lat === second.lat
                ? { ok: false, error: "rate_limited" }
                : { ok: true, id: sent.length };
            return { data: result, error: null };
        });
        await flushPanicQueue();
        blocked = false;
        await Promise.all([flushPanicQueue(), flushPanicQueue()]);
        assert.deepEqual(sent, [first.lat, second.lat, second.lat]);
    });
});
