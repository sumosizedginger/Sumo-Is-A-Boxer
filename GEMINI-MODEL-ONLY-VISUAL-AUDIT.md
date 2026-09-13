# GEMINI MODEL-ONLY VISUAL AUDIT PROMPT

Independently audit CHARACTER-CEILING-001. The only question is: HOW GOOD ARE
THE MODELS? Judge high-end stylized realism against conventionally authored
premium game characters. Do not grade the programming accomplishment.

Open the actual live build. On the build machine the server is
http://127.0.0.1:5180/?validation=models. If needed, run
`npm run dev -- --host 127.0.0.1 --port 5180 --strictPort` in D:\Boxing on
game-build. For a separately hosted copy, append `?validation=models` to its
actual URL. Do not assume that pushing this branch deployed a public website.

The builder had no available browser and supplied no rendered screenshots or
GPU measurements. Do not substitute source inspection or passing tests for
rendered evidence. If you cannot open a functioning rendered build, report
BLOCKED and do not invent scores.

Use the on-screen state menu, motion slider, orbit slider, Play/Pause, Rotate,
Face, Full body, Neutral light and Ring light controls. HUD, damage vignette,
combat flashes, particles and environment geometry are suppressed. Neutral
lighting is plain white key/fill plus a contact plane. Repeat critical checks
under the original ring lights. Neither lighting setup excuses bad forms.

The console API is:

```js
const game = window.__SUMO_IS_A_BOXER__;
const m = game.validation.models;
m.states;
m.show('front_neutral');
m.focus('face'); // also 'torso' or 'body'
m.orbit(60); // degrees, full rotation supported
m.rotate(true); // continuous orbit; false stops it
m.show('jab_extension');
m.play();
m.pause();
m.scrub(0.5); // deterministic progress, preserves inspection view
m.lighting('neutral'); // or 'ring'
m.controls(false); // true restores controls
m.capture(); // PNG data URL of the canvas
m.metrics();
await m.sample(5000); // foreground RAF timing in the current presentation
game.validation.diagnostics(); // shader/link/GL errors
```

Inspect every opponent state:
front_neutral, rear_neutral, left_profile, right_profile,
three_quarter_front, three_quarter_rear, high_guard, low_guard,
jab_extension, cross_extension, deep_elbow_flex, deep_knee_flex,
torso_twist, head_reaction, body_reaction, wide_stance, close_stance.

Inspect every player state:
fp_neutral, fp_high_guard, fp_low_guard, fp_jab_extension,
fp_cross_extension, fp_block, fp_glove_closeup, fp_forearm_closeup.

Rotate around the opponent. Inspect front, back, both profiles and three-quarter
angles. Inspect the face close up and again at fighting distance. Inspect the
actual moving jab, cross, recoveries and reactions using Play and scrub. Pause
at maximum flex and intermediate frames, not just the attractive endpoints.
Check shoulder/armpit seams, neck/clavicle continuity, elbows, hips, crotch,
trunk-panel overlaps, knees, cuff connections and canvas contact. Inspect both
first-person arms for wrist transitions, distortion and clipping through their
full attack and block paths. Return to the normal game URL without the query
to check real first-person framing and motion in combat as well.

Ignore environment quality, atmosphere, HUD, game-design quality and how
impressive procedural generation is technically. Give NO bonus points because
the models are code-generated. Do not self-limit expectations to the engine.

Score EACH category independently from 0 to 10. Include concise rendered
evidence and the relevant state/view for every score:

1. Head / face anatomy
2. Facial identity
3. Skull silhouette
4. Ears
5. Hair/scalp
6. Neck anatomy
7. Clavicle/traps
8. Shoulder construction
9. Torso anatomy
10. Back anatomy
11. Arm anatomy
12. Elbow deformation
13. Forearm anatomy
14. Wrist transition
15. Gloves
16. Trunks
17. Pelvis/hip transition
18. Leg anatomy
19. Knee deformation
20. Calves/ankles
21. Boots
22. Skin material
23. Cloth material
24. Leather material
25. Asymmetry
26. Silhouette
27. Stance/weight
28. Guard pose
29. Jab
30. Cross
31. Hit reactions
32. Deformation under motion
33. First-person forearms
34. First-person gloves
35. Overall character cohesion
36. AAA-stylized readiness

Use 0 for broken/unusable, 5 for visibly mediocre, 8 for strong premium-game
quality with identifiable remaining flaws, and 10 only for exceptional finished
work. Do not average away a face, shoulder or garment failure.

Then provide TOP 10 REMAINING MODEL DEFECTS, ordered by visual severity.
For EVERY defect provide:

- Exact body region and side.
- State, orbit/view, motion progress and a capture if possible.
- What visually looks wrong.
- Why it looks procedural or amateur.
- What a high-end character would do differently.
- Responsible category: geometry, material, rigging, deformation, proportion,
  animation, or an explicitly identified combination.
- Recommended correction, precise enough for the next build order.

Pay special attention to the known unverified risks: separate loft surfaces
at shoulder/neck junctions, scalar rather than direction-specific correctives,
rigid facial features, absence of cloth collision, upper garment overlap under
deep hip flex, and first-person camera/FOV intersections. Find additional
defects independently. These are leads, not the limits of your review.

DO NOT SAY "good for procedural", "impressive for code-generated",
"considering the engine", or "technically impressive". Those are irrelevant.
Judge the rendered character as though it were sitting next to conventionally
authored game characters. If it looks mediocre, say mediocre. If a shoulder
looks wrong, say exactly why. If the face looks generic, say exactly why. If
something would not ship in a premium game, call it out. Do not protect the
builder's feelings. End with a clear model-only readiness verdict and the
defects that prevent shipment. Do not implement any changes.
