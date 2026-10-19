// MATH 3705 — Chapter 1 sections 1.1 and 1.2 (Melkonian): interactive lessons + extra skills.
const { R, pick, randInt, rand, nz, nf, rnd, gammaFn } = SA;
const sampS = (lo) => () => ({ s: rand(lo + 1.5, lo + 6) });
const sg = (v) => (v < 0 ? `- ${-v}` : `+ ${v}`);
const simpson = (g, a, b, n = 800) => { const h = (b - a) / n; let s = g(a) + g(b); for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * g(a + i * h); return (s * h) / 3; };

/* ---------- 1.1 ---------- */
function genLapGamma() {
  const p = pick([0.5, 1.5, 2.5]), k = pick([1, 2, 3, 4]);
  const G = { 0.5: ['\\frac{\\sqrt\\pi}{2}', 'sqrt(pi)/2'], 1.5: ['\\frac{3\\sqrt\\pi}{4}', '3*sqrt(pi)/4'], 2.5: ['\\frac{15\\sqrt\\pi}{8}', '15*sqrt(pi)/8'] }[p];
  const pT = { 0.5: '1/2', 1.5: '3/2', 2.5: '5/2' }[p], expT = { 0.5: '3/2', 1.5: '5/2', 2.5: '7/2' }[p];
  const pTex = { 0.5: '\\frac12', 1.5: '\\frac32', 2.5: '\\frac52' }[p], eTex = { 0.5: '\\frac32', 1.5: '\\frac52', 2.5: '\\frac72' }[p];
  return {
    points: 15,
    prompt: `Use the gamma function to find $\\mathcal{L}\\{${k === 1 ? '' : k}t^{${pTex}}\\}$.`,
    vars: ['s'], sample: sampS(0), hint: 'Answer in terms of s. sqrt(pi) is fine.',
    answer: `${k}*${G[1]}/s^(${expT})`, answerTex: `${k === 1 ? '' : k}\\cdot${G[0]}\\,\\frac{1}{s^{${eTex}}}`,
    verify: { kind: 'laplace', f: `${k}*t^(${pT})` },
    steps: [
      { key: 'rule', title: 'Power rule for any p > −1', body: R`$\mathcal{L}\{t^p\} = \dfrac{\Gamma(p+1)}{s^{p+1}}$ (Example 1.11).` },
      { key: 'gam', title: 'Evaluate the gamma function', body: `$\\Gamma(${eTex}) = ${G[0]}$, using $\\Gamma(\\tfrac12) = \\sqrt\\pi$ and $\\Gamma(p+1) = p\\,\\Gamma(p)$.` },
      { key: 'res', title: 'Result', body: `$\\mathcal{L}\\{${k === 1 ? '' : k}t^{${pTex}}\\} = ${k === 1 ? '' : k}\\cdot\\dfrac{${G[0]}}{s^{${eTex}}}$` },
    ],
    mistakes: [
      { expr: `${k}*${G[1]}/s^(${pT})`, step: 'rule', why: 'The power of $s$ is $p+1$, not $p$.' },
      { expr: `${k}*sqrt(pi)/s^(${expT})`, step: 'gam', why: `$\\Gamma(${eTex})$ is not $\\sqrt\\pi$; use $\\Gamma(p+1) = p\\Gamma(p)$ down to $\\Gamma(\\tfrac12) = \\sqrt\\pi$.` },
      { expr: `${k}*${p}/s^(${expT})`, step: 'gam', why: 'That uses $p$ in place of $\\Gamma(p+1)$.' },
    ],
  };
}

/* ---------- 1.2 ---------- */
function genLapTMul() {
  const a = randInt(1, 4), fn = pick(['sin', 'cos', 'exp']);
  if (fn === 'exp') {
    const b = nz(-3, 3), n = pick([1, 2]);
    const ans = n === 1 ? `1/(s-(${b}))^2` : `2/(s-(${b}))^3`;
    return {
      points: 10, prompt: `Find $\\mathcal{L}\\{t${n === 2 ? '^2' : ''}e^{${b}t}\\}$ using Theorem 1.10 ($\\mathcal{L}\\{t^nf\\} = (-1)^nF^{(n)}(s)$).`,
      vars: ['s'], sample: sampS(Math.max(0, b)), hint: 'Answer in terms of s.',
      answer: ans, answerTex: `\\frac{${n === 1 ? 1 : 2}}{(s ${sg(-b)})^{${n + 1}}}`, verify: { kind: 'laplace', f: `t^${n}*exp(${b}*t)` },
      steps: [
        { key: 'F', title: 'Start from the known transform', body: `$F(s) = \\mathcal{L}\\{e^{${b}t}\\} = \\dfrac{1}{s ${sg(-b)}}$` },
        { key: 'diff', title: `Differentiate ${n === 1 ? 'once' : 'twice'}`, body: n === 1 ? `$-F'(s) = \\dfrac{1}{(s ${sg(-b)})^2}$` : `$F''(s) = \\dfrac{2}{(s ${sg(-b)})^3}$` },
      ],
      mistakes: [
        { expr: n === 1 ? `-1/(s-(${b}))^2` : `-2/(s-(${b}))^3`, step: 'diff', why: `Don't drop the $(-1)^n$ factor.` },
        { expr: n === 1 ? `1/s^2` : `2/s^3`, step: 'F', why: `The $e^{${b}t}$ shifts $s$ to $s ${sg(-b)}$ (first shifting theorem).` },
      ],
    };
  }
  const isSin = fn === 'sin', a2 = a * a;
  const ans = isSin ? `2*${a}*s/(s^2+${a2})^2` : `(s^2-${a2})/(s^2+${a2})^2`;
  return {
    points: 15, prompt: `Find $\\mathcal{L}\\{t\\${fn}(${a === 1 ? '' : a}t)\\}$.`,
    vars: ['s'], sample: sampS(0), hint: 'Answer in terms of s.',
    answer: ans, answerTex: isSin ? `\\frac{${2 * a}s}{(s^2+${a2})^2}` : `\\frac{s^2-${a2}}{(s^2+${a2})^2}`,
    verify: { kind: 'laplace', f: `t*${fn}(${a}*t)` },
    steps: [
      { key: 'F', title: 'Known transform', body: isSin ? `$F(s) = \\dfrac{${a}}{s^2+${a2}}$` : `$F(s) = \\dfrac{s}{s^2+${a2}}$` },
      { key: 'thm', title: 'Theorem 1.10 with n = 1', body: R`$\mathcal{L}\{tf(t)\} = -F'(s)$` },
      { key: 'diff', title: 'Differentiate', body: isSin ? `$-F'(s) = -\\left(-\\dfrac{${2 * a}s}{(s^2+${a2})^2}\\right) = \\dfrac{${2 * a}s}{(s^2+${a2})^2}$` : `$-F'(s) = -\\dfrac{(s^2+${a2}) - 2s^2}{(s^2+${a2})^2} = \\dfrac{s^2-${a2}}{(s^2+${a2})^2}$` },
    ],
    mistakes: [
      { expr: isSin ? `-2*${a}*s/(s^2+${a2})^2` : `(${a2}-s^2)/(s^2+${a2})^2`, step: 'thm', why: 'With $n = 1$ the theorem has a minus sign: $-F\'(s)$.' },
      { expr: isSin ? `${a}/(s^2+${a2})^2` : `s/(s^2+${a2})^2`, step: 'diff', why: 'Use the quotient rule; differentiating only the denominator\'s power is not enough.' },
      { expr: isSin ? `${a}/(s^2+${a2})/s^2` : `1/(s^2+${a2})`, step: 'thm', why: 'Multiplying by $t$ means differentiating $F$, not multiplying or dividing by $s$.' },
    ],
  };
}

function genLapPiece() {
  const c = randInt(1, 3), kind = pick(['t', 'const', 'tsq']);
  const k = randInt(2, 5);
  let f, fTex, ans, ansTex, rewrite, wrong;
  if (kind === 't') {
    f = `u(t-${c})*t`; fTex = `\\begin{cases}0, & 0\\le t<${c}\\\\ t, & t\\ge ${c}\\end{cases}`;
    rewrite = `$t = (t-${c}) + ${c}$, so $f(t) = u(t-${c})\\big[(t-${c}) + ${c}\\big]$`;
    ans = `exp(-${c}*s)*(1/s^2+${c}/s)`; ansTex = `e^{-${c}s}\\left(\\frac{1}{s^2}+\\frac{${c}}{s}\\right)`;
    wrong = `exp(-${c}*s)/s^2`;
  } else if (kind === 'const') {
    f = `${k}-${k}*u(t-${c})`; fTex = `\\begin{cases}${k}, & 0\\le t<${c}\\\\ 0, & t\\ge ${c}\\end{cases}`;
    rewrite = `$f(t) = ${k} - ${k}\\,u(t-${c})$`;
    ans = `${k}*(1-exp(-${c}*s))/s`; ansTex = `\\frac{${k}\\left(1-e^{-${c}s}\\right)}{s}`;
    wrong = `${k}*exp(-${c}*s)/s`;
  } else {
    f = `u(t-${c})*t^2`; fTex = `\\begin{cases}0, & 0\\le t<${c}\\\\ t^2, & t\\ge ${c}\\end{cases}`;
    rewrite = `$t^2 = (t-${c})^2 + ${2 * c}(t-${c}) + ${c * c}$, so $f(t) = u(t-${c})\\big[(t-${c})^2 + ${2 * c}(t-${c}) + ${c * c}\\big]$`;
    ans = `exp(-${c}*s)*(2/s^3+${2 * c}/s^2+${c * c}/s)`; ansTex = `e^{-${c}s}\\left(\\frac{2}{s^3}+\\frac{${2 * c}}{s^2}+\\frac{${c * c}}{s}\\right)`;
    wrong = `exp(-${c}*s)*2/s^3`;
  }
  return {
    points: 15, prompt: `Find $\\mathcal{L}\\{f(t)\\}$ for $f(t) = ${fTex}$.`,
    vars: ['s'], sample: sampS(0), hint: 'Answer in terms of s; write e^(-2s) as exp(-2*s).',
    answer: ans, answerTex: ansTex, verify: { kind: 'laplace', f },
    figure: { kind: 'plot', x: [0, c + 3], y: 'auto', xLabel: 't', curves: [{ fn: (t) => SA.evaluate(SA.parse(f, ['t']), { t }), label: 'f(t)' }], vlines: [{ x: c, label: `t = ${c}` }] },
    steps: [
      { key: 'step', title: 'Write f with unit steps', body: rewrite },
      { key: 'shift', title: 'Second shifting theorem', body: R`$\mathcal{L}\{u(t-a)g(t-a)\} = e^{-as}G(s)$: every piece must be a function of $(t-a)$ before you transform it.` },
      { key: 'res', title: 'Result', body: `$F(s) = ${ansTex}$` },
    ],
    mistakes: [
      { expr: wrong, step: 'step', why: kind === 'const' ? 'That is only the part switched off at $t = ' + c + '$. Keep the constant from $t = 0$.' : `Write the multiplier as a function of $(t-${c})$ first; you dropped the extra terms.` },
      ...(kind !== 'const' ? [{ expr: kind === 't' ? `exp(-${c}*s)/s^2` : `exp(-${c}*s)*2/s^3`, step: 'shift', why: 'You transformed $f(t-a)$ as if it were $f(t)$.' }] : [{ expr: `${k}/s`, step: 'shift', why: 'The step $u(t-' + c + ')$ contributes $-' + k + 'e^{-' + c + 's}/s$.' }]),
    ],
  };
}

function genLapPeriodic() {
  const a = pick([1, 2]), k = randInt(1, 4);
  const T = 2 * a;
  const ans = `${k}/(s*(1+exp(-${a}*s)))`;
  const fP = (t) => ((t % T) < a ? k : 0);
  return {
    points: 20,
    prompt: `$f(t) = ${k}$ for $0\\le t<${a}$, $f(t) = 0$ for $${a}\\le t<${T}$, and $f(t+${T}) = f(t)$. Find $\\mathcal{L}\\{f(t)\\}$.`,
    vars: ['s'], sample: sampS(0), hint: 'Answer in terms of s; simplify using 1 − e^(−2as) = (1 − e^(−as))(1 + e^(−as)).',
    answer: ans, answerTex: `\\frac{${k}}{s\\left(1+e^{-${a}s}\\right)}`,
    figure: { kind: 'plot', x: [0, 3 * T], y: [-0.5, k + 1], xLabel: 't', curves: [{ fn: fP, label: 'f(t)' }] },
    verify: { kind: 'self' },
    selfCheck() { for (const s of [1.3, 2.7]) { const num = simpson((t) => Math.exp(-s * t) * fP(t), 0, 40 / s, 20000) ; const F = k / (s * (1 + Math.exp(-a * s))); if (Math.abs(num - F) > 2e-3 * Math.max(1, F)) return `s=${s}: ${num} vs ${F}`; } return true; },
    steps: [
      { key: 'thm', title: 'Theorem 1.9 (periodic functions)', body: `$\\mathcal{L}\\{f\\} = \\dfrac{1}{1-e^{-${T}s}}\\displaystyle\\int_0^{${T}} e^{-st}f(t)\\,dt$` },
      { key: 'int', title: 'One period', body: `$\\displaystyle\\int_0^{${a}} ${k}e^{-st}\\,dt = \\frac{${k}\\left(1-e^{-${a}s}\\right)}{s}$` },
      { key: 'simp', title: 'Simplify', body: `$\\dfrac{${k}(1-e^{-${a}s})}{s(1-e^{-${a}s})(1+e^{-${a}s})} = \\dfrac{${k}}{s(1+e^{-${a}s})}$` },
    ],
    mistakes: [
      { expr: `${k}*(1-exp(-${a}*s))/s`, step: 'thm', why: `That is one period only. Divide by $1 - e^{-${T}s}$ to account for every period.` },
      { expr: `${k}/(s*(1-exp(-${a}*s)))`, step: 'simp', why: `$1 - e^{-${T}s} = (1-e^{-${a}s})(1+e^{-${a}s})$, so a plus sign remains.` },
      { expr: `${k}/(s*(1+exp(-${T}*s)))`, step: 'simp', why: `The period is ${T}, but the "on" interval has length ${a}; the factor left is $1 + e^{-${a}s}$.` },
    ],
  };
}

function genLapIntegral() {
  const a = randInt(1, 4), kind = pick(['exp', 'trig']);
  if (kind === 'exp') return {
    points: 15, prompt: `Use Theorem 1.8 ($\\mathcal{L}\\{\\int_0^t f\\} = F(s)/s$) to find $\\mathcal{L}^{-1}\\left\\{\\dfrac{1}{s(s-${a})}\\right\\}$.`,
    vars: ['t'], sample: () => ({ t: rand(0.2, 2) }), hint: 'Answer in terms of t.',
    answer: `(exp(${a}*t)-1)/${a}`, answerTex: `\\frac{e^{${a}t}-1}{${a}}`, verify: { kind: 'inverse', F: `1/(s*(s-${a}))`, pole: a },
    steps: [
      { key: 'id', title: 'Spot F(s)/s', body: `$\\dfrac{1}{s(s-${a})} = \\dfrac{F(s)}{s}$ with $F(s) = \\dfrac{1}{s-${a}}$, so $f(t) = e^{${a}t}$.` },
      { key: 'int', title: 'Integrate', body: `$\\displaystyle\\int_0^t e^{${a}\\tau}d\\tau = \\frac{e^{${a}t}-1}{${a}}$` },
    ],
    mistakes: [
      { expr: `exp(${a}*t)/${a}`, step: 'int', why: 'Evaluate at both limits: the lower limit gives $-1/' + a + '$.' },
      { expr: `${a}*exp(${a}*t)`, step: 'id', why: 'Dividing by $s$ integrates; it does not differentiate.' },
    ],
  };
  const a2 = a * a;
  return {
    points: 15, prompt: `Use Theorem 1.8 to find $\\mathcal{L}^{-1}\\left\\{\\dfrac{1}{s(s^2+${a2})}\\right\\}$.`,
    vars: ['t'], sample: () => ({ t: rand(0.2, 2) }), hint: 'Answer in terms of t.',
    answer: `(1-cos(${a}*t))/${a2}`, answerTex: `\\frac{1-\\cos ${a === 1 ? '' : a}t}{${a2}}`, verify: { kind: 'inverse', F: `1/(s*(s^2+${a2}))`, pole: 0 },
    steps: [
      { key: 'id', title: 'Spot F(s)/s', body: `$F(s) = \\dfrac{1}{s^2+${a2}}$, so $f(t) = \\dfrac{\\sin ${a === 1 ? '' : a}t}{${a}}$.` },
      { key: 'int', title: 'Integrate', body: `$\\displaystyle\\int_0^t \\frac{\\sin ${a === 1 ? '' : a}\\tau}{${a}}d\\tau = \\frac{1-\\cos ${a === 1 ? '' : a}t}{${a2}}$` },
    ],
    mistakes: [
      { expr: `-cos(${a}*t)/${a2}`, step: 'int', why: 'Evaluate at both limits: the lower limit contributes $+1/' + a2 + '$.' },
      { expr: `sin(${a}*t)/${a}`, step: 'int', why: 'That is $f(t)$; you still need to integrate it from $0$ to $t$.' },
    ],
  };
}

/* ---------- lessons ---------- */
const L11 = [
  { type: 'text', kind: 'key', title: 'The Laplace transform', body: R`$$F(s) = \mathcal{L}\{f(t)\} = \int_0^\infty e^{-st}f(t)\,dt$$ It turns a function of time into a function of $s$. The weight $e^{-st}$ kills the tail, so the integral converges when $f$ grows slower than some $e^{ct}$ (exponential order) and $s > c$.` },
  {
    type: 'graph', title: 'What the integral measures',
    body: R`The shaded area is $\int_0^\infty e^{-st}f(t)\,dt$ for $f(t) = t$. Increase $s$: the weight dies faster, the area shrinks, and it always equals $1/s^2$.`,
    widget: {
      params: [{ key: 's', label: 's', min: 0.3, max: 3, step: 0.05, value: 1 }],
      x: [0, 10], y: [0, 2.2], xLabel: 't',
      curves: (p) => [{ fn: (t) => t, label: 'f(t) = t', dash: true, color: 1 }, { fn: (t) => Math.exp(-p.s * t), label: 'e^{-st}', dash: true, color: 2 }, { fn: (t) => t * Math.exp(-p.s * t), label: 'e^{-st} f(t)' }],
      areas: (p) => [{ fn: (t) => t * Math.exp(-p.s * t), a: 0, b: 10, color: 0 }],
      readout: (p) => `$s = ${p.s.toFixed(2)}$: area $= \\dfrac{1}{s^2} = ${(1 / (p.s * p.s)).toFixed(3)}$`,
    },
  },
  { type: 'example', title: 'Example 1.2: L{t} by parts', prompt: R`Find $\mathcal{L}\{t\}$ for $s > 0$.`, steps: [
    R`$\int_0^\infty te^{-st}dt$: let $u = t$, $dv = e^{-st}dt$, so $v = -e^{-st}/s$.`,
    R`$= \left[-\dfrac{te^{-st}}{s}\right]_0^\infty + \dfrac1s\int_0^\infty e^{-st}dt = 0 + \dfrac1s\cdot\dfrac1s$.`,
    R`$\mathcal{L}\{t\} = \dfrac{1}{s^2}$. Repeating gives $\mathcal{L}\{t^n\} = \dfrac{n!}{s^{n+1}}$.`,
  ] },
  { type: 'text', kind: 'method', title: 'Basic table', body: R`$\mathcal{L}\{1\} = \frac1s$, $\mathcal{L}\{t^n\} = \frac{n!}{s^{n+1}}$, $\mathcal{L}\{e^{at}\} = \frac{1}{s-a}$,<br>$\mathcal{L}\{\sin at\} = \frac{a}{s^2+a^2}$, $\mathcal{L}\{\cos at\} = \frac{s}{s^2+a^2}$, and linearity $\mathcal{L}\{af+bg\} = aF + bG$.` },
  { type: 'text', kind: 'key', title: 'Non-integer powers: the gamma function', body: R`$\Gamma(p) = \int_0^\infty t^{p-1}e^{-t}dt$, with $\Gamma(p+1) = p\Gamma(p)$, $\Gamma(n+1) = n!$ and $\Gamma(\tfrac12) = \sqrt\pi$. Then $\mathcal{L}\{t^p\} = \dfrac{\Gamma(p+1)}{s^{p+1}}$ for $p > -1$.` },
  {
    type: 'graph', title: 'Γ(p) interpolates the factorials',
    body: R`The curve passes through $0!, 1!, 2!, 3!$ at $p = 1, 2, 3, 4$. Slide to a half-integer to see $\Gamma(\tfrac32) = \tfrac{\sqrt\pi}{2}$.`,
    widget: {
      params: [{ key: 'p', label: 'p', min: 0.5, max: 4.5, step: 0.5, value: 1.5 }],
      x: [0.3, 5], y: [0, 26], xLabel: 'p',
      curves: [{ fn: (x) => gammaFn(x), label: 'Γ(p)' }],
      points: (p) => [{ x: p.p, y: gammaFn(p.p), label: `Γ(${p.p}) = ${gammaFn(p.p).toFixed(4)}` }, ...[1, 2, 3, 4].map((n) => ({ x: n, y: gammaFn(n), color: 1 }))],
      readout: (p) => `$\\Gamma(${p.p}) = ${gammaFn(p.p).toFixed(4)}$`,
    },
  },
  { type: 'input', prompt: R`$\mathcal{L}\{t^{1/2}\} = \dfrac{c}{s^{3/2}}$. What is $c$? (decimal or sqrt(pi)/2)`, answer: 'sqrt(pi)/2', answerTex: '\\frac{\\sqrt\\pi}{2}', explain: R`$\Gamma(\tfrac32) = \tfrac12\Gamma(\tfrac12) = \tfrac{\sqrt\pi}{2}$.` },
  { type: 'text', kind: 'key', title: 'Transforms of derivatives (Theorems 1.3–1.5)', body: R`$\mathcal{L}\{f'\} = sF(s) - f(0)$ and $\mathcal{L}\{f''\} = s^2F(s) - sf(0) - f'(0)$. This is what turns an IVP into algebra: the initial conditions are built in.` },
  { type: 'example', title: 'Example 1.23 style IVP', prompt: R`$y'' - 2y' - 8y = 0$, $y(0) = 1$, $y'(0) = 0$.`, steps: [
    R`Transform: $s^2Y - s - 2(sY - 1) - 8Y = 0$.`,
    R`$(s^2 - 2s - 8)Y = s - 2$, so $Y = \dfrac{s-2}{(s-4)(s+2)}$.`,
    R`Partial fractions: $Y = \dfrac{1/3}{s-4} + \dfrac{2/3}{s+2}$.`,
    R`Invert: $y(t) = \tfrac13 e^{4t} + \tfrac23 e^{-2t}$. Check: $y(0) = 1$.`,
  ] },
  { type: 'quiz', prompt: R`$\mathcal{L}\{y''\}$ with $y(0) = 2$, $y'(0) = -1$ is`, options: [
    { tex: R`$s^2Y - 2s + 1$`, correct: true },
    { tex: R`$s^2Y - 2s - 1$`, why: R`The last term is $-y'(0) = -(-1) = +1$.` },
    { tex: R`$s^2Y - 2 + s$`, why: R`$y(0)$ is multiplied by $s$ and $y'(0)$ is not.` },
  ] },
];

const L12 = [
  { type: 'text', kind: 'key', title: 'First shifting theorem (1.6)', body: R`$\mathcal{L}\{e^{at}f(t)\} = F(s-a)$. Multiplying by an exponential in $t$ slides the transform along the $s$-axis.` },
  {
    type: 'graph', title: 'Slide F(s) to F(s − a)',
    body: R`$F(s) = \dfrac{2}{s^2+4}$ is $\mathcal{L}\{\sin 2t\}$. Multiplying by $e^{at}$ moves the whole curve right by $a$.`,
    widget: {
      params: [{ key: 'a', label: 'a', min: -2, max: 3, step: 0.5, value: 1 }],
      x: [-3, 6], y: [0, 0.6], xLabel: 's',
      curves: (p) => [{ fn: (s) => 2 / (s * s + 4), label: 'F(s)', dash: true, color: 1 }, { fn: (s) => 2 / ((s - p.a) ** 2 + 4), label: 'F(s − a)' }],
      readout: (p) => `$\\mathcal{L}\\{e^{${p.a}t}\\sin 2t\\} = \\dfrac{2}{(s ${sg(-p.a)})^2 + 4}$`,
    },
  },
  { type: 'example', title: 'Example 1.28: complete the square', prompt: R`Invert $\dfrac{s+1}{s^2 - 4s + 13}$.`, steps: [
    R`$s^2 - 4s + 13 = (s-2)^2 + 9$.`,
    R`Write the top in terms of $s-2$: $s + 1 = (s-2) + 3$.`,
    R`$\dfrac{(s-2)}{(s-2)^2+9} + \dfrac{3}{(s-2)^2+9}$, so $f(t) = e^{2t}\cos 3t + e^{2t}\sin 3t$.`,
  ] },
  { type: 'text', kind: 'key', title: 'Unit steps and the second shifting theorem (1.7)', body: R`$u(t-a) = 0$ for $t < a$ and $1$ for $t \ge a$. $\mathcal{L}\{u(t-a)\,g(t-a)\} = e^{-as}G(s)$: delaying a signal by $a$ multiplies its transform by $e^{-as}$.` },
  {
    type: 'graph', title: 'Switch a signal on at t = a',
    body: R`$u(t-a)\sin(t-a)$ is $\sin t$ delayed by $a$. Its transform is $e^{-as}\dfrac{1}{s^2+1}$.`,
    widget: {
      params: [{ key: 'a', label: 'delay a', min: 0, max: 5, step: 0.25, value: 2 }],
      x: [0, 12], y: [-1.3, 1.3], xLabel: 't',
      curves: (p) => [{ fn: (t) => Math.sin(t), label: 'sin t', dash: true, color: 1 }, { fn: (t) => (t >= p.a ? Math.sin(t - p.a) : 0), label: 'u(t−a) sin(t−a)' }],
      vlines: (p) => [{ x: p.a, label: 't = a' }],
      readout: (p) => `$\\mathcal{L} = \\dfrac{e^{-${p.a}s}}{s^2+1}$`,
    },
  },
  { type: 'quiz', prompt: R`Which is $\mathcal{L}\{u(t-3)\,t\}$?`, options: [
    { tex: R`$e^{-3s}\left(\frac{1}{s^2} + \frac{3}{s}\right)$`, correct: true },
    { tex: R`$\frac{e^{-3s}}{s^2}$`, why: R`$t$ is not $t-3$: write $t = (t-3) + 3$ first.` },
    { tex: R`$\frac{e^{-3s}}{s^2} + \frac3s$`, why: 'The constant 3 is also switched on at $t = 3$, so it gets $e^{-3s}$ too.' },
  ] },
  { type: 'example', title: 'Example 1.42 style: piecewise to steps', prompt: R`$f(t) = 1$ on $[0,2)$, $f(t) = 1 - t$ for $t \ge 2$.`, steps: [
    R`$f(t) = 1 + u(t-2)\big[(1-t) - 1\big] = 1 - u(t-2)\,t$.`,
    R`$t = (t-2) + 2$, so $f = 1 - u(t-2)(t-2) - 2u(t-2)$.`,
    R`$F(s) = \dfrac1s - e^{-2s}\left(\dfrac{1}{s^2} + \dfrac{2}{s}\right)$.`,
  ] },
  { type: 'text', kind: 'method', title: 'More properties', body: R`Integrals (1.8): $\mathcal{L}\{\int_0^t f\} = F(s)/s$.<br>Periodic $f$ with period $T$ (1.9): $\mathcal{L}\{f\} = \dfrac{1}{1-e^{-sT}}\int_0^T e^{-st}f(t)dt$.<br>Multiplying by $t^n$ (1.10): $\mathcal{L}\{t^nf\} = (-1)^nF^{(n)}(s)$.` },
  {
    type: 'graph', title: 'A periodic square wave',
    body: R`$f = 1$ for half of each period $T$. Only one period is integrated, then divided by $1 - e^{-sT}$.`,
    widget: {
      params: [{ key: 'T', label: 'period T', min: 1, max: 4, step: 0.5, value: 2 }, { key: 's', label: 's', min: 0.2, max: 3, step: 0.1, value: 1 }],
      x: [0, 10], y: [-0.3, 1.4], xLabel: 't',
      curves: (p) => [{ fn: (t) => ((t % p.T) < p.T / 2 ? 1 : 0), label: 'f(t)' }, { fn: (t) => Math.exp(-p.s * t), label: 'e^{-st}', dash: true, color: 1 }],
      areas: (p) => [{ fn: (t) => ((t % p.T) < p.T / 2 ? Math.exp(-p.s * t) : 0), a: 0, b: 10, color: 0 }],
      readout: (p) => `$F(${p.s.toFixed(1)}) = \\dfrac{1}{s(1+e^{-sT/2})} = ${(1 / (p.s * (1 + Math.exp(-p.s * p.T / 2)))).toFixed(4)}$`,
    },
  },
  { type: 'input', prompt: R`Use $\mathcal{L}\{t\sin at\} = \dfrac{2as}{(s^2+a^2)^2}$. Evaluate $\mathcal{L}\{t\sin t\}$ at $s = 1$.`, answer: '0.5', explain: R`$\dfrac{2\cdot1\cdot1}{(1+1)^2} = \tfrac12$.` },
];

SA.registerCourse({
  course: 'MATH 3705',
  topics: [
    { id: 'lap-gamma', ch: 'ch1', sec: '1.1', name: 'Gamma function powers', desc: 'L{tᵖ} = Γ(p+1)/sᵖ⁺¹.', gen: genLapGamma },
    { id: 'lap-tmul', ch: 'ch1', sec: '1.2', name: 'Multiplying by tⁿ', desc: 'L{tⁿf} = (−1)ⁿF⁽ⁿ⁾(s).', gen: genLapTMul },
    { id: 'lap-piece', ch: 'ch1', sec: '1.2', name: 'Piecewise functions', desc: 'Rewrite with u(t−a), then shift.', gen: genLapPiece },
    { id: 'lap-periodic', ch: 'ch1', sec: '1.2', name: 'Periodic functions', desc: 'One period ÷ (1 − e^(−sT)).', gen: genLapPeriodic },
    { id: 'lap-int', ch: 'ch1', sec: '1.2', name: 'Transforms of integrals', desc: 'F(s)/s ↔ ∫f.', gen: genLapIntegral },
  ],
  extendTopics: {
    'lap-basic': { sec: '1.1', desc: 'Table + linearity.' }, 'lap-pf': { sec: '1.1', desc: 'Partial fractions, then the table.' }, 'lap-ivp': { sec: '1.1', desc: 'Transform, solve for Y, invert.' },
    'lap-trig': { sec: '1.2', desc: 'First shifting theorem.' }, 'lap-step': { sec: '1.2', desc: 'Second shifting theorem.' },
  },
  sections: [
    { id: '1.1', tag: '1.1', num: '1.1', title: 'Introduction to the Laplace transform', chapter: 'Chapter 1 · Laplace transform', skills: ['lap-basic', 'lap-gamma', 'lap-pf', 'lap-ivp'], lesson: L11 },
    { id: '1.2', tag: '1.2', num: '1.2', title: 'Further properties and IVPs', chapter: 'Chapter 1 · Laplace transform', skills: ['lap-trig', 'lap-step', 'lap-piece', 'lap-tmul', 'lap-int', 'lap-periodic'], lesson: L12 },
  ],
});
