#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const fixturePath = path.join(root, "shared/behavior/parity_fixture.json");
const { extractWindowFeatures } = require("../dist-parity/features");
const { decisionScore, validateModel } = require("../dist-parity/inference");

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const bundled = JSON.parse(fs.readFileSync(path.join(root, "mobile/assets/behavior/model.json"), "utf8"));
const canonical = JSON.parse(fs.readFileSync(path.join(root, "shared/behavior/model.json"), "utf8"));
const assert = require("node:assert/strict");
assert.equal(fixture.source, "synthetic");
assert.ok(validateModel(bundled), "invalid bundled IMU model");
assert.deepEqual(bundled, canonical, "shared and mobile models must match");
assert.deepEqual(fixture.model, bundled, "parity fixture must use the bundled model");
assert.deepEqual(fixture.feature_names, bundled.feature_names);
const feats = extractWindowFeatures(fixture.samples, fixture.feature_names);
if (feats.length !== fixture.features.length) {
    console.error("length mismatch", feats.length, fixture.features.length);
    process.exit(1);
}
let maxFeat = 0;
for (let i = 0; i < feats.length; i++) {
    maxFeat = Math.max(maxFeat, Math.abs(feats[i] - fixture.features[i]));
}
const score = decisionScore(feats, bundled);
const dScore = Math.abs(score - fixture.score);
console.log(JSON.stringify({ maxFeatDelta: maxFeat, scoreDelta: dScore, score, expected: fixture.score }));
if (!Number.isFinite(maxFeat) || !Number.isFinite(dScore) || maxFeat > 1e-5 || dScore > 1e-5) {
    console.error("parity failed");
    process.exit(1);
}
console.log("parity ok");
