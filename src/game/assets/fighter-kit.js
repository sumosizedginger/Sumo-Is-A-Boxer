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
import { buildFighterFace } from './fighter-face.js';
import { bell, sampleSections } from '../character/anatomy-fields.js';
import { sculpt } from './sculpt.js';
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
  const mitt = sculpt({name: prefix+'-mitt', segments: 56, sections: sampleSections([
    [-.008,.047,.042,0,0], [.025,.069,.053,0,-.003], [.065,.082,.063,0,-.008],
    [.11,.092,.07,0,-.011], [.157,.094,.066,0,-.009], [.191,.086,.057,0,-.002],
    [.218,.062,.041,0,.003], [.234,.027,.018,0,.004], [.238,.001,.001,0,.004]
  ].map(([h,w,d,x,z])=>[y(h),w*s,d*s,x*s,z*s]),.006*s),shape(p,{c,s:sn,y:height}) {
    const h=(height-cuffY)/s;
    const compression=bell(h,.028,.030)*Math.max(0,-sn);
    const crease=.0015*s*Math.sin((h+side*p[0]*.6)*205)*compression;
    p[2]+=sn*crease;
    p[0] += side*.004*s*sn;
    p[2]-=.0025*s*Math.max(0,sn)*bell(h,.185,.029)*bell(p[0]/s,side*.021,.050);
    p[0]+=side*.0014*s*bell(h,.13,.055);
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
      segments: 24
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
    segments: 32,
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
  const forearm=sculpt({name:'fp-forearm-'+(side<0?'left':'right'),segments:48,sections:sampleSections([
    [-.29,.078,.066,side*.013,0],[-.15,.073,.064,side*.008,0],[-.04,.066,.059],
    [.035,.071,.063,side*.004,-.005],[.085,.066,.057,side*.007,-.004],
    [.14,.055,.047,side*.009,0],[.185,.045,.036,side*.006,.002],
    [.22,.039,.031,side*.003,.003],[.242,.042,.032,side*.005,.003],[.265,.035,.031]
  ],.010),shape(p,{y,c,s:sn}){
    p[2]+=.005*Math.max(0,-sn)*bell(y,.055,.070)*Math.abs(c);
    p[0]-=side*.0035*Math.max(0,-side*c)*bell(y,.13,.08);
    p[2]+=.0025*Math.max(0,sn)*bell(p[0],side*.015,.010)*bell(y,.17,.06);
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
    segments: 28
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
  const waistband=sculpt({name:'boxer-waistband',sections:sampleSections([[.08,.18,.141],[.105,.189,.145],[.165,.187,.143],[.18,.173,.135]],.006),segments:80,shape(p,{angle,y,c,s}){
    const gather=.0018*Math.cos(angle*29)*bell(y,.12,.04);p[0]+=c*gather;p[2]+=s*gather;
  }});
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
  const yoke=sculpt({name:'boxer-trunks-yoke',sections:sampleSections([
    [-.125,.150,.118],[-.095,.182,.150],[-.065,.203,.168],[-.015,.199,.170],[.09,.184,.160]
  ],.009),segments:64,shape(p,{y,c,s}){
    const fold=.0035*bell(Math.abs(p[0]),.07+(y+.09)*.3,.026)*bell(y,-.015,.1);
    p[2]+=Math.sign(s)*fold;
    p[2]+=.003*Math.max(0,-s)*bell(y,-.025,.08);
  }});
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
  // Folds originate at waistband tension and relax into the hanging panel.
  function clothShape(p,{y,angle,c,s}) {
    const front=Math.max(0,s),back=Math.max(0,-s),hang=Math.max(0,Math.min(1,-y/.28));
    const fold=.0038*bell(angle,1.12+hang*.26+side*.05,.16)
      +.0028*bell(angle,2.17-hang*.15,.19)+.0024*bell(angle,4.5+hang*.25,.22);
    p[0]+=c*fold;p[2]+=s*fold;
    p[2]+=.003*front*bell(y,-.16,.07)+.003*back*bell(y,-.11,.10);
    p[1]+=.009*Math.cos(angle+.5)*hang;
  }
  const frontPanel=sculpt({name:'trunk-front-panel-'+label,sections:sampleSections(sections,.009),segments:32,arc:Math.PI,shape:clothShape});
  const backPanel=sculpt({name:'trunk-back-panel-'+label,sections:sampleSections(sections,.009),segments:32,arc:Math.PI-.16,shape(p,ctx){
    p[0]=-p[0];p[2]=-p[2];clothShape(p,{...ctx,angle:ctx.angle+Math.PI,c:-ctx.c,s:-ctx.s});
  }});
  const hem=sculpt({name:'trunk-hem-'+label,sections:sampleSections(sections.slice(0,3),.004),segments:64,arc:Math.PI*2-.16,shape:clothShape});
  const piping=tube({points:[[.138,.02,.0],[.151,-.10,.0],[.149,-.20,.0],[.145,-.266,.0]],radius:.0032,segments:8,semanticName:'trunk-side-piping-'+label});
  const inseam=tube({points:[[-.136,.02,.002],[-.151,-.11,.003],[-.150,-.21,.003],[-.143,-.278,.003]],radius:.0014,segments:6,semanticName:'trunk-inseam-'+label});
  const meshes=[frontPanel,backPanel];
  return assemble('asset.boxer.trunks.'+label,[{name:'boxer-trunk-leg-'+label,material:mat('cloth',0),meshes},{name:'boxer-trunk-hem-'+label,material:mat('cornerRed',1),meshes:[hem,piping,inseam]}]);
}

/**
 * A boxing boot, authored at the ankle so it can be attached to `foot_*`.
 *
 * @param {object} options
 * @returns {object} MeshIR
 */
function buildBoot({id,side}) {
 const label=side<0?"left":"right";
  const upper=sculpt({name:'boot-upper-'+label,sections:sampleSections([[-.055,.055,.072,0,.008],[0,.058,.062],[.055,.05,.047],[.12,.049,.044],[.195,.063,.052],[.215,.065,.054],[.221,.056,.046]],.006),segments:40,shape(p,{y,s,c}){
    const crease=.0013*Math.sin((y+.011*c)*135)*bell(y,.035,.04)*Math.max(0,s);
    p[2]+=crease;p[0]+=side*.001*bell(y,.14,.05);
  }});
  const profile=[[-.10,.037,.024],[-.079,.052,.041],[-.03,.056,.058],[.02,.055,.052],[.09,.052,.035],[.155,.043,.025],[.19,.019,.012],[.197,.001,.001]];
  // Loft along the shoe's length, with the toe lifting away from the canvas.
  const foot=place(sculpt({name:'boot-instep-'+label,sections:sampleSections(profile.map(([z,w,h])=>[z,w,h,0,.064-(z>.095?(z-.095)*.28:0)-h]),.009),segments:40}),{rotate:[Math.PI/2,0,0]});
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
function buildHeadDetail() { return buildFighterFace(); }

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
