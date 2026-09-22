# Character reference pack

Approved images in [`references/visual/`](../references/visual/) are visual contracts. Do not invent placeholder binaries. The user supplies the pack.

Expected names:

| File | Subject | Status |
|---|---|---|
| `01-body-proportions.png` | Body proportions | Binary alias of 02 |
| `02-silhouette.png` | Silhouette | Supplied & verified (Authoritative visual contract) |
| `03-skeleton.png` | Skeleton | Not present locally |
| `04-helper-rig.png` | Helper rig | Not present locally |
| `05-landmarks.png` | Landmarks | Not present locally |
| `06-mass-map.png` | Mass map | Supplied & verified (Authoritative visual contract) |
| `07-soft-tissue.png` | Soft tissue | Binary alias of 06 |
| `08-wireframe.png` | Wireframe | Supplied & verified (Authoritative visual contract) |
| `09-deformation.png` | Deformation | Not present locally |
| `10-face.png` | Face | Supplied & verified (Authoritative visual contract) |
| `11-facial-wireframe.png` | Facial wireframe | Not present locally |
| `12-voxel-conversion.png` | Voxel conversion | Supplied & verified (Authoritative visual contract) |
| `13-density.png` | Density | Not present locally |
| `14-surface-behavior.png` | Surface behaviour | Not present locally |
| `15-deformation-concept.png` | Deformation concept | Not present locally |
| `16-clothing.png` | Clothing | Not present locally |
| `17-material.png` | Material | Not present locally |
| `18-png-projection.png` | PNG projection | Not present locally |
| `19-lighting.png` | Lighting | Not present locally |
| `20-north-star.png` | North star | Binary alias of 12 |

The supplied references in `references/visual/` form the authoritative visual contracts for VOXEL-HERO-003 convergence.



## Reference file identity

The supplied directory contains five unique image binaries. These filenames are duplicate aliases and are not independent reference views: `01-body-proportions.png` = `02-silhouette.png`; `06-mass-map.png` = `07-soft-tissue.png`; `12-voxel-conversion.png` = `20-north-star.png`. Visual coverage claims count each binary once.

SHA-256 identity was rechecked for the precision pass on 2026-09-21. The separate skeleton, helper-rig, landmark and deformation sheets are not present in this checkout; they were not counted as inspected references.
