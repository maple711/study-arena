// ECOR 3800 — Engineering Economics (weeks 2–5: time value of money, cash flow analysis,
// comparison methods I & II). Midterm: Thu Oct 22.
const { R, pick, randInt, rand, rnd, bisect, fmtMoney } = SA;

/* ---------- compound interest factors ---------- */
const FP = (i, n) => (1 + i) ** n;
const PF = (i, n) => (1 + i) ** -n;
const AF = (i, n) => i / ((1 + i) ** n - 1);
const FA = (i, n) => ((1 + i) ** n - 1) / i;
const AP = (i, n) => (i * (1 + i) ** n) / ((1 + i) ** n - 1);
const PA = (i, n) => ((1 + i) ** n - 1) / (i * (1 + i) ** n);
const AG = (i, n) => 1 / i - n / ((1 + i) ** n - 1);
const money = (v) => `${v < 0 ? '-' : ''}\\$${Math.round(Math.abs(v)).toLocaleString('en-US').replace(/,/g, '{,}')}`;
const m2 = (v) => `${v < -0.004 ? '-' : ''}\\$${(+Math.abs(v).toFixed(2)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, '{,}')}`;
const pct = (v, d = 2) => `${+(v * 100).toFixed(d)}\\%`;
const f4 = (v) => v.toFixed(4);
const num = (v) => String(Math.round(v * 100) / 100);
const TOL = 3e-3; // answers within 0.3% (table rounding)
const HINT = 'Enter a number (no $ sign or commas).';
const CF = (flows, n, unit = 'years') => ({ kind: 'cashflow', flows, n, unit });
const COMPOUND = [{ m: 365, name: 'daily' }, { m: 52, name: 'weekly' }, { m: 12, name: 'monthly' }, { m: 4, name: 'quarterly' }, { m: 2, name: 'semi-annually' }];

/* ---------------- generators ---------------- */
function genSimpleCompound() {
  const P = pick([500, 1000, 2500, 5000, 8000]), i = pick([0.03, 0.04, 0.05, 0.06, 0.08, 0.1]), n = randInt(2, 8);
  const comp = Math.random() < 0.6, askI = Math.random() < 0.4;
  const F = comp ? P * FP(i, n) : P * (1 + n * i);
  const ans = askI ? F - P : F;
  const other = comp ? P * (1 + n * i) : P * FP(i, n);
  return {
    points: 10,
    prompt: `You lend $${money(P)}$ for ${n} years at ${pct(i, 0)} per year, ${comp ? 'compounded annually' : 'simple interest'}. What is the ${askI ? 'total interest earned' : 'amount owed at the end'}?`,
    vars: [], sample: () => ({}), tol: TOL, hint: HINT,
    figure: CF([{ t: 0, amount: -P }, { t: n, amount: F, label: `F = ${fmtMoney(F)}` }], n),
    answer: String(rnd(ans)), answerTex: `${askI ? 'I' : 'F'} = ${m2(ans)}`,
    steps: [
      { key: 'type', title: comp ? 'Compound interest' : 'Simple interest', body: comp ? 'Interest is earned on the principal and on the interest already added: $F = P(1+i)^n$.' : 'Interest is only ever earned on the original principal: $F = P(1 + ni)$.' },
      { key: 'calc', title: 'Compute', body: comp ? `$F = ${money(P)}(1.${String(Math.round(i * 100)).padStart(2, '0')})^{${n}} = ${m2(F)}$` : `$F = ${money(P)}(1 + ${n}\\times${i}) = ${m2(F)}$` },
      ...(askI ? [{ key: 'int', title: 'Interest', body: `$I = F - P = ${m2(F - P)}$.` }] : []),
    ],
    mistakes: [
      { expr: String(rnd(askI ? other - P : other)), step: 'type', why: comp ? 'That is simple interest. "Compounded annually" means interest also earns interest.' : 'That is compound interest. Simple interest uses $P(1+ni)$.' },
      { expr: String(rnd(askI ? F : F - P)), step: askI ? 'int' : 'calc', why: askI ? 'That is the total amount owed. The interest is $F - P$.' : 'That is only the interest. The amount owed includes the principal.' },
    ],
  };
}

function genEffective() {
  const r = pick([0.06, 0.08, 0.1, 0.12, 0.15, 0.18, 0.21, 0.24]);
  const cont = Math.random() < 0.2;
  const C = pick(COMPOUND);
  const askSub = !cont && Math.random() < 0.25;
  const ie = cont ? Math.exp(r) - 1 : (1 + r / C.m) ** C.m - 1;
  const ans = askSub ? (r / C.m) * 100 : ie * 100;
  return {
    points: 10,
    prompt: cont
      ? `An investment earns a nominal ${pct(r, 0)} per year, compounded continuously. What is the effective annual rate $i_e$ (in %)?`
      : `A nominal rate of ${pct(r, 0)} per year is compounded ${C.name}. What is ${askSub ? 'the interest rate per sub-period $i_s$' : 'the effective annual rate $i_e$'} (in %)?`,
    vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter a percentage without the % sign, e.g. 19.56',
    answer: String(rnd(ans)), answerTex: `${askSub ? 'i_s' : 'i_e'} = ${+ans.toFixed(4)}\\%`,
    steps: cont ? [
      { key: 'f', title: 'Continuous compounding', body: '$i_e = e^r - 1$ (the limit of $(1 + r/m)^m - 1$ as $m\\to\\infty$).' },
      { key: 'calc', title: 'Compute', body: `$i_e = e^{${r}} - 1 = ${pct(ie, 3)}$` },
    ] : [
      { key: 'sub', title: 'Rate per sub-period', body: `$i_s = \\frac{r}{m} = \\frac{${r}}{${C.m}} = ${+(r / C.m * 100).toFixed(4)}\\%$ per ${C.name.replace('ly', '').replace('dai', 'day').replace('semi-annual', 'half-year')} period.` },
      { key: 'eff', title: 'Compound it over a year', body: `$i_e = (1 + i_s)^m - 1 = \\left(1 + \\frac{${r}}{${C.m}}\\right)^{${C.m}} - 1 = ${pct(ie, 3)}$` },
    ],
    mistakes: cont ? [
      { expr: String(r * 100), step: 'f', why: 'The nominal rate understates the effect of compounding; continuous compounding gives $e^r - 1$.' },
      { expr: String(rnd(((1 + r / 365) ** 365 - 1) * 100 + 0.5)), step: 'calc', why: '' },
    ].slice(0, 1) : askSub ? [
      { expr: String(rnd(ie * 100)), step: 'sub', why: 'That is the effective annual rate. The sub-period rate is simply $r/m$.' },
      { expr: String(r * 100), step: 'sub', why: 'That is the nominal annual rate. Divide by the number of sub-periods.' },
    ] : [
      { expr: String(rnd(r / C.m * 100)), step: 'eff', why: 'That is $i_s$, the rate per sub-period. Compound it $m$ times: $(1+i_s)^m - 1$.' },
      { expr: String(r * 100), step: 'eff', why: 'That is the nominal rate. Compounding makes the effective rate higher.' },
      { expr: String(rnd(((1 + r) ** C.m - 1) * 100)), step: 'sub', why: 'Divide the nominal rate by $m$ before compounding.' },
    ],
  };
}

function genSinglePayment() {
  const F = pick([3000, 5000, 10000, 20000, 25000]), r = pick([0.015, 0.03, 0.045, 0.06, 0.09, 0.12]), years = randInt(2, 10);
  const C = pick([{ m: 12, name: 'monthly' }, { m: 4, name: 'quarterly' }, { m: 1, name: 'annually' }]);
  const N = years * C.m, is = r / C.m;
  const askP = Math.random() < 0.65;
  const P = F * PF(is, N);
  const given = askP ? F : rnd(P);
  const ans = askP ? P : F;
  const mist = askP ? [
    ...(C.m > 1 ? [{ expr: String(rnd(F * PF(r, N))), step: 'rate', why: `With ${C.name} compounding, use the rate per period $r/m = ${+(is * 100).toFixed(4)}\\%$, not the annual rate, over $N = ${N}$ periods.` },
      { expr: String(rnd(F * PF(is, years))), step: 'rate', why: `$n$ must count compounding periods: ${years} years × ${C.m} = ${N}.` }] : []),
    { expr: String(rnd(F * FP(is, N))), step: 'fac', why: 'Moving money back in time divides by $(1+i)^N$; you multiplied.' },
  ] : [
    ...(C.m > 1 ? [{ expr: String(rnd(given * FP(r, N))), step: 'rate', why: 'Use the rate per period $r/m$ with $N$ periods.' }, { expr: String(rnd(given * FP(is, years))), step: 'rate', why: `Count periods: $N = ${N}$.` }] : []),
    { expr: String(rnd(given * PF(is, N))), step: 'fac', why: 'Moving money forward multiplies by $(1+i)^N$.' },
  ];
  return {
    points: 10,
    prompt: askP ? `How much must you invest today to have $${money(F)}$ in ${years} years at a nominal ${pct(r, 1)} per year compounded ${C.name}?`
      : `You invest $${m2(given)}$ today at a nominal ${pct(r, 1)} per year compounded ${C.name}. How much will you have after ${years} years?`,
    vars: [], sample: () => ({}), tol: TOL, hint: HINT,
    figure: CF([{ t: 0, amount: -(askP ? P : given), label: askP ? 'P = ?' : undefined }, { t: years, amount: askP ? F : F, label: askP ? undefined : 'F = ?' }], years),
    answer: String(rnd(ans)), answerTex: `${askP ? 'P' : 'F'} = ${m2(ans)}`,
    steps: [
      { key: 'rate', title: 'Match the rate to the compounding period', body: C.m > 1 ? `$i = \\frac{${r}}{${C.m}} = ${+(is * 100).toFixed(4)}\\%$ per period, $N = ${years}\\times${C.m} = ${N}$ periods.` : `$i = ${pct(r, 1)}$, $N = ${N}$.` },
      { key: 'fac', title: askP ? 'Present worth factor' : 'Compound amount factor', body: askP ? `$P = F\\,(P/F, i, N) = \\dfrac{${money(F)}}{(1+${+is.toFixed(6)})^{${N}}} = ${m2(P)}$` : `$F = P\\,(F/P, i, N) = ${m2(given)}(1+${+is.toFixed(6)})^{${N}} = ${m2(F)}$` },
    ],
    mistakes: mist,
  };
}

function genAnnuity() {
  const kind = pick(['loan', 'loan', 'save', 'pv', 'fv']);
  const r = pick([0.04, 0.05, 0.059, 0.06, 0.08, 0.1, 0.12]);
  if (kind === 'loan') {
    const P = pick([12000, 17000, 25000, 30000, 40000]), months = pick([24, 36, 48, 60]);
    const i = r / 12, A = P * AP(i, months);
    return {
      points: 15, prompt: `A $${money(P)}$ car is financed at a nominal ${pct(r, 1)} per year for ${months} months, compounded monthly. What is the monthly payment?`,
      vars: [], sample: () => ({}), tol: TOL, hint: HINT,
      figure: CF([{ t: 0, amount: P, label: fmtMoney(P) }, ...Array.from({ length: months }, (_, k) => ({ t: k + 1, amount: -A, label: k === months - 1 ? 'A = ?' : '' }))], months, 'months'),
      answer: String(rnd(A)), answerTex: `A = ${m2(A)}\\text{ per month}`,
      steps: [
        { key: 'rate', title: 'Monthly rate', body: `$i = \\frac{${r}}{12} = ${+(i * 100).toFixed(4)}\\%$, $N = ${months}$.` },
        { key: 'fac', title: 'Capital recovery factor', body: `$A = P\\,(A/P, i, N) = P\\dfrac{i(1+i)^N}{(1+i)^N - 1} = ${money(P)}\\times${f4(AP(i, months))} = ${m2(A)}$` },
      ],
      mistakes: [
        { expr: String(rnd(P / months)), step: 'fac', why: 'Dividing by the number of payments ignores interest. Use the capital recovery factor.' },
        { expr: String(rnd(P * AP(r, months))), step: 'rate', why: 'Use the monthly rate $r/12$, not the annual rate.' },
        { expr: String(rnd(P * AF(i, months))), step: 'fac', why: '$(A/F)$ spreads a future amount. A loan starts as a present amount: use $(A/P)$.' },
      ],
    };
  }
  const n = randInt(5, 20), A = pick([500, 1000, 2000, 2500, 5000]);
  if (kind === 'save') {
    const F = pick([20000, 50000, 100000]);
    const ans = F * AF(r, n);
    return {
      points: 15, prompt: `How much must you deposit at the end of each year for ${n} years to accumulate $${money(F)}$, at ${pct(r, 1)} per year?`,
      vars: [], sample: () => ({}), tol: TOL, hint: HINT,
      figure: CF([...Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: -ans, label: k === 0 ? 'A = ?' : '' })), { t: n, amount: F }], n),
      answer: String(rnd(ans)), answerTex: `A = ${m2(ans)}`,
      steps: [{ key: 'fac', title: 'Sinking fund factor', body: `$A = F\\,(A/F, ${pct(r, 1)}, ${n}) = ${money(F)}\\times${f4(AF(r, n))} = ${m2(ans)}$` }],
      mistakes: [
        { expr: String(rnd(F * AP(r, n))), step: 'fac', why: 'That uses $(A/P)$, treating the target as a present amount. It is a future amount, so use $(A/F)$.' },
        { expr: String(rnd(F / n)), step: 'fac', why: 'Dividing by $n$ ignores the interest your deposits earn.' },
      ],
    };
  }
  const isPV = kind === 'pv';
  const ans = isPV ? A * PA(r, n) : A * FA(r, n);
  return {
    points: 10, prompt: `What is the ${isPV ? 'present' : 'future'} worth of ${n} end-of-year payments of $${money(A)}$ at ${pct(r, 1)} per year?`,
    vars: [], sample: () => ({}), tol: TOL, hint: HINT,
    figure: CF(Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: A, label: k === 0 ? fmtMoney(A) : '' })), n),
    answer: String(rnd(ans)), answerTex: `${isPV ? 'P' : 'F'} = ${m2(ans)}`,
    steps: [{ key: 'fac', title: isPV ? 'Series present worth factor' : 'Uniform series compound amount factor', body: isPV ? `$P = A\\,(P/A, ${pct(r, 1)}, ${n}) = ${money(A)}\\times${f4(PA(r, n))} = ${m2(ans)}$. The first payment is one period after $P$.` : `$F = A\\,(F/A, ${pct(r, 1)}, ${n}) = ${money(A)}\\times${f4(FA(r, n))} = ${m2(ans)}$. $F$ falls on the same date as the last payment.` }],
    mistakes: [
      { expr: String(A * n), step: 'fac', why: 'Adding the payments ignores the time value of money.' },
      { expr: String(rnd(isPV ? A * FA(r, n) : A * PA(r, n))), step: 'fac', why: isPV ? 'That is the future worth $(F/A)$.' : 'That is the present worth $(P/A)$.' },
    ],
  };
}

function genGradient() {
  const A1 = pick([500, 1000, 2000, 3000]), G = pick([50, 100, 200, 250, 500]), n = randInt(4, 12), i = pick([0.05, 0.06, 0.08, 0.1, 0.12]);
  const dec = Math.random() < 0.25;
  const g = dec ? -G : G;
  const Atot = A1 + g * AG(i, n), P = Atot * PA(i, n);
  const askP = Math.random() < 0.5;
  const ans = askP ? P : Atot;
  return {
    points: 15,
    prompt: `Costs are $${money(A1)}$ at the end of year 1 and ${dec ? 'decrease' : 'increase'} by $${money(G)}$ each year for ${n} years. At ${pct(i, 0)}, find the equivalent ${askP ? 'present worth $P$' : 'uniform annual amount $A$'}.`,
    vars: [], sample: () => ({}), tol: TOL, hint: HINT,
    figure: CF(Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: -(A1 + g * k), label: k === 0 || k === n - 1 ? fmtMoney(A1 + g * k) : '' })), n),
    answer: String(rnd(ans)), answerTex: `${askP ? 'P' : 'A'} = ${m2(ans)}`,
    steps: [
      { key: 'split', title: 'Split into base annuity + gradient', body: `$A' = ${money(A1)}$ (year-1 amount) and $G = ${dec ? '-' : ''}${money(G)}$. The gradient series starts at 0 in year 1.` },
      { key: 'ag', title: 'Convert the gradient', body: `$(A/G, ${pct(i, 0)}, ${n}) = \\frac1i - \\frac{n}{(1+i)^n - 1} = ${f4(AG(i, n))}$, so $A = A' + G(A/G) = ${m2(Atot)}$.` },
      ...(askP ? [{ key: 'pa', title: 'Bring to the present', body: `$P = A\\,(P/A, ${pct(i, 0)}, ${n}) = ${m2(Atot)}\\times${f4(PA(i, n))} = ${m2(P)}$` }] : []),
    ],
    mistakes: [
      { expr: String(rnd(askP ? (A1 - g * AG(i, n)) * PA(i, n) : A1 - g * AG(i, n))), step: 'split', why: `The series ${dec ? 'decreases' : 'increases'}, so $G$ is ${dec ? 'negative' : 'positive'}.` },
      { expr: String(rnd(askP ? A1 * PA(i, n) : A1)), step: 'ag', why: 'The gradient part is missing. Add $G(A/G, i, n)$.' },
      { expr: String(rnd(askP ? (A1 + g * n) * PA(i, n) : A1 + g * n)), step: 'ag', why: '$(A/G)$ converts the gradient to an equivalent annuity; it is not $n$.' },
    ],
  };
}

function genPerpetuity() {
  const B = pick([2e6, 3e6, 5e6, 8e6]), M = pick([0.5e6, 1e6, 1.25e6, 2e6]), i = pick([0.05, 0.06, 0.08, 0.1, 0.12]);
  const C = Math.random() < 0.5 ? pick([10e6, 20e6, 30e6]) : 0;
  const ans = (B - M) / i - C;
  return {
    points: 10,
    prompt: `A bypass gives benefits of $${money(B)}$ per year and costs $${money(M)}$ per year to maintain, essentially forever${C ? `, after a first cost of $${money(C)}$` : ''}. At ${pct(i, 0)}, what is the ${C ? 'present worth of the project' : 'present worth of the net benefits'}?`,
    vars: [], sample: () => ({}), tol: TOL, hint: HINT,
    answer: String(rnd(ans)), answerTex: `P = ${money(ans)}`,
    steps: [
      { key: 'net', title: 'Net annual amount', body: `$A = ${money(B)} - ${money(M)} = ${money(B - M)}$` },
      { key: 'cap', title: 'Capitalized value', body: `For an infinitely long series, $P = \\dfrac{A}{i} = \\dfrac{${money(B - M)}}{${i}} = ${money((B - M) / i)}$${C ? `, then subtract the first cost: $${money(ans)}$.` : '.'}` },
    ],
    mistakes: [
      { expr: String(rnd((B - M) * i - C)), step: 'cap', why: 'The capitalized value divides by $i$: $P = A/i$.' },
      { expr: String(rnd(B / i - C)), step: 'net', why: 'Subtract the maintenance cost first.' },
      ...(C ? [{ expr: String(rnd((B - M) / i)), step: 'cap', why: 'Don\'t forget the first cost at $t = 0$.' }] : []),
    ],
  };
}

function genPW() {
  const C = pick([20000, 50000, 70000, 100000, 150000]), A = rnd(C * rand(0.16, 0.35) / 1000) * 1000, n = randInt(4, 12), i = pick([0.08, 0.1, 0.12, 0.15, 0.2]);
  const S = Math.random() < 0.6 ? Math.round(C * pick([0.05, 0.1, 0.2]) / 100) * 100 : 0;
  const aw = Math.random() < 0.4;
  const PW = -C + A * PA(i, n) + S * PF(i, n), AW = -C * AP(i, n) + A + S * AF(i, n);
  const ans = aw ? AW : PW;
  const flows = [{ t: 0, amount: -C }, ...Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: A, label: k === 0 ? fmtMoney(A) : '' }))];
  if (S) flows.push({ t: n, amount: S, label: `S ${fmtMoney(S)}` });
  return {
    points: 15,
    prompt: `A project costs $${money(C)}$ now and returns $${money(A)}$ per year for ${n} years${S ? `, with a salvage value of $${money(S)}$` : ' with no salvage value'}. MARR = ${pct(i, 0)}. Find its ${aw ? 'annual worth (AW)' : 'present worth (PW)'}.`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter a number (negative if it loses money).',
    figure: CF(flows, n),
    answer: String(rnd(ans)), answerTex: `${aw ? 'AW' : 'PW'} = ${m2(ans)}\\;\\Rightarrow\\;${ans > 0 ? '\\text{accept}' : '\\text{reject}'}`,
    steps: aw ? [
      { key: 'cap', title: 'First cost as an annuity', body: `$-${money(C)}(A/P, ${pct(i, 0)}, ${n}) = -${money(C)}\\times${f4(AP(i, n))} = -${m2(C * AP(i, n))}$` },
      ...(S ? [{ key: 'salv', title: 'Salvage as an annuity', body: `$+${money(S)}(A/F, ${pct(i, 0)}, ${n}) = +${m2(S * AF(i, n))}$` }] : []),
      { key: 'sum', title: 'Add the annual amount', body: `$AW = ${m2(AW)}$, so ${AW > 0 ? 'accept (AW > 0)' : 'reject (AW < 0)'} at MARR ${pct(i, 0)}.` },
    ] : [
      { key: 'ann', title: 'Annual returns to present', body: `$${money(A)}(P/A, ${pct(i, 0)}, ${n}) = ${money(A)}\\times${f4(PA(i, n))} = ${m2(A * PA(i, n))}$` },
      ...(S ? [{ key: 'salv', title: 'Salvage to present', body: `$${money(S)}(P/F, ${pct(i, 0)}, ${n}) = ${m2(S * PF(i, n))}$` }] : []),
      { key: 'sum', title: 'Subtract the first cost', body: `$PW = -${money(C)} + ${m2(A * PA(i, n))}${S ? ` + ${m2(S * PF(i, n))}` : ''} = ${m2(PW)}$, so ${PW > 0 ? 'accept' : 'reject'}.` },
    ],
    mistakes: [
      ...(S ? [{ expr: String(rnd(aw ? -C * AP(i, n) + A : -C + A * PA(i, n))), step: 'salv', why: 'The salvage value at the end is missing.' },
        { expr: String(rnd(aw ? -C * AP(i, n) + A + S * AP(i, n) : -C + A * PA(i, n) + S)), step: 'salv', why: aw ? 'The salvage is a future amount: spread it with $(A/F)$, not $(A/P)$.' : 'The salvage happens in year $n$, so discount it with $(P/F)$.' }] : []),
      { expr: String(rnd(aw ? -C / n + A + S / n : -C + n * A + S)), step: aw ? 'cap' : 'ann', why: 'That ignores the time value of money. Use the interest factors at the MARR.' },
    ],
  };
}

function genMutex() {
  const n = pick([8, 10, 12]), i = pick([0.1, 0.12, 0.15]);
  const base = pick([100000, 150000]);
  const alts = [0, 1, 2].map((k) => { const C = base + k * pick([40000, 50000, 60000]); return { C, A: Math.round((C * rand(0.17, 0.27)) / 1000) * 1000 }; });
  alts.forEach((a) => { a.PW = -a.C + a.A * PA(i, n); });
  const best = alts.reduce((b, a) => (a.PW > b.PW ? a : b));
  if (best.PW <= 0) best.A += Math.round(best.C * 0.08 / 1000) * 1000, best.PW = -best.C + best.A * PA(i, n);
  const winner = alts.reduce((b, a) => (a.PW > b.PW ? a : b));
  const name = (k) => `Option ${String.fromCharCode(65 + k)}`;
  const table = alts.map((a, k) => `${name(k)}: first cost $${money(a.C)}$, savings $${money(a.A)}$/yr`).join('<br>');
  const pwTxt = alts.map((a, k) => `${name(k)}: $PW = ${m2(a.PW)}$`).join('<br>');
  return {
    points: 15, type: 'choice',
    prompt: `Three mutually exclusive machines each last ${n} years with no salvage. MARR = ${pct(i, 0)}.<br>${table}<br>Which should be chosen?`,
    options: [...alts.map((a, k) => ({ tex: name(k), correct: a === winner, why: `Compare present worths: ${pwTxt.replace(/<br>/g, '; ')}. Pick the largest PW.`, step: 'pw' })), { tex: 'None of them', correct: winner.PW <= 0, why: 'At least one alternative has a positive PW.', step: 'pw' }],
    answerTex: `${name(alts.indexOf(winner))}`, hint: 'Compute each PW at the MARR.',
    steps: [
      { key: 'fac', title: 'Series present worth factor', body: `$(P/A, ${pct(i, 0)}, ${n}) = ${f4(PA(i, n))}$` },
      { key: 'pw', title: 'PW of each alternative', body: pwTxt },
      { key: 'pick', title: 'Mutually exclusive', body: 'Choose the alternative with the largest positive PW. Not the smallest cost, and not the biggest savings.' },
    ],
    mistakes: [],
  };
}

function genUnequal() {
  const i = pick([0.08, 0.09, 0.1, 0.12]);
  const [n1, n2] = pick([[3, 4], [4, 6], [5, 10], [10, 15], [2, 3]]);
  const C1 = pick([15000, 20000, 25000]), C2 = C1 + pick([5000, 10000, 15000]);
  const O1 = pick([6000, 6400, 7000, 8000]), O2 = O1 - pick([500, 1000, 1500, 2000]);
  const AW1 = C1 * AP(i, n1) + O1, AW2 = C2 * AP(i, n2) + O2; // annual costs
  const askNum = Math.random() < 0.4;
  if (askNum) return {
    points: 15,
    prompt: `Machine B costs $${money(C2)}$, has operating costs of $${money(O2)}$ per year, and lasts ${n2} years (no salvage). MARR = ${pct(i, 0)}. What is its equivalent annual cost?`,
    vars: [], sample: () => ({}), tol: TOL, hint: HINT,
    figure: CF([{ t: 0, amount: -C2 }, ...Array.from({ length: n2 }, (_, k) => ({ t: k + 1, amount: -O2, label: k === 0 ? fmtMoney(O2) : '' }))], n2),
    answer: String(rnd(AW2)), answerTex: `\\text{AW cost} = ${m2(AW2)}`,
    steps: [{ key: 'aw', title: 'Annual worth over one life', body: `$${money(C2)}(A/P, ${pct(i, 0)}, ${n2}) + ${money(O2)} = ${money(C2)}\\times${f4(AP(i, n2))} + ${money(O2)} = ${m2(AW2)}$. With the repeated-lives assumption, one life's AW is the AW over any number of lives.` }],
    mistakes: [
      { expr: String(rnd(C2 / n2 + O2)), step: 'aw', why: 'Spread the first cost with the capital recovery factor $(A/P)$, not $\\div n$.' },
      { expr: String(rnd(C2 * PA(i, n2) + O2)), step: 'aw', why: 'Use $(A/P)$ to turn a present cost into an annuity; $(P/A)$ goes the other way.' },
    ],
  };
  const better = AW1 < AW2 ? 'A' : 'B';
  return {
    points: 15, type: 'choice',
    prompt: `Two machines do the same job (MARR ${pct(i, 0)}, no salvage):<br>A: first cost $${money(C1)}$, operating $${money(O1)}$/yr, life ${n1} years<br>B: first cost $${money(C2)}$, operating $${money(O2)}$/yr, life ${n2} years<br>Using the repeated-lives assumption, which is cheaper?`,
    options: [
      { tex: 'Machine A', correct: better === 'A', why: `Annual costs: A = ${m2(AW1)}, B = ${m2(AW2)}.`, step: 'aw' },
      { tex: 'Machine B', correct: better === 'B', why: `Annual costs: A = ${m2(AW1)}, B = ${m2(AW2)}.`, step: 'aw' },
      { tex: 'Compare their PWs over each machine\'s own life', correct: false, why: 'PWs over different lives are not comparable. Use AW, or PW over a common multiple of the lives.', step: 'why' },
    ],
    answerTex: `Machine ${better}`, hint: 'Lives differ, so compare annual worths.',
    steps: [
      { key: 'why', title: 'Unequal lives', body: `Comparing PWs over ${n1} and ${n2} years is unfair. Repeated lives: the AW of one life equals the AW over the common multiple (${n1 * n2 / gcdN(n1, n2)} years).` },
      { key: 'aw', title: 'Annual cost of each', body: `A: $${money(C1)}\\times${f4(AP(i, n1))} + ${money(O1)} = ${m2(AW1)}$<br>B: $${money(C2)}\\times${f4(AP(i, n2))} + ${money(O2)} = ${m2(AW2)}$<br>Lower annual cost: Machine ${better}.` },
    ],
    mistakes: [],
  };
}
const gcdN = (a, b) => (b ? gcdN(b, a % b) : a);

function genPayback() {
  const C = pick([15000, 20000, 50000, 80000]), Rv = pick([9000, 11000, 20000, 30000]), Cs = Math.round(Rv * rand(0.2, 0.6) / 100) * 100;
  const net = Rv - Cs;
  if (net <= 0) return genPayback();
  const S = pick([0, 1000, 2000]);
  const ans = C / net;
  return {
    points: 10,
    prompt: `A machine costs $${money(C)}$, brings annual revenues of $${money(Rv)}$ and annual costs of $${money(Cs)}$${S ? `, and has a scrap value of $${money(S)}$` : ''}. What is the payback period in years?`,
    vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter a number of years.',
    answer: String(rnd(ans)), answerTex: `\\text{payback} = ${(+ans.toFixed(3))}\\text{ years}`,
    steps: [
      { key: 'net', title: 'Net annual savings', body: `$${money(Rv)} - ${money(Cs)} = ${money(net)}$ per year.` },
      { key: 'pb', title: 'Payback (i = 0%)', body: `$\\dfrac{\\text{first cost}}{\\text{net annual savings}} = \\dfrac{${money(C)}}{${money(net)}} = ${+ans.toFixed(3)}$ years. Payback ignores interest, the scrap value, and everything after payback.` },
    ],
    mistakes: [
      { expr: String(rnd(C / Rv)), step: 'net', why: 'Use the net savings (revenues minus costs), not revenues alone.' },
      ...(S ? [{ expr: String(rnd((C - S) / net)), step: 'pb', why: 'The simple payback period does not count the scrap value.' }] : []),
    ],
  };
}

function genIRR() {
  const C = pick([2000, 10000, 50000, 120000]), n = randInt(4, 12);
  const target = rand(0.04, 0.22);
  const A = Math.round((C * AP(target, n)) / 10) * 10;
  const S = Math.random() < 0.3 ? Math.round(C * 0.05) : 0;
  const pw = (i) => -C + A * PA(i, n) + S * PF(i, n);
  const irr = bisect(pw, 0.0001, 1.5);
  const marr = pick([0.08, 0.1, 0.12, 0.15]);
  const flows = [{ t: 0, amount: -C }, ...Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: A, label: k === 0 ? fmtMoney(A) : '' }))];
  if (S) flows.push({ t: n, amount: S, label: `S ${fmtMoney(S)}` });
  return {
    points: 20,
    prompt: `An investment costs $${money(C)}$ today and returns $${money(A)}$ per year for ${n} years${S ? ` plus a salvage of $${money(S)}$ at the end` : ''}. Find the IRR (in %). Is it acceptable at MARR = ${pct(marr, 0)}?`,
    vars: [], sample: () => ({}), tol: 1.2e-2, hint: 'Enter the IRR as a percentage, e.g. 7.93 (interpolation is fine).',
    figure: CF(flows, n),
    answer: String(rnd(irr * 100)), answerTex: `i^* \\approx ${(irr * 100).toFixed(2)}\\%\\;\\Rightarrow\\;${irr > marr ? '\\text{accept}' : '\\text{reject}'}`,
    steps: [
      { key: 'set', title: 'Set PW = 0', body: `$-${money(C)} + ${money(A)}(P/A, i^*, ${n})${S ? ` + ${money(S)}(P/F, i^*, ${n})` : ''} = 0${S ? '' : `\\;\\Rightarrow\\;(P/A, i^*, ${n}) = ${(C / A).toFixed(4)}`}$` },
      { key: 'try', title: 'Trial and error, then interpolate', body: (() => { const lo = Math.floor(irr * 100), hi = lo + 1; return `PW at ${lo}% $= ${m2(pw(lo / 100))}$; PW at ${hi}% $= ${m2(pw(hi / 100))}$. Interpolating: $i^* \\approx ${lo} + \\dfrac{${(pw(lo / 100)).toFixed(0)}}{${(pw(lo / 100) - pw(hi / 100)).toFixed(0)}} \\approx ${(lo + pw(lo / 100) / (pw(lo / 100) - pw(hi / 100))).toFixed(2)}\\%$`; })() },
      { key: 'dec', title: 'Decision (independent project)', body: `IRR ${irr > marr ? '>' : '<'} MARR (${pct(marr, 0)}), so ${irr > marr ? 'accept' : 'reject'}.` },
    ],
    mistakes: [
      { expr: String(rnd(((n * A + S - C) / C) * 100)), step: 'set', why: 'Total profit over cost ignores timing. IRR is the rate that makes PW = 0.' },
      { expr: String(rnd((A / C) * 100)), step: 'set', why: 'That is the simple return per year, which ignores that the investment is recovered over the life.' },
    ],
  };
}

function genIncremental() {
  const oneYear = Math.random() < 0.45;
  const marr = pick([0.08, 0.1, 0.12, 0.15]);
  if (oneYear) {
    const C1 = pick([10, 100, 500]), R1 = rnd(C1 * pick([1.5, 1.8, 2])), C2 = pick([1000, 2000, 5000]), R2 = rnd(C2 * rand(1.12, 1.3));
    const d = (R2 - R1) / (C2 - C1) - 1;
    return {
      points: 20,
      prompt: `Mutually exclusive investments, MARR = ${pct(marr, 0)}:<br>A costs $${money(C1)}$ today and returns $${money(R1)}$ in one year.<br>B costs $${money(C2)}$ today and returns $${money(R2)}$ in one year.<br>What is the incremental IRR of B over A (in %)?`,
      vars: [], sample: () => ({}), tol: 5e-3, hint: 'Enter a percentage.',
      answer: String(rnd(d * 100)), answerTex: `\\Delta i^* = ${(d * 100).toFixed(2)}\\%\\;\\Rightarrow\\;\\text{choose } ${d > marr ? 'B' : 'A'}`,
      steps: [
        { key: 'rank', title: 'Rank by first cost', body: `A (cheaper) has IRR $${pct(R1 / C1 - 1, 1)}$ > MARR, so it is the current best; B is the challenger.` },
        { key: 'inc', title: 'Incremental cash flow B − A', body: `$-${money(C2 - C1)}$ now, $+${money(R2 - R1)}$ in one year.` },
        { key: 'irr', title: 'Incremental IRR', body: `$\\Delta i^* = \\dfrac{${money(R2 - R1)}}{${money(C2 - C1)}} - 1 = ${pct(d, 2)}$, ${d > marr ? 'above' : 'below'} MARR, so ${d > marr ? 'the extra investment pays: choose B' : 'stick with A'}.` },
      ],
      mistakes: [
        { expr: String(rnd((R2 / C2 - 1) * 100)), step: 'inc', why: 'That is B\'s own IRR. For mutually exclusive projects you need the IRR of the increment B − A.' },
        { expr: String(rnd((R1 / C1 - 1) * 100)), step: 'inc', why: 'That is A\'s IRR. A high IRR on a tiny project can hide a better larger one.' },
      ],
    };
  }
  const n = pick([5, 8, 10]);
  const C1 = pick([10000, 20000]), C2 = C1 + pick([10000, 15000, 20000]);
  const A1 = Math.round(C1 * AP(rand(0.12, 0.2), n) / 100) * 100;
  const dC = C2 - C1, dA = Math.round(dC * AP(rand(0.05, 0.2), n) / 100) * 100;
  const A2 = A1 + dA;
  const d = bisect((i) => -dC + dA * PA(i, n), 0.0001, 1.5);
  return {
    points: 20,
    prompt: `Two mutually exclusive machines, life ${n} years, no salvage, MARR = ${pct(marr, 0)}:<br>X: first cost $${money(C1)}$, savings $${money(A1)}$/yr<br>Y: first cost $${money(C2)}$, savings $${money(A2)}$/yr<br>Find the incremental IRR of Y over X (in %).`,
    vars: [], sample: () => ({}), tol: 1.2e-2, hint: 'Enter a percentage (interpolation is fine).',
    answer: String(rnd(d * 100)), answerTex: `\\Delta i^* \\approx ${(d * 100).toFixed(2)}\\%\\;\\Rightarrow\\;${d > marr ? '\\text{choose Y}' : '\\text{choose X}'}`,
    steps: [
      { key: 'inc', title: 'Increment Y − X', body: `$-${money(dC)}$ now, $+${money(dA)}$ per year for ${n} years.` },
      { key: 'irr', title: 'Solve PW = 0 for the increment', body: `$(P/A, \\Delta i^*, ${n}) = \\frac{${dC}}{${dA}} = ${(dC / dA).toFixed(4)}$ gives $\\Delta i^* \\approx ${pct(d, 2)}$.` },
      { key: 'dec', title: 'Decision', body: `${d > marr ? 'Above' : 'Below'} MARR, so ${d > marr ? 'the extra investment is worth it: choose Y' : 'it isn\'t worth it: choose X'} (assuming X itself beats MARR).` },
    ],
    mistakes: [
      { expr: String(rnd(bisect((i) => -C2 + A2 * PA(i, n), 0.0001, 1.5) * 100)), step: 'inc', why: 'That is Y\'s own IRR. Compare the increment Y − X against MARR.' },
    ],
  };
}

function genERR() {
  const a = pick([1000, 2000, 3000]), b = a * pick([4, 5]), c = a * pick([5, 6, 7]);
  const marr = pick([0.1, 0.15, 0.2, 0.25]);
  const fwR = a * (1 + marr) ** 2 + c;
  const ans = fwR / b - 1;
  return {
    points: 20,
    prompt: `A project pays $${money(a)}$ today, costs $${money(b)}$ one year from now, and pays $${money(c)}$ in two years. It may have multiple IRRs, so find the approximate external rate of return (in %) with MARR = ${pct(marr, 0)}.`,
    vars: [], sample: () => ({}), tol: 5e-3, hint: 'Enter a percentage.',
    figure: CF([{ t: 0, amount: a }, { t: 1, amount: -b }, { t: 2, amount: c }], 2),
    answer: String(rnd(ans * 100)), answerTex: `i_{ea}^* = ${pct(ans, 2)}`,
    steps: [
      { key: 'why', title: 'Why ERR', body: 'The signs change twice (+, −, +), so more than one IRR can exist. ERR assumes money outside the project earns the MARR.' },
      { key: 'rec', title: 'Receipts forward at MARR', body: `$FW_{receipts} = ${money(a)}(1+${marr})^2 + ${money(c)} = ${m2(fwR)}$` },
      { key: 'dis', title: 'Disbursements forward at the unknown rate', body: `$FW_{disb} = ${money(b)}(1+i_{ea}^*)^1$` },
      { key: 'solve', title: 'Set them equal', body: `$1 + i_{ea}^* = \\dfrac{${m2(fwR)}}{${money(b)}}$, so $i_{ea}^* = ${pct(ans, 2)}$.` },
    ],
    mistakes: [
      { expr: String(rnd(((a + c) / b - 1) * 100)), step: 'rec', why: 'Take the receipts forward at the MARR to the end of the project before comparing.' },
      { expr: String(rnd(((a * (1 + marr) + c) / b - 1) * 100)), step: 'rec', why: `The first receipt sits outside the project for two years: $(1 + ${marr})^2$.` },
    ],
  };
}

/* ---------------- lessons ---------------- */
const tvmLesson = [
  { type: 'text', kind: 'key', title: 'Money has a time value', body: R`\$1,000 today beats \$1,000 in five years, because today's money can earn interest. Interest $I$ is what you pay for using borrowed money, the gap between the principal $P$ and the future amount $F$; the interest rate is $i = I/P$ per period.` },
  { type: 'text', kind: 'method', title: 'Simple vs compound interest', body: R`Simple: interest only on the original sum, $F = P(1 + ni)$.<br>Compound: interest also earns interest, $F = P(1+i)^n$. Compound is the standard (mortgages, credit cards, loans).` },
  {
    type: 'graph', title: 'Watch compounding pull away',
    body: R`$P = \$1{,}000$. Slide the rate: simple interest grows in a straight line, compound interest bends upward.`,
    widget: {
      params: [{ key: 'i', label: 'interest rate i', min: 0.01, max: 0.3, step: 0.01, value: 0.1, fmt: (v) => `${Math.round(v * 100)}%` }, { key: 'n', label: 'years shown', min: 5, max: 40, step: 1, value: 20 }],
      x: (p) => [0, p.n], y: 'auto', xLabel: 'years', yLabel: '$',
      curves: (p) => [{ fn: (t) => 1000 * (1 + p.i) ** t, label: 'compound' }, { fn: (t) => 1000 * (1 + p.i * t), label: 'simple', color: 1, dash: true }],
      readout: (p) => `After ${p.n} years: compound $${money(1000 * (1 + p.i) ** p.n)}$ vs simple $${money(1000 * (1 + p.i * p.n))}$.`,
    },
  },
  { type: 'example', title: 'Worked example (slide 14–15)', prompt: R`Lend a friend \$1,000 for 3 years at 5%.`, steps: [
    R`Simple: $F = 1000(1 + 3\times0.05) = \$1{,}150$, so interest is $\$150$ (\$50 each year).`,
    R`Compound: $F = 1000(1.05)^3 = \$1{,}157.63$, so interest is $\$157.63$.`,
    R`The extra \$7.63 is interest earned on interest.`,
  ] },
  { type: 'text', kind: 'key', title: 'Nominal vs effective rates', body: R`A nominal rate $r$ is quoted per year but compounded $m$ times. The sub-period rate is $i_s = r/m$, and the effective annual rate is $$i_e = \left(1 + \frac rm\right)^m - 1.$$ Continuous compounding is the limit: $i_e = e^r - 1$.` },
  {
    type: 'graph', title: 'More compounding, higher effective rate',
    body: R`The effective rate climbs with compounding frequency $m$ and levels off at the continuous limit $e^r - 1$.`,
    widget: {
      params: [{ key: 'r', label: 'nominal rate r', min: 0.02, max: 0.3, step: 0.01, value: 0.21, fmt: (v) => `${Math.round(v * 100)}%` }],
      x: [1, 60], y: 'auto', includeZero: false, xLabel: 'compoundings per year m', yLabel: 'i_e (%)',
      curves: (p) => [{ fn: (m) => ((1 + p.r / m) ** m - 1) * 100, label: 'i_e' }],
      hlines: (p) => [{ y: (Math.exp(p.r) - 1) * 100, label: 'continuous' }, { y: p.r * 100, label: 'nominal' }],
      points: (p) => [2, 4, 12, 52].map((m) => ({ x: m, y: ((1 + p.r / m) ** m - 1) * 100, label: { 2: 'semi', 4: 'qtr', 12: 'month', 52: 'week' }[m] })),
      readout: (p) => `$r = ${pct(p.r, 0)}$: monthly $i_e = ${pct((1 + p.r / 12) ** 12 - 1, 3)}$, daily $${pct((1 + p.r / 365) ** 365 - 1, 3)}$, continuous $${pct(Math.exp(p.r) - 1, 3)}$.`,
    },
  },
  { type: 'input', prompt: R`A credit card charges 18% nominal, compounded monthly. What is $i_e$ (in %)?`, answer: '19.5618', answerTex: '19.56\\%', tol: 1e-3, explain: R`$i_e = (1 + 0.18/12)^{12} - 1 = 1.015^{12} - 1 = 19.56\%$.` },
  { type: 'example', title: 'Worked example: two ways to the same answer', prompt: R`\$500 on a card at 18% compounded monthly. Owed after 2 years?`, steps: [
    R`Option 1, monthly periods: $i_s = 1.5\%$, $N = 24$, so $F = 500(1.015)^{24} = \$714.75$.`,
    R`Option 2, effective annual: $i_e = 19.56\%$, $N = 2$, so $F = 500(1.1956)^2 = \$714.75$.`,
    R`Either way, the compounding period must match the interest rate period.`,
  ] },
  { type: 'quiz', prompt: R`Is \$1,050 one year from now equivalent to \$1,000 today at 10%?`, options: [
    { tex: 'No', correct: true },
    { tex: 'Yes', why: 'At 10%, \\$1,000 today is worth \\$1,100 in a year, so \\$1,050 is worth less.' },
  ], explain: R`Equivalence depends on the interest rate: $1000(1.10) = 1100 \ne 1050$. At 5% they would be equivalent.` },
  { type: 'text', kind: 'key', title: 'Equivalence', body: R`Cash flows at different times are equivalent if they have the same value at a given interest rate, checked by moving them to a common date with $P = F/(1+i)^n$ or $F = P(1+i)^n$.` },
];

const cfLesson = [
  { type: 'text', kind: 'key', title: 'Cash flow diagrams', body: R`A time line with arrows: up for receipts (+), down for disbursements (−). Discrete model: every cash flow happens at the end of a period, and "now" is time 0 (the end of period −1).` },
  { type: 'graph', title: 'Read a cash flow diagram', body: R`A \$17,000 car loan (receipt at 0) repaid in 48 monthly payments (disbursements). The payment size comes from $(A/P)$.`, widget: { kind: 'cashflow', n: 48, unit: 'months', flows: [{ t: 0, amount: 17000, label: '$17,000' }, ...Array.from({ length: 48 }, (_, k) => ({ t: k + 1, amount: -398.47, label: k === 47 ? 'A = $398.47' : '' }))] } },
  { type: 'text', kind: 'method', title: 'The interest factors', body: R`$(F/P) = (1+i)^n$, $(P/F) = (1+i)^{-n}$<br>$(A/F) = \frac{i}{(1+i)^n - 1}$, $(F/A) = \frac{(1+i)^n - 1}{i}$<br>$(A/P) = \frac{i(1+i)^n}{(1+i)^n - 1}$, $(P/A) = \frac{(1+i)^n - 1}{i(1+i)^n}$<br>$(A/G) = \frac1i - \frac{n}{(1+i)^n - 1}$<br>Read $(X/Y, i, n)$ as "find X given Y". The table values are rounded to 4 decimals.` },
  {
    type: 'graph', title: 'An annuity and its present worth',
    body: R`Equal end-of-period payments $A$. $P = A(P/A, i, n)$ sits one period before the first payment; $F = A(F/A, i, n)$ sits on the last payment.`,
    widget: {
      params: [{ key: 'A', label: 'payment A', min: 100, max: 2000, step: 50, value: 1000 }, { key: 'n', label: 'n periods', min: 1, max: 25, step: 1, value: 10 }, { key: 'i', label: 'i', min: 0.01, max: 0.2, step: 0.005, value: 0.08, fmt: (v) => `${(v * 100).toFixed(1)}%` }],
      kind: 'cashflow', n: (p) => p.n, flows: (p) => Array.from({ length: p.n }, (_, k) => ({ t: k + 1, amount: p.A, label: k === 0 ? fmtMoney(p.A) : '' })),
      readout: (p) => `$P = ${money(p.A)}\\times${f4(PA(p.i, p.n))} = ${m2(p.A * PA(p.i, p.n))}$ at $t = 0$, $\\quad F = ${money(p.A)}\\times${f4(FA(p.i, p.n))} = ${m2(p.A * FA(p.i, p.n))}$ at $t = ${p.n}$`,
    },
  },
  { type: 'example', title: 'Worked example: car payments (slide 27)', prompt: R`\$17,000 at 5.9% nominal, compounded monthly, 48 months.`, steps: [
    R`$i = 0.059/12 = 0.4917\%$ per month, $N = 48$.`,
    R`$(A/P, 0.4917\%, 48) = \dfrac{0.004917(1.004917)^{48}}{(1.004917)^{48} - 1} = 0.02344$.`,
    R`$A = 17000\times0.02344 = \$398.47$ per month.`,
  ] },
  { type: 'quiz', prompt: R`You want \$50,000 in 10 years and will make equal year-end deposits. Which factor?`, options: [
    { tex: R`$(A/F, i, 10)$`, correct: true },
    { tex: R`$(A/P, i, 10)$`, why: 'That spreads a present amount. The \\$50,000 is in the future.' },
    { tex: R`$(F/A, i, 10)$`, why: 'That finds $F$ from $A$; here you know $F$ and want $A$.' },
    { tex: R`$(P/F, i, 10)$`, why: 'That moves a single amount to the present, not into a series.' },
  ] },
  { type: 'text', kind: 'method', title: 'Arithmetic gradients', body: R`Payments $A', A'+G, A'+2G, \dots$ split into a base annuity $A'$ plus a gradient that starts at 0 in period 1: $A_{tot} = A' + G(A/G, i, n)$.` },
  {
    type: 'graph', title: 'Base annuity + gradient',
    body: R`Repairs start at $A'$ and grow by $G$ each period. The equivalent uniform amount is $A' + G(A/G)$.`,
    widget: {
      params: [{ key: 'A', label: "A' (first payment)", min: 100, max: 1000, step: 50, value: 500 }, { key: 'G', label: 'G (step)', min: -50, max: 200, step: 10, value: 50 }, { key: 'n', label: 'n', min: 2, max: 15, step: 1, value: 8 }, { key: 'i', label: 'i', min: 0.01, max: 0.15, step: 0.005, value: 0.0615, fmt: (v) => `${(v * 100).toFixed(2)}%` }],
      kind: 'cashflow', n: (p) => p.n, flows: (p) => Array.from({ length: p.n }, (_, k) => ({ t: k + 1, amount: -(p.A + p.G * k), label: k === 0 || k === p.n - 1 ? fmtMoney(p.A + p.G * k) : '' })),
      readout: (p) => `$A_{tot} = ${p.A} + ${p.G}\\times${f4(AG(p.i, p.n))} = ${m2(p.A + p.G * AG(p.i, p.n))}$ per period, $\\;P = ${m2((p.A + p.G * AG(p.i, p.n)) * PA(p.i, p.n))}$`,
    },
  },
  { type: 'text', kind: 'key', title: 'Non-standard periods', body: R`If payments are, say, every 6 months but interest compounds monthly, convert the rate to the payment period first: $i_{6mo} = (1 + i_{month})^6 - 1$. Then the standard factors apply.` },
  {
    type: 'graph', title: 'Perpetuities: P = A/i',
    body: R`As $n$ grows, $(P/A, i, n)$ creeps up to $1/i$. That is why an infinitely long series (infrastructure) has capitalized value $P = A/i$.`,
    widget: {
      params: [{ key: 'i', label: 'i', min: 0.02, max: 0.2, step: 0.005, value: 0.1, fmt: (v) => `${(v * 100).toFixed(1)}%` }],
      x: [1, 100], y: 'auto', xLabel: 'n', yLabel: '(P/A)',
      curves: (p) => [{ fn: (n) => PA(p.i, n), label: '(P/A, i, n)' }],
      hlines: (p) => [{ y: 1 / p.i, label: '1/i' }],
      readout: (p) => `$1/i = ${(1 / p.i).toFixed(2)}$; at $n = 50$, $(P/A) = ${PA(p.i, 50).toFixed(3)}$`,
    },
  },
  { type: 'input', prompt: R`Net benefits of \$3.75M per year forever at 10%. Capitalized value (in \$)?`, answer: '37500000', answerTex: '\\$37{,}500{,}000', tol: 1e-4, explain: R`$P = A/i = 3.75\text{M}/0.10 = \$37.5\text{M}$.` },
];

const cmp1Lesson = [
  { type: 'text', kind: 'key', title: 'Project relations', body: R`Independent: choosing one doesn't affect the others. Mutually exclusive: choosing one rules out the rest. Related but not mutually exclusive: group them into mutually exclusive combinations.` },
  { type: 'text', kind: 'key', title: 'MARR', body: R`The minimum acceptable rate of return (cost of capital): high enough to satisfy lenders and investors. All comparisons discount at $i = $ MARR.` },
  { type: 'text', kind: 'method', title: 'Present worth (PW)', body: R`Move every cash flow to $t = 0$ at the MARR. Independent: accept if $PW > 0$. Mutually exclusive: pick the largest PW. Only valid as-is for equal service lives.` },
  {
    type: 'graph', title: 'PW depends on the MARR',
    body: R`SugarSpace (slide 19): \$70,000 now, \$30,000 per year for 5 years. Slide the MARR: the PW falls as the rate rises, and crosses zero at the project's IRR.`,
    widget: {
      params: [{ key: 'C', label: 'first cost', min: 20000, max: 120000, step: 5000, value: 70000, fmt: (v) => fmtMoney(v) }, { key: 'A', label: 'annual cash flow', min: 5000, max: 50000, step: 1000, value: 30000, fmt: (v) => fmtMoney(v) }, { key: 'n', label: 'life (years)', min: 2, max: 15, step: 1, value: 5 }, { key: 'm', label: 'MARR', min: 0.01, max: 0.5, step: 0.01, value: 0.2, fmt: (v) => `${Math.round(v * 100)}%` }],
      x: [0.005, 0.6], y: 'auto', xLabel: 'interest rate i', yLabel: 'PW ($)',
      curves: (p) => [{ fn: (i) => -p.C + p.A * PA(i, p.n), label: 'PW(i)' }],
      vlines: (p) => [{ x: p.m, label: 'MARR' }],
      points: (p) => [{ x: p.m, y: -p.C + p.A * PA(p.m, p.n), label: fmtMoney(Math.round(-p.C + p.A * PA(p.m, p.n))) }],
      readout: (p) => { const pw = -p.C + p.A * PA(p.m, p.n); return `$PW = -${money(p.C)} + ${money(p.A)}(P/A, ${Math.round(p.m * 100)}\\%, ${p.n}) = ${m2(pw)}$, so ${pw > 0 ? 'accept' : 'reject'}.`; },
    },
  },
  { type: 'quiz', prompt: R`Four mutually exclusive lathes all have positive PW at MARR. Which do you buy?`, options: [
    { tex: 'The one with the largest PW', correct: true },
    { tex: 'The cheapest one', why: 'Cost alone ignores the savings.' },
    { tex: 'The one with the largest annual savings', why: 'Bigger savings may come with a much bigger first cost.' },
    { tex: 'All four', why: 'They are mutually exclusive, so you can only choose one.' },
  ] },
  { type: 'text', kind: 'method', title: 'Annual worth (AW)', body: R`Convert everything to an equivalent annuity: $AW = -P(A/P) + A + S(A/F)$. Same decision as PW for equal lives; often easier when most flows are already annual.` },
  { type: 'example', title: 'Worked example: software (slide 29)', prompt: R`\$50M software, \$3M/yr support, 15-year life, MARR 8%. Annual cost?`, steps: [
    R`$(A/P, 8\%, 15) = 0.11683$.`,
    R`Capital cost per year: $50\text{M}\times0.11683 = \$5.84\text{M}$.`,
    R`Annual cost $= 5.84 + 3 = \$8.84\text{M}$ per year.`,
  ] },
  { type: 'text', kind: 'method', title: 'Unequal service lives', body: R`Repeated lives: assume each option is replaced in kind; compare AW over one life (equivalent to PW over the least common multiple). Study period: compare over a fixed horizon, using a salvage value for whatever life is left.` },
  { type: 'quiz', prompt: R`Option A lasts 10 years, B lasts 15. Which comparison is valid?`, options: [
    { tex: 'AW of each over its own life (repeated lives)', correct: true },
    { tex: 'PW of each over its own life', why: 'PWs over 10 and 15 years cover different service periods.' },
    { tex: 'Total undiscounted cost', why: 'That ignores the time value of money.' },
  ] },
  { type: 'text', kind: 'method', title: 'Payback period', body: R`$\text{Payback} = \dfrac{\text{first cost}}{\text{net annual savings}}$ at $i = 0$. Easy and popular, but it ignores the time value of money, service life and everything after payback.` },
  { type: 'input', prompt: R`\$50,000 cloud upgrade saves \$20,000 per year. Payback (years)?`, answer: '2.5', explain: R`$50000/20000 = 2.5$ years.` },
];

const cmp2Lesson = [
  { type: 'text', kind: 'key', title: 'Internal rate of return', body: R`The IRR $i^*$ is the rate that makes $PW = 0$ (equivalently AW or FW = 0): the project's break-even rate. $$\sum_{t=0}^{T}\frac{R_t - D_t}{(1+i^*)^t} = 0$$` },
  {
    type: 'graph', title: 'IRR is where PW crosses zero',
    body: R`\$2,000 now, \$500 per year for $n$ years. The IRR is the crossing point; compare it with the MARR line.`,
    widget: {
      params: [{ key: 'A', label: 'annual benefit', min: 200, max: 1000, step: 10, value: 500, fmt: (v) => fmtMoney(v) }, { key: 'n', label: 'years', min: 2, max: 15, step: 1, value: 5 }, { key: 'm', label: 'MARR', min: 0.02, max: 0.4, step: 0.01, value: 0.1, fmt: (v) => `${Math.round(v * 100)}%` }],
      x: [0.001, 0.5], y: 'auto', xLabel: 'i', yLabel: 'PW ($)',
      curves: (p) => [{ fn: (i) => -2000 + p.A * PA(i, p.n), label: 'PW(i)' }],
      vlines: (p) => [{ x: p.m, label: 'MARR' }],
      points: (p) => { const f = (i) => -2000 + p.A * PA(i, p.n); if (f(0.0011) * f(0.5) > 0) return []; const r = bisect(f, 0.0011, 0.5); return [{ x: r, y: 0, label: `IRR ${(r * 100).toFixed(2)}%` }]; },
      readout: (p) => { const f = (i) => -2000 + p.A * PA(i, p.n); if (f(0.0011) * f(0.5) > 0) return 'No IRR in this range.'; const r = bisect(f, 0.0011, 0.5); return `IRR $= ${(r * 100).toFixed(2)}\\%$ ${r > p.m ? '>' : '<'} MARR, so ${r > p.m ? 'accept' : 'reject'}.`; },
    },
  },
  { type: 'example', title: 'Worked example: interpolation (slides 11–13)', prompt: R`\$2,000 now, \$500 per year for 5 years.`, steps: [
    R`Need $(P/A, i^*, 5) = 2000/500 = 4.0$.`,
    R`Tables: 7% gives 4.1002, 8% gives 3.9927, so $i^*$ is between them.`,
    R`Interpolate: $i^* \approx 7 + \frac{4.1002 - 4.0}{4.1002 - 3.9927} = 7 + 0.93 = 7.93\%$.`,
  ] },
  { type: 'text', kind: 'method', title: 'Decisions with IRR', body: R`Independent: accept if IRR > MARR.<br>Mutually exclusive: rank by first cost; the cheapest that beats MARR is the current best. Then compute the incremental IRR of the next one (challenger − current best). If $\Delta$IRR > MARR the challenger wins. Repeat.` },
  { type: 'example', title: 'Worked example: A vs B (slide 22)', prompt: R`A: \$10 now → \$20 in a year. B: \$1,000 now → \$1,200 in a year. MARR 12%.`, steps: [
    R`IRR(A) = 100%, IRR(B) = 20%. Picking the higher IRR would choose A.`,
    R`Increment B − A: $-\$990$ now, $+\$1{,}180$ in a year, so $\Delta i^* = \frac{1180}{990} - 1 = 19.2\%$.`,
    R`19.2% > 12%, so the extra \$990 earns more than the MARR: choose B. (PW agrees: $PW_A = \$7.86$, $PW_B = \$71.43$.)`,
  ] },
  { type: 'quiz', prompt: R`For mutually exclusive projects, why not just pick the highest IRR?`, options: [
    { tex: 'A small project with a huge IRR can earn less total value than a big one with a lower IRR', correct: true },
    { tex: 'IRR cannot be computed for mutually exclusive projects', why: 'It can; it just doesn\'t rank them correctly on its own.' },
    { tex: 'The highest IRR is always the right choice', why: 'See the A vs B example: the highest IRR (A) has the lower PW.' },
  ] },
  { type: 'text', kind: 'key', title: 'Multiple IRRs', body: R`If the cash flow signs change more than once (+, −, +), PW(i) can cross zero more than once. Then use the external rate of return.` },
  {
    type: 'graph', title: 'Two IRRs for one project',
    body: R`$+\$1{,}000$ now, $-\$5{,}000$ in year 1, $+\$6{,}000$ in year 2. PW(i) hits zero at $i = 100\%$ and $i = 200\%$: which is "the" IRR?`,
    widget: { x: [0, 3], y: [-150, 600], xLabel: 'i', yLabel: 'PW ($)', curves: [{ fn: (i) => 1000 - 5000 / (1 + i) + 6000 / (1 + i) ** 2, label: 'PW(i)' }], points: [{ x: 1, y: 0, label: '100%' }, { x: 2, y: 0, label: '200%' }] },
  },
  { type: 'text', kind: 'method', title: 'Approximate ERR', body: R`1. Take all net receipts forward to the last period at the MARR.<br>2. Take all net disbursements forward at the unknown rate $i_{ea}^*$.<br>3. Set $FW(\text{receipts}) = FW(\text{disbursements})$ and solve.` },
  { type: 'example', title: 'Worked example (slides 32–35)', prompt: R`Same project, MARR 25%.`, steps: [
    R`Receipts forward: $1000(1.25)^2 + 6000 = \$7{,}562.50$.`,
    R`Disbursements forward: $5000(1 + i_{ea}^*)$.`,
    R`$1 + i_{ea}^* = 7562.5/5000 = 1.5125$, so $i_{ea}^* = 51.25\%$.`,
  ] },
  { type: 'quiz', prompt: R`Which method gives an explicit measure of profit (in dollars)?`, options: [
    { tex: 'Present worth', correct: true },
    { tex: 'IRR', why: 'IRR is a rate, so it is good for comparing sizes but says nothing about dollars of profit.' },
    { tex: 'Payback period', why: 'Payback ignores everything after the investment is recovered.' },
  ] },
];

SA.registerCourse({
  course: 'ECOR 3800',
  chapters: [
    { id: 'ec-tvm', name: 'Time value of money' },
    { id: 'ec-cf', name: 'Cash flow analysis' },
    { id: 'ec-cmp', name: 'Comparison methods' },
  ],
  topics: [
    { id: 'ec-simple', ch: 'ec-tvm', sec: 'tvm', name: 'Simple vs compound', desc: 'P(1+ni) vs P(1+i)ⁿ.', gen: genSimpleCompound },
    { id: 'ec-eff', ch: 'ec-tvm', sec: 'tvm', name: 'Effective rates', desc: 'Nominal → i_s and i_e, continuous too.', gen: genEffective },
    { id: 'ec-single', ch: 'ec-tvm', sec: 'tvm', name: 'Single payments', desc: 'P ↔ F with sub-period compounding.', gen: genSinglePayment },
    { id: 'ec-annuity', ch: 'ec-cf', sec: 'cf', name: 'Annuity factors', desc: 'A/P, A/F, P/A, F/A.', gen: genAnnuity },
    { id: 'ec-grad', ch: 'ec-cf', sec: 'cf', name: 'Arithmetic gradients', desc: "A' + G(A/G).", gen: genGradient },
    { id: 'ec-perp', ch: 'ec-cf', sec: 'cf', name: 'Capitalized value', desc: 'P = A/i for very long lives.', gen: genPerpetuity },
    { id: 'ec-pw', ch: 'ec-cmp', sec: 'cmp1', name: 'PW and AW', desc: 'Accept/reject at the MARR.', gen: genPW },
    { id: 'ec-mutex', ch: 'ec-cmp', sec: 'cmp1', name: 'Mutually exclusive choice', desc: 'Largest PW wins.', gen: genMutex },
    { id: 'ec-unequal', ch: 'ec-cmp', sec: 'cmp1', name: 'Unequal lives', desc: 'Compare annual worths.', gen: genUnequal },
    { id: 'ec-payback', ch: 'ec-cmp', sec: 'cmp1', name: 'Payback period', desc: 'First cost ÷ net savings.', gen: genPayback },
    { id: 'ec-irr', ch: 'ec-cmp', sec: 'cmp2', name: 'IRR', desc: 'Rate where PW = 0.', gen: genIRR },
    { id: 'ec-inc', ch: 'ec-cmp', sec: 'cmp2', name: 'Incremental IRR', desc: 'Challenger vs current best.', gen: genIncremental },
    { id: 'ec-err', ch: 'ec-cmp', sec: 'cmp2', name: 'External rate of return', desc: 'For multiple IRRs.', gen: genERR },
  ],
  sections: [
    { id: 'tvm', tag: 'Week 2', num: 'W2', title: 'Time value of money', chapter: 'Midterm · Week 2', skills: ['ec-simple', 'ec-eff', 'ec-single'], lesson: tvmLesson },
    { id: 'cf', tag: 'Week 3', num: 'W3', title: 'Cash flow analysis', chapter: 'Midterm · Week 3', skills: ['ec-annuity', 'ec-grad', 'ec-perp'], lesson: cfLesson },
    { id: 'cmp1', tag: 'Week 4', num: 'W4', title: 'Comparison methods I: PW, AW, payback', chapter: 'Midterm · Week 4', skills: ['ec-pw', 'ec-mutex', 'ec-unequal', 'ec-payback'], lesson: cmp1Lesson },
    { id: 'cmp2', tag: 'Week 5', num: 'W5', title: 'Comparison methods II: IRR', chapter: 'Midterm · Week 5', skills: ['ec-irr', 'ec-inc', 'ec-err'], lesson: cmp2Lesson },
  ],
});
