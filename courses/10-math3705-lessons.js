// Interactive lessons for the built-in MATH 3705 sections (§1.3, §2.1, §2.2, §2.3).
// Loaded by Study Arena at startup. Uses only the SA helper object.
const R = SA.R;
const fact = SA.fact;
const simpson = (f, a, b, n = 200) => { const h = (b - a) / n; let s = f(a) + f(b); for (let k = 1; k < n; k++) s += (k % 2 ? 4 : 2) * f(a + k * h); return (s * h) / 3; };
const taylor = (sel, N, x) => { let s = 0; for (let n = 0; n <= N; n++) { if (sel === 1) s += x ** n / fact(n); else if (sel === 2) { if (n % 2 === 0) s += ((-1) ** (n / 2) * x ** n) / fact(n); } else s += x ** n; } return s; };
const exact = (sel, x) => (sel === 1 ? Math.exp(x) : sel === 2 ? Math.cos(x) : 1 / (1 - x));
const fname = (sel) => (sel === 1 ? 'e^{x}' : sel === 2 ? '\\cos x' : '\\frac{1}{1-x}');

SA.registerCourse({
  course: 'MATH 3705',
  extendSections: {
    '1.3': {
      lesson: [
        { type: 'text', kind: 'key', title: 'What a convolution is', body: R`For functions defined on $t \ge 0$, the convolution of $f$ and $g$ is $$(f*g)(t) = \int_0^t f(t-x)\,g(x)\,dx.$$ The result is a new function of $t$; $x$ is just the integration variable. Think of it as: flip $f$, slide it to position $t$, multiply by $g$, and add up the overlap.` },
        {
          type: 'graph', title: 'Watch a convolution happen',
          body: R`Here $f(t) = u(t)$ (a unit step) and $g(t) = e^{-at}$. Drag $t$: the flipped, shifted step $f(t-x)$ covers $[0, t]$, and the shaded overlap is the integral. The right panel traces out $(f*g)(t)$.`,
          widget: {
            params: [{ key: 't', label: 't', min: 0, max: 5, step: 0.05, value: 1.5 }, { key: 'a', label: 'a', min: 0.3, max: 3, step: 0.1, value: 1 }],
            panels: [
              { kind: 'plot', x: [-0.5, 5], y: [-0.1, 1.3], xLabel: 'x', curves: (p) => [{ fn: (x) => (x >= 0 ? Math.exp(-p.a * x) : 0), label: 'g(x)' }, { fn: (x) => (x <= p.t ? 1 : 0), label: 'f(t−x)', dash: true }], areas: (p) => [{ fn: (x) => Math.exp(-p.a * x), a: 0, b: p.t, color: 0 }], vlines: (p) => [{ x: p.t, label: 'x = t' }] },
              { kind: 'plot', x: [0, 5], y: [-0.1, 3.4], xLabel: 't', curves: (p) => [{ fn: (t) => (1 - Math.exp(-p.a * t)) / p.a, label: '(f∗g)(t)', color: 2 }], points: (p) => [{ x: p.t, y: (1 - Math.exp(-p.a * p.t)) / p.a, label: 'area so far' }] },
            ],
            readout: (p) => `$(f*g)(${p.t.toFixed(2)}) = \\int_0^{${p.t.toFixed(2)}} e^{-${p.a.toFixed(1)}x}\\,dx = \\frac{1-e^{-${p.a.toFixed(1)}t}}{${p.a.toFixed(1)}} = ${((1 - Math.exp(-p.a * p.t)) / p.a).toFixed(3)}$`,
          },
          after: R`Notice the result keeps growing while there is still overlap to add, and levels off at $\frac1a$.`,
        },
        { type: 'quiz', prompt: R`Which is $t * \sin t$?`, options: [
          { tex: R`$t\sin t$`, why: 'That is the product. A convolution is an integral of a product of shifted copies.' },
          { tex: R`$t - \sin t$`, correct: true },
          { tex: R`$1 - \cos t$`, why: 'That is $1 * \\sin t$. With $f = t$ there is an extra integration.' },
          { tex: R`$\sin t - t$`, why: 'Close, but the sign is flipped. Check with the transform: $\\frac{1}{s^2}\\cdot\\frac{1}{s^2+1} = \\frac{1}{s^2} - \\frac{1}{s^2+1}$.' },
        ], explain: R`$\mathcal{L}\{t\}\mathcal{L}\{\sin t\} = \frac{1}{s^2(s^2+1)} = \frac{1}{s^2} - \frac{1}{s^2+1}$, which inverts to $t - \sin t$.` },
        { type: 'text', kind: 'key', title: 'It commutes', body: R`Substituting $y = t - x$ shows $f*g = g*f$. So put whichever function is easier to shift into the $f(t-x)$ slot. Constants and $t$ are the easiest.` },
        { type: 'text', kind: 'method', title: 'The convolution theorem (Theorem 1.14)', body: R`$$\mathcal{L}\{f*g\} = F(s)\,G(s), \qquad \mathcal{L}^{-1}\{F(s)\,G(s)\} = f*g.$$ Two uses: transform a convolution without integrating, and invert a product of two transforms you already recognise.` },
        { type: 'example', title: 'Worked example: t ∗ e²ᵗ', prompt: R`Compute $t * e^{2t}$ from the definition.`, steps: [
          R`Put $t$ in the shifted slot: $t*e^{2t} = \displaystyle\int_0^t (t-x)\,e^{2x}\,dx$.`,
          R`Integrate by parts with $u = t-x$, $dv = e^{2x}dx$: $\left[\frac{(t-x)e^{2x}}{2}\right]_0^t + \frac12\int_0^t e^{2x}dx$.`,
          R`The bracket is $0 - \frac t2$ and the integral is $\frac{e^{2t}-1}{4}$, so $t*e^{2t} = \dfrac{e^{2t} - 1 - 2t}{4}$.`,
          R`Check with the theorem: $\frac{1}{s^2}\cdot\frac{1}{s-2}$ matches the transform of that answer.`,
        ] },
        { type: 'quiz', prompt: R`$\mathcal{L}\{e^{t} * \cos t\} = $`, options: [
          { tex: R`$\dfrac{s}{(s-1)(s^2+1)}$`, correct: true },
          { tex: R`$\dfrac{s-1}{(s-1)^2+1}$`, why: 'That is the transform of the product $e^t\\cos t$ (first shift theorem), not the convolution.' },
          { tex: R`$\dfrac{1}{s-1} + \dfrac{s}{s^2+1}$`, why: 'Convolution transforms to a product, not a sum.' },
          { tex: R`$\dfrac{1}{(s-1)(s^2+1)}$`, why: '$\\mathcal{L}\\{\\cos t\\} = \\frac{s}{s^2+1}$, so there is an $s$ on top.' },
        ] },
        { type: 'text', kind: 'method', title: 'Integral equations', body: R`If the unknown sits inside a convolution, $f(t) = g(t) + \int_0^t f(t-x)k(x)\,dx$, transform both sides: $F = G + FK$, so $F = \dfrac{G}{1-K}$. A plain $\int_0^t f(x)\,dx$ is $1*f$, with transform $\dfrac{F(s)}{s}$.` },
        { type: 'example', title: 'Worked example', prompt: R`Solve $f(t) = 3 + 2\int_0^t f(x)\,dx$.`, steps: [
          R`Transform: $F = \dfrac3s + \dfrac{2F}{s}$.`,
          R`Collect: $F\left(1 - \frac2s\right) = \frac3s \Rightarrow F\cdot\frac{s-2}{s} = \frac3s \Rightarrow F = \dfrac{3}{s-2}$.`,
          R`Invert: $f(t) = 3e^{2t}$. Check: $3 + 2\int_0^t 3e^{2x}dx = 3 + 3(e^{2t}-1) = 3e^{2t}$.`,
        ] },
        { type: 'text', kind: 'key', title: 'The Dirac delta', body: R`$\delta(t-a)$ is a unit impulse at $t=a$: the limit of pulses of width $2\varepsilon$ and height $\frac{1}{2\varepsilon}$, which all have area 1. It is defined by what it does to smooth functions: $$\int_{-\infty}^{\infty}\delta(t-a)\,\varphi(t)\,dt = \varphi(a).$$` },
        {
          type: 'graph', title: 'Squeeze the pulse',
          body: R`The pulse $h_\varepsilon(t-a)$ always has area 1. Shrink $\varepsilon$ and watch $\int h_\varepsilon(t-a)\varphi(t)\,dt$ approach $\varphi(a)$ for $\varphi(t) = e^{-t^2}$.`,
          widget: {
            params: [{ key: 'a', label: 'a', min: -2, max: 2, step: 0.05, value: 0.8 }, { key: 'e', label: 'ε', min: 0.05, max: 1.2, step: 0.01, value: 0.6 }],
            x: [-3, 3], y: [-0.1, 2.2], xLabel: 't',
            curves: (p) => [{ fn: (t) => Math.exp(-t * t), label: 'φ(t)' }, { fn: (t) => (Math.abs(t - p.a) < p.e ? 1 / (2 * p.e) : 0), label: 'pulse', color: 1 }],
            areas: (p) => [{ fn: (t) => Math.exp(-t * t) / (2 * p.e), a: p.a - p.e, b: p.a + p.e, color: 1 }],
            readout: (p) => { const v = simpson((t) => Math.exp(-t * t), p.a - p.e, p.a + p.e) / (2 * p.e); return `$\\int h_\\varepsilon(t-a)\\varphi(t)\\,dt = ${v.toFixed(4)}$, while $\\varphi(a) = e^{-a^2} = ${Math.exp(-p.a * p.a).toFixed(4)}$`; },
          },
        },
        { type: 'quiz', prompt: R`$\displaystyle\int_{-\infty}^{\infty}\delta\!\left(t-\tfrac{\pi}{2}\right)\cos(t)\,e^{-t^2}\,dt = $`, options: [
          { tex: R`$0$`, correct: true },
          { tex: R`$1$`, why: 'That is $\\varphi(0)$. The delta fires at $t = \\pi/2$.' },
          { tex: R`$e^{-\pi^2/4}$`, why: 'Don\'t forget the $\\cos t$ factor: $\\cos\\frac\\pi2 = 0$.' },
          { tex: R`$\frac{\pi}{2}$`, why: 'The delta returns the value of the whole function at the impulse point.' },
        ], explain: R`Evaluate $\varphi(t) = \cos(t)e^{-t^2}$ at $t = \frac\pi2$: $\cos\frac\pi2 = 0$.` },
        { type: 'text', kind: 'method', title: 'Delta in the Laplace transform', body: R`$\mathcal{L}\{\delta(t-a)\} = e^{-as}$ ($a\ge0$) and $\mathcal{L}\{\delta(t)\} = 1$. In an IVP the impulse brings an $e^{-as}$ factor, which the second shifting theorem turns into a $u(t-a)$ term.` },
        {
          type: 'graph', title: 'Kick a spring with an impulse',
          body: R`$y'' + \omega^2 y = k\,\delta(t-a)$, starting at rest, gives $y = \frac{k}{\omega}u(t-a)\sin\big(\omega(t-a)\big)$. Nothing happens until the kick, then it rings.`,
          widget: {
            params: [{ key: 'a', label: 'impulse time a', min: 0, max: 4, step: 0.1, value: 1 }, { key: 'k', label: 'strength k', min: -3, max: 3, step: 0.1, value: 1 }, { key: 'w', label: 'ω', min: 0.5, max: 4, step: 0.1, value: 2 }],
            x: [0, 10], y: [-3.2, 3.2], xLabel: 't',
            curves: (p) => [{ fn: (t) => (t >= p.a ? (p.k / p.w) * Math.sin(p.w * (t - p.a)) : 0), label: 'y(t)' }],
            vlines: (p) => [{ x: p.a, label: 'kick' }],
            readout: (p) => `Amplitude $\\frac{|k|}{\\omega} = ${(Math.abs(p.k) / p.w).toFixed(2)}$. Just after the kick $y' = k = ${p.k.toFixed(1)}$ while $y$ stays $0$.`,
          },
        },
        { type: 'input', prompt: R`What is $\mathcal{L}\{\delta(t-3)\}$? (answer in terms of $s$)`, answer: 'exp(-3*s)', answerTex: 'e^{-3s}', vars: ['s'], explain: R`$\mathcal{L}\{\delta(t-a)\} = e^{-as}$.` },
      ],
    },

    '2.1': {
      lesson: [
        { type: 'text', kind: 'key', title: 'Why series?', body: R`With constant coefficients, $Ay''+By'+Cy=0$ is solved by $y = e^{rx}$. Once the coefficients depend on $x$, as in $P(x)y''+Q(x)y'+R(x)y=0$, that trick fails, so Chapter 2 builds solutions as power series instead.` },
        { type: 'text', kind: 'key', title: 'Taylor coefficients (Theorem 2.1)', body: R`If $f(x) = \sum a_n(x-x_0)^n$ near $x_0$, then $a_n = \dfrac{f^{(n)}(x_0)}{n!}$. If a power series is identically 0, every coefficient is 0. That is why you can set each coefficient to zero when solving ODEs.` },
        {
          type: 'graph', title: 'Taylor polynomials closing in',
          body: R`Pick a function (1 = $e^x$, 2 = $\cos x$, 3 = $\frac1{1-x}$) and add terms. For $e^x$ and $\cos x$ the polynomials hug the curve further and further out. For $\frac{1}{1-x}$ they only ever work for $|x|<1$.`,
          widget: {
            params: [{ key: 'f', label: 'function', min: 1, max: 3, step: 1, value: 1, fmt: (v) => ['', 'eˣ', 'cos x', '1/(1−x)'][v] }, { key: 'N', label: 'degree N', min: 0, max: 14, step: 1, value: 3 }],
            x: [-3, 3], y: [-3, 6], xLabel: 'x',
            curves: (p) => [{ fn: (x) => exact(p.f, x), label: 'f(x)', width: 3 }, { fn: (x) => taylor(p.f, p.N, x), label: `P_${p.N}(x)`, color: 1, dash: true }],
            vlines: (p) => (p.f === 3 ? [{ x: -1, label: '|x| = 1' }, { x: 1 }] : []),
            readout: (p) => `$f(x) = ${fname(p.f)}$: at $x = 2$ the error is $${Math.abs(exact(p.f, 2) - taylor(p.f, p.N, 2)).toPrecision(3)}$.`,
          },
        },
        { type: 'input', prompt: R`What is the coefficient of $x^3$ in the Taylor series of $e^{2x}$ about $0$?`, answer: '4/3', answerTex: '\\frac{4}{3}', explain: R`$a_3 = \frac{f'''(0)}{3!} = \frac{2^3}{6} = \frac43$.` },
        { type: 'text', kind: 'key', title: 'Analytic vs singular', body: R`$f$ is analytic at $x_0$ if its Taylor series converges to it near $x_0$. Polynomials, $e^x$, $\sin$, $\cos$ are analytic everywhere, and so are sums, products and quotients of analytic functions where the denominator isn't 0. A rational function $\frac{P}{Q}$ is singular exactly where $Q = 0$ (after cancelling).` },
        { type: 'quiz', prompt: R`Where is $f(x) = \dfrac{x+1}{x^2-4}$ singular?`, options: [
          { tex: R`$x = \pm 2$`, correct: true },
          { tex: R`$x = -1$`, why: 'That is a zero of the numerator, where $f = 0$. Nothing goes wrong there.' },
          { tex: R`$x = 2$ only`, why: '$x^2 - 4 = (x-2)(x+2)$ has two zeros.' },
          { tex: 'Nowhere', why: 'The denominator vanishes at two points.' },
        ] },
        { type: 'text', kind: 'method', title: 'Radius of convergence (Theorem 2.4)', body: R`$\sum a_n(x-x_0)^n$ converges for $|x-x_0| < R$ with $R = \displaystyle\lim_{n\to\infty}\left|\frac{a_n}{a_{n+1}}\right|$. Keep $a_n$ on top; the centre doesn't affect $R$.` },
        { type: 'example', title: 'Worked example', prompt: R`Find $R$ for $\displaystyle\sum_{n\ge0}\frac{x^n}{3^n(n+1)}$.`, steps: [
          R`$a_n = \dfrac{1}{3^n(n+1)}$ and $a_{n+1} = \dfrac{1}{3^{n+1}(n+2)}$.`,
          R`$\left|\dfrac{a_n}{a_{n+1}}\right| = \dfrac{3^{n+1}(n+2)}{3^n(n+1)} = 3\cdot\dfrac{n+2}{n+1}$.`,
          R`As $n\to\infty$ this tends to $3$, so $R = 3$: the series converges for $|x|<3$.`,
        ] },
        { type: 'text', kind: 'method', title: 'Ordinary and singular points of an ODE', body: R`Standard form: $y''+p(x)y'+q(x)y=0$ with $p = \frac QP$, $q = \frac RP$. $x_0$ is ordinary if both $p$ and $q$ are analytic there, otherwise singular. In practice that means the zeros of $P$, unless they cancel.` },
        { type: 'quiz', prompt: R`Which points are singular for $x(x-1)\,y'' + y' + e^x y = 0$?`, options: [
          { tex: R`$x = 0$ and $x = 1$`, correct: true },
          { tex: R`$x = 0$ only`, why: '$P(x) = x(x-1)$ also vanishes at $x = 1$.' },
          { tex: R`$x = -1$ and $x = 0$`, why: 'The factor $(x-1)$ vanishes at $x = +1$.' },
          { tex: 'None', why: 'Dividing by $x(x-1)$ makes $p$ and $q$ blow up at its zeros.' },
        ] },
      ],
    },

    '2.2': {
      lesson: [
        { type: 'text', kind: 'key', title: 'The guarantee (Theorem 2.5)', body: R`At an ordinary point $x_0$, the general solution is $y = \sum a_n(x-x_0)^n$ with $a_0$, $a_1$ arbitrary. Its radius of convergence is at least the distance from $x_0$ to the nearest singular point, and complex singular points count.` },
        {
          type: 'graph', title: 'Why complex singularities matter',
          body: R`$f(x) = \frac{1}{1+x^2}$ is smooth on the whole real line, yet its Taylor series about $0$ blows up for $|x|>1$. The culprits are the complex singularities $\pm i$, at distance 1 from the origin.`,
          widget: {
            params: [{ key: 'N', label: 'number of terms', min: 1, max: 20, step: 1, value: 6 }],
            x: [-2, 2], y: [-1, 2], xLabel: 'x',
            curves: (p) => [{ fn: (x) => 1 / (1 + x * x), label: '1/(1+x²)', width: 3 }, { fn: (x) => { let s = 0; for (let k = 0; k < p.N; k++) s += (-1) ** k * x ** (2 * k); return s; }, label: 'partial sum', color: 1, dash: true }],
            vlines: [{ x: -1, label: '−1' }, { x: 1, label: '+1' }],
            readout: (p) => `$\\sum_{k=0}^{${p.N - 1}}(-1)^kx^{2k}$: inside $|x|<1$ it converges; outside it swings wildly however many terms you add.`,
          },
        },
        { type: 'quiz', prompt: R`For $(x^2+9)\,y'' + y = 0$, a series solution about $x_0 = 4$ has $R \ge$ ?`, options: [
          { tex: R`$5$`, correct: true },
          { tex: R`$\infty$`, why: 'There are no real singular points, but $\\pm3i$ are complex singular points, and they count.' },
          { tex: R`$3$`, why: 'That is the distance from $0$ to $\\pm3i$. Measure from $x_0 = 4$.' },
          { tex: R`$4$`, why: 'Distance from $4$ to $3i$ is $\\sqrt{4^2 + 3^2} = 5$.' },
        ] },
        { type: 'text', kind: 'method', title: 'The recipe', body: R`1. $y=\sum a_nx^n$, $y'=\sum na_nx^{n-1}$, $y''=\sum n(n-1)a_nx^{n-2}$.<br>2. Substitute, and move $x$ factors inside the sums.<br>3. Shift indices so every sum shows $x^n$ from the same start, e.g. $\sum_{n\ge2}n(n-1)a_nx^{n-2} = \sum_{n\ge0}(n+2)(n+1)a_{n+2}x^n$.<br>4. Combine and set the bracket to 0. That is the recursion.<br>5. Step it from $a_0$, $a_1$.` },
        { type: 'example', title: 'Worked example: y″ − xy′ − y = 0', steps: [
          R`Substitute: $\sum n(n-1)a_nx^{n-2} - \sum na_nx^n - \sum a_nx^n = 0$.`,
          R`Shift the first sum: $\sum_{n\ge0}\big[(n+2)(n+1)a_{n+2} - (n+1)a_n\big]x^n = 0$.`,
          R`Recursion: $a_{n+2} = \dfrac{a_n}{n+2}$.`,
          R`Even terms from $a_0$: $a_2 = \frac{a_0}{2}$, $a_4 = \frac{a_0}{2\cdot4}$, …, so $y_1 = \sum\frac{x^{2k}}{2^kk!} = e^{x^2/2}$.`,
          R`Odd terms from $a_1$: $a_3 = \frac{a_1}{3}$, $a_5 = \frac{a_1}{3\cdot5}$, … give a second solution $y_2$.`,
        ] },
        {
          type: 'graph', title: 'The series really is the solution',
          body: R`Partial sums of $y_1 = \sum\frac{x^{2k}}{2^kk!}$ against $e^{x^2/2}$. There are no singular points, so $R = \infty$ and more terms keep working further out.`,
          widget: {
            params: [{ key: 'N', label: 'terms', min: 1, max: 10, step: 1, value: 3 }],
            x: [-3, 3], y: [0, 20], xLabel: 'x',
            curves: (p) => [{ fn: (x) => Math.exp(x * x / 2), label: 'e^{x²/2}', width: 3 }, { fn: (x) => { let s = 0; for (let k = 0; k < p.N; k++) s += x ** (2 * k) / (2 ** k * fact(k)); return s; }, label: 'partial sum', color: 1, dash: true }],
          },
        },
        { type: 'input', prompt: R`For $y''+y=0$ with $a_0 = 1$, $a_1 = 0$ the recursion is $a_{n+2} = -\dfrac{a_n}{(n+2)(n+1)}$. Find $a_4$.`, answer: '1/24', answerTex: '\\frac{1}{24}', explain: R`$a_2 = -\frac12$, then $a_4 = -\frac{a_2}{4\cdot3} = \frac{1}{24}$, matching $\cos x$.` },
        { type: 'text', kind: 'key', title: 'Initial conditions', body: R`$a_0 = y(0)$ and $a_1 = y'(0)$. When the recursion is messy, compute $a_2,\dots,a_N$ and use the polynomial as an approximation.` },
      ],
    },

    '2.3': {
      lesson: [
        { type: 'text', kind: 'key', title: 'Regular vs irregular (Definition 2.5)', body: R`A singular point $x_0$ is regular if both $(x-x_0)p(x)$ and $(x-x_0)^2q(x)$ are analytic there, and irregular otherwise. Rule of thumb: $p$ may blow up like $\frac{1}{x-x_0}$ at worst, and $q$ like $\frac{1}{(x-x_0)^2}$ at worst.` },
        { type: 'quiz', prompt: R`Classify $x_0 = 0$ for $x^2y'' + y' + y = 0$.`, options: [
          { tex: 'Irregular singular point', correct: true },
          { tex: 'Regular singular point', why: '$p = \\frac{1}{x^2}$, so $xp = \\frac1x$ is still singular at 0.' },
          { tex: 'Ordinary point', why: 'Dividing by $x^2$ makes $p$ and $q$ blow up at 0.' },
        ], explain: R`$p = \frac{1}{x^2}$ blows up too fast: $x\,p(x) = \frac{1}{x}$ is not analytic at 0.` },
        { type: 'text', kind: 'method', title: 'Cauchy–Euler equations', body: R`$ax^2y''+bxy'+cy=0$: try $y = x^r$ to get $ar(r-1)+br+c=0$.<br>Distinct real roots: $c_1x^{r_1}+c_2x^{r_2}$.<br>Repeated root: $x^r(c_1+c_2\ln x)$.<br>Complex roots $\lambda\pm i\mu$: $x^\lambda\big(c_1\cos(\mu\ln x)+c_2\sin(\mu\ln x)\big)$.` },
        {
          type: 'graph', title: 'Explore all three cases',
          body: R`Slide $b$ and $c$ in $x^2y''+bxy'+cy=0$. The indicial roots change, and with them the shape of the two basic solutions.`,
          widget: {
            params: [{ key: 'b', label: 'b', min: -4, max: 4, step: 0.5, value: -1 }, { key: 'c', label: 'c', min: -4, max: 8, step: 0.5, value: 5 }],
            x: [0.05, 4], y: [-4, 4], xLabel: 'x',
            curves: (p) => {
              const B = p.b - 1, D = B * B - 4 * p.c;
              if (D > 1e-9) { const r1 = (-B + Math.sqrt(D)) / 2, r2 = (-B - Math.sqrt(D)) / 2; return [{ fn: (x) => x ** r1, label: 'x^r₁' }, { fn: (x) => x ** r2, label: 'x^r₂', color: 1 }]; }
              if (D >= -1e-9) { const r = -B / 2; return [{ fn: (x) => x ** r, label: 'x^r' }, { fn: (x) => x ** r * Math.log(x), label: 'x^r ln x', color: 1 }]; }
              const lam = -B / 2, mu = Math.sqrt(-D) / 2; return [{ fn: (x) => x ** lam * Math.cos(mu * Math.log(x)), label: 'cos part' }, { fn: (x) => x ** lam * Math.sin(mu * Math.log(x)), label: 'sin part', color: 1 }];
            },
            readout: (p) => {
              const B = p.b - 1, D = B * B - 4 * p.c, f = (v) => +v.toFixed(3);
              const eq = `r^2 ${B >= 0 ? '+' : '-'} ${Math.abs(B)}r ${p.c >= 0 ? '+' : '-'} ${Math.abs(p.c)} = 0`;
              if (D > 1e-9) return `$${eq}$: distinct real roots $r = ${f((-B + Math.sqrt(D)) / 2)}, ${f((-B - Math.sqrt(D)) / 2)}$.`;
              if (D >= -1e-9) return `$${eq}$: repeated root $r = ${f(-B / 2)}$, so the second solution needs $\\ln x$.`;
              return `$${eq}$: complex roots $${f(-B / 2)} \\pm ${f(Math.sqrt(-D) / 2)}i$, so the solutions oscillate in $\\ln x$ and slow down as $x$ grows.`;
            },
          },
        },
        { type: 'example', title: 'Worked example (complex roots)', prompt: R`Solve $x^2y''-xy'+5y=0$, $x>0$.`, steps: [
          R`$y = x^r$: $r(r-1) - r + 5 = r^2 - 2r + 5 = 0$.`,
          R`$r = \frac{2\pm\sqrt{4-20}}{2} = 1 \pm 2i$, so $\lambda = 1$, $\mu = 2$.`,
          R`$y = x\big(c_1\cos(2\ln x) + c_2\sin(2\ln x)\big)$.`,
        ] },
        { type: 'text', kind: 'method', title: 'Frobenius method', body: R`Near a regular singular point $x_0 = 0$, try $y=\sum c_nx^{n+r}$. With $p_0 = \lim xp(x)$ and $q_0 = \lim x^2q(x)$, the indicial equation is $r^2+(p_0-1)r+q_0=0$, with roots $r_1\ge r_2$. The larger root always gives a solution.` },
        { type: 'text', kind: 'key', title: 'Which second solution? (Theorem 2.7)', body: R`Case (i), $r_1-r_2\notin\mathbb Z$: $y_2 = \sum b_nx^{n+r_2}$.<br>Case (ii), $r_1 = r_2$: $y_2 = y_1\ln x + \sum b_nx^{n+r_1}$.<br>Case (iii), $r_1-r_2\in\mathbb Z^+$: $y_2 = A\,y_1\ln x + \sum b_nx^{n+r_2}$.` },
        { type: 'quiz', prompt: R`The indicial roots are $r_1 = \frac12$, $r_2 = -1$. Which case applies?`, options: [
          { tex: 'Case (i)', correct: true },
          { tex: 'Case (ii)', why: 'The roots are different.' },
          { tex: 'Case (iii)', why: '$r_1 - r_2 = \\frac32$ is not an integer.' },
        ] },
        { type: 'example', title: 'Worked example', prompt: R`$2x^2y''+3xy'-(1+x)y=0$ about $x_0 = 0$.`, steps: [
          R`$xp = \frac32$, $x^2q = -\frac{1+x}{2}$, so $p_0 = \frac32$ and $q_0 = -\frac12$.`,
          R`Indicial: $r^2 + \frac12r - \frac12 = 0$, so $r_1 = \frac12$, $r_2 = -1$. The difference $\frac32$ gives case (i).`,
          R`With $r = \frac12$ the recursion is $a_n = \dfrac{a_{n-1}}{n(2n+3)}$.`,
          R`$a_1 = \frac15$, $a_2 = \frac{1}{70}$, so $y_1 = x^{1/2}\left(1 + \frac x5 + \frac{x^2}{70} + \cdots\right)$.`,
        ] },
        { type: 'text', kind: 'key', title: 'Bessel’s equation (Theorem 2.8)', body: R`$x^2y''+xy'+(\lambda^2x^2-\nu^2)y=0$ has solutions $J_\nu(\lambda x)$ and, for the second, $J_{-\nu}(\lambda x)$ if $\nu$ is not an integer, or $Y_\nu(\lambda x)$, which works for any $\nu$.` },
        {
          type: 'graph', title: 'Meet the Bessel functions',
          body: R`$J_\nu(\lambda x)$ looks like a decaying cosine. $\nu$ controls how flat it starts (it behaves like $x^\nu$ near 0); $\lambda$ squeezes it horizontally.`,
          widget: {
            params: [{ key: 'nu', label: 'order ν', min: 0, max: 4, step: 0.5, value: 0 }, { key: 'lam', label: 'λ', min: 0.5, max: 3, step: 0.1, value: 1 }],
            x: [0, 15], y: [-0.6, 1.1], xLabel: 'x',
            curves: (p) => [{ fn: (x) => SA.besselJ(p.nu, p.lam * x), label: `J_${p.nu}(${p.lam}x)` }],
            readout: (p) => `First zero near $x \\approx ${(() => { let prev = SA.besselJ(p.nu, p.lam * 0.05); for (let x = 0.1; x < 15; x += 0.05) { const v = SA.besselJ(p.nu, p.lam * x); if (v * prev < 0) return x.toFixed(2); prev = v; } return '—'; })()}$`,
          },
        },
        { type: 'quiz', prompt: R`General solution of $x^2y''+xy'+(4x^2-9)y=0$?`, options: [
          { tex: R`$c_1J_3(2x) + c_2Y_3(2x)$`, correct: true },
          { tex: R`$c_1J_3(2x) + c_2J_{-3}(2x)$`, why: '$\\nu = 3$ is an integer, so $J_{-3}$ is a multiple of $J_3$.' },
          { tex: R`$c_1J_9(2x) + c_2Y_9(2x)$`, why: 'The constant is $\\nu^2 = 9$, so $\\nu = 3$.' },
          { tex: R`$c_1J_3(4x) + c_2Y_3(4x)$`, why: '$\\lambda^2 = 4$, so the argument is $2x$.' },
        ] },
      ],
    },
  },
});
