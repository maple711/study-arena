// MATH 3705 — Chapter 5 (Sturm–Liouville) and Chapter 6 (Fourier transform): sections 5.1, 5.2, 6.1, 6.2.
const { R, pick, randInt, rand, nz, nf, rnd, besselJ, bisect } = SA;
const simpson = (g, a, b, n = 2000) => { const h = (b - a) / n; let s = g(a) + g(b); for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * g(a + i * h); return (s * h) / 3; };
const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const J0Z = [2.4048, 5.5201, 8.6537, 11.7915], J1Z = [3.8317, 7.0156, 10.1735, 13.3237];
const sampN = () => () => ({ n: randInt(1, 9) });

/* ---------- 5.1 ---------- */
function genSLForm() {
  const cases = [
    { eq: "x^2y'' + xy' + \\lambda y = 0", a2: (x) => x * x, a1: (x) => x, b: () => 1, p: 'x', pT: 'x', r: '1/x', rT: '\\frac1x', ne: 'ln(x)', dom: [0.5, 3], work: R`$\dfrac{a_1}{a_2} = \dfrac{x}{x^2} = \dfrac1x$, so $p = e^{\ln x} = x$.` },
    { eq: "y'' + 2y' + \\lambda y = 0", a2: () => 1, a1: () => 2, b: () => 1, p: 'exp(2*x)', pT: 'e^{2x}', r: 'exp(2*x)', rT: 'e^{2x}', ne: '2*x', dom: [0, 2], work: R`$\dfrac{a_1}{a_2} = 2$, so $p = e^{2x}$.` },
    { eq: "xy'' + 2y' + \\lambda xy = 0", a2: (x) => x, a1: () => 2, b: (x) => x, p: 'x^2', pT: 'x^2', r: 'x^2', rT: 'x^2', ne: '2*ln(x)', dom: [0.5, 3], work: R`$\dfrac{a_1}{a_2} = \dfrac2x$, so $p = e^{2\ln x} = x^2$.` },
    { eq: "y'' - 2xy' + \\lambda y = 0", a2: () => 1, a1: (x) => -2 * x, b: () => 1, p: 'exp(-x^2)', pT: 'e^{-x^2}', r: 'exp(-x^2)', rT: 'e^{-x^2}', ne: '-x^2', dom: [-1, 1], work: R`$\dfrac{a_1}{a_2} = -2x$, so $p = e^{-x^2}$.` },
    { eq: "x^2y'' + 3xy' + \\lambda y = 0", a2: (x) => x * x, a1: (x) => 3 * x, b: () => 1, p: 'x^3', pT: 'x^3', r: 'x', rT: 'x', ne: '3*ln(x)', dom: [0.5, 3], work: R`$\dfrac{a_1}{a_2} = \dfrac3x$, so $p = x^3$.` },
    { eq: "y'' + \\frac{1}{x}y' + \\lambda y = 0", a2: () => 1, a1: (x) => 1 / x, b: () => 1, p: 'x', pT: 'x', r: 'x', rT: 'x', ne: 'ln(x)', dom: [0.5, 3], work: R`$\dfrac{a_1}{a_2} = \dfrac1x$, so $p = x$.` },
  ];
  const C = pick(cases), askR = Math.random() < 0.4;
  const ans = askR ? C.r : C.p;
  return {
    points: 15,
    prompt: `Write $${C.eq}$ in Sturm–Liouville form $(p(x)y')' - q(x)y + \\lambda r(x)y = 0$. What is ${askR ? '$r(x)$' : '$p(x)$'}?`,
    vars: ['x'], sample: () => ({ x: rand(C.dom[0], C.dom[1]) }), hint: 'Answer in terms of x, with leading coefficient 1.',
    answer: ans, answerTex: askR ? `r(x) = ${C.rT}` : `p(x) = ${C.pT}`, verify: { kind: 'self' },
    selfCheck() {
      const P = (x) => SA.evaluate(SA.parse(C.p, ['x']), { x }), Rr = (x) => SA.evaluate(SA.parse(C.r, ['x']), { x });
      for (const x of [C.dom[0] + 0.3, C.dom[1] - 0.2]) { const h = 1e-5, dp = (P(x + h) - P(x - h)) / (2 * h); if (!near(dp / P(x), C.a1(x) / C.a2(x), 1e-6)) return 'p wrong'; if (!near(Rr(x), (P(x) * C.b(x)) / C.a2(x), 1e-9)) return 'r wrong'; }
      return true;
    },
    steps: [
      { key: 'std', title: 'Divide by the leading coefficient', body: R`Write it as $y'' + \frac{a_1}{a_2}y' + \dots + \lambda\frac{b}{a_2}y = 0$.` },
      { key: 'p', title: 'Integrating factor', body: `$p(x) = e^{\\int a_1/a_2\\,dx}$. ${C.work}` },
      { key: 'r', title: 'Multiply through by p', body: `$(py')' + \\lambda\\,p\\frac{b}{a_2}y = 0$, so $r(x) = p\\frac{b}{a_2} = ${C.rT}$.` },
    ],
    mistakes: [
      { expr: askR ? C.p : C.r, step: askR ? 'r' : 'p', why: askR ? '$r$ is what multiplies $\\lambda y$ after multiplying by $p$; you gave $p$.' : 'That is $r(x)$, the weight on $\\lambda y$.' },
      ...(askR ? [] : [{ expr: C.ne, step: 'p', why: 'That is $\\int a_1/a_2\\,dx$; $p$ is its exponential.' }]),
    ],
  };
}

function genSLExpand() {
  const L = pick([{ v: 1, t: '1', e: '1' }, { v: Math.PI, t: '\\pi', e: 'pi' }, { v: 2, t: '2', e: '2' }]);
  const bc = pick(['DN', 'DD']), k = nz(-3, 3);
  const phiT = bc === 'DD' ? (L.e === 'pi' ? '\\sin nx' : `\\sin\\frac{n\\pi x}{${L.t}}`) : (L.e === 'pi' ? '\\sin\\frac{(2n-1)x}{2}' : `\\sin\\frac{(2n-1)\\pi x}{${2 * L.v === 2 ? '2' : 2 * L.v}}`);
  const phi = bc === 'DD' ? (n, x) => Math.sin((n * Math.PI * x) / L.v) : (n, x) => Math.sin(((2 * n - 1) * Math.PI * x) / (2 * L.v));
  const ans = bc === 'DD' ? `2*${k}*(1-(-1)^n)/(n*pi)` : `4*${k}/((2*n-1)*pi)`;
  return {
    points: 20,
    prompt: `The eigenfunctions of $y'' + \\lambda y = 0$, $${bc === 'DD' ? `y(0) = y(${L.t}) = 0` : `y(0) = 0,\\ y'(${L.t}) = 0`}$ are $\\phi_n = ${phiT}$. Expand $f(x) = ${k}$ as $\\sum c_n\\phi_n$: find $c_n$.`,
    vars: ['n'], sample: sampN(), hint: 'Answer in terms of n.',
    answer: ans, answerTex: bc === 'DD' ? `c_n = \\frac{${2 * k}(1-(-1)^n)}{n\\pi}` : `c_n = \\frac{${4 * k}}{(2n-1)\\pi}`, verify: { kind: 'self' },
    selfCheck() { for (const n of [1, 2, 3]) { const c = simpson((x) => k * phi(n, x), 0, L.v) / simpson((x) => phi(n, x) ** 2, 0, L.v); if (!near(c, SA.evaluate(SA.parse(ans, ['n']), { n }), 1e-6)) return `n=${n}`; } return true; },
    steps: [
      { key: 'orth', title: 'Orthogonality (r = 1)', body: R`$c_n = \dfrac{\int_0^L f\phi_n\,dx}{\int_0^L \phi_n^2\,dx}$, because distinct eigenfunctions of a regular SL problem are orthogonal.` },
      { key: 'norm', title: 'Norm', body: `$\\int_0^{${L.t}}\\phi_n^2\\,dx = \\frac{${L.t}}{2}$` },
      { key: 'num', title: 'Numerator', body: bc === 'DD' ? `$\\int_0^{${L.t}} ${k}\\phi_n\\,dx = \\frac{${k}\\cdot${L.t}(1-(-1)^n)}{n\\pi}$` : `$\\int_0^{${L.t}} ${k}\\phi_n\\,dx = \\frac{${2 * k}\\cdot${L.t}}{(2n-1)\\pi}$ (since $\\cos\\frac{(2n-1)\\pi}{2} = 0$)` },
    ],
    mistakes: [
      { expr: bc === 'DD' ? `${k}*(1-(-1)^n)/(n*pi)` : `2*${k}/((2*n-1)*pi)`, step: 'norm', why: 'Divide by the norm $L/2$, i.e. multiply by $2/L$.' },
      ...(bc === 'DN' ? [{ expr: `2*${k}*(1-(-1)^n)/(n*pi)`, step: 'orth', why: 'With $y\'(L) = 0$ the eigenfunctions are $\\sin\\frac{(2n-1)\\pi x}{2L}$, not $\\sin\\frac{n\\pi x}{L}$.' }] : []),
    ],
  };
}

/* ---------- 5.2 ---------- */
function genBesselEig() {
  const nu = pick([0, 0, 1]), Rv = pick([1, 2, 3, 0.5]), n = randInt(1, 3);
  const Z = nu === 0 ? J0Z : J1Z, z = Z[n - 1];
  const ans = (z / Rv) ** 2;
  return {
    points: 15,
    prompt: `Find the eigenvalue $\\lambda_${n}$ of $(xy')' ${nu ? '- \\frac{1}{x}y ' : ''}+ \\lambda xy = 0$ on $0<x<${Rv}$, $y$ bounded, $y(${Rv}) = 0$. Zeros of $J_${nu}$: ${Z.slice(0, 3).join(', ')}.`,
    vars: [], sample: () => ({}), tol: 2e-4, hint: 'Enter a number.',
    answer: String(rnd(ans)), answerTex: `\\lambda_${n} = \\left(\\frac{${z}}{${Rv}}\\right)^2 = ${ans.toFixed(4)}`, verify: { kind: 'self' },
    selfCheck() { return Math.abs(besselJ(nu, Math.sqrt(ans) * Rv)) < 5e-4 ? true : 'not a zero'; },
    figure: { kind: 'plot', x: [0, Rv], y: [-0.7, 1.1], xLabel: 'x', curves: [{ fn: (x) => besselJ(nu, (z / Rv) * x), label: `J${nu}(√λ${n} x)` }] },
    steps: [
      { key: 'id', title: 'Parametric Bessel equation', body: `This is Bessel's equation of order ${nu} in $\\sqrt\\lambda x$; the bounded solution is $y = J_${nu}(\\sqrt\\lambda\\,x)$ ($Y_${nu}$ blows up at 0).` },
      { key: 'bc', title: 'Boundary condition', body: `$J_${nu}(\\sqrt\\lambda\\cdot${Rv}) = 0$, so $\\sqrt{\\lambda_n}\\cdot${Rv}$ is the $n$th zero.` },
      { key: 'res', title: `n = ${n}`, body: `$\\lambda_${n} = \\left(\\frac{${z}}{${Rv}}\\right)^2 = ${ans.toFixed(4)}$` },
    ],
    mistakes: [
      { expr: String(rnd(z / Rv)), step: 'res', why: 'That is $\\sqrt{\\lambda_n}$. Square it.' },
      ...(Rv !== 1 ? [{ expr: String(rnd(z * z)), step: 'bc', why: `Divide the zero by $R = ${Rv}$ before squaring.` }, { expr: String(rnd((z * Rv) ** 2)), step: 'bc', why: '$\\sqrt\\lambda R = $ zero, so $\\sqrt\\lambda = $ zero$/R$.' }] : []),
      { expr: String(rnd(((nu === 0 ? J1Z : J0Z)[n - 1] / Rv) ** 2)), step: 'id', why: `Use the zeros of $J_${nu}$, the order of this equation.` },
    ],
  };
}

function genMembrane() {
  const Rv = pick([0.5, 1, 2]), c = pick([1, 2, 5, 10]), ask = pick(['w1', 'ratio']);
  if (ask === 'ratio') {
    const n = pick([2, 3]);
    const ans = J0Z[n - 1] / J0Z[0];
    return {
      points: 10,
      prompt: `For a circular drum (radially symmetric modes), what is $\\omega_${n}/\\omega_1$? Zeros of $J_0$: ${J0Z.slice(0, 3).join(', ')}.`,
      vars: [], sample: () => ({}), tol: 5e-4, hint: 'Enter a number.',
      answer: String(rnd(ans)), answerTex: `\\frac{\\omega_${n}}{\\omega_1} = \\frac{${J0Z[n - 1]}}{${J0Z[0]}} = ${ans.toFixed(4)}`, verify: { kind: 'self' }, selfCheck: () => true,
      steps: [
        { key: 'freq', title: 'Mode frequencies', body: R`$u_n = J_0\!\left(\frac{j_{0n}r}{R}\right)\cos\frac{cj_{0n}t}{R}$, so $\omega_n = \frac{c\,j_{0n}}{R}$.` },
        { key: 'ratio', title: 'Ratio', body: `$c$ and $R$ cancel: $\\frac{\\omega_${n}}{\\omega_1} = \\frac{j_{0${n}}}{j_{01}}$, not ${n}. A drum's overtones are not harmonics, which is why it sounds less "pitched" than a string.` },
      ],
      mistakes: [{ expr: String(n), step: 'ratio', why: 'That holds for a string ($\\omega_n = n\\omega_1$). Drum frequencies follow the Bessel zeros.' }],
    };
  }
  const ans = (c * J0Z[0]) / Rv;
  return {
    points: 15,
    prompt: `A circular membrane of radius $${Rv}$ with clamped edge satisfies $u_{tt} = ${c * c}\\left(u_{rr} + \\frac1r u_r\\right)$ (radially symmetric). What is its lowest angular frequency $\\omega_1$? ($j_{01} = 2.4048$)`,
    vars: [], sample: () => ({}), tol: 5e-4, hint: 'Enter a number.',
    answer: String(rnd(ans)), answerTex: `\\omega_1 = \\frac{c\\,j_{01}}{R} = \\frac{${c}\\cdot2.4048}{${Rv}} = ${ans.toFixed(4)}`, verify: { kind: 'self' }, selfCheck: () => true,
    steps: [
      { key: 'sep', title: 'Separate', body: R`$u = R(r)T(t)$ gives Bessel's equation of order 0 for $R(r)$: $R = J_0(\mu r)$, and $T'' + c^2\mu^2T = 0$.` },
      { key: 'bc', title: 'Clamped edge', body: `$J_0(\\mu\\cdot${Rv}) = 0 \\Rightarrow \\mu_1 = \\frac{2.4048}{${Rv}}$.` },
      { key: 'w', title: 'Frequency', body: `$\\omega_1 = c\\mu_1$ with $c = \\sqrt{${c * c}} = ${c}$: $\\omega_1 = ${ans.toFixed(4)}$.` },
    ],
    mistakes: [
      { expr: String(rnd((c * c * J0Z[0]) / Rv)), step: 'w', why: `The equation has $c^2 = ${c * c}$; use $c = ${c}$.` },
      { expr: String(rnd(J0Z[0] / Rv)), step: 'w', why: 'Multiply $\\mu_1$ by the wave speed $c$.' },
      ...(Rv !== 1 ? [{ expr: String(rnd(c * J0Z[0] * Rv)), step: 'bc', why: '$\\mu_1 = j_{01}/R$.' }] : []),
    ],
  };
}

/* ---------- 6.1 ---------- */
function genFTBasic() {
  const kind = pick(['exp', 'box', 'gauss', 'exp']), k = pick([1, 2, 3]);
  let fTex, ans, ansTex, f, steps, mistakes, lim;
  if (kind === 'exp') {
    const a = randInt(1, 4);
    fTex = `${k === 1 ? '' : k}e^{-${a === 1 ? '' : a}|x|}`; f = (x) => k * Math.exp(-a * Math.abs(x)); lim = 40 / a;
    ans = `${2 * a * k}/(${a * a}+lam^2)`; ansTex = `\\frac{${2 * a * k}}{${a * a}+\\lambda^2}`;
    steps = [
      { key: 'split', title: 'Split at 0', body: `$\\int_{-\\infty}^0 e^{(${a}+i\\lambda)x}dx + \\int_0^\\infty e^{(-${a}+i\\lambda)x}dx = \\frac{1}{${a}+i\\lambda} + \\frac{1}{${a}-i\\lambda}$` },
      { key: 'comb', title: 'Combine', body: `$= \\frac{2\\cdot${a}}{${a * a}+\\lambda^2}$; multiply by ${k}.` },
    ];
    mistakes = [
      { expr: `${k}/(${a}+lam^2)`, step: 'comb', why: 'Combine over the common denominator $(a+i\\lambda)(a-i\\lambda) = a^2 + \\lambda^2$.' },
      { expr: `${a * k}/(${a * a}+lam^2)`, step: 'split', why: 'Both halves of the real line contribute: the answer has $2a$ on top.' },
    ];
  } else if (kind === 'box') {
    const b = randInt(1, 3);
    fTex = `${k}\\left[u(x+${b}) - u(x-${b})\\right]`; f = (x) => (Math.abs(x) <= b ? k : 0); lim = b;
    ans = `2*${k}*sin(${b}*lam)/lam`; ansTex = `\\frac{${2 * k}\\sin ${b === 1 ? '' : b}\\lambda}{\\lambda}`;
    steps = [
      { key: 'int', title: 'Integrate over the box', body: `$\\int_{-${b}}^{${b}} ${k}e^{i\\lambda x}dx = ${k}\\frac{e^{i${b}\\lambda} - e^{-i${b}\\lambda}}{i\\lambda}$` },
      { key: 'euler', title: 'Euler', body: `$e^{i\\theta} - e^{-i\\theta} = 2i\\sin\\theta$, so $\\hat f = ${ansTex}$.` },
    ];
    mistakes = [
      { expr: `${k}*sin(${b}*lam)/lam`, step: 'euler', why: '$e^{i\\theta} - e^{-i\\theta} = 2i\\sin\\theta$: keep the 2.' },
      { expr: `2*${k}*cos(${b}*lam)/lam`, step: 'euler', why: 'The difference of exponentials gives $\\sin$, the sum gives $\\cos$.' },
    ];
  } else {
    const a = pick([1, 2, 4]);
    fTex = `${k === 1 ? '' : k}e^{-${a === 1 ? '' : a}x^2}`; f = (x) => k * Math.exp(-a * x * x); lim = 10;
    ans = `${k}*sqrt(pi/${a})*exp(-lam^2/${4 * a})`; ansTex = `${k === 1 ? '' : k}\\sqrt{\\frac{\\pi}{${a}}}\\,e^{-\\lambda^2/${4 * a}}`;
    steps = [
      { key: 'thm', title: 'Gaussian transform (Example 6.13)', body: R`$\mathcal{F}\{e^{-ax^2}\} = \sqrt{\frac{\pi}{a}}\,e^{-\lambda^2/(4a)}$: a Gaussian transforms into a Gaussian.` },
      { key: 'res', title: `a = ${a}`, body: `$\\hat f(\\lambda) = ${ansTex}$` },
    ];
    mistakes = [
      { expr: `${k}*sqrt(pi/${a})*exp(-lam^2/${a})`, step: 'thm', why: 'The exponent is $-\\lambda^2/(4a)$.' },
      { expr: `${k}*sqrt(pi*${a})*exp(-lam^2/${4 * a})`, step: 'thm', why: 'The prefactor is $\\sqrt{\\pi/a}$: a narrower Gaussian (larger $a$) has a smaller transform at 0.' },
    ];
  }
  return {
    points: 15, prompt: `With $\\hat f(\\lambda) = \\int_{-\\infty}^{\\infty} f(x)e^{i\\lambda x}dx$, find the Fourier transform of $f(x) = ${fTex}$.`,
    vars: ['lam'], sample: () => ({ lam: rand(0.2, 3) }), hint: 'Answer in terms of λ (type lam or λ).',
    answer: ans, answerTex: `\\hat f(\\lambda) = ${ansTex}`, steps, mistakes, verify: { kind: 'self' },
    selfCheck() { for (const l of [0.4, 1.3]) { const num = 2 * simpson((x) => f(x) * Math.cos(l * x), 0, lim, 20000); if (!near(num, SA.evaluate(SA.parse(ans, ['lam']), { lam: l }), 1e-5)) return `λ=${l}: ${num}`; } return true; },
  };
}

/* ---------- 6.2 ---------- */
function genFTHeat() {
  const a = pick([1, 2, 1 / 4]), k = randInt(1, 5);
  const aE = a === 0.25 ? '1/4' : String(a), aT = a === 0.25 ? '\\frac{x^2}{4}' : `${a === 1 ? '' : a}x^2`;
  const D = `(1+${4 * a}*t)`;
  const ans = `${k}/sqrt${D}*exp(-${aE}*x^2/${D})`;
  const u = (x, t) => SA.evaluate(SA.parse(ans, ['x', 't']), { x, t });
  return {
    points: 20,
    prompt: `Solve $u_{xx} = u_t$ on $-\\infty<x<\\infty$, $t>0$, with $u(x,0) = ${k}e^{-${aT}}$ (bounded solution).`,
    vars: ['x', 't'], sample: () => ({ x: rand(-2, 2), t: rand(0.05, 2) }), hint: 'Answer in x and t.',
    answer: ans, answerTex: `u = \\frac{${k}}{\\sqrt{1+${4 * a === 1 ? '' : 4 * a}t}}\\,e^{-${a === 0.25 ? '\\frac{x^2}{4}' : (a === 1 ? '' : a) + 'x^2'}/(1+${4 * a === 1 ? '' : 4 * a}t)}`, verify: { kind: 'self' },
    selfCheck() {
      const h = 1e-3;
      for (const [x, t] of [[0.4, 0.3], [-1.1, 1.2]]) { const uxx = (u(x + h, t) - 2 * u(x, t) + u(x - h, t)) / (h * h), ut = (u(x, t + h) - u(x, t - h)) / (2 * h); if (!near(uxx, ut, 1e-3)) return 'PDE'; }
      return near(u(0.7, 0), k * Math.exp(-a * 0.49), 1e-9) ? true : 'IC';
    },
    steps: [
      { key: 'ft', title: 'Transform in x', body: R`$\hat u_t = -\lambda^2\hat u$, so $\hat u(\lambda,t) = \hat f(\lambda)e^{-\lambda^2t}$.` },
      { key: 'f', title: 'Transform the initial data', body: `$\\hat f = ${k}\\sqrt{\\frac{\\pi}{${aE}}}\\,e^{-\\lambda^2/${4 * a}}$` },
      { key: 'comb', title: 'Still a Gaussian', body: `$\\hat u = ${k}\\sqrt{\\frac{\\pi}{${aE}}}\\,e^{-\\lambda^2\\left(\\frac{1}{${4 * a}} + t\\right)}$, the transform of a Gaussian with $\\frac{1}{4a'} = \\frac{1 + ${4 * a}t}{${4 * a}}$.` },
      { key: 'inv', title: 'Invert', body: `$a' = \\frac{${aE}}{1+${4 * a}t}$ and the prefactor becomes $\\frac{${k}}{\\sqrt{1+${4 * a}t}}$: the bump spreads out and its height falls, but its area stays the same.` },
    ],
    mistakes: [
      { expr: `${k}*exp(-${aE}*x^2/${D})`, step: 'inv', why: 'The height must drop as the bump widens (total heat is conserved): include $1/\\sqrt{1+4at}$.' },
      { expr: `${k}*exp(-${aE}*x^2)*exp(-t)`, step: 'ft', why: 'Heat on the whole line spreads; it does not simply decay in place.' },
      { expr: `${k}/sqrt${D}*exp(-${aE}*x^2*${D})`, step: 'comb', why: 'The Gaussian gets wider, so its exponent is divided by $1 + 4at$.' },
    ],
  };
}

/* ---------- lessons ---------- */
const L51 = [
  { type: 'text', kind: 'key', title: 'Regular Sturm–Liouville problems', body: R`$(p(x)y')' - q(x)y + \lambda r(x)y = 0$ on $(\alpha,\beta)$ with $p, r > 0$ and separated boundary conditions $a_1y(\alpha) + a_2y'(\alpha) = 0$, $b_1y(\beta) + b_2y'(\beta) = 0$. Values of $\lambda$ with nontrivial solutions are eigenvalues.` },
  { type: 'text', kind: 'method', title: 'Getting to SL form', body: R`For $a_2y'' + a_1y' + a_0y + \lambda by = 0$: multiply by $\dfrac{p}{a_2}$ with $p = e^{\int a_1/a_2\,dx}$. Then $(py')' + \frac{pa_0}{a_2}y + \lambda\frac{pb}{a_2}y = 0$, so $q = -\frac{pa_0}{a_2}$ and $r = \frac{pb}{a_2}$.` },
  { type: 'example', title: 'Worked example: Cauchy–Euler', prompt: R`$x^2y'' + xy' + \lambda y = 0$, $1<x<e$.`, steps: [
    R`$\frac{a_1}{a_2} = \frac1x$, so $p = x$.`,
    R`Multiply by $\frac{p}{a_2} = \frac1x$: $xy'' + y' + \frac{\lambda}{x}y = 0$, i.e. $(xy')' + \lambda\frac1x y = 0$.`,
    R`$p = x$, $q = 0$, $r = \frac1x$.`,
  ] },
  { type: 'text', kind: 'key', title: 'What the theory guarantees', body: R`Eigenvalues are real and form an increasing sequence $\lambda_1 < \lambda_2 < \cdots \to \infty$. Eigenfunctions for different eigenvalues are orthogonal with weight $r$: $\int_\alpha^\beta \phi_m\phi_n r\,dx = 0$. So $f = \sum c_n\phi_n$ with $c_n = \dfrac{\int f\phi_n r}{\int\phi_n^2r}$.` },
  {
    type: 'graph', title: 'Eigenvalues you have to find graphically',
    body: R`$y'' + \lambda y = 0$, $y(0) = 0$, $y'(1) + h\,y(1) = 0$ gives $\tan\mu = -\mu/h$ with $\lambda = \mu^2$. Each crossing is an eigenvalue; change $h$ and watch them move.`,
    widget: {
      params: [{ key: 'h', label: 'h', min: 0.2, max: 5, step: 0.1, value: 1 }],
      x: [0.01, 12], y: [-8, 8], xLabel: 'μ',
      curves: (p) => [{ fn: (m) => Math.tan(m), label: 'tan μ' }, { fn: (m) => -m / p.h, label: '−μ/h', color: 1 }],
      points: (p) => [1, 2, 3].map((k) => { const lo = (k - 0.5) * Math.PI + 1e-6, hi = k * Math.PI - 1e-6; const r = bisect((m) => Math.tan(m) + m / p.h, lo, hi); return { x: r, y: Math.tan(r), label: `μ${k} = ${r.toFixed(3)}` }; }),
      readout: (p) => { const r = bisect((m) => Math.tan(m) + m / p.h, Math.PI / 2 + 1e-6, Math.PI - 1e-6); return `$\\lambda_1 = \\mu_1^2 = ${(r * r).toFixed(4)}$; as $h\\to\\infty$ this tends to $\\pi^2$ (the $y(1) = 0$ case).`; },
    },
  },
  { type: 'quiz', prompt: R`$y'' + \lambda y = 0$, $y(0) = 0$, $y'(L) = 0$. The eigenfunctions are`, options: [
    { tex: R`$\sin\frac{(2n-1)\pi x}{2L}$`, correct: true },
    { tex: R`$\sin\frac{n\pi x}{L}$`, why: R`Those have $y(L) = 0$, not $y'(L) = 0$.` },
    { tex: R`$\cos\frac{n\pi x}{L}$`, why: R`Those have $y'(0) = 0$, not $y(0) = 0$.` },
  ] },
];
const L52 = [
  { type: 'text', kind: 'key', title: 'Singular problems', body: R`If $p$ or $r$ vanishes at an endpoint (or the interval is infinite), the problem is singular. At such an endpoint the boundary condition is replaced by "$y$ stays bounded".` },
  { type: 'text', kind: 'method', title: "Bessel's equation as an SL problem", body: R`$(xy')' - \frac{\nu^2}{x}y + \lambda xy = 0$ on $(0, R)$: $p = x$ vanishes at 0. Bounded solutions are $J_\nu(\sqrt\lambda\,x)$, and $y(R) = 0$ gives $\sqrt{\lambda_n}R = j_{\nu n}$, the $n$th zero of $J_\nu$. Weight $r = x$.` },
  {
    type: 'graph', title: 'Zeros of J₀ and J₁',
    body: R`The eigenvalues come from where these curves cross zero. The zeros are not evenly spaced at first, then approach a spacing of $\pi$.`,
    widget: {
      params: [{ key: 'nu', label: 'highlight order ν', min: 0, max: 1, step: 1, value: 0 }],
      x: [0, 15], y: [-0.7, 1.1], xLabel: 'x',
      curves: [{ fn: (x) => besselJ(0, x), label: 'J0(x)' }, { fn: (x) => besselJ(1, x), label: 'J1(x)', color: 1 }],
      points: (p) => (p.nu ? J1Z : J0Z).map((z, i) => ({ x: z, y: 0, label: `j${p.nu}${i + 1} = ${z}`, color: p.nu })),
      readout: (p) => `Spacing of the zeros of $J_${p.nu}$: ${(p.nu ? J1Z : J0Z).slice(1).map((z, i) => (z - (p.nu ? J1Z : J0Z)[i]).toFixed(3)).join(', ')} → $\\pi = 3.1416$`,
    },
  },
  { type: 'text', kind: 'key', title: 'The vibrating membrane', body: R`A circular drum: $u_{tt} = c^2\left(u_{rr} + \frac1r u_r\right)$ for radially symmetric motion. Separation gives Bessel's equation of order 0, so the modes are $J_0\!\left(\frac{j_{0n}r}{R}\right)\cos\frac{cj_{0n}t}{R}$ with frequencies $\omega_n = \frac{cj_{0n}}{R}$.` },
  {
    type: 'graph', title: 'Drum modes across a diameter',
    body: R`Mode $n$ has $n - 1$ nodal circles. Scrub time to watch it vibrate.`,
    widget: {
      params: [{ key: 'n', label: 'mode n', min: 1, max: 4, step: 1, value: 2 }, { key: 't', label: 'time', min: 0, max: 2.6, step: 0.01, value: 0 }],
      x: [-1, 1], y: [-1.2, 1.2], xLabel: 'r (across a diameter)',
      curves: (p) => [{ fn: (r) => besselJ(0, J0Z[p.n - 1] * Math.abs(r)) * Math.cos(J0Z[p.n - 1] * p.t), label: 'u' }],
      readout: (p) => `$\\omega_${p.n}/\\omega_1 = ${(J0Z[p.n - 1] / J0Z[0]).toFixed(3)}$ (a string would give ${p.n})`,
    },
  },
  { type: 'input', prompt: R`Drum of radius 2, $c = 1$. Lowest frequency $\omega_1$? ($j_{01} = 2.4048$)`, answer: '1.2024', tol: 1e-3, explain: R`$\omega_1 = \frac{cj_{01}}{R} = \frac{2.4048}{2} = 1.2024$.` },
];
const sinc = (b, l) => (Math.abs(l) < 1e-9 ? 2 * b : (2 * Math.sin(b * l)) / l);
const L61 = [
  { type: 'text', kind: 'key', title: 'The Fourier transform', body: R`$$\hat f(\lambda) = \mathcal{F}\{f\} = \int_{-\infty}^\infty f(x)e^{i\lambda x}dx, \qquad f(x) = \frac{1}{2\pi}\int_{-\infty}^\infty \hat f(\lambda)e^{-i\lambda x}d\lambda.$$ It is the continuous version of a Fourier series: $\hat f(\lambda)$ says how much of frequency $\lambda$ is in $f$. It exists when $f$ is absolutely integrable.` },
  { type: 'example', title: 'Example 6.2', prompt: R`$f(x) = e^{-|x|}$.`, steps: [
    R`Split: $\int_{-\infty}^0 e^{(1+i\lambda)x}dx + \int_0^\infty e^{(-1+i\lambda)x}dx$.`,
    R`$= \frac{1}{1+i\lambda} + \frac{1}{1-i\lambda} = \frac{2}{1+\lambda^2}$.`,
  ] },
  {
    type: 'graph', title: 'Narrow in x means wide in λ',
    body: R`A box of half-width $b$ has $\hat f = \frac{2\sin b\lambda}{\lambda}$. Shrink the box and its transform spreads out; widen it and the transform concentrates near $\lambda = 0$.`,
    widget: {
      params: [{ key: 'b', label: 'half-width b', min: 0.25, max: 3, step: 0.05, value: 1 }],
      panels: [
        { kind: 'plot', x: [-4, 4], y: [-0.2, 1.3], xLabel: 'x', curves: (p) => [{ fn: (x) => (Math.abs(x) < p.b ? 1 : 0), label: 'f(x)' }] },
        { kind: 'plot', x: [-12, 12], y: [-1.5, 6.3], xLabel: 'λ', curves: (p) => [{ fn: (l) => sinc(p.b, l), label: 'f̂(λ)', color: 1 }] },
      ],
      readout: (p) => `$\\hat f(0) = 2b = ${(2 * p.b).toFixed(2)}$ (the area under $f$); first zero at $\\lambda = \\pi/b = ${(Math.PI / p.b).toFixed(3)}$`,
    },
  },
  { type: 'text', kind: 'method', title: 'Key properties', body: R`Linearity. Derivatives: $\mathcal{F}\{f'\} = -i\lambda\hat f$, $\mathcal{F}\{f''\} = -\lambda^2\hat f$ (this is what solves PDEs). Convolution: $\mathcal{F}\{f*g\} = \hat f\hat g$. Gaussian: $\mathcal{F}\{e^{-ax^2}\} = \sqrt{\pi/a}\,e^{-\lambda^2/4a}$.` },
  { type: 'quiz', prompt: R`Does $\mathcal{F}\{1\}$ exist (as an ordinary function)?`, options: [
    { tex: 'No', correct: true },
    { tex: R`Yes, it is $\frac{1}{i\lambda}$`, why: R`The limits of $e^{i\lambda x}$ as $x\to\pm\infty$ don't exist (Example 6.3): $f = 1$ is not absolutely integrable.` },
  ] },
  { type: 'input', prompt: R`$\mathcal{F}\{e^{-2|x|}\}$ at $\lambda = 0$?`, answer: '1', explain: R`$\frac{2a}{a^2+\lambda^2} = \frac{4}{4} = 1$, also the area $\int e^{-2|x|}dx = 1$.` },
];
const L62 = [
  { type: 'text', kind: 'key', title: 'Why transforms for infinite domains', body: R`On $(-\infty,\infty)$ there are no boundary conditions to quantize $\lambda$, so the Fourier series becomes an integral. Transforming in $x$ turns $u_{xx}$ into $-\lambda^2\hat u$ and the PDE into an ODE in $t$.` },
  { type: 'example', title: 'Heat equation on the whole line', prompt: R`$u_{xx} = u_t$, $u(x,0) = f(x)$, $u$ bounded.`, steps: [
    R`Transform: $-\lambda^2\hat u = \hat u_t$, so $\hat u = \hat f(\lambda)e^{-\lambda^2t}$.`,
    R`$e^{-\lambda^2t}$ is the transform of $\frac{1}{2\sqrt{\pi t}}e^{-x^2/4t}$, and products become convolutions.`,
    R`$u(x,t) = \dfrac{1}{2\sqrt{\pi t}}\displaystyle\int_{-\infty}^\infty f(s)e^{-(x-s)^2/4t}ds$.`,
  ] },
  {
    type: 'graph', title: 'A hot spot spreading',
    body: R`$u(x,0) = e^{-x^2}$ gives $u = \frac{1}{\sqrt{1+4t}}e^{-x^2/(1+4t)}$. The area under the curve stays $\sqrt\pi$ as the bump flattens.`,
    widget: {
      params: [{ key: 't', label: 'time t', min: 0, max: 5, step: 0.05, value: 0.5 }],
      x: [-6, 6], y: [0, 1.1], xLabel: 'x',
      curves: (p) => [{ fn: (x) => Math.exp(-x * x), label: 't = 0', dash: true, color: 1 }, { fn: (x) => Math.exp(-(x * x) / (1 + 4 * p.t)) / Math.sqrt(1 + 4 * p.t), label: `t = ${p.t}` }],
      areas: (p) => [{ fn: (x) => Math.exp(-(x * x) / (1 + 4 * p.t)) / Math.sqrt(1 + 4 * p.t), a: -6, b: 6, color: 0 }],
      readout: (p) => `Peak $u(0,t) = ${(1 / Math.sqrt(1 + 4 * p.t)).toFixed(4)}$; width $\\propto\\sqrt{1+4t} = ${Math.sqrt(1 + 4 * p.t).toFixed(3)}$`,
    },
  },
  { type: 'quiz', prompt: R`After the transform in $x$, the heat equation $u_{xx} = u_t$ becomes`, options: [
    { tex: R`$\hat u_t = -\lambda^2\hat u$`, correct: true },
    { tex: R`$\hat u_t = \lambda^2\hat u$`, why: R`$\mathcal{F}\{u_{xx}\} = (-i\lambda)^2\hat u = -\lambda^2\hat u$; a plus sign would make solutions blow up.` },
    { tex: R`$\hat u_{\lambda\lambda} = \hat u_t$`, why: R`The transform replaces $x$-derivatives with multiplication by $-i\lambda$; nothing is differentiated in $\lambda$.` },
  ] },
];

SA.registerCourse({
  course: 'MATH 3705',
  chapters: [{ id: 'ch6', name: 'Fourier transform' }],
  topics: [
    { id: 'sl-form', ch: 'ch5', sec: '5.1', name: 'Sturm–Liouville form', desc: 'Find p(x) and r(x).', gen: genSLForm },
    { id: 'sl-expand', ch: 'ch5', sec: '5.1', name: 'Eigenfunction expansions', desc: 'cₙ = ∫fφₙr / ∫φₙ²r.', gen: genSLExpand },
    { id: 'bessel-eig', ch: 'ch5', sec: '5.2', name: 'Bessel eigenvalues', desc: '√λ R = Bessel zero.', gen: genBesselEig },
    { id: 'membrane', ch: 'ch5', sec: '5.2', name: 'Vibrating membrane', desc: 'ωₙ = c j₀ₙ / R.', gen: genMembrane },
    { id: 'ft-basic', ch: 'ch6', sec: '6.1', name: 'Fourier transforms', desc: 'e^(−a|x|), boxes, Gaussians.', gen: genFTBasic },
    { id: 'ft-heat', ch: 'ch6', sec: '6.2', name: 'Heat equation on ℝ', desc: 'Transform, solve, invert.', gen: genFTHeat },
  ],
  extendTopics: { sl: { sec: '5.1', desc: 'y″ + λy = 0 with four kinds of ends.' } },
  sections: [
    { id: '5.1', tag: '5.1', num: '5.1', title: 'Regular and periodic problems', chapter: 'Chapter 5 · Sturm–Liouville', skills: ['sl', 'sl-form', 'sl-expand'], lesson: L51 },
    { id: '5.2', tag: '5.2', num: '5.2', title: 'Singular problems', chapter: 'Chapter 5 · Sturm–Liouville', skills: ['bessel-eig', 'membrane'], lesson: L52 },
    { id: '6.1', tag: '6.1', num: '6.1', title: 'The Fourier transform', chapter: 'Chapter 6 · Fourier transform', skills: ['ft-basic'], lesson: L61 },
    { id: '6.2', tag: '6.2', num: '6.2', title: 'Applications to PDEs', chapter: 'Chapter 6 · Fourier transform', skills: ['ft-heat'], lesson: L62 },
  ],
  sectionOrder: ['1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '3.1', '3.2', '4.1', '4.2', '4.3', '5.1', '5.2', '6.1', '6.2'],
});
