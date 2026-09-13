# VISUAL-QUALITY-002 — defect cleanup + commercial polish

STATUS: **BUILT — AWAITING INDEPENDENT VISUAL VALIDATION**

Local inspection URL: http://127.0.0.1:5180 (`npm run dev`)

Scope was the six listed defect/polish items. The ring, warehouse and lighting
rig were left alone entirely — not one lighting value, rope, or warehouse asset
was retuned in this pass.

## 1. Files modified

```
src/game/assets/skull-sections.js    NEW - shared skull loft + shell helpers
src/game/assets/fighter-kit.js       hair/fade shells, trunks yoke + inner baffle
src/game/character/athletic-body.js  joint support loops, in-skin masses, smooth weights
src/game/character/player-fists.js   layered viewmodel idle
src/game/character/opponent-boxer.js shoulder reaction, body-shot guard collapse
src/game/presentation/vfx.js         particle size / blend / cone / envelope
src/game/app.js                      tiered impact bursts
tests/visual-quality.test.js         +3 regressions
```

## 2. Scalp z-fighting — FIXED

Cause, measured rather than assumed. The hair was a revolve sized from Character
Forge's published head radii (aspect 1.26), but `athletic-body.js` had replaced
that head with its own loft of aspect ~1.10. Sampling hair vertices against
head-weighted skin vertices in `head`-bone space:

| head-local y, angle | hair r | skull r | gap |
|---|---:|---:|---:|
| 0.06, temple | 0.0858 | 0.0870 | **-1.1 mm** |
| 0.06, adjacent | 0.0837 | 0.0835 | +0.2 mm |
| 0.06, front-quarter | 0.1157 | 0.1076 | +8.0 mm |

Sub-millimetre coincidence across a wide band — textbook z-fighting. The cap
also stopped at head-local 0.079 while the skull reached 0.117, so the crown
pushed straight through the top and only the crossing band rendered at all.

Fix: both surfaces now derive from one table (`assets/skull-sections.js`).
`skullShell()` returns a shell following the shipped skull at a fixed clearance —
hair 8 mm, fade 5.5 mm, keeping the two shells 2.5 mm apart where they meet.
Re-measured in the running game: **0 overlapping bins of 35, minimum clearance
3.5 mm**. The skull's own `shape()` brow/cheek displacement eats ~2 mm, which is
why 5 mm was not enough and why the clearances are what they are.

Verified by eye from front, three-quarter and **above** — the overhead view is
the strictest and is clean.

## 3. Trunks / waistband gap — FIXED

Two separate causes, both measured in `pelvis`-bone space:

- pelvis-weighted skin stood up to **6 mm outside** the yoke across the front;
- below pelvis-local -0.065 there was **no yoke geometry at all** — 17 of 17
  sampled angles uncovered, because the torso loft's open bottom ends there.

The thigh cuffs are mounted on the *thigh* bones, so they swing away and cannot
close a hole that belongs to the pelvis. Fixed with the architecture the brief
asks for: the yoke is now a pelvis-mounted panel reaching to pelvis-local -0.125,
drawing inward at the bottom so the rim reads as an inner seam rather than a
skirt hem. Overlap with the cuffs measures **124-146 mm**, past the 60-100 mm
target, and it stays inside the cuff envelope at the sides while being the
visible fabric at the groin — which is what trunks do.

Verified with the skin tinted so any exposure is unmistakable: idle, wide stance,
and frozen mid-cross. No gap.

## 4. Joint deformation — IMPROVED

Both joints had **three** rings across a **linear** weight ramp. The linear ramp
is the real culprit: it collapses to a hinge crease regardless of ring count.

- Elbow: 3 to 6 rings across the flexion band; blend 0.075 to 0.100 m, smoothstep.
- Knee: 3 to 6 rings; blend 0.085 to 0.108 m, smoothstep.
- Olecranon and patella authored **into the skin** via the loft's `shape()`, not
  as rigid shells, so they cannot detach under flexion. Hamstring fullness added
  above the knee.

Skin cost: **4,800 to 5,360 triangles (+11.7%)**. Verified at 62, 85 and 120 degrees.

## 5. First-person idle life — IMPROVED

The old idle was a single 3 mm sine, and both sway terms multiply by `movement`,
so a standing guard was very nearly frozen. Now layered: a breath from two
incommensurate periods, plus per-hand drift and settle on two further periods,
all scaled by `idleAmount` which falls away with speed and with hit shove, so
idle blends continuously into walk, sprint, dodge, attack and block.

Measured over a quiet window (no damage taken):

| | before | after |
|---|---|---|
| left/right Y correlation | ~1.0 (one shared sine) | **-0.37** |
| amplitude | 3 mm, shared | 0.6-7 mm, per hand |

## 6. Impact particles — RETUNED

Old: 24 mm, opaque, `NormalBlending`, 0.25-0.7 s life, near-hemisphere cone,
colour destructively multiplied down each frame. That is the confetti.

New: **9 mm, additive**, 0.12-0.28 s, cone tightened from `dir*0.8 + rand*0.32`
to `dir*1.0 + rand*0.16`, drag 3.2 to 5.4, and an attack-decay envelope
recomputed each frame from a stored emitted colour (`srcCol`) instead of
accumulating. Tiers: jab 3, cross 5, counter-or-heavy-head 8. Block 2,
guard-break 9. Pool unchanged at 96; no per-hit allocation.

Verified live: 8 particles from one hit, clustered in a ~0.1 m cone at head
height, per-particle luminance 0.03-0.36 — fading, not full-bright.

## 7. Hit reactions — EXTENDED

The propagation chain already existed (fast `reaction` for head/chest, slower
`follow` for pelvis/spine) and nothing rotates the whole body, so that part was
already correct. Two links were missing and are now added:

- **Shoulder.** Head shots ran neck to head and skipped the shoulders. The near
  shoulder now lifts and rolls back; the far one trails at 45%.
- **Guard collapse.** On a body shot both hands drop and drift in, carried back
  up by the slower recovery — so it rides `follow`, not `reaction`. Applied to
  scratch copies so the blended pose targets are never mutated.

Hit-stop untouched: jab 20 ms, cross 45 ms, cap 55 ms.

## 8. Performance

| | before | after |
|---|---:|---:|
| fps (foreground) | 60 | **60.1** |
| p50 / p95 / p99 frame ms | 16.8 / - / - | **16.7 / 17.1 / 17.5** |
| CPU submit per render | - | **0.439 ms** |
| draw calls | 230 | 211 |
| rendered triangles | 126,616 | 118,372 |
| geometries / textures | 37 / 6 | 39 / 6 |
| materials / compiled | 114 / 125 | 114 / 125 |
| authored assets / scene tris | 36 / 51,712 | 36 / 51,712 |
| opponent skin triangles | 4,800 | 5,360 |

Draw calls and rendered triangles are frustum-dependent and the two readings were
taken mid-fight from different camera positions; they are not a like-for-like
delta. Frame pacing is the meaningful number and it is unchanged.

## 9. Tests and build

`npm test` — **67 pass, 0 fail** (64 before; +3 regressions). The scalp test was
verified to actually bite: dropping `HAIR_SHELL_OFFSET` to 0.001 fails the suite,
restoring it passes. Clearances are exported constants used by both the asset and
the test, so lowering them back into z-fighting range fails the suite rather than
the eye.

`npm run build` — clean, 751.21 kB / 205.57 kB gzip (was 749.45 / 204.79).

## 10. Engine gaps

**No new gaps.** Nothing in this pass was blocked by a public engine API; every
fix was game-owned geometry, material or motion. Worth noting for the record: the
scalp drift is a downstream consequence of the existing GAP-07/GAP-13 — the game
must replace Character Forge's head wholesale to get a face, after which nothing
in the engine keeps game-authored head equipment in sync with the replacement.
The new shared section table is the game-local answer.

`engine/` untouched — `git status --porcelain -- engine` is empty.

## 11. Known defects / not proven

- Frame-pacing tail (p95/p99) is only trustworthy while the preview pane is
  foreground; it throttles rAF to ~0.5 Hz whenever a tool call is in flight.
- Knockdown is still a root-body fall, not an articulated one.
- The hair/fade seam is visible at ~0.8 m and gone by 2 m; not chased.
- Foot sliding under fast direction reversals was not re-examined in this pass.
- Impact particles are deliberately subtle; the evidence for them is numeric as
  much as visual at this pane resolution.
- Screenshot captures in this harness lag the rendered frame by one step, so the
  knockdown camera drop was confirmed by state and by an earlier capture rather
  than in the same frame as the event.
