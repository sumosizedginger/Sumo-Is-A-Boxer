# Precision checkpoint handoff

STATUS: PARTIAL. Visual acceptance fails.
TASK: VOXEL-HERO-003 anatomical authority and coherent surface lattice.
ROLE: BUILDER. Test and capture results below are builder evidence, not independent acceptance.
REVISION / SHA: The game-build commit containing this handoff; the delivery message supplies its full SHA.
PARENT / BASE REVISION: c48c2c375c15d1a4a924ef84620f43b4cc5554df.
BRANCH: game-build.
WORKTREE STATE: Intended changes committed; pre-existing untracked artifact directories and index.tmp preserved outside the commit.

CHANGES: This checkpoint repairs inward-facing longitudinal foot surfaces, removes the instep reversal, adds plantar heel mass, fits the neutral sole contact and blends shin/foot weights continuously across the stitched ankle. Connectivity stays at 62,460 vertices and 124,916 triangles. Two new cameras and three geometric/binding regressions cover the repair. No new shoulder, hand, face or engine algorithm edits are included. Surface remains default; coherentSurface is experimental and visually unaccepted.
FILES: [Exact inventory](../artifacts/voxel-hero-003-precision/validation-foot/changed-files.txt).

TESTS / CHECKS:

- npm test: 115/115 pass.
- npm --prefix engine test: 613/613 pass.
- npm run build: pass, existing large-bundle advisory.
- node --check on changed/new scripts: pass.
- git diff --cached --check: pass after EOF cleanup.
- node scripts/validate-continuous-body.mjs: pass, 30 captures, valid live mesh, zero browser errors.
- Face browser validation: not rerun for the foot-only repair. Prior c48c2c3 result has 21 captures in validation-shoulder; current canonical face views were regenerated.
- VOXEL_QUALITY=HERO REALIZATION=surface node scripts/validate-voxel.mjs: pass.
- VOXEL_QUALITY=HERO REALIZATION=coherentSurface node scripts/validate-voxel.mjs: pass.
- Canonical capture, reference triptych, contact-sheet and silhouette scripts: pass.

RUNTIME / BROWSER EVIDENCE: Headless Chrome, local Vite, validation harness cameras. [Reports and retained captures](../artifacts/voxel-hero-003-precision/validation-foot/).
VISUAL EVIDENCE: [Canonical previews](../artifacts/voxel-hero-003/README.md) and [same-camera experiments](../artifacts/voxel-hero-003-precision/README.md). All 39 canonical cameras, ten reference boards, eleven coherent captures, three same-camera boards and 30 current body validation captures inspected. Both manifests match 15 runtime source hashes each and 55 total image hashes.
PERFORMANCE EVIDENCE: Windows local machine, sequential Node runs. Surface 42.013 s total = 40.413 s canonical + 1.599 s realization. Coherent 39.541 s = 37.657 s canonical + 1.884 s realization. Single samples do not establish variance. Canonical cells 269,401 occupied / 28,620 surface / 48,362 visible faces. Surface 45,796 instances (1.6001 ratio); coherent 28,620 (1.0 ratio). Pitch 0.012 m; one draw call. Fresh silhouette errors: front 4.3000%, profile 3.9640%.
DIAGNOSTICS: Initial body navigation timed out at 30 seconds; the harness now allows 120 seconds and the rerun passes. LF/CRLF notices are informational.

WHAT WORKS: Deterministic canonical authority, bounded one-cell/one-cube experimental realization, finite orthonormal frames, normalized inherited weights, isotropic cubes through deformation, legacy modes, one draw call, manifold guide, fitted arm pivots, neutral wrist targets, monotone lower axilla bridge, local arm/torso clearance, outward foot exterior and continuous ankle binding.
WHAT DOES NOT: Reference anatomy, credible shoulder/axilla, strong posterior separation, punched knees, crude shoe-like feet, facial identity, acceptable stress-pose deformation, and a gap-free coherent cubic shell.
ARCHITECTURAL FINDINGS: Keeping canonical neighborhoods alone does not eliminate terrace bands. Free surface placement softens terraces but retains stippling. Numeric manifold certification does not detect visually unacceptable folds.
VALIDATION FINDINGS: BLOCKING for visual acceptance. Tests pass, required visual gates do not.
UNRESOLVED: Guide anatomy and surface coherence BLOCK NEXT STEP into downstream milestones.
DEPENDENCY / SHORTCUT CHECK: No new dependency, donor mesh, random sampling, shader imitation, stretched cubes, or downstream system work.
PROVENANCE: No donor code ported or materially adapted. Existing frame code extracted into a shared local engine module.
LEARNING IMPACT: NONE. Engine docs describe an explicit experimental API, not a visually accepted solution.
NEXT RECOMMENDED ROLE: VALIDATOR, followed by focused geometry repair.
WHY: Independent review should challenge the retained foot exterior and ankle binding, shoulder anatomy and projection assumptions before another broad art pass.

PASTE THIS NEXT:

Review the exact game-build checkpoint containing this handoff in sumosizedginger/Sumo-Is-A-Boxer. Read the repository status, this handoff, CURRENT_STATE, the precision iteration report, engine AGENTS/CONSTITUTION/PRD/ARCHITECTURE and VOXEL_FORGE. Inspect the canonical reference/guide/HERO triptychs and validation stress captures. Audit the shoulder topology and binding, facial construction and constrained realization without changing production code. Reproduce root/engine tests and relevant browser proof; classify findings with concrete geometry or runtime evidence. Do not touch main, reset work, approve visual quality from tests, or start combat, clothing, animation/material polish. Return the engine handoff format with the exact SHA, reproducible findings and a bounded repair recommendation. Stop after the audit.
