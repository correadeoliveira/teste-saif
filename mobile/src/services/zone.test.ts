import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    classifyFromHotspots,
    classifyZone,
    CRITICAL_COOLDOWN_MS,
    densityFromHotspots,
    haversineMeters,
    shouldNotifyCritical,
    ZONE_RADIUS_M,
    type ZoneSnapshot,
} from "./zone";

function snap(partial: Partial<ZoneSnapshot> & Pick<ZoneSnapshot, "level">): ZoneSnapshot {
    return {
        source: "hotspots",
        nearbyCount: 0,
        maxDensity: 0,
        lat: -23.55,
        lng: -46.63,
        at: new Date().toISOString(),
        ...partial,
    };
}

describe("classifyZone (espelha zone_risk SQL)", () => {
    const cases: Array<[number, number, ReturnType<typeof classifyZone>]> = [
        [0, 0, "low"],
        [2, 0.19, "low"],
        [3, 0, "medium"],
        [0, 0.2, "medium"],
        [7, 0.39, "medium"],
        [8, 0, "high"],
        [0, 0.4, "high"],
        [19, 0.74, "high"],
        [20, 0, "critical"],
        [0, 0.75, "critical"],
        [20, 0.75, "critical"],
    ];

    for (const [nearby, density, expected] of cases) {
        it(`${nearby} nearby + density ${density} → ${expected}`, () => {
            assert.equal(classifyZone(nearby, density), expected);
        });
    }
});

describe("haversineMeters", () => {
    it("é ~0 no mesmo ponto", () => {
        assert.ok(haversineMeters(-23.55, -46.63, -23.55, -46.63) < 1);
    });

    it("Sé → Paulista é da ordem de 2–3 km", () => {
        const m = haversineMeters(-23.5505, -46.6333, -23.5616, -46.6558);
        assert.ok(m > 2000 && m < 3500, `got ${m}`);
    });
});

describe("densityFromHotspots / classifyFromHotspots", () => {
    const points: Array<[number, number, number]> = [
        [-23.55, -46.63, 0.9],
        [-23.7, -46.8, 0.1],
    ];

    it("pega o peso máximo dentro do raio", () => {
        assert.equal(densityFromHotspots(-23.55, -46.63, points), 0.9);
    });

    it("ignora pontos fora do raio", () => {
        assert.equal(densityFromHotspots(-23.55, -46.63, points, 50), 0.9);
        assert.equal(densityFromHotspots(-23.0, -46.0, points, ZONE_RADIUS_M), 0);
    });

    it("classifica só por densidade no fallback offline", () => {
        assert.equal(classifyFromHotspots(-23.55, -46.63, points), "critical");
    });
});

describe("shouldNotifyCritical", () => {
    const now = Date.parse("2026-09-27T12:00:00.000Z");

    it("notifica na primeira entrada em critical", () => {
        assert.equal(
            shouldNotifyCritical(null, snap({ level: "critical", at: new Date(now).toISOString() }), now),
            true
        );
        assert.equal(
            shouldNotifyCritical(
                snap({ level: "low", at: new Date(now - 1000).toISOString() }),
                snap({ level: "critical", at: new Date(now).toISOString() }),
                now
            ),
            true
        );
    });

    it("não notifica se o nível não é critical", () => {
        assert.equal(shouldNotifyCritical(null, snap({ level: "high" }), now), false);
    });

    it("não dispara spam no mesmo ponto antes do cooldown", () => {
        const previous = snap({
            level: "critical",
            lat: -23.55,
            lng: -46.63,
            at: new Date(now - 60_000).toISOString(),
        });
        const next = snap({
            level: "critical",
            lat: -23.55,
            lng: -46.63,
            at: new Date(now).toISOString(),
        });
        assert.equal(shouldNotifyCritical(previous, next, now), false);
    });

    it("exige cooldown E deslocamento > 400 m", () => {
        const previous = snap({
            level: "critical",
            lat: -23.55,
            lng: -46.63,
            at: new Date(now - CRITICAL_COOLDOWN_MS - 1000).toISOString(),
        });
        const stillHere = snap({
            level: "critical",
            lat: -23.55,
            lng: -46.63,
            at: new Date(now).toISOString(),
        });
        const moved = snap({
            level: "critical",
            lat: -23.555,
            lng: -46.64,
            at: new Date(now).toISOString(),
        });
        assert.ok(haversineMeters(previous.lat, previous.lng, moved.lat, moved.lng) > 400);
        assert.equal(shouldNotifyCritical(previous, stillHere, now), false);
        assert.equal(shouldNotifyCritical(previous, moved, now), true);
    });
});
