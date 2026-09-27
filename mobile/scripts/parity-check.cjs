#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const fixturePath = path.join(root, "shared/behavior/parity_fixture.json");
const { extractWindowFeatures } = require("../dist-parity/features");
const { decisionScore } = require("../dist-parity/inference");

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const feats = extractWindowFeatures(fixture.samples, fixture.feature_names);
if (feats.length !== fixture.features.length) {
    console.error("length mismatch", feats.length, fixture.features.length);
    process.exit(1);
}
let maxFeat = 0;
for (let i = 0; i < feats.length; i++) {
    maxFeat = Math.max(maxFeat, Math.abs(feats[i] - fixture.features[i]));
}
const score = decisionScore(feats, fixture.model);
const dScore = Math.abs(score - fixture.score);
console.log(JSON.stringify({ maxFeatDelta: maxFeat, scoreDelta: dScore, score, expected: fixture.score }));
if (maxFeat > 1e-5 || dScore > 1e-5) {
    console.error("parity failed");
    process.exit(1);
}
console.log("parity ok");
