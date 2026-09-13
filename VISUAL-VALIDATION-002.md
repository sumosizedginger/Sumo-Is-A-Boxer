# VISUAL-VALIDATION-002

STATUS: BUILT — AWAITING INDEPENDENT VALIDATION

This record closes the gap left open by `VISUAL-QUALITY-001.md`, which shipped a
large presentation and character rewrite but could not render any of it: its
browser tool reported `apps: [], browsers: []`, so it correctly refused to claim
visual acceptance in any category.

Browser tooling was available for this pass. The game was run, inspected,
measured, and two defects found by looking at it were fixed.

## 1. What was inspected

Live, at `http://127.0.0.1:5180`, in a real WebGL context:

title / establishing shot · first-person default view · opponent at 0.7 m,
1.2 m and 2.0 m · opponent front and three-quarter · player jab in flight ·
opponent cross landing · guard · trunks and legs under a diagnostic tint ·
head and hair close-up · ring corner, ropes, canvas · warehouse structure,
gantry, lamps, crowd · knockdown camera · get-up · defeat screen · rematch.

## 2. Defects found by looking, and fixed

### D1 — skin punched through the trunks (visible at fighting distance)

Jagged pale wedges appeared on the front of both thighs. Tinting the skinned
mesh green proved the shards were skin, not cloth.

Measured, rather than guessed: sampling the skinned hip band in `thigh_l`-bone
space (vertices weighted ≥0.95 to that bone, posed, via `applyBoneTransform`)
gave the thigh flesh radius against the shorts shell radius —

| thigh-local y | skin r | shorts r | clearance |
|---:|---:|---:|---:|
| +0.02 | 0.099 | 0.1225 | +23.5 mm |
| −0.04 | 0.135 | 0.1324 | **−2.6 mm** |
| −0.12 | 0.1358 | 0.1385 | +2.7 mm |

The shell was *inside* the leg at the hip and 2.7 mm clear below it — well within
the faceting error of a 32-gon shell over a 28-gon leg. Fixed by re-cutting the
shell stations in `src/game/assets/fighter-kit.js` to hold ~14 mm, which also
reads better: boxing trunks hang loose, not sprayed on.

### D2 — hair rendered as wet black plastic

`boxer-hair` was sharing `leatherBlack` (roughness 0.46, metalness 0.08) with the
gloves and boots. Under the warm ring lamps the crown read as glossy latex. This
is the material-language failure the brief warns about — one family standing in
for another. Added a real `hair` family (roughness 0.94, metalness 0.0) in
`src/game/assets/materials.js` and applied it. Material families 37 → 38,
definitions 112 → 114.

## 3. Checked and found NOT to be defects

- **Lighting.** VISUAL-QUALITY-001 dropped exposure 0.96→0.86, ring spots 58→31
  and the key 108→68 without seeing the result. Inspected: it holds. The venue
  is moodier, corner spill and wall washes still carry the structure, and the
  canvas is no longer blown out. No change made.
- **Skin colour.** The torso reads hot orange at close range, but the material is
  the authored `#87684f` at roughness 0.7 — that is warm-lamp response plus ACES
  on a large smooth surface, not a material bug. Left alone.
- **Window resize.** Canvas tracks the viewport correctly (1280×820 verified).
- **Hair seam.** A faceted notch where the fade meets the cap is visible at
  0.78 m and gone by 2 m, which is beyond fighting distance. Not chased.

## 4. Gameplay verified running

Intro → BOX! → exchange (both fighters' health moved) → **"YOU ARE DOWN!"** →
8-count → **"BOX ON"** at the configured 38 HP get-up → second knockdown →
third knockdown → `FINISHED`, result `{LOSE, "KNOCKED OUT"}` → DEFEAT screen with
correct stats (`1:19 LEFT / 0% / 0–3`) → REMATCH → fresh ROUND 1, both at 100 HP,
squared up at the authored spawns.

## 5. Measurements the previous pass had to leave blank

Its table reads `Runtime FPS / draw calls / textures: Unmeasured`.

| Measurement | Value |
|---|---|
| Frame time p50 | **16.7 ms (60 Hz, vsync-locked)** |
| Draw calls | 196 |
| Rendered triangles (incl. shadow pass) | 108,544 |
| Geometries / textures / compiled materials | 39 / 6 / 125 |
| Authored assets / scene nodes / asset triangles | 36 / 66 / 51,712 |
| Asset build / presentation build | 98 ms / 46 ms |
| Unresolved assets | none |
| Rematch resource delta | geometries 0, textures 0, programs 0, scene children 0 |

**Caveat on the tail:** p95/p99 cannot be measured from this harness. The preview
pane throttles `requestAnimationFrame` to ~0.5 Hz whenever a tool call is in
flight, which injects 2000 ms frames into any sample that spans one. In a
continuous foreground window the rolling report read 60 fps with
p50/p95/p99 = 16.7 / 16.8 / 16.9 ms. Sustained frame pacing on an ordinary tab
is still not independently proven.

## 6. Finding worth recording: mouse punches require pointer lock

`handlers.mousedown` in `src/game/input/input-router.js` returns early unless
`pointerLocked`. That is correct design — the first click acquires the lock — but
it means that in any embedded context where pointer lock is refused (this preview
pane included), **the mouse cannot punch at all**. Keyboard, gamepad and the
touch door (`pushAction`/`pulse`) are unaffected. Not changed: altering it would
make the lock-acquiring click also throw a punch.

## 7. Still not proven

- Sustained frame pacing and GPU behaviour on a normal browser tab.
- Knockdown remains a root-body fall, not an articulated one.
- Fast direction reversals / large heading changes under player control.
- No on-screen touch controls, though the semantic layer accepts them.

## 8. Engine

No engine file was modified or deep-imported. `git status --porcelain -- engine`
is empty. 64/64 tests pass, production build succeeds.
