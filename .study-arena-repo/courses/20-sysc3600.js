// SYSC 3600 — interactive lessons for the Quiz 2 sections plus midterm sections
// (linear systems, modelling, convolution, transfer functions, simulation & block diagrams).
const { R, pick, randInt, nz, rand, nf, rnd, Frac, sumTex, polyTex, sh, kv, st } = SA;
const sampS = () => ({ s: rand(0.4, 5) });
// polynomial helpers (coeff arrays, highest power first)
const pmul = (a, b) => { const o = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { o[i + j] += x * y; })); return o.map(rnd); };
const padd = (a, b) => { const n = Math.max(a.length, b.length); const A = [...new Array(n - a.length).fill(0), ...a], B = [...new Array(n - b.length).fill(0), ...b]; return A.map((x, i) => rnd(x + B[i])); };
const pscale = (a, k) => a.map((x) => rnd(x * k));
const pTex = (a, v = 's') => sumTex(a.map((c, i) => { const pw = a.length - 1 - i; return { c: rnd(c), body: pw === 0 ? '' : pw === 1 ? v : `${v}^{${pw}}` }; }));
const pExpr = (a, v = 's') => a.map((c, i) => `(${rnd(c)})*${v}^${a.length - 1 - i}`).join('+');
const first = (K, T) => (t) => K * (1 - Math.exp(-t / T));

/* ---------------- generators ---------------- */
function genLinearity() {
  const systems = [
    { tex: 'y(t) = 3x(t)', L: true, TI: true, why: 'Scaling by a constant is linear, and nothing depends on $t$ explicitly.' },
    { tex: 'y(t) = x(t)^2', L: false, TI: true, why: 'Squaring breaks superposition: $(x_1+x_2)^2 \\ne x_1^2 + x_2^2$.' },
    { tex: 'y(t) = t\\,x(t)', L: true, TI: false, why: 'Linear in $x$, but the gain $t$ changes with time.' },
    { tex: 'y(t) = x(t-2)', L: true, TI: true, why: 'A pure delay is linear and shift-invariant.' },
    { tex: 'y(t) = \\dot x(t)', L: true, TI: true, why: 'Differentiation is linear and doesn\'t care when you start.' },
    { tex: 'y(t) = x(t) + 1', L: false, TI: true, why: 'The $+1$ means zero input does not give zero output, so it fails homogeneity.' },
    { tex: 'y(t) = \\sin\\big(x(t)\\big)', L: false, TI: true, why: '$\\sin$ of the input is not linear.' },
    { tex: 'y(t) = x(2t)', L: true, TI: false, why: 'Time compression: shifting the input by $T$ shifts the output by $T/2$, not $T$.' },
    { tex: 'y(t) = e^{-t}x(t)', L: true, TI: false, why: 'Linear, but the weight $e^{-t}$ depends on absolute time.' },
    { tex: 'y(t) = \\int_{-\\infty}^{t} x(\\tau)\\,d\\tau', L: true, TI: true, why: 'Integration is linear and shift-invariant.' },
    { tex: 'y(t) = x(t)\\,x(t-1)', L: false, TI: true, why: 'Products of the input with itself are not linear.' },
  ];
  const S = pick(systems);
  const labels = [['Linear and time-invariant', true, true], ['Linear, time-varying', true, false], ['Nonlinear, time-invariant', false, true], ['Nonlinear, time-varying', false, false]];
  return {
    points: 10, type: 'choice',
    prompt: `Classify the system $${S.tex}$.`,
    options: labels.map(([tex, L, TI]) => ({ tex, correct: L === S.L && TI === S.TI, why: S.why, step: L !== S.L ? 'lin' : 'ti' })),
    answerTex: labels.find(([, L, TI]) => L === S.L && TI === S.TI)[0], hint: 'Test superposition, then a time shift.',
    steps: [
      { key: 'lin', title: 'Linearity (superposition)', body: `Does $a x_1 + b x_2 \\mapsto a y_1 + b y_2$? ${S.L ? 'Yes.' : 'No.'} ${S.L ? '' : S.why}` },
      { key: 'ti', title: 'Time invariance', body: `Delay the input by $T$: does the output just delay by $T$? ${S.TI ? 'Yes.' : 'No.'} ${!S.TI ? S.why : ''}` },
    ],
    mistakes: [],
  };
}

function genMechTF() {
  const v = pick(['mv', 'mx', 'rot']);
  const m = pick([0.5, 1, 2, 4]), b = pick([0.5, 1, 2, 3]), k = pick([2, 4, 5, 8]);
  if (v === 'mv') return {
    points: 10, prompt: `A force $u(t)$ pushes a mass $m = ${nf(m)}$ kg against viscous friction $b = ${nf(b)}$ N·s/m. Find $G(s) = \\dfrac{V(s)}{U(s)}$ where $v$ is the velocity.`,
    vars: ['s'], sample: sampS, hint: 'Answer in terms of s.',
    answer: `1/(${m}*s+${b})`, answerTex: `G(s) = \\frac{1}{${nf(m)}s + ${nf(b)}}`,
    steps: [
      { key: 'law', title: 'Newton', body: '$m\\dot v = u - bv$.' },
      { key: 'lap', title: 'Transform with zero initial conditions', body: `$(ms + b)V(s) = U(s)$, so $G = \\dfrac{1}{${nf(m)}s + ${nf(b)}}$. It is a first-order system with time constant $T = m/b = ${nf(m / b)}$ s.` },
    ],
    mistakes: [
      { expr: `1/(s*(${m}*s+${b}))`, step: 'lap', why: 'That is the position $X/U$. The velocity has one less $\\frac1s$.' },
      { expr: `1/(${m}*s-${b})`, step: 'law', why: 'Friction opposes motion: $-bv$ on the right becomes $+b$ in the denominator.' },
      { expr: `1/(${b}*s+${m})`, step: 'lap', why: '$m$ multiplies $\\dot v \\to sV$; $b$ multiplies $v$.' },
    ],
  };
  const rot = v === 'rot';
  const M = rot ? 'J' : 'm', X = rot ? '\\Theta' : 'X', U = rot ? 'T' : 'F';
  return {
    points: 15,
    prompt: rot
      ? `A torque $\\tau(t)$ drives an inertia $J = ${nf(m)}$ kg·m² attached to a torsional spring $k = ${nf(k)}$ N·m/rad and a rotary damper $b = ${nf(b)}$ N·m·s/rad. Find $\\dfrac{\\Theta(s)}{T(s)}$.`
      : `A force $f(t)$ acts on a mass $m = ${nf(m)}$ kg connected to a wall by a spring $k = ${nf(k)}$ N/m and a damper $b = ${nf(b)}$ N·s/m. Find $\\dfrac{X(s)}{F(s)}$.`,
    vars: ['s'], sample: sampS, hint: 'Answer in terms of s.',
    answer: `1/(${m}*s^2+${b}*s+${k})`, answerTex: `\\frac{${X}(s)}{${U}(s)} = \\frac{1}{${nf(m)}s^2 + ${nf(b)}s + ${nf(k)}}`,
    steps: [
      { key: 'law', title: 'Newton', body: rot ? '$J\\ddot\\theta = \\tau - b\\dot\\theta - k\\theta$.' : '$m\\ddot x = f - b\\dot x - kx$.' },
      { key: 'lap', title: 'Transform with zero initial conditions', body: `$(${M}s^2 + bs + k)${X}(s) = ${U}(s)$.` },
      { key: 'res', title: 'Result', body: `$$\\frac{${X}(s)}{${U}(s)} = \\frac{1}{${nf(m)}s^2 + ${nf(b)}s + ${nf(k)}}$$ Natural frequency $\\omega_n = \\sqrt{k/${M}} = ${nf(Math.sqrt(k / m))}$ rad/s.` },
    ],
    mistakes: [
      { expr: `1/(${m}*s+${b}+${k})`, step: 'lap', why: 'Acceleration transforms to $s^2X$ and velocity to $sX$, so the powers of $s$ are 2, 1, 0.' },
      { expr: `s/(${m}*s^2+${b}*s+${k})`, step: 'lap', why: `That is the velocity transfer function $s${X}/${U}$.` },
      { expr: `1/(${m}*s^2-${b}*s-${k})`, step: 'law', why: 'Spring and damper forces oppose the motion, so they come in with minus signs and end up added in the denominator.' },
    ],
  };
}

function genCircuitTF() {
  const v = pick(['rc', 'rl', 'rlcV', 'rlcI']);
  const Rv = pick([1, 2, 5, 10]), L = pick([0.5, 1, 2]), C = pick([0.1, 0.2, 0.5, 1]);
  if (v === 'rc') return {
    points: 10, prompt: `A source $v(t)$ drives a resistor $R = ${Rv}\\,\\Omega$ in series with a capacitor $C = ${nf(C)}$ F. Find $\\dfrac{V_C(s)}{V(s)}$.`,
    vars: ['s'], sample: sampS, hint: 'Answer in terms of s.',
    answer: `1/(${rnd(Rv * C)}*s+1)`, answerTex: `\\frac{V_C}{V} = \\frac{1}{${nf(Rv * C)}s + 1}`,
    steps: [
      { key: 'imp', title: 'Impedances', body: '$Z_R = R$, $Z_C = \\dfrac{1}{Cs}$.' },
      { key: 'div', title: 'Voltage divider', body: `$$\\frac{V_C}{V} = \\frac{1/(Cs)}{R + 1/(Cs)} = \\frac{1}{RCs + 1} = \\frac{1}{${nf(Rv * C)}s + 1}$$ Time constant $RC = ${nf(Rv * C)}$ s.` },
    ],
    mistakes: [
      { expr: `${rnd(Rv * C)}*s/(${rnd(Rv * C)}*s+1)`, step: 'div', why: 'That is $V_R/V$, the resistor voltage. The capacitor takes the $\\frac{1}{Cs}$ share.' },
      { expr: `1/(${Rv}*s+${C})`, step: 'imp', why: 'The capacitor impedance is $\\frac{1}{Cs}$; multiply through by $Cs$ to get $RCs + 1$.' },
    ],
  };
  if (v === 'rl') return {
    points: 10, prompt: `A source $v(t)$ drives $R = ${Rv}\\,\\Omega$ in series with $L = ${nf(L)}$ H. Find $\\dfrac{I(s)}{V(s)}$.`,
    vars: ['s'], sample: sampS, hint: 'Answer in terms of s.',
    answer: `1/(${L}*s+${Rv})`, answerTex: `\\frac{I}{V} = \\frac{1}{${nf(L)}s + ${Rv}}`,
    steps: [
      { key: 'kvl', title: 'KVL', body: '$v = Ri + L\\dfrac{di}{dt}$.' },
      { key: 'lap', title: 'Transform', body: `$(Ls + R)I = V$, so $\\dfrac{I}{V} = \\dfrac{1}{${nf(L)}s + ${Rv}}$.` },
    ],
    mistakes: [
      { expr: `1/(${Rv}*s+${L})`, step: 'lap', why: '$L$ multiplies $\\frac{di}{dt} \\to sI$.' },
      { expr: `${L}*s+${Rv}`, step: 'lap', why: 'That is the impedance $V/I$; the question asks for $I/V$.' },
    ],
  };
  const d = [rnd(L * C), rnd(Rv * C), 1];
  const isV = v === 'rlcV';
  return {
    points: 15, prompt: `A source $v(t)$ drives a series $R$–$L$–$C$ circuit with $R = ${Rv}\\,\\Omega$, $L = ${nf(L)}$ H, $C = ${nf(C)}$ F. Find $\\dfrac{${isV ? 'V_C' : 'I'}(s)}{V(s)}$.`,
    vars: ['s'], sample: sampS, hint: 'Answer in terms of s.',
    answer: isV ? `1/(${pExpr(d)})` : `${C}*s/(${pExpr(d)})`,
    answerTex: `\\frac{${isV ? 'V_C' : 'I'}}{V} = \\frac{${isV ? '1' : `${nf(C)}s`}}{${pTex(d)}}`,
    steps: [
      { key: 'imp', title: 'Total impedance', body: '$Z = R + Ls + \\dfrac{1}{Cs}$, so $I = \\dfrac{V}{Z} = \\dfrac{Cs\\,V}{LCs^2 + RCs + 1}$.' },
      { key: 'res', title: isV ? 'Capacitor voltage' : 'Result', body: isV ? `$V_C = \\dfrac{I}{Cs}$, so $\\dfrac{V_C}{V} = \\dfrac{1}{LCs^2 + RCs + 1} = \\dfrac{1}{${pTex(d)}}$.` : `$\\dfrac{I}{V} = \\dfrac{${nf(C)}s}{${pTex(d)}}$.` },
    ],
    mistakes: isV ? [
      { expr: `${C}*s/(${pExpr(d)})`, step: 'res', why: 'That is $I/V$. The capacitor voltage is $I\\cdot\\frac{1}{Cs}$.' },
      { expr: `1/(${pExpr([L, Rv, rnd(1 / C)])})`, step: 'imp', why: 'Multiply the whole impedance by $Cs$ to clear the fraction: $LCs^2 + RCs + 1$.' },
    ] : [
      { expr: `1/(${pExpr(d)})`, step: 'res', why: 'That is $V_C/V$. The current has an extra $Cs$ on top.' },
      { expr: `1/(${pExpr([L, Rv, rnd(1 / C)])})`, step: 'imp', why: 'Check the algebra: $\\frac{1}{R + Ls + 1/(Cs)} = \\frac{Cs}{LCs^2 + RCs + 1}$.' },
    ],
  };
}

function genOdeTF() {
  const order = pick([1, 2, 2]);
  const a = order === 2 ? [1, randInt(1, 6), randInt(1, 9)] : [randInt(1, 4), randInt(1, 6)];
  const bvec = Math.random() < 0.5 ? [nz(-3, 4), randInt(1, 6)] : [randInt(1, 8)];
  const lhs = order === 2 ? `${a[0] === 1 ? '' : a[0]}\\ddot y${st(a[1], '\\dot y')}${st(a[2], 'y')}` : `${a[0] === 1 ? '' : a[0]}\\dot y${st(a[1], 'y')}`;
  const rhs = bvec.length === 2 ? `${bvec[0] === 1 ? '' : bvec[0] === -1 ? '-' : bvec[0]}\\dot u${st(bvec[1], 'u')}` : `${bvec[0]}u`;
  const N = pExpr(bvec), D = pExpr(a);
  return {
    points: 10, prompt: `Find the transfer function $G(s) = \\dfrac{Y(s)}{U(s)}$ of $\\;${lhs} = ${rhs}$.`,
    vars: ['s'], sample: sampS, hint: 'Answer in terms of s.',
    answer: `(${N})/(${D})`, answerTex: `G(s) = \\frac{${pTex(bvec)}}{${pTex(a)}}`,
    steps: [
      { key: 'zero', title: 'Zero initial conditions', body: 'A transfer function assumes all initial conditions are zero, so each $\\frac{d}{dt}$ becomes a multiplication by $s$.' },
      { key: 'lap', title: 'Transform both sides', body: `$(${pTex(a)})\\,Y(s) = (${pTex(bvec)})\\,U(s)$.` },
      { key: 'res', title: 'Ratio', body: `$$G(s) = \\frac{${pTex(bvec)}}{${pTex(a)}}$$` },
    ],
    mistakes: [
      { expr: `(${D})/(${N})`, step: 'res', why: 'Output over input: $Y/U$, so the input side goes on top.' },
      ...(bvec.length === 2 ? [{ expr: `(${bvec[1]})/(${D})`, step: 'lap', why: 'The $\\dot u$ term transforms too, giving an $s$ term in the numerator.' }] : []),
    ],
  };
}

function genFirstOrderStep() {
  const K = pick([0.5, 1, 2, 4, 5]), T = pick([0.2, 0.5, 1, 2, 4]), A = pick([1, 2, 5, 10]);
  const a = pick([1, 2, 4]); // shown as K' / (a s + c)
  const num = rnd(K * a / T), cc = rnd(a / T); // G = num / (a s + cc)  -> K = num/cc, T = a/cc
  const variant = pick(['yt', 'tau', 'yT', 'ss']);
  const Gtex = `\\frac{${nf(num)}}{${a === 1 ? '' : a}s + ${nf(cc)}}`;
  const intro = `A system has $G(s) = ${Gtex}$ and a step input of size $${A}$ is applied at $t = 0$ (zero initial conditions).`;
  const std = { key: 'std', title: 'Standard form', body: `Divide top and bottom by $${nf(cc)}$: $G = \\dfrac{K}{Ts+1}$ with $K = ${nf(K)}$, $T = ${nf(T)}$ s.` };
  if (variant === 'yt') return {
    points: 15, prompt: `${intro} Find $y(t)$.`, vars: ['t'], sample: () => ({ t: rand(0.05, 3 * T) }), hint: 'Answer in terms of t.',
    answer: `${rnd(A * K)}*(1-exp(-t/${T}))`, answerTex: `y(t) = ${nf(A * K)}\\left(1 - e^{-t/${nf(T)}}\\right)`,
    steps: [std, { key: 'pf', title: 'Step response', body: `$Y = \\frac{K}{Ts+1}\\cdot\\frac{${A}}{s} = ${nf(A * K)}\\left(\\frac1s - \\frac{1}{s + 1/T}\\right)$, so $y(t) = ${nf(A * K)}\\left(1 - e^{-t/${nf(T)}}\\right)$.` }],
    mistakes: [
      { expr: `${rnd(A * num)}*(1-exp(-t/${T}))`, step: 'std', why: `The DC gain is $G(0) = ${nf(num)}/${nf(cc)} = ${nf(K)}$, not the numerator alone.` },
      { expr: `${rnd(A * K)}*(1-exp(-t*${T}))`, step: 'pf', why: 'The exponent is $-t/T$.' },
      { expr: `${rnd(A * K)}*exp(-t/${T})`, step: 'pf', why: 'Starting from zero it rises: $1 - e^{-t/T}$.' },
    ],
  };
  if (variant === 'tau') return {
    points: 10, prompt: `${intro} What is the time constant $T$ (s)?`, vars: [], sample: () => ({}), tol: 1e-3, hint: 'Enter a number.',
    answer: String(T), answerTex: `T = ${nf(T)}\\text{ s}`, steps: [std],
    mistakes: [{ expr: String(rnd(1 / T)), step: 'std', why: `That is $1/T$, the pole magnitude ($s = -${nf(1 / T)}$).` }, { expr: String(a), step: 'std', why: 'Normalise the denominator to $Ts + 1$ first.' }],
  };
  if (variant === 'ss') return {
    points: 10, prompt: `${intro} What is $y(\\infty)$?`, vars: [], sample: () => ({}), tol: 1e-3, hint: 'Enter a number.',
    answer: String(rnd(A * K)), answerTex: `y(\\infty) = ${nf(A * K)}`,
    steps: [std, { key: 'fvt', title: 'Final value', body: `$y(\\infty) = \\lim_{s\\to0}sY = ${A}G(0) = ${nf(A * K)}$.` }],
    mistakes: [{ expr: String(rnd(A * num)), step: 'std', why: 'Use $G(0)$, the DC gain, not just the numerator.' }, { expr: String(rnd(K)), step: 'fvt', why: `Multiply by the step size $${A}$.` }],
  };
  return {
    points: 10, prompt: `${intro} What is $y$ at $t = T$ (one time constant)?`, vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter a number.',
    answer: String(rnd(A * K * (1 - Math.exp(-1)))), answerTex: `y(T) \\approx 0.632\\times${nf(A * K)} = ${nf(A * K * (1 - Math.exp(-1)))}`,
    steps: [std, { key: 'yT', title: '63.2 % rule', body: `$y(T) = AK(1 - e^{-1}) \\approx 0.632\\,AK = ${nf(A * K * (1 - Math.exp(-1)))}$.` }],
    mistakes: [{ expr: String(rnd(A * K * Math.exp(-1))), step: 'yT', why: 'That is the 36.8 % left to go. The response has reached $1 - e^{-1}$.' }, { expr: String(rnd(A * K)), step: 'yT', why: 'That is the final value; after one $T$ it is only 63.2 % of the way.' }],
  };
}

function genCramer() {
  if (Math.random() < 0.45) {
    // motor -> J1 -spring k- J2 : Omega2/V
    const Rr = pick([1, 2]), kt = pick([1, 2]), J1 = pick([1, 2]), J2 = pick([1, 2]), k = pick([2, 4, 5]);
    const c = rnd(kt * kt / Rr); // km = kt
    const a11 = [J1, c, k], a12 = [-k], a21 = [-k], a22 = [J2, 0, k];
    const det = padd(pmul(a11, a22), pscale(pmul(a12, a21), -1));
    const numW2 = [rnd(kt * k / Rr), 0]; // (kt/R) s * k
    return {
      points: 25,
      prompt: `For the lecture system (motor $\\to J_1 \\to$ spring $k \\to J_2$) with $R = ${Rr}$, $k_t = k_m = ${kt}$, $J_1 = ${J1}$, $J_2 = ${J2}$, $k = ${k}$, the transformed equations (zero ICs, after eliminating $\\tilde\\theta$ and multiplying by $s$) are $$\\begin{aligned}(${pTex(a11)})\\,\\Omega_1 - ${k}\\,\\Omega_2 &= ${nf(kt / Rr)}s\\,V\\\\ -${k}\\,\\Omega_1 + (${pTex(a22)})\\,\\Omega_2 &= 0\\end{aligned}$$ Use Cramer's rule to find $\\dfrac{\\Omega_2(s)}{V(s)}$.`,
      vars: ['s'], sample: sampS, hint: 'Answer in terms of s (the determinant can stay unexpanded).',
      answer: `(${pExpr(numW2)})/(${pExpr(det)})`, answerTex: `\\frac{\\Omega_2}{V} = \\frac{${pTex(numW2)}}{${pTex(det)}}`,
      steps: [
        { key: 'det', title: 'System determinant', body: `$\\Delta = (${pTex(a11)})(${pTex(a22)}) - (-${k})(-${k}) = ${pTex(det)}$.` },
        { key: 'num', title: 'Replace the Ω₂ column with the right-hand side', body: `$\\Delta_2 = \\begin{vmatrix} ${pTex(a11)} & ${nf(kt / Rr)}sV \\\\ -${k} & 0 \\end{vmatrix} = 0 - (-${k})(${nf(kt / Rr)}sV) = ${pTex(numW2)}\\,V$.` },
        { key: 'res', title: 'Divide', body: `$$\\frac{\\Omega_2}{V} = \\frac{\\Delta_2/V}{\\Delta} = \\frac{${pTex(numW2)}}{${pTex(det)}}$$` },
      ],
      mistakes: [
        { expr: `(${pExpr(numW2)})/(${pExpr(padd(pmul(a11, a22), pmul(a12, a21)))})`, step: 'det', why: 'The determinant is $a_{11}a_{22} - a_{12}a_{21}$: the off-diagonal product is subtracted.' },
        { expr: `(${pExpr(pscale(numW2, -1))})/(${pExpr(det)})`, step: 'num', why: 'Sign: $\\begin{vmatrix} a & b\\\\ c & d\\end{vmatrix} = ad - bc$, and here $c = -k$.' },
        { expr: `(${pExpr(pmul([rnd(kt / Rr), 0], a22))})/(${pExpr(det)})`, step: 'num', why: 'That is $\\Omega_1/V$. For $\\Omega_2$ replace the second column.' },
      ],
    };
  }
  // generic 2x2 with first-order entries
  const a11 = [1, randInt(1, 4)], a12 = [nz(-3, 3)], a21 = [nz(-3, 3)], a22 = [1, randInt(1, 5)];
  const det = padd(pmul(a11, a22), pscale(pmul(a12, a21), -1));
  const ask = pick([1, 2]);
  const num = ask === 1 ? a22 : pscale(a21, -1);
  const eqTex = `\\begin{aligned}(${pTex(a11)})X_1 ${a12[0] < 0 ? '-' : '+'} ${Math.abs(a12[0])}X_2 &= U\\\\ ${a21[0]}X_1 + (${pTex(a22)})X_2 &= 0\\end{aligned}`;
  return {
    points: 20,
    prompt: `Use Cramer's rule on $$${eqTex}$$ to find $\\dfrac{X_${ask}(s)}{U(s)}$.`,
    vars: ['s'], sample: sampS, hint: 'Answer in terms of s.',
    answer: `(${pExpr(num)})/(${pExpr(det)})`, answerTex: `\\frac{X_${ask}}{U} = \\frac{${pTex(num)}}{${pTex(det)}}`,
    steps: [
      { key: 'det', title: 'Determinant', body: `$\\Delta = (${pTex(a11)})(${pTex(a22)}) - (${a12[0]})(${a21[0]}) = ${pTex(det)}$.` },
      { key: 'num', title: `Replace column ${ask} with the right-hand side`, body: ask === 1 ? `$\\Delta_1 = \\begin{vmatrix} U & ${a12[0]} \\\\ 0 & ${pTex(a22)}\\end{vmatrix} = (${pTex(a22)})U$.` : `$\\Delta_2 = \\begin{vmatrix} ${pTex(a11)} & U \\\\ ${a21[0]} & 0\\end{vmatrix} = ${-a21[0]}U$.` },
      { key: 'res', title: 'Divide', body: `$$\\frac{X_${ask}}{U} = \\frac{${pTex(num)}}{${pTex(det)}}$$` },
    ],
    mistakes: [
      { expr: `(${pExpr(num)})/(${pExpr(padd(pmul(a11, a22), pmul(a12, a21)))})`, step: 'det', why: 'The determinant subtracts the off-diagonal product: $a_{11}a_{22} - a_{12}a_{21}$.' },
      { expr: `(${pExpr(ask === 1 ? pscale(a21, -1) : a22)})/(${pExpr(det)})`, step: 'num', why: `That is $X_${3 - ask}/U$. Replace column ${ask}, the one for $X_${ask}$.` },
      ...(ask === 2 ? [{ expr: `(${pExpr(a21)})/(${pExpr(det)})`, step: 'num', why: 'Sign: $\\Delta_2 = a_{11}\\cdot 0 - U\\cdot a_{21} = -a_{21}U$.' }] : []),
    ],
  };
}

function genBlock() {
  const v = pick(['fb', 'fb', 'fbH', 'series', 'parallel', 'pos']);
  const K = pick([1, 2, 4, 5, 10]), a = randInt(1, 5), b = randInt(1, 4), h = pick([1, 2, 0.5]);
  const G = `${K}/(s+${a})`, Gt = `\\frac{${K}}{s+${a}}`;
  if (v === 'series' || v === 'parallel') {
    const G2 = `1/(s+${b})`, G2t = `\\frac{1}{s+${b}}`;
    const ser = v === 'series';
    return {
      points: 10, prompt: `$G_1 = ${Gt}$ and $G_2 = ${G2t}$ are connected in ${ser ? 'series (cascade)' : 'parallel (outputs added)'}. Find the overall transfer function.`,
      vars: ['s'], sample: sampS, hint: 'Answer in terms of s.',
      figure: ser ? { kind: 'blocks', forward: ['G₁(s)', 'G₂(s)'], feedback: null, input: 'U', output: 'Y' } : undefined,
      answer: ser ? `(${G})*(${G2})` : `(${G})+(${G2})`, answerTex: ser ? `\\frac{${K}}{(s+${a})(s+${b})}` : `\\frac{${K}(s+${b}) + (s+${a})}{(s+${a})(s+${b})}`,
      steps: [{ key: 'rule', title: ser ? 'Series rule' : 'Parallel rule', body: ser ? 'Blocks in series multiply: $G = G_1G_2$.' : 'Blocks in parallel add: $G = G_1 + G_2$.' }],
      mistakes: [{ expr: ser ? `(${G})+(${G2})` : `(${G})*(${G2})`, step: 'rule', why: ser ? 'Series blocks multiply; adding is for parallel paths.' : 'Parallel paths add; multiplying is for series blocks.' }],
    };
  }
  const H = v === 'fbH' ? `1/(s+${b})` : `${h}`, Ht = v === 'fbH' ? `\\frac{1}{s+${b}}` : `${h}`;
  const pos = v === 'pos';
  const ans = `(${G})/(1${pos ? '-' : '+'}(${G})*(${H}))`;
  return {
    points: 15,
    prompt: `Find the closed-loop transfer function $\\dfrac{C(s)}{R(s)}$ for forward path $G(s) = ${Gt}$ and ${pos ? 'positive' : 'negative'} feedback $H(s) = ${Ht}$.`,
    vars: ['s'], sample: sampS, hint: 'Answer in terms of s. You may leave it as a compound fraction.',
    figure: { kind: 'blocks', forward: ['G(s)'], feedback: 'H(s)', sign: pos ? '+' : '−' },
    answer: ans, answerTex: `\\frac{C}{R} = \\frac{G}{1 ${pos ? '-' : '+'} GH}`,
    steps: [
      { key: 'loop', title: 'Loop equations', body: `$E = R ${pos ? '+' : '-'} HC$ and $C = GE$, so $C = GR ${pos ? '+' : '-'} GHC$.` },
      { key: 'res', title: 'Solve', body: `$$\\frac{C}{R} = \\frac{G}{1 ${pos ? '-' : '+'} GH}$$ Then substitute $G = ${Gt}$, $H = ${Ht}$ and clear fractions.` },
    ],
    mistakes: [
      { expr: `(${G})/(1${pos ? '+' : '-'}(${G})*(${H}))`, step: 'loop', why: `For ${pos ? 'positive' : 'negative'} feedback the denominator is $1 ${pos ? '-' : '+'} GH$.` },
      { expr: `(${G})/(1+(${H}))`, step: 'res', why: 'The loop gain is the product $GH$ around the loop, not $H$ alone.' },
      { expr: `1/(1${pos ? '-' : '+'}(${G})*(${H}))`, step: 'res', why: 'The forward path $G$ stays in the numerator.' },
    ],
  };
}

function genSimDiagram() {
  const a1 = randInt(1, 6), b0 = randInt(2, 5);
  let a0 = randInt(2, 9); if (a0 === a1) a0 = a1 + 1;
  const variant = pick(['tf', 'input']);
  const fig = { kind: 'chain', n: 2, input: 'u', inGain: String(b0), signals: ['ÿ', 'ẏ', 'y'], fb: [String(a1), String(a0)] };
  if (variant === 'tf') return {
    points: 15, prompt: 'Find $\\dfrac{Y(s)}{U(s)}$ for the simulation diagram (both feedback paths enter the summer with a minus sign).',
    vars: ['s'], sample: sampS, hint: 'Answer in terms of s.', figure: fig,
    answer: `${b0}/(s^2+${a1}*s+${a0})`, answerTex: `\\frac{Y}{U} = \\frac{${b0}}{s^2 + ${a1 === 1 ? '' : a1}s + ${a0}}`,
    steps: [
      { key: 'read', title: 'Read the summer', body: `The summer output feeds the first integrator, so it is $\\ddot y = ${b0}u - ${a1 === 1 ? '' : a1}\\dot y - ${a0}y$.` },
      { key: 'ode', title: 'Equivalent ODE', body: `$\\ddot y + ${a1 === 1 ? '' : a1}\\dot y + ${a0}y = ${b0}u$.` },
      { key: 'res', title: 'Transfer function', body: `$$\\frac{Y}{U} = \\frac{${b0}}{s^2 + ${a1 === 1 ? '' : a1}s + ${a0}}$$` },
    ],
    mistakes: [
      { expr: `${b0}/(s^2+${a0}*s+${a1})`, step: 'read', why: `The gain fed back from $\\dot y$ (after the first integrator) is $${a1}$; the one from $y$ is $${a0}$.` },
      { expr: `${b0}/(s^2-${a1}*s-${a0})`, step: 'read', why: 'The feedback enters with minus signs, which become plus signs on the left of the ODE.' },
      { expr: `1/(s^2+${a1}*s+${a0})`, step: 'read', why: `Don't forget the input gain $${b0}$.` },
    ],
  };
  return {
    points: 10, type: 'choice',
    prompt: `To build a simulation diagram for $\\ddot y + ${a1 === 1 ? '' : a1}\\dot y + ${a0}y = ${b0}u$, what signal goes into the first integrator?`,
    options: [
      { tex: `$${b0}u - ${a1 === 1 ? '' : a1}\\dot y - ${a0}y$`, correct: true },
      { tex: `$${b0}u + ${a1 === 1 ? '' : a1}\\dot y + ${a0}y$`, why: 'Solving for $\\ddot y$ moves the $\\dot y$ and $y$ terms across, which flips their signs.', step: 'solve' },
      { tex: `$${b0}u - ${a0}\\dot y - ${a1}y$`, why: `$\\dot y$ is multiplied by $${a1}$, and $y$ by $${a0}$.`, step: 'solve' },
      { tex: '$y$', why: 'The first integrator turns $\\ddot y$ into $\\dot y$, so its input must be $\\ddot y$.', step: 'chain' },
    ],
    answerTex: `$\\ddot y = ${b0}u - ${a1 === 1 ? '' : a1}\\dot y - ${a0}y$`, hint: 'Solve for the highest derivative.', figure: fig,
    steps: [
      { key: 'solve', title: 'Solve for the highest derivative', body: `$\\ddot y = ${b0}u - ${a1 === 1 ? '' : a1}\\dot y - ${a0}y$.` },
      { key: 'chain', title: 'Integrators in a chain', body: '$\\ddot y \\xrightarrow{\\int} \\dot y \\xrightarrow{\\int} y$. The summer builds $\\ddot y$ from the input and feedback of $\\dot y$ and $y$.' },
    ],
    mistakes: [],
  };
}

function genConvValue() {
  const a = pick([0.5, 1, 2]), T = pick([1, 2]);
  const pulse = Math.random() < 0.5;
  const t = pick(pulse ? [0.5, 1.5, 2.5, 3] : [0.5, 1, 2, 3]);
  const yStep = (tt) => (1 - Math.exp(-a * tt)) / a;
  const val = pulse ? (t < T ? yStep(t) : (Math.exp(-a * (t - T)) - Math.exp(-a * t)) / a) : yStep(t);
  const xTex = pulse ? `u(t) - u(t-${T})` : 'u(t)';
  return {
    points: 15,
    prompt: `An LTI system has impulse response $h(t) = e^{-${nf(a)}t}u(t)$ and input $x(t) = ${xTex}$${pulse ? ` (a pulse of width ${T})` : ''}. Find $y(${t})$.`,
    vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter a number.',
    figure: { kind: 'plot', x: [-0.5, 5], y: [-0.1, 1.2], xLabel: 't', curves: [{ fn: (x) => (x >= 0 ? Math.exp(-a * x) : 0), label: 'h(t)' }, { fn: (x) => (x >= 0 && (!pulse || x < T) ? 1 : 0), label: 'x(t)', color: 1, dash: true }] },
    answer: String(rnd(val)), answerTex: `y(${t}) = ${nf(val)}`,
    steps: [
      { key: 'setup', title: 'Flip and slide', body: `$y(t) = \\int h(\\tau)x(t-\\tau)\\,d\\tau$. $x(t-\\tau)$ equals 1 for ${pulse ? `$t - ${T} < \\tau < t$` : '$\\tau < t$'}, and $h(\\tau)$ is zero for $\\tau < 0$.` },
      { key: 'limits', title: 'Overlap limits', body: pulse && t >= T ? `At $t = ${t} \\ge ${T}$ the overlap is $${nf(t - T)} < \\tau < ${t}$.` : `At $t = ${t}$ the overlap is $0 < \\tau < ${t}$.` },
      { key: 'int', title: 'Integrate', body: `$y(${t}) = \\int_{${pulse && t >= T ? nf(t - T) : 0}}^{${t}} e^{-${nf(a)}\\tau}d\\tau = ${nf(val)}$.` },
    ],
    mistakes: [
      ...(pulse && t >= T ? [{ expr: String(rnd(yStep(t))), step: 'limits', why: `The pulse has ended: the lower limit is $t - ${T}$, not 0.` }] : []),
      { expr: String(rnd(Math.exp(-a * t))), step: 'setup', why: 'That is just $h(t)$. The output is the area of the overlap.' },
    ],
  };
}

/* ---------------- course registration ---------------- */
SA.registerCourse({
  course: 'SYSC 3600',
  chapters: [
    { id: 'sy-sys', name: 'Linear systems & modelling' },
    { id: 'sy-tf', name: 'Transfer functions' },
    { id: 'sy-sim', name: 'Simulation & block diagrams' },
  ],
  topics: [
    { id: 'sy-lti', ch: 'sy-sys', sec: 'lin', name: 'Linear? Time-invariant?', desc: 'Superposition and shift tests.', gen: genLinearity },
    { id: 'sy-conv', ch: 'sy-sys', sec: 'lin', name: 'Output by convolution', desc: 'Flip, slide, find the overlap.', gen: genConvValue },
    { id: 'sy-mech', ch: 'sy-sys', sec: 'mech', name: 'Mechanical transfer functions', desc: 'm, b, k (and J) from Newton.', gen: genMechTF },
    { id: 'sy-circ', ch: 'sy-sys', sec: 'mech', name: 'Circuit transfer functions', desc: 'RC, RL, RLC with impedances.', gen: genCircuitTF },
    { id: 'sy-odetf', ch: 'sy-tf', sec: 'tf', name: 'ODE → transfer function', desc: 'Zero ICs: d/dt becomes s.', gen: genOdeTF },
    { id: 'sy-step1', ch: 'sy-tf', sec: 'tf', name: 'First-order step response', desc: 'K/(Ts+1): T, y(∞), y(T).', gen: genFirstOrderStep },
    { id: 'sy-cramer', ch: 'sy-tf', sec: 'tf', name: 'Cramer\'s rule', desc: 'Two coupled equations → one TF.', gen: genCramer },
    { id: 'sy-simdiag', ch: 'sy-sim', sec: 'sim', name: 'Simulation diagrams', desc: 'Integrator chains ↔ ODEs.', gen: genSimDiagram },
    { id: 'sy-block', ch: 'sy-sim', sec: 'sim', name: 'Block diagram algebra', desc: 'Series, parallel, feedback.', gen: genBlock },
  ],
  sections: [
    {
      id: 'lin', tag: 'Lec 1, 5', num: 'L1', title: 'Linear systems and convolution', chapter: 'Midterm · Lectures 1 & 5',
      skills: ['sy-lti', 'sy-conv'],
      lesson: [
        { type: 'text', kind: 'key', title: 'Linear and time-invariant', body: R`A system is linear if superposition holds: $a x_1 + b x_2 \mapsto a y_1 + b y_2$. It is time-invariant if delaying the input by $T$ just delays the output by $T$. LTI systems are completely described by their impulse response $h(t)$.` },
        { type: 'quiz', prompt: R`Is $y(t) = x(t) + 1$ linear?`, options: [
          { tex: 'No', correct: true },
          { tex: 'Yes', why: 'Try $x = 0$: the output is 1, not 0. Linear systems map zero input to zero output.' },
        ], explain: R`Doubling the input gives $2x + 1 \ne 2(x+1)$. An offset makes a system affine, not linear.` },
        { type: 'quiz', prompt: R`Is $y(t) = t\,x(t)$ time-invariant?`, options: [
          { tex: 'No', correct: true },
          { tex: 'Yes', why: 'Shift the input: the output is $t\\,x(t-T)$, but a shifted output would be $(t-T)\\,x(t-T)$.' },
        ] },
        { type: 'text', kind: 'method', title: 'Output = impulse response ∗ input', body: R`$$y(t) = \int h(\tau)\,x(t-\tau)\,d\tau = h(t)*x(t)$$ The graphical method: (1) plot $h(\tau)$ and the flipped, shifted $x(t-\tau)$; (2) find the ranges of $t$ where they overlap, which sets the limits; (3) integrate the product over the overlap.` },
        {
          type: 'graph', title: 'Slide a pulse through a first-order system',
          body: R`$h(t) = e^{-at}u(t)$ and $x(t)$ is a pulse of width $W$. Move $t$ and watch the overlap (shaded). It grows while the pulse is entering, then the result decays once the pulse has passed.`,
          widget: {
            params: [{ key: 't', label: 't', min: 0, max: 6, step: 0.05, value: 1.5 }, { key: 'a', label: 'a', min: 0.3, max: 3, step: 0.1, value: 1 }, { key: 'W', label: 'pulse width W', min: 0.5, max: 3, step: 0.1, value: 2 }],
            panels: [
              { kind: 'plot', x: [-1, 6], y: [-0.1, 1.3], xLabel: 'τ', curves: (p) => [{ fn: (x) => (x >= 0 ? Math.exp(-p.a * x) : 0), label: 'h(τ)' }, { fn: (x) => (x <= p.t && x > p.t - p.W ? 1 : 0), label: 'x(t−τ)', dash: true }], areas: (p) => [{ fn: (x) => Math.exp(-p.a * x), a: Math.max(0, p.t - p.W), b: p.t }] },
              { kind: 'plot', x: [0, 6], y: [-0.05, 1.4], xLabel: 't', curves: (p) => [{ fn: (t) => (t < p.W ? (1 - Math.exp(-p.a * t)) / p.a : (Math.exp(-p.a * (t - p.W)) - Math.exp(-p.a * t)) / p.a), label: 'y(t)', color: 2 }], points: (p) => [{ x: p.t, y: p.t < p.W ? (1 - Math.exp(-p.a * p.t)) / p.a : (Math.exp(-p.a * (p.t - p.W)) - Math.exp(-p.a * p.t)) / p.a }] },
            ],
            readout: (p) => (p.t < p.W ? `$0 \\le t < W$: overlap $0 < \\tau < t$, so $y = \\frac{1 - e^{-at}}{a}$.` : `$t \\ge W$: overlap $t - W < \\tau < t$, so $y = \\frac{e^{-a(t-W)} - e^{-at}}{a}$.`),
          },
        },
        { type: 'example', title: 'Worked example: step into e^{−at}', prompt: R`$h(t) = e^{-2t}u(t)$, $x(t) = u(t)$. Find $y(t)$.`, steps: [
          R`$x(t-\tau) = 1$ for $\tau < t$; $h(\tau) = 0$ for $\tau < 0$. They overlap on $0 < \tau < t$ (for $t > 0$).`,
          R`$y(t) = \int_0^t e^{-2\tau}d\tau = \frac{1 - e^{-2t}}{2}$ for $t \ge 0$, and $0$ before.`,
          R`Check with Laplace: $\frac{1}{s+2}\cdot\frac1s = \frac12\left(\frac1s - \frac{1}{s+2}\right)$. It matches.`,
        ] },
      ],
    },
    {
      id: 'mech', tag: 'Lec 2–3', num: 'L2', title: 'Mechanical and electrical models', chapter: 'Midterm · Lectures 2–3',
      skills: ['sy-mech', 'sy-circ'],
      lesson: [
        { type: 'text', kind: 'key', title: 'Element laws', body: R`Translational: $F = m\dot v$, spring $F = kx$, damper $F = bv$. Rotational: $\tau = J\dot\omega$, $\tau = k\theta$, $\tau = b\omega$. Electrical: $v_L = L\dot i$, $i_C = C\dot v_C$, $v_R = Ri$. Sum forces (Newton) on each mass and voltages (KVL) around each loop.` },
        { type: 'text', kind: 'method', title: 'Transfer function in three moves', body: R`1. Write the ODE from Newton or KVL. 2. Transform with zero initial conditions ($\frac{d}{dt}\to s$). 3. Divide output by input. For circuits you can skip the ODE by using impedances: $Z_R = R$, $Z_L = Ls$, $Z_C = \frac{1}{Cs}$.` },
        {
          type: 'graph', title: 'Mass–spring–damper step response',
          body: R`$m\ddot x + b\dot x + kx = F_0$. The damping ratio $\zeta = \frac{b}{2\sqrt{km}}$ decides the shape: below 1 it overshoots and rings, above 1 it creeps up.`,
          widget: {
            params: [{ key: 'm', label: 'm', min: 0.2, max: 4, step: 0.1, value: 1 }, { key: 'b', label: 'b', min: 0, max: 8, step: 0.1, value: 1 }, { key: 'k', label: 'k', min: 0.5, max: 10, step: 0.1, value: 4 }],
            x: [0, 12], y: 'auto', xLabel: 't (s)',
            curves: (p) => { const sim = SA.simulate((t, x) => [x[1], (1 - p.b * x[1] - p.k * x[0]) / p.m], [0, 0], 12, 900); return [{ fn: (t) => sim(t, 0), label: 'x(t) for F₀ = 1' }]; },
            hlines: (p) => [{ y: 1 / p.k, label: 'F₀/k' }],
            readout: (p) => { const z = p.b / (2 * Math.sqrt(p.k * p.m)); return `$\\omega_n = \\sqrt{k/m} = ${Math.sqrt(p.k / p.m).toFixed(2)}$ rad/s, $\\zeta = ${z.toFixed(2)}$ (${z < 1 ? 'underdamped' : z > 1 ? 'overdamped' : 'critically damped'}), final value $F_0/k = ${(1 / p.k).toFixed(3)}$.`; },
          },
        },
        { type: 'quiz', prompt: R`Mass $m$ with spring $k$ and damper $b$ to the wall, force $f$. What is $X(s)/F(s)$?`, options: [
          { tex: R`$\dfrac{1}{ms^2+bs+k}$`, correct: true },
          { tex: R`$\dfrac{1}{ms+b+k}$`, why: 'Acceleration gives $s^2$, velocity gives $s$.' },
          { tex: R`$ms^2+bs+k$`, why: 'That is $F/X$, upside down.' },
          { tex: R`$\dfrac{s}{ms^2+bs+k}$`, why: 'That is the velocity transfer function $V/F$.' },
        ] },
        { type: 'example', title: 'Worked example: RC low-pass', prompt: R`$R$ in series with $C$, output across $C$.`, steps: [
          R`Impedances: $R$ and $\frac{1}{Cs}$.`,
          R`Voltage divider: $\dfrac{V_C}{V} = \dfrac{1/(Cs)}{R + 1/(Cs)}$.`,
          R`Multiply top and bottom by $Cs$: $\dfrac{1}{RCs + 1}$. It is first order with time constant $RC$.`,
        ] },
        { type: 'input', prompt: R`Series $R = 2\,\Omega$, $L = 1$ H, $C = 0.5$ F. What is the coefficient of $s$ in the denominator of $V_C/V = \frac{1}{LCs^2 + RCs + 1}$?`, answer: '1', explain: R`$RC = 2 \times 0.5 = 1$.` },
      ],
    },
    {
      id: 'tf', tag: 'Lec 8–10', num: 'L8', title: 'Transfer functions and Cramer\'s rule', chapter: 'Midterm · Lectures 8–10',
      skills: ['sy-odetf', 'sy-step1', 'sy-cramer'],
      lesson: [
        { type: 'text', kind: 'key', title: 'What a transfer function is', body: R`$G(s) = \dfrac{Y(s)}{U(s)}$ with all initial conditions zero. It belongs to the system, not to the input: once you know $G$, the response to any input is $Y = G\,U$, and the impulse response is $g(t) = \mathcal{L}^{-1}\{G\}$.` },
        { type: 'example', title: 'Worked example: mass with friction', prompt: R`$m\dot v = u - bv$.`, steps: [
          R`Transform with $v(0) = 0$: $msV = U - bV$.`,
          R`$G(s) = \dfrac{V}{U} = \dfrac{1}{ms + b} = \dfrac{1/b}{(m/b)s + 1}$.`,
          R`That is the standard first-order form $\dfrac{K}{Ts+1}$ with $K = \frac1b$ and $T = \frac mb$.`,
        ] },
        {
          type: 'graph', title: 'First-order step response',
          body: R`$G = \frac{K}{Ts+1}$ with a unit step. $K$ sets where it ends up; $T$ sets how fast. At $t = T$ it has always covered 63.2 % of the way.`,
          widget: {
            params: [{ key: 'K', label: 'K', min: 0.2, max: 3, step: 0.1, value: 2 }, { key: 'T', label: 'T (s)', min: 0.2, max: 4, step: 0.1, value: 1 }],
            x: [0, 10], y: [0, 3.3], xLabel: 't',
            curves: (p) => [{ fn: first(p.K, p.T), label: 'y(t)' }, { fn: (t) => (p.K / p.T) * t, label: 'initial slope', dash: true, color: 3 }],
            hlines: (p) => [{ y: p.K, label: 'K' }, { y: 0.632 * p.K, label: '0.632K' }],
            vlines: (p) => [{ x: p.T, label: 't = T' }],
            readout: (p) => `$y(t) = ${p.K.toFixed(1)}\\left(1 - e^{-t/${p.T.toFixed(1)}}\\right)$; settles (2 %) after about $4T = ${(4 * p.T).toFixed(1)}$ s.`,
          },
        },
        { type: 'quiz', prompt: R`$G(s) = \dfrac{6}{2s + 3}$. What is the time constant?`, options: [
          { tex: R`$\frac23$ s`, correct: true },
          { tex: '2 s', why: 'First rewrite as $\\frac{K}{Ts+1}$: divide by 3 to get $\\frac{2}{\\frac23 s + 1}$.' },
          { tex: R`$\frac32$ s`, why: 'That is $1/T$, the pole magnitude.' },
          { tex: '2 (that is K)', why: '$K = 2$ is the gain, not the time constant.' },
        ] },
        { type: 'text', kind: 'method', title: 'From an input–output ODE', body: R`$a_2\ddot y + a_1\dot y + a_0y = b_1\dot u + b_0u \;\Rightarrow\; G(s) = \dfrac{b_1s + b_0}{a_2s^2 + a_1s + a_0}$. Derivatives on the input side become zeros (numerator), and on the output side poles (denominator).` },
        { type: 'text', kind: 'method', title: 'Cramer\'s rule for coupled equations', body: R`With two unknowns, write the transformed equations as a matrix: $$\begin{bmatrix} a_{11} & a_{12}\\ a_{21} & a_{22}\end{bmatrix}\begin{bmatrix}X_1\\X_2\end{bmatrix} = \begin{bmatrix}U\\0\end{bmatrix}$$ Then $X_k = \dfrac{\Delta_k}{\Delta}$, where $\Delta = a_{11}a_{22} - a_{12}a_{21}$ and $\Delta_k$ is $\Delta$ with column $k$ replaced by the right-hand side.` },
        { type: 'example', title: 'Worked example', prompt: R`$(s+2)X_1 - X_2 = U$ and $-X_1 + (s+3)X_2 = 0$. Find $X_2/U$.`, steps: [
          R`$\Delta = (s+2)(s+3) - (-1)(-1) = s^2 + 5s + 5$.`,
          R`$\Delta_2 = \begin{vmatrix} s+2 & U\\ -1 & 0\end{vmatrix} = 0 - (-1)U = U$.`,
          R`$\dfrac{X_2}{U} = \dfrac{1}{s^2 + 5s + 5}$.`,
        ] },
        { type: 'input', prompt: R`Same system: what is $X_1/U$? (in terms of $s$)`, answer: '(s+3)/(s^2+5*s+5)', answerTex: '\\frac{s+3}{s^2+5s+5}', vars: ['s'], explain: R`$\Delta_1 = \begin{vmatrix} U & -1\\ 0 & s+3\end{vmatrix} = (s+3)U$.` },
      ],
    },
    {
      id: 'sim', tag: 'Lec 10–11', num: 'L10', title: 'Simulation and block diagrams', chapter: 'Midterm · Lectures 10–11',
      skills: ['sy-simdiag', 'sy-block'],
      lesson: [
        { type: 'text', kind: 'key', title: 'Two kinds of diagrams', body: R`A simulation diagram uses gains, summers and integrators (time domain, can carry initial conditions; this is what Simulink builds). A block diagram uses transfer-function blocks (s-domain, zero initial conditions).` },
        { type: 'text', kind: 'method', title: 'Building a simulation diagram', body: R`1. Solve the ODE for the highest derivative.<br>2. A summer produces that derivative.<br>3. Chain integrators to get the lower derivatives down to $y$.<br>4. Feed each needed signal back to the summer through its gain.` },
        { type: 'graph', title: 'ÿ + a₁ẏ + a₀y = b₀u as a diagram', body: R`The summer output is $\ddot y = b_0u - a_1\dot y - a_0y$. Each $\int$ lowers the derivative by one.`, widget: { kind: 'chain', n: 2, input: 'u', inGain: 'b₀', signals: ['ÿ', 'ẏ', 'y'], fb: ['a₁', 'a₀'] }, after: R`Reading it back: $s^2Y = b_0U - a_1sY - a_0Y$, so $\dfrac{Y}{U} = \dfrac{b_0}{s^2 + a_1s + a_0}$.` },
        { type: 'quiz', prompt: R`In that diagram, what comes out of the first integrator?`, options: [
          { tex: R`$\dot y$`, correct: true },
          { tex: R`$\ddot y$`, why: 'That goes in. Integrating $\\ddot y$ gives $\\dot y$.' },
          { tex: R`$y$`, why: 'That comes out of the second integrator.' },
        ] },
        { type: 'text', kind: 'key', title: 'Block diagram algebra', body: R`Series: $G_1G_2$. Parallel: $G_1 \pm G_2$. Negative feedback: $\dfrac{G}{1+GH}$; positive feedback: $\dfrac{G}{1-GH}$. Moving a summing point past a block multiplies the side branch by that block; moving a branch point past a block divides by it.` },
        { type: 'graph', title: 'Closing the loop', body: R`Unity negative feedback around $G = \frac{K}{s+1}$ gives $\frac{C}{R} = \frac{K}{s + 1 + K}$. More gain gives a faster response and a final value closer to 1.`, widget: {
          panels: [
            { kind: 'blocks', forward: ['K/(s+1)'], feedback: '1', sign: '−', width: 340, height: 190 },
            { kind: 'plot', width: 340, x: [0, 5], y: [0, 1.2], xLabel: 't', curves: (p) => [{ fn: (t) => (p.K / (1 + p.K)) * (1 - Math.exp(-(1 + p.K) * t)), label: 'closed loop' }, { fn: (t) => Math.min(1.2, p.K * (1 - Math.exp(-t))), label: 'open loop', dash: true, color: 1 }], hlines: [{ y: 1, label: 'r = 1' }] },
          ],
          params: [{ key: 'K', label: 'K', min: 0.2, max: 10, step: 0.1, value: 2 }],
          readout: (p) => `$\\frac{C}{R} = \\frac{${p.K.toFixed(1)}}{s + ${(1 + p.K).toFixed(1)}}$: final value $${(p.K / (1 + p.K)).toFixed(3)}$, time constant $${(1 / (1 + p.K)).toFixed(3)}$ s.`,
        } },
        { type: 'quiz', prompt: R`$G = \frac{4}{s+2}$ with negative feedback $H = 2$. The closed loop is…`, options: [
          { tex: R`$\dfrac{4}{s+10}$`, correct: true },
          { tex: R`$\dfrac{4}{s-6}$`, why: 'Negative feedback adds $GH$ in the denominator: $1 + GH$.' },
          { tex: R`$\dfrac{4}{s+4}$`, why: 'The loop gain is $GH = \\frac{8}{s+2}$, not $\\frac{2}{s+2}$.' },
          { tex: R`$\dfrac{8}{s+10}$`, why: 'Only $G$ appears in the numerator.' },
        ], explain: R`$\dfrac{G}{1+GH} = \dfrac{\frac{4}{s+2}}{1 + \frac{8}{s+2}} = \dfrac{4}{s+10}$.` },
      ],
    },
  ],
  extendSections: {
    em: {
      lesson: [
        { type: 'text', kind: 'method', title: 'The four-step procedure', body: R`1. Identify the input (and output).<br>2. Find every energy-storage element; the count is the system order.<br>3. Write a first-order ODE for each state from physics (Newton, KVL, KCL).<br>4. Eliminate intermediate variables ($i$, $\tau$, $e_m$, $\tau_s$, …).` },
        { type: 'text', kind: 'key', title: 'What stores energy', body: R`Inertia $J$ (state $\omega$), mass $m$ ($v$), spring ($\tilde\theta$ or $\tilde x$), inductor ($i$), capacitor ($V_C$). Resistors, dampers and gears store nothing.` },
        { type: 'quiz', prompt: R`Motor (no inductance) → $J_1$ → torsional spring → $J_2$. What is the order?`, options: [
          { tex: '3', correct: true },
          { tex: '2', why: 'The spring stores energy too (its twist $\\tilde\\theta$ is a state).' },
          { tex: '4', why: 'Without inductance the motor current is not a state.' },
          { tex: '1', why: 'Each inertia and the spring is its own energy store.' },
        ] },
        { type: 'text', kind: 'key', title: 'The DC motor element', body: R`$$i = \frac{V - e_m}{R},\qquad e_m = k_m\omega,\qquad \tau = k_ti$$ Substituting: $\tau = \frac{k_t}{R}V - \frac{k_tk_m}{R}\omega$. The back emf acts like extra damping $\frac{k_tk_m}{R}$.` },
        {
          type: 'graph', title: 'Why back emf matters',
          body: R`Step response of a motor driving $J$ with friction $b$. The dashed curve is what you'd wrongly predict without back emf.`,
          widget: {
            params: [{ key: 'V', label: 'V (volts)', min: 1, max: 24, step: 1, value: 12 }, { key: 'R', label: 'R (Ω)', min: 0.5, max: 5, step: 0.1, value: 2 }, { key: 'k', label: 'k_t = k_m', min: 0.1, max: 2, step: 0.05, value: 0.5 }, { key: 'J', label: 'J', min: 0.05, max: 2, step: 0.05, value: 0.5 }, { key: 'b', label: 'b', min: 0.05, max: 1, step: 0.05, value: 0.2 }],
            x: [0, 12], y: 'auto', xLabel: 't (s)',
            curves: (p) => { const D = p.R * p.b + p.k * p.k; return [{ fn: first((p.k * p.V) / D, (p.R * p.J) / D), label: 'with back emf' }, { fn: first((p.k * p.V) / (p.R * p.b), p.J / p.b), label: 'ignoring back emf', dash: true, color: 1 }]; },
            readout: (p) => { const D = p.R * p.b + p.k * p.k; return `$\\tau_m = \\frac{RJ}{Rb + k_tk_m} = ${((p.R * p.J) / D).toFixed(3)}$ s, $\\;\\omega_{ss} = \\frac{k_tV}{Rb + k_tk_m} = ${((p.k * p.V) / D).toFixed(2)}$ rad/s`; },
          },
        },
        { type: 'example', title: 'Worked example: motor → J₁ → spring → J₂', steps: [
          R`States: $\omega_1$, $\omega_2$, $\tilde\theta = \theta_1 - \theta_2$. Input: $V$.`,
          R`$J_1$: $J_1\dot\omega_1 = \tau - k\tilde\theta = \frac{k_t}{R}V - \frac{k_tk_m}{R}\omega_1 - k\tilde\theta$.`,
          R`$J_2$: $J_2\dot\omega_2 = k\tilde\theta$.`,
          R`Spring: $\dot{\tilde\theta} = \omega_1 - \omega_2$.`,
        ] },
        {
          type: 'graph', title: 'Simulate the two-inertia system',
          body: R`Your state equations, integrated numerically for a 12 V step. A soft spring (small $k$) makes $J_2$ lag and oscillate around $J_1$.`,
          widget: {
            params: [{ key: 'k', label: 'spring k', min: 0.5, max: 20, step: 0.5, value: 4 }, { key: 'J2', label: 'J₂', min: 0.2, max: 3, step: 0.1, value: 1 }, { key: 'b2', label: 'friction on J₂', min: 0, max: 1, step: 0.05, value: 0.2 }],
            x: [0, 15], y: 'auto', xLabel: 't (s)',
            curves: (p) => { const R0 = 2, kt = 0.5, J1 = 0.5, V = 12; const sim = SA.simulate((t, x) => [(kt / (J1 * R0)) * V - (kt * kt / (J1 * R0)) * x[0] - (p.k / J1) * x[2], (p.k * x[2] - p.b2 * x[1]) / p.J2, x[0] - x[1]], [0, 0, 0], 15, 1500); return [{ fn: (t) => sim(t, 0), label: 'ω₁' }, { fn: (t) => sim(t, 1), label: 'ω₂', color: 1 }]; },
            readout: () => 'Fixed: $R = 2$, $k_t = k_m = 0.5$, $J_1 = 0.5$, $V = 12$ V.',
          },
        },
        { type: 'input', prompt: R`$R = 2$, $J = 0.5$, $b = 0.1$, $k_t = k_m = 1$. Mechanical time constant $\tau_m$ (s)?`, answer: '1/1.2', answerTex: '0.833', explain: R`$\tau_m = \frac{RJ}{Rb + k_tk_m} = \frac{1}{0.2 + 1} = 0.833$ s.` },
        { type: 'text', kind: 'key', title: 'Gears', body: R`$r_1\omega_1 = r_2\omega_2$ and $\tau_2 = \frac{r_2}{r_1}\tau_1$. Reflected to the motor, a load counts as $\left(\frac{r_1}{r_2}\right)^2J_L$.` },
        { type: 'quiz', prompt: R`Motor gear $r_1 = 2$ cm, load gear $r_2 = 6$ cm, $J_L = 9$ kg·m². $J_L$ referred to the motor shaft is…`, options: [
          { tex: '1 kg·m²', correct: true },
          { tex: '3 kg·m²', why: 'The ratio enters squared: $(2/6)^2 \\times 9$.' },
          { tex: '81 kg·m²', why: 'Upside down. The fast motor side sees a smaller load.' },
          { tex: '9 kg·m²', why: 'It must be reflected through the gears.' },
        ] },
      ],
    },
    lt: {
      lesson: [
        { type: 'text', kind: 'key', title: 'Definition', body: R`$F(s) = \int_0^\infty f(t)e^{-st}dt$, with signals taken as zero for $t < 0$.` },
        { type: 'text', kind: 'key', title: 'Pairs to know cold', body: R`$\delta\to1$, $u\to\frac1s$, $t\to\frac1{s^2}$, $e^{-at}\to\frac1{s+a}$, $\sin\omega t\to\frac{\omega}{s^2+\omega^2}$, $\cos\omega t\to\frac{s}{s^2+\omega^2}$, $te^{-at}\to\frac{1}{(s+a)^2}$, and the shifted versions $e^{-at}\sin$, $e^{-at}\cos$ with $s \to s+a$.` },
        {
          type: 'graph', title: 'Pole location ↔ time response',
          body: R`A pair of poles at $\sigma \pm j\omega$ gives $e^{\sigma t}\cos\omega t$. Drag them: left of the axis decays, right grows; distance from the real axis sets the oscillation.`,
          widget: {
            params: [{ key: 's', label: 'σ (real part)', min: -3, max: 1, step: 0.05, value: -0.5 }, { key: 'w', label: 'ω (imag part)', min: 0, max: 6, step: 0.1, value: 3 }],
            panels: [
              { kind: 'splane', lim: 6, poles: (p) => (p.w > 0 ? [{ re: p.s, im: p.w }, { re: p.s, im: -p.w }] : [{ re: p.s, im: 0 }]), width: 300, height: 300, flex: 0.8 },
              { kind: 'plot', x: [0, 8], y: [-3, 3], xLabel: 't', width: 380, height: 300, curves: (p) => [{ fn: (t) => Math.exp(p.s * t) * Math.cos(p.w * t), label: 'e^{σt} cos ωt' }, { fn: (t) => Math.exp(p.s * t), dash: true, color: 3, label: 'envelope' }] },
            ],
            readout: (p) => `Poles at $${p.s.toFixed(2)} \\pm ${p.w.toFixed(1)}j$: ${p.s < 0 ? 'decays (stable)' : p.s > 0 ? 'grows (unstable)' : 'neither grows nor decays (marginal)'}${p.w > 0 ? `, oscillating at ${p.w.toFixed(1)} rad/s` : ', no oscillation'}.`,
          },
        },
        { type: 'quiz', prompt: R`$Y(s) = \dfrac{1}{(s-1)(s+3)}$. As $t\to\infty$, $y(t)$…`, options: [
          { tex: 'grows without bound', correct: true },
          { tex: 'decays to 0', why: 'The pole at $s = +1$ gives an $e^{t}$ term.' },
          { tex: 'oscillates', why: 'Both poles are real, so there is no oscillation.' },
        ] },
        { type: 'text', kind: 'method', title: 'Properties', body: R`Linearity; shift in $s$: $e^{-at}f \to F(s+a)$; delay: $f(t-T)u(t-T)\to e^{-Ts}F$; $\dot f\to sF - f(0)$, $\ddot f \to s^2F - sf(0) - \dot f(0)$; $\int_0^t f \to F/s$.` },
        { type: 'example', title: 'Worked example: an ODE', prompt: R`$\dot y + 3y = 6$, $y(0) = 1$.`, steps: [
          R`$sY - 1 + 3Y = \frac6s$.`,
          R`$Y = \dfrac{s+6}{s(s+3)} = \dfrac2s - \dfrac1{s+3}$.`,
          R`$y(t) = 2 - e^{-3t}$. Check: $y(0) = 1$ and $\dot y + 3y = 6$.`,
        ] },
        { type: 'input', prompt: R`$\mathcal{L}\{e^{-2t}\sin 3t\} = $ ? (in terms of $s$)`, answer: '3/((s+2)^2+9)', answerTex: '\\frac{3}{(s+2)^2+9}', vars: ['s'], explain: R`$\sin 3t \to \frac{3}{s^2+9}$, then shift $s\to s+2$.` },
        { type: 'text', kind: 'key', title: 'Initial and final value theorems', body: R`$y(0^+) = \lim_{s\to\infty}sY(s)$ and $y(\infty) = \lim_{s\to0}sY(s)$. The final value theorem needs all poles of $sY$ in the left half-plane.` },
        {
          type: 'graph', title: 'The final value theorem in action',
          body: R`$Y = \frac{K}{s(s+a)}$ is a step into $\frac{K}{s+a}$. The FVT predicts $\lim sY = \frac Ka$ without inverting anything.`,
          widget: {
            params: [{ key: 'K', label: 'K', min: 0.5, max: 10, step: 0.5, value: 4 }, { key: 'a', label: 'a', min: 0.5, max: 5, step: 0.1, value: 2 }],
            x: [0, 6], y: 'auto', xLabel: 't',
            curves: (p) => [{ fn: (t) => (p.K / p.a) * (1 - Math.exp(-p.a * t)), label: 'y(t)' }],
            hlines: (p) => [{ y: p.K / p.a, label: 'FVT: K/a' }],
            readout: (p) => `$\\lim_{s\\to0} s\\cdot\\frac{${p.K}}{s(s+${p.a.toFixed(1)})} = ${(p.K / p.a).toFixed(3)}$`,
          },
        },
        { type: 'quiz', prompt: R`Can you use the final value theorem on $Y = \dfrac{1}{s(s-2)}$?`, options: [
          { tex: R`No: the pole at $s = 2$ makes $y$ blow up`, correct: true },
          { tex: R`Yes: $y(\infty) = -\frac12$`, why: 'The formula gives a number, but it is meaningless because $y(t)$ contains $e^{2t}$.' },
        ] },
      ],
    },
    pfe: {
      lesson: [
        { type: 'text', kind: 'key', title: 'The idea', body: R`Split $F = \frac{B(s)}{A(s)}$ into simple terms from the table (proper fractions only; long-divide first if needed). Each pole contributes one term, and repeated poles contribute one term per power.` },
        { type: 'text', kind: 'method', title: 'Distinct real poles: cover-up', body: R`$F = \sum\frac{a_k}{s+p_k}$ with $a_k = \left[(s+p_k)F\right]_{s=-p_k}$, so $f(t) = \sum a_ke^{-p_kt}$.` },
        {
          type: 'graph', title: 'f(t) is the sum of its pole terms',
          body: R`$F = \frac{a_1}{s+p_1} + \frac{a_2}{s+p_2}$. Each term is an exponential; the solid curve is their sum. Slow poles (small $p$) dominate later on.`,
          widget: {
            params: [{ key: 'a1', label: 'a₁', min: -3, max: 3, step: 0.1, value: 2 }, { key: 'p1', label: 'p₁', min: 0.2, max: 5, step: 0.1, value: 1 }, { key: 'a2', label: 'a₂', min: -3, max: 3, step: 0.1, value: -1 }, { key: 'p2', label: 'p₂', min: 0.2, max: 5, step: 0.1, value: 3 }],
            x: [0, 5], y: [-3.2, 3.2], xLabel: 't',
            curves: (p) => [{ fn: (t) => p.a1 * Math.exp(-p.p1 * t) + p.a2 * Math.exp(-p.p2 * t), label: 'f(t)', width: 3 }, { fn: (t) => p.a1 * Math.exp(-p.p1 * t), dash: true, color: 1, label: 'a₁e^{−p₁t}' }, { fn: (t) => p.a2 * Math.exp(-p.p2 * t), dash: true, color: 2, label: 'a₂e^{−p₂t}' }],
            readout: (p) => `$f(0^+) = a_1 + a_2 = ${(p.a1 + p.a2).toFixed(2)}$, the same as $\\lim_{s\\to\\infty} sF(s)$.`,
          },
        },
        { type: 'quiz', prompt: R`$F = \dfrac{2s+1}{(s+1)(s+3)}$. The residue at $s = -1$ is…`, options: [
          { tex: R`$-\frac12$`, correct: true },
          { tex: R`$\frac12$`, why: 'Cover $(s+1)$ and set $s = -1$: $\\frac{2(-1)+1}{-1+3} = \\frac{-1}{2}$.' },
          { tex: R`$\frac52$`, why: 'That is the residue at $s = -3$: $\\frac{-5}{-2}$.' },
          { tex: '1', why: 'Evaluate the rest of $F$ at $s = -1$.' },
        ] },
        { type: 'text', kind: 'method', title: 'Repeated poles', body: R`$\frac{b_2}{(s+p)^2} + \frac{b_1}{s+p}$ with $b_2 = [(s+p)^2F]_{s=-p}$ and $b_1 = \frac{d}{ds}[(s+p)^2F]_{s=-p}$. Invert with $\frac{1}{(s+p)^2}\to te^{-pt}$.` },
        { type: 'example', title: 'Worked example', prompt: R`$F = \dfrac{s+3}{(s+1)^2}$.`, steps: [
          R`$b_2 = [s+3]_{s=-1} = 2$.`,
          R`$b_1 = \frac{d}{ds}(s+3) = 1$.`,
          R`$F = \frac{1}{s+1} + \frac{2}{(s+1)^2}$, so $f = e^{-t} + 2te^{-t}$.`,
        ] },
        {
          type: 'graph', title: 'What t·e^{−at} looks like',
          body: R`A double pole gives $te^{-at}$: it rises first, peaks at $t = \frac1a$, then decays. Compare it with the plain $e^{-at}$.`,
          widget: {
            params: [{ key: 'a', label: 'a', min: 0.3, max: 4, step: 0.1, value: 1 }],
            x: [0, 8], y: [0, 1.1], xLabel: 't',
            curves: (p) => [{ fn: (t) => t * Math.exp(-p.a * t), label: 't e^{−at}' }, { fn: (t) => Math.exp(-p.a * t), label: 'e^{−at}', dash: true, color: 1 }],
            points: (p) => [{ x: 1 / p.a, y: (1 / p.a) * Math.exp(-1), label: 'peak at 1/a' }],
          },
        },
        { type: 'text', kind: 'method', title: 'Complex poles: complete the square', body: R`Write the quadratic as $(s+\sigma)^2+\omega^2$ and the numerator as $A(s+\sigma) + B\omega$. Then $f = e^{-\sigma t}(A\cos\omega t + B\sin\omega t)$.` },
        { type: 'example', title: 'Worked example', prompt: R`$F = \dfrac{2s+8}{s^2+2s+5}$.`, steps: [
          R`$s^2+2s+5 = (s+1)^2 + 4$, so $\sigma = 1$ and $\omega = 2$.`,
          R`$2s + 8 = 2(s+1) + 6 = 2(s+1) + 3\cdot2$, so $A = 2$, $B = 3$.`,
          R`$f(t) = e^{-t}(2\cos 2t + 3\sin 2t)$.`,
        ] },
        { type: 'input', prompt: R`$\mathcal{L}^{-1}\left\{\dfrac{s+3}{(s+3)^2+4}\right\} = $ ? (in terms of $t$)`, answer: 'exp(-3*t)*cos(2*t)', answerTex: 'e^{-3t}\\cos 2t', vars: ['t'], explain: R`It is already in the form $\frac{s+\sigma}{(s+\sigma)^2+\omega^2}$ with $\sigma = 3$, $\omega = 2$.` },
        { type: 'text', kind: 'key', title: 'Sanity checks', body: R`One term per pole (counting multiplicity). $f(0^+) = \lim_{s\to\infty}sF$. Left-half-plane poles decay; a pole at 0 gives a constant.` },
      ],
    },
  },
});
