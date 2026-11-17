import assert from "node:assert/strict";
import test from "node:test";
import { validateModel, verifySession } from "./inference";
import { loadBundledModel } from "./modelLoader";

test("modelo inválido e janela insuficiente não viram decisões", () => {
    const model = loadBundledModel();
    assert.ok(model && validateModel(model));
    const invalid = { ...model, coef: [] };
    assert.equal(validateModel(invalid), false);
    assert.equal(verifySession([], invalid).status, "unavailable");
    const empty = verifySession([], { ...model, threshold: 0 });
    assert.equal(empty.status, "unavailable");
    if (empty.status === "unavailable") assert.equal(empty.reason, "insufficient_samples");
});
