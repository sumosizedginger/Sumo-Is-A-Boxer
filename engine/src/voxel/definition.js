/**
 * My Game Engine 1.0 — Voxel Forge: Definition & Quality
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Renderer-independent parameter domain for native voxel artifacts.
 * Earned by VOXEL-PIVOT-001.
 */

export const VOXEL_ARTIFACT_VERSION = 1;

/**
 * Named quality levels. HERO is the visual ceiling and must not be quietly
 * coarsened to hide cost. voxelSize is metres per cell edge.
 */
export const VOXEL_QUALITY = Object.freeze({
  COARSE: Object.freeze({ name: 'COARSE', voxelSize: 0.12 }),
  MEDIUM: Object.freeze({ name: 'MEDIUM', voxelSize: 0.06 }),
  HIGH: Object.freeze({ name: 'HIGH', voxelSize: 0.028 }),
  HERO: Object.freeze({ name: 'HERO', voxelSize: 0.012 })
});

export const VOXEL_PARAMETER_BOUNDS = Object.freeze({
  voxelSize: Object.freeze({ min: 0.004, max: 0.5, default: VOXEL_QUALITY.HIGH.voxelSize }),
  fillInterior: Object.freeze({ default: false }),
  quality: Object.freeze({
    values: Object.freeze(Object.keys(VOXEL_QUALITY)),
    default: 'HIGH'
  })
});

const QUALITY_NAMES = new Set(Object.keys(VOXEL_QUALITY));

/**
 * Resolves voxel parameters against the published bounds.
 *
 * @param {object|string} [input]
 * @returns {{ parameters: object, diagnostics: Array<object> }}
 */
export function resolveVoxelParameters(input = {}) {
  const diagnostics = [];
  const raw = typeof input === 'string' ? { quality: input } : (input && typeof input === 'object' ? input : {});
  let qualityName = raw.quality ?? VOXEL_PARAMETER_BOUNDS.quality.default;
  if (!QUALITY_NAMES.has(qualityName)) {
    diagnostics.push({
      severity: 'WARN',
      code: 'VOXEL_UNKNOWN_QUALITY',
      message: `Unknown quality "${qualityName}", falling back to HIGH`
    });
    qualityName = 'HIGH';
  }

  const quality = VOXEL_QUALITY[qualityName];
  let voxelSize = raw.voxelSize != null ? Number(raw.voxelSize) : quality.voxelSize;
  if (!Number.isFinite(voxelSize) || voxelSize <= 0) {
    diagnostics.push({
      severity: 'WARN',
      code: 'VOXEL_INVALID_SIZE',
      message: `Invalid voxelSize ${raw.voxelSize}, using quality default ${quality.voxelSize}`
    });
    voxelSize = quality.voxelSize;
  }
  const { min, max } = VOXEL_PARAMETER_BOUNDS.voxelSize;
  if (voxelSize < min || voxelSize > max) {
    diagnostics.push({
      severity: 'WARN',
      code: 'VOXEL_SIZE_CLAMPED',
      message: `voxelSize ${voxelSize} clamped to [${min}, ${max}]`
    });
    voxelSize = Math.min(max, Math.max(min, voxelSize));
  }

  const fillInterior = raw.fillInterior === true;

  return {
    parameters: Object.freeze({
      quality: qualityName,
      voxelSize,
      fillInterior
    }),
    diagnostics
  };
}

/**
 * Builds a serializable voxel definition.
 *
 * @param {object} [options]
 * @returns {object}
 */
export function createVoxelDefinition({
  id = 'voxel.untitled',
  quality = 'HIGH',
  voxelSize = null,
  fillInterior = false,
  provenance = null,
  sourceGuideId = null
} = {}) {
  if (!id || typeof id !== 'string') {
    throw new TypeError('createVoxelDefinition requires a non-empty string id');
  }
  const { parameters, diagnostics } = resolveVoxelParameters({
    quality,
    voxelSize: voxelSize == null ? undefined : voxelSize,
    fillInterior
  });
  return Object.freeze({
    type: 'voxel',
    id,
    version: VOXEL_ARTIFACT_VERSION,
    data: Object.freeze({
      parameters,
      sourceGuideId: sourceGuideId ?? null,
      provenance: provenance ? Object.freeze({ ...provenance }) : null
    }),
    diagnostics: Object.freeze(diagnostics.slice())
  });
}
