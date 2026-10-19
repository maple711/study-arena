// MAAE 3202 — Mechanics of Solids II. Chapters 0–3 from the course slides (review, stress/strain
// transformation and Mohr's circle, failure theories, unsymmetric bending and shear centre).
// Midterm: Wed Nov 5 (Chapters 1–4). Units: N, mm, MPa (= N/mm²) unless stated.
const { R, pick, randInt, rand, nz, rnd, bisect } = SA;
const r2 = (v) => +v.toFixed(2), r3 = (v) => +v.toFixed(3);
const D2R = Math.PI / 180;
const TOL = 3e-3;
const num = (v) => String(rnd(v));
const pm = (v) => (v < 0 ? `- ${Math.abs(v)}` : `+ ${v}`);

// plane-stress helpers (slides convention: θ = angle of the plane's outward normal from x, CCW)
const sn = (sx, sy, t, th) => (sx + sy) / 2 + ((sx - sy) / 2) * Math.cos(2 * th) + t * Math.sin(2 * th);
const ts = (sx, sy, t, th) => ((sx - sy) / 2) * Math.sin(2 * th) - t * Math.cos(2 * th);
const princ = (sx, sy, t) => { const C = (sx + sy) / 2, Rr = Math.hypot((sx - sy) / 2, t); return { C, R: Rr, s1: C + Rr, s2: C - Rr, phi: 0.5 * Math.atan2(2 * t, sx - sy) / D2R }; };

/* ================= Chapter 0 review ================= */
function genVessel() {
  const sphere = Math.random() < 0.25, p = pick([1, 1.5, 2, 3, 5, 6, 10]), d = pick([250, 500, 800, 1200, 2000]), t = pick([4, 5, 6, 8, 10, 12]);
  const sh = (p * d) / (2 * t), sa = (p * d) / (4 * t);
  if (sphere) return {
    points: 10, prompt: `A thin spherical vessel, mean diameter $${d}$ mm and wall thickness $${t}$ mm, holds an internal pressure of $${p}$ MPa. Find the wall stress (MPa).`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter MPa.', answer: num(sa), answerTex: `\\sigma = \\frac{pd}{4t} = ${r2(sa)}\\text{ MPa}`,
    steps: [{ key: 'eq', title: 'Equilibrium of a hemisphere', body: R`Pressure on the projected area $\frac{\pi d^2}{4}p$ balances the wall force $\sigma\pi dt$, so $\sigma = \frac{pd}{4t}$ in every direction.` }],
    mistakes: [{ expr: num(sh), step: 'eq', why: 'That is the hoop stress of a cylinder. A sphere has $pd/4t$ in all directions.' }],
  };
  const askA = Math.random() < 0.4;
  return {
    points: 10,
    prompt: `A closed-ended thin cylinder, mean diameter $${d}$ mm, wall $${t}$ mm, has internal pressure $${p}$ MPa. Find the ${askA ? 'axial (longitudinal)' : 'hoop (circumferential)'} stress (MPa).`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter MPa.', answer: num(askA ? sa : sh), answerTex: askA ? `\\sigma_a = \\frac{pd}{4t} = ${r2(sa)}\\text{ MPa}` : `\\sigma_h = \\frac{pd}{2t} = ${r2(sh)}\\text{ MPa}`,
    steps: [
      { key: 'hoop', title: 'Hoop: cut along a diameter', body: R`$2\sigma_h tL = p\,dL \Rightarrow \sigma_h = \frac{pd}{2t}$` },
      { key: 'ax', title: 'Axial: cut across the tube', body: R`$\sigma_a\pi dt = p\frac{\pi d^2}{4} \Rightarrow \sigma_a = \frac{pd}{4t} = \frac{\sigma_h}{2}$` },
    ],
    mistakes: [
      { expr: num(askA ? sh : sa), step: askA ? 'ax' : 'hoop', why: askA ? 'That is the hoop stress; the axial stress is half of it.' : 'That is the axial stress; the hoop stress is twice it.' },
      { expr: num(askA ? (p * d) / (8 * t) : (p * d) / t), step: askA ? 'ax' : 'hoop', why: 'Use the diameter $d$ (or $2r$) consistently: $\\sigma_h = pr/t = pd/2t$.' },
    ],
  };
}

function genTorsion() {
  const kind = pick(['solid', 'solid', 'thin']);
  if (kind === 'thin') {
    const b = pick([50, 80, 100]), h = pick([30, 40, 60]), t = pick([2, 3, 4]), T = pick([0.5, 1, 2, 3]);
    const tau = (T * 1e6) / (2 * b * h * t);
    return {
      points: 15, prompt: `A thin-walled rectangular tube has centreline dimensions $${b}\\times${h}$ mm and wall thickness $${t}$ mm. Find the shear stress (MPa) under a torque of $${T}$ kN·m.`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter MPa.', answer: num(tau), answerTex: `\\tau = \\frac{T}{2A_mt} = ${r2(tau)}\\text{ MPa}`,
      figure: { kind: 'sketch', height: 220, view: [-b * 0.75, b * 0.75, -h * 0.85, h * 0.85], items: [{ t: 'poly', pts: [[-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, h / 2], [-b / 2, h / 2]], width: 3 }, { t: 'poly', pts: [[-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, h / 2], [-b / 2, h / 2]], fill: 0, color: 0, width: 0.5 }, { t: 'text', x: 0, y: -h / 2, dy: 18, text: `${b} mm`, color: 'muted' }, { t: 'text', x: b / 2, y: 0, dx: 8, text: `${h} mm`, anchor: 'start', color: 'muted' }, { t: 'text', x: 0, y: 0, text: 'A_m', color: 0 }] },
      steps: [
        { key: 'q', title: 'Constant shear flow', body: R`For a closed thin section, $q = \tau t$ is constant around the wall and $T = 2A_mq$, where $A_m$ is the area enclosed by the wall's centreline.` },
        { key: 'calc', title: 'Compute', body: `$A_m = ${b}\\times${h} = ${b * h}$ mm², $\\tau = \\frac{${T}\\times10^6}{2(${b * h})(${t})} = ${r2(tau)}$ MPa` },
      ],
      mistakes: [
        { expr: num((T * 1e6) / (b * h * t)), step: 'q', why: 'Bredt\'s formula has a factor 2: $T = 2A_mq$.' },
        { expr: num(tau / 1000), step: 'calc', why: 'Convert kN·m to N·mm ($\\times10^6$) so the answer comes out in MPa.' },
      ],
    };
  }
  const d = pick([20, 25, 40, 50, 60, 80]), T = pick([0.2, 0.4, 0.5, 1, 2, 5]), askAngle = Math.random() < 0.35, L = pick([500, 1000, 1500]), G = pick([77, 80, 26]);
  const J = (Math.PI * d ** 4) / 32, tau = (T * 1e6 * (d / 2)) / J, ang = ((T * 1e6 * L) / (G * 1e3 * J)) / D2R;
  return {
    points: 10,
    prompt: askAngle ? `A solid shaft, $d = ${d}$ mm, $L = ${L}$ mm, $G = ${G}$ GPa, carries $T = ${T}$ kN·m. Find the angle of twist (degrees).` : `A solid circular shaft of diameter $${d}$ mm transmits a torque of $${T}$ kN·m. Find the maximum shear stress (MPa).`,
    vars: [], sample: () => ({}), tol: TOL, hint: askAngle ? 'Enter degrees.' : 'Enter MPa.',
    answer: num(askAngle ? ang : tau), answerTex: askAngle ? `\\theta = \\frac{TL}{GJ} = ${r3(ang)}^\\circ` : `\\tau_{max} = \\frac{Tr}{J} = \\frac{16T}{\\pi d^3} = ${r2(tau)}\\text{ MPa}`,
    steps: [
      { key: 'J', title: 'Polar second moment', body: `$J = \\frac{\\pi d^4}{32} = ${Math.round(J).toLocaleString('en-US').replace(/,/g, '{,}')}$ mm⁴` },
      askAngle ? { key: 'f', title: 'Twist', body: `$\\theta = \\frac{TL}{GJ} = ${r3((ang * D2R))}$ rad $= ${r3(ang)}^\\circ$ (use $G$ in MPa: $${G}\\times10^3$)` } : { key: 'f', title: 'Torsion formula', body: `$\\tau_{max} = \\frac{T(d/2)}{J} = ${r2(tau)}$ MPa at the surface` },
    ],
    mistakes: askAngle ? [{ expr: num(ang * D2R), step: 'f', why: 'That is radians; convert to degrees.' }, { expr: num(ang * 1000), step: 'f', why: 'GPa → MPa is ×1000; check units.' }]
      : [{ expr: num((T * 1e6 * d) / J), step: 'f', why: 'Use the radius $d/2$, not the diameter.' }, { expr: num((T * 1e6 * (d / 2)) / ((Math.PI * d ** 4) / 64)), step: 'J', why: 'That uses $I = \\pi d^4/64$; torsion needs $J = \\pi d^4/32$.' }],
  };
}

function genThermal() {
  const E = pick([70, 200, 110]), a = { 70: 23, 200: 12, 110: 17 }[E], dT = pick([20, 30, 40, 50, 60, 80]);
  const s = E * 1e3 * a * 1e-6 * dT;
  return {
    points: 10, prompt: `A ${{ 70: 'aluminium', 200: 'steel', 110: 'copper' }[E]} bar ($E = ${E}$ GPa, $\\alpha = ${a}\\times10^{-6}$/°C) is fixed between rigid walls and heated by $${dT}$ °C. What is the stress (MPa, tension positive)?`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter MPa (negative for compression).', answer: num(-s), answerTex: `\\sigma = -E\\alpha\\Delta T = ${r2(-s)}\\text{ MPa}`,
    steps: [
      { key: 'compat', title: 'Compatibility', body: R`Total strain is zero: $\frac{\sigma}{E} + \alpha\Delta T = 0$ (eq. 0.5 with no lateral stress).` },
      { key: 'calc', title: 'Solve', body: `$\\sigma = -E\\alpha\\Delta T = -(${E}\\times10^3)(${a}\\times10^{-6})(${dT}) = ${r2(-s)}$ MPa (compressive)` },
    ],
    mistakes: [{ expr: num(s), step: 'compat', why: 'The walls stop the bar expanding, so it is pushed into compression: negative.' }, { expr: num(-s / 1000), step: 'calc', why: 'Use $E$ in MPa ($\\times10^3$ from GPa).' }],
  };
}

/* ================= Chapter 1 ================= */
const stressPrompt = (sx, sy, t) => `$\\sigma_x = ${sx}$, $\\sigma_y = ${sy}$, $\\tau_{xy} = ${t}$ MPa`;
const elementFig = (sx, sy, t, thDeg) => ({ kind: 'sketch', height: 230, view: [-2.3, 2.3, -2, 2], items: elementItems(sx, sy, t, thDeg) });
function elementItems(sx, sy, t, thDeg) {
  const s = 0.9, items = [{ t: 'poly', pts: [[-s, -s], [s, -s], [s, s], [-s, s]], fill: 'muted', color: 'text', opacity: 0.08 }];
  const big = Math.max(Math.abs(sx), Math.abs(sy), Math.abs(t), 1);
  const L = (v) => 0.25 + (0.6 * Math.abs(v)) / big;
  if (sx) { const d = sx > 0 ? 1 : -1; items.push({ t: 'arrow', x1: d > 0 ? s : s + L(sx), y1: 0, x2: d > 0 ? s + L(sx) : s + 0.02, y2: 0, color: 0 }, { t: 'arrow', x1: d > 0 ? -s : -s - L(sx), y1: 0, x2: d > 0 ? -s - L(sx) : -s - 0.02, y2: 0, color: 0 }, { t: 'text', x: s + L(sx), y: 0, dx: 6, dy: -6, text: `σx = ${sx}`, anchor: 'start', color: 0, size: 11 }); }
  if (sy) { const d = sy > 0 ? 1 : -1; items.push({ t: 'arrow', x1: 0, y1: d > 0 ? s : s + L(sy), x2: 0, y2: d > 0 ? s + L(sy) : s + 0.02, color: 1 }, { t: 'arrow', x1: 0, y1: d > 0 ? -s : -s - L(sy), x2: 0, y2: d > 0 ? -s - L(sy) : -s - 0.02, color: 1 }, { t: 'text', x: 0, y: s + L(sy), dy: -6, text: `σy = ${sy}`, color: 1, size: 11 }); }
  if (t) { const k = t > 0 ? 1 : -1, o = s + 0.12, l = 0.55;
    items.push({ t: 'arrow', x1: o, y1: -k * l, x2: o, y2: k * l, color: 2 }, { t: 'arrow', x1: -o, y1: k * l, x2: -o, y2: -k * l, color: 2 }, { t: 'arrow', x1: -k * l, y1: o, x2: k * l, y2: o, color: 2 }, { t: 'arrow', x1: k * l, y1: -o, x2: -k * l, y2: -o, color: 2 }, { t: 'text', x: o, y: -0.9, dx: 6, text: `τxy = ${t}`, anchor: 'start', color: 2, size: 11 }); }
  if (thDeg != null) { const th = thDeg * D2R, c = Math.cos(th), sN = Math.sin(th); items.push({ t: 'line', x1: -1.3 * -sN, y1: -1.3 * c, x2: 1.3 * -sN, y2: 1.3 * c, color: 3, dash: true }, { t: 'arrow', x1: 0, y1: 0, x2: 1.1 * c, y2: 1.1 * sN, color: 3 }, { t: 'text', x: 1.1 * c, y: 1.1 * sN, dx: 8, text: `n (θ = ${thDeg}°)`, anchor: 'start', color: 3, size: 11 }); }
  return items;
}
function mohrItems(sx, sy, t, thDeg) {
  const P = princ(sx, sy, t), Rr = Math.max(P.R, 1e-9);
  const items = [{ t: 'circle', x: P.C, y: 0, r: Rr, color: 0, fill: true, opacity: 0.06 }, { t: 'line', x1: sx, y1: -t, x2: sy, y2: t, color: 'muted', dash: true },
    { t: 'dot', x: sx, y: -t, color: 0 }, { t: 'text', x: sx, y: -t, dx: 7, dy: 4, text: 'X', anchor: 'start', size: 12, color: 0, bold: true },
    { t: 'dot', x: sy, y: t, color: 1 }, { t: 'text', x: sy, y: t, dx: 7, dy: 4, text: 'Y', anchor: 'start', size: 12, color: 1, bold: true },
    { t: 'dot', x: P.s1, y: 0, color: 'text', size: 3 }, { t: 'text', x: P.s1, y: 0, dx: 4, dy: 15, text: 'σ1', anchor: 'start', size: 11 },
    { t: 'dot', x: P.s2, y: 0, color: 'text', size: 3 }, { t: 'text', x: P.s2, y: 0, dx: -4, dy: 15, text: 'σ2', anchor: 'end', size: 11 },
    { t: 'dot', x: P.C, y: Rr, color: 'muted', size: 3 }, { t: 'text', x: P.C, y: Rr, dy: -7, text: 'τmax', size: 11, color: 'muted' }];
  if (thDeg != null) { const th = thDeg * D2R, x = sn(sx, sy, t, th), y = ts(sx, sy, t, th); items.push({ t: 'line', x1: P.C, y1: 0, x2: x, y2: y, color: 3 }, { t: 'dot', x, y, color: 3, size: 5 }, { t: 'text', x, y, dx: 8, dy: -6, text: 'n', anchor: 'start', size: 12, color: 3, bold: true }); }
  return items;
}
const mohrView = (sx, sy, t) => { const P = princ(sx, sy, t), Rr = Math.max(P.R, 5), lo = Math.min(P.C - Rr, 0), hi = Math.max(P.C + Rr, 0); const pad = 0.25 * (hi - lo); return [lo - pad, hi + pad, -Rr * 1.35, Rr * 1.35]; };

function genIncline() {
  const sx = nz(-8, 12) * 10, sy = randInt(-8, 10) * 10, t = randInt(-5, 5) * 10, th = pick([15, 30, 45, 60, 120, 135, -30]);
  const askT = Math.random() < 0.4;
  const v = askT ? ts(sx, sy, t, th * D2R) : sn(sx, sy, t, th * D2R);
  return {
    points: 15,
    prompt: `At a point, ${stressPrompt(sx, sy, t)}. Find ${askT ? 'the shear stress $\\tau_s$' : 'the normal stress $\\sigma_n$'} on the plane whose outward normal is at $\\theta = ${th}^\\circ$ (CCW from $x$).`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter MPa (sign matters).', answer: num(v), answerTex: `${askT ? '\\tau_s' : '\\sigma_n'} = ${r2(v)}\\text{ MPa}`,
    figure: elementFig(sx, sy, t, th),
    steps: [
      { key: 'eq', title: askT ? 'Equation (1.2)' : 'Equation (1.1)', body: askT ? R`$\tau_s = \frac{\sigma_x - \sigma_y}{2}\sin2\theta - \tau_{xy}\cos2\theta$` : R`$\sigma_n = \frac{\sigma_x + \sigma_y}{2} + \frac{\sigma_x - \sigma_y}{2}\cos2\theta + \tau_{xy}\sin2\theta$` },
      { key: 'sub', title: 'Substitute', body: `$2\\theta = ${2 * th}^\\circ$: ${askT ? `$\\tau_s = ${(sx - sy) / 2}\\sin(${2 * th}^\\circ) ${pm(-t)}\\cos(${2 * th}^\\circ) = ${r2(v)}$` : `$\\sigma_n = ${(sx + sy) / 2} ${pm((sx - sy) / 2)}\\cos(${2 * th}^\\circ) ${pm(t)}\\sin(${2 * th}^\\circ) = ${r2(v)}$`} MPa` },
    ],
    mistakes: [
      { expr: num(askT ? ts(sx, sy, t, (th * D2R) / 2) : sn(sx, sy, t, (th * D2R) / 2)), step: 'sub', why: 'The formulas use the double angle $2\\theta$.' },
      { expr: num(askT ? ts(sx, sy, -t, th * D2R) : sn(sx, sy, -t, th * D2R)), step: 'eq', why: 'Sign of the $\\tau_{xy}$ term: check it against equation ' + (askT ? '(1.2)' : '(1.1)') + '.' },
      { expr: num(askT ? -v : sn(sy, sx, t, th * D2R)), step: 'eq', why: askT ? 'Opposite sign convention for $\\tau_s$: use the slides\' form of (1.2).' : '$\\sigma_x$ and $\\sigma_y$ swapped in the $\\cos2\\theta$ term.' },
    ],
  };
}

function genPrincipal() {
  const shaft = Math.random() < 0.3;
  let sx, sy, t, setup, extra = [];
  if (shaft) {
    const d = pick([40, 50, 60]), F = pick([20, 44.5, 60, 100]), T = pick([0.4, 0.8, 1.2, 2]);
    sx = (4 * F * 1e3) / (Math.PI * d * d); sy = 0; t = (16 * T * 1e6) / (Math.PI * d ** 3);
    setup = `A solid shaft of diameter $${d}$ mm carries an axial tension of $${F}$ kN and a torque of $${T}$ kN·m.`;
    extra = [{ key: 'st', title: 'Stresses on the surface', body: `$\\sigma_x = \\frac{4F}{\\pi d^2} = ${r2(sx)}$ MPa, $\\sigma_y = 0$, $\\tau_{xy} = \\frac{16T}{\\pi d^3} = ${r2(t)}$ MPa` }];
  } else { sx = nz(-8, 12) * 10; sy = randInt(-8, 10) * 10; t = nz(-6, 6) * 10; setup = `At a point, ${stressPrompt(sx, sy, t)}.`; }
  const P = princ(sx, sy, t), ask = pick(['s1', 's2', 'tmax', 'phi']);
  const val = { s1: P.s1, s2: P.s2, tmax: P.R, phi: P.phi }[ask];
  return {
    points: 15,
    prompt: `${setup} Find ${{ s1: 'the maximum principal stress $\\sigma_1$ (MPa)', s2: 'the minimum principal stress $\\sigma_2$ (MPa)', tmax: 'the maximum in-plane shear stress (MPa)', phi: 'the angle $\\phi$ (degrees, between −90° and 90°) from $x$ to the normal of the plane carrying $\\sigma_1$' }[ask]}.`,
    vars: [], sample: () => ({}), tol: ask === 'phi' ? 2e-3 : TOL, hint: ask === 'phi' ? 'Enter degrees.' : 'Enter MPa.',
    answer: num(val), answerTex: { s1: `\\sigma_1 = ${r2(P.s1)}`, s2: `\\sigma_2 = ${r2(P.s2)}`, tmax: `\\tau_{max} = ${r2(P.R)}`, phi: `\\phi = ${r2(P.phi)}^\\circ` }[ask] + (ask === 'phi' ? '' : '\\text{ MPa}'),
    figure: elementFig(r2(sx), sy, r2(t)),
    steps: [
      ...extra,
      { key: 'cr', title: "Mohr's circle centre and radius", body: `$C = \\frac{\\sigma_x+\\sigma_y}{2} = ${r2(P.C)}$, $R = \\sqrt{\\left(\\frac{\\sigma_x-\\sigma_y}{2}\\right)^2 + \\tau_{xy}^2} = ${r2(P.R)}$ MPa` },
      { key: 'pr', title: 'Principal stresses (1.5, 1.6)', body: `$\\sigma_{1,2} = C \\pm R = ${r2(P.s1)},\\ ${r2(P.s2)}$ MPa; $\\tau_{max} = R = ${r2(P.R)}$ MPa, on planes $45^\\circ$ from the principal planes.` },
      { key: 'ang', title: 'Principal direction', body: `$\\tan2\\phi = \\frac{2\\tau_{xy}}{\\sigma_x-\\sigma_y}$; choosing the quadrant of $(\\sigma_x - \\sigma_y,\\ 2\\tau_{xy})$ gives $2\\phi = ${r2(2 * P.phi)}^\\circ$, $\\phi = ${r2(P.phi)}^\\circ$ for $\\sigma_1$.` },
    ],
    mistakes: [
      ...(ask === 's1' || ask === 's2' ? [{ expr: num(ask === 's1' ? P.C + P.R * P.R : P.C - P.R * P.R), step: 'cr', why: 'Take the square root for the radius.' }, { expr: num(ask === 's1' ? Math.max(sx, sy) : Math.min(sx, sy)), step: 'pr', why: 'With shear present, the extreme normal stresses are not $\\sigma_x$ or $\\sigma_y$.' }] : []),
      ...(ask === 'tmax' ? [{ expr: num(Math.abs(t)), step: 'pr', why: '$\\tau_{max}$ is the circle radius, not $\\tau_{xy}$.' }, { expr: num(2 * P.R), step: 'pr', why: '$\\tau_{max} = R = (\\sigma_1 - \\sigma_2)/2$.' }] : []),
      ...(ask === 'phi' ? [{ expr: num(2 * P.phi), step: 'ang', why: 'That is $2\\phi$; physical angles are half the angles on the circle.' }, ...(Math.abs(P.phi - (0.5 * Math.atan((2 * t) / (sx - sy))) / D2R) > 1 ? [{ expr: num((0.5 * Math.atan((2 * t) / (sx - sy))) / D2R), step: 'ang', why: 'That angle gives $\\sigma_2$: $\\arctan$ alone loses the quadrant. Check where $(\\sigma_x - \\sigma_y, 2\\tau_{xy})$ points.' }] : [])] : []),
    ],
  };
}

function genStrain() {
  const E = 200e3, nu = 0.3;
  const kind = pick(['normal', 'principal', 'rosette', 'stress']);
  if (kind === 'rosette') {
    const e0 = randInt(-6, 9) * 50, e45 = randInt(-6, 9) * 50, e90 = randInt(-6, 9) * 50;
    const g = 2 * e45 - e0 - e90, C = (e0 + e90) / 2, Rr = Math.hypot((e0 - e90) / 2, g / 2);
    const ask = pick(['e1', 'e2', 'g']);
    const v = { e1: C + Rr, e2: C - Rr, g }[ask];
    return {
      points: 20,
      prompt: `A 45° strain rosette reads $\\varepsilon_{0} = ${e0}$, $\\varepsilon_{45} = ${e45}$, $\\varepsilon_{90} = ${e90}$ (all $\\mu\\varepsilon$, gauges at 0°, 45°, 90° from $x$). Find ${{ e1: 'the maximum principal strain $\\varepsilon_1$', e2: 'the minimum principal strain $\\varepsilon_2$', g: 'the shear strain $\\gamma_{xy}$' }[ask]} in $\\mu\\varepsilon$.`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter microstrain.', answer: num(v), answerTex: `${{ e1: '\\varepsilon_1', e2: '\\varepsilon_2', g: '\\gamma_{xy}' }[ask]} = ${r2(v)}\\ \\mu\\varepsilon`,
      steps: [
        { key: 'g', title: 'Shear strain from the 45° gauge', body: `Equation (1.10) at $45^\\circ$: $\\varepsilon_{45} = \\frac{\\varepsilon_x+\\varepsilon_y}{2} + \\frac{\\gamma_{xy}}{2}$, so $\\gamma_{xy} = 2\\varepsilon_{45} - \\varepsilon_0 - \\varepsilon_{90} = ${g}\\ \\mu\\varepsilon$.` },
        { key: 'c', title: "Mohr's strain circle (1.13)", body: `Centre $${C}$, radius $\\sqrt{\\left(\\frac{\\varepsilon_x-\\varepsilon_y}{2}\\right)^2 + \\left(\\frac{\\gamma_{xy}}{2}\\right)^2} = ${r2(Rr)}$, so $\\varepsilon_{1,2} = ${r2(C + Rr)},\\ ${r2(C - Rr)}$.` },
      ],
      mistakes: [
        { expr: num(ask === 'g' ? e45 : ask === 'e1' ? C + Math.hypot((e0 - e90) / 2, g) : C - Math.hypot((e0 - e90) / 2, g)), step: ask === 'g' ? 'g' : 'c', why: ask === 'g' ? 'The 45° gauge mixes normal and shear strain: $\\gamma_{xy} = 2\\varepsilon_{45} - \\varepsilon_0 - \\varepsilon_{90}$.' : 'Strain transformation uses $\\gamma/2$ (the factor of ½ in 1.10–1.11).' },
        ...(ask !== 'g' ? [{ expr: num(ask === 'e1' ? Math.max(e0, e90, e45) : Math.min(e0, e90, e45)), step: 'c', why: 'The largest gauge reading is not, in general, a principal strain.' }] : []),
      ],
    };
  }
  if (kind === 'stress') {
    const e1 = randInt(2, 12) * 100, e2 = randInt(-8, 6) * 100, which = pick([1, 2]);
    const s1 = (E / (1 - nu * nu)) * (e1 + nu * e2) * 1e-6, s2 = (E / (1 - nu * nu)) * (e2 + nu * e1) * 1e-6;
    const v = which === 1 ? s1 : s2;
    return {
      points: 15,
      prompt: `Principal strains on a steel surface (plane stress, $E = 200$ GPa, $\\nu = 0.3$) are $\\varepsilon_1 = ${e1}$ and $\\varepsilon_2 = ${e2}\\ \\mu\\varepsilon$. Find $\\sigma_${which}$ (MPa).`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter MPa.', answer: num(v), answerTex: `\\sigma_${which} = ${r2(v)}\\text{ MPa}`,
      steps: [
        { key: 'h', title: "Hooke's law in plane stress", body: R`$\sigma_1 = \frac{E}{1-\nu^2}(\varepsilon_1 + \nu\varepsilon_2)$, $\sigma_2 = \frac{E}{1-\nu^2}(\varepsilon_2 + \nu\varepsilon_1)$ (principal strain axes are principal stress axes).` },
        { key: 'c', title: 'Compute', body: `$\\frac{E}{1-\\nu^2} = ${r2(E / (1 - nu * nu))}$ MPa, so $\\sigma_${which} = ${r2(v)}$ MPa.` },
      ],
      mistakes: [{ expr: num(E * (which === 1 ? e1 : e2) * 1e-6), step: 'h', why: 'In 2-D the other principal strain contributes through Poisson\'s ratio.' }, { expr: num(E * ((which === 1 ? e1 : e2) + nu * (which === 1 ? e2 : e1)) * 1e-6), step: 'h', why: 'Missing the $\\frac{1}{1-\\nu^2}$ factor.' }],
    };
  }
  const ex = randInt(-6, 9) * 100, ey = randInt(-6, 9) * 100, g = nz(-6, 6) * 100;
  const C = (ex + ey) / 2, Rr = Math.hypot((ex - ey) / 2, g / 2);
  if (kind === 'principal') {
    const one = Math.random() < 0.6, v = one ? C + Rr : C - Rr;
    return {
      points: 15, prompt: `$\\varepsilon_x = ${ex}$, $\\varepsilon_y = ${ey}$, $\\gamma_{xy} = ${g}$ ($\\mu\\varepsilon$). Find $\\varepsilon_${one ? 1 : 2}$.`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter microstrain.', answer: num(v), answerTex: `\\varepsilon_${one ? 1 : 2} = ${r2(v)}\\ \\mu\\varepsilon`,
      steps: [{ key: 'c', title: 'Strain circle', body: `Centre $\\frac{\\varepsilon_x+\\varepsilon_y}{2} = ${C}$, radius $\\sqrt{\\left(\\frac{\\varepsilon_x-\\varepsilon_y}{2}\\right)^2 + \\left(\\frac{\\gamma_{xy}}{2}\\right)^2} = ${r2(Rr)}$, so $\\varepsilon_${one ? 1 : 2} = ${r2(v)}$.` }],
      mistakes: [{ expr: num(one ? C + Math.hypot((ex - ey) / 2, g) : C - Math.hypot((ex - ey) / 2, g)), step: 'c', why: 'Use $\\gamma_{xy}/2$ on the strain circle, not $\\gamma_{xy}$.' }],
    };
  }
  const th = pick([30, 45, 60, 120]);
  const v = C + ((ex - ey) / 2) * Math.cos(2 * th * D2R) + (g / 2) * Math.sin(2 * th * D2R);
  return {
    points: 15, prompt: `$\\varepsilon_x = ${ex}$, $\\varepsilon_y = ${ey}$, $\\gamma_{xy} = ${g}$ ($\\mu\\varepsilon$). What does a gauge at $${th}^\\circ$ CCW from $x$ read?`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter microstrain.', answer: num(v), answerTex: `\\varepsilon_n = ${r2(v)}\\ \\mu\\varepsilon`,
    steps: [{ key: 'eq', title: 'Equation (1.10)', body: R`$\varepsilon_n = \frac{\varepsilon_x+\varepsilon_y}{2} + \frac{\varepsilon_x-\varepsilon_y}{2}\cos2\theta + \frac{\gamma_{xy}}{2}\sin2\theta$ — the stress formula with $\tau \to \gamma/2$.` }, { key: 'sub', title: 'Substitute', body: `$\\varepsilon_n = ${C} ${pm((ex - ey) / 2)}\\cos${2 * th}^\\circ ${pm(g / 2)}\\sin${2 * th}^\\circ = ${r2(v)}$` }],
    mistakes: [{ expr: num(C + ((ex - ey) / 2) * Math.cos(2 * th * D2R) + g * Math.sin(2 * th * D2R)), step: 'eq', why: 'The shear term carries $\\gamma_{xy}/2$.' }],
  };
}

/* ================= Chapter 2 ================= */
function genYield() {
  const theory = pick(['tresca', 'vm']), Y = pick([200, 250, 280, 350]);
  const shaftMode = Math.random() < 0.35;
  const name = theory === 'tresca' ? 'Tresca (maximum shear stress)' : 'von Mises (distortion energy)';
  if (shaftMode) {
    const d = pick([40, 50, 60]), M = pick([0.8, 1.2, 1.9, 2.5]);
    const Z = (Math.PI * d ** 3) / 32, s = (M * 1e6) / Z;
    const k = theory === 'tresca' ? 2 : Math.sqrt(3); // σ_eq = sqrt(σ² + (kτ)²)
    if (s >= Y) return genYield();
    const tauMax = Math.sqrt(Y * Y - s * s) / k, T = (tauMax * Math.PI * d ** 3) / 16 / 1e6;
    return {
      points: 20,
      prompt: `A solid shaft, $d = ${d}$ mm, carries a bending moment $M = ${M}$ kN·m and a torque $T$. $\\sigma_y = ${Y}$ MPa. Using ${name}, find the largest $T$ (kN·m) with no yielding.`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter kN·m.', answer: num(T), answerTex: `T_{max} = ${r3(T)}\\text{ kN}\\cdot\\text{m}`,
      steps: [
        { key: 'st', title: 'Surface stresses', body: `$\\sigma = \\frac{32M}{\\pi d^3} = ${r2(s)}$ MPa, $\\tau = \\frac{16T}{\\pi d^3}$` },
        { key: 'cr', title: 'Criterion with σy = 0', body: theory === 'tresca' ? R`$\sigma_1 - \sigma_2 = 2\sqrt{(\sigma/2)^2 + \tau^2} = \sqrt{\sigma^2 + 4\tau^2} \le \sigma_y$` : R`$\sigma_1^2 - \sigma_1\sigma_2 + \sigma_2^2 = \sigma^2 + 3\tau^2 \le \sigma_y^2$` },
        { key: 'solve', title: 'Solve for τ, then T', body: `$\\tau = \\frac{\\sqrt{${Y}^2 - ${r2(s)}^2}}{${theory === 'tresca' ? 2 : '\\sqrt3'}} = ${r2(tauMax)}$ MPa, $T = \\frac{\\pi d^3}{16}\\tau = ${r3(T)}$ kN·m` },
      ],
      mistakes: [
        { expr: num((Math.sqrt(Y * Y - s * s) / (theory === 'tresca' ? Math.sqrt(3) : 2) * Math.PI * d ** 3) / 16 / 1e6), step: 'cr', why: theory === 'tresca' ? 'Tresca gives $\\sigma^2 + 4\\tau^2$; $3\\tau^2$ is von Mises.' : 'Von Mises gives $\\sigma^2 + 3\\tau^2$; $4\\tau^2$ is Tresca.' },
        { expr: num(((Y / k) * Math.PI * d ** 3) / 16 / 1e6), step: 'st', why: 'The bending stress uses up part of the yield strength; include $\\sigma$.' },
      ],
    };
  }
  const sx = nz(-12, 15) * 10, sy = randInt(-12, 15) * 10, t = randInt(-8, 8) * 10;
  const P = princ(sx, sy, t), s1 = P.s1, s2 = P.s2;
  const tr = Math.max(Math.abs(s1 - s2), Math.abs(s1), Math.abs(s2)), vm = Math.sqrt(s1 * s1 - s1 * s2 + s2 * s2);
  const eq = theory === 'tresca' ? tr : vm, FS = Y / eq;
  if (FS > 20) return genYield();
  return {
    points: 20,
    prompt: `Plane stress: ${stressPrompt(sx, sy, t)}, $\\sigma_y = ${Y}$ MPa. Find the safety factor against yielding by ${name}.`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter a number.', answer: num(FS), answerTex: `n = ${r3(FS)}`,
    figure: { kind: 'sketch', height: 280, axes: { x: 'σ1', y: 'σ2' }, view: [-1.6 * Y, 1.6 * Y, -1.3 * Y, 1.3 * Y], items: yieldItems(Y, s1, s2, true) },
    steps: [
      { key: 'p', title: 'Principal stresses', body: `$\\sigma_{1,2} = ${r2(P.C)} \\pm ${r2(P.R)} = ${r2(s1)},\\ ${r2(s2)}$ MPa, and $\\sigma_3 = 0$.` },
      theory === 'tresca'
        ? { key: 'cr', title: 'Tresca (2.11)', body: `Largest difference among $\\sigma_1, \\sigma_2, \\sigma_3 = 0$: $${r2(tr)}$ MPa. ${s1 * s2 < 0 ? 'Signs differ, so it is $|\\sigma_1 - \\sigma_2|$.' : 'Same sign, so the third (zero) principal stress matters: it is $\\max(|\\sigma_1|, |\\sigma_2|)$.'}` }
        : { key: 'cr', title: 'von Mises (2.24)', body: `$\\sigma_e = \\sqrt{\\sigma_1^2 - \\sigma_1\\sigma_2 + \\sigma_2^2} = ${r2(vm)}$ MPa` },
      { key: 'n', title: 'Safety factor', body: `$n = \\frac{\\sigma_y}{${theory === 'tresca' ? '\\sigma_{eq}' : '\\sigma_e'}} = \\frac{${Y}}{${r2(eq)}} = ${r3(FS)}$` },
    ],
    mistakes: [
      ...(theory === 'tresca' && s1 * s2 > 0 ? [{ expr: num(Y / Math.abs(s1 - s2)), step: 'cr', why: 'In plane stress with $\\sigma_1, \\sigma_2$ of the same sign, the largest Mohr circle includes $\\sigma_3 = 0$.' }] : []),
      { expr: num(Y / (theory === 'tresca' ? vm : tr)), step: 'cr', why: theory === 'tresca' ? 'That is the von Mises result.' : 'That is the Tresca result.' },
      { expr: num(Y / Math.max(Math.abs(s1), Math.abs(s2))), step: 'cr', why: 'That is Rankine (maximum principal stress), which is poor for ductile materials.' },
      ...(theory === 'tresca' ? [{ expr: num(Y / 2 / (tr / 2) / 2), step: 'n', why: 'Compare $\\tau_{max}$ with $\\sigma_y/2$, or the stress difference with $\\sigma_y$ — not a mix.' }] : []),
    ],
  };
}
function yieldItems(Y, s1, s2, hideValues) {
  const ellipse = Array.from({ length: 121 }, (_, i) => { const a = (i / 120) * 2 * Math.PI; const u = Math.cos(a), v = Math.sin(a); const r = Y / Math.sqrt(u * u - u * v + v * v); return [r * u, r * v]; });
  return [
    { t: 'poly', pts: [[Y, 0], [Y, Y], [0, Y], [-Y, 0], [-Y, -Y], [0, -Y]], color: 1, fill: true, opacity: 0.06 },
    { t: 'poly', pts: ellipse, color: 0 },
    { t: 'text', x: Y, y: Y, dx: 4, dy: -4, text: 'Tresca', anchor: 'start', color: 1, size: 11 },
    { t: 'text', x: -0.8 * Y, y: 1.15 * Y, text: 'von Mises', color: 0, size: 11 },
    { t: 'line', x1: 0, y1: 0, x2: s1, y2: s2, color: 3, dash: true },
    { t: 'dot', x: s1, y: s2, color: 3, size: 5 },
    { t: 'text', x: s1, y: s2, dx: 8, dy: -6, text: hideValues ? 'your stress state' : `(${r2(s1)}, ${r2(s2)})`, anchor: 'start', color: 3, size: 11 },
  ];
}

function genMohrBrittle() {
  const sut = pick([150, 200, 250]), suc = pick([600, 750, 900]), s1 = randInt(3, 10) * 10, s2 = -randInt(5, 30) * 10;
  const inv = s1 / sut - s2 / suc, n = 1 / inv;
  return {
    points: 15,
    prompt: `Grey cast iron with $\\sigma_{ut} = ${sut}$ MPa and $\\sigma_{uc} = ${suc}$ MPa has principal stresses $\\sigma_1 = ${s1}$ and $\\sigma_2 = ${s2}$ MPa. Using Mohr's criterion for brittle rupture, find the safety factor.`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter a number.', answer: num(n), answerTex: `n = ${r3(n)}`,
    steps: [
      { key: 'cr', title: 'Criterion (2.25), σ₁ > 0 > σ₂', body: R`Failure when $\frac{\sigma_1}{\sigma_{ut}} - \frac{\sigma_2}{\sigma_{uc}} = 1$ (with $\sigma_{uc}$ as a positive magnitude).` },
      { key: 'n', title: 'Safety factor', body: `$\\frac{1}{n} = \\frac{${s1}}{${sut}} + \\frac{${-s2}}{${suc}} = ${r3(inv)}$, so $n = ${r3(n)}$.` },
    ],
    mistakes: [
      { expr: num(1 / (s1 / sut + s2 / suc)), step: 'cr', why: 'With $\\sigma_2 < 0$, the compressive term adds: $-\\sigma_2/\\sigma_{uc} > 0$.' },
      { expr: num(sut / s1), step: 'cr', why: 'Rankine ignores the compressive principal stress; Mohr\'s criterion includes it.' },
    ],
  };
}

/* ================= Chapter 3 ================= */
function angleProps(A, B, t) { // vertical leg height A (y), horizontal leg width B (z); corner at origin; z right, y up
  const r = [{ z: t / 2, y: A / 2, b: t, h: A }, { z: t + (B - t) / 2, y: t / 2, b: B - t, h: t }];
  const area = r.reduce((s, q) => s + q.b * q.h, 0), zc = r.reduce((s, q) => s + q.b * q.h * q.z, 0) / area, yc = r.reduce((s, q) => s + q.b * q.h * q.y, 0) / area;
  let Iz = 0, Iy = 0, Iyz = 0;
  for (const q of r) { const a = q.b * q.h, dz = q.z - zc, dy = q.y - yc; Iz += (q.b * q.h ** 3) / 12 + a * dy * dy; Iy += (q.h * q.b ** 3) / 12 + a * dz * dz; Iyz += a * dy * dz; }
  const C = (Iy + Iz) / 2, Rr = Math.hypot((Iz - Iy) / 2, Iyz);
  return { zc, yc, Iz, Iy, Iyz, Imax: C + Rr, Imin: C - Rr, beta: (0.5 * Math.atan2(Math.abs(2 * Iyz), Math.abs(Iz - Iy))) / D2R };
}
// Major (Imax) axis: for this L (legs on the left and bottom) I_yz < 0 and the major axis has a positive slope,
// at β from z when I_z ≥ I_y, otherwise at 90° − β.
function principalLines(P, len) {
  const a = (P.Iz >= P.Iy ? P.beta : 90 - P.beta) * D2R, c = Math.cos(a), s = Math.sin(a);
  return [
    { t: 'line', x1: P.zc - len * c, y1: P.yc - len * s, x2: P.zc + len * c, y2: P.yc + len * s, color: 3, dash: true },
    { t: 'text', x: P.zc + len * c, y: P.yc + len * s, dx: 4, text: 'v (I max)', anchor: 'start', size: 11, color: 3 },
    { t: 'line', x1: P.zc + len * 0.6 * s, y1: P.yc - len * 0.6 * c, x2: P.zc - len * 0.6 * s, y2: P.yc + len * 0.6 * c, color: 1, dash: true },
    { t: 'text', x: P.zc - len * 0.6 * s, y: P.yc + len * 0.6 * c, dy: -4, text: 'w (I min)', size: 11, color: 1 },
  ];
}
function genInertia() {
  const [A, B] = pick([[120, 90], [100, 75], [150, 100], [80, 60], [100, 100]]), t = pick([8, 10, 12]);
  const P = angleProps(A, B, t), ask = pick(['Imax', 'Imin', 'beta', 'Iyz']);
  const v = ask === 'beta' ? P.beta : ask === 'Iyz' ? Math.abs(P.Iyz) / 1e6 : P[ask] / 1e6;
  return {
    points: 20,
    prompt: `An angle section has legs $${A}$ mm (vertical) and $${B}$ mm (horizontal), both $${t}$ mm thick. Find ${{ Imax: 'the larger principal second moment of area $I_{max}$ (×10⁶ mm⁴)', Imin: 'the smaller principal second moment $I_{min}$ (×10⁶ mm⁴)', beta: 'the angle $\\beta$ (degrees, magnitude) between the $z$-axis and the nearest principal axis', Iyz: 'the magnitude of the product moment $|I_{yz}|$ about the centroid (×10⁶ mm⁴)' }[ask]}.`,
    vars: [], sample: () => ({}), tol: 4e-3, hint: ask === 'beta' ? 'Enter degrees.' : 'Enter in units of 10⁶ mm⁴.', answer: num(v), answerTex: `${{ Imax: 'I_{max}', Imin: 'I_{min}', beta: '\\beta', Iyz: '|I_{yz}|' }[ask]} = ${r3(v)}${ask === 'beta' ? '^\\circ' : '\\times10^6\\text{ mm}^4'}`,
    figure: { kind: 'sketch', height: 260, view: [-0.3 * B, 1.3 * B, -0.15 * A, 1.15 * A], items: [{ t: 'poly', pts: [[0, 0], [B, 0], [B, t], [t, t], [t, A], [0, A]], fill: 0, color: 0 }, { t: 'dot', x: P.zc, y: P.yc, color: 3 }, { t: 'text', x: P.zc, y: P.yc, dx: 8, dy: -6, text: 'C', anchor: 'start', color: 3 }, ...principalLines(P, 0.6 * Math.max(A, B)), { t: 'text', x: B / 2, y: 0, dy: 16, text: `${B}`, color: 'muted' }, { t: 'text', x: 0, y: A / 2, dx: -6, text: `${A}`, anchor: 'end', color: 'muted' }] },
    steps: [
      { key: 'c', title: 'Centroid', body: `Split into two rectangles: $\\bar z = ${r2(P.zc)}$ mm, $\\bar y = ${r2(P.yc)}$ mm from the outer corner.` },
      { key: 'I', title: 'Parallel-axis theorem', body: `$I_z = ${r3(P.Iz / 1e6)}$, $I_y = ${r3(P.Iy / 1e6)}$, $I_{yz} = \\sum A\\,\\Delta y\\,\\Delta z = ${r3(P.Iyz / 1e6)}$ (×10⁶ mm⁴; sign depends on the axes, the magnitude doesn't).` },
      { key: 'm', title: "Mohr's circle for area moments", body: `$I_{max,min} = \\frac{I_y+I_z}{2} \\pm \\sqrt{\\left(\\frac{I_z-I_y}{2}\\right)^2 + I_{yz}^2} = ${r3(P.Imax / 1e6)},\\ ${r3(P.Imin / 1e6)}$; $\\tan2\\beta = \\frac{2|I_{yz}|}{|I_z - I_y|}$ gives $\\beta = ${r2(P.beta)}^\\circ$.` },
    ],
    mistakes: [
      ...(ask === 'Imax' ? [{ expr: num(Math.max(P.Iz, P.Iy) / 1e6), step: 'm', why: 'For an unsymmetric section the product moment is not zero, so $I_z$ and $I_y$ are not principal.' }] : []),
      ...(ask === 'Imin' ? [{ expr: num(Math.min(P.Iz, P.Iy) / 1e6), step: 'm', why: 'Include $I_{yz}$: the principal values lie beyond $I_y$ and $I_z$.' }] : []),
      ...(ask === 'beta' ? [{ expr: num(2 * P.beta), step: 'm', why: 'That is $2\\beta$, the angle on the circle.' }] : []),
      ...(ask === 'Iyz' ? [{ expr: '0', step: 'I', why: 'Only symmetric sections have $I_{yz} = 0$.' }] : []),
    ],
  };
}

function genUnsym() {
  const b = pick([40, 50, 60]), h = pick([90, 100, 120]), L = pick([1, 1.5, 2]), P = pick([100, 200, 500, 1000]), th = pick([15, 20, 30, 45]);
  const M = P * L * 1e3, Mz = M * Math.cos(th * D2R), My = M * Math.sin(th * D2R);
  const Iz = (b * h ** 3) / 12, Iy = (h * b ** 3) / 12;
  const smax = (Mz * (h / 2)) / Iz + (My * (b / 2)) / Iy, phi = Math.atan((Iz / Iy) * Math.tan(th * D2R)) / D2R;
  const ask = Math.random() < 0.6 ? 's' : 'phi';
  const v = ask === 's' ? smax : phi;
  const ang = (90 - th) * D2R, NA = phi * D2R;
  return {
    points: 20,
    prompt: `A ${L} m cantilever has a ${b} mm wide × ${h} mm deep rectangular section. A tip load $P = ${P}$ N acts through the centroid at $${th}^\\circ$ to the vertical. ${ask === 's' ? 'Find the maximum bending stress (MPa) at the support.' : 'Find the angle $\\varphi$ (degrees) between the neutral axis and the horizontal $z$-axis at the support.'}`,
    vars: [], sample: () => ({}), tol: TOL, hint: ask === 's' ? 'Enter MPa.' : 'Enter degrees.', answer: num(v), answerTex: ask === 's' ? `\\sigma_{max} = ${r3(smax)}\\text{ MPa}` : `\\varphi = ${r2(phi)}^\\circ`,
    figure: { kind: 'sketch', height: 260, view: [-0.9 * h, 0.9 * h, -0.75 * h, 0.75 * h], items: [
      { t: 'poly', pts: [[-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, h / 2], [-b / 2, h / 2]], fill: 0, color: 0 },
      { t: 'arrow', x1: 0, y1: 0, x2: 0.55 * h * Math.cos(-ang), y2: 0.55 * h * Math.sin(-ang), color: 1, width: 2.5 }, { t: 'text', x: 0.55 * h * Math.cos(-ang), y: 0.55 * h * Math.sin(-ang), dx: 6, dy: 10, text: `P (${th}°)`, anchor: 'start', color: 1 },
      ...(ask === 'phi' ? [] : [{ t: 'line', x1: -0.8 * h * Math.cos(NA), y1: -0.8 * h * Math.sin(NA), x2: 0.8 * h * Math.cos(NA), y2: 0.8 * h * Math.sin(NA), color: 3, dash: true }, { t: 'text', x: 0.8 * h * Math.cos(NA), y: 0.8 * h * Math.sin(NA), dx: -4, dy: -6, text: 'N.A.', anchor: 'end', color: 3 }]),
      { t: 'line', x1: -0.85 * h, y1: 0, x2: 0.85 * h, y2: 0, color: 'muted' }, { t: 'text', x: 0.85 * h, y: 0, dy: 14, text: 'z', anchor: 'end', color: 'muted' }] },
    steps: [
      { key: 'res', title: 'Resolve the moment onto the principal axes', body: `$M = PL = ${M / 1e6}$ kN·m; $M_z = M\\cos${th}^\\circ = ${r2(Mz / 1e6)}$, $M_y = M\\sin${th}^\\circ = ${r2(My / 1e6)}$ kN·m.` },
      { key: 'I', title: 'Second moments', body: `$I_z = \\frac{bh^3}{12} = ${r2(Iz / 1e6)}\\times10^6$, $I_y = \\frac{hb^3}{12} = ${r2(Iy / 1e6)}\\times10^6$ mm⁴` },
      ask === 's' ? { key: 'sup', title: 'Superpose at the worst corner', body: `$\\sigma_{max} = \\frac{M_z(h/2)}{I_z} + \\frac{M_y(b/2)}{I_y} = ${r3((Mz * (h / 2)) / Iz)} + ${r3((My * (b / 2)) / Iy)} = ${r3(smax)}$ MPa` }
        : { key: 'sup', title: 'Neutral axis (3.7)', body: `$\\tan\\varphi = \\frac{I_z}{I_y}\\tan\\theta = ${r3(Iz / Iy)}\\times\\tan${th}^\\circ$, $\\varphi = ${r2(phi)}^\\circ$. The NA swings towards the weak axis, far more than the load's ${th}°.` },
    ],
    mistakes: ask === 's' ? [
      { expr: num((M * (h / 2)) / Iz), step: 'res', why: 'That treats the load as vertical. Resolve it and add the stress from the weak-axis moment.' },
      { expr: num((Mz * (h / 2)) / Iz), step: 'sup', why: 'The $M_y$ part also stresses the corner: superpose both.' },
    ] : [
      { expr: String(th), step: 'sup', why: 'In unsymmetric bending the neutral axis is not perpendicular to the load plane.' },
      { expr: num(Math.atan((Iy / Iz) * Math.tan(th * D2R)) / D2R), step: 'sup', why: 'Ratio inverted: $\\tan\\varphi = \\frac{I_z}{I_y}\\tan\\theta$.' },
    ],
  };
}

function genShearCentre() {
  if (Math.random() < 0.3) {
    const r = pick([20, 30, 40, 50]);
    return {
      points: 10, prompt: `A thin split circular tube (mean radius $${r}$ mm, slit along one generator) is used as a beam. How far from the tube's centre is the shear centre (mm)?`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter mm.', answer: String(2 * r), answerTex: `e = 2r = ${2 * r}\\text{ mm}`,
      steps: [{ key: 'm', title: 'Moment of the shear flow about the centre', body: R`$q(\theta) = \frac{V}{I}tr^2(1 - \cos\theta)$ with $I = \pi r^3t$; summing $q\,r\,d\theta$ times the arm $r$ over $0..2\pi$ gives $Ve = 2\pi r^2\cdot\frac{Vr}{\pi r^2}$, so $e = 2r$, on the side opposite the slit.` }],
      mistakes: [{ expr: String(r), step: 'm', why: 'The shear centre lies outside the wall: $e = 2r$ from the centre.' }, { expr: '0', step: 'm', why: 'The slit breaks the closed loop, so the centroid is no longer the shear centre.' }],
    };
  }
  const b = pick([40, 50, 60, 75, 100]), h = pick([100, 120, 150, 200]), t = pick([2, 3, 4]);
  const e = (3 * b * b) / (6 * b + h);
  return {
    points: 20,
    prompt: `A channel of uniform thickness $${t}$ mm has flanges $${b}$ mm wide (to the web centreline) and web height $${h}$ mm (between flange centrelines). Find the distance $e$ (mm) from the web centreline to the shear centre.`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter mm.', answer: num(e), answerTex: `e = \\frac{3b^2}{6b + h} = ${r2(e)}\\text{ mm}`,
    figure: { kind: 'sketch', height: 240, view: [-1.2 * e - 20, b + 20, -0.65 * h, 0.65 * h], items: [
      { t: 'poly', pts: [[b, h / 2], [0, h / 2], [0, -h / 2], [b, -h / 2]], open: true, width: 4, color: 0 },
      { t: 'arrow', x1: 0.2 * b, y1: h / 2 + 6, x2: 0.8 * b, y2: h / 2 + 6, color: 2 }, { t: 'arrow', x1: 0.8 * b, y1: -h / 2 - 6, x2: 0.2 * b, y2: -h / 2 - 6, color: 2 }, { t: 'arrow', x1: 6, y1: -0.3 * h, x2: 6, y2: 0.3 * h, color: 2 },
      { t: 'dot', x: -e, y: 0, color: 3, size: 5 }, { t: 'text', x: -e, y: 0, dy: -10, text: 'O', color: 3 }, { t: 'line', x1: -e, y1: -0.5 * h, x2: 0, y2: -0.5 * h, color: 3, dash: true }, { t: 'text', x: -e / 2, y: -0.5 * h, dy: 16, text: `e = ${r2(e)}`, color: 3 },
      { t: 'text', x: b / 2, y: h / 2, dy: -12, text: 'F', color: 2 }, { t: 'text', x: b / 2, y: -h / 2, dy: 22, text: 'F', color: 2 }] },
    steps: [
      { key: 'I', title: 'Second moment (thin walls)', body: `$I \\approx \\frac{th^3}{12} + 2bt\\left(\\frac h2\\right)^2 = ${r2(((t * h ** 3) / 12 + (b * t * h * h) / 2) / 1e6)}\\times10^6$ mm⁴` },
      { key: 'F', title: 'Flange force', body: R`Shear flow grows linearly along a flange, $q = \frac{V}{I}t\,s\frac h2$, so $F = \int_0^b q\,ds = \frac{Vtb^2h}{4I}$.` },
      { key: 'e', title: 'Balance the couple (5.12)', body: `$Ve = Fh \\Rightarrow e = \\frac{tb^2h^2}{4I} = \\frac{3b^2}{6b+h} = ${r2(e)}$ mm, outside the web, away from the flanges.` },
    ],
    mistakes: [
      { expr: num((b * b * h * h * t) / (4 * ((t * h ** 3) / 12))), step: 'I', why: 'The flanges dominate $I$: include $2bt(h/2)^2$.' },
      { expr: num((b * b) / (2 * b + h)), step: 'e', why: 'Check the algebra: $\\frac{tb^2h^2}{4I}$ simplifies to $\\frac{3b^2}{6b+h}$.' },
      { expr: num(b / 2), step: 'e', why: 'The shear centre is not the flange midpoint; it lies outside the section, behind the web.' },
    ],
  };
}

/* ================= Lessons ================= */
const mohrWidget = (sx0, sy0, t0, th0) => ({
  params: [{ key: 'sx', label: 'σx (MPa)', min: -100, max: 100, step: 5, value: sx0 }, { key: 'sy', label: 'σy (MPa)', min: -100, max: 100, step: 5, value: sy0 }, { key: 't', label: 'τxy (MPa)', min: -60, max: 60, step: 5, value: t0 }, { key: 'th', label: 'plane angle θ (°)', min: 0, max: 180, step: 5, value: th0 }],
  panels: [
    { kind: 'sketch', flex: 0.8, height: 300, view: [-2.3, 2.3, -2.3, 2.3], items: (p) => elementItems(p.sx, p.sy, p.t, p.th) },
    { kind: 'sketch', flex: 1.2, height: 300, axes: { x: 'σ', y: 'τ (cw +)', ticks: true }, view: (p) => mohrView(p.sx, p.sy, p.t), items: (p) => mohrItems(p.sx, p.sy, p.t, p.th) },
  ],
  readout: (p) => { const P = princ(p.sx, p.sy, p.t); return `$\\sigma_n = ${r2(sn(p.sx, p.sy, p.t, p.th * D2R))}$, $\\tau_s = ${r2(ts(p.sx, p.sy, p.t, p.th * D2R))}$ MPa $\\;\\cdot\\;$ $\\sigma_{1,2} = ${r2(P.s1)}, ${r2(P.s2)}$, $\\tau_{max} = ${r2(P.R)}$, $\\phi = ${r2(P.phi)}^\\circ$`; },
});

const L0 = [
  { type: 'text', kind: 'key', title: 'Statically determinate or not', body: R`If equilibrium gives as many equations as unknowns, the problem is statically determinate (e.g. a thin-walled pressure vessel). Otherwise you also need compatibility of deformation and the stress–strain law.` },
  { type: 'text', kind: 'method', title: 'Elementary solutions (0.19–0.23)', body: R`Axial: $\sigma = \frac PA$, $\delta = \frac{PL}{AE}$.<br>Torsion: $\tau = \frac{Tr}{J}$, $\theta = \frac{TL}{GJ}$, $J = \frac{\pi d^4}{32}$.<br>Bending: $\sigma = \frac{My}{I}$, $\frac1R = \frac{M}{EI}$.<br>Hooke with temperature: $\varepsilon_x = \frac1E[\sigma_x - \nu(\sigma_y + \sigma_z)] + \alpha\Delta T$.` },
  { type: 'text', kind: 'key', title: 'Thin-walled pressure vessels', body: R`Cylinder: $\sigma_h = \frac{pd}{2t}$ (hoop), $\sigma_a = \frac{pd}{4t}$ (axial), so the hoop stress is twice the axial stress. Sphere: $\sigma = \frac{pd}{4t}$ in all directions. Thin tube in torsion (lecture 2): $\tau = \frac{T}{2A_mt}$, with $A_m$ the area inside the wall's centreline.` },
  {
    type: 'graph', title: 'Hoop vs axial stress',
    body: R`Change the diameter-to-thickness ratio. Both stresses scale with $d/t$, with hoop always twice axial. That's why sausages split lengthwise.`,
    widget: {
      params: [{ key: 'p', label: 'pressure p (MPa)', min: 0.5, max: 10, step: 0.5, value: 3 }, { key: 'dt', label: 'd / t', min: 10, max: 200, step: 5, value: 50 }],
      x: [10, 200], y: 'auto', xLabel: 'd / t', yLabel: 'MPa',
      curves: (p) => [{ fn: (x) => (p.p * x) / 2, label: 'σh = pd/2t' }, { fn: (x) => (p.p * x) / 4, label: 'σa = pd/4t', color: 1 }],
      points: (p) => [{ x: p.dt, y: (p.p * p.dt) / 2, label: `${r2((p.p * p.dt) / 2)}` }, { x: p.dt, y: (p.p * p.dt) / 4, label: `${r2((p.p * p.dt) / 4)}`, color: 1 }],
    },
  },
  { type: 'example', title: 'Example 1 (Chapter 1): pressurized tube in torsion', prompt: R`$d = 250$ mm, $t = 5$ mm, $p = 3$ MPa, $T = 15$ kN·m. Wall stresses?`, steps: [
    R`$\sigma_h = \frac{3(250)}{2(5)} = 75$ MPa, $\sigma_a = 37.5$ MPa.`,
    R`$\tau = \frac{T}{2\pi r^2t} = \frac{15\times10^6}{2\pi(125)^2(5)} = 30.6$ MPa.`,
    R`So the wall element has $\sigma_x = 37.5$, $\sigma_y = 75$, $\tau_{xy} = 30.6$ MPa: a combined state, which Chapter 1 transforms.`,
  ] },
  { type: 'quiz', prompt: R`A steel bar fixed between rigid walls is cooled. It is`, options: [{ tex: 'In tension', correct: true }, { tex: 'In compression', why: 'Cooling makes it want to shrink; the walls hold it stretched.' }, { tex: 'Stress-free', why: 'Free thermal strain is prevented, so stress develops: $\\sigma = -E\\alpha\\Delta T$ with $\\Delta T < 0$.' }] },
];
const L1a = [
  { type: 'text', kind: 'key', title: 'Stress on an inclined plane', body: R`Combined loading (pressure + torque, bending + torsion) can be more severe on some inclined plane than on the $x$ or $y$ faces. For plane stress ($\sigma_x, \sigma_y, \tau_{xy}$), force equilibrium of a wedge gives, with $\theta$ the angle of the plane's outward normal from $x$: $$\sigma_n = \tfrac{\sigma_x+\sigma_y}{2} + \tfrac{\sigma_x-\sigma_y}{2}\cos2\theta + \tau_{xy}\sin2\theta \quad (1.1)$$ $$\tau_s = \tfrac{\sigma_x-\sigma_y}{2}\sin2\theta - \tau_{xy}\cos2\theta \quad (1.2)$$` },
  { type: 'text', kind: 'method', title: 'Uniaxial check', body: R`With only $\sigma_x$: $\sigma_n = \sigma_x\cos^2\theta$ (largest at $\theta = 0$) and $|\tau_s| = \frac{\sigma_x}{2}\sin2\theta$ (largest, $\sigma_x/2$, at $45^\circ$). Those $45^\circ$ planes are where ductile materials slip.` },
  { type: 'graph', title: "Rotate the plane, walk around Mohr's circle", body: R`Left: the element and the plane's normal $n$. Right: Mohr's circle. Turning the plane by $\theta$ moves the point by $2\theta$ around the circle, starting from X. Shear is plotted clockwise-positive, as on the slides.`, widget: mohrWidget(40, 80, -20, 45) },
  { type: 'example', title: 'Slides example: σx = 40, σy = 80, τxy = −20', prompt: R`Normal and shear stress on the plane $45^\circ$ CCW from the $y$-axis.`, steps: [
    R`$\theta = 45^\circ$, $2\theta = 90^\circ$.`,
    R`$\sigma_n = 60 + (-20)\cos90^\circ + (-20)\sin90^\circ = 40$ MPa.`,
    R`$\tau_s = (-20)\sin90^\circ - (-20)\cos90^\circ = -20$ MPa: negative, so it acts opposite to the direction drawn.`,
  ] },
  { type: 'text', kind: 'key', title: "Mohr's circle", body: R`Squaring and adding (1.1) and (1.2) eliminates $\theta$: $(\sigma_n - C)^2 + \tau_s^2 = R^2$ with centre $C = \frac{\sigma_x+\sigma_y}{2}$ and radius $R = \sqrt{\left(\frac{\sigma_x-\sigma_y}{2}\right)^2 + \tau_{xy}^2}$. Every plane through the point is one point on this circle.` },
  { type: 'quiz', prompt: R`On Mohr's circle, two planes $90^\circ$ apart on the element are`, options: [{ tex: R`$180^\circ$ apart (opposite ends of a diameter)`, correct: true }, { tex: R`$90^\circ$ apart`, why: R`Angles double on the circle.` }, { tex: R`$45^\circ$ apart`, why: R`Angles double, they don't halve.` }] },
];
const L1b = [
  { type: 'text', kind: 'key', title: 'Principal stresses', body: R`Principal planes carry no shear. On them act the principal stresses $\sigma_{1,2} = C \pm R$ (1.5, 1.6), the largest and smallest normal stresses at the point. $\tan2\phi = \frac{2\tau_{xy}}{\sigma_x - \sigma_y}$, and the two principal planes are perpendicular.` },
  { type: 'text', kind: 'key', title: 'Maximum shear', body: R`$\tau_{max} = R = \frac{\sigma_1 - \sigma_2}{2}$ at the top and bottom of the circle, on planes $45^\circ$ from the principal planes. Those planes still carry normal stress $C$.` },
  { type: 'graph', title: 'Find the principal planes', body: R`Set $\theta$ so the point sits on the $\sigma$-axis: that plane carries $\sigma_1$ and no shear. Then add $45^\circ$ to reach $\tau_{max}$.`, widget: mohrWidget(60, -20, 30, 0) },
  { type: 'example', title: 'Example 3: helicopter drive shaft', prompt: R`$d = 50$ mm, axial tension $44.5$ kN, torque $0.4$ kN·m. Principal stresses on the surface?`, steps: [
    R`$\sigma_x = \frac{4F}{\pi d^2} = \frac{4(44500)}{\pi(50)^2} = 22.7$ MPa, $\sigma_y = 0$.`,
    R`$\tau_{xy} = \frac{16T}{\pi d^3} = \frac{16(0.4\times10^6)}{\pi(50)^3} = 16.3$ MPa.`,
    R`$C = 11.3$, $R = \sqrt{11.3^2 + 16.3^2} = 19.8$, so $\sigma_1 = 31.2$, $\sigma_2 = -8.5$ MPa, $\tau_{max} = 19.8$ MPa.`,
  ] },
  { type: 'example', title: 'Example 4: finding T from the fracture angle', prompt: R`Closed thin cylinder, $d = 25$, $t = 2$ mm, $p = 10$ MPa, fractures on the max-shear plane at $35^\circ$ to the axis. Find $T$.`, steps: [
    R`$\sigma_x = \frac{pd}{4t} = 31.25$, $\sigma_y = \frac{pd}{2t} = 62.5$ MPa.`,
    R`The fracture plane is a max-shear plane, $45^\circ$ from a principal plane. That fixes the principal direction $\phi$, and $\tan2\phi = \frac{2\tau_{xy}}{\sigma_x - \sigma_y}$ links it to the unknown $\tau_{xy}$. Sketch the element to get the angle's sign right.`,
    R`With $\sigma_x - \sigma_y = -31.25$ MPa known, solve for $\tau_{xy}$, then $T = \tau_{xy}\cdot2\pi r^2t$ and $\sigma_{1,2} = C \pm R$.`,
  ] },
  { type: 'input', prompt: R`$\sigma_x = 80$, $\sigma_y = 20$, $\tau_{xy} = 40$ MPa. $\sigma_1$ = ?`, answer: '100', explain: R`$C = 50$, $R = \sqrt{30^2 + 40^2} = 50$, $\sigma_1 = 100$ MPa.` },
];
const L1c = [
  { type: 'text', kind: 'key', title: 'Strain transformation', body: R`Strains transform exactly like stresses with $\tau \to \gamma/2$: $$\varepsilon_n = \tfrac{\varepsilon_x+\varepsilon_y}{2} + \tfrac{\varepsilon_x-\varepsilon_y}{2}\cos2\theta + \tfrac{\gamma_{xy}}{2}\sin2\theta \quad (1.10)$$ Mohr's strain circle has centre $\frac{\varepsilon_x+\varepsilon_y}{2}$ and radius $\sqrt{(\frac{\varepsilon_x-\varepsilon_y}{2})^2 + (\frac{\gamma_{xy}}{2})^2}$.` },
  { type: 'text', kind: 'method', title: 'Strain gauges and rosettes', body: R`A gauge reads only the normal strain along its axis. Three gauges at $0^\circ, 45^\circ, 90^\circ$ give $\varepsilon_x = \varepsilon_0$, $\varepsilon_y = \varepsilon_{90}$ and $\gamma_{xy} = 2\varepsilon_{45} - \varepsilon_0 - \varepsilon_{90}$.` },
  { type: 'graph', title: "Mohr's strain circle", body: R`Same geometry as for stress, with $\gamma/2$ on the vertical axis. Principal strain directions coincide with principal stress directions (isotropic material).`, widget: {
    params: [{ key: 'ex', label: 'εx (με)', min: -600, max: 800, step: 50, value: 400 }, { key: 'ey', label: 'εy (με)', min: -600, max: 800, step: 50, value: -100 }, { key: 'g', label: 'γxy (με)', min: -800, max: 800, step: 50, value: 300 }],
    kind: 'sketch', height: 300, axes: { x: 'ε', y: 'γ/2 (cw +)', ticks: true }, view: (p) => mohrView(p.ex, p.ey, p.g / 2),
    items: (p) => mohrItems(p.ex, p.ey, p.g / 2).map((it) => (it.t === 'text' ? { ...it, text: it.text.replace('σx', 'εx').replace('σy', 'εy').replace('τxy', 'γ/2').replace('σ1', 'ε1').replace('σ2', 'ε2').replace('τmax', 'γmax/2') } : it)),
    readout: (p) => { const P = princ(p.ex, p.ey, p.g / 2); return `$\\varepsilon_{1,2} = ${r2(P.s1)}, ${r2(P.s2)}\\ \\mu\\varepsilon$; $\\gamma_{max} = ${r2(2 * P.R)}\\ \\mu\\varepsilon$`; },
  } },
  { type: 'text', kind: 'method', title: 'From strains to stresses', body: R`Plane stress Hooke's law in principal axes: $\sigma_1 = \frac{E}{1-\nu^2}(\varepsilon_1 + \nu\varepsilon_2)$, $\sigma_2 = \frac{E}{1-\nu^2}(\varepsilon_2 + \nu\varepsilon_1)$, and $\tau = G\gamma$ with $G = \frac{E}{2(1+\nu)}$.` },
  { type: 'example', title: 'Example 5: propeller shaft with two gauges', prompt: R`Gauge along the axis: $-142\,\mu\varepsilon$; gauge at $45^\circ$: $-421\,\mu\varepsilon$. No bending.`, steps: [
    R`Axial gauge: $\varepsilon_x = -142$. Hoop direction has no applied stress, so $\varepsilon_y = -\nu\varepsilon_x$ from the thrust alone.`,
    R`The 45° gauge picks up $\frac{\varepsilon_x+\varepsilon_y}{2} + \frac{\gamma_{xy}}{2}$: solve for $\gamma_{xy}$, then $\tau = G\gamma_{xy}$ gives the torque and $\sigma_x = E\varepsilon_x$ the thrust.`,
    R`Power $= T\omega$ with $\omega = 100\cdot\frac{2\pi}{60}$ rad/s.`,
  ] },
  { type: 'quiz', prompt: R`Gauges read $\varepsilon_0 = 300$, $\varepsilon_{45} = 200$, $\varepsilon_{90} = -100$ $\mu\varepsilon$. $\gamma_{xy}$ = ?`, options: [{ tex: '$200\\ \\mu\\varepsilon$', correct: true }, { tex: '$400\\ \\mu\\varepsilon$', why: R`$2(200) - 300 - (-100) = 200$, not $2\varepsilon_{45}$ alone.` }, { tex: '$100\\ \\mu\\varepsilon$', why: R`Don't halve: $\gamma_{xy} = 2\varepsilon_{45} - \varepsilon_0 - \varepsilon_{90}$.` }] },
];
const L2 = [
  { type: 'text', kind: 'key', title: 'Ductile vs brittle', body: R`Ductile materials yield (permanent set) at $\sigma_y$ before breaking; brittle ones fracture near $\sigma_u$ with little warning. A uniaxial test gives one number. The failure theories extend it to combined stress states.` },
  { type: 'text', kind: 'method', title: 'The criteria', body: R`Rankine (max principal stress, 2.10): $|\sigma_i| \ge \sigma_y$. Poor for ductile metals; OK for brittle.<br>Tresca (max shear, 2.11): $\max|\sigma_i - \sigma_j| \ge \sigma_y$.<br>von Mises (distortion energy, 2.24): $\sigma_1^2 - \sigma_1\sigma_2 + \sigma_2^2 \ge \sigma_y^2$. Best for ductile metals.<br>Mohr, brittle (2.25): $\frac{\sigma_1}{\sigma_{ut}} - \frac{\sigma_2}{\sigma_{uc}} \ge 1$.` },
  { type: 'graph', title: 'Yield loci in the σ₁–σ₂ plane', body: R`Inside the hexagon (Tresca) or the ellipse (von Mises): no yielding. Move the stress point; the safety factor is how far you could scale it before reaching the boundary.`, widget: {
    params: [{ key: 's1', label: 'σ1 (MPa)', min: -300, max: 300, step: 10, value: 150 }, { key: 's2', label: 'σ2 (MPa)', min: -300, max: 300, step: 10, value: -100 }],
    kind: 'sketch', height: 320, axes: { x: 'σ1', y: 'σ2' }, view: [-400, 400, -330, 330], items: (p) => yieldItems(250, p.s1, p.s2),
    readout: (p) => { const tr = Math.max(Math.abs(p.s1 - p.s2), Math.abs(p.s1), Math.abs(p.s2)), vm = Math.sqrt(p.s1 ** 2 - p.s1 * p.s2 + p.s2 ** 2); return `$\\sigma_y = 250$: Tresca $n = ${tr ? r3(250 / tr) : '\\infty'}$, von Mises $n = ${vm ? r3(250 / vm) : '\\infty'}$ (Tresca is never less conservative)`; },
  } },
  { type: 'quiz', prompt: R`Plane stress with $\sigma_1 = 100$, $\sigma_2 = 60$ MPa ($\sigma_3 = 0$). Tresca's equivalent stress is`, options: [{ tex: '$100$ MPa', correct: true }, { tex: '$40$ MPa', why: R`Include $\sigma_3 = 0$: the largest circle is between $\sigma_1 = 100$ and $\sigma_3 = 0$.` }, { tex: '$160$ MPa', why: 'Tresca uses differences of principal stresses.' }] },
  { type: 'example', title: 'Slides example: pressurized tube in torsion', prompt: R`$d = 250$, $t = 5$ mm, $p = 6$ MPa, $T = 30$ kN·m, $\sigma_y = 280$ MPa.`, steps: [
    R`$\sigma_a = 75$, $\sigma_h = 150$ MPa, $\tau = \frac{T}{2\pi r^2t} = 61.1$ MPa.`,
    R`$C = 112.5$, $R = \sqrt{37.5^2 + 61.1^2} = 71.7$: $\sigma_1 = 184.2$, $\sigma_2 = 40.8$ MPa.`,
    R`Tresca: both positive, so $\sigma_{eq} = \sigma_1 - 0 = 184.2$ and $n = 280/184.2 = 1.52$. von Mises: $\sigma_e = 167.6$, $n = 1.67$.`,
  ] },
  { type: 'text', kind: 'method', title: 'Shafts in bending + torsion', body: R`At the surface $\sigma = \frac{32M}{\pi d^3}$, $\tau = \frac{16T}{\pi d^3}$. Tresca: $\sqrt{\sigma^2 + 4\tau^2} \le \sigma_y$. von Mises: $\sqrt{\sigma^2 + 3\tau^2} \le \sigma_y$.` },
  { type: 'input', prompt: R`von Mises equivalent stress for pure shear $\tau = 100$ MPa?`, answer: '173.205', tol: 1e-3, answerTex: '100\\sqrt3', explain: R`$\sigma_{1,2} = \pm100$: $\sqrt{100^2 + 100^2 + 100^2} = 100\sqrt3$. So in shear, von Mises predicts yield at $\tau = \sigma_y/\sqrt3$, Tresca at $\sigma_y/2$.` },
];
const L3a = [
  { type: 'text', kind: 'key', title: 'Symmetric vs unsymmetric bending', body: R`Simple beam theory ($\sigma = My/I$) needs the moment to act about a principal centroidal axis, which is automatic when the section has an axis of symmetry in the load plane. Otherwise the neutral axis tilts away from the moment vector.` },
  { type: 'text', kind: 'key', title: 'Product moment and principal axes', body: R`$I_{yz} = \int yz\,dA$ is zero about symmetry axes. Axes with $I_{yz} = 0$ are the principal centroidal axes $v, w$. Second moments transform like stresses: $I_{max,min} = \frac{I_y + I_z}{2} \pm \sqrt{\left(\frac{I_z - I_y}{2}\right)^2 + I_{yz}^2}$ (Mohr's circle for area moments).` },
  { type: 'graph', title: 'Principal axes of an angle', body: R`Change the leg lengths. Equal legs put the principal axes at exactly $45^\circ$. Lengthen the vertical leg and the major axis $v$ (largest $I$) swings down towards the horizontal: the material sits far above and below it.`, widget: {
    params: [{ key: 'A', label: 'vertical leg (mm)', min: 60, max: 160, step: 5, value: 120 }, { key: 'B', label: 'horizontal leg (mm)', min: 60, max: 160, step: 5, value: 90 }],
    kind: 'sketch', height: 300, view: [-40, 190, -30, 190],
    items: (p) => { const P = angleProps(p.A, p.B, 10); return [{ t: 'poly', pts: [[0, 0], [p.B, 0], [p.B, 10], [10, 10], [10, p.A], [0, p.A]], fill: 0, color: 0 }, { t: 'dot', x: P.zc, y: P.yc, color: 3 }, ...principalLines(P, 95)]; },
    readout: (p) => { const P = angleProps(p.A, p.B, 10); return `$I_z = ${r3(P.Iz / 1e6)}$, $I_y = ${r3(P.Iy / 1e6)}$, $|I_{yz}| = ${r3(Math.abs(P.Iyz) / 1e6)}$; $I_{max} = ${r3(P.Imax / 1e6)}$, $I_{min} = ${r3(P.Imin / 1e6)}$ (×10⁶ mm⁴); $\\beta = ${r2(P.beta)}^\\circ$`; },
  } },
  { type: 'example', title: 'Slides example: 120 × 90 × 10 angle', prompt: R`Principal axes and second moments.`, steps: [
    R`Centroid from the outer corner: $\bar y = 38$ mm up, $\bar z = 23$ mm across (two rectangles).`,
    R`Parallel axes: $I_z = 2.899$, $I_y = 1.409$, $I_{yz} = -1.188$ ($\times10^6$ mm⁴); $I_{yz} \ne 0$ because the section has no axis of symmetry.`,
    R`Mohr's circle: $I_v = 3.556\times10^{-6}$ m⁴, $I_w = 0.752\times10^{-6}$ m⁴, $\beta = 28.9^\circ$. (The slide text reads 5.556, but $I_v + I_w$ must equal $I_y + I_z = 4.307$, so 3.556 it is.)`,
  ] },
  { type: 'quiz', prompt: R`For which section is $I_{yz} = 0$ about its centroidal $y$–$z$ axes?`, options: [{ tex: 'A channel (C) with $z$ along its axis of symmetry', correct: true }, { tex: 'An unequal angle (L)', why: 'An L has no axis of symmetry.' }, { tex: 'A Z-section', why: 'A Z has a centre of symmetry but its flanges sit in opposite quadrants, so $I_{yz} \\ne 0$.' }] },
];
const L3b = [
  { type: 'text', kind: 'method', title: 'Bending about two principal axes', body: R`Resolve $M$ onto the principal axes and superpose: $\sigma_x = \frac{M_v w}{I_v} - \frac{M_w v}{I_w}$ (3.6, signs from the slides' convention). For a rectangle the $y$, $z$ axes are already principal: $\sigma = \frac{M_z y}{I_z} + \frac{M_y z}{I_y}$, largest at a corner.` },
  { type: 'text', kind: 'key', title: 'The neutral axis tilts', body: R`Setting $\sigma = 0$ gives (3.7) $\tan\varphi = \frac{I_z}{I_y}\tan\theta$, where $\theta$ is the angle of the moment vector (or the load from the vertical). Unless $I_y = I_z$, the neutral axis is not perpendicular to the load plane.` },
  { type: 'graph', title: 'Tilt the load, watch the neutral axis swing', body: R`A tall rectangle is stiff about $z$ and weak about $y$. A small tilt of the load swings the neutral axis a long way towards the weak direction.`, widget: {
    params: [{ key: 'th', label: 'load angle from vertical (°)', min: 0, max: 89, step: 1, value: 30 }, { key: 'b', label: 'width b (mm)', min: 20, max: 90, step: 5, value: 40 }],
    kind: 'sketch', height: 300, view: [-90, 90, -75, 75],
    items: (p) => { const h = 90, b = p.b, Iz = (b * h ** 3) / 12, Iy = (h * b ** 3) / 12, phi = Math.atan((Iz / Iy) * Math.tan(p.th * D2R)), a = (90 - p.th) * D2R; return [{ t: 'poly', pts: [[-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, h / 2], [-b / 2, h / 2]], fill: 0, color: 0 }, { t: 'arrow', x1: 0, y1: 0, x2: 55 * Math.cos(-a), y2: 55 * Math.sin(-a), color: 1, width: 2.5 }, { t: 'text', x: 55 * Math.cos(-a), y: 55 * Math.sin(-a), dx: 6, dy: 10, text: 'P', anchor: 'start', color: 1 }, { t: 'line', x1: -80 * Math.cos(phi), y1: -80 * Math.sin(phi), x2: 80 * Math.cos(phi), y2: 80 * Math.sin(phi), color: 3, dash: true }, { t: 'text', x: 80 * Math.cos(phi), y: 80 * Math.sin(phi), dy: -6, text: 'N.A.', anchor: 'end', color: 3 }, { t: 'line', x1: -85, y1: 0, x2: 85, y2: 0, color: 'muted' }]; },
    readout: (p) => { const h = 90, Iz = (p.b * h ** 3) / 12, Iy = (h * p.b ** 3) / 12; return `$I_z/I_y = ${r3(Iz / Iy)}$: neutral axis at $\\varphi = ${r2(Math.atan((Iz / Iy) * Math.tan(p.th * D2R)) / D2R)}^\\circ$ from $z$ (a symmetric-bending NA would be at ${p.th}°)`; },
  } },
  { type: 'example', title: 'Example A: cantilever with an inclined load', prompt: R`2 m cantilever, $40\times90$ mm section, $P = 100$ N at $30^\circ$ to the vertical.`, steps: [
    R`$M = 200$ N·m; $M_z = 173.2$, $M_y = 100$ N·m.`,
    R`$I_z = \frac{40(90)^3}{12} = 2.43\times10^6$, $I_y = \frac{90(40)^3}{12} = 0.48\times10^6$ mm⁴.`,
    R`$\sigma_{max} = \frac{173200(45)}{2.43\times10^6} + \frac{100000(20)}{0.48\times10^6} = 3.21 + 4.17 = 7.37$ MPa at opposite corners (tension/compression).`,
    R`$\tan\varphi = 5.06\tan30^\circ = 2.92$: $\varphi = 71.1^\circ$.`,
  ] },
  { type: 'quiz', prompt: R`Why must the load pass through the shear centre (for a channel, not the centroid)?`, options: [{ tex: 'Otherwise the section twists as well as bends', correct: true }, { tex: 'Otherwise the neutral axis is not centroidal', why: 'The neutral axis passes through the centroid regardless; the issue is twisting.' }, { tex: 'It changes $I_{yz}$', why: 'Section properties do not depend on where the load acts.' }] },
];
const L3c = [
  { type: 'text', kind: 'key', title: 'Shear flow in thin-walled open sections', body: R`$\tau = \frac{VQ}{It}$ and $q = \tau t = \frac{VQ}{I}$ (3.8, 3.9), where $Q$ is the first moment of the area cut off between a free edge and the point. In a channel, the flange shear flows form a couple $Fh$ that twists the section.` },
  { type: 'text', kind: 'key', title: 'Shear centre', body: R`The point the load must pass through for bending without twist: $Pe = Fh$ (5.12). It depends only on geometry. It lies on any axis of symmetry and, for open sections like channels, often outside the material.` },
  { type: 'graph', title: 'Channel shear centre', body: R`Wider flanges carry bigger forces $F$, so the shear centre moves further behind the web: $e = \frac{3b^2}{6b + h}$ (uniform thickness).`, widget: {
    params: [{ key: 'b', label: 'flange b (mm)', min: 20, max: 120, step: 5, value: 60 }, { key: 'h', label: 'web h (mm)', min: 60, max: 240, step: 10, value: 150 }],
    kind: 'sketch', height: 300, view: [-80, 140, -135, 135],
    items: (p) => { const e = (3 * p.b * p.b) / (6 * p.b + p.h), h = p.h, b = p.b; return [{ t: 'poly', pts: [[b, h / 2], [0, h / 2], [0, -h / 2], [b, -h / 2]], open: true, width: 4, color: 0 }, { t: 'arrow', x1: 0.15 * b, y1: h / 2 + 7, x2: 0.85 * b, y2: h / 2 + 7, color: 2 }, { t: 'arrow', x1: 0.85 * b, y1: -h / 2 - 7, x2: 0.15 * b, y2: -h / 2 - 7, color: 2 }, { t: 'arrow', x1: 7, y1: -0.3 * h, x2: 7, y2: 0.3 * h, color: 2 }, { t: 'dot', x: -e, y: 0, color: 3, size: 5 }, { t: 'text', x: -e, y: 0, dy: -10, text: 'O', color: 3 }, { t: 'arrow', x1: -e, y1: 0.45 * h, x2: -e, y2: 0.05 * h, color: 1 }, { t: 'text', x: -e, y: 0.45 * h, dy: -6, text: 'P', color: 1 }]; },
    readout: (p) => `$e = \\frac{3(${p.b})^2}{6(${p.b}) + ${p.h}} = ${r2((3 * p.b * p.b) / (6 * p.b + p.h))}$ mm behind the web`,
  } },
  { type: 'example', title: 'Split circular tube (slides)', prompt: R`$r = 30$ mm, $t = 4$ mm, $P = 10$ kN. Where must the load act?`, steps: [
    R`$I = \pi r^3t$. Shear flow from the slit: $q(\theta) = \frac{Vtr^2}{I}(1 - \cos\theta)$.`,
    R`Moments about the centre: $\int_0^{2\pi} q\,r\cdot r\,d\theta = \frac{Vtr^4}{I}2\pi = 2Vr$.`,
    R`$Ve = 2Vr$: $e = 2r = 60$ mm from the centre, on the side away from the slit.`,
  ] },
  { type: 'quiz', prompt: R`An I-beam with two axes of symmetry: its shear centre is`, options: [{ tex: 'At the centroid', correct: true }, { tex: 'Behind the web', why: 'That is the channel case (one axis of symmetry).' }, { tex: 'At the top flange', why: 'With two axes of symmetry, the shear centre is where they cross.' }] },
];

SA.registerCourse({
  course: 'MAAE 3202',
  chapters: [
    { id: 's-rev', name: 'Review: stress and strain at a point' },
    { id: 's-trans', name: 'Transformation of stress and strain' },
    { id: 's-fail', name: 'Failure theories' },
    { id: 's-bend', name: 'Unsymmetric bending and shear centre' },
  ],
  topics: [
    { id: 'so-vessel', ch: 's-rev', sec: 'ch0', name: 'Thin-walled pressure vessels', desc: 'pd/2t and pd/4t.', gen: genVessel },
    { id: 'so-torsion', ch: 's-rev', sec: 'ch0', name: 'Torsion', desc: 'Tr/J, TL/GJ, T/2Aₘt.', gen: genTorsion },
    { id: 'so-thermal', ch: 's-rev', sec: 'ch0', name: 'Thermal stress', desc: '−EαΔT when restrained.', gen: genThermal },
    { id: 'so-incline', ch: 's-trans', sec: 'ch1a', name: 'Stress on an inclined plane', desc: 'Equations 1.1 and 1.2.', gen: genIncline },
    { id: 'so-principal', ch: 's-trans', sec: 'ch1b', name: 'Principal stresses', desc: "Mohr's circle: C ± R.", gen: genPrincipal },
    { id: 'so-strain', ch: 's-trans', sec: 'ch1c', name: 'Strain transformation', desc: 'Gauges, rosettes, principal strains.', gen: genStrain },
    { id: 'so-yield', ch: 's-fail', sec: 'ch2', name: 'Tresca and von Mises', desc: 'Safety factor against yielding.', gen: genYield },
    { id: 'so-brittle', ch: 's-fail', sec: 'ch2', name: 'Mohr brittle criterion', desc: 'σ₁/σut − σ₂/σuc = 1/n.', gen: genMohrBrittle },
    { id: 'so-inertia', ch: 's-bend', sec: 'ch3a', name: 'Principal second moments', desc: 'Iyz and Mohr for areas.', gen: genInertia },
    { id: 'so-unsym', ch: 's-bend', sec: 'ch3b', name: 'Unsymmetric bending', desc: 'Superpose; tilted neutral axis.', gen: genUnsym },
    { id: 'so-shear', ch: 's-bend', sec: 'ch3c', name: 'Shear centre', desc: 'Pe = Fh.', gen: genShearCentre },
  ],
  sections: [
    { id: 'ch0', tag: 'Ch 0', num: '0', title: 'Review: elementary solutions', chapter: 'Chapter 0 · Review', skills: ['so-vessel', 'so-torsion', 'so-thermal'], lesson: L0 },
    { id: 'ch1a', tag: 'Ch 1', num: '1.1', title: "Stress transformation and Mohr's circle", chapter: 'Chapter 1 · Midterm Nov 5', skills: ['so-incline'], lesson: L1a },
    { id: 'ch1b', tag: 'Ch 1', num: '1.4', title: 'Principal stresses and maximum shear', chapter: 'Chapter 1 · Midterm Nov 5', skills: ['so-principal'], lesson: L1b },
    { id: 'ch1c', tag: 'Ch 1', num: '1.5', title: 'Strain transformation and gauges', chapter: 'Chapter 1 · Midterm Nov 5', skills: ['so-strain'], lesson: L1c },
    { id: 'ch2', tag: 'Ch 2', num: '2', title: 'Failure theories', chapter: 'Chapter 2 · Midterm Nov 5', skills: ['so-yield', 'so-brittle'], lesson: L2 },
    { id: 'ch3a', tag: 'Ch 3', num: '3.3', title: 'Principal axes of a cross-section', chapter: 'Chapter 3 · Midterm Nov 5', skills: ['so-inertia'], lesson: L3a },
    { id: 'ch3b', tag: 'Ch 3', num: '3.4', title: 'Unsymmetric bending', chapter: 'Chapter 3 · Midterm Nov 5', skills: ['so-unsym'], lesson: L3b },
    { id: 'ch3c', tag: 'Ch 3', num: '3.5', title: 'Shear centre', chapter: 'Chapter 3 · Midterm Nov 5', skills: ['so-shear'], lesson: L3c },
  ],
});
