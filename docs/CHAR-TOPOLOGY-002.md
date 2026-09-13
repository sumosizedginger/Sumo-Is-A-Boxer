# CHAR-TOPOLOGY-002: continuous hero body topology

Starting checkpoint: 002029bb0d810e441e6d83526a447053539c465f. Local and origin/game-build were both verified at that checkpoint before editing. Work stays on game-build.

## Representation

The old six independent torso/neck, skull, arm and leg shells and their fuse call are replaced by hero-skin-indexed-v1. A fixed 64-column axial grid flows from the pelvic rim through the neck to the exterior crown. Two lateral thorax windows are actual boundary loops. Engine boundary extraction and stitchTopologySurfaces bridge those loops into open proximal arm sections. Eight transitional rows carry the deltoid and axilla; the arms have 72 further rows through elbows and wrists. The shoulder has no cap or overlapping internal surface.

The pelvic rim splits along a shared seven-vertex crotch chain between front and rear midline vertices. Its two sides connect to the left and right thigh boundaries. The leg branches continue for 96 rows through knees and ankles. The pelvic saddle is exposed in inspection, not concealed under trunks. Only the exterior crown, distal wrist and distal ankle ends close with poles. These endpoints are covered by existing equipment in production; this turn does not author hands or feet.

The whole connected adjacency graph supports deterministic positional and junction-weight relaxation. Every shared seam vertex is updated once. This is bind-space shaping/skinning, not pose-dependent sculpting. The same index graph survives supported width and independent left-arm shape changes. Artifact metadata stores the template identity and per-vertex axial/branch domain labels; semantic region IDs distinguish 22 anatomical regions. Semantic landmarks retain the core rig anchors plus crown, jaw, neck base, sternum and waist. Coordinates are metres, +Y up and +Z forward, matching the existing boxer convention.

## Actual-body certification

The runtime invokes certifyHeroBody after attaching existing corrective morphs. Tests compare artifact position/index arrays against character.mesh.geometry and analyze that same runtime geometry, including its posed positions.

- Vertices: 23354
- Triangles: 46704
- Edges: 70056
- Connected components: 1
- Boundary edges and loops: 0
- Non-manifold edges and vertices: 0
- Degenerate and duplicate triangles: 0
- Isolated vertices: 0
- Invalid numeric/index values: 0
- Skin-weight violations: 0

The actual genus-zero surface satisfies V - E + F = 2. Four or fewer influences sum to one; tests reject contralateral influence bleeding. Normals are finite and unit length. UV0 uses a continuous oblique planar chart with no zero-area UV triangles. It deliberately overlaps front/back and is not the final nonoverlapping material atlas.

## Durable engine repair

The Turn 1 artifact runtime used Uint32 vertex attributes for skinIndex. Three's standard skinning shader declares floating-point inputs, and its WebGL2 integer binding path made the body invisible. The public createHeroRuntimeGeometry adapter now preserves integer authoring metadata while creating exact Float32 GPU inputs. Values beyond exact Float32 categorical range fail explicitly. Artifact instantiation and this game body share the adapter. The browser harness checks actual visible skin pixels and console errors, not just successful compilation or numeric topology.

## Reproduce inspection

Run npm run dev and open /?validation=models. Use Body skin to hide all clothing, gloves, boots, wraps, hair and facial attachments. Wireframe and Topology diagnostics expose the surface and actual counts. The body-view selector includes six full-body views and neck, both shoulders, both axillae, pelvis/hip, glute/hip, elbow and knee closeups. Orbit angle and the existing scrub/play controls remain available.

Console entry point:

    const m = window.__SUMO_IS_A_BOXER__.validation.models;
    m.show('front_neutral');
    m.body.mode('shaded');
    m.body.view('left_axilla');
    m.body.mode('wireframe');
    m.body.mode('diagnostic');
    m.body.certification();

Stress states: front_neutral, high_guard, arm_raised, deep_elbow_flex, punch_extension, torso_twist, wide_stance, deep_knee_flex. Raised and fully extended arm targets are validation-only additions; combat timing and animation states remain unchanged. Existing jab/cross rehearsal remains available separately.

Run node scripts/validate-continuous-body.mjs for real Chrome captures, live geometry certification and visible-pixel validation. The output directory is artifacts/char-topology-002. Before captures were taken from the starting checkpoint. Browser evidence uses the actual game scene and opponent, neutral light, single-sided material and hidden equipment; there is no alternate synthetic body.

## Remaining defects

This is a continuous topology foundation, not finished anatomy. The shoulder bridge is broad and its raised silhouette needs anatomical refinement. Neck proportions and head planes remain crude. The torso retains horizontal form bands. Hip/glute transitions bulge in asymmetric stances, elbows and knees compress, and extreme folds may self-contact. Shadow aliasing remains visible in axilla closeups. The validator does not prove global freedom from self-intersection. No open seam, detached skin component or exposed hollow joint was observed in the inspected views. Clothes and equipment retain their existing clipping and shape problems.

The complete body generation and certification add startup work. No topology rebuilding or weight-field relaxation runs per frame. Existing ten corrective channels remain legacy angular-magnitude activation for the later deformation turn. No final facial construction, new garment, material redesign, helper rig or atmosphere work was started.

## Validation results

Full game suite: 94/94 passed. Full engine suite: 583/583 passed. Game and engine production builds passed. The engine browser fixture required port 5173, so the existing game server was temporarily stopped and then restored. All 15 required camera views, wireframe and eight stress poses were inspected. The browser recorded 82383 visible skin pixels and zero console/page errors. See artifacts/char-topology-002/manifest.json for exact paths, capture hashes and certification.
