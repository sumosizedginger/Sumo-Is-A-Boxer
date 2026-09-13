# VQ-003 Phase 1 Controlled Runtime Telemetry Report

**Target**: `http://localhost:5180`  
**Test Type**: Controlled In-Focus Foreground A/B Measurement  
**Verification Tool**: Live Engine Telemetry via `window.__SUMO_IS_A_BOXER__.report()` & WebGL Context  

---

## 1. Runtime Telemetry Table (Foreground Settled)

| Field | Detail OFF | Detail ON | DELTA (ON - OFF) |
| :--- | :--- | :--- | :--- |
| **FPS** | 60.0 | 60.0 | **0.0** |
| **p50 Frame Time** | 16.7 ms | 16.7 ms | **0.0 ms** |
| **p95 Frame Time** | 16.8 ms | 16.8 ms | **0.0 ms** |
| **p99 Frame Time** | 16.8 ms | 16.8 ms | **0.0 ms** |
| **Draw Calls** | 168 | 168 | **0** |
| **Rendered Triangles** | 95,720 | 95,720 | **0** |
| **Scene Triangles** | 51,712 | 51,712 | **0** |
| **Skin Triangles** | 13,828 | 13,828 | **0** |
| **Geometries** | 37 | 37 | **0** |
| **Textures** | 12 | 12 | **0** |
| **Programs** | 12 | 12 | **0** |
| **Scene Materials** | 128 | 128 | **0** |
| **Compiled Materials** | 125 | 125 | **0** |
| **Texture Memory Estimate** | 3,145,732 bytes (~3.15 MB) | 3,145,732 bytes (~3.15 MB) | **0 bytes** |
| **Procedural Generation Ms** | 115.1 ms | 115.1 ms | **0.0 ms** |
| **Asset Build Ms** | 33 ms | 33 ms | **0.0 ms** |
| **Presentation Build Ms** | 12 ms | 12 ms | **0.0 ms** |
| **First Frame Timing** | 52 ms | 52 ms | **0.0 ms** |
| **First Frame Since Nav** | 48 ms | 48 ms | **0.0 ms** |

---

## 2. Procedural Material State

- **`proceduralMaterials.enabled`**: `false` (OFF) $\rightarrow$ `true` (ON)
- **`generated map count`**: `6` (`canvas`, `leather`, `skin`, `concrete`, `steel`, `canvasHistory`)
- **`seed`**: `310903`
- **`generationMs`**: `115.1 ms`
- **Total GPU Footprint**: `3.15 MB` VRAM

---

## 3. Shader & WebGL Diagnostics

- **`gl.getError()`**: `0` (`gl.NO_ERROR`)
- **Shader Compilation Errors**: `0`
- **Shader Linking Errors**: `0`
- **WebGL Warnings**: `0`
- **Uniform Errors**: `0`
- **Verdict**: **CLEAN**

---

## 4. Rematch Resource Stability Test (3 Consecutive Full Cycles)

- **Execution**: 3 full `sumo.match.reset(seed)` cycles executed with seeds `1111`, `2222`, `3333` with 1.2s settle time between cycles.
- **Pre-Test Baseline**:
  - `geometries`: 37
  - `textures`: 12
  - `programs`: 12
- **Post-Test (After 3 Rematches)**:
  - `geometries`: 37
  - `textures`: 12
  - `programs`: 12
- **Net Delta**:
  - `geometries delta`: **0**
  - `textures delta`: **0**
  - `programs delta`: **0**
- **Lifecycle Verdict**: **PASS** (Zero resource leakage)
