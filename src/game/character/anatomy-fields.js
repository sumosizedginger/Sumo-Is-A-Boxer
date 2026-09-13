// Distances are metres in the fixed opponent bind frame. These are authored
// anatomical fields, not random displacement or a general-purpose sculptor.
export const bell = (x, centre, width) => Math.exp(-1 * ((x - centre) / width) ** 2);
export function sampleSections(sections, step = .009) {
  const result = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i], b = sections[i + 1], count = Math.max(1, Math.ceil(Math.abs(b[0]-a[0]) / step));
    for (let j = 0; j < count; j++) result.push(Array.from({length:5}, (_, k) => (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * j / count));
  }
  result.push(sections.at(-1));
  return result;
}

export function shapeFace(p, { y, s, c }) {
  const x = p[0], ax = Math.abs(x), front = Math.max(0, s);
  if (s > 0) {
    // Deep orbital bowl, continuous supraorbital arch, malar shelf and hollow.
    const eyeY = x > 0 ? 1.756 : 1.754;
    p[2] -= .020 * bell(ax, .034, .019) * bell(y, eyeY, .011);
    p[2] += .009 * bell(ax, .036, .028) * bell(y, eyeY + .019, .008);
    p[2] += .010 * bell(ax, .061, .020) * bell(y, 1.727, .017);
    p[2] -= .008 * bell(ax, .057, .022) * bell(y, 1.698, .016);
    // Maxilla supports the lips. Philtrum and mental crease stay shallow.
    p[2] += .005 * bell(x, -.001, .030) * bell(y, 1.700, .019);
    p[2] -= .002 * bell(x, .001, .0035) * bell(y, 1.710, .008);
    p[2] += .011 * bell(x, -.002, .033) * bell(y, 1.651, .014);
    p[2] -= .003 * bell(x, 0, .027) * bell(y, 1.671, .005);
    // Forehead flattens toward the centre; temple narrows behind the orbit.
    p[2] += front * .003 * bell(y, 1.804, .023) * bell(x, 0, .05);
  }
  p[0] += Math.sign(x) * .004 * bell(y, 1.674, .015) * Math.abs(c);
  p[0] -= Math.sign(x) * .003 * bell(y, 1.779, .020) * Math.abs(c);
  p[0] += .0013 * bell(y, 1.688, .034);
  p[2] += front * .0018 * bell(x, .058, .025) * bell(y, 1.713, .025);
}

export function shapeTorso(p, { y, s, c }) {
  const x = p[0], ax = Math.abs(x), front = Math.max(0,s), back = Math.max(0,-s);
  const pecY = 1.414 + (x > 0 ? .003 : 0);
  p[2] += front * .022 * bell(ax,.102,.075) * bell(y,pecY,.042);
  p[2] -= front * .010 * bell(x,0,.019) * bell(y,1.410,.082);
  p[2] -= front * .004 * bell(y,1.368+ax*.03,.010) * bell(ax,.11,.08);
  // Clavicles slope out of the notch, not a horizontal necklace.
  p[2] += front * .009 * bell(y,1.530-ax*.13,.008) * bell(ax,.105,.085);
  p[2] -= front * .006 * bell(x,0,.016) * bell(y,1.535,.014);
  // Paired SCM tendons fan into the sternal insertion. Traps rise at the back.
  p[2] += front * .006 * bell(ax,.020+(y-1.53)*.29,.012) * bell(y,1.595,.070);
  p[2] += back * -.011 * bell(y,1.530,.045) * bell(ax,.080,.070);
  p[2] -= back * .009 * bell(x,0,.022) * bell(y,1.36,.18);
  p[2] -= back * .006 * bell(ax,.12,.05) * bell(y,1.443,.066);
  // Broad abdominal wall, oblique tilt and restrained serratus slips.
  p[2] += front * .007 * bell(ax,.047,.032) * bell(y,1.248,.105);
  p[2] -= front * .003 * bell(x,0,.012) * bell(y,1.247,.108);
  p[2] += front * .003 * bell(ax,.050,.038) * bell(y,1.255,.09) * Math.cos((y-1.20)*48);
  p[2] -= front * .005 * bell(ax,.119+(y-1.19)*.14,.016) * bell(y,1.24,.10);
  p[0] += Math.sign(x) * .006 * Math.abs(c) * bell(y,1.32,.07);
  p[2] += front * .0025 * bell(ax,.154,.031) * bell(y,1.32,.055) * Math.cos((y+ax*.45)*96);
}
