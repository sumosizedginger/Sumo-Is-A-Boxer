# Repository Artifact Policy

**Status**: Active  
**Scope**: All future work in `sumo-is-a-boxer` outside `engine/`.

---

## 1. Core Principle
Git history preserves all past revisions of source code. **Do not commit duplicate source snapshots or shadow trees.** The repository working tree must contain only active source, reproducible tests, deterministic validation tooling, and essential reference metadata.

---

## 2. What to Commit

- **Source Code**: All authoritative runtime source under `src/` and entry configs (`package.json`, `vite.config.js`, etc.).
- **Tests**: All automated headless and integration test specifications under `tests/`.
- **Validation Harnesses**: Reusable, deterministic validation code under `scripts/` and `src/game/validation/`.
- **Manifests & Hashes**: Small, reproducible JSON manifests, timing telemetry, and engine hash records.
- **Benchmark Summaries**: Concise numerical comparison JSON and summary markdown reports.
- **Representative Visual Evidence**: Selected, essential paired comparison screenshots when required by an accepted milestone.

---

## 3. What NOT to Commit by Default

- **Duplicate Source Trees**: Never copy historical "before" source folders into `artifacts/`. Rely on Git commits.
- **Giant Raw Video**: Never commit raw multi-megabyte `.webm`, `.mp4`, or video streams. Record frame data, hashes, and timing in JSON manifests.
- **Temporary Browser Data**: Browser profiles, DevTools cache, and CDP session dumps (`*boxing-audit-*/`, `*boxing-phase1-*/`).
- **Temporary Audit Scripts & Scratch**: Ad-hoc capture scripts and local scratch files created during reviews.
- **Failed-Run Debris**: Intermediate error dumps, aborted crash logs, or partial test artifacts (`boot_failure.json`, etc.).
- **Redundant Visual Clutter**: Manual unreferenced screenshots dumped in the root directory.
- **Local Build & Coverage Output**: `dist/`, `.vite/`, `coverage/`, or transient agent logs.
