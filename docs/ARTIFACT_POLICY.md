# Repository Artifact Policy

**Status**: Active  
**Scope**: All future work in `sumo-is-a-boxer` outside `engine/`.

## 1. Core Principle

Git history preserves past revisions. **The active working tree is not a museum.** Do not commit duplicate source snapshots, iteration screenshot dumps, or shadow trees.

## 2. What to Commit

- Source under `src/` and entry configs.
- Tests under `tests/`.
- Validation harnesses under `scripts/` and `src/game/validation/`.
- Small JSON manifests, certification, performance and test summaries.
- **3–10 representative captures** per accepted milestone, not 100+.

## 3. What NOT to Commit by Default

- Duplicate source trees in `artifacts/`.
- Giant raw video.
- Browser profiles, DevTools cache, CDP dumps.
- Ad-hoc capture scripts and scratch.
- Failed-run debris.
- Root screenshot dumps (`1.png`, clay/wireframe/pose captures).
- `artifacts/**/iteration-*`, `artifacts/**/scratch-*`, `artifacts/**/*.log`.
- `dist/`, `.vite/`, `coverage/`.

## 4. Milestone layout

```
artifacts/<milestone-id>/
  MANIFEST.json
  certification.json
  performance-summary.json
  test-summary.json
  <few representative pngs>
```
