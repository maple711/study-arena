// MAAE 3500 — Feedback Control Systems (Winter). First half of the course, built ahead of time from the
// calendar description and the standard text (Nise, Control Systems Engineering): feedback basics,
// transient response, steady-state error, Routh–Hurwitz stability and root-locus sketching.
const { R, pick, randInt, rand, rnd, bisect } = SA;
const r2 = (v) => +v.toFixed(2), r3 = (v) => +v.toFixed(3), r4 = (v) => +v.toFixed(4);
const num = (v) => String(rnd(v));
const sampS = () => ({ s: rand(0.5, 4) });
const pmT = (v) => (v < 0 ? `- ${Math.abs(v)}` : `+ ${v}`);
const sp = (a) => (a === 0 ? 's' : `(s ${pmT(a)})`);

// standard second-order underdamped / critically / overdamped unit-step response
function step2(z, wn, t) {
  if (t < 0) return 0;
  if (z < 1) { const wd = wn * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * wn * t) * (Math.cos(wd * t) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * t)); }
  if (z === 1) return 1 - Math.exp(-wn * t) * (1 + wn * t);
  const s1 = -wn * (z - Math.sqrt(z * z - 1)), s2 = -wn * (z + Math.sqrt(z * z - 1));
  return 1 + (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s1 - s2);
}
// polynomial roots (Durand–Kerner); coeffs highest power first, monic not required
function roots(c) {
  const n = c.length - 1, a = c.map((x) => x / c[0]);
  let z = Array.from({ length: n }, (_, k) => ({ re: 0.4 * Math.cos((2 * Math.PI * k) / n + 0.4) * 2, im: 0.9 * Math.sin((2 * Math.PI * k) / n + 0.4) * 2 }));
  const mul = (p, q) => ({ re: p.re * q.re - p.im * q.im, im: p.re * q.im + p.im * q.re });
  const div = (p, q) => { const d = q.re * q.re + q.im * q.im; return { re: (p.re * q.re + p.im * q.im) / d, im: (p.im * q.re - p.re * q.im) / d }; };
  const ev = (x) => { let r = { re: 1, im: 0 }; for (let i = 1; i <= n; i++) r = { re: r.re * x.re - r.im * x.im + a[i], im: r.re * x.im + r.im * x.re }; return r; };
  for (let it = 0; it < 300; it++) {
    z = z.map((zi, i) => { let d = { re: 1, im: 0 }; z.forEach((zj, j) => { if (j !== i) d = mul(d, { re: zi.re - zj.re, im: zi.im - zj.im }); }); const f = div(ev(zi), d); return { re: zi.re - f.re, im: zi.im - f.im }; });
  }
  return z;
}

/* ================= generators ================= */
function genClosedLoop() {
  const K = randInt(2, 20), a = randInt(1, 6), b = pick([1, 1, 2, 0.5]);
  const kind = pick(['unity', 'H', 'pos']);
  const H = kind === 'H' ? b : 1, sign = kind === 'pos' ? -1 : 1;
  const ans = `${K}/(s^2+${a}*s+${sign * H * K})`;
  return {
    points: 15,
    prompt: `Find the closed-loop transfer function $\\frac{C(s)}{R(s)}$ for forward path $G(s) = \\frac{${K}}{s(s+${a})}$ and ${kind === 'unity' ? 'unity negative feedback' : kind === 'H' ? `negative feedback through $H(s) = ${H}$` : 'unity positive feedback'}.`,
    vars: ['s'], sample: sampS, hint: 'Answer in terms of s.', answer: ans, answerTex: `\\frac{${K}}{s^2 + ${a}s ${pmT(sign * H * K)}}`,
    figure: { kind: 'blocks', forward: [`${K}/[s(s+${a})]`], feedback: kind === 'H' ? String(H) : '1', sign: kind === 'pos' ? '+' : '−' },
    steps: [
      { key: 'f', title: 'Feedback formula', body: kind === 'pos' ? R`Positive feedback: $T = \dfrac{G}{1 - GH}$.` : R`Negative feedback: $T = \dfrac{G}{1 + GH}$.` },
      { key: 'c', title: 'Clear the fractions', body: `Multiply top and bottom by $s(s+${a})$: $T = \\dfrac{${K}}{s(s+${a}) ${kind === 'pos' ? '-' : '+'} ${H * K}}$` },
    ],
    mistakes: [
      { expr: `${K}/(s^2+${a}*s+${-sign * H * K})`, step: 'f', why: 'Check the sign in the denominator: $1 + GH$ for negative feedback, $1 - GH$ for positive.' },
      { expr: `${K}/(s^2+${a}*s)`, step: 'f', why: 'That is the open-loop $G$; closing the loop adds $GH$ to the denominator.' },
      ...(H !== 1 ? [{ expr: `${K}/(s^2+${a}*s+${K})`, step: 'c', why: `The feedback gain $H = ${H}$ multiplies $K$ in the denominator.` }] : []),
    ],
  };
}

function genTransient() {
  const wn = pick([2, 4, 5, 10]), z = pick([0.2, 0.3, 0.4, 0.5, 0.6, 0.7]);
  const kind = pick(['OS', 'Ts', 'Tp', 'zeta', 'first']);
  const a = 2 * z * wn, b = wn * wn;
  const tf = `\\frac{${r4(b)}}{s^2 + ${r4(a)}s + ${r4(b)}}`;
  if (kind === 'first') {
    const k = randInt(2, 10), p = pick([2, 4, 5, 10]);
    const ask = pick(['tau', 'Ts', 'Tr']);
    const v = { tau: 1 / p, Ts: 4 / p, Tr: 2.2 / p }[ask];
    return {
      points: 10, prompt: `For $G(s) = \\frac{${k}}{s + ${p}}$, find the ${{ tau: 'time constant (s)', Ts: '2% settling time (s)', Tr: '10–90% rise time (s)' }[ask]} of the step response.`,
      vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter seconds.', answer: num(v), answerTex: { tau: `\\tau = \\frac1a = ${r4(v)}`, Ts: `T_s = \\frac4a = ${r4(v)}`, Tr: `T_r = \\frac{2.2}{a} = ${r4(v)}` }[ask] + '\\text{ s}',
      steps: [{ key: 'f', title: 'First-order system', body: R`$\frac{K}{s+a}$ has pole $-a$; step response $\frac Ka(1 - e^{-at})$. $\tau = 1/a$, $T_s = 4/a$, $T_r = 2.2/a$. The numerator only sets the final value.` }],
      mistakes: [{ expr: num(ask === 'tau' ? p : ask === 'Ts' ? 4 * p : 2.2 * p), step: 'f', why: 'Times scale with $1/a$, not $a$.' }, { expr: num((ask === 'tau' ? 1 : ask === 'Ts' ? 4 : 2.2) / k), step: 'f', why: 'The numerator does not set the speed; the pole does.' }],
    };
  }
  const OS = Math.exp((-z * Math.PI) / Math.sqrt(1 - z * z)) * 100, Ts = 4 / (z * wn), Tp = Math.PI / (wn * Math.sqrt(1 - z * z));
  if (kind === 'zeta') {
    const os = pick([5, 10, 15, 20, 30, 40]), L = Math.log(os / 100), zz = -L / Math.sqrt(Math.PI ** 2 + L * L);
    return {
      points: 15, prompt: `What damping ratio $\\zeta$ gives $${os}\\%$ overshoot in a second-order step response?`,
      vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter a number.', answer: num(zz), answerTex: `\\zeta = ${r4(zz)}`,
      steps: [{ key: 'f', title: 'Invert the overshoot formula', body: `$\\zeta = \\dfrac{-\\ln(\\%OS/100)}{\\sqrt{\\pi^2 + \\ln^2(\\%OS/100)}} = \\dfrac{${r4(-L)}}{\\sqrt{\\pi^2 + ${r4(L * L)}}} = ${r4(zz)}$` }],
      mistakes: [{ expr: num(-Math.log(os) / Math.sqrt(Math.PI ** 2 + Math.log(os) ** 2)), step: 'f', why: 'Use the fraction ($0.' + String(os).padStart(2, '0') + '$), not the percentage.' }],
    };
  }
  const v = { OS, Ts, Tp }[kind];
  return {
    points: 15, prompt: `For $T(s) = ${tf}$, find the ${{ OS: 'percent overshoot', Ts: '2% settling time (s)', Tp: 'peak time (s)' }[kind]} of the unit-step response.`,
    vars: [], sample: () => ({}), tol: 3e-3, hint: kind === 'OS' ? 'Enter a percentage.' : 'Enter seconds.', answer: num(v), answerTex: { OS: `\\%OS = ${r2(OS)}\\%`, Ts: `T_s = \\frac{4}{\\zeta\\omega_n} = ${r4(Ts)}\\text{ s}`, Tp: `T_p = \\frac{\\pi}{\\omega_n\\sqrt{1-\\zeta^2}} = ${r4(Tp)}\\text{ s}` }[kind],
    steps: [
      { key: 'id', title: 'Read ωn and ζ', body: `Match $s^2 + 2\\zeta\\omega_ns + \\omega_n^2$: $\\omega_n = \\sqrt{${r4(b)}} = ${wn}$, $2\\zeta\\omega_n = ${r4(a)}$ so $\\zeta = ${z}$.` },
      { key: 'f', title: 'Formula', body: { OS: R`$\%OS = e^{-\zeta\pi/\sqrt{1-\zeta^2}}\times100$`, Ts: R`$T_s \approx \frac{4}{\zeta\omega_n}$ (envelope $e^{-\zeta\omega_nt}$ falls to 2%)`, Tp: R`$T_p = \frac{\pi}{\omega_d}$, $\omega_d = \omega_n\sqrt{1-\zeta^2}$` }[kind] },
      { key: 'n', title: 'Result', body: `$\\%OS = ${r2(OS)}\\%$, $T_s = ${r4(Ts)}$ s, $T_p = ${r4(Tp)}$ s` },
    ],
    mistakes: [
      { expr: num(kind === 'OS' ? Math.exp((-0.5 * a * Math.PI) / Math.sqrt(1 - 0.25 * a * a)) * 100 : kind === 'Ts' ? 4 / a : Math.PI / Math.sqrt(b - 0.25 * a * a * a)), step: 'id', why: `The $s$ coefficient is $2\\zeta\\omega_n$, not $\\zeta$.` },
      ...(kind === 'Tp' ? [{ expr: num(Math.PI / wn), step: 'f', why: 'Use the damped frequency $\\omega_d = \\omega_n\\sqrt{1-\\zeta^2}$.' }] : []),
      ...(kind === 'Ts' ? [{ expr: num(4 / wn), step: 'f', why: '$T_s = 4/(\\zeta\\omega_n)$: the decay rate is the real part of the poles.' }] : []),
    ],
  };
}

function genSSE() {
  const type = pick([0, 1, 1, 2]), K = pick([5, 10, 20, 50, 100]), p1 = randInt(1, 5), p2 = randInt(2, 8), z = randInt(1, 6);
  const input = pick(type === 0 ? ['step', 'step', 'ramp'] : type === 1 ? ['step', 'ramp', 'ramp', 'parabola'] : ['ramp', 'parabola', 'parabola']);
  const den = `${type === 0 ? '' : type === 1 ? 's' : 's^2'}(s+${p1})(s+${p2})`;
  const Kc = (K * z) / (p1 * p2); // constant part of s^type G(s) at s=0
  let e, kName;
  if (input === 'step') { e = type === 0 ? 1 / (1 + Kc) : 0; kName = 'K_p'; }
  else if (input === 'ramp') { e = type === 0 ? Infinity : type === 1 ? 1 / Kc : 0; kName = 'K_v'; }
  else { e = type < 2 ? Infinity : 1 / Kc; kName = 'K_a'; }
  if (!Number.isFinite(e)) {
    return {
      points: 10, type: 'choice', prompt: `Unity feedback with $G(s) = \\frac{${K}(s+${z})}{${den}}$. What is the steady-state error to a unit ${input}?`,
      options: [{ tex: 'Infinite', correct: true, why: '', step: 't' }, { tex: 'Zero', why: `A type-${type} system cannot follow a ${input}.`, step: 't' }, { tex: `$\\frac{1}{${r3(Kc)}}$`, why: `That would need one more integrator in $G$.`, step: 't' }],
      answerTex: 'Infinite', hint: 'Count the integrators (poles at s = 0).',
      steps: [{ key: 't', title: 'System type', body: `$G$ has ${type} pole${type === 1 ? '' : 's'} at the origin: type ${type}. A type-${type} system has infinite error to inputs ${type === 0 ? 'ramp and above' : 'parabola'}: ${kName} = 0.` }], mistakes: [],
    };
  }
  return {
    points: 15, prompt: `Unity negative feedback with $G(s) = \\frac{${K}(s+${z})}{${den}}$. Find the steady-state error to a unit ${input}${input === 'ramp' ? ' $r(t) = t$' : input === 'parabola' ? ' $r(t) = t^2/2$' : ''}.`,
    vars: [], sample: () => ({}), tol: 3e-3, hint: 'Enter a number.', answer: num(e), answerTex: `e_{ss} = ${r4(e)}`,
    steps: [
      { key: 't', title: 'System type', body: `${type} integrator${type === 1 ? '' : 's'} in $G$: type ${type}.` },
      { key: 'k', title: 'Error constant', body: e === 0 ? `A type-${type} system tracks a ${input} with zero error.` : `$${kName} = \\lim_{s\\to0}${type === 0 ? '' : type === 1 ? 's' : 's^2'}G(s) = \\frac{${K}\\cdot${z}}{${p1}\\cdot${p2}} = ${r4(Kc)}$` },
      { key: 'e', title: 'Error', body: e === 0 ? '$e_{ss} = 0$' : input === 'step' ? `$e_{ss} = \\frac{1}{1 + K_p} = ${r4(e)}$` : `$e_{ss} = \\frac{1}{${kName}} = ${r4(e)}$` },
    ],
    mistakes: [
      ...(input === 'step' && e ? [{ expr: num(1 / Kc), step: 'e', why: 'For a step, $e_{ss} = \\frac{1}{1 + K_p}$, not $\\frac{1}{K_p}$.' }] : []),
      ...(e ? [{ expr: num(input === 'step' ? 1 / (1 + K / (p1 * p2)) : p1 * p2 / K), step: 'k', why: `Include the zero: $G(0)$ has the factor ${z} from $(s + ${z})$.` }] : [{ expr: num(1 / Kc), step: 't', why: 'The integrators make this error zero.' }]),
    ],
  };
}

function genRouth() {
  const p1 = randInt(1, 4), p2 = p1 + randInt(1, 5), ask = pick(['K', 'w', 'K', 'count']);
  if (ask === 'count') {
    const sets = [[1, 2, 4, 6], [1, 1, 2, 8], [1, 3, 3, 1], [1, 2, -1, 4], [1, 4, 1, 6], [1, 1, 4, 30]];
    const c = pick(sets), rts = roots(c), nr = rts.filter((r) => r.re > 1e-9).length;
    return {
      points: 15, prompt: `How many roots of $s^3 ${pmT(c[1])}s^2 ${pmT(c[2])}s ${pmT(c[3])} = 0$ are in the right half-plane?`,
      vars: [], sample: () => ({}), tol: 1e-9, hint: 'Enter an integer.', answer: String(nr), answerTex: `${nr}`,
      steps: [
        { key: 'arr', title: 'Routh array', body: `Rows: $s^3: 1,\\ ${c[2]}$; $s^2: ${c[1]},\\ ${c[3]}$; $s^1: \\frac{${c[1]}\\cdot${c[2]} - ${c[3]}}{${c[1]}} = ${r4((c[1] * c[2] - c[3]) / c[1])}$; $s^0: ${c[3]}$.` },
        { key: 'cnt', title: 'Sign changes in the first column', body: `The number of sign changes in $1, ${c[1]}, ${r4((c[1] * c[2] - c[3]) / c[1])}, ${c[3]}$ equals the number of right-half-plane roots: ${nr}.` },
      ],
      mistakes: [{ expr: String(c.some((x) => x <= 0) ? 0 : 2), step: 'cnt', why: c.some((x) => x <= 0) ? 'A coefficient that is negative or missing guarantees instability.' : 'All coefficients positive is necessary, not sufficient: check the first column.' }],
    };
  }
  const Kmax = (p1 + p2) * p1 * p2, w = Math.sqrt(p1 * p2);
  return {
    points: 20,
    prompt: `Unity feedback with $G(s) = \\frac{K}{s(s+${p1})(s+${p2})}$. ${ask === 'K' ? 'Find the largest $K$ for which the closed loop is stable.' : 'At the stability limit, at what frequency $\\omega$ (rad/s) does the system oscillate?'}`,
    vars: [], sample: () => ({}), tol: 2e-3, hint: ask === 'K' ? 'Enter a number.' : 'Enter rad/s.', answer: num(ask === 'K' ? Kmax : w), answerTex: ask === 'K' ? `K_{max} = ${Kmax}` : `\\omega = ${r4(w)}\\text{ rad/s}`,
    steps: [
      { key: 'ce', title: 'Characteristic equation', body: `$1 + G = 0 \\Rightarrow s^3 + ${p1 + p2}s^2 + ${p1 * p2}s + K = 0$` },
      { key: 'r', title: 'Routh array', body: `$s^3: 1,\\ ${p1 * p2}$; $s^2: ${p1 + p2},\\ K$; $s^1: \\frac{${(p1 + p2) * p1 * p2} - K}{${p1 + p2}}$; $s^0: K$. Stable when $0 < K < ${Kmax}$.` },
      { key: 'w', title: 'Marginal oscillation', body: `At $K = ${Kmax}$ the $s^1$ row vanishes; the auxiliary polynomial $${p1 + p2}s^2 + ${Kmax} = 0$ gives $s = \\pm j${r4(w)}$.` },
    ],
    mistakes: [
      { expr: num(ask === 'K' ? p1 * p2 : Math.sqrt(Kmax)), step: ask === 'K' ? 'r' : 'w', why: ask === 'K' ? 'The $s^1$ entry is $\\frac{a_2a_1 - a_0}{a_2}$: $K < a_2a_1$.' : 'Solve the auxiliary equation from the $s^2$ row: $\\omega^2 = K_{max}/a_2$.' },
      ...(ask === 'K' ? [{ expr: String(p1 + p2), step: 'r', why: 'Form $a_2a_1 = (' + (p1 + p2) + ')(' + p1 * p2 + ')$.' }] : []),
    ],
  };
}

function genRootLocus() {
  const kind = pick(['centroid', 'angle', 'break2', 'break3']);
  if (kind === 'break2') {
    const a = randInt(0, 3), b = a + 2 * randInt(1, 3);
    const bp = -(a + b) / 2;
    return {
      points: 15, prompt: `Where does the root locus of $KG(s) = \\frac{K}{${sp(a)}(s+${b})}$ break away from the real axis?`,
      vars: [], sample: () => ({}), tol: 1e-6, hint: 'Enter σ (negative number).', answer: num(bp), answerTex: `\\sigma_b = ${bp}`,
      steps: [{ key: 'b', title: 'Two real poles', body: `The branches start at $-${a}$ and $-${b}$, meet halfway at $\\sigma = ${bp}$ ($dK/ds = 0$), then leave vertically.` }],
      mistakes: [{ expr: String(-b), step: 'b', why: 'Break-away happens between the poles, not at one.' }],
    };
  }
  if (kind === 'break3') {
    const a = randInt(1, 3), b = a + randInt(1, 3);
    // K = -s(s+a)(s+b); dK/ds = -(3s^2 + 2(a+b)s + ab) = 0, root between 0 and -a
    const s = (-2 * (a + b) + Math.sqrt(4 * (a + b) ** 2 - 12 * a * b)) / 6;
    return {
      points: 20, prompt: `Find the break-away point of the root locus of $KG(s) = \\frac{K}{s(s+${a})(s+${b})}$ (between $0$ and $-${a}$).`,
      vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter σ.', answer: num(s), answerTex: `\\sigma_b = ${r4(s)}`,
      steps: [
        { key: 'k', title: 'K along the real axis', body: `$K = -s(s+${a})(s+${b}) = -(s^3 + ${a + b}s^2 + ${a * b}s)$` },
        { key: 'd', title: 'dK/ds = 0', body: `$3s^2 + ${2 * (a + b)}s + ${a * b} = 0 \\Rightarrow s = ${r4(s)}$ (the other root, $${r4((-2 * (a + b) - Math.sqrt(4 * (a + b) ** 2 - 12 * a * b)) / 6)}$, is not on the locus).` },
      ],
      mistakes: [{ expr: num(-a / 2), step: 'd', why: 'With a third pole the break-away is not simply the midpoint; solve $dK/ds = 0$.' }, { expr: num((-2 * (a + b) - Math.sqrt(4 * (a + b) ** 2 - 12 * a * b)) / 6), step: 'd', why: 'That root lies between $-' + a + '$ and $-' + b + '$, which is not on the locus.' }],
    };
  }
  const poles = [0, -randInt(1, 3), -randInt(4, 7), ...(Math.random() < 0.5 ? [-randInt(8, 10)] : [])], zeros = Math.random() < 0.5 ? [-randInt(1, 9)] : [];
  const n = poles.length, m = zeros.length, sig = (poles.reduce((s, x) => s + x, 0) - zeros.reduce((s, x) => s + x, 0)) / (n - m);
  const G = `\\frac{K${zeros.map((z) => `(s+${-z})`).join('')}}{${poles.map((p) => (p === 0 ? 's' : `(s+${-p})`)).join('')}}`;
  if (kind === 'centroid') return {
    points: 15, prompt: `Find the centroid $\\sigma_a$ of the root-locus asymptotes for $KG(s) = ${G}$.`,
    vars: [], sample: () => ({}), tol: 1e-6, hint: 'Enter σ.', answer: num(sig), answerTex: `\\sigma_a = ${r4(sig)}`,
    steps: [{ key: 'c', title: 'Asymptote centroid', body: `$\\sigma_a = \\dfrac{\\sum p - \\sum z}{n - m} = \\dfrac{(${poles.join(' + ')}) - (${zeros.join(' + ') || 0})}{${n} - ${m}} = ${r4(sig)}$` }],
    mistakes: [{ expr: num(poles.reduce((s, x) => s + x, 0) / (n - m)), step: 'c', why: 'Subtract the sum of the zeros.' }, ...(m ? [{ expr: num((poles.reduce((s, x) => s + x, 0) - zeros.reduce((s, x) => s + x, 0)) / n), step: 'c', why: 'Divide by $n - m$, the number of asymptotes.' }] : [])],
  };
  return {
    points: 10, prompt: `For $KG(s) = ${G}$, what is the angle (degrees, between 0 and 180) of the asymptote closest to the positive real axis?`,
    vars: [], sample: () => ({}), tol: 1e-6, hint: 'Enter degrees.', answer: num(180 / (n - m)), answerTex: `\\theta_a = \\frac{180^\\circ}{${n - m}} = ${r2(180 / (n - m))}^\\circ`,
    steps: [{ key: 'a', title: 'Asymptote angles', body: `$\\theta_a = \\frac{(2k+1)180^\\circ}{n - m}$ with $n - m = ${n - m}$: $${Array.from({ length: n - m }, (_, k) => r2(((2 * k + 1) * 180) / (n - m))).join('^\\circ, ')}^\\circ$` }],
    mistakes: [{ expr: num(360 / (n - m)), step: 'a', why: 'The angles are odd multiples of $180^\\circ/(n-m)$.' }, { expr: num(180 / n), step: 'a', why: 'Use $n - m$ (poles minus zeros).' }],
  };
}

/* ================= lessons ================= */
const LFb = [
  { type: 'text', kind: 'key', title: 'Why feedback', body: R`Open loop: the controller acts blindly. Closed loop: measure the output, compare it with the reference, and act on the error. Feedback reduces sensitivity to plant changes and disturbances and can stabilize unstable plants, at the risk of making stable ones oscillate.` },
  { type: 'text', kind: 'method', title: 'The closed-loop transfer function', body: R`With forward path $G$ and feedback $H$: $$T(s) = \frac{C}{R} = \frac{G}{1 + GH}$$ (negative feedback). The poles of $T$ are the roots of the characteristic equation $1 + GH = 0$, so changing a gain moves the poles.` },
  {
    type: 'graph', title: 'Turn up the gain',
    body: R`$G = \frac{K}{s(s+4)}$ with unity feedback: $T = \frac{K}{s^2 + 4s + K}$. Small $K$: two real poles, sluggish. Large $K$: complex poles, fast but oscillatory.`,
    widget: {
      params: [{ key: 'K', label: 'gain K', min: 0.5, max: 60, step: 0.5, value: 8 }],
      panels: [
        { kind: 'plot', flex: 1.2, x: [0, 5], y: [0, 1.8], xLabel: 't (s)', curves: (p) => [{ fn: (t) => step2(2 / Math.sqrt(p.K), Math.sqrt(p.K), t), label: 'c(t)' }], hlines: [{ y: 1 }] },
        { kind: 'splane', flex: 0.8, lim: 8, poles: (p) => { const d = 4 - p.K; return d >= 0 ? [{ re: -2 + Math.sqrt(d), im: 0 }, { re: -2 - Math.sqrt(d), im: 0 }] : [{ re: -2, im: Math.sqrt(-d) }, { re: -2, im: -Math.sqrt(-d) }]; } },
      ],
      readout: (p) => `$\\omega_n = \\sqrt K = ${r3(Math.sqrt(p.K))}$, $\\zeta = \\frac{2}{\\sqrt K} = ${r3(2 / Math.sqrt(p.K))}$`,
    },
  },
  { type: 'quiz', prompt: R`Negative feedback, $G = \frac{10}{s+1}$, $H = 1$. The closed-loop pole is at`, options: [{ tex: '$s = -11$', correct: true }, { tex: '$s = -1$', why: 'That is the open-loop pole.' }, { tex: '$s = 9$', why: R`$1 + \frac{10}{s+1} = 0 \Rightarrow s + 11 = 0$.` }] },
];
const LTr = [
  { type: 'text', kind: 'key', title: 'First-order systems', body: R`$\frac{K}{s+a}$: pole at $-a$, response $\frac Ka(1 - e^{-at})$. Time constant $\tau = 1/a$, rise time $2.2/a$, settling time $4/a$.` },
  { type: 'text', kind: 'key', title: 'Second-order systems', body: R`$\frac{\omega_n^2}{s^2 + 2\zeta\omega_ns + \omega_n^2}$, poles $-\zeta\omega_n \pm j\omega_n\sqrt{1-\zeta^2}$.<br>$\%OS = e^{-\zeta\pi/\sqrt{1-\zeta^2}}\times100$ (depends only on $\zeta$); $T_p = \frac{\pi}{\omega_d}$; $T_s = \frac{4}{\zeta\omega_n}$.` },
  {
    type: 'graph', title: 'Shape the step response',
    body: R`Drag $\zeta$ and $\omega_n$. Overshoot is set by the pole angle ($\zeta = \cos\theta$), settling by the real part, peak time by the imaginary part.`,
    widget: {
      params: [{ key: 'z', label: 'damping ratio ζ', min: 0.05, max: 1.5, step: 0.05, value: 0.4 }, { key: 'w', label: 'natural frequency ωn', min: 1, max: 10, step: 0.5, value: 4 }],
      panels: [
        { kind: 'plot', flex: 1.2, x: [0, 5], y: [0, 2], xLabel: 't (s)', curves: (p) => [{ fn: (t) => step2(p.z, p.w, t), label: 'c(t)' }], hlines: [{ y: 1 }] },
        { kind: 'splane', flex: 0.8, lim: 10, poles: (p) => (p.z < 1 ? [{ re: -p.z * p.w, im: p.w * Math.sqrt(1 - p.z * p.z) }, { re: -p.z * p.w, im: -p.w * Math.sqrt(1 - p.z * p.z) }] : [{ re: -p.w * (p.z - Math.sqrt(p.z * p.z - 1)), im: 0 }, { re: -p.w * (p.z + Math.sqrt(p.z * p.z - 1)), im: 0 }]) },
      ],
      readout: (p) => (p.z < 1 ? `$\\%OS = ${r2(Math.exp((-p.z * Math.PI) / Math.sqrt(1 - p.z * p.z)) * 100)}\\%$, $T_p = ${r3(Math.PI / (p.w * Math.sqrt(1 - p.z * p.z)))}$ s, $T_s = ${r3(4 / (p.z * p.w))}$ s` : `Overdamped / critically damped: no overshoot, $T_s \\approx ${r3(4 / (p.w * (p.z - Math.sqrt(Math.max(p.z * p.z - 1, 0)))))}$ s`),
    },
  },
  { type: 'example', title: 'Worked example', prompt: R`$T = \frac{100}{s^2 + 8s + 100}$.`, steps: [R`$\omega_n = 10$, $2\zeta\omega_n = 8 \Rightarrow \zeta = 0.4$.`, R`$\%OS = e^{-0.4\pi/\sqrt{0.84}}\times100 = 25.4\%$.`, R`$T_s = \frac{4}{4} = 1$ s, $T_p = \frac{\pi}{10\sqrt{0.84}} = 0.343$ s.`] },
  { type: 'quiz', prompt: R`Two systems have poles at $-2 \pm j4$ and $-2 \pm j8$. They have the same`, options: [{ tex: 'Settling time', correct: true }, { tex: 'Overshoot', why: 'Overshoot depends on the pole angle; these have different angles.' }, { tex: 'Peak time', why: R`$T_p = \pi/\omega_d$ depends on the imaginary part.` }] },
];
const LSs = [
  { type: 'text', kind: 'key', title: 'Steady-state error and system type', body: R`For unity feedback, the type is the number of integrators ($1/s$ factors) in $G$. Error constants: $K_p = \lim G$, $K_v = \lim sG$, $K_a = \lim s^2G$ as $s\to0$. Errors: step $\frac{1}{1+K_p}$, ramp $\frac{1}{K_v}$, parabola $\frac{1}{K_a}$.` },
  { type: 'text', kind: 'method', title: 'The pattern', body: R`Type 0: finite step error, infinite ramp error. Type 1: zero step error, finite ramp error. Type 2: zero for step and ramp, finite for parabola. Each integrator buys one more input it can track exactly.` },
  {
    type: 'graph', title: 'Tracking a ramp with a type-1 system',
    body: R`$G = \frac{K}{s(s+2)}$ following $r = t$. The output lags by a constant $e_{ss} = 1/K_v = 2/K$. Raise $K$ to shrink the lag (and watch the oscillation grow).`,
    widget: {
      params: [{ key: 'K', label: 'gain K', min: 1, max: 40, step: 1, value: 8 }],
      x: [0, 6], y: [0, 6], xLabel: 't (s)',
      curves: (p) => { const wn = Math.sqrt(p.K), z = 1 / wn; const sim = SA.simulate((t, x) => [x[1], p.K * (t - x[0]) - 2 * x[1]], [0, 0], 6, 1200); return [{ fn: (t) => t, label: 'r = t', dash: true, color: 1 }, { fn: (t) => sim(t, 0), label: 'c(t)' }]; },
      readout: (p) => `$K_v = K/2 = ${r2(p.K / 2)}$, so $e_{ss} = ${r3(2 / p.K)}$`,
    },
  },
  { type: 'quiz', prompt: R`$G = \frac{20}{(s+1)(s+4)}$ with unity feedback. Step error?`, options: [{ tex: R`$\frac{1}{6}$`, correct: true }, { tex: '0', why: 'Type 0: no integrator, so the step error is finite.' }, { tex: R`$\frac{1}{5}$`, why: R`$K_p = 20/4 = 5$, $e = \frac{1}{1+5}$.` }] },
];
const rlPoly = (K, a, b) => [1, a + b, a * b, K];
const LRh = [
  { type: 'text', kind: 'key', title: 'Stability', body: R`A linear system is stable when all closed-loop poles have negative real parts. Routh–Hurwitz tells you how many are in the right half-plane without solving the polynomial: build the array, count sign changes in the first column.` },
  { type: 'text', kind: 'method', title: 'Building the Routh array', body: R`Row 1: $a_n, a_{n-2}, \dots$; row 2: $a_{n-1}, a_{n-3}, \dots$. Each new entry is $-\frac{1}{b_1}\begin{vmatrix} a_1 & a_2 \\ b_1 & b_2 \end{vmatrix}$ using the two rows above. Special cases: a zero in the first column (replace with $\varepsilon$), a whole row of zeros (use the auxiliary polynomial — it signals poles symmetric about the origin, e.g. on the $j\omega$ axis).` },
  {
    type: 'graph', title: 'Gain margin from Routh',
    body: R`$G = \frac{K}{s(s+1)(s+3)}$: $s^3 + 4s^2 + 3s + K$. Routh says stable for $0 < K < 12$. Push $K$ past 12 and watch two poles cross into the right half-plane.`,
    widget: {
      params: [{ key: 'K', label: 'gain K', min: 0.5, max: 25, step: 0.5, value: 6 }],
      kind: 'splane', lim: 5, poles: (p) => roots(rlPoly(p.K, 1, 3)),
      readout: (p) => { const r = roots(rlPoly(p.K, 1, 3)); const rhp = r.filter((x) => x.re > 1e-6).length; return `First column: $1, 4, \\frac{12 - K}{4} = ${r3((12 - p.K) / 4)}, K$ → ${rhp} pole${rhp === 1 ? '' : 's'} in the RHP.`; },
    },
  },
  { type: 'example', title: 'Worked example', prompt: R`$s^3 + 2s^2 + 3s + 10$.`, steps: [R`$s^3$: 1, 3; $s^2$: 2, 10.`, R`$s^1$: $\frac{2\cdot3 - 10}{2} = -2$; $s^0$: 10.`, R`First column $1, 2, -2, 10$: two sign changes, two RHP poles. Unstable, even though every coefficient is positive.`] },
  { type: 'input', prompt: R`$G = \frac{K}{s(s+2)(s+4)}$, unity feedback. Largest stable $K$?`, answer: '48', explain: R`$s^3 + 6s^2 + 8s + K$: need $6\cdot8 > K$.` },
];
const LRl = [
  { type: 'text', kind: 'key', title: 'Root locus', body: R`The paths of the closed-loop poles as $K$ goes from $0$ to $\infty$. A point $s$ is on the locus when $\angle KG(s) = (2k+1)180^\circ$; the gain there is $K = 1/|G(s)|$.` },
  { type: 'text', kind: 'method', title: 'Sketching rules', body: R`1. Branches start at the open-loop poles ($K = 0$) and end at zeros or infinity.<br>2. Real-axis segments lie to the left of an odd number of poles + zeros.<br>3. $n - m$ asymptotes at angles $\frac{(2k+1)180^\circ}{n-m}$ from the centroid $\sigma_a = \frac{\sum p - \sum z}{n-m}$.<br>4. Break-away/in points where $dK/ds = 0$.<br>5. $j\omega$-axis crossings from Routh.` },
  {
    type: 'graph', title: 'Trace the locus',
    body: R`$KG = \frac{K}{s(s+a)(s+b)}$. Grey dots trace the whole locus; the coloured poles sit at the current $K$. Note the break-away between $0$ and $-a$ and the three asymptotes at $60^\circ$, $180^\circ$, $300^\circ$.`,
    widget: {
      params: [{ key: 'K', label: 'gain K', min: 0.1, max: 80, step: 0.1, value: 5 }, { key: 'a', label: 'pole a', min: 1, max: 4, step: 0.5, value: 2 }, { key: 'b', label: 'pole b', min: 4, max: 8, step: 0.5, value: 5 }],
      kind: 'sketch', height: 320, axes: { x: 'σ', y: 'jω', ticks: true }, view: [-10, 4, -6, 6],
      items: (p) => { const items = []; const sa = -(p.a + p.b) / 3; for (const k of [60, 300]) items.push({ t: 'line', x1: sa, y1: 0, x2: sa + 12 * Math.cos((k * Math.PI) / 180), y2: 12 * Math.sin((k * Math.PI) / 180), color: 'muted', dash: true, width: 1 }); for (let i = 1; i <= 160; i++) { const K = 0.02 * 1.06 ** i; for (const r of roots(rlPoly(K, p.a, p.b))) items.push({ t: 'dot', x: r.re, y: r.im, color: 'muted', size: 1.5 }); } for (const x of [0, -p.a, -p.b]) items.push({ t: 'text', x, y: 0, text: '×', size: 16, dy: 5, bold: true }); for (const r of roots(rlPoly(p.K, p.a, p.b))) items.push({ t: 'dot', x: r.re, y: r.im, color: 0, size: 5 }); return items; },
      readout: (p) => `Centroid $\\sigma_a = ${r3(-(p.a + p.b) / 3)}$; Routh limit $K = ${r2((p.a + p.b) * p.a * p.b)}$ at $\\omega = ${r3(Math.sqrt(p.a * p.b))}$`,
    },
  },
  { type: 'example', title: 'Worked example', prompt: R`$KG = \frac{K}{s(s+1)(s+3)}$.`, steps: [R`Real-axis locus: $(-1, 0)$ and $(-\infty, -3)$.`, R`Asymptotes: centroid $\frac{0 - 1 - 3}{3} = -1.33$, angles $60^\circ, 180^\circ, 300^\circ$.`, R`Break-away: $3s^2 + 8s + 3 = 0 \Rightarrow s = -0.451$.`, R`$j\omega$ crossing (Routh): $K = 12$, $\omega = \sqrt3$.`] },
  { type: 'quiz', prompt: R`$KG = \frac{K(s+2)}{s(s+5)}$: how many asymptotes go to infinity?`, options: [{ tex: '1', correct: true }, { tex: '2', why: 'One branch ends on the zero at $-2$.' }, { tex: '0', why: '$n - m = 2 - 1 = 1$.' }] },
];

SA.registerCourse({
  course: 'MAAE 3500',
  chapters: [{ id: 'fc-resp', name: 'Feedback and response' }, { id: 'fc-stab', name: 'Stability and root locus' }],
  topics: [
    { id: 'fc-cl', ch: 'fc-resp', sec: 'fc1', name: 'Closed-loop transfer functions', desc: 'G / (1 + GH).', gen: genClosedLoop },
    { id: 'fc-tr', ch: 'fc-resp', sec: 'fc2', name: 'Transient response', desc: '%OS, Tp, Ts, τ.', gen: genTransient },
    { id: 'fc-ss', ch: 'fc-resp', sec: 'fc3', name: 'Steady-state error', desc: 'Type, Kp, Kv, Ka.', gen: genSSE },
    { id: 'fc-rh', ch: 'fc-stab', sec: 'fc4', name: 'Routh–Hurwitz', desc: 'RHP roots and K limits.', gen: genRouth },
    { id: 'fc-rl', ch: 'fc-stab', sec: 'fc5', name: 'Root-locus rules', desc: 'Asymptotes and break-away.', gen: genRootLocus },
  ],
  sections: [
    { id: 'fc1', tag: 'Wk 1', num: '1', title: 'Feedback and closed-loop transfer functions', chapter: 'Winter preview · Response', skills: ['fc-cl'], lesson: LFb },
    { id: 'fc2', tag: 'Wk 2–3', num: '2', title: 'Transient response', chapter: 'Winter preview · Response', skills: ['fc-tr'], lesson: LTr },
    { id: 'fc3', tag: 'Wk 4', num: '3', title: 'Steady-state error', chapter: 'Winter preview · Response', skills: ['fc-ss'], lesson: LSs },
    { id: 'fc4', tag: 'Wk 5', num: '4', title: 'Routh–Hurwitz stability', chapter: 'Winter preview · Stability', skills: ['fc-rh'], lesson: LRh },
    { id: 'fc5', tag: 'Wk 6', num: '5', title: 'Root-locus sketching', chapter: 'Winter preview · Stability', skills: ['fc-rl'], lesson: LRl },
  ],
});
