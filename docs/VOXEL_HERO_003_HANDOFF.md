# Precision checkpoint handoff

STATUS: PARTIAL. Visual acceptance fails.
TASK: VOXEL-HERO-003 anatomical authority and coherent surface lattice.
ROLE: BUILDER. Test and capture results below are builder evidence, not independent acceptance.
REVISION / SHA: The game-build commit containing this handoff; the delivery message supplies its full SHA.
PARENT / BASE REVISION: b424b6775746fd7681bb90b2977aa324b74c2876.
BRANCH: game-build.
WORKTREE STATE: Intended changes committed; pre-existing untracked artifact directories and index.tmp preserved outside the commit.

CHANGES: See [current state](CURRENT_STATE.md) for retained guide, hand, foot, face, engine and validation changes. Failed shoulder projection, enlarged eyes, diagonal frames and column stagger were removed.
FILES: [Exact inventory](../artifacts/voxel-hero-003-precision/validation/changed-files.txt).

TESTS / CHECKS:

- npm test: 108/108 pass.
- npm --prefix engine test: 613/613 pass.
- npm run build: pass, existing large-bundle advisory.
- node --check on changed/new scripts: pass.
- git diff --cached --check: pass after EOF cleanup.
- node scripts/validate-continuous-body.mjs: pass, 30 captures, valid live mesh, zero browser errors.
- node scripts/validate-hero-face.mjs precision-full: pass, 21 captures, zero browser errors.
- VOXEL_QUALITY=HERO REALIZATION=surface node scripts/validate-voxel.mjs: pass.
- VOXEL_QUALITY=HERO REALIZATION=coherentSurface node scripts/validate-voxel.mjs: pass.
- Canonical capture, reference triptych, contact-sheet and silhouette scripts: pass.

RUNTIME / BROWSER EVIDENCE: Headless Chrome, local Vite, validation harness cameras. [Reports and retained captures](../artifacts/voxel-hero-003-precision/validation/).
VISUAL EVIDENCE: [Canonical previews](../artifacts/voxel-hero-003/README.md) and [same-camera experiments](../artifacts/voxel-hero-003-precision/README.md). All final captures inspected.
PERFORMANCE EVIDENCE: Windows local machine, Node 24.21.0, one sequential run per mode. Surface compilation 28.303 s = 27.120 s canonical + 1.183 s realization. Coherent 28.999 s = 27.618 s canonical + 1.381 s realization. Single samples do not establish variance.
DIAGNOSTICS: Initial body navigation timed out at 30 seconds; the harness now allows 120 seconds and the rerun passes. LF/CRLF notices are informational.

WHAT WORKS: Deterministic canonical authority, bounded one-cell/one-cube experimental realization, finite orthonormal frames, normalized inherited weights, isotropic cubes through deformation, legacy modes, one draw call, manifold guide, rounded thumb and continuous cranial join.
WHAT DOES NOT: Reference anatomy, credible shoulder/axilla, strong posterior separation, knee/ankle transitions, facial identity, acceptable stress-pose folds, and a gap-free coherent cubic shell.
ARCHITECTURAL FINDINGS: Keeping canonical neighborhoods alone does not eliminate terrace bands. Free surface placement softens terraces but retains stippling. Numeric manifold certification does not detect visually unacceptable folds.
VALIDATION FINDINGS: BLOCKING for visual acceptance. Tests pass, required visual gates do not.
UNRESOLVED: Guide anatomy and surface coherence BLOCK NEXT STEP into downstream milestones.
DEPENDENCY / SHORTCUT CHECK: No new dependency, donor mesh, random sampling, shader imitation, stretched cubes, or downstream system work.
PROVENANCE: No donor code ported or materially adapted. Existing frame code extracted into a shared local engine module.
LEARNING IMPACT: NONE. Engine docs describe an explicit experimental API, not a visually accepted solution.
NEXT RECOMMENDED ROLE: VALIDATOR, followed by focused geometry repair.
WHY: Independent review should challenge the retained shoulder binding/topology and projection assumptions before another broad art pass.

PASTE THIS NEXT:

Review the exact game-build checkpoint containing this handoff in sumosizedginger/Sumo-Is-A-Boxer. Read the repository status, this handoff, CURRENT_STATE, the precision iteration report, engine AGENTS/CONSTITUTION/PRD/ARCHITECTURE and VOXEL_FORGE. Inspect the canonical reference/guide/HERO triptychs and validation stress captures. Audit the shoulder topology and binding, facial construction and constrained realization without changing production code. Reproduce root/engine tests and relevant browser proof; classify findings with concrete geometry or runtime evidence. Do not touch main, reset work, approve visual quality from tests, or start combat, clothing, animation/material polish. Return the engine handoff format with the exact SHA, reproducible findings and a bounded repair recommendation. Stop after the audit.
