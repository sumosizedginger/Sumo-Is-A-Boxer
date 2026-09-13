import test from 'node:test';
import assert from 'node:assert/strict';
import { certifyHeroBody } from '@sumosizedginger/my-game-engine-1.0/full';
import { createOpponentBoxer } from '../src/game/character/opponent-boxer.js';
import { createAssetLibrary } from '../src/game/presentation/asset-library.js';
import { buildFighterKitAssets } from '../src/game/assets/fighter-kit.js';
import { MATERIAL_DEFINITIONS } from '../src/game/assets/materials.js';

test('actual legacy boxer exposes disconnected topology and cannot claim a continuous hero body',t=>{
  const library=createAssetLibrary({assets:buildFighterKitAssets(),materials:MATERIAL_DEFINITIONS}),opponent=createOpponentBoxer({library});
  try{
    const c=opponent.character,a=c.heroArtifact;
    assert.equal(a.provenance.assembly,'buffer-concatenation');assert.equal(a.certifiedClosedBody,false);
    assert.ok(a.topologyReport.connectedComponentCount>=6);
    assert.throws(()=>certifyHeroBody(a),/Body failed mandatory/);
    assert.equal(a.coreSkeleton.length,22);assert.equal(c.coreBones.length,22);
    assert.equal(a.semanticRegions.length,6);assert.equal(a.poseDriverRegistry.length,10);
    assert.equal(a.morphRegistry.length,c.geometry.morphAttributes.position.length);
    assert.deepEqual(a.geometry.attributes.position,Array.from(c.geometry.attributes.position.array));
    assert.deepEqual(a.geometry.indices,Array.from(c.geometry.index.array));
    assert.equal(a.provenance.activation,'legacy-angular-magnitude');
    t.diagnostic(JSON.stringify({components:a.topologyReport.connectedComponentCount,boundaryEdges:a.topologyReport.boundaryEdgeCount,certified:a.certifiedClosedBody}));
  }finally{opponent.dispose();library.dispose();}
});
