// MECH 3700 — Principles of Manufacturing (Winter). First half, built ahead of time from the calendar
// description and standard texts (Kalpakjian & Schmid; Groover): material behaviour in processing,
// casting, bulk forming (rolling, forging), machining mechanics, tool life and material removal.
const { R, pick, randInt, rand, rnd } = SA;
const D2R = Math.PI / 180;
const r2 = (v) => +v.toFixed(2), r3 = (v) => +v.toFixed(3), r4 = (v) => +v.toFixed(4);
const num = (v) => String(rnd(v));
const TOL = 3e-3;

/* ---------- 1. Material behaviour ---------- */
function genFlow() {
  const kind = pick(['true', 'flow', 'avg', 'neck']);
  const mats = [{ n: 'annealed copper', K: 315, nn: 0.54 }, { n: '1020 steel (annealed)', K: 530, nn: 0.26 }, { n: '304 stainless', K: 1275, nn: 0.45 }, { n: '6061-O aluminium', K: 205, nn: 0.2 }, { n: '70-30 brass', K: 900, nn: 0.49 }];
  const M = pick(mats);
  if (kind === 'true') {
    const e = pick([0.1, 0.2, 0.25, 0.4]), s = pick([200, 300, 450]), ask = pick(['eps', 'sig']);
    const v = ask === 'eps' ? Math.log(1 + e) : s * (1 + e);
    return {
      points: 10, prompt: `In a tension test the engineering strain is $e = ${e}$ and the engineering stress $${s}$ MPa (before necking). Find the true ${ask === 'eps' ? 'strain' : 'stress (MPa)'}.`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter a number.', answer: num(v), answerTex: ask === 'eps' ? `\\varepsilon = \\ln(1+e) = ${r4(v)}` : `\\sigma = s(1+e) = ${r2(v)}\\text{ MPa}`,
      steps: [{ key: 'c', title: 'Constant volume', body: R`Plastic deformation conserves volume ($A_0L_0 = AL$), so $\varepsilon = \ln\frac{L}{L_0} = \ln(1+e)$ and $\sigma = \frac{F}{A} = s(1+e)$ — valid up to necking.` }],
      mistakes: [{ expr: num(ask === 'eps' ? e : s), step: 'c', why: 'Engineering and true values differ: account for the shrinking area / accumulating length.' }, ...(ask === 'sig' ? [{ expr: num(s / (1 + e)), step: 'c', why: 'The area shrinks, so true stress is larger: multiply by $(1+e)$.' }] : [])],
    };
  }
  const eps = pick([0.2, 0.4, 0.5, 0.8, 1.0]);
  const Yf = M.K * eps ** M.nn, Yavg = Yf / (1 + M.nn);
  if (kind === 'neck') return {
    points: 10, prompt: `${M.n[0].toUpperCase() + M.n.slice(1)} follows $\\sigma = ${M.K}\\varepsilon^{${M.nn}}$ MPa. At what true strain does necking start in a tension test?`,
    vars: [], sample: () => ({}), tol: 1e-6, hint: 'Enter a number.', answer: String(M.nn), answerTex: `\\varepsilon_u = n = ${M.nn}`,
    steps: [{ key: 'c', title: "Considère's criterion", body: R`Necking starts when the load peaks: $dF = 0 \Rightarrow \frac{d\sigma}{d\varepsilon} = \sigma$. With $\sigma = K\varepsilon^n$ this gives $\varepsilon = n$.` }],
    mistakes: [{ expr: String(M.K), step: 'c', why: '$K$ is the strength coefficient; the necking strain equals the exponent $n$.' }, { expr: num(Math.exp(M.nn) - 1), step: 'c', why: 'That converts to engineering strain; the criterion gives true strain $n$.' }],
  };
  const v = kind === 'flow' ? Yf : Yavg;
  return {
    points: 10, prompt: `${M.n[0].toUpperCase() + M.n.slice(1)}: $\\sigma = ${M.K}\\varepsilon^{${M.nn}}$ MPa. Find the ${kind === 'flow' ? 'flow stress $Y_f$' : 'average flow stress $\\bar Y$'} (MPa) for a true strain of $${eps}$.`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter MPa.', answer: num(v), answerTex: kind === 'flow' ? `Y_f = K\\varepsilon^n = ${r2(Yf)}` : `\\bar Y = \\frac{K\\varepsilon^n}{1+n} = ${r2(Yavg)}`,
    steps: [{ key: 'f', title: kind === 'flow' ? 'Flow curve' : 'Average over the deformation', body: kind === 'flow' ? `$Y_f = ${M.K}(${eps})^{${M.nn}} = ${r2(Yf)}$ MPa` : `$\\bar Y = \\frac{1}{\\varepsilon}\\int_0^\\varepsilon K\\varepsilon^n d\\varepsilon = \\frac{K\\varepsilon^n}{1+n} = \\frac{${r2(Yf)}}{${1 + M.nn}} = ${r2(Yavg)}$ MPa` }],
    mistakes: [{ expr: num(kind === 'flow' ? Yavg : Yf), step: 'f', why: kind === 'flow' ? 'That is the average; the flow stress is the value at the final strain.' : 'That is the final flow stress; average it over the strain path: divide by $1 + n$.' }, { expr: num(M.K * eps * M.nn), step: 'f', why: '$\\varepsilon$ is raised to the power $n$.' }],
  };
}

/* ---------- 2. Casting ---------- */
const shapes = {
  cube: { tex: (a) => `a cube of side $${a}$ mm`, M: (a) => a / 6 },
  cyl: { tex: (a) => `a cylinder, diameter $${a}$ mm and height $${a}$ mm`, M: (a) => (Math.PI * a * a * a / 4) / (Math.PI * a * a + (Math.PI * a * a) / 2) },
  sphere: { tex: (a) => `a sphere of diameter $${a}$ mm`, M: (a) => a / 6 },
  plate: { tex: (a) => `a plate $${a}\\times${a}\\times${a / 5}$ mm`, M: (a) => (a * a * a / 5) / (2 * a * a + (4 * a * a) / 5) },
};
function genCasting() {
  const kind = pick(['chvorinov', 'chvorinov', 'fill', 'riser']);
  if (kind === 'fill') {
    const h = pick([150, 200, 250, 300]), d = pick([15, 20, 25]), V = pick([1, 2, 3.5]) * 1e6;
    const v = Math.sqrt(2 * 9810 * h), A = (Math.PI * d * d) / 4, t = V / (v * A);
    const ask = pick(['v', 't']);
    return {
      points: 15, prompt: `A sprue is $${h}$ mm tall with a $${d}$ mm diameter base. ${ask === 'v' ? 'Find the velocity (m/s) of the molten metal at its base.' : `How long (s) does it take to fill a ${V / 1e6} L mould cavity?`}`,
      vars: [], sample: () => ({}), tol: TOL, hint: ask === 'v' ? 'Enter m/s.' : 'Enter seconds.', answer: num(ask === 'v' ? v / 1000 : t), answerTex: ask === 'v' ? `v = \\sqrt{2gh} = ${r3(v / 1000)}\\text{ m/s}` : `t = \\frac{V}{Q} = ${r2(t)}\\text{ s}`,
      steps: [{ key: 'b', title: 'Bernoulli down the sprue', body: `$v = \\sqrt{2gh} = \\sqrt{2(9.81)(${h / 1000})} = ${r3(v / 1000)}$ m/s` }, ...(ask === 't' ? [{ key: 'q', title: 'Flow rate and fill time', body: `$Q = vA = ${r2(v / 1000)}\\times\\frac{\\pi(${d / 1000})^2}{4} = ${r4((v * A) / 1e9)}$ m³/s; $t = V/Q = ${r2(t)}$ s` }] : [])],
      mistakes: [{ expr: num(ask === 'v' ? Math.sqrt(9810 * h) / 1000 : V / (Math.sqrt(9810 * h) * A)), step: 'b', why: '$v = \\sqrt{2gh}$: the factor 2 comes from $\\frac12v^2 = gh$.' }, ...(ask === 't' ? [{ expr: num(V / (v * Math.PI * d * d)), step: 'q', why: 'Area is $\\pi d^2/4$.' }] : [])],
    };
  }
  if (kind === 'riser') {
    const L = pick([100, 150, 200]), W = pick([50, 75, 100]), T = pick([20, 25, 40]);
    const Mc = (L * W * T) / (2 * (L * W + L * T + W * T)), Mr = Mc * Math.sqrt(1.25); // riser modulus so t_r = 1.25 t_c
    const Dr = 6 * Mr; // cylinder with H = D: modulus = D/6
    return {
      points: 20, prompt: `A ${L}×${W}×${T} mm block casting needs a cylindrical riser with $H = D$. If the riser must take 25% longer to solidify than the casting (Chvorinov, $n = 2$), find its diameter (mm). (Treat the riser's whole surface as cooling.)`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter mm.', answer: num(Dr), answerTex: `D = ${r2(Dr)}\\text{ mm}`,
      steps: [
        { key: 'mc', title: 'Casting modulus', body: `$\\frac{V}{A} = \\frac{${L}\\cdot${W}\\cdot${T}}{2(${L}\\cdot${W} + ${L}\\cdot${T} + ${W}\\cdot${T})} = ${r3(Mc)}$ mm` },
        { key: 'mr', title: 'Required riser modulus', body: `$t \\propto (V/A)^2$, so $\\left(\\frac VA\\right)_r = \\sqrt{1.25}\\,(${r3(Mc)}) = ${r3(Mr)}$ mm` },
        { key: 'd', title: 'Cylinder with H = D', body: R`$\frac VA = \frac{\pi D^3/4}{\pi D^2 + \pi D^2/2} = \frac D6$` + `, so $D = 6(${r3(Mr)}) = ${r2(Dr)}$ mm.` },
      ],
      mistakes: [{ expr: num(6 * Mc * 1.25), step: 'mr', why: 'Time goes with the square of the modulus: scale the modulus by $\\sqrt{1.25}$.' }, { expr: num(4 * Mr), step: 'd', why: 'For $H = D$ the modulus is $D/6$ (top and bottom also cool).' }],
    };
  }
  const k1 = pick(Object.keys(shapes)), k2 = pick(Object.keys(shapes).filter((k) => k !== k1)), a = pick([40, 50, 60, 80]), t1 = pick([2, 3, 4, 5]);
  const M1 = shapes[k1].M(a), M2 = shapes[k2].M(a), t2 = t1 * (M2 / M1) ** 2;
  return {
    points: 15, prompt: `In a test, ${shapes[k1].tex(a)} solidifies in $${t1}$ min. How long (min) will ${shapes[k2].tex(a)} of the same metal take, under the same conditions?`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter minutes.', answer: num(t2), answerTex: `t_2 = ${r3(t2)}\\text{ min}`,
    steps: [
      { key: 'ch', title: "Chvorinov's rule", body: R`$T_s = C_m\left(\frac VA\right)^2$: the mould constant $C_m$ is the same, so $t_2 = t_1\left(\frac{M_2}{M_1}\right)^2$.` },
      { key: 'm', title: 'Moduli', body: `$M_1 = ${r3(M1)}$ mm, $M_2 = ${r3(M2)}$ mm` },
      { key: 't', title: 'Time', body: `$t_2 = ${t1}\\left(\\frac{${r3(M2)}}{${r3(M1)}}\\right)^2 = ${r3(t2)}$ min` },
    ],
    mistakes: [{ expr: num(t1 * (M2 / M1)), step: 'ch', why: 'The exponent is 2: time scales with the modulus squared.' }, { expr: num(t1 * (M1 / M2) ** 2), step: 't', why: 'Ratio inverted: a larger modulus means slower cooling.' }],
  };
}

/* ---------- 3. Bulk forming ---------- */
function genRolling() {
  const kind = pick(['draft', 'force', 'force', 'forge']);
  if (kind === 'draft') {
    const mu = pick([0.08, 0.1, 0.12, 0.15]), Rr = pick([200, 250, 300]);
    return {
      points: 10, prompt: `Rolls of radius $${Rr}$ mm with a coefficient of friction $\\mu = ${mu}$. What is the maximum possible draft (mm) per pass?`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter mm.', answer: num(mu * mu * Rr), answerTex: `\\Delta h_{max} = \\mu^2R = ${r3(mu * mu * Rr)}\\text{ mm}`,
      steps: [{ key: 'b', title: 'Bite condition', body: R`The rolls can only pull the strip in if friction overcomes the push-back at entry: $\tan\alpha \le \mu$, which for small angles gives $\Delta h_{max} = \mu^2R$.` }],
      mistakes: [{ expr: num(mu * Rr), step: 'b', why: 'Friction enters squared.' }],
    };
  }
  if (kind === 'forge') {
    const r = pick([50, 75, 100]) / 2, h0 = pick([60, 80, 100]), red = pick([0.3, 0.4, 0.5]), K = pick([530, 315, 760]), n = { 530: 0.26, 315: 0.54, 760: 0.19 }[K], mu = pick([0.1, 0.2]);
    const h = h0 * (1 - red), rf = r * Math.sqrt(h0 / h), eps = Math.log(h0 / h), Yf = K * eps ** n, F = Yf * Math.PI * rf * rf * (1 + (2 * mu * rf) / (3 * h)) / 1e3;
    return {
      points: 25, prompt: `A cylinder $${2 * r}$ mm in diameter and $${h0}$ mm tall is upset (open-die forged) to ${Math.round(red * 100)}% less height. $\\sigma = ${K}\\varepsilon^{${n}}$ MPa, $\\mu = ${mu}$. Estimate the forging force (kN) at the end of the stroke.`,
      vars: [], sample: () => ({}), tol: 5e-3, hint: 'Enter kN.', answer: num(F), answerTex: `F = ${r2(F)}\\text{ kN}`,
      steps: [
        { key: 'g', title: 'Final geometry (constant volume)', body: `$h = ${r2(h)}$ mm, $r = ${r2(r)}\\sqrt{${h0}/${r2(h)}} = ${r3(rf)}$ mm` },
        { key: 'y', title: 'Flow stress at the end', body: `$\\varepsilon = \\ln\\frac{${h0}}{${r2(h)}} = ${r4(eps)}$, $Y_f = ${K}(${r4(eps)})^{${n}} = ${r2(Yf)}$ MPa` },
        { key: 'f', title: 'Force with friction', body: `$F = Y_f\\pi r^2\\left(1 + \\frac{2\\mu r}{3h}\\right) = ${r2(F)}$ kN` },
      ],
      mistakes: [{ expr: num((Yf * Math.PI * rf * rf) / 1e3), step: 'f', why: 'Friction at the dies raises the force: include $1 + \\frac{2\\mu r}{3h}$.' }, { expr: num((Yf * Math.PI * r * r * (1 + (2 * mu * r) / (3 * h))) / 1e3), step: 'g', why: 'The diameter grows as the height drops: use the final radius.' }, { expr: num((K * Math.PI * rf * rf * (1 + (2 * mu * rf) / (3 * h))) / 1e3), step: 'y', why: 'Use the flow stress at the final strain, not $K$.' }],
    };
  }
  const h0 = pick([25, 30, 40]), dh = pick([3, 5, 6, 8]), w = pick([150, 250, 300]), Rr = pick([250, 300, 350]), K = 530, n = 0.26, N = pick([50, 100]);
  const hf = h0 - dh, L = Math.sqrt(Rr * dh), eps = Math.log(h0 / hf), Yavg = (K * eps ** n) / (1 + n), F = (L * w * Yavg) / 1e6; // MN
  const ask = Math.random() < 0.65 ? 'F' : 'L';
  return {
    points: 20, prompt: `A ${w} mm wide, ${h0} mm thick annealed-steel strip ($\\sigma = ${K}\\varepsilon^{${n}}$ MPa) is rolled to ${hf} mm with ${Rr} mm radius rolls. ${ask === 'F' ? 'Estimate the roll force (MN).' : 'Find the roll–strip contact length (mm).'}`,
    vars: [], sample: () => ({}), tol: TOL, hint: ask === 'F' ? 'Enter MN.' : 'Enter mm.', answer: num(ask === 'F' ? F : L), answerTex: ask === 'F' ? `F = L\\,w\\,\\bar Y = ${r4(F)}\\text{ MN}` : `L = \\sqrt{R\\Delta h} = ${r2(L)}\\text{ mm}`,
    steps: [
      { key: 'L', title: 'Contact length', body: `$L = \\sqrt{R\\,\\Delta h} = \\sqrt{${Rr}\\cdot${dh}} = ${r2(L)}$ mm` },
      ...(ask === 'F' ? [{ key: 'y', title: 'Average flow stress', body: `$\\varepsilon = \\ln\\frac{${h0}}{${hf}} = ${r4(eps)}$, $\\bar Y = \\frac{K\\varepsilon^n}{1+n} = ${r2(Yavg)}$ MPa` }, { key: 'F', title: 'Roll force (frictionless estimate)', body: `$F = Lw\\bar Y = ${r2(L)}\\times${w}\\times${r2(Yavg)} = ${r4(F)}$ MN. Friction raises this by roughly 20%.` }] : []),
    ],
    mistakes: ask === 'F' ? [{ expr: num((L * w * K * eps ** n) / 1e6), step: 'y', why: 'Use the average flow stress, $\\frac{K\\varepsilon^n}{1+n}$.' }, { expr: num((Rr * dh * w * Yavg) / 1e6), step: 'L', why: 'The contact length is $\\sqrt{R\\Delta h}$.' }] : [{ expr: num(Math.sqrt(Rr * h0)), step: 'L', why: 'Use the draft $\\Delta h$, not the thickness.' }],
  };
}

/* ---------- 4. Machining mechanics ---------- */
function genCutting() {
  const a = pick([0, 5, 10, 15, 20]), t0 = pick([0.1, 0.2, 0.25, 0.3]), rr = pick([0.3, 0.35, 0.4, 0.45, 0.5]), tc = t0 / rr;
  const phi = Math.atan((rr * Math.cos(a * D2R)) / (1 - rr * Math.sin(a * D2R))) / D2R;
  const kind = pick(['phi', 'gamma', 'merchant', 'force']);
  if (kind === 'phi') return {
    points: 15, prompt: `Orthogonal cutting: rake angle $${a}^\\circ$, depth of cut $t_0 = ${t0}$ mm, chip thickness $t_c = ${r3(tc)}$ mm. Find the shear angle $\\phi$ (degrees).`,
    vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter degrees.', answer: num(phi), answerTex: `\\phi = ${r2(phi)}^\\circ`,
    steps: [{ key: 'r', title: 'Cutting ratio', body: `$r = \\frac{t_0}{t_c} = ${rr}$` }, { key: 'p', title: 'Shear angle', body: `$\\tan\\phi = \\frac{r\\cos\\alpha}{1 - r\\sin\\alpha} = ${r4(Math.tan(phi * D2R))}$, $\\phi = ${r2(phi)}^\\circ$` }],
    mistakes: [{ expr: num(Math.atan(rr) / D2R), step: 'p', why: 'Include the rake angle: $\\tan\\phi = \\frac{r\\cos\\alpha}{1 - r\\sin\\alpha}$.' }, { expr: num(Math.atan(1 / rr) / D2R), step: 'r', why: '$r = t_0/t_c < 1$; the chip is thicker than the cut.' }],
  };
  if (kind === 'gamma') {
    const g = 1 / Math.tan(phi * D2R) + Math.tan((phi - a) * D2R);
    return {
      points: 15, prompt: `Orthogonal cutting with rake angle $${a}^\\circ$ gives a shear angle of $${r2(phi)}^\\circ$. Find the shear strain $\\gamma$.`,
      vars: [], sample: () => ({}), tol: 3e-3, hint: 'Enter a number.', answer: num(g), answerTex: `\\gamma = \\cot\\phi + \\tan(\\phi - \\alpha) = ${r3(g)}`,
      steps: [{ key: 'g', title: 'Shear strain in the shear zone', body: `$\\gamma = \\cot\\phi + \\tan(\\phi - \\alpha) = ${r3(1 / Math.tan(phi * D2R))} + ${r3(Math.tan((phi - a) * D2R))} = ${r3(g)}$. Very large strains (2–5) are typical in machining.` }],
      mistakes: [{ expr: num(1 / Math.tan(phi * D2R)), step: 'g', why: 'Add the $\\tan(\\phi - \\alpha)$ term.' }, { expr: num(1 / Math.tan(phi * D2R) + Math.tan((phi + a) * D2R)), step: 'g', why: 'It is $\\phi - \\alpha$.' }],
    };
  }
  if (kind === 'merchant') {
    const mu = pick([0.4, 0.5, 0.6, 0.8, 1.0]), b = Math.atan(mu) / D2R, ph = 45 + a / 2 - b / 2;
    return {
      points: 15, prompt: `Using Merchant's theory, predict the shear angle (degrees) for rake angle $${a}^\\circ$ and tool–chip friction coefficient $\\mu = ${mu}$.`,
      vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter degrees.', answer: num(ph), answerTex: `\\phi = 45^\\circ + \\frac\\alpha2 - \\frac\\beta2 = ${r2(ph)}^\\circ`,
      steps: [{ key: 'b', title: 'Friction angle', body: `$\\beta = \\arctan\\mu = ${r2(b)}^\\circ$` }, { key: 'm', title: 'Minimum-energy shear plane', body: `$\\phi = 45^\\circ + \\frac{${a}}{2} - \\frac{${r2(b)}}{2} = ${r2(ph)}^\\circ$. More friction → smaller shear angle → thicker chip and more energy.` }],
      mistakes: [{ expr: num(45 + a / 2 - mu / 2), step: 'b', why: 'Convert $\\mu$ to the friction angle $\\beta = \\arctan\\mu$.' }, { expr: num(45 - a / 2 + b / 2), step: 'm', why: 'Signs: rake angle increases $\\phi$, friction decreases it.' }],
    };
  }
  const Fc = pick([800, 1000, 1200, 1500]), Ft = pick([300, 400, 500, 600]), V = pick([60, 120, 180]);
  const ask = pick(['mu', 'P']);
  const be = Math.atan(Ft / Fc) / D2R + a, mu = Math.tan(be * D2R), P = (Fc * V) / 60 / 1000;
  return {
    points: 20, prompt: `Orthogonal cutting at $V = ${V}$ m/min with rake $${a}^\\circ$ measures a cutting force $F_c = ${Fc}$ N and thrust force $F_t = ${Ft}$ N. ${ask === 'mu' ? 'Find the coefficient of friction on the rake face.' : 'Find the cutting power (kW).'}`,
    vars: [], sample: () => ({}), tol: 3e-3, hint: ask === 'mu' ? 'Enter a number.' : 'Enter kW.', answer: num(ask === 'mu' ? mu : P), answerTex: ask === 'mu' ? `\\mu = \\tan\\beta = ${r3(mu)}` : `P = F_cV = ${r3(P)}\\text{ kW}`,
    steps: ask === 'mu' ? [{ key: 'b', title: 'Merchant circle', body: `The resultant makes angle $\\beta - \\alpha$ with the cutting direction: $\\tan(\\beta - \\alpha) = \\frac{F_t}{F_c}$, so $\\beta = ${r2(be)}^\\circ$ and $\\mu = \\tan\\beta = ${r3(mu)}$.` }]
      : [{ key: 'p', title: 'Power', body: `Only $F_c$ does work (it is along the velocity): $P = F_cV = ${Fc}\\times\\frac{${V}}{60} = ${r2((Fc * V) / 60)}$ W.` }],
    mistakes: ask === 'mu' ? [{ expr: num(Ft / Fc), step: 'b', why: 'With a nonzero rake angle, $\\mu = \\tan(\\alpha + \\arctan(F_t/F_c))$, not $F_t/F_c$.' }].filter(() => a !== 0) : [{ expr: num((Math.hypot(Fc, Ft) * V) / 60000), step: 'p', why: 'The thrust force is perpendicular to the cutting velocity and does no work.' }, { expr: num((Fc * V) / 1000), step: 'p', why: 'Convert m/min to m/s.' }],
  };
}

/* ---------- 5. Tool life and MRR ---------- */
function genToolLife() {
  const kind = pick(['n', 'T', 'mrr', 'time']);
  if (kind === 'mrr' || kind === 'time') {
    const D = pick([50, 75, 100, 150]), d = pick([1, 2, 2.5, 3]), f = pick([0.15, 0.2, 0.25, 0.3]), N = pick([300, 500, 800]), Lc = pick([150, 200, 300]);
    const Dav = D - d, mrr = Math.PI * Dav * d * f * N, t = Lc / (f * N);
    return {
      points: 15, prompt: kind === 'mrr' ? `A $${D}$ mm bar is turned at $${N}$ rpm with depth of cut $${d}$ mm and feed $${f}$ mm/rev. Find the material removal rate (mm³/min).` : `How long (min) does one turning pass take over a length of $${Lc}$ mm at $${N}$ rpm and feed $${f}$ mm/rev?`,
      vars: [], sample: () => ({}), tol: TOL, hint: kind === 'mrr' ? 'Enter mm³/min.' : 'Enter minutes.', answer: num(kind === 'mrr' ? mrr : t), answerTex: kind === 'mrr' ? `MRR = \\pi D_{avg}dfN = ${Math.round(mrr)}\\text{ mm}^3\\text{/min}` : `t = \\frac{l}{fN} = ${r3(t)}\\text{ min}`,
      steps: kind === 'mrr' ? [{ key: 'd', title: 'Average diameter', body: `$D_{avg} = \\frac{D_0 + D_f}{2} = ${D} - ${d} = ${Dav}$ mm (the diameter shrinks by $2d$)` }, { key: 'm', title: 'Removal rate', body: `$MRR = \\pi D_{avg}\\,d\\,f\\,N = ${Math.round(mrr)}$ mm³/min` }] : [{ key: 'v', title: 'Feed rate', body: `Tool advances $fN = ${r2(f * N)}$ mm/min, so $t = ${Lc}/${r2(f * N)} = ${r3(t)}$ min.` }],
      mistakes: kind === 'mrr' ? [{ expr: num(Math.PI * D * d * f * N), step: 'd', why: 'Use the average diameter $D_0 - d$.' }, { expr: num(Math.PI * (D - 2 * d) * d * f * N), step: 'd', why: '$D_f = D_0 - 2d$, so $D_{avg} = D_0 - d$.' }] : [{ expr: num(Lc / f), step: 'v', why: 'Feed is per revolution: multiply by the spindle speed.' }],
    };
  }
  const n = pick([0.15, 0.2, 0.25, 0.3, 0.5]), C = pick([150, 200, 300, 400, 500]);
  if (kind === 'T') {
    const V = C * pick([0.4, 0.5, 0.6]), T = (C / V) ** (1 / n);
    return {
      points: 15, prompt: `Taylor's equation for a tool is $VT^{${n}} = ${C}$ ($V$ in m/min, $T$ in min). Find the tool life at $V = ${r2(V)}$ m/min.`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter minutes.', answer: num(T), answerTex: `T = \\left(\\frac CV\\right)^{1/n} = ${r2(T)}\\text{ min}`,
      steps: [{ key: 't', title: 'Solve for T', body: `$T = \\left(\\frac{${C}}{${r2(V)}}\\right)^{1/${n}} = ${r2(T)}$ min. Small $n$ means life is very sensitive to speed.` }],
      mistakes: [{ expr: num((C / V) ** n), step: 't', why: 'Raise to $1/n$, not $n$.' }],
    };
  }
  const V1 = pick([100, 150, 200]), T1 = pick([20, 30, 60]), T2 = pick([5, 8, 10]), V2 = V1 * (T1 / T2) ** n;
  const ask = Math.random() < 0.6 ? 'n' : 'C';
  const v = ask === 'n' ? n : V1 * T1 ** n;
  return {
    points: 20, prompt: `A tool lasts $${T1}$ min at $${V1}$ m/min and $${T2}$ min at $${r2(V2)}$ m/min. Find ${ask === 'n' ? 'the Taylor exponent $n$' : 'the Taylor constant $C$ (m/min)'}.`,
    vars: [], sample: () => ({}), tol: 3e-3, hint: 'Enter a number.', answer: num(v), answerTex: ask === 'n' ? `n = ${r4(n)}` : `C = ${r2(V1 * T1 ** n)}`,
    steps: [
      { key: 'n', title: 'Exponent from two tests', body: `$V_1T_1^n = V_2T_2^n \\Rightarrow n = \\frac{\\ln(V_2/V_1)}{\\ln(T_1/T_2)} = \\frac{\\ln(${r2(V2)}/${V1})}{\\ln(${T1}/${T2})} = ${r4(n)}$` },
      { key: 'C', title: 'Constant', body: `$C = V_1T_1^n = ${V1}(${T1})^{${r4(n)}} = ${r2(V1 * T1 ** n)}$ m/min (the speed that gives a 1-minute life)` },
    ],
    mistakes: ask === 'n' ? [{ expr: num(Math.log(V2 / V1) / Math.log(T2 / T1)), step: 'n', why: 'Higher speed means shorter life: $n = \\ln(V_2/V_1)/\\ln(T_1/T_2) > 0$.' }, { expr: num(Math.log(T1 / T2) / Math.log(V2 / V1)), step: 'n', why: 'Ratio inverted.' }] : [{ expr: num(V1 * T1), step: 'C', why: 'Raise $T$ to the power $n$.' }],
  };
}

/* ================= lessons ================= */
const LMat = [
  { type: 'text', kind: 'key', title: 'Manufacturing is controlled plastic deformation (or melting, or cutting)', body: R`To shape metal without breaking it you need its flow behaviour: how much stress it takes to keep deforming. True stress $\sigma = F/A$ and true strain $\varepsilon = \ln(L/L_0)$ are the natural measures; volume is conserved in plastic flow, so $\varepsilon = \ln(1+e)$, $\sigma = s(1+e)$.` },
  { type: 'text', kind: 'method', title: 'Flow curve', body: R`Cold metals strain-harden: $\sigma = K\varepsilon^n$ ($K$ strength coefficient, $n$ strain-hardening exponent). Necking in tension starts at $\varepsilon = n$. Forming loads use the flow stress $Y_f = K\varepsilon^n$ at the end, or the average $\bar Y = \frac{K\varepsilon^n}{1+n}$ over the deformation.` },
  {
    type: 'graph', title: 'Flow curves',
    body: R`High $n$ (copper, stainless) keeps hardening and spreads deformation before necking; low $n$ (aluminium alloys) flattens out. The dot marks necking, at $\varepsilon = n$.`,
    widget: {
      params: [{ key: 'K', label: 'K (MPa)', min: 200, max: 1300, step: 25, value: 530 }, { key: 'n', label: 'n', min: 0.05, max: 0.6, step: 0.01, value: 0.26 }],
      x: [0, 1.2], y: 'auto', xLabel: 'true strain ε', yLabel: 'σ (MPa)',
      curves: (p) => [{ fn: (e) => p.K * e ** p.n, label: 'σ = Kεⁿ' }, { fn: (e) => (p.K * e ** p.n) / (1 + p.n), label: 'average flow stress', dash: true, color: 1 }],
      points: (p) => [{ x: p.n, y: p.K * p.n ** p.n, label: 'necking' }],
      readout: (p) => `At $\\varepsilon = 0.5$: $Y_f = ${r2(p.K * 0.5 ** p.n)}$, $\\bar Y = ${r2((p.K * 0.5 ** p.n) / (1 + p.n))}$ MPa`,
    },
  },
  { type: 'quiz', prompt: R`Hot working mostly removes`, options: [{ tex: 'Strain hardening (n ≈ 0), so forces are lower', correct: true }, { tex: 'Volume constancy', why: 'Plastic flow conserves volume at any temperature.' }, { tex: 'The need for a flow stress', why: 'Hot metal still has a flow stress, just lower and rate-dependent.' }] },
];
const LCast = [
  { type: 'text', kind: 'key', title: 'Casting', body: R`Pour liquid metal into a mould and let it solidify. Key questions: does it fill before freezing (gating design), where does it freeze last (risers feed shrinkage), and how long does it take?` },
  { type: 'text', kind: 'method', title: "Chvorinov's rule", body: R`$T_s = C_m\left(\frac VA\right)^n$ with $n \approx 2$: thick, compact sections take longest. A riser must solidify after the section it feeds, so it needs a larger modulus $V/A$ (often $T_{riser} = 1.25\,T_{casting}$).` },
  {
    type: 'graph', title: 'Shape decides freezing time',
    body: R`Freezing time $\propto (V/A)^2$ for a sphere, a cube and a 5:5:1 plate of the same volume. Compact shapes have the most volume per unit of cooling surface — which is why risers are spheres or squat cylinders, and thin plates freeze first.`,
    widget: {
      params: [{ key: 'V', label: 'volume (cm³)', min: 50, max: 3000, step: 50, value: 1000 }],
      x: [10, 3000], y: 'auto', xLabel: 'volume (cm³)', yLabel: 'relative time',
      curves: [{ fn: (v) => (Math.cbrt((6 * v * 1000) / Math.PI) / 6) ** 2, label: 'sphere' }, { fn: (v) => (Math.cbrt(v * 1000) / 6) ** 2, label: 'cube', color: 1 }, { fn: (v) => (Math.cbrt(5 * v * 1000) / 14) ** 2, label: 'plate 5:5:1', color: 2 }],
      vlines: (p) => [{ x: p.V }],
      readout: (p) => { const s = Math.cbrt((6 * p.V * 1000) / Math.PI) / 6, c = Math.cbrt(p.V * 1000) / 6, pl = Math.cbrt(5 * p.V * 1000) / 14; return `$V/A$: sphere $${r2(s)}$, cube $${r2(c)}$, plate $${r2(pl)}$ mm → times $${r2((s / c) ** 2)} : 1 : ${r2((pl / c) ** 2)}$`; },
    },
  },
  { type: 'example', title: 'Worked example: riser sizing', prompt: R`Block 125×100×20 mm; cylindrical riser with $H = D$, $T_r = 1.25T_c$.`, steps: [R`$\left(\frac VA\right)_c = \frac{250000}{2(12500 + 2500 + 2000)} = 7.35$ mm.`, R`$\left(\frac VA\right)_r = \sqrt{1.25}(7.35) = 8.22$ mm.`, R`For $H = D$: $V/A = D/6$, so $D = 49.3$ mm.`] },
  { type: 'text', kind: 'method', title: 'Filling the mould', body: R`Bernoulli down the sprue: $v = \sqrt{2gh}$; continuity $Q = vA$ (so the sprue tapers to avoid aspiration); fill time $V/Q$.` },
  { type: 'input', prompt: R`Velocity at the base of a 200 mm sprue (m/s)?`, answer: '1.981', tol: 2e-3, explain: R`$\sqrt{2(9.81)(0.2)} = 1.98$ m/s.` },
];
const LForm = [
  { type: 'text', kind: 'key', title: 'Bulk deformation', body: R`Rolling, forging, extrusion and drawing reshape the whole workpiece plastically. Loads ≈ (flow stress) × (contact area) × (a friction factor ≥ 1).` },
  { type: 'text', kind: 'method', title: 'Flat rolling', body: R`Draft $\Delta h = h_0 - h_f$; strain $\varepsilon = \ln(h_0/h_f)$; contact length $L = \sqrt{R\Delta h}$; roll force $F \approx Lw\bar Y$; maximum draft $\mu^2R$ (bite condition).` },
  {
    type: 'graph', title: 'The roll gap',
    body: R`Change the draft and roll radius: the contact arc $L = \sqrt{R\Delta h}$ grows, and so does the force. Big drafts need big rolls or more friction to bite.`,
    widget: {
      params: [{ key: 'dh', label: 'draft Δh (mm)', min: 1, max: 15, step: 0.5, value: 6 }, { key: 'R', label: 'roll radius R (mm)', min: 100, max: 400, step: 10, value: 250 }],
      kind: 'sketch', height: 260, view: [-90, 90, -70, 70],
      items: (p) => { const h0 = 30, hf = h0 - p.dh, L = Math.sqrt(p.R * p.dh), k = 0.25; return [{ t: 'circle', x: 0, y: hf / 2 * k + p.R * k, r: p.R * k, color: 0 }, { t: 'circle', x: 0, y: -hf / 2 * k - p.R * k, r: p.R * k, color: 0 }, { t: 'poly', pts: [[-90, h0 / 2 * k], [-L * k, h0 / 2 * k], [0, hf / 2 * k], [90, hf / 2 * k], [90, -hf / 2 * k], [0, -hf / 2 * k], [-L * k, -h0 / 2 * k], [-90, -h0 / 2 * k]], color: 2, fill: true, opacity: 0.3 }, { t: 'line', x1: -L * k, y1: h0 / 2 * k + 6, x2: 0, y2: h0 / 2 * k + 6, color: 3 }, { t: 'text', x: -L * k / 2, y: h0 / 2 * k + 6, dy: -6, text: `L = ${r2(L)} mm`, color: 3, size: 11 }]; },
      readout: (p) => { const L = Math.sqrt(p.R * p.dh), e = Math.log(30 / (30 - p.dh)), Y = (530 * e ** 0.26) / 1.26; return `Steel, 30 mm → ${30 - p.dh} mm, 250 mm wide: $\\varepsilon = ${r3(e)}$, $\\bar Y = ${r2(Y)}$ MPa, $F \\approx ${r3((L * 250 * Y) / 1e6)}$ MN; bite needs $\\mu \\ge ${r3(Math.sqrt(p.dh / p.R))}$`; },
    },
  },
  { type: 'text', kind: 'method', title: 'Open-die forging (upsetting)', body: R`Compressing a cylinder between flat dies: $F = Y_f\pi r^2\left(1 + \frac{2\mu r}{3h}\right)$. Friction matters more as the part gets flatter ($r/h$ large) — and the barrel shape you see is that friction holding the faces back.` },
  { type: 'quiz', prompt: R`Why is the roll force estimate $Lw\bar Y$ a lower bound?`, options: [{ tex: 'It ignores friction in the roll gap', correct: true }, { tex: 'It uses the average flow stress', why: 'Averaging is correct for the work done; friction is what is missing.' }, { tex: 'The contact length is overestimated', why: R`$\sqrt{R\Delta h}$ is the projected arc; it is fine.` }] },
];
const LCut = [
  { type: 'text', kind: 'key', title: 'Orthogonal cutting', body: R`A wedge tool (rake angle $\alpha$) shears a layer $t_0$ thick into a chip of thickness $t_c$ along a shear plane at angle $\phi$. Cutting ratio $r = t_0/t_c < 1$; $\tan\phi = \frac{r\cos\alpha}{1 - r\sin\alpha}$; shear strain $\gamma = \cot\phi + \tan(\phi-\alpha)$.` },
  {
    type: 'graph', title: 'The shear plane',
    body: R`More rake or less friction → a larger shear angle → thinner chip, less strain, less energy. Merchant: $\phi = 45^\circ + \frac\alpha2 - \frac\beta2$.`,
    widget: {
      params: [{ key: 'a', label: 'rake angle α (°)', min: -10, max: 30, step: 1, value: 10 }, { key: 'mu', label: 'friction μ', min: 0.2, max: 1.4, step: 0.05, value: 0.6 }],
      kind: 'sketch', height: 280, view: [-3, 3.5, -1.6, 2.6],
      items: (p) => { const b = Math.atan(p.mu), ph = (45 + p.a / 2) * D2R - b / 2, ra = p.a * D2R, t0 = 0.6, tc = (t0 * Math.cos(ph - ra)) / Math.sin(ph), sx = -t0 / Math.tan(ph); const u = [Math.sin(ra), Math.cos(ra)], nr = [-Math.cos(ra), Math.sin(ra)], Lc = 2.2; const top = [Lc * u[0], Lc * u[1]]; return [{ t: 'poly', pts: [[-3, 0], [3.4, 0], [3.4, -1.5], [-3, -1.5]], color: 'muted', fill: 'muted' }, { t: 'poly', pts: [[-3, 0], [-3, t0], [sx, t0], [0, 0]], color: 2, fill: true, opacity: 0.25 }, { t: 'poly', pts: [[0, 0], top, [top[0] + tc * nr[0], top[1] + tc * nr[1]], [sx, t0]], color: 2, fill: true, opacity: 0.45 }, { t: 'poly', pts: [[0.03, 0.02], [top[0] + 0.03, top[1] + 0.3], [top[0] + 1.6, top[1] + 0.3], [1.8, 0.18]], color: 0, fill: true, opacity: 0.2 }, { t: 'line', x1: 0, y1: 0, x2: sx, y2: t0, color: 3, width: 3 }, { t: 'text', x: sx, y: t0, dx: -6, dy: -4, text: `φ = ${r2(ph / D2R)}°`, anchor: 'end', color: 3, size: 12 }, { t: 'text', x: top[0] + 0.9, y: top[1] - 0.6, text: 'tool', color: 0 }, { t: 'text', x: top[0] + tc * nr[0] - 0.1, y: top[1] * 0.75, text: 'chip', anchor: 'end', color: 2 }, { t: 'text', x: -1.8, y: -0.8, text: 'workpiece', color: 'muted' }]; },
      readout: (p) => { const b = Math.atan(p.mu), ph = (45 + p.a / 2) * D2R - b / 2; return `$\\beta = ${r2(b / D2R)}^\\circ$, $\\phi = ${r2(ph / D2R)}^\\circ$, $r = \\frac{t_0}{t_c} = ${r3(Math.sin(ph) / Math.cos(ph - p.a * D2R))}$, $\\gamma = ${r3(1 / Math.tan(ph) + Math.tan(ph - p.a * D2R))}$`; },
    },
  },
  { type: 'text', kind: 'method', title: 'Forces and power', body: R`Measured cutting force $F_c$ (along $V$) and thrust $F_t$: friction angle from $\tan(\beta - \alpha) = F_t/F_c$. Power $= F_cV$; specific energy $u = \frac{F_cV}{MRR}$.` },
  { type: 'example', title: 'Worked example', prompt: R`$\alpha = 10^\circ$, $t_0 = 0.25$ mm, $t_c = 0.625$ mm.`, steps: [R`$r = 0.4$; $\tan\phi = \frac{0.4\cos10^\circ}{1 - 0.4\sin10^\circ} = 0.423$, $\phi = 22.9^\circ$.`, R`$\gamma = \cot22.9^\circ + \tan12.9^\circ = 2.37 + 0.23 = 2.60$.`] },
  { type: 'quiz', prompt: 'Which force does the cutting power come from?', options: [{ tex: 'The cutting force F_c only', correct: true }, { tex: 'The resultant of F_c and F_t', why: 'The thrust force is perpendicular to the velocity: no work.' }, { tex: 'The thrust force', why: 'Thrust is perpendicular to the cutting velocity.' }] },
];
const LTool = [
  { type: 'text', kind: 'key', title: 'Tool wear and Taylor’s equation', body: R`Tools wear (flank wear, crater wear) faster at higher speed because the cutting temperature rises. Taylor: $VT^n = C$, with $n \approx 0.1$–$0.15$ for HSS, $0.2$–$0.5$ for carbides and ceramics. $C$ is the speed giving a 1-minute life.` },
  {
    type: 'graph', title: 'Tool life on log axes',
    body: R`On log–log axes Taylor's law is a straight line of slope $-1/n$. A small $n$ means a small speed increase destroys tool life.`,
    widget: {
      params: [{ key: 'n', label: 'Taylor n', min: 0.08, max: 0.5, step: 0.01, value: 0.25 }, { key: 'C', label: 'C (m/min)', min: 50, max: 600, step: 10, value: 300 }],
      x: [1, 3], y: [-1, 4], xLabel: 'log₁₀ V (m/min)', yLabel: 'log₁₀ T (min)',
      curves: (p) => [{ fn: (x) => (Math.log10(p.C) - x) / p.n, label: 'log T' }],
      readout: (p) => `At $V = ${r2(p.C / 2)}$ m/min ($C/2$), $T = 2^{1/n} = ${r2(2 ** (1 / p.n))}$ min; at $C/3$, $T = ${r2(3 ** (1 / p.n))}$ min`,
    },
  },
  { type: 'text', kind: 'method', title: 'Turning: removal rate and time', body: R`Cutting speed $V = \pi DN$; $MRR = \pi D_{avg}\,d\,f\,N$ with $D_{avg} = D_0 - d$; cutting time for length $l$: $t = \frac{l}{fN}$.` },
  { type: 'example', title: 'Worked example: Taylor constants', prompt: R`60 min at 100 m/min, 10 min at 156.5 m/min.`, steps: [R`$n = \frac{\ln(156.5/100)}{\ln(60/10)} = \frac{0.448}{1.792} = 0.25$.`, R`$C = 100(60)^{0.25} = 278$ m/min.`] },
  { type: 'input', prompt: R`$VT^{0.25} = 300$. Tool life (min) at 150 m/min?`, answer: '16', explain: R`$T = (300/150)^{1/0.25} = 2^4 = 16$ min.` },
];

SA.registerCourse({
  course: 'MECH 3700',
  chapters: [{ id: 'mf-shape', name: 'Shaping: material, casting, forming' }, { id: 'mf-mach', name: 'Machining' }],
  topics: [
    { id: 'mf-flow', ch: 'mf-shape', sec: 'mf1', name: 'Flow stress', desc: 'True values, Kεⁿ, necking.', gen: genFlow },
    { id: 'mf-cast', ch: 'mf-shape', sec: 'mf2', name: 'Casting', desc: 'Chvorinov, risers, sprue flow.', gen: genCasting },
    { id: 'mf-form', ch: 'mf-shape', sec: 'mf3', name: 'Rolling and forging', desc: 'Draft, contact length, forces.', gen: genRolling },
    { id: 'mf-cut', ch: 'mf-mach', sec: 'mf4', name: 'Orthogonal cutting', desc: 'Shear angle, strain, Merchant.', gen: genCutting },
    { id: 'mf-tool', ch: 'mf-mach', sec: 'mf5', name: 'Tool life and MRR', desc: 'Taylor, removal rate, time.', gen: genToolLife },
  ],
  sections: [
    { id: 'mf1', tag: 'Wk 1–2', num: '1', title: 'Material behaviour in processing', chapter: 'Winter preview · Shaping', skills: ['mf-flow'], lesson: LMat },
    { id: 'mf2', tag: 'Wk 3', num: '2', title: 'Casting', chapter: 'Winter preview · Shaping', skills: ['mf-cast'], lesson: LCast },
    { id: 'mf3', tag: 'Wk 4', num: '3', title: 'Rolling and forging', chapter: 'Winter preview · Shaping', skills: ['mf-form'], lesson: LForm },
    { id: 'mf4', tag: 'Wk 5', num: '4', title: 'Mechanics of cutting', chapter: 'Winter preview · Machining', skills: ['mf-cut'], lesson: LCut },
    { id: 'mf5', tag: 'Wk 6', num: '5', title: 'Tool life and turning economics', chapter: 'Winter preview · Machining', skills: ['mf-tool'], lesson: LTool },
  ],
});
