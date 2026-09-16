# Voxel art direction

**Status:** IMPLEMENTED as project law for VOXEL-HERO-002.

## Laws

1. **SUMO SHAPE & MASS.** Huge hemispherical abdomen projecting +0.44m, massive ribcage (+0.37m lat, +0.33m depth), thick waist and flank pads, broad pelvis, heavy glutes, colossal thighs (0.36m radius), heavy calves, grounded ankles, thick muscular neck, low centre of gravity. No bodybuilder V-taper. No conventional boxer physique.
2. **VOXEL UNIT LAW.** One base unit cube dimension for HERO quality (`VOXEL_QUALITY.HERO` = 0.012 m). Cubes remain rigid, uniform, isotropic unit cubes without arbitrary stretch or non-uniform scaling.
3. **OCCUPANCY & 6-NEIGHBOR EXTRACTION.** Full interior volume flood-fill with complete enclosed interior cell rejection. Only boundary surface cubes with visible exposed faces are rendered.
4. **HIGH DENSITY & SCULPTURAL INTEGRITY.** At gameplay distance the silhouette reads as a monumental, powerful, coherent 3D figure. At close inspection, the crisp cubic microstructure is unmistakable.
5. **FACIAL VOLUME & PLANE BREAKS.** 3D sculpted cranial and facial form: prominent brow shelf, recessed orbital sockets, multi-tier stepped nose (root, bridge, tip, nostrils), massive cheek volumes, broad heavy jaw, square chin projection, submental double-chin neck fold.
6. **DEDICATED SUMO PRESENTATION POSE.** Use `sumo_neutral`: wide grounded stance, flexed knees, relaxed outward/downward arms with natural elbow flare, visible hands, chest facing front.
7. **NO MINECRAFT.** Not coarse cubic worlds, not 16³ block heads.
8. **NO ROBLOX.** Not rounded plastic primitives or pill shapes.
9. **NO BOXING MOTIF.** No gloves, trunks, boots, ropes, turnbuckles, canvas, corner padding, or red/blue corner dressing.
10. **NO SMOOTH CHARACTER AS FINAL RENDER.** The certified guide mesh is hidden (`character.material.visible = false`). The visible rendered hero is exclusively the Voxel Forge artifact.
11. **NEUTRAL CLAY & SILHOUETTE TRUTH.** Form and silhouette outrank texture tricks. Neutral 3-point studio lighting, matte terracotta/sandstone clay tones, and pure binary silhouette evaluation modes.
12. **REFERENCE IMAGES ARE AUTHORITATIVE.** Approved visual reference sheets (`references/visual/`) define anatomical proportions, planes, and edge flow.
