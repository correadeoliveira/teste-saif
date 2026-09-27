import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { resetMemory } from "../../test/preload-mocks";
import { recordGenuineSession, loadProfile, REQUIRED_ENROLLMENT_SESSIONS } from "./profileStore";

describe("profileStore enrollment", () => {
    beforeEach(() => {
        resetMemory();
        delete process.env.EXPO_PUBLIC_SUPABASE_URL;
        delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    });

    afterEach(() => {
        resetMemory();
    });

    it("começa em none e persiste device_id", async () => {
        const first = await loadProfile();
        assert.equal(first.status, "none");
        assert.equal(first.genuine_sessions, 0);
        assert.equal(first.required_sessions, REQUIRED_ENROLLMENT_SESSIONS);
        assert.ok(first.device_id.length > 8);
        const again = await loadProfile();
        assert.equal(again.device_id, first.device_id);
    });

    it("none → enrolling → ready em 3 sessões", async () => {
        const s1 = await recordGenuineSession();
        assert.equal(s1.genuine_sessions, 1);
        assert.equal(s1.status, "enrolling");

        const s2 = await recordGenuineSession();
        assert.equal(s2.genuine_sessions, 2);
        assert.equal(s2.status, "enrolling");

        const s3 = await recordGenuineSession();
        assert.equal(s3.genuine_sessions, 3);
        assert.equal(s3.status, "ready");
        assert.equal(s3.last_sync, "local-only");
    });
});
