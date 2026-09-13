# CHARACTER REBUILD CLEANUP

**Order**: CHARACTER-REBUILD-000 — Repository Sanitation  
**Branch**: `game-build`  
**Base Commit**: `85921d6e126971af9957c95383af6ff1bcb4bf4f`

---

## DELETED

A total of **119 tracked files** and 2 transient audit scripts were removed from the working tree without rewriting Git history.

### 1. Duplicated Source Trees (52 files)
- `artifacts/visual-quality-001/before/src/**` (26 files)
- `artifacts/visual-quality-003/before/src/**` (26 files)
- **Rationale**: Redundant shadow trees. Full source history for these earlier states is immutably preserved by Git commits. Maintaining parallel duplicate source directories creates confusion and bloat.

### 2. Superseded One-Off Measurement & Status Scripts (3 files)
- `artifacts/visual-quality-001/measure.mjs`
- `artifacts/visual-quality-003/measure-phase1.mjs`
- `artifacts/visual-quality-003/phase1-git-status.txt`
- **Rationale**: One-off scratch scripts and status dumps used during past visual passes. They are not part of automated testing or package scripts, and their baseline metrics are preserved in retained comparison JSON files.

### 3. Root-Level PNG Clutter (30 files)
- `phase1_canvas_off.png`, `phase1_canvas_on.png`
- `phase1_concrete_off.png`, `phase1_concrete_on.png`
- `phase1_first_person_off.png`, `phase1_first_person_on.png`
- `phase1_gloves_off.png`, `phase1_gloves_on.png`
- `phase1_skin_off.png`, `phase1_skin_on.png`
- `phase1_steel_off.png`, `phase1_steel_on.png`
- `target1_scalp_above.png`
- `target2_trunks_cross.png`, `target2_trunks_wide_stance.png`
- `target3_elbow_flexion.png`, `target3_knee_flexion.png`
- `target4_idle_fists.png`, `target4_idle_fists_live.png`
- `target5_heavy_impact_droplets.png`, `target5_heavy_impact_droplets_1.png`, `target5_heavy_impact_droplets_2.png`
- `vq003_baseline_ceiling.png`, `vq003_baseline_combat.png`
- `vq003_baseline_opponent_front.png`, `vq003_baseline_opponent_upper.png`
- `vq003_baseline_ring.png`, `vq003_baseline_title.png`
- `vq003_baseline_viewmodel.png`, `vq003_baseline_warehouse.png`
- **Rationale**: Unreferenced, manual screenshot dumps in the project root. Authoritative Phase 1 validation captures are organized deterministically under `validation/phase1/`.

### 4. Legacy Phase 1 Validation Directory (22 files)
- `phase1_validation/**` (including manual captures and telemetry markdown)
- **Rationale**: Superseded by the authoritative deterministic validation harness output under `validation/phase1/`.

### 5. Large Raw Validation Video Captures (10 files, ~65 MB)
- `validation/phase1/canvas_motion_off.webm`, `validation/phase1/canvas_motion_on.webm`
- `validation/phase1/concrete_motion_off.webm`, `validation/phase1/concrete_motion_on.webm`
- `validation/phase1/gloves_motion_off.webm`, `validation/phase1/gloves_motion_on.webm`
- `validation/phase1/skin_motion_off.webm`, `validation/phase1/skin_motion_on.webm`
- `validation/phase1/steel_motion_off.webm`, `validation/phase1/steel_motion_on.webm`
- **Rationale**: Phase 1 has been accepted and its results are codified in `manifest.json` (which records the file paths, SHA-256 hashes, and byte lengths) as well as `timing_markers.json`. The video files are not consumed by test or runtime tooling and should not bloat the working tree.

### 6. Aborted / Failed Validation Run Debris (2 files)
- `validation/phase1/boot_failure.json`
- `validation/phase1/failure.json`
- **Rationale**: Intermediate failure dumps from an interrupted run that preceded the successful accepted Phase 1 run.

### 7. Untracked Temporary Audit Scripts (2 files)
- `scripts/capture-audit-frames.mjs`
- `scripts/capture-live-combat.mjs`
- **Rationale**: Ad-hoc capture scripts created solely to perform the GEMINI visual audit; not part of canonical validation tooling.

---

## RETAINED ACTIVE

Files retained because the active game runtime, build pipeline, or test suite directly imports or executes them:

- **Entry & Pipeline**: `index.html`, `package.json`, `package-lock.json`, `vite.config.js`, `src/main.js`
- **Core Game**: `src/game/app.js`, `src/game/config.js`, `src/game/audio/audio.js`
- **Combat Simulation**: `src/game/combat/ai.js`, `src/game/combat/fighters.js`, `src/game/combat/match.js`, `src/game/combat/resolve.js`
- **Input & HUD**: `src/game/input/actions.js`, `src/game/input/input-router.js`, `src/game/hud/hud.js`, `src/game/hud/hud.css`
- **Scene & Assets**: `src/game/scene/arena-scene.js`, `src/game/assets/dressing.js`, `src/game/assets/kit.js`, `src/game/assets/materials.js`, `src/game/assets/ring.js`, `src/game/assets/sculpt.js`, `src/game/assets/warehouse.js`
- **Presentation**: `src/game/presentation/asset-library.js`, `src/game/presentation/camera-rig.js`, `src/game/presentation/character-surfaces.js`, `src/game/presentation/lighting.js`, `src/game/presentation/presenter.js`, `src/game/presentation/procedural-materials.js`, `src/game/presentation/vfx.js`
- **Kinematics**: `src/game/character/boxing-feet.js`
- **Validation Engine & Tools**: `src/game/validation/harness.js`, `src/game/validation/model-poses.js`, `src/game/validation/models.js`, `src/game/validation/presets.js`, `src/game/validation/timing.js`, `scripts/validate-phase1.mjs`
- **Test Suite (90 tests)**: All 9 test files in `tests/` (`arena-scene`, `assets`, `character-ceiling`, `combat`, `engine-consumption`, `input`, `procedural-materials`, `validation-timing`, `visual-quality`)

---

## RETAINED REFERENCE

Files retained for historical, baseline, or audit reference:

- **Architectural & Audit Documentation**:
  - `README.md`
  - `ENGINE_GAPS.md`
  - `PHASE1-EVIDENCE-HARNESS.md`
  - `CHARACTER-CEILING-001.md`
  - `GEMINI-MODEL-ONLY-VISUAL-AUDIT.md` (documents why the continuous topology rebuild is required)
  - `VISUAL-QUALITY-001.md`, `VISUAL-QUALITY-002.md`, `VISUAL-QUALITY-003.md`, `VISUAL-VALIDATION-002.md`
- **Character Baseline Measurement**:
  - `scripts/measure-character.mjs` (CPU generation and character triangle/timing measurement)
  - `artifacts/character-ceiling-001-before.json`, `artifacts/character-ceiling-001-after.json`, `artifacts/character-ceiling-001-build.txt`, `artifacts/character-ceiling-001-tests.txt`
  - `artifacts/visual-quality-001/` (`before-metrics.json`, `changed-files.json`, `comparison.json`, `engine-before.json`)
  - `artifacts/visual-quality-003/` (`baseline-hashes.json`, `phase1-comparison.json`)
- **Authoritative Phase 1 Evidence**:
  - `validation/phase1/manifest.json` (records complete accepted inventory and hashes)
  - `validation/phase1/timing_markers.json`, `observed_frame_delta.json`, `raw_report_*.json`, `sample_*.json`, `webgl_diagnostics.json`, `rematch_resources.json`
  - All representative coverage JSONs and paired A/B validation PNGs (`canvas_*`, `concrete_*`, `gloves_*`, `skin_*`, `steel_*`)

---

## DEFERRED FOR REPLACEMENT

These legacy character construction modules remain in the repository ONLY because the current runnable game imports and depends on them as the working baseline. They are scheduled for removal or replacement during upcoming tranches (`CHARACTER-TOPOLOGY-001` et seq.):

1. `src/game/character/anatomy-fields.js`: Authored anatomical displacement fields and section interpolators. Imported by `athletic-body.js`, `fighter-face.js`, `fighter-kit.js`, and `corrective-deformation.js`.
2. `src/game/character/athletic-body.js`: Legacy multi-loft body assembly and naive linear skinning. Imported by `opponent-boxer.js`.
3. `src/game/character/corrective-deformation.js`: Scalar relative morph targets. Imported by `athletic-body.js`.
4. `src/game/character/garment-skin.js`: Open-panel trunk skinning with 1D vertical smoothstep ramp. Imported by `opponent-boxer.js`.
5. `src/game/character/equipment-corrections.js`: Glove morph targets. Imported by `player-fists.js` and `opponent-boxer.js`.
6. `src/game/character/opponent-boxer.js`: Opponent character assembly and IK rig. Imported by `app.js`.
7. `src/game/character/player-fists.js`: First-person viewmodel and roll orientation. Imported by `app.js`.
8. `src/game/assets/fighter-face.js`: Primitive kit face assembly (floating tube lips, block ears). Imported by `fighter-kit.js`.
9. `src/game/assets/fighter-kit.js`: Glove, boots, trunks, and arm assembly. Imported by `asset-library.js`.
10. `src/game/assets/skull-sections.js`: Skull station definitions. Imported by `athletic-body.js` and `fighter-face.js`.

---

## ARTIFACT POLICY

A new policy document has been authored at `docs/ARTIFACT_POLICY.md`. Key tenets:
- **Never commit duplicated source trees**: Git history preserves past revisions.
- **Never commit raw multi-megabyte video**: Use deterministic JSON manifests with timing, frame counts, and hashes.
- **Never commit temporary browser profiles, ad-hoc capture scripts, or aborted run debris**.
- **Keep the repository root clean**: All validation and test outputs belong in dedicated directories.

---

## VERIFICATION

- **Automated Tests**: `npm test` -> 90 / 90 tests passed (2.00s).
- **Production Build**: `npm run build` -> Vite built in 203ms with 0 errors.
- **Character Measurement Smoke Test**: `node scripts/measure-character.mjs` -> Ran successfully, reporting 61,600 skin triangles and 131.86ms generation.
- **Runtime & Model Validation Smoke Test**: Headless Chrome test against `http://127.0.0.1:5180/?validation=models` verified:
  - 25 inspection states present and active.
  - `glGetError: 0`, 0 shader compilation errors.
- **Engine Subtree Invariant**: `git status --porcelain -- engine` -> **EMPTY** (Engine completely untouched).
