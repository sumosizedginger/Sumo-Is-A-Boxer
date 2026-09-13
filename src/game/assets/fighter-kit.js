/**
 * SUMO IS A BOXER — Fighter equipment and the first-person body.
 *
 * THE FIRST-PERSON HANDS ARE THE MOST-LOOKED-AT GEOMETRY IN THE GAME. They are
 * on screen every frame of the fight, a third of a metre from the camera. Two
 * cubes would sink the whole build, so they get a real forearm taper, a wrist
 * that narrows before the glove flares, wrap banding in the gap between wrap
 * and cuff, a thumb that sits where a thumb sits, a knuckle seam, a laced back
 * and a cuff strap.
 *
 * AUTHORING FRAME for the first-person arms: the limb runs along +Y from the
 * elbow at y = 0 to the glove nose near y = 0.5. The presentation layer rotates
 * that onto the camera's -Z so the same authored asset can be posed by
 * game-owned motion code without baking a pose into the mesh.
 */

import {
  place, rod, revolve, roundedBox, repeat, assemble, tube
} from './kit.js';
import { sculpt } from './sculpt.js';
import { skullShell, HAIR_SHELL_OFFSET, FADE_SHELL_OFFSET } from './skull-sections.js';
import { mat } from './materials.js';
import { createAnchor } from '@sumosizedginger/my-game-engine-1.0/full';

/** Where the glove's contact point sits in the authored frame. */
export const GLOVE_TIP_Y = 0.5;

/**
 * A boxing glove, authored along +Y with its cuff at `cuffY`.
 *
 * @param {object} options
 * @returns {object} Object of MeshIR groups.
 */
function gloveParts({ cuffY = 0.26, side = 1, scale = 1, prefix = 'glove' }) {
  const s = scale;
  const y = (v) => cuffY + v * s;

  // The mitt. Squashed on Z so it is wider across the knuckles than it is deep,
  // which is what makes it read as a glove instead of a sausage.
  const mitt = sculpt({name: prefix+'-mitt', segments: 32, sections: [
    [-.008,.047,.042,0,0], [.025,.069,.053,0,-.003], [.065,.082,.063,0,-.008],
    [.11,.092,.07,0,-.011], [.157,.094,.066,0,-.009], [.191,.086,.057,0,-.002],
    [.218,.062,.041,0,.003], [.234,.027,.018,0,.004], [.238,.001,.001,0,.004]
  ].map(([h,w,d,x,z])=>[y(h),w*s,d*s,x*s,z*s]),shape(p,{c,s:sn,y:height}) {
    p[0] += side*.004*s*sn;
    if(sn<0 && Math.abs(p[0])<.03*s && height>y(.012) && height<y(.118)) p[2]=Math.max(p[2],-.052*s);
    p[1] += .005*s*Math.cos(c*Math.PI)*Math.max(0,(height-y(.1))/(.138*s));
  }});
  const knuckle = tube({points:Array.from({length:25},(_,i)=>{
    const t=i/24*Math.PI; return [Math.cos(t)*.088*s,y(.171)+Math.sin(t)*.014*s,-.007*s-Math.sin(t)*.061*s];
  }),radius:.0027*s,segments:6,semanticName:prefix+'-welt'});

  // Thumb, angled off the inboard side.
  const thumb = place(
    revolve({
      profile: [[0.02 * s, 0], [0.032 * s, 0.02 * s], [0.034 * s, 0.06 * s], [0.026 * s, 0.085 * s], [0, 0.095 * s]],
      semanticName: `${prefix}-thumb`,
      segments: 10
    }),
    { at: [side * 0.062 * s, y(0.055), 0.018 * s], rotate: [0.25, 0, side * -0.85] }
  );

  // Cuff: flared collar with a wrist strap and a buckle tab.
  const cuff = revolve({
    profile: [
      [0.043 * s, y(-0.075)], [0.055 * s, y(-0.065)], [0.06 * s, y(-0.03)],
      [0.056 * s, y(-0.005)], [0.05 * s, y(0.004)]
    ],
    semanticName: `${prefix}-cuff`,
    segments: 14,
    squashZ: 0.9
  });
  const strap = place(
    roundedBox({ size: [0.13 * s, 0.045 * s, 0.055 * s], radius: 0.014 * s, semanticName: `${prefix}-cuff-strap` }),
    { at: [0, y(-0.045), -0.03 * s], rotate: [0.1, 0, 0] }
  );
  const buckle = place(
    roundedBox({ size: [0.03 * s, 0.026 * s, 0.016 * s], radius: 0.005 * s, semanticName: `${prefix}-cuff-buckle` }),
    { at: [side * 0.052 * s, y(-0.045), -0.026 * s] }
  );

  // The laces cross a leather tongue; eyelets end inside the raised leather edges.
  const tongue=place(roundedBox({size:[.047*s,.104*s,.009*s],radius:.004*s,semanticName:prefix+'-lace-tongue'}),{at:[0,y(.063),-.052*s],rotate:[-.14,0,0]});
  const web=place(roundedBox({size:[.046*s,.075*s,.046*s],radius:.02*s,semanticName:prefix+'-thumb-web'}),{at:[side*.06*s,y(.063),.018*s],rotate:[.2,0,-side*.4]});
  const laces=repeat(4,(i)=>tube({points:[[-.018*s,y(.017+i*.019),-.055*s],[0,y(.025+i*.019),-.058*s],[.018*s,y(.034+i*.019),-.057*s]],radius:.0025*s,segments:5,semanticName:prefix+'-lace-'+i}));
  return {leather:[mitt,cuff,thumb,web,tongue],trim:[knuckle,strap],hardware:[buckle],laces};
}

/**
 * A first-person arm: forearm, wrist wraps and glove.
 *
 * @param {object} options
 * @returns {object} MeshIR
 */
function buildFirstPersonArm({ id, side, leatherFamily, skinFamily }) {
  // Forearm, tapering from a heavy elbow to a narrow wrist.
  const forearm=sculpt({name:'fp-forearm-'+(side<0?'left':'right'),segments:32,sections:[
    [-.29,.078,.066,side*.013,0],[-.15,.073,.064,side*.008,0],[-.04,.066,.059],
    [.035,.071,.063,side*.004,-.005],[.085,.066,.057,side*.007,-.004],
    [.14,.055,.047,side*.009,0],[.185,.045,.036,side*.006,.002],
    [.22,.039,.031,side*.003,.003],[.242,.042,.032,side*.005,.003],[.265,.035,.031]
  ],shape(p,{y,c,s:sn}){
    p[0]+=side*.006*Math.max(0,c*side)*Math.exp(-1*((y-.095)/.065)**2);
    p[2]+=.003*Math.max(0,sn)*Math.exp(-1*((y-.23)/.025)**2);
  }});
  const wraps=repeat(6,i=>sculpt({name:'fp-wrap-band-'+(side<0?'left':'right')+'-'+i,segments:40,arc:Math.PI*2-.015,
    sections:[[.185+i*.011,.044-i*.0008,.036],[.19+i*.011,.046-i*.0008,.038],[.201+i*.011,.044-i*.0008,.036]],
    shape(p,{angle}){p[1]+=angle/(Math.PI*2)*.009;p[0]+=side*.003;}
  }));
  // The tail of the wrap tucked under itself.
  wraps.push(place(
    roundedBox({ size: [0.03, 0.012, 0.05], radius: 0.004, semanticName: `fp-wrap-tail-${side < 0 ? 'left' : 'right'}` }),
    { at: [side * 0.036, 0.222, 0.014], rotate: [0.2, 0, side * 0.5] }
  ));

  const glove = gloveParts({ cuffY: 0.26, side, scale: 1.05, prefix: `fp-glove-${side < 0 ? 'left' : 'right'}` });

  return assemble(id, [
    { name: `fp-forearm-${side < 0 ? 'left' : 'right'}`, material: mat(skinFamily, side), meshes: [forearm] },
    { name: `fp-hand-wraps-${side < 0 ? 'left' : 'right'}`, material: mat('wraps', side), meshes: wraps },
    { name: `fp-glove-leather-${side < 0 ? 'left' : 'right'}`, material: mat(leatherFamily, 0), meshes: glove.leather },
    { name: `fp-glove-trim-${side < 0 ? 'left' : 'right'}`, material: mat(leatherFamily, 2), meshes: glove.trim },
    { name: `fp-glove-laces-${side < 0 ? 'left' : 'right'}`, material: mat('wraps', 1), meshes: [...glove.laces, ...glove.hardware] }
  ], {
    anchors: [
      createAnchor({ name: 'arm.elbow', position: [0, 0, 0] }),
      createAnchor({ name: 'arm.wrist', position: [0, 0.255, 0] }),
      createAnchor({ name: 'glove.contact', position: [0, GLOVE_TIP_Y, 0] })
    ]
  });
}

/**
 * The opponent's glove, authored to hang off a Character Forge `hand_*` bone.
 *
 * Character Forge's skinned humanoid has one material for the whole body
 * (ENGINE_GAPS.md — GAP-07), so equipment that must read as a DIFFERENT
 * MATERIAL — leather, cloth, rubber — is authored here and attached to the
 * semantic bones the Forge exposes through `bonesByName`.
 *
 * @param {object} options
 * @returns {object} MeshIR
 */
function buildOpponentGlove({ id, side, leatherFamily }) {
  const label = side < 0 ? 'left' : 'right';
  const glove = gloveParts({ cuffY: 0.0, side, scale: 1.0, prefix: `boxer-glove-${label}` });
  const wrapCuff = repeat(3, (i, t) => revolve({
    profile: [[0.043, -0.1 + t * 0.03], [0.047, -0.094 + t * 0.03], [0.043, -0.086 + t * 0.03]],
    semanticName: `boxer-wrap-${label}-${i}`,
    segments: 10
  }));

  return assemble(id, [
    { name: `boxer-glove-leather-${label}`, material: mat(leatherFamily, 0), meshes: glove.leather },
    { name: `boxer-glove-trim-${label}`, material: mat(leatherFamily, 2), meshes: glove.trim },
    { name: `boxer-glove-laces-${label}`, material: mat('wraps', 2), meshes: [...glove.laces, ...glove.hardware, ...wrapCuff] }
  ], {
    anchors: [createAnchor({ name: 'glove.contact', position: [0, 0.24, 0] })]
  });
}

/**
 * The opponent's trunks: waistband, panel, side flash and hem.
 * Authored around the origin at the pelvis, to be attached to the pelvis bone.
 *
 * @param {object} options
 * @returns {object} MeshIR
 */
function buildTrunks({id,trimFamily}) {
  const waistband=sculpt({name:'boxer-waistband',sections:[[.08,.18,.141],[.105,.189,.145],[.165,.187,.143],[.18,.173,.135]],segments:32});
  // YOKE + INNER BAFFLE, in one surface.
  //
  // Two measured faults sat here. Sampling the pelvis-weighted skin against this
  // yoke in pelvis-bone space showed (a) the skin standing up to 6 mm OUTSIDE the
  // yoke across the front at y=0, and (b) no yoke geometry at all below y=-0.065,
  // where the torso loft's open bottom leaves bare skin at every one of the 17
  // sampled angles. Together they were the exposed groin band: the thigh cuffs
  // are mounted on the THIGH bones, so they swing away and cannot be asked to
  // close a hole that belongs to the pelvis.
  //
  // The fix is the real garment's: a pelvis-mounted inner panel that reaches well
  // below the hip and tucks inside the cuffs. The lower stations draw in so the
  // rim reads as an inner seam rather than a skirt hem, and it stays inside the
  // cuff envelope at the sides while remaining the visible fabric at the groin -
  // which is exactly what trunks do.
  const yoke=sculpt({name:'boxer-trunks-yoke',sections:[
    [-.125,.150,.118],[-.095,.182,.150],[-.065,.203,.168],[-.015,.199,.170],[.09,.184,.160]
  ],segments:32});
  return assemble(id,[{name:'boxer-trunks',material:mat('cloth',0),meshes:[yoke]},{name:'boxer-trunks-trim',material:mat(trimFamily,1),meshes:[waistband]}]);
}

function buildTrunkLeg(side) {
  const label=side<0?'left':'right';
  // An open outboard arc is the side slit. A doubled-back lower station makes a thick hem.
  // Widths carry a measured clearance over the posed thigh, not a guess. Sampling
  // the skinned hip band in thigh-bone space showed the flesh reaching r=0.135 at
  // y=-0.04 and 0.136 at y=-0.12, so the old 0.132/0.140 shell was 2.6mm INSIDE the
  // leg at the hip and 2.7mm clear below it - inside the faceting error of a 32-gon
  // shell over a 28-gon leg, which punched skin through the cloth. These stations
  // hold ~14mm, which also reads correctly: boxing trunks hang loose, not sprayed on.
  const sections=[[-.28,.142,.145],[-.267,.148,.15],[-.249,.146,.148],[-.14,.150,.150],[-.035,.149,.149],[.04,.132,.134]];
  const shell=sculpt({name:'trunk-leg-'+label,sections,segments:32,arc:Math.PI*2-.16,shape(p,{y,angle}){
    const fold=Math.cos(angle*7+.2)*.0025; p[0]*=1+fold/.13;
    p[1]+= .012*Math.cos(angle+.5)*(Math.max(0,-y)/.28);
  }});
  const hem=sculpt({name:'trunk-hem-'+label,sections:sections.slice(0,3),segments:32,arc:Math.PI*2-.16});
  const piping=tube({points:[[.13,.02,.016],[.144,-.12,.018],[.15,-.247,.018]],radius:.007,segments:6,semanticName:'trunk-side-piping-'+label});
  const meshes=[shell];
  return assemble('asset.boxer.trunks.'+label,[{name:'boxer-trunk-leg-'+label,material:mat('cloth',0),meshes},{name:'boxer-trunk-hem-'+label,material:mat('cornerRed',1),meshes:[hem,piping]}]);
}

/**
 * A boxing boot, authored at the ankle so it can be attached to `foot_*`.
 *
 * @param {object} options
 * @returns {object} MeshIR
 */
function buildBoot({id,side}) {
 const label=side<0?"left":"right";
  const upper=sculpt({name:'boot-upper-'+label,sections:[[-.055,.055,.072,0,.008],[0,.058,.062],[.055,.05,.047],[.12,.049,.044],[.195,.063,.052],[.215,.065,.054],[.221,.056,.046]],segments:24});
  const profile=[[-.10,.037,.024],[-.079,.052,.041],[-.03,.056,.058],[.02,.055,.052],[.09,.052,.035],[.155,.043,.025],[.19,.019,.012],[.197,.001,.001]];
  // Loft along the shoe's length, with the toe lifting away from the canvas.
  const foot=place(sculpt({name:'boot-instep-'+label,sections:profile.map(([z,w,h])=>[z,w,h,0,.064-(z>.095?(z-.095)*.28:0)-h]),segments:28}),{rotate:[Math.PI/2,0,0]});
  const sole=place(sculpt({name:'boot-rocker-sole-'+label,sections:profile.map(([z,w])=>[z,w+.003,.011,0,.067-(z>.095?(z-.095)*.28:0)]),segments:24}),{rotate:[Math.PI/2,0,0]});
  const heel=place(roundedBox({size:[.092,.024,.073],radius:.009,semanticName:'boot-heel-'+label}),{at:[0,-.065,-.062]});
  const tongue=place(roundedBox({size:[.049,.19,.022],radius:.012,semanticName:'boot-tongue-'+label}),{at:[0,.105,.046],rotate:[-.09,0,0]});
  const laces=repeat(5,i=>tube({points:[[-.026,.037+i*.033,.053],[0,.048+i*.033,.059],[.026,.059+i*.033,.053]],radius:.0028,segments:5,semanticName:'boot-lace-'+label+'-'+i}));
  return assemble(id,[{name:'boxer-boot-'+label,material:mat('leatherBlack',1),meshes:[upper,foot,tongue]},{name:'boxer-boot-sole-'+label,material:mat('rubber',0),meshes:[sole,heel]},{name:'boxer-boot-laces-'+label,material:mat('wraps',0),meshes:laces}]);
}

/**
 * Face and head detail for the opponent.
 *
 * Character Forge's humanoid head is a smooth lofted ellipsoid with no face: it
 * is a body, not a portrait (ENGINE_GAPS.md — GAP-13). At fighting distance
 * that reads as a mannequin, so the brow ridge, eye sockets, nose, ears, cropped
 * hair, taped eyebrow and mouthguard are authored here and attached to the
 * Forge's own `head` bone.
 *
 * Dimensions are derived from Character Forge's published head parameters
 * (0.046 * height * headScale across, 0.058 deep), not guessed, so the features
 * sit on the surface rather than floating off it or sinking in.
 *
 * @param {object} [options]
 * @returns {object} MeshIR
 */
function buildHeadDetail({ height = 1.86, headScale = 0.97 } = {}) {
  const rx = 0.046 * height * headScale;
  const rz = 0.058 * height * headScale;

  // CROPPED HAIR, AS A SHELL OVER THE SKULL THAT ACTUALLY SHIPS. The old cap was
  // a revolve sized from Character Forge's published head radii, but
  // athletic-body.js replaced that head with a wider, taller loft: the cap ran
  // 1.1 mm inside the temples and stopped 38 mm below the crown, so the skull
  // pushed through the top and the two surfaces z-fought everywhere they
  // crossed. Both now come off the same stations - see assets/skull-sections.js.
  // Clearances are measured, not guessed: the skull's own shape() pushes the
  // brow and cheek planes up to ~2 mm proud of its stations, so 5 mm left only
  // 1 mm at the fade band. 8 mm of hair over 5.5 mm of shaved fade clears the
  // skull everywhere AND keeps the two shells 2.5 mm apart where they meet,
  // which is still just cropped hair on a 1.86 m fighter, not a helmet.
  const hairSections = skullShell({ fromY: 1.78, toY: 1.86, offset: HAIR_SHELL_OFFSET });
  // Close the crown to a point rather than leaving the skull's open top rim.
  hairSections.push([0.1215, 0.0015, 0.0015, 0, -0.013]);
  const hair = sculpt({
    name: 'boxer-hair',
    sections: hairSections,
    segments: 24,
    // A hairline, not a bowl: high across the forehead, dropping at the nape.
    shape(p, { row, s }) { if (row === 0) p[1] -= Math.max(0, -s) * 0.03; }
  });
  // A shaved fade hugging the temples and nape below the hairline, closer in
  // than the hair so the two never trade places.
  const fade = sculpt({
    name: 'boxer-hair-fade',
    sections: skullShell({ fromY: 1.742, toY: 1.78, offset: FADE_SHELL_OFFSET }),
    segments: 24
  });

  // FEATURES SIT ON THE SURFACE, NOT ON TOP OF IT. Character Forge's head is a
  // loft that narrows away from its centre station, so a feature placed at the
  // full half-depth stands proud of the skull and reads as a bolted-on ledge.
  // Every depth below is a fraction of `rz` chosen to sink the feature into the
  // loft at the height it sits at, and every feature is small: at fighting
  // distance this head is 100 px tall, and the brow and the eye sockets are the
  // only two shapes that survive that.
  const brow = place(
    roundedBox({ size: [0.098, 0.017, 0.018], radius: 0.008, semanticName: 'boxer-brow-ridge' }),
    { at: [0, 0.024, rz * 0.88], rotate: [0.3, 0, 0] }
  );
  const nose = place(
    revolve({
      profile: [[0, 0.03], [0.009, 0.022], [0.014, 0.004], [0.016, -0.012], [0.011, -0.019], [0, -0.021]].reverse(),
      semanticName: 'boxer-nose',
      segments: 8,
      squashZ: 1.35
    }),
    { at: [0, -0.006, rz * 0.888], rotate: [Math.PI / 2 - 0.3, 0, 0] }
  );
  const ears = [
    place(revolve({ profile: [[0, 0], [0.011, 0.005], [0.016, 0.015], [0.014, 0.025], [0.008, 0.03], [0, 0.031]], semanticName: 'boxer-ear-left', segments: 8, squashZ: 1.5 }), { at: [rx * 0.9, -0.006, -0.014], rotate: [0, 0, -Math.PI / 2] }),
    place(revolve({ profile: [[0, 0], [0.011, 0.005], [0.016, 0.015], [0.014, 0.025], [0.008, 0.03], [0, 0.031]], semanticName: 'boxer-ear-right', segments: 8, squashZ: 1.5 }), { at: [-rx * 0.9, -0.006, -0.014], rotate: [0, 0, Math.PI / 2] })
  ];

  // Deep-set eyes. Two small dark recesses do more for a procedural face than
  // any amount of extra silhouette detail — provided they are RECESSES.
  const eyes = [
    place(roundedBox({ size: [0.023, 0.011, 0.011], radius: 0.004, semanticName: 'boxer-eye-left' }), { at: [0.031, 0.004, rz * 0.886], rotate: [0.12, 0.2, 0] }),
    place(roundedBox({ size: [0.023, 0.011, 0.011], radius: 0.004, semanticName: 'boxer-eye-right' }), { at: [-0.031, 0.004, rz * 0.886], rotate: [0.12, -0.2, 0] })
  ];
  const mouth = place(
    roundedBox({ size: [0.028, 0.007, 0.009], radius: 0.003, semanticName: 'boxer-mouth-line' }),
    { at: [0, -0.056, rz * 0.66], rotate: [0.35, 0, 0] }
  );

  // The tells of a man who has already been in one of these.
  const brow_tape = place(
    roundedBox({ size: [0.03, 0.01, 0.012], radius: 0.004, semanticName: 'boxer-brow-tape' }),
    { at: [0.036, 0.033, rz * 0.66], rotate: [0.28, -0.3, 0.22] }
  );
  const mouthguard = place(
    revolve({ profile: [[0.014, 0], [0.023, 0.005], [0.023, 0.013], [0.014, 0.017]], semanticName: 'boxer-mouthguard', segments: 8, squashZ: 0.55 }),
    { at: [0, -0.052, rz * 0.88], rotate: [Math.PI / 2 + 0.35, 0, 0] }
  );

  return assemble('asset.boxer.head.detail', [
    { name: 'boxer-hair', material: mat('hair', 0), meshes: [hair, fade] },
    { name: 'boxer-face-structure', material: mat('skin', 1), meshes: [brow, nose, ...ears] },
    { name: 'boxer-face-recesses', material: mat('concreteStain', 0), meshes: [...eyes, mouth] },
    { name: 'boxer-face-tape', material: mat('wraps', 0), meshes: [brow_tape, mouthguard] }
  ]);
}

/**
 * Builds every fighter-equipment asset.
 *
 * @returns {Map<string, object>}
 */
export function buildFighterKitAssets() {
  const assets = new Map();
  assets.set('asset.fp.arm.left', buildFirstPersonArm({ id: 'asset.fp.arm.left', side: -1, leatherFamily: 'leatherBlue', skinFamily: 'skinPlayer' }));
  assets.set('asset.fp.arm.right', buildFirstPersonArm({ id: 'asset.fp.arm.right', side: 1, leatherFamily: 'leatherBlue', skinFamily: 'skinPlayer' }));
  assets.set('asset.boxer.glove.left', buildOpponentGlove({ id: 'asset.boxer.glove.left', side: -1, leatherFamily: 'leatherRed' }));
  assets.set('asset.boxer.glove.right', buildOpponentGlove({ id: 'asset.boxer.glove.right', side: 1, leatherFamily: 'leatherRed' }));
  assets.set('asset.boxer.trunks.left', buildTrunkLeg(-1));
  assets.set('asset.boxer.trunks.right', buildTrunkLeg(1));
  assets.set('asset.boxer.trunks', buildTrunks({ id: 'asset.boxer.trunks', trimFamily: 'cornerRed' }));
  assets.set('asset.boxer.boot.left', buildBoot({ id: 'asset.boxer.boot.left', side: -1 }));
  assets.set('asset.boxer.boot.right', buildBoot({ id: 'asset.boxer.boot.right', side: 1 }));
  assets.set('asset.boxer.head.detail', buildHeadDetail());
  return assets;
}
