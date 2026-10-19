// MATH 3705 — Chapter 3 (Fourier series) and Chapter 4 (PDEs): sections 3.1, 3.2, 4.1, 4.2, 4.3.
const { R, pick, randInt, rand, nz, nf, rnd } = SA;
const sampN = () => () => ({ n: randInt(1, 9) });
const simpson = (g, a, b, n = 1000) => { const h = (b - a) / n; let s = g(a) + g(b); for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * g(a + i * h); return (s * h) / 3; };
const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const Ls = [{ v: Math.PI, tex: '\\pi', e: 'pi' }, { v: 1, tex: '1', e: '1' }, { v: 2, tex: '2', e: '2' }, { v: 3, tex: '3', e: '3' }];
const argT = (L, m = 'n') => (L.e === 'pi' ? `${m}x` : L.e === '1' ? `${m}\\pi x` : `\\frac{${m}\\pi x}{${L.tex}}`);
const kx = (k, v) => (k === 1 ? v : k === -1 ? `-${v}` : `${k}${v}`);
// numeric Fourier coefficient checks for b_n / a_n on [lo, hi] with weight 2/L or 1/L
const coefCheck = (q, f, kind, L, lo, scale) => () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const trig = kind === 'b' ? (x) => Math.sin((n * Math.PI * x) / L) : (x) => Math.cos((n * Math.PI * x) / L);
    const g = (x) => f(x) * trig(x), mid = (lo + L) / 2;
    const num = scale * (simpson(g, lo, mid - 1e-12, 2000) + simpson(g, mid + 1e-12, L, 2000));
    const want = SA.evaluate(SA.parse(q.answer, ['n']), { n });
    if (!near(num, want, 1e-5)) return `n=${n}: numeric ${num} vs ${want}`;
  }
  return true;
};

/* ---------- 3.1 ---------- */
function genFourConv() {
  const L = pick(Ls), a = nz(-3, 3), b = nz(-4, 4), lin = Math.random() < 0.5;
  const Lv = L.v, isPi = L.e === 'pi';
  const right = (x) => (lin ? b * x : b);
  const rTex = lin ? kx(b, 'x') : String(b);
  const fL = (x) => (x < 0 ? a : right(x));
  const at = pick(['zero', 'end', 'inside', 'shift']);
  let x0, x0Tex, num, expr, tex, why;
  if (at === 'zero') { x0 = 0; x0Tex = '0'; num = (a + right(0)) / 2; why = `a jump: $\\tfrac12[f(0^-) + f(0^+)] = \\tfrac12(${a} + ${nf(right(0))})$`; }
  else if (at === 'end') {
    x0 = Lv; x0Tex = L.tex; num = (right(Lv) + a) / 2;
    if (lin && isPi) { expr = `(${b}*pi+(${a}))/2`; tex = `\\frac{${b}\\pi ${a < 0 ? '-' : '+'} ${Math.abs(a)}}{2}`; }
    why = `an endpoint, where the periodic extension jumps from $f(${L.tex}^-) = ${lin ? (isPi ? kx(b, '\\pi') : nf(b * Lv)) : b}$ to $f(-${L.tex}^+) = ${a}$; the series gives their average`;
  } else if (at === 'inside') {
    x0 = Lv / 2; x0Tex = isPi ? '\\frac{\\pi}{2}' : nf(Lv / 2); num = right(Lv / 2);
    if (lin && isPi) { expr = `${b}*pi/2`; tex = `\\frac{${b}\\pi}{2}`; }
    why = `a point where $f$ is continuous, so the series equals $f(${x0Tex})$`;
  } else {
    x0 = 1.5 * Lv; x0Tex = isPi ? '\\frac{3\\pi}{2}' : nf(1.5 * Lv); num = a;
    why = `outside $(-${L.tex}, ${L.tex})$; subtract the period: $${x0Tex} - ${isPi ? '2\\pi' : 2 * Lv} = -${isPi ? '\\frac{\\pi}{2}' : nf(Lv / 2)}$, where $f = ${a}$`;
  }
  if (!expr) { expr = String(rnd(num)); tex = nf(num); }
  const alt = (v) => String(rnd(v));
  const mistakes = [];
  if (at === 'zero') mistakes.push({ expr: String(a), step: 'thm', why: 'At a jump the series takes the average of the two one-sided limits.' }, { expr: alt(right(0)), step: 'thm', why: 'At a jump the series takes the average of the two one-sided limits.' });
  if (at === 'end') mistakes.push({ expr: lin && isPi ? `${b}*pi` : alt(right(Lv)), step: 'pt', why: 'The endpoints are jump points of the periodic extension: average $f(L^-)$ with $f(-L^+)$.' }, { expr: lin && isPi ? `${b}*pi/2` : alt(right(Lv) / 2), step: 'pt', why: 'Average with $f(-L^+)$, not with 0.' });
  if (at === 'shift') mistakes.push({ expr: alt(right(Lv / 2)), step: 'pt', why: 'Shift by the period $2L$ first: the point lands in $(-L, 0)$.' });
  if (at === 'inside') mistakes.push({ expr: alt((a + num) / 2), step: 'thm', why: 'Only jump points get averaged; here $f$ is continuous.' });
  return {
    points: 15,
    prompt: `$f(x) = \\begin{cases}${a}, & -${L.tex}<x<0\\\\ ${rTex}, & 0<x<${L.tex}\\end{cases}$ is extended with period $${isPi ? '2\\pi' : 2 * Lv}$. To what value does its Fourier series converge at $x = ${x0Tex}$?`,
    vars: [], sample: () => ({}), tol: 1e-6, hint: 'Enter a number (pi is allowed).',
    answer: expr, answerTex: tex,
    figure: { kind: 'plot', x: [-3 * Lv, 3 * Lv], y: 'auto', xLabel: 'x', curves: [{ fn: (x) => fL(((((x + Lv) % (2 * Lv)) + 2 * Lv) % (2 * Lv)) - Lv), label: 'periodic extension' }], vlines: [{ x: x0, label: 'x₀' }] },
    verify: { kind: 'self' },
    selfCheck() { const got = SA.evaluate(SA.parse(expr, []), {}); return near(got, num, 1e-9) ? true : `${got} vs ${num}`; },
    steps: [
      { key: 'thm', title: 'Fourier convergence theorem', body: R`For piecewise smooth $f$, the series converges to $\tfrac12[f(x^-) + f(x^+)]$ at every $x$: the value of $f$ where it is continuous, the midpoint of the jump where it is not.` },
      { key: 'pt', title: 'Look at the point', body: `$x = ${x0Tex}$ is ${why}.` },
      { key: 'res', title: 'Value', body: `The series converges to $${tex}$.` },
    ],
    mistakes,
  };
}

function genFourParity() {
  const fs = [
    { tex: 'x^2', p: 'even' }, { tex: 'x^3', p: 'odd' }, { tex: '|x|', p: 'even' }, { tex: 'x\\cos x', p: 'odd' }, { tex: 'x\\sin x', p: 'even' },
    { tex: 'e^{x}', p: 'neither' }, { tex: '\\sin^2 x', p: 'even' }, { tex: 'x + x^2', p: 'neither' }, { tex: 'x|x|', p: 'odd' }, { tex: '\\cos 3x', p: 'even' },
  ];
  const f = pick(fs);
  const opts = [
    { tex: 'Only cosines (and $a_0$): every $b_n = 0$', correct: f.p === 'even', why: f.p === 'even' ? '' : `$${f.tex}$ is not even.`, step: 'par' },
    { tex: 'Only sines: every $a_n = 0$, including $a_0$', correct: f.p === 'odd', why: f.p === 'odd' ? '' : `$${f.tex}$ is not odd.`, step: 'par' },
    { tex: 'Both sines and cosines in general', correct: f.p === 'neither', why: f.p === 'neither' ? '' : `$${f.tex}$ is ${f.p}, so half the coefficients vanish.`, step: 'par' },
  ];
  return {
    points: 10, type: 'choice',
    prompt: `On $-\\pi < x < \\pi$, which terms can appear in the Fourier series of $f(x) = ${f.tex}$?`,
    options: opts, answerTex: { even: 'Only cosines', odd: 'Only sines', neither: 'Both' }[f.p], hint: 'Check f(−x).',
    steps: [
      { key: 'test', title: 'Test f(−x)', body: `${f.p === 'even' ? `$f(-x) = f(x)$: even.` : f.p === 'odd' ? `$f(-x) = -f(x)$: odd.` : 'Neither $f(-x) = f(x)$ nor $f(-x) = -f(x)$ holds.'}` },
      { key: 'par', title: 'Which integrals vanish', body: R`Even × odd is odd, and an odd integrand integrates to 0 over $(-L, L)$. Even $f$: $b_n = \frac1L\int f\sin = 0$. Odd $f$: $a_n = \frac1L\int f\cos = 0$.` },
    ],
    mistakes: [],
  };
}

/* ---------- 3.2 ---------- */
function genHalfRange() {
  const L = pick(Ls), k = nz(-4, 4), kind = pick(['sin-const', 'sin-x', 'cos-x', 'sin-x', 'cos-const-step']);
  const Lv = L.v, Le = L.e, Lt = L.tex;
  let f, fTex, ser, coef, ans, ansTex, steps, mistakes;
  const arg = argT(L);
  if (kind === 'sin-const') {
    f = () => k; fTex = String(k); ser = 'sine'; coef = 'b';
    ans = `2*${k}*(1-(-1)^n)/(n*pi)`; ansTex = `\\frac{${2 * k}\\left(1-(-1)^n\\right)}{n\\pi}`;
    steps = [
      { key: 'ext', title: 'Odd extension', body: `A sine series means extending $f$ as an odd function to $(-${Lt}, ${Lt})$, so $b_n = \\frac{2}{${Lt}}\\int_0^{${Lt}} f(x)\\sin ${arg}\\,dx$.` },
      { key: 'int', title: 'Integrate', body: `$b_n = \\frac{2}{${Lt}}\\cdot${k}\\left[-\\frac{${Lt}}{n\\pi}\\cos ${arg}\\right]_0^{${Lt}} = \\frac{${2 * k}}{n\\pi}\\left(1-\\cos n\\pi\\right)$` },
      { key: 'res', title: 'Use cos nπ = (−1)ⁿ', body: `$b_n = ${ansTex}$, which is $\\frac{${4 * k}}{n\\pi}$ for odd $n$ and 0 for even $n$.` },
    ];
    mistakes = [
      { expr: `${k}*(1-(-1)^n)/(n*pi)`, step: 'ext', why: `The half-range formula has $\\frac{2}{L}$, not $\\frac1L$.` },
      { expr: `2*${k}*((-1)^n-1)/(n*pi)`, step: 'int', why: 'Sign slip: $-\\cos$ evaluated from 0 to $L$ gives $1 - \\cos n\\pi$.' },
    ];
  } else if (kind === 'sin-x') {
    f = (x) => k * x; fTex = kx(k, 'x'); ser = 'sine'; coef = 'b';
    ans = `2*${k}*${Le}*(-1)^(n+1)/(n*pi)`; ansTex = `\\frac{${2 * k}${Le === '1' ? '' : Le === 'pi' ? '\\pi' : '\\cdot' + Lt}(-1)^{n+1}}{n\\pi}`;
    steps = [
      { key: 'ext', title: 'Odd extension', body: `$b_n = \\frac{2}{${Lt}}\\int_0^{${Lt}} ${fTex}\\sin ${arg}\\,dx$` },
      { key: 'int', title: 'Integrate by parts', body: `$\\int_0^{L} x\\sin\\frac{n\\pi x}{L}dx = -\\frac{L^2}{n\\pi}\\cos n\\pi = \\frac{L^2(-1)^{n+1}}{n\\pi}$ (the $\\sin$ boundary term vanishes).` },
      { key: 'res', title: 'Result', body: `$b_n = \\frac{2}{L}\\cdot${k}\\cdot\\frac{L^2(-1)^{n+1}}{n\\pi} = ${ansTex}$` },
    ];
    mistakes = [
      { expr: `2*${k}*${Le}*(-1)^n/(n*pi)`, step: 'int', why: '$-\\cos n\\pi = -(-1)^n = (-1)^{n+1}$; the sign alternates starting positive.' },
      { expr: `${k}*${Le}*(-1)^(n+1)/(n*pi)`, step: 'ext', why: 'Half-range coefficients use $\\frac{2}{L}$.' },
    ];
  } else if (kind === 'cos-x') {
    f = (x) => k * x; fTex = kx(k, 'x'); ser = 'cosine'; coef = 'a';
    ans = `2*${k}*${Le}*((-1)^n-1)/(n^2*pi^2)`; ansTex = `\\frac{${2 * k}${Le === '1' ? '' : Le === 'pi' ? '\\pi' : '\\cdot' + Lt}\\left((-1)^n-1\\right)}{n^2\\pi^2}`;
    steps = [
      { key: 'ext', title: 'Even extension', body: `A cosine series extends $f$ evenly: $a_n = \\frac{2}{${Lt}}\\int_0^{${Lt}} ${fTex}\\cos ${arg}\\,dx$, $n \\ge 1$.` },
      { key: 'int', title: 'Integrate by parts', body: `$\\int_0^L x\\cos\\frac{n\\pi x}{L}dx = \\frac{L^2}{n^2\\pi^2}\\left(\\cos n\\pi - 1\\right)$` },
      { key: 'res', title: 'Result', body: `$a_n = ${ansTex}$: zero for even $n$.` },
    ];
    mistakes = [
      { expr: `2*${k}*${Le}*(1-(-1)^n)/(n^2*pi^2)`, step: 'int', why: 'The bracket is $\\cos n\\pi - \\cos 0 = (-1)^n - 1$.' },
      { expr: `2*${k}*${Le}*(-1)^(n+1)/(n*pi)`, step: 'ext', why: 'That is the sine-series coefficient. A cosine series uses $\\cos\\frac{n\\pi x}{L}$.' },
    ];
  } else {
    // f = k on (0, L/2), 0 on (L/2, L): cosine series a_n = 2k sin(nπ/2)/(nπ)
    f = (x) => (x < Lv / 2 ? k : 0); fTex = `\\begin{cases}${k}, & 0<x<\\frac{${Lt}}{2}\\\\ 0, & \\frac{${Lt}}{2}<x<${Lt}\\end{cases}`; ser = 'cosine'; coef = 'a';
    ans = `2*${k}*sin(n*pi/2)/(n*pi)`; ansTex = `\\frac{${2 * k}\\sin\\frac{n\\pi}{2}}{n\\pi}`;
    steps = [
      { key: 'ext', title: 'Even extension', body: `$a_n = \\frac{2}{${Lt}}\\int_0^{${Lt}/2} ${k}\\cos ${arg}\\,dx$` },
      { key: 'int', title: 'Integrate', body: `$= \\frac{2}{${Lt}}\\cdot${k}\\cdot\\frac{${Lt}}{n\\pi}\\sin\\frac{n\\pi}{2} = ${ansTex}$` },
    ];
    mistakes = [
      { expr: `${k}*sin(n*pi/2)/(n*pi)`, step: 'ext', why: 'Half-range coefficients use $\\frac{2}{L}$.' },
      { expr: `2*${k}*(1-cos(n*pi/2))/(n*pi)`, step: 'int', why: 'The antiderivative of $\\cos$ is $\\sin$: you integrated a sine.' },
    ];
  }
  const q = {
    points: 20,
    prompt: `Expand $f(x) = ${fTex}$ on $0 < x < ${Lt}$ in a Fourier ${ser} series. Find $${coef}_n$ for $n \\ge 1$.`,
    vars: ['n'], sample: sampN(), hint: 'Answer in terms of n. Write (-1)^n for cos(nπ).',
    answer: ans, answerTex: `${coef}_n = ${ansTex}`, steps, mistakes, verify: { kind: 'self' },
    figure: { kind: 'plot', x: [-Lv, Lv], y: 'auto', xLabel: 'x', curves: [{ fn: (x) => (x >= 0 ? f(x) : ser === 'sine' ? -f(-x) : f(-x)), label: `${ser === 'sine' ? 'odd' : 'even'} extension` }], vlines: [{ x: 0 }] },
  };
  q.selfCheck = coefCheck(q, f, coef, Lv, 0, 2 / Lv);
  return q;
}

/* ---------- 4.1 ---------- */
function genHeatLimit() {
  const L = pick([Ls[1], Ls[2], Ls[3], { v: 4, tex: '4', e: '4' }]), Lv = L.v;
  if (Math.random() < 0.55) {
    const A = randInt(0, 50), B = randInt(0, 100);
    const ans = `${A}+${B - A}*x/${Lv}`;
    return {
      points: 15,
      prompt: `$u_{xx} = \\frac{1}{\\alpha^2}u_t$ on $0<x<${L.tex}$ with $u(0,t) = ${A}$, $u(${L.tex},t) = ${B}$ and some initial temperature $f(x)$. Find the steady-state temperature $\\lim_{t\\to\\infty}u(x,t)$.`,
      vars: ['x'], sample: () => ({ x: rand(0, Lv) }), hint: 'Answer in terms of x.',
      answer: ans, answerTex: `u_s(x) = ${A} ${B - A < 0 ? '-' : '+'} \\frac{${Math.abs(B - A)}x}{${L.tex}}`,
      verify: { kind: 'self' }, selfCheck() { const g = (x) => SA.evaluate(SA.parse(ans, ['x']), { x }); return near(g(0), A) && near(g(Lv), B) && near(g(Lv / 2), (A + B) / 2) ? true : 'bad steady state'; },
      figure: { kind: 'plot', x: [0, Lv], y: 'auto', xLabel: 'x', curves: [{ fn: (x) => A + ((B - A) * x) / Lv, label: 'steady state' }] },
      steps: [
        { key: 'ss', title: 'Steady state solves u″ = 0', body: R`When $u_t = 0$ the PDE becomes $u_s''(x) = 0$, so $u_s = c_1 + c_2x$: a straight line between the end temperatures.` },
        { key: 'bc', title: 'Fit the boundary values', body: `$u_s(0) = ${A}$ and $u_s(${L.tex}) = ${B}$ give $u_s(x) = ${A} + \\frac{${B - A}}{${L.tex}}x$. The transient $v = u - u_s$ has zero boundary values and decays to 0.` },
      ],
      mistakes: [
        { expr: String((A + B) / 2), step: 'ss', why: 'The steady state is a straight line between the end values, not a single average (that is the insulated-end case).' },
        { expr: `${B}+${A - B}*x/${Lv}`, step: 'bc', why: `Swapped ends: $u_s(0)$ must be ${A}.` },
        { expr: '0', step: 'ss', why: 'With nonzero end temperatures the bar does not cool to 0.' },
      ],
    };
  }
  const k = randInt(1, 6), m = randInt(1, 4), c = randInt(0, 30);
  const fTex = `${c} + ${k}x`, ans = c + (k * Lv) / 2;
  return {
    points: 15,
    prompt: `A bar $0<x<${L.tex}$ has insulated ends ($u_x(0,t) = u_x(${L.tex},t) = 0$) and initial temperature $u(x,0) = ${fTex}$. What temperature does the whole bar approach as $t \\to \\infty$?`,
    vars: [], sample: () => ({}), tol: 1e-6, hint: 'Enter a number.',
    answer: String(ans), answerTex: `${nf(ans)}`,
    verify: { kind: 'self' }, selfCheck() { const avg = simpson((x) => c + k * x, 0, Lv) / Lv; return near(avg, ans) ? true : `${avg} vs ${ans}`; },
    steps: [
      { key: 'sol', title: 'Insulated-end solution', body: R`$u(x,t) = \frac{a_0}{2} + \sum_{n\ge1} a_n e^{-\alpha^2 n^2\pi^2 t/L^2}\cos\frac{n\pi x}{L}$. Every term with $n \ge 1$ decays.` },
      { key: 'avg', title: 'What is left is the average', body: `$\\frac{a_0}{2} = \\frac{1}{L}\\int_0^L f(x)\\,dx = \\frac{1}{${L.tex}}\\left(${c}\\cdot${L.tex} + \\frac{${k}\\cdot${L.tex}^2}{2}\\right) = ${nf(ans)}$. No heat leaves, so it spreads out evenly.` },
    ],
    mistakes: [
      { expr: '0', step: 'sol', why: 'Insulated ends keep the heat in; the $n = 0$ term does not decay.' },
      { expr: String(2 * ans), step: 'avg', why: `$a_0 = \\frac{2}{L}\\int f$, and the constant term is $\\frac{a_0}{2}$.` },
      { expr: String(c), step: 'avg', why: 'That is the initial temperature at $x = 0$, not the average over the bar.' },
    ],
  };
}

/* ---------- 4.2 ---------- */
function genWaveVel() {
  const L = pick([Ls[0], Ls[1], Ls[2]]), Lv = L.v, c = randInt(1, 3), k = nz(-3, 3);
  const ans = `2*${k}*${L.e}*(1-(-1)^n)/(n^2*pi^2*${c})`;
  const q = {
    points: 20,
    prompt: `A string $0<x<${L.tex}$ with fixed ends satisfies $u_{xx} = \\frac{1}{${c * c}}u_{tt}$, starts flat ($u(x,0) = 0$) and is struck so that $u_t(x,0) = ${k}$. With $u = \\sum B_n\\sin\\frac{n${c === 1 ? '' : c}\\pi t}{${L.tex}}\\sin\\frac{n\\pi x}{${L.tex}}$${L.e === 'pi' ? ' (here $\\frac{n\\pi x}{\\pi} = nx$)' : ''}, find $B_n$.`,
    vars: ['n'], sample: sampN(), hint: 'Answer in terms of n; write (-1)^n for cos(nπ).',
    answer: ans, answerTex: `B_n = \\frac{${2 * k}${L.e === '1' ? '' : L.e === 'pi' ? '\\pi' : '\\cdot' + L.tex}\\left(1-(-1)^n\\right)}{${c === 1 ? '' : c}n^2\\pi^2}`,
    verify: { kind: 'self' },
    steps: [
      { key: 'ut', title: 'Differentiate in t at t = 0', body: `$u_t(x,0) = \\sum B_n\\frac{n${c === 1 ? '' : c}\\pi}{${L.tex}}\\sin\\frac{n\\pi x}{${L.tex}} = ${k}$` },
      { key: 'coef', title: 'Sine coefficients of the initial velocity', body: `$B_n\\frac{n${c === 1 ? '' : c}\\pi}{${L.tex}} = \\frac{2}{${L.tex}}\\int_0^{${L.tex}} ${k}\\sin\\frac{n\\pi x}{${L.tex}}dx = \\frac{${2 * k}(1-(-1)^n)}{n\\pi}$` },
      { key: 'solve', title: 'Divide by the frequency factor', body: `$B_n = \\frac{${L.tex}}{n${c === 1 ? '' : c}\\pi}\\cdot\\frac{${2 * k}(1-(-1)^n)}{n\\pi}$` },
    ],
    mistakes: [
      { expr: `2*${k}*(1-(-1)^n)/(n*pi)`, step: 'solve', why: `That is the sine coefficient of $u_t(x,0)$. Divide it by $\\frac{nc\\pi}{L}$, which came from differentiating $\\sin\\frac{nc\\pi t}{L}$.` },
      { expr: `2*${k}*${L.e}*(1-(-1)^n)/(n^2*pi^2)`, step: 'solve', why: `The factor from $\\frac{d}{dt}$ includes $c = ${c}$.` },
    ],
  };
  if (c === 1) q.mistakes.pop();
  q.selfCheck = () => { for (const n of [1, 2, 3]) { const sc = (2 / Lv) * simpson((x) => k * Math.sin((n * Math.PI * x) / Lv), 0, Lv, 2000) / ((n * c * Math.PI) / Lv); const w = SA.evaluate(SA.parse(ans, ['n']), { n }); if (!near(sc, w, 1e-6)) return `n=${n}`; } return true; };
  return q;
}

/* ---------- 4.3 ---------- */
function genLapDisk() {
  const Rv = pick([1, 2, 3]), inside = Math.random() < 0.7;
  const A = randInt(0, 5), m = randInt(1, 3), B = nz(-4, 4), j = pick([1, 2, 3].filter((x) => x !== m)), C = nz(-3, 3);
  const fTex = `${A ? A + ' ' : ''}${B < 0 ? '-' : A ? '+' : ''} ${Math.abs(B) === 1 ? '' : Math.abs(B)}\\cos ${m === 1 ? '' : m}\\theta ${C < 0 ? '-' : '+'} ${Math.abs(C) === 1 ? '' : Math.abs(C)}\\sin ${j === 1 ? '' : j}\\theta`;
  const rp = (k) => (inside ? `(r/${Rv})^${k}` : `(${Rv}/r)^${k}`);
  const ans = `${A}+${B}*${rp(m)}*cos(${m}*th)+${C}*${rp(j)}*sin(${j}*th)`;
  const ex = (k) => (k === 1 ? '' : `^{${k}}`);
  const rpT = (k) => (inside ? (Rv === 1 ? `r${ex(k)}` : `\\left(\\frac{r}{${Rv}}\\right)${ex(k)}`) : `\\left(\\frac{${Rv}}{r}\\right)${ex(k)}`);
  const ansTex = `${A ? A : ''} ${B < 0 ? '-' : A ? '+' : ''} ${Math.abs(B) === 1 ? '' : Math.abs(B)}${rpT(m)}\\cos ${m === 1 ? '' : m}\\theta ${C < 0 ? '-' : '+'} ${Math.abs(C) === 1 ? '' : Math.abs(C)}${rpT(j)}\\sin ${j === 1 ? '' : j}\\theta`;
  const u = (r, th) => SA.evaluate(SA.parse(ans, ['r', 'th']), { r, th });
  return {
    points: 20,
    prompt: `Solve Laplace's equation ${inside ? 'inside' : 'outside'} the circle $r = ${Rv}$ (bounded solution) with $u(${Rv},\\theta) = ${fTex}$.`,
    vars: ['r', 'th'], varTex: { th: '\\theta ' }, sample: () => ({ r: inside ? rand(0.1, Rv) : rand(Rv, 3 * Rv), th: rand(0, 6.28) }), hint: 'Answer in r and θ (type th or θ).',
    answer: ans, answerTex: `u = ${ansTex}`, verify: { kind: 'self' },
    selfCheck() {
      const h = 1e-3;
      for (const [r, th] of [[inside ? 0.6 * Rv : 1.7 * Rv, 0.7], [inside ? 0.3 * Rv : 2.4 * Rv, 2.1]]) {
        const urr = (u(r + h, th) - 2 * u(r, th) + u(r - h, th)) / (h * h), ur = (u(r + h, th) - u(r - h, th)) / (2 * h), utt = (u(r, th + h) - 2 * u(r, th) + u(r, th - h)) / (h * h);
        if (Math.abs(urr + ur / r + utt / (r * r)) > 1e-3) return 'not harmonic';
      }
      for (const th of [0.3, 1.9]) if (!near(u(Rv, th), A + B * Math.cos(m * th) + C * Math.sin(j * th), 1e-9)) return 'boundary';
      return true;
    },
    steps: [
      { key: 'sep', title: 'Separated solutions', body: inside ? R`Bounded at the centre: $u = \frac{a_0}{2} + \sum r^n(a_n\cos n\theta + b_n\sin n\theta)$ (the $r^{-n}$ and $\ln r$ terms blow up at $r = 0$).` : R`Bounded as $r\to\infty$: $u = \frac{a_0}{2} + \sum r^{-n}(a_n\cos n\theta + b_n\sin n\theta)$ (the $r^{n}$ and $\ln r$ terms blow up).` },
      { key: 'match', title: 'Match the boundary term by term', body: `Each $\\cos n\\theta$ or $\\sin n\\theta$ on the boundary is scaled by $${inside ? '(r/R)^n' : '(R/r)^n'}$ so that it equals the boundary value at $r = ${Rv}$.` },
      { key: 'res', title: 'Solution', body: `$u(r,\\theta) = ${ansTex}$` },
    ],
    mistakes: [
      { expr: `${A}+${B}*${inside ? `(${Rv}/r)^${m}` : `(r/${Rv})^${m}`}*cos(${m}*th)+${C}*${inside ? `(${Rv}/r)^${j}` : `(r/${Rv})^${j}`}*sin(${j}*th)`, step: 'sep', why: inside ? 'Inside the circle the solution must stay finite at $r = 0$, so use positive powers of $r$.' : 'Outside the circle the solution must stay bounded as $r\\to\\infty$, so use negative powers of $r$.' },
      ...(Rv !== 1 ? [{ expr: `${A}+${B}*r^${inside ? m : -m}*cos(${m}*th)+${C}*r^${inside ? j : -j}*sin(${j}*th)`, step: 'match', why: `Scale by $R^n$: at $r = ${Rv}$ the term must equal the boundary coefficient.` }] : []),
      { expr: `${A}+${B}*${rp(1)}*cos(${m}*th)+${C}*${rp(1)}*sin(${j}*th)`, step: 'match', why: 'Each mode $n$ gets its own power $r^{\\pm n}$, not the first power.' },
    ],
  };
}

function genLapRect() {
  const a = pick([1, 2, Math.PI]), aT = a === Math.PI ? '\\pi' : String(a), aE = a === Math.PI ? 'pi' : String(a);
  const b = pick([1, 2]), m = randInt(1, 3), k = nz(-5, 5);
  const side = pick(['top', 'bottom']);
  const argx = a === Math.PI ? `${m}*x` : `${m}*pi*x/${aE}`;
  const argT = a === Math.PI ? `${m === 1 ? '' : m}x` : `\\frac{${m === 1 ? '' : m}\\pi x}{${aT}}`;
  const sh = (y) => (a === Math.PI ? `${m}*(${y})` : `${m}*pi*(${y})/${aE}`);
  const shT = (y) => (a === Math.PI ? `${m === 1 ? '' : m}${y}` : `\\frac{${m === 1 ? '' : m}\\pi ${y}}{${aT}}`);
  const yy = side === 'top' ? 'y' : `${b}-y`, yyT = side === 'top' ? 'y' : `(${b}-y)`;
  const ans = `${k}*sinh(${sh(yy)})/sinh(${sh(b)})*sin(${argx})`;
  const u = (x, y) => SA.evaluate(SA.parse(ans, ['x', 'y']), { x, y });
  return {
    points: 20,
    prompt: `Solve $u_{xx} + u_{yy} = 0$ in $0<x<${aT}$, $0<y<${b}$ with $u = 0$ on three sides and $u(x, ${side === 'top' ? b : 0}) = ${k}\\sin ${argT}$.`,
    vars: ['x', 'y'], sample: () => ({ x: rand(0, a), y: rand(0, b) }), hint: 'Answer in x and y; sinh is available.',
    answer: ans, answerTex: `u = ${k}\\,\\frac{\\sinh ${shT(yyT)}}{\\sinh ${shT(b)}}\\sin ${argT}`, verify: { kind: 'self' },
    selfCheck() {
      const h = 1e-3;
      for (const [x, y] of [[0.3 * a, 0.4 * b], [0.7 * a, 0.8 * b]]) { const lap = (u(x + h, y) - 2 * u(x, y) + u(x - h, y) + u(x, y + h) - 2 * u(x, y) + u(x, y - h)) / (h * h); if (Math.abs(lap) > 2e-3) return 'not harmonic'; }
      const yb = side === 'top' ? b : 0, y0 = side === 'top' ? 0 : b;
      if (!near(u(0.37 * a, yb), k * Math.sin((m * Math.PI * 0.37 * a) / a), 1e-8) || Math.abs(u(0.5 * a, y0)) > 1e-9 || Math.abs(u(0, 0.5 * b)) > 1e-9) return 'boundary';
      return true;
    },
    steps: [
      { key: 'x', title: 'X(x) from the zero sides in x', body: `$u = 0$ at $x = 0$ and $x = ${aT}$ give $X = \\sin\\frac{n\\pi x}{${aT}}$; only $n = ${m}$ is needed to match the data.` },
      { key: 'y', title: 'Y(y) vanishing on the opposite side', body: `$Y'' = \\left(\\frac{n\\pi}{a}\\right)^2Y$, and $Y = 0$ at $y = ${side === 'top' ? 0 : b}$ gives $Y = \\sinh ${shT(yyT)}$.` },
      { key: 'norm', title: 'Normalize on the loaded side', body: `Divide by $\\sinh ${shT(b)}$ so that $u(x, ${side === 'top' ? b : 0}) = ${k}\\sin ${argT}$ exactly.` },
    ],
    mistakes: [
      { expr: `${k}*sinh(${sh(side === 'top' ? `${b}-y` : 'y')})/sinh(${sh(b)})*sin(${argx})`, step: 'y', why: `$Y$ must vanish on the side opposite the loaded one ($y = ${side === 'top' ? 0 : b}$).` },
      { expr: `${k}*sinh(${sh(yy)})*sin(${argx})`, step: 'norm', why: `Divide by $\\sinh ${shT(b)}$ so the boundary condition is met.` },
      { expr: `${k}*cosh(${sh(yy)})/cosh(${sh(b)})*sin(${argx})`, step: 'y', why: '$\\cosh$ never vanishes, so it cannot satisfy $u = 0$ on the opposite side.' },
    ],
  };
}

/* ---------- lessons ---------- */
const sq = (x, N) => { let s = 0; for (let k = 1; k <= N; k++) { const n = 2 * k - 1; s += Math.sin(n * x) / n; } return (4 / Math.PI) * s; };
const L31 = [
  { type: 'text', kind: 'key', title: 'Fourier series', body: R`A $2L$-periodic $f$ is written as $$f(x) = \frac{a_0}{2} + \sum_{n=1}^\infty\left(a_n\cos\frac{n\pi x}{L} + b_n\sin\frac{n\pi x}{L}\right)$$ with $a_n = \frac1L\int_{-L}^L f\cos\frac{n\pi x}{L}dx$ and $b_n = \frac1L\int_{-L}^L f\sin\frac{n\pi x}{L}dx$.` },
  { type: 'text', kind: 'method', title: 'Why the formulas work: orthogonality', body: R`$\int_{-L}^L \cos\frac{n\pi x}{L}\cos\frac{m\pi x}{L}dx = 0$ for $n\ne m$ (and $L$ for $n = m$), sines likewise, and every sine is orthogonal to every cosine. Multiplying the series by one basis function and integrating picks out one coefficient.` },
  {
    type: 'graph', title: 'Build a square wave from sines',
    body: R`$f = -1$ on $(-\pi, 0)$, $+1$ on $(0,\pi)$ has $b_n = \frac{2(1-(-1)^n)}{n\pi}$: only odd $n$. Add terms and watch the partial sum approach $f$.`,
    widget: {
      params: [{ key: 'N', label: 'odd terms used', min: 1, max: 40, step: 1, value: 3 }],
      x: [-2 * Math.PI, 2 * Math.PI], y: [-1.5, 1.5], xLabel: 'x', samples: 900,
      curves: (p) => [{ fn: (x) => Math.sign(Math.sin(x)), label: 'f', color: 1, dash: true }, { fn: (x) => sq(x, p.N), label: `S (${p.N} terms)` }],
      readout: (p) => `Overshoot near the jump: $${(Math.max(...Array.from({ length: 400 }, (_, i) => sq((i + 0.5) * Math.PI / 400 / 2, p.N)))).toFixed(3)}$ (Gibbs: about 1.179 no matter how many terms). At $x = 0$ the sum is exactly $0$, the average of the jump.`,
    },
  },
  { type: 'example', title: 'Worked example: square wave coefficients', prompt: R`$f = -1$ on $(-\pi,0)$, $1$ on $(0,\pi)$.`, steps: [
    R`$f$ is odd, so $a_n = 0$ for all $n$.`,
    R`$b_n = \frac{1}{\pi}\int_{-\pi}^{\pi}f\sin nx\,dx = \frac{2}{\pi}\int_0^\pi \sin nx\,dx = \frac{2}{n\pi}(1 - \cos n\pi)$.`,
    R`$b_n = \frac{4}{n\pi}$ for odd $n$, $0$ for even $n$: $f = \frac4\pi\left(\sin x + \frac{\sin 3x}{3} + \frac{\sin 5x}{5} + \cdots\right)$.`,
  ] },
  { type: 'text', kind: 'key', title: 'Convergence theorem', body: R`For piecewise smooth $f$, the series converges to $\tfrac12[f(x^-) + f(x^+)]$: equal to $f(x)$ where $f$ is continuous, the midpoint of any jump, including the jump at $\pm L$ created by the periodic extension.` },
  { type: 'quiz', prompt: R`$f = 0$ on $(-1,0)$, $f = x + 2$ on $(0,1)$, period 2. The series at $x = 1$ converges to`, options: [
    { tex: '$\\tfrac32$', correct: true },
    { tex: '$3$', why: 'At $x = 1$ the periodic extension jumps from $f(1^-) = 3$ to $f(-1^+) = 0$.' },
    { tex: '$1$', why: 'Average $f(1^-) = 3$ with $f(-1^+) = 0$.' },
  ], explain: R`$\tfrac12(3 + 0) = \tfrac32$.` },
  { type: 'text', kind: 'method', title: 'Even and odd shortcuts', body: R`Even $f$ ($f(-x) = f(x)$): $b_n = 0$, $a_n = \frac2L\int_0^L f\cos$. Odd $f$: $a_n = 0$, $b_n = \frac2L\int_0^L f\sin$. Check parity first; it halves the work.` },
  { type: 'input', prompt: R`For $f(x) = x$ on $(-\pi, \pi)$, $b_n = \frac{2(-1)^{n+1}}{n}$. What is $b_3$?`, answer: '2/3', explain: R`$\frac{2(-1)^4}{3} = \frac23$.` },
];
const L32 = [
  { type: 'text', kind: 'key', title: 'Functions on [0, L] only', body: R`If $f$ is given only on $0<x<L$, extend it to $(-L, L)$ and then periodically. The extension you choose decides which series you get.` },
  {
    type: 'graph', title: 'Odd vs even extension',
    body: R`$f(x) = x$ on $(0, 2)$. The odd extension gives a sine series (with jumps at $\pm2$); the even extension gives a cosine series (continuous, so its coefficients fall off like $1/n^2$).`,
    widget: {
      params: [{ key: 'N', label: 'terms', min: 1, max: 25, step: 1, value: 4 }, { key: 'odd', label: 'odd (1) or even (0)', min: 0, max: 1, step: 1, value: 1 }],
      x: [-6, 6], y: [-2.6, 2.6], xLabel: 'x', samples: 700,
      curves: (p) => [
        { fn: (x) => { const y = ((((x + 2) % 4) + 4) % 4) - 2; return p.odd ? y : Math.abs(y); }, label: p.odd ? 'odd extension' : 'even extension', color: 1, dash: true },
        { fn: (x) => { let s = p.odd ? 0 : 1; for (let n = 1; n <= p.N; n++) s += p.odd ? (4 * (-1) ** (n + 1)) / (n * Math.PI) * Math.sin((n * Math.PI * x) / 2) : (4 * ((-1) ** n - 1)) / (n * n * Math.PI * Math.PI) * Math.cos((n * Math.PI * x) / 2); return s; }, label: 'partial sum' },
      ],
      readout: (p) => (p.odd ? '$b_n = \\frac{4(-1)^{n+1}}{n\\pi}$: decays like $1/n$.' : '$\\frac{a_0}{2} = 1$, $a_n = \\frac{4((-1)^n-1)}{n^2\\pi^2}$: decays like $1/n^2$.'),
    },
  },
  { type: 'text', kind: 'method', title: 'Half-range formulas', body: R`Sine series (odd extension): $b_n = \frac2L\int_0^L f(x)\sin\frac{n\pi x}{L}dx$.<br>Cosine series (even extension): $a_n = \frac2L\int_0^L f(x)\cos\frac{n\pi x}{L}dx$, $n \ge 0$.` },
  { type: 'example', title: 'Worked example: sine series of 1 on (0, π)', prompt: R`$f(x) = 1$, $0<x<\pi$.`, steps: [
    R`$b_n = \frac{2}{\pi}\int_0^\pi\sin nx\,dx = \frac{2}{n\pi}(1 - (-1)^n)$.`,
    R`So $1 = \frac{4}{\pi}\left(\sin x + \frac{\sin 3x}{3} + \cdots\right)$ on $(0,\pi)$.`,
    R`At $x = 0$ and $x = \pi$ the series gives 0 (the odd extension's jump midpoints), not 1.`,
  ] },
  { type: 'quiz', prompt: R`Which half-range series of $f(x) = x$ on $(0,L)$ converges at $x = L$ to $L$?`, options: [
    { tex: 'The cosine series', correct: true },
    { tex: 'The sine series', why: 'The odd extension jumps from $L$ to $-L$ at $x = L$, so the sine series gives 0 there.' },
    { tex: 'Both', why: 'Only the even extension is continuous at $x = L$.' },
  ] },
  { type: 'input', prompt: R`Cosine series of $f(x) = x$ on $(0, \pi)$: $a_n = \frac{2((-1)^n - 1)}{\pi n^2}$. Find $a_1$ (decimal).`, answer: '-4/pi', answerTex: '-\\frac{4}{\\pi}', explain: R`$\frac{2(-2)}{\pi} = -\frac4\pi \approx -1.273$.` },
];
const heatSum = (x, t, L = Math.PI, N = 60) => { let s = 0; for (let n = 1; n <= N; n += 2) s += (400 / (n * Math.PI)) * Math.exp((-n * n * Math.PI * Math.PI * t) / (L * L)) * Math.sin((n * Math.PI * x) / L); return s; };
const L41 = [
  { type: 'text', kind: 'key', title: 'The heat equation', body: R`$u_{xx} = \frac{1}{\alpha^2}u_t$ for the temperature $u(x,t)$ in a laterally insulated bar $0<x<L$, with an initial temperature $u(x,0) = f(x)$ and boundary conditions at $x = 0, L$.` },
  { type: 'text', kind: 'method', title: 'Separation of variables', body: R`Try $u = X(x)T(t)$: $\frac{X''}{X} = \frac{1}{\alpha^2}\frac{T'}{T} = \lambda$. Zero end temperatures force $\lambda = -\left(\frac{n\pi}{L}\right)^2$, $X_n = \sin\frac{n\pi x}{L}$, $T_n = e^{-\alpha^2n^2\pi^2t/L^2}$.<br>Then $u = \sum b_n e^{-\alpha^2n^2\pi^2t/L^2}\sin\frac{n\pi x}{L}$ with $b_n$ the sine coefficients of $f$.` },
  {
    type: 'graph', title: 'A bar cooling from 100°',
    body: R`$f = 100$ on $(0, 1)$, ends held at 0, $\alpha = 1$. High modes die first ($e^{-n^2\pi^2t}$), so the profile quickly becomes a single sine arch and then shrinks.`,
    widget: {
      params: [{ key: 't', label: 'time t', min: 0.001, max: 0.4, step: 0.001, value: 0.01, fmt: (v) => v.toFixed(3) }],
      x: [0, 1], y: [0, 120], xLabel: 'x', yLabel: 'u',
      curves: (p) => [{ fn: (x) => heatSum(x, p.t, 1), label: 'u(x, t)' }, { fn: (x) => (400 / Math.PI) * Math.exp(-Math.PI * Math.PI * p.t) * Math.sin(Math.PI * x), label: 'first mode only', dash: true, color: 1 }],
      readout: (p) => `Centre temperature $u(\\tfrac12, ${p.t.toFixed(3)}) = ${heatSum(0.5, p.t, 1).toFixed(2)}$`,
    },
  },
  { type: 'text', kind: 'key', title: 'Nonzero end temperatures (4.1.2)', body: R`With $u(0,t) = A$, $u(L,t) = B$, subtract the steady state $u_s = A + \frac{B-A}{L}x$ (it solves $u_s'' = 0$). Then $v = u - u_s$ has zero ends, and you solve for $v$ with initial value $f - u_s$.` },
  { type: 'text', kind: 'key', title: 'Insulated ends (4.1.3)', body: R`$u_x = 0$ at both ends gives cosines: $u = \frac{a_0}{2} + \sum a_n e^{-\alpha^2n^2\pi^2t/L^2}\cos\frac{n\pi x}{L}$. As $t\to\infty$, $u \to \frac{a_0}{2}$, the average initial temperature, because no heat escapes.` },
  { type: 'quiz', prompt: R`Ends held at $20$ and $80$ on a bar of length $3$. The steady-state temperature at $x = 1$ is`, options: [
    { tex: '$40$', correct: true }, { tex: '$50$', why: 'That is the midpoint value, at $x = 1.5$.' }, { tex: '$20$', why: 'Only at $x = 0$.' },
  ], explain: R`$20 + \frac{60}{3}\cdot 1 = 40$.` },
];
const L42 = [
  { type: 'text', kind: 'key', title: 'The wave equation', body: R`A vibrating string $0<x<L$ with fixed ends: $u_{xx} = \frac{1}{c^2}u_{tt}$, $u(0,t) = u(L,t) = 0$, initial shape $u(x,0) = f(x)$ and initial velocity $u_t(x,0) = g(x)$.` },
  { type: 'text', kind: 'method', title: 'Normal modes', body: R`Separation gives $u = \sum\left(A_n\cos\frac{nc\pi t}{L} + B_n\sin\frac{nc\pi t}{L}\right)\sin\frac{n\pi x}{L}$.<br>$A_n$ = sine coefficients of $f$; $B_n\frac{nc\pi}{L}$ = sine coefficients of $g$.` },
  {
    type: 'graph', title: 'Standing waves',
    body: R`Mode $n$ oscillates with angular frequency $\frac{nc\pi}{L}$ and has $n - 1$ interior nodes. Combine two modes and scrub through time.`,
    widget: {
      params: [{ key: 'n', label: 'mode n', min: 1, max: 5, step: 1, value: 2 }, { key: 'mix', label: 'add mode 1 (amount)', min: 0, max: 1, step: 0.1, value: 0 }, { key: 't', label: 'time t', min: 0, max: 2, step: 0.01, value: 0.2 }],
      x: [0, 1], y: [-2, 2], xLabel: 'x',
      curves: (p) => [{ fn: (x) => Math.cos(p.n * Math.PI * p.t) * Math.sin(p.n * Math.PI * x) + p.mix * Math.cos(Math.PI * p.t) * Math.sin(Math.PI * x), label: 'u(x, t)' }, { fn: (x) => Math.sin(p.n * Math.PI * x) + p.mix * Math.sin(Math.PI * x), label: 'u(x, 0)', dash: true, color: 1 }],
      readout: (p) => `$L = c = 1$: mode ${p.n} has period $\\frac{2L}{nc} = ${(2 / p.n).toFixed(3)}$; the whole motion repeats every $\\frac{2L}{c} = 2$.`,
    },
  },
  { type: 'example', title: 'Worked example: plucked into one mode', prompt: R`$L = \pi$, $c = 2$, $f(x) = 3\sin 2x$, $g = 0$.`, steps: [
    R`$f$ is already a single sine: $A_2 = 3$, all other $A_n = 0$; $g = 0$ gives $B_n = 0$.`,
    R`$u(x,t) = 3\cos(4t)\sin 2x$ (frequency $\frac{nc\pi}{L} = \frac{2\cdot2\pi}{\pi} = 4$).`,
  ] },
  { type: 'quiz', prompt: R`If the string starts flat with $u_t(x,0) = 5\sin 3x$ ($L = \pi$, $c = 1$), then $u =$`, options: [
    { tex: R`$\frac53\sin 3t\sin 3x$`, correct: true },
    { tex: R`$5\sin 3t\sin 3x$`, why: R`Differentiating $\sin 3t$ brings out a factor 3, so $B_3\cdot3 = 5$.` },
    { tex: R`$5\cos 3t\sin 3x$`, why: R`$\cos$ terms carry the initial shape, which is zero here.` },
  ] },
];
const L43 = [
  { type: 'text', kind: 'key', title: "Laplace's equation", body: R`$u_{xx} + u_{yy} = 0$: steady-state temperature (or potential) in a region, fixed by the boundary values alone. Solutions are called harmonic.` },
  { type: 'text', kind: 'method', title: 'Rectangles: one nonzero side at a time', body: R`With $u = 0$ on three sides, $X = \sin\frac{n\pi x}{a}$ and $Y = \sinh\frac{n\pi y}{a}$ (or $\sinh\frac{n\pi(b-y)}{a}$), chosen to vanish on the side opposite the data. For several nonzero sides, add the solutions.` },
  {
    type: 'graph', title: 'How the boundary data dies off',
    body: R`$u = \frac{\sinh(n\pi y)}{\sinh(n\pi)}\sin n\pi x$ on the unit square: the data on top is felt less and less deep inside, and higher modes fade faster.`,
    widget: {
      params: [{ key: 'n', label: 'mode n', min: 1, max: 4, step: 1, value: 1 }, { key: 'y', label: 'height y', min: 0, max: 1, step: 0.02, value: 0.6 }],
      x: [0, 1], y: [-1.1, 1.1], xLabel: 'x',
      curves: (p) => [{ fn: (x) => Math.sin(p.n * Math.PI * x), label: 'top boundary', dash: true, color: 1 }, { fn: (x) => (Math.sinh(p.n * Math.PI * p.y) / Math.sinh(p.n * Math.PI)) * Math.sin(p.n * Math.PI * x), label: 'u(x, y)' }],
      readout: (p) => `Amplitude at $y = ${p.y}$: $\\frac{\\sinh(${p.n}\\pi\\cdot${p.y})}{\\sinh(${p.n}\\pi)} = ${(Math.sinh(p.n * Math.PI * p.y) / Math.sinh(p.n * Math.PI)).toFixed(4)}$`,
    },
  },
  { type: 'text', kind: 'key', title: 'Polynomial solutions', body: R`If the boundary data are polynomials, try $u = \alpha + \beta x + \gamma y + \delta xy$ (harmonic for any constants) and match the four sides, as in Example 4.12.` },
  { type: 'text', kind: 'method', title: 'Circles', body: R`In polar form $u_{rr} + \frac1r u_r + \frac{1}{r^2}u_{\theta\theta} = 0$. Bounded solutions:<br>inside $r = R$: $u = \frac{a_0}{2} + \sum\left(\frac rR\right)^n(a_n\cos n\theta + b_n\sin n\theta)$;<br>outside: $\left(\frac Rr\right)^n$ instead; annulus: keep both plus $\ln r$.` },
  {
    type: 'graph', title: 'Inside a disk, the mean wins',
    body: R`Boundary $u(1,\theta) = 2 + \cos 3\theta + \sin\theta$. Move inward: each mode shrinks like $r^n$, and at the centre only the average (2) remains.`,
    widget: {
      params: [{ key: 'r', label: 'radius r', min: 0, max: 1, step: 0.02, value: 0.7 }],
      x: [0, 2 * Math.PI], y: [0, 4.2], xLabel: 'θ',
      curves: (p) => [{ fn: (t) => 2 + Math.cos(3 * t) + Math.sin(t), label: 'boundary r = 1', dash: true, color: 1 }, { fn: (t) => 2 + p.r ** 3 * Math.cos(3 * t) + p.r * Math.sin(t), label: `u at r = ${p.r}` }],
      hlines: [{ y: 2, label: 'mean value 2' }],
      readout: (p) => `$u(${p.r},\\theta) = 2 + ${(p.r ** 3).toFixed(3)}\\cos 3\\theta + ${p.r.toFixed(2)}\\sin\\theta$`,
    },
  },
  { type: 'quiz', prompt: R`Outside $r = 2$, $u(2,\theta) = 4\cos\theta$. The bounded solution is`, options: [
    { tex: R`$\frac{8}{r}\cos\theta$`, correct: true },
    { tex: R`$2r\cos\theta$`, why: R`That grows without bound as $r\to\infty$.` },
    { tex: R`$\frac{4}{r}\cos\theta$`, why: R`At $r = 2$ that gives $2\cos\theta$. Use $(R/r)^n$ with $R = 2$.` },
  ] },
];

SA.registerCourse({
  course: 'MATH 3705',
  topics: [
    { id: 'four-conv', ch: 'ch3', sec: '3.1', name: 'Convergence of Fourier series', desc: 'Averages at jumps and endpoints.', gen: genFourConv },
    { id: 'four-parity', ch: 'ch3', sec: '3.1', name: 'Even and odd functions', desc: 'Which coefficients vanish.', gen: genFourParity },
    { id: 'half-range', ch: 'ch3', sec: '3.2', name: 'Half-range expansions', desc: 'Sine and cosine series on (0, L).', gen: genHalfRange },
    { id: 'heat-limit', ch: 'ch4', sec: '4.1', name: 'Steady states', desc: 'Nonzero ends and insulated ends.', gen: genHeatLimit },
    { id: 'wave-vel', ch: 'ch4', sec: '4.2', name: 'Initial velocity', desc: 'B_n from u_t(x, 0).', gen: genWaveVel },
    { id: 'lap-rect', ch: 'ch4', sec: '4.3', name: 'Laplace in a rectangle', desc: 'sin × sinh, normalized.', gen: genLapRect },
    { id: 'lap-disk', ch: 'ch4', sec: '4.3', name: 'Laplace in a disk', desc: '(r/R)ⁿ inside, (R/r)ⁿ outside.', gen: genLapDisk },
  ],
  extendTopics: { four: { sec: '3.1', desc: 'Euler–Fourier formulas.' }, 'pde-heat': { sec: '4.1', desc: 'Separation of variables.' }, 'pde-wave': { sec: '4.2', desc: 'Normal modes.' } },
  sections: [
    { id: '3.1', tag: '3.1', num: '3.1', title: 'Periodic functions', chapter: 'Chapter 3 · Fourier series', skills: ['four', 'four-parity', 'four-conv'], lesson: L31 },
    { id: '3.2', tag: '3.2', num: '3.2', title: 'Functions on finite intervals', chapter: 'Chapter 3 · Fourier series', skills: ['half-range'], lesson: L32 },
    { id: '4.1', tag: '4.1', num: '4.1', title: 'The heat equation', chapter: 'Chapter 4 · PDEs', skills: ['pde-heat', 'heat-limit'], lesson: L41 },
    { id: '4.2', tag: '4.2', num: '4.2', title: 'The wave equation', chapter: 'Chapter 4 · PDEs', skills: ['pde-wave', 'wave-vel'], lesson: L42 },
    { id: '4.3', tag: '4.3', num: '4.3', title: "Laplace's equation", chapter: 'Chapter 4 · PDEs', skills: ['lap-rect', 'lap-disk'], lesson: L43 },
  ],
});
