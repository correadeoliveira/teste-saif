import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicArtifact, requestPath } from '../../tools/public-files.mjs';

test('public artifact inventory contains the consumer contract', () => {
    assert.equal(isPublicArtifact('shared/heatmaps/heatmap_points.json'), true);
    assert.equal(isPublicArtifact('shared/heatmaps/heatmap_points__furto__noite.json'), true);
    assert.equal(isPublicArtifact('shared/current_run.json'), true);
    assert.equal(isPublicArtifact('shared/heatmaps/crimes.geojson'), false);
    assert.equal(isPublicArtifact('shared/behavior/model.json'), false);
    assert.equal(requestPath('/web/style.css?version=1'), 'web/style.css');
});
