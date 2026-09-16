# SUMO IS A BOXER

High-density **voxel sumo**, generated entirely in code on **My Game Engine 1.0**.

The project name stays SUMO IS A BOXER. The visual identity is sculptural voxel mass, not boxing equipment.

At gameplay distance the hero reads as a monumental 3D sculptural figure. At close range the cubic microstructure is unmistakable. The smooth body is **hidden guide geometry** (skeleton, regions, landmarks, skin weights). Visible art is Voxel Forge at `VOXEL_QUALITY.HERO` (0.012 m base unit cubes).

## Run it

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:5180** and click **CLICK TO FIGHT**.

```bash
npm test
npm run build
cd engine && npm test
```

Voxel inspection: `http://127.0.0.1:5180/?validation=voxel` (boots in `VOXEL_CLAY` mode).

Validation capture:
```bash
node scripts/capture-voxel-hero-002.mjs
```

## Controls

| Action | Keyboard / Mouse | Controller |
|---|---|---|
| Move | `WASD` | Left stick |
| Look | Mouse | Right stick |
| Sprint | `Shift` | `L3` |
| Jab | `LMB` | `X` / Square |
| Heavy | `RMB` | `RT` / `R2` |
| Block | `MMB`, or hold `RMB` | `LT` / `L2` |
| Dodge | `Space` | `A` / Cross |
| Guard high / low | `E` / `Q` | D-pad |
| Pause | `Esc` | Start |
| Rematch | `R` | View |
| Diagnostics | `` ` `` or `F1` | — |

Jab / cross / hook are **current gameplay attack identifiers**, not the art direction.

## Architecture

```
src/game/          game: combat, voxel hero, voxel arena, HUD
engine/            My Game Engine 1.0 (includes Voxel Forge)
docs/              canonical project documentation
references/visual/ approved external target sheets (user-supplied)
artifacts/         milestone certifications and captures
```

Public voxel APIs come from `@sumosizedginger/my-game-engine-1.0/full`.

See [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) and [docs/VOXEL_ART_DIRECTION.md](docs/VOXEL_ART_DIRECTION.md).

**Branch:** `game-build` (do not merge this work onto `main`).
