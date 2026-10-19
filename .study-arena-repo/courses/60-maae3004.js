// MAAE 3004 — Dynamics of Machinery (Winter). First half of the course, built ahead of time from the
// calendar description and standard texts (Norton, Uicker/Pennock/Shigley): mobility and Grashof,
// position, velocity and acceleration analysis, dynamic force analysis and balancing.
const { R, pick, randInt, rand, rnd } = SA;
const D2R = Math.PI / 180;
const r2 = (v) => +v.toFixed(2), r3 = (v) => +v.toFixed(3), r4 = (v) => +v.toFixed(4);
const num = (v) => String(rnd(v));
const TOL = 3e-3;

/* ---------- kinematics helpers ---------- */
// Four-bar: crank a (O2 at origin), coupler b, rocker c (O4 at (d, 0)), ground d. Open configuration.
function fourbar(a, b, c, d, th2) {
  const Bx = a * Math.cos(th2), By = a * Math.sin(th2);
  const dx = d - Bx, dy = -By, e = Math.hypot(dx, dy);
  if (e > b + c || e < Math.abs(b - c)) return null;
  const phi = Math.atan2(dy, dx), alpha = Math.acos((b * b + e * e - c * c) / (2 * b * e));
  const th3 = phi + alpha, Cx = Bx + b * Math.cos(th3), Cy = By + b * Math.sin(th3);
  const th4 = Math.atan2(Cy, Cx - d);
  return { Bx, By, Cx, Cy, th3, th4 };
}
const fbOmega = (a, b, c, th2, th3, th4, w2) => ({ w3: (a * w2 * Math.sin(th4 - th2)) / (b * Math.sin(th3 - th4)), w4: (a * w2 * Math.sin(th2 - th3)) / (c * Math.sin(th4 - th3)) });
// Slider-crank (in line): crank r, connecting rod l, crank angle θ from the slider axis.
const scX = (r, l, t) => r * Math.cos(t) + Math.sqrt(l * l - r * r * Math.sin(t) ** 2);
const scV = (r, l, t, w) => w * (-r * Math.sin(t) - (r * r * Math.sin(t) * Math.cos(t)) / Math.sqrt(l * l - r * r * Math.sin(t) ** 2));
const scA = (r, l, t, w) => { const s = Math.sin(t), c = Math.cos(t), D = Math.sqrt(l * l - r * r * s * s); return w * w * (-r * c - (r * r * (c * c - s * s)) / D - (r ** 4 * s * s * c * c) / D ** 3); };
const deg = (v) => ((v / D2R) % 360 + 360) % 360;

/* ---------- sketches ---------- */
function fourbarItems(a, b, c, d, th2, extra = []) {
  const P = fourbar(a, b, c, d, th2);
  const items = [{ t: 'line', x1: -0.3 * d, y1: 0, x2: 1.3 * d, y2: 0, color: 'muted', dash: true }];
  if (!P) return [...items, { t: 'text', x: d / 2, y: 0.5 * d, text: 'cannot assemble at this angle', color: 3 }];
  items.push(
    { t: 'line', x1: 0, y1: 0, x2: P.Bx, y2: P.By, color: 0, width: 5 },
    { t: 'line', x1: P.Bx, y1: P.By, x2: P.Cx, y2: P.Cy, color: 1, width: 5 },
    { t: 'line', x1: d, y1: 0, x2: P.Cx, y2: P.Cy, color: 2, width: 5 },
    { t: 'poly', pts: [[-0.06 * d, -0.08 * d], [0.06 * d, -0.08 * d], [0, 0]], color: 'text', fill: 'muted' },
    { t: 'poly', pts: [[d - 0.06 * d, -0.08 * d], [d + 0.06 * d, -0.08 * d], [d, 0]], color: 'text', fill: 'muted' },
    ...[[0, 0], [P.Bx, P.By], [P.Cx, P.Cy], [d, 0]].map(([x, y]) => ({ t: 'dot', x, y, color: 'text', size: 4 })),
    { t: 'text', x: P.Bx / 2, y: P.By / 2, dx: -10, text: 'a (crank)', anchor: 'end', color: 0, size: 11 },
    { t: 'text', x: (P.Bx + P.Cx) / 2, y: (P.By + P.Cy) / 2, dy: -10, text: 'b', color: 1, size: 12 },
    { t: 'text', x: (d + P.Cx) / 2, y: P.Cy / 2, dx: 10, text: 'c', anchor: 'start', color: 2, size: 12 },
    { t: 'text', x: 0, y: 0, dy: 22, text: 'O₂', size: 11 }, { t: 'text', x: d, y: 0, dy: 22, text: 'O₄', size: 11 },
    ...extra,
  );
  return items;
}
function sliderItems(r, l, t) {
  const Ax = r * Math.cos(t), Ay = r * Math.sin(t), x = scX(r, l, t), w = 0.35 * r, h = 0.25 * r;
  return [
    { t: 'line', x1: -1.2 * r, y1: -h, x2: r + l + 0.6 * r, y2: -h, color: 'muted' },
    { t: 'circle', x: 0, y: 0, r, color: 'muted', dash: true, width: 1 },
    { t: 'line', x1: 0, y1: 0, x2: Ax, y2: Ay, color: 0, width: 5 },
    { t: 'line', x1: Ax, y1: Ay, x2: x, y2: 0, color: 1, width: 5 },
    { t: 'poly', pts: [[x - w, -h], [x + w, -h], [x + w, h], [x - w, h]], color: 2, fill: true, opacity: 0.25 },
    { t: 'dot', x: 0, y: 0, color: 'text' }, { t: 'dot', x: Ax, y: Ay, color: 'text' }, { t: 'dot', x, y: 0, color: 'text' },
    { t: 'arc', x: 0, y: 0, r: 0.3 * r, a0: 0, a1: t % (2 * Math.PI), color: 3 },
    { t: 'text', x: 0.42 * r, y: 0.12 * r, text: 'θ', color: 3, anchor: 'start' },
    { t: 'line', x1: 0, y1: -1.6 * h, x2: x, y2: -1.6 * h, color: 3, width: 1 }, { t: 'text', x: x / 2, y: -1.6 * h, dy: 14, text: `x = ${r2(x)}`, color: 3, size: 11 },
  ];
}

/* ================= generators ================= */
function genMobility() {
  if (Math.random() < 0.45) {
    // Grashof classification
    const base = pick([[2, 7, 9, 6], [3, 8, 7, 6], [4, 6, 9, 10], [5, 4, 8, 9], [2, 9, 5, 7], [3, 5, 7, 4], [4, 7, 6, 9]]);
    const order = pick([0, 1, 2]); // where the shortest sits
    const L = [...base].sort((x, y) => x - y), S = L[0], Lg = L[3], P = L[1], Q = L[2];
    const gras = S + Lg < P + Q, change = S + Lg === P + Q;
    // assign: ground, crank (adjacent), coupler, rocker
    let ground, crank, coupler, rocker;
    if (order === 0) { crank = S; ground = Lg; coupler = Q; rocker = P; } else if (order === 1) { ground = S; crank = P; coupler = Lg; rocker = Q; } else { coupler = S; ground = Lg; crank = P; rocker = Q; }
    const kind = change ? 'change' : !gras ? 'triple' : order === 0 ? 'crank-rocker' : order === 1 ? 'double-crank' : 'double-rocker';
    const names = { 'crank-rocker': 'Grashof crank-rocker', 'double-crank': 'Grashof double-crank (drag link)', 'double-rocker': 'Grashof double-rocker', triple: 'Non-Grashof triple-rocker', change: 'Special case (change point)' };
    return {
      points: 10, type: 'choice',
      prompt: `A four-bar linkage has ground link $${ground}$, input link $${crank}$, coupler $${coupler}$ and output link $${rocker}$ (cm). How does it behave?`,
      options: Object.entries(names).map(([k, v]) => ({ tex: v, correct: k === kind, why: `$S + L = ${S} + ${Lg} = ${S + Lg}$, $P + Q = ${P} + ${Q} = ${P + Q}$${gras ? `, and the shortest link (${S}) is the ${order === 0 ? 'input (next to ground)' : order === 1 ? 'ground' : 'coupler'}` : ''}.`, step: 'g' })),
      answerTex: names[kind], hint: 'Compare S + L with P + Q, then see where the shortest link is.',
      steps: [
        { key: 'g', title: 'Grashof condition', body: `$S + L = ${S + Lg}$ vs $P + Q = ${P + Q}$: ${change ? 'equal, so the linkage can reach a change point (all links collinear).' : gras ? 'less, so at least one link can rotate fully (Grashof).' : 'greater, so no link can rotate fully (non-Grashof).'}` },
        { key: 'inv', title: 'Inversion', body: R`Grashof: shortest link next to ground → crank-rocker; shortest is the ground → double-crank; shortest is the coupler → double-rocker.` },
      ],
      mistakes: [],
    };
  }
  const cases = [
    { d: 'a four-bar linkage', L: 4, J1: 4, J2: 0 },
    { d: 'a slider-crank (crank, connecting rod, piston, frame)', L: 4, J1: 4, J2: 0 },
    { d: 'a six-bar Watt linkage', L: 6, J1: 7, J2: 0 },
    { d: 'a five-bar linkage with two inputs', L: 5, J1: 5, J2: 0 },
    { d: 'a cam with a roller follower (frame, cam, follower, roller)', L: 4, J1: 3, J2: 1 },
    { d: 'a pair of meshing gears on a frame', L: 3, J1: 2, J2: 1 },
    { d: 'a mechanism', L: randInt(5, 8), J1: randInt(5, 9), J2: randInt(0, 2) },
  ];
  const C = pick(cases), M = 3 * (C.L - 1) - 2 * C.J1 - C.J2;
  return {
    points: 10,
    prompt: `${C.d[0].toUpperCase() + C.d.slice(1)} has $L = ${C.L}$ links (including the ground), $J_1 = ${C.J1}$ full joints (pins or sliders) and $J_2 = ${C.J2}$ half joints. Find its mobility (degrees of freedom).`,
    vars: [], sample: () => ({}), tol: 1e-9, hint: 'Enter an integer (negative means over-constrained).',
    answer: String(M), answerTex: `M = 3(L-1) - 2J_1 - J_2 = ${M}`,
    steps: [
      { key: 'g', title: "Gruebler–Kutzbach equation", body: R`Each free planar link has 3 DOF; the ground has none. A full joint removes 2, a half joint (rolling with slip, cam contact) removes 1: $M = 3(L-1) - 2J_1 - J_2$.` },
      { key: 'n', title: 'Substitute', body: `$M = 3(${C.L - 1}) - 2(${C.J1}) - ${C.J2} = ${M}$${M === 0 ? ' (a structure)' : M < 0 ? ' (preloaded structure)' : ''}.` },
    ],
    mistakes: [
      { expr: String(3 * C.L - 2 * C.J1 - C.J2), step: 'g', why: 'The ground link has no freedom: use $L - 1$.' },
      ...(C.J2 ? [{ expr: String(3 * (C.L - 1) - 2 * (C.J1 + C.J2)), step: 'g', why: 'A half joint removes only 1 DOF.' }] : []),
    ],
  };
}

function genPosition() {
  if (Math.random() < 0.5) {
    const r = pick([40, 50, 60, 75]), ratio = pick([3, 3.5, 4]), l = r * ratio, th = pick([30, 45, 60, 120, 135, 210, 300]);
    const x = scX(r, l, th * D2R);
    return {
      points: 15, prompt: `An in-line slider-crank has crank $r = ${r}$ mm and connecting rod $l = ${l}$ mm. Find the slider position $x$ (mm, from the crank pivot) at $\\theta = ${th}^\\circ$.`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter mm.', answer: num(x), answerTex: `x = ${r2(x)}\\text{ mm}`,
      figure: { kind: 'sketch', height: 200, view: [-1.3 * r, r + l + 0.7 * r, -1.2 * r, 1.2 * r], items: sliderItems(r, l, th * D2R).filter((it) => it.t !== 'text' || it.text === 'θ') },
      steps: [
        { key: 'loop', title: 'Vector loop', body: R`Crank pin $A = (r\cos\theta, r\sin\theta)$; the rod reaches the axis, so its vertical drop equals $r\sin\theta$: $x = r\cos\theta + \sqrt{l^2 - r^2\sin^2\theta}$.` },
        { key: 'n', title: 'Numbers', body: `$x = ${r}\\cos${th}^\\circ + \\sqrt{${l}^2 - ${r}^2\\sin^2${th}^\\circ} = ${r2(x)}$ mm` },
      ],
      mistakes: [{ expr: num(r * Math.cos(th * D2R) + l), step: 'loop', why: 'The rod is inclined; its horizontal reach is $\\sqrt{l^2 - r^2\\sin^2\\theta}$, not $l$.' }, { expr: num(r * Math.cos(th * D2R) - Math.sqrt(l * l - r * r * Math.sin(th * D2R) ** 2) + 2 * l), step: 'n', why: 'Sign slip on the square-root term.' }],
    };
  }
  const sets = [[2, 7, 9, 6], [3, 8, 7, 6], [4, 9, 8, 10], [2, 8, 6, 7], [3, 6, 5, 6]];
  const [a, b, c, d] = pick(sets), th2 = pick([30, 45, 60, 90, 120, 150]);
  const P = fourbar(a, b, c, d, th2 * D2R);
  if (!P) return genPosition();
  const ask = Math.random() < 0.6 ? 'th4' : 'th3';
  const v = ask === 'th4' ? deg(P.th4) : deg(P.th3);
  return {
    points: 20, prompt: `Four-bar: ground $d = ${d}$, crank $a = ${a}$, coupler $b = ${b}$, rocker $c = ${c}$ (cm), open configuration. At $\\theta_2 = ${th2}^\\circ$, find $\\theta_${ask === 'th4' ? 4 : 3}$ (degrees, 0–360, measured CCW from the ground line).`,
    vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter degrees.', answer: num(v), answerTex: `\\theta_${ask === 'th4' ? 4 : 3} = ${r2(v)}^\\circ`,
    figure: { kind: 'sketch', height: 230, view: [-0.4 * d, 1.4 * d, -0.25 * d, 1.1 * Math.max(b, c)], items: fourbarItems(a, b, c, d, th2 * D2R).filter((it) => !(it.t === 'line' && it.color === (ask === 'th4' ? 2 : 1))) },
    steps: [
      { key: 'B', title: 'Crank pin', body: `$B = (a\\cos\\theta_2, a\\sin\\theta_2) = (${r3(P.Bx)}, ${r3(P.By)})$` },
      { key: 'tri', title: 'Triangle B–C–O₄', body: `Diagonal $BO_4 = ${r3(Math.hypot(d - P.Bx, P.By))}$. The law of cosines in triangle $BCO_4$ gives the angles; choosing the open (uncrossed) solution places $C = (${r3(P.Cx)}, ${r3(P.Cy)})$.` },
      { key: 'ang', title: 'Link angles', body: `$\\theta_3 = ${r2(deg(P.th3))}^\\circ$, $\\theta_4 = ${r2(deg(P.th4))}^\\circ$. Check: $a e^{i\\theta_2} + b e^{i\\theta_3} - c e^{i\\theta_4} - d = 0$.` },
    ],
    mistakes: [{ expr: num(ask === 'th4' ? deg(P.th3) : deg(P.th4)), step: 'ang', why: `That is $\\theta_${ask === 'th4' ? 3 : 4}$, the ${ask === 'th4' ? 'coupler' : 'rocker'} angle.` }, { expr: num(360 - v), step: 'tri', why: 'That is the crossed configuration (mirror image). Use the open branch.' }],
  };
}

function genVelocity() {
  const kind = pick(['slider', 'fourbar', 'ic', 'slider']);
  if (kind === 'ic') {
    const n = randInt(4, 8);
    return {
      points: 5, prompt: `How many instant centres does a mechanism with ${n} links (including the ground) have?`, vars: [], sample: () => ({}), tol: 1e-9, hint: 'Enter an integer.',
      answer: String((n * (n - 1)) / 2), answerTex: `\\frac{n(n-1)}{2} = ${(n * (n - 1)) / 2}`,
      steps: [{ key: 'c', title: 'One per pair of links', body: `Every pair of links has one instant centre: $\\binom{${n}}{2} = ${(n * (n - 1)) / 2}$. Kennedy's theorem: any three links' instant centres lie on a straight line.` }],
      mistakes: [{ expr: String(n * (n - 1)), step: 'c', why: 'Pairs are unordered: divide by 2.' }],
    };
  }
  if (kind === 'slider') {
    const r = pick([0.05, 0.08, 0.1]), l = r * pick([3, 4]), rpm = pick([600, 1200, 1800, 3000]), th = pick([30, 45, 60, 90, 120]);
    const w = (rpm * 2 * Math.PI) / 60, v = scV(r, l, th * D2R, w);
    return {
      points: 20, prompt: `A slider-crank ($r = ${r * 1000}$ mm, $l = ${r2(l * 1000)}$ mm) turns at $${rpm}$ rpm CCW. Find the slider velocity (m/s, + away from the crank) at $\\theta = ${th}^\\circ$.`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter m/s (sign matters).', answer: num(v), answerTex: `\\dot x = ${r3(v)}\\text{ m/s}`,
      steps: [
        { key: 'w', title: 'Crank speed', body: `$\\omega = ${rpm}\\cdot\\frac{2\\pi}{60} = ${r2(w)}$ rad/s` },
        { key: 'd', title: 'Differentiate the position', body: R`$\dot x = -r\omega\sin\theta - \dfrac{r^2\omega\sin\theta\cos\theta}{\sqrt{l^2 - r^2\sin^2\theta}}$` },
        { key: 'n', title: 'Numbers', body: `$\\dot x = ${r3(v)}$ m/s (negative = moving towards the crank).` },
      ],
      mistakes: [
        { expr: num(-r * w * Math.sin(th * D2R)), step: 'd', why: 'That ignores the connecting rod (infinitely long rod). Include the second term.' },
        { expr: num(scV(r, l, th * D2R, rpm)), step: 'w', why: 'Convert rpm to rad/s.' },
        { expr: num(-v), step: 'n', why: 'Sign: with CCW rotation and $0 < \\theta < 180^\\circ$ the slider moves towards the crank.' },
      ],
    };
  }
  const [a, b, c, d] = pick([[2, 7, 9, 6], [3, 8, 7, 6], [4, 9, 8, 10], [2, 8, 6, 7]]), th2 = pick([30, 45, 60, 90, 120]), w2 = pick([5, 10, 20]);
  const P = fourbar(a, b, c, d, th2 * D2R);
  if (!P) return genVelocity();
  const W = fbOmega(a, b, c, th2 * D2R, P.th3, P.th4, w2), ask = Math.random() < 0.6 ? 'w4' : 'w3';
  return {
    points: 20,
    prompt: `Four-bar ($d = ${d}$, $a = ${a}$, $b = ${b}$, $c = ${c}$ cm, open). At $\\theta_2 = ${th2}^\\circ$ we have $\\theta_3 = ${r2(deg(P.th3))}^\\circ$ and $\\theta_4 = ${r2(deg(P.th4))}^\\circ$. The crank turns at $\\omega_2 = ${w2}$ rad/s CCW. Find $\\omega_${ask === 'w4' ? 4 : 3}$ (rad/s, CCW +).`,
    vars: [], sample: () => ({}), tol: 3e-3, hint: 'Enter rad/s (sign matters).', answer: num(W[ask]), answerTex: `\\omega_${ask === 'w4' ? 4 : 3} = ${r3(W[ask])}\\text{ rad/s}`,
    verify: { kind: 'self' },
    selfCheck() { const h = 1e-6, P2 = fourbar(a, b, c, d, th2 * D2R + h); const fd = ask === 'w4' ? (P2.th4 - P.th4) / h * w2 : (P2.th3 - P.th3) / h * w2; return Math.abs(fd - W[ask]) < 1e-3 * Math.max(1, Math.abs(fd)) ? true : `fd ${fd} vs ${W[ask]}`; },
    steps: [
      { key: 'loop', title: 'Differentiate the loop', body: R`$ia\omega_2e^{i\theta_2} + ib\omega_3e^{i\theta_3} - ic\omega_4e^{i\theta_4} = 0$; split into real and imaginary parts and solve the 2×2 system.` },
      { key: 'res', title: 'Solution', body: R`$\omega_3 = \dfrac{a\omega_2\sin(\theta_4-\theta_2)}{b\sin(\theta_3-\theta_4)}$, $\omega_4 = \dfrac{a\omega_2\sin(\theta_2-\theta_3)}{c\sin(\theta_4-\theta_3)}$` },
      { key: 'n', title: 'Numbers', body: `$\\omega_3 = ${r3(W.w3)}$, $\\omega_4 = ${r3(W.w4)}$ rad/s` },
    ],
    mistakes: [{ expr: num(ask === 'w4' ? W.w3 : W.w4), step: 'n', why: `That is $\\omega_${ask === 'w4' ? 3 : 4}$.` }, { expr: num(-W[ask]), step: 'res', why: 'Sign slip: check the order of the angles in the sines.' }, { expr: num((a * w2) / (ask === 'w4' ? c : b)), step: 'loop', why: 'Velocities depend on the link angles, not just the length ratio.' }],
  };
}

function genAccel() {
  const kind = pick(['slider', 'point', 'cor']);
  if (kind === 'point') {
    const r = pick([0.1, 0.2, 0.25]), w = pick([5, 10, 15]), al = pick([0, 20, 50, -30]);
    const an = r * w * w, at = r * al, tot = Math.hypot(an, at), ask = al === 0 ? 'n' : pick(['n', 'tot']);
    return {
      points: 10, prompt: `A crank of length $${r}$ m turns at $\\omega = ${w}$ rad/s with angular acceleration $\\alpha = ${al}$ rad/s². Find the ${ask === 'n' ? 'normal (centripetal)' : 'total'} acceleration (m/s²) of the crank pin.`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter m/s².', answer: num(ask === 'n' ? an : tot), answerTex: ask === 'n' ? `a^n = r\\omega^2 = ${r3(an)}` : `|a| = \\sqrt{(r\\omega^2)^2 + (r\\alpha)^2} = ${r3(tot)}`,
      steps: [{ key: 'c', title: 'Components', body: `$a^n = r\\omega^2 = ${r3(an)}$ (towards the pivot), $a^t = r\\alpha = ${r3(at)}$ (perpendicular).` }],
      mistakes: [{ expr: num(r * w), step: 'c', why: 'That is the speed $r\\omega$.' }, ...(ask === 'tot' ? [{ expr: num(an + Math.abs(at)), step: 'c', why: 'The components are perpendicular: add as vectors.' }] : [])],
    };
  }
  if (kind === 'cor') {
    const w = pick([2, 4, 5, 10]), v = pick([0.5, 1, 2, 3]);
    return {
      points: 10, prompt: `A slider moves outward at $${v}$ m/s along a rod that rotates at $${w}$ rad/s. What is the magnitude of the Coriolis acceleration (m/s²)?`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter m/s².', answer: String(2 * v * w), answerTex: `a^c = 2\\omega v = ${2 * v * w}`,
      steps: [{ key: 'c', title: 'Coriolis term', body: R`A point sliding on a rotating link has an extra $2\omega\times v_{rel}$, perpendicular to the link, in the sense of $v_{rel}$ rotated by $\omega$.` }],
      mistakes: [{ expr: String(v * w), step: 'c', why: 'The Coriolis term has a factor 2.' }],
    };
  }
  const r = pick([0.05, 0.08, 0.1]), l = r * pick([3, 4]), rpm = pick([1200, 1800, 3000]), th = pick([0, 30, 60, 90, 180]);
  const w = (rpm * 2 * Math.PI) / 60, a = scA(r, l, th * D2R, w), approx = -r * w * w * (Math.cos(th * D2R) + (r / l) * Math.cos(2 * th * D2R));
  return {
    points: 20, prompt: `A slider-crank ($r = ${r * 1000}$ mm, $l = ${r2(l * 1000)}$ mm) runs at a constant $${rpm}$ rpm. Find the exact piston acceleration (m/s²) at $\\theta = ${th}^\\circ$.`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter m/s² (sign matters).', answer: num(a), answerTex: `\\ddot x = ${r2(a)}\\text{ m/s}^2`,
    verify: { kind: 'self' }, selfCheck() { const h = 1e-4, fd = (scX(r, l, th * D2R + h) - 2 * scX(r, l, th * D2R) + scX(r, l, th * D2R - h)) / (h * h) * w * w; return Math.abs(fd - a) < 1e-3 * Math.abs(a) + 1e-6 ? true : `fd ${fd}`; },
    steps: [
      { key: 'd2', title: 'Differentiate twice (constant ω)', body: R`$\ddot x = \omega^2\dfrac{d^2x}{d\theta^2}$, with $\dfrac{d^2x}{d\theta^2} = -r\cos\theta - \dfrac{r^2\cos2\theta}{D} - \dfrac{r^4\sin^2\theta\cos^2\theta}{D^3}$, $D = \sqrt{l^2 - r^2\sin^2\theta}$` },
      { key: 'n', title: 'Numbers', body: `$\\omega = ${r2(w)}$ rad/s: $\\ddot x = ${r2(a)}$ m/s². The common approximation $-r\\omega^2(\\cos\\theta + \\frac rl\\cos2\\theta) = ${r2(approx)}$ is close.` },
    ],
    mistakes: [{ expr: num(-r * w * w * Math.cos(th * D2R)), step: 'd2', why: 'That is pure crank (Scotch-yoke) motion; the finite rod adds a second-harmonic term.' }, { expr: num(scA(r, l, th * D2R, rpm)), step: 'n', why: 'Convert rpm to rad/s before squaring.' }],
  };
}

function genBalance() {
  if (Math.random() < 0.35) {
    const m = pick([0.5, 0.8, 1.2, 2]), r = pick([0.05, 0.075, 0.1]), l = r * 4, rpm = pick([1500, 3000, 4500]), th = pick([0, 60, 90, 180]);
    const w = (rpm * 2 * Math.PI) / 60, F = m * scA(r, l, th * D2R, w);
    return {
      points: 15, prompt: `A piston of mass $${m}$ kg in a slider-crank ($r = ${r * 1000}$ mm, $l = ${l * 1000}$ mm) runs at $${rpm}$ rpm. Find the piston's inertia force $-m\\ddot x$ (N) at $\\theta = ${th}^\\circ$ (+ away from the crank).`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter N.', answer: num(-F), answerTex: `-m\\ddot x = ${r2(-F)}\\text{ N}`,
      steps: [{ key: 'a', title: 'Piston acceleration', body: `$\\ddot x = ${r2(F / m)}$ m/s² (exact slider-crank result)` }, { key: 'f', title: "d'Alembert inertia force", body: `$-m\\ddot x = ${r2(-F)}$ N. This shaking force is transmitted to the frame unless balanced.` }],
      mistakes: [{ expr: num(F), step: 'f', why: "The inertia force opposes the acceleration: $-m\\ddot x$." }],
    };
  }
  const n = pick([2, 3]);
  const ms = Array.from({ length: n }, () => pick([1, 2, 3, 4])), rs = Array.from({ length: n }, () => pick([50, 80, 100, 120])), angs = [0, ...Array.from({ length: n - 1 }, () => pick([60, 90, 120, 150, 210, 270]))];
  if (new Set(angs).size < n) return genBalance();
  const Sx = ms.reduce((s, m, i) => s + m * rs[i] * Math.cos(angs[i] * D2R), 0), Sy = ms.reduce((s, m, i) => s + m * rs[i] * Math.sin(angs[i] * D2R), 0);
  const mag = Math.hypot(Sx, Sy), ang = deg(Math.atan2(-Sy, -Sx)), rb = 100;
  if (mag < 20) return genBalance();
  const ask = pick(['mr', 'ang', 'm']);
  const v = { mr: mag, ang, m: mag / rb }[ask];
  return {
    points: 20,
    prompt: `Masses rotate in one plane: ${ms.map((m, i) => `$${m}$ kg at $${rs[i]}$ mm, $${angs[i]}^\\circ$`).join('; ')}. ${{ mr: 'Find the magnitude of the correction $m_br_b$ (kg·mm) for static balance.', ang: 'At what angle (degrees, 0–360) must the balancing mass go?', m: `What balancing mass (kg) is needed at a radius of ${rb} mm?` }[ask]}`,
    vars: [], sample: () => ({}), tol: TOL, hint: { mr: 'Enter kg·mm.', ang: 'Enter degrees.', m: 'Enter kg.' }[ask], answer: num(v), answerTex: { mr: `m_br_b = ${r2(mag)}\\text{ kg·mm}`, ang: `\\theta_b = ${r2(ang)}^\\circ`, m: `m_b = ${r3(mag / rb)}\\text{ kg}` }[ask].replace('kg·mm', 'kg\\,mm'),
    figure: { kind: 'sketch', height: 230, view: [-150, 150, -150, 150], axes: {}, items: [...ms.map((m, i) => ({ t: 'arrow', x1: 0, y1: 0, x2: rs[i] * Math.cos(angs[i] * D2R), y2: rs[i] * Math.sin(angs[i] * D2R), color: i })), ...ms.map((m, i) => ({ t: 'text', x: rs[i] * Math.cos(angs[i] * D2R), y: rs[i] * Math.sin(angs[i] * D2R), dx: 6, dy: -4, text: `${m} kg`, anchor: 'start', color: i, size: 11 }))] },
    steps: [
      { key: 'sum', title: 'Sum the mr vectors', body: `$\\sum m r\\cos\\theta = ${r2(Sx)}$, $\\sum m r\\sin\\theta = ${r2(Sy)}$ (kg·mm)` },
      { key: 'bal', title: 'Correction is the opposite vector', body: `$m_br_b = \\sqrt{${r2(Sx)}^2 + ${r2(Sy)}^2} = ${r2(mag)}$ kg·mm at $\\theta_b = \\operatorname{atan2}(${r2(-Sy)}, ${r2(-Sx)}) = ${r2(ang)}^\\circ$${ask === 'm' ? `; at $r_b = ${rb}$ mm, $m_b = ${r3(mag / rb)}$ kg` : ''}.` },
    ],
    mistakes: [
      ...(ask === 'ang' ? [{ expr: num(deg(Math.atan2(Sy, Sx))), step: 'bal', why: 'That is the direction of the unbalance; the correction goes 180° opposite.' }, { expr: num(deg(Math.atan(Sy / Sx))), step: 'bal', why: '$\\arctan$ loses the quadrant; use the signs of both components.' }] : []),
      ...(ask !== 'ang' ? [{ expr: num((ask === 'm' ? 1 / rb : 1) * ms.reduce((s, m, i) => s + m * rs[i], 0)), step: 'sum', why: 'The $mr$ terms are vectors: add components, not magnitudes.' }] : []),
    ],
  };
}

/* ================= lessons ================= */
const LMob = [
  { type: 'text', kind: 'key', title: 'Links, joints and mobility', body: R`A planar link that floats freely has 3 degrees of freedom ($x$, $y$, rotation). Joints remove freedom: a pin or a slider (full joint) removes 2; a rolling-and-sliding contact like a cam or gear tooth (half joint) removes 1. Gruebler–Kutzbach: $$M = 3(L-1) - 2J_1 - J_2.$$` },
  { type: 'quiz', prompt: R`A four-bar has $L = 4$, $J_1 = 4$. Its mobility is`, options: [{ tex: '1', correct: true }, { tex: '4', why: R`$3(3) - 2(4) = 1$.` }, { tex: '0', why: 'A four-bar moves: one input angle fixes everything.' }], explain: R`One input (the crank angle) determines the whole linkage.` },
  { type: 'text', kind: 'key', title: 'Grashof condition', body: R`For a four-bar with shortest link $S$, longest $L$ and the other two $P$, $Q$: if $S + L \le P + Q$, at least one link can make full revolutions. Which one depends on where $S$ sits: next to ground → crank-rocker; $S$ as ground → double-crank; $S$ as coupler → double-rocker. If $S + L > P + Q$, every link only rocks.` },
  {
    type: 'graph', title: 'Play with a four-bar',
    body: R`Drag the crank. If the linkage can't assemble at some angles, the crank can't go all the way round: change the link lengths to make it Grashof.`,
    widget: {
      params: [{ key: 't', label: 'crank angle θ₂ (°)', min: 0, max: 360, step: 2, value: 60 }, { key: 'a', label: 'crank a', min: 1, max: 6, step: 0.5, value: 2 }, { key: 'b', label: 'coupler b', min: 4, max: 10, step: 0.5, value: 7 }, { key: 'c', label: 'rocker c', min: 4, max: 10, step: 0.5, value: 9 }],
      kind: 'sketch', height: 300, view: [-3, 10, -3, 10],
      items: (p) => fourbarItems(p.a, p.b, p.c, 6, p.t * D2R),
      readout: (p) => { const L = [p.a, p.b, p.c, 6].sort((x, y) => x - y); const g = L[0] + L[3] <= L[1] + L[2]; return `$S + L = ${L[0] + L[3]}$, $P + Q = ${L[1] + L[2]}$: ${g ? 'Grashof' : 'non-Grashof'}${g && L[0] === p.a ? ' — the crank (shortest, next to ground) turns fully: crank-rocker.' : '.'}`; },
    },
  },
  { type: 'example', title: 'Worked example: classify', prompt: R`Ground 9, crank 2, coupler 7, rocker 6.`, steps: [R`$S = 2$, $L = 9$, $P + Q = 13$; $S + L = 11 \le 13$: Grashof.`, R`The shortest link is the crank, next to ground: crank-rocker.`] },
];
const LPos = [
  { type: 'text', kind: 'key', title: 'Position analysis = closing a loop', body: R`Write each link as a vector and require the loop to close. Four-bar: $ae^{i\theta_2} + be^{i\theta_3} - ce^{i\theta_4} - d = 0$. Given $\theta_2$, solve the two scalar equations for $\theta_3, \theta_4$. There are two solutions (open and crossed); a real mechanism stays on one.` },
  { type: 'text', kind: 'method', title: 'Geometric shortcut', body: R`Locate $B$ (end of the crank), draw the diagonal $BO_4$, then use the law of cosines in triangles $O_2BO_4$ and $BCO_4$. Slider-crank: $x = r\cos\theta + \sqrt{l^2 - r^2\sin^2\theta}$.` },
  {
    type: 'graph', title: 'Slider-crank: position over a revolution',
    body: R`The piston's motion is almost, but not quite, a cosine. A shorter rod (small $l/r$) makes it more lopsided: it lingers near bottom dead centre.`,
    widget: {
      params: [{ key: 't', label: 'crank angle θ (°)', min: 0, max: 360, step: 2, value: 50 }, { key: 'n', label: 'rod ratio l/r', min: 1.5, max: 6, step: 0.25, value: 3 }],
      panels: [
        { kind: 'sketch', flex: 1.1, height: 220, view: [-1.4, 7.6, -1.4, 1.4], items: (p) => sliderItems(1, p.n, p.t * D2R) },
        { kind: 'plot', flex: 0.9, height: 220, x: [0, 360], y: 'auto', includeZero: false, xLabel: 'θ (°)', curves: (p) => [{ fn: (t) => scX(1, p.n, t * D2R), label: 'x / r' }, { fn: (t) => p.n + Math.cos(t * D2R), label: 'r cos θ + l', dash: true, color: 1 }], vlines: (p) => [{ x: p.t }] },
      ],
      readout: (p) => `$x = ${r3(scX(1, p.n, p.t * D2R))}r$. Top dead centre at $\\theta = 0$ ($x = l + r$), bottom at $180^\\circ$ ($x = l - r$): the stroke is always $2r$.`,
    },
  },
  { type: 'example', title: 'Worked example: four-bar', prompt: R`$d = 6$, $a = 2$, $b = 7$, $c = 9$, $\theta_2 = 60^\circ$.`, steps: [
    R`$B = (1, 1.732)$; $BO_4 = \sqrt{5^2 + 1.732^2} = 5.29$.`,
    R`In triangle $BCO_4$: $\cos\angle CBO_4 = \frac{7^2 + 5.29^2 - 9^2}{2(7)(5.29)}$; add the direction of $BO_4$ to get $\theta_3$.`,
    R`$C = B + 7(\cos\theta_3, \sin\theta_3)$, then $\theta_4 = \operatorname{atan2}(C_y, C_x - 6)$.`,
  ] },
  { type: 'quiz', prompt: 'Why are there two answers to the four-bar position problem?', options: [{ tex: 'The two circles (radius b from B, radius c from O₄) meet at two points', correct: true }, { tex: 'Because arccos is periodic', why: 'The geometric reason is the two circle intersections; arccos just reflects it.' }, { tex: 'There is only one answer', why: 'The crossed configuration also closes the loop.' }] },
];
const LVel = [
  { type: 'text', kind: 'key', title: 'Velocity analysis', body: R`Differentiate the loop: $ia\omega_2e^{i\theta_2} + ib\omega_3e^{i\theta_3} - ic\omega_4e^{i\theta_4} = 0$. Velocity equations are linear in the unknown $\omega$'s, so once the position is known they are easy. Relative velocity: $v_B = v_A + \omega\times r_{B/A}$.` },
  { type: 'text', kind: 'method', title: 'Instant centres', body: R`Each pair of links has an instant centre (a point with the same velocity on both): $n(n-1)/2$ of them. Kennedy: any three links' centres are collinear. The velocity ratio $\omega_4/\omega_2 = \frac{O_2I_{24}}{O_4I_{24}}$ (signed distances along the ground line).` },
  {
    type: 'graph', title: 'Output speed over one crank revolution',
    body: R`For a crank-rocker the rocker speeds up, stops (at the extreme positions, where crank and coupler line up) and reverses. The slider in a slider-crank does the same.`,
    widget: {
      params: [{ key: 't', label: 'crank angle θ₂ (°)', min: 0, max: 360, step: 2, value: 60 }],
      panels: [
        { kind: 'sketch', flex: 0.9, height: 240, view: [-3, 10, -3, 10], items: (p) => fourbarItems(2, 7, 9, 6, p.t * D2R) },
        { kind: 'plot', flex: 1.1, height: 240, x: [0, 360], y: 'auto', xLabel: 'θ₂ (°)', curves: [{ fn: (t) => { const P = fourbar(2, 7, 9, 6, t * D2R); return P ? fbOmega(2, 7, 9, t * D2R, P.th3, P.th4, 1).w4 : NaN; }, label: 'ω₄/ω₂' }, { fn: (t) => { const P = fourbar(2, 7, 9, 6, t * D2R); return P ? fbOmega(2, 7, 9, t * D2R, P.th3, P.th4, 1).w3 : NaN; }, label: 'ω₃/ω₂', color: 1 }], vlines: (p) => [{ x: p.t }] },
      ],
      readout: (p) => { const P = fourbar(2, 7, 9, 6, p.t * D2R); if (!P) return ''; const W = fbOmega(2, 7, 9, p.t * D2R, P.th3, P.th4, 1); return `$\\omega_3/\\omega_2 = ${r3(W.w3)}$, $\\omega_4/\\omega_2 = ${r3(W.w4)}$`; },
    },
  },
  { type: 'quiz', prompt: R`At the instant the crank and coupler of a crank-rocker are collinear, the rocker's angular velocity is`, options: [{ tex: 'Zero (a limit position)', correct: true }, { tex: 'Maximum', why: 'Collinear crank and coupler give the extreme rocker positions, where it reverses.' }, { tex: 'Equal to ω₂', why: 'It is momentarily zero.' }] },
  { type: 'input', prompt: R`Slider-crank with $r = 0.1$ m at $\omega = 100$ rad/s, $\theta = 90^\circ$. Slider speed magnitude (m/s)?`, answer: '10', explain: R`At $90^\circ$ the second term has $\cos\theta = 0$: $|\dot x| = r\omega = 10$ m/s.` },
];
const LAcc = [
  { type: 'text', kind: 'key', title: 'Acceleration components', body: R`A point on a rotating link: normal $r\omega^2$ (towards the centre) and tangential $r\alpha$. A point sliding on a rotating link also gets the Coriolis term $2\omega v_{rel}$. Differentiate the loop twice to get the link angular accelerations.` },
  {
    type: 'graph', title: 'Piston acceleration',
    body: R`At constant crank speed the piston acceleration is roughly $-r\omega^2(\cos\theta + \frac rl\cos2\theta)$: a first harmonic plus a second harmonic from the finite rod. Shorten the rod and the second harmonic grows.`,
    widget: {
      params: [{ key: 'n', label: 'rod ratio l/r', min: 2, max: 8, step: 0.25, value: 3.5 }],
      x: [0, 360], y: 'auto', xLabel: 'θ (°)', yLabel: 'ẍ / rω²',
      curves: (p) => [{ fn: (t) => scA(1, p.n, t * D2R, 1), label: 'exact' }, { fn: (t) => -Math.cos(t * D2R), label: '−cos θ (infinite rod)', dash: true, color: 1 }, { fn: (t) => -(1 / p.n) * Math.cos(2 * t * D2R), label: 'second harmonic', dash: true, color: 2 }],
      readout: (p) => `At TDC ($\\theta = 0$): $\\ddot x = -(1 + r/l)r\\omega^2 = ${r3(scA(1, p.n, 0, 1))}r\\omega^2$; at BDC: $${r3(scA(1, p.n, Math.PI, 1))}r\\omega^2$.`,
    },
  },
  { type: 'example', title: 'Worked example: crank pin', prompt: R`$r = 0.2$ m, $\omega = 10$ rad/s, $\alpha = 50$ rad/s².`, steps: [R`$a^n = 0.2(100) = 20$ m/s² towards the pivot.`, R`$a^t = 0.2(50) = 10$ m/s² perpendicular.`, R`$|a| = \sqrt{20^2 + 10^2} = 22.4$ m/s².`] },
  { type: 'quiz', prompt: R`When is the Coriolis term present?`, options: [{ tex: 'When a point slides along a link that is rotating', correct: true }, { tex: 'Whenever a link rotates', why: 'A fixed point on a rotating link has only normal and tangential terms.' }, { tex: 'Only when α ≠ 0', why: 'It depends on ω and the sliding velocity, not on α.' }] },
];
const LBal = [
  { type: 'text', kind: 'key', title: "Dynamic force analysis", body: R`Once accelerations are known, Newton's law for each link (or d'Alembert: add inertia forces $-ma_G$ and torques $-I_G\alpha$ and treat it as statics) gives the joint forces and the input torque needed. In engines the piston inertia force $-m\ddot x$ shakes the frame.` },
  { type: 'text', kind: 'method', title: 'Static (single-plane) balancing', body: R`Rotating masses in one plane are balanced when $\sum m_ir_i = 0$ as vectors. The correction $m_br_b$ is the negative of the sum: equal magnitude, opposite direction. Masses spread along the shaft also need moment balance (two planes).` },
  {
    type: 'graph', title: 'Balance a rotor',
    body: R`Two masses are fixed; place the correction (purple) so the $mr$ vectors sum to zero. The readout shows the remaining unbalance.`,
    widget: {
      params: [{ key: 'm', label: 'correction m·r (kg·mm)', min: 0, max: 400, step: 5, value: 150 }, { key: 'a', label: 'correction angle (°)', min: 0, max: 360, step: 1, value: 200 }],
      kind: 'sketch', height: 300, view: [-420, 420, -420, 420], axes: {},
      items: (p) => { const v = [[200, 0], [150 * Math.cos(120 * D2R), 150 * Math.sin(120 * D2R)], [p.m * Math.cos(p.a * D2R), p.m * Math.sin(p.a * D2R)]]; const S = v.reduce((s, q) => [s[0] + q[0], s[1] + q[1]], [0, 0]); return [{ t: 'arrow', x1: 0, y1: 0, x2: v[0][0], y2: v[0][1], color: 0 }, { t: 'arrow', x1: 0, y1: 0, x2: v[1][0], y2: v[1][1], color: 1 }, { t: 'arrow', x1: 0, y1: 0, x2: v[2][0], y2: v[2][1], color: 3, width: 3 }, { t: 'arrow', x1: 0, y1: 0, x2: S[0], y2: S[1], color: 'text', dash: true }, { t: 'text', x: S[0], y: S[1], dx: 6, text: 'net', anchor: 'start', size: 11 }]; },
      readout: (p) => { const Sx = 200 + 150 * Math.cos(120 * D2R) + p.m * Math.cos(p.a * D2R), Sy = 150 * Math.sin(120 * D2R) + p.m * Math.sin(p.a * D2R); return `Remaining unbalance $|\\sum mr| = ${r2(Math.hypot(Sx, Sy))}$ kg·mm (target: ${r2(Math.hypot(200 + 150 * Math.cos(120 * D2R), 150 * Math.sin(120 * D2R)))} at ${r2(deg(Math.atan2(-150 * Math.sin(120 * D2R), -(200 + 150 * Math.cos(120 * D2R)))))}°)`; },
    },
  },
  { type: 'example', title: 'Worked example', prompt: R`2 kg at 100 mm, 0°; 3 kg at 80 mm, 90°. Balance with a mass at 100 mm.`, steps: [R`$\sum mr = (200, 240)$ kg·mm.`, R`$|m_br_b| = \sqrt{200^2 + 240^2} = 312.4$ kg·mm at $\operatorname{atan2}(-240, -200) = 230.2^\circ$.`, R`$m_b = 3.124$ kg at 100 mm.`] },
  { type: 'quiz', prompt: R`A rotor is statically balanced but two masses sit in different planes along the shaft. It will`, options: [{ tex: 'Still vibrate when spinning (a rocking couple)', correct: true }, { tex: 'Run perfectly smoothly', why: 'Static balance cancels the net force, not the moment of the forces about the shaft.' }, { tex: 'Not stay still at rest', why: 'Static balance means it stays put in any angular position.' }] },
];

SA.registerCourse({
  course: 'MAAE 3004',
  chapters: [{ id: 'dm-kin', name: 'Kinematics of mechanisms' }, { id: 'dm-dyn', name: 'Dynamics and balancing' }],
  topics: [
    { id: 'dm-mob', ch: 'dm-kin', sec: 'dm1', name: 'Mobility and Grashof', desc: 'Gruebler and four-bar types.', gen: genMobility },
    { id: 'dm-pos', ch: 'dm-kin', sec: 'dm2', name: 'Position analysis', desc: 'Slider-crank and four-bar.', gen: genPosition },
    { id: 'dm-vel', ch: 'dm-kin', sec: 'dm3', name: 'Velocity analysis', desc: 'Loop equations, instant centres.', gen: genVelocity },
    { id: 'dm-acc', ch: 'dm-kin', sec: 'dm4', name: 'Acceleration analysis', desc: 'rω², rα, Coriolis, piston.', gen: genAccel },
    { id: 'dm-bal', ch: 'dm-dyn', sec: 'dm5', name: 'Inertia forces and balancing', desc: '−ma and Σmr = 0.', gen: genBalance },
  ],
  sections: [
    { id: 'dm1', tag: 'Wk 1', num: '1', title: 'Mechanisms, mobility and Grashof', chapter: 'Winter preview · Kinematics', skills: ['dm-mob'], lesson: LMob },
    { id: 'dm2', tag: 'Wk 2', num: '2', title: 'Position analysis', chapter: 'Winter preview · Kinematics', skills: ['dm-pos'], lesson: LPos },
    { id: 'dm3', tag: 'Wk 3', num: '3', title: 'Velocity analysis', chapter: 'Winter preview · Kinematics', skills: ['dm-vel'], lesson: LVel },
    { id: 'dm4', tag: 'Wk 4', num: '4', title: 'Acceleration analysis', chapter: 'Winter preview · Kinematics', skills: ['dm-acc'], lesson: LAcc },
    { id: 'dm5', tag: 'Wk 5', num: '5', title: 'Dynamic forces and balancing', chapter: 'Winter preview · Dynamics', skills: ['dm-bal'], lesson: LBal },
  ],
});
