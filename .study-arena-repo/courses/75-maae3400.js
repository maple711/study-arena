// MAAE 3400 — Applied Thermodynamics (Winter). First half, built ahead of time from the calendar
// description and the standard text (Çengel & Boles): air-standard Otto, Diesel and Brayton cycles
// (with regeneration and component efficiencies) and the ideal/actual Rankine cycle.
// Cold-air-standard values: k = 1.4, cp = 1.005, cv = 0.718, R = 0.287 kJ/kg·K.
const { R, pick, randInt, rand, rnd } = SA;
const K = 1.4, CP = 1.005, CV = 0.718, RG = 0.287;
const r2 = (v) => +v.toFixed(2), r3 = (v) => +v.toFixed(3), r4 = (v) => +v.toFixed(4);
const num = (v) => String(rnd(v));
const TOL = 3e-3;
const pct = (v) => r2(v * 100);

/* ---------- reciprocating cycles ---------- */
function genOtto() {
  const r = pick([7, 8, 9, 10, 11]), T1 = pick([290, 300, 310]), P1 = pick([95, 100]), q = pick([750, 800, 1000, 1200]);
  const eta = 1 - r ** (1 - K), T2 = T1 * r ** (K - 1), T3 = T2 + q / CV, w = eta * q, v1 = (RG * T1) / P1, mep = w / (v1 * (1 - 1 / r));
  const ask = pick(['eta', 'T2', 'T3', 'w', 'mep']);
  const v = { eta: eta * 100, T2, T3, w, mep }[ask];
  return {
    points: ask === 'mep' ? 20 : 15,
    prompt: `An ideal Otto cycle (cold-air standard) has compression ratio $${r}$. At the start of compression air is at $${P1}$ kPa and $${T1}$ K; $${q}$ kJ/kg of heat is added. Find ${{ eta: 'the thermal efficiency (%)', T2: 'the temperature after compression (K)', T3: 'the peak temperature (K)', w: 'the net work (kJ/kg)', mep: 'the mean effective pressure (kPa)' }[ask]}.`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter a number.', answer: num(v), answerTex: { eta: `\\eta = 1 - r^{1-k} = ${pct(eta)}\\%`, T2: `T_2 = T_1r^{k-1} = ${r2(T2)}\\text{ K}`, T3: `T_3 = T_2 + \\frac{q_{in}}{c_v} = ${r2(T3)}\\text{ K}`, w: `w_{net} = \\eta q_{in} = ${r2(w)}\\text{ kJ/kg}`, mep: `MEP = ${r2(mep)}\\text{ kPa}` }[ask],
    figure: ottoFig(r),
    steps: [
      { key: 'c', title: '1→2 isentropic compression', body: `$T_2 = T_1r^{k-1} = ${T1}(${r})^{0.4} = ${r2(T2)}$ K` },
      { key: 'h', title: '2→3 heat at constant volume', body: `$T_3 = T_2 + \\frac{q_{in}}{c_v} = ${r2(T2)} + \\frac{${q}}{0.718} = ${r2(T3)}$ K` },
      { key: 'e', title: 'Efficiency and work', body: `$\\eta = 1 - \\frac{1}{r^{k-1}} = ${pct(eta)}\\%$, $w_{net} = \\eta q_{in} = ${r2(w)}$ kJ/kg` },
      ...(ask === 'mep' ? [{ key: 'm', title: 'Mean effective pressure', body: `$v_1 = \\frac{RT_1}{P_1} = ${r4(v1)}$ m³/kg, $v_2 = v_1/r$; $MEP = \\frac{w_{net}}{v_1 - v_2} = ${r2(mep)}$ kPa` }] : []),
    ],
    mistakes: [
      ...(ask === 'eta' ? [{ expr: num((1 - r ** -K) * 100), step: 'e', why: 'The exponent is $k - 1 = 0.4$.' }, { expr: num((1 - 1 / r) * 100), step: 'e', why: 'Raise $r$ to the power $k - 1$.' }] : []),
      ...(ask === 'T2' ? [{ expr: num(T1 * r ** K), step: 'c', why: 'For temperature: $T_2/T_1 = r^{k-1}$ (pressure uses $r^k$).' }] : []),
      ...(ask === 'T3' ? [{ expr: num(T2 + q / CP), step: 'h', why: 'Heat is added at constant volume: use $c_v$.' }] : []),
      ...(ask === 'w' ? [{ expr: num(q), step: 'e', why: 'Only part of the heat becomes work; the rest is rejected: $w = \\eta q_{in}$.' }] : []),
      ...(ask === 'mep' ? [{ expr: num(w / v1), step: 'm', why: 'Divide by the displacement $v_1 - v_2$, not $v_1$.' }] : []),
    ],
  };
}
function ottoFig(r) {
  return { kind: 'sketch', height: 200, view: [0, 1.15, 0, 1.1], axes: { x: 'v', y: 'P' }, items: ottoItems(r, 1.8) };
}
function ottoItems(r, qr) {
  // normalized: v1 = 1, P1 = scale so P3 fits
  const v1 = 1, v2 = 1 / r, P2 = r ** K, P3 = P2 * qr, P4 = qr, s = 1 / P3;
  const iso = (Pa, va, vb) => Array.from({ length: 41 }, (_, i) => { const v = va + ((vb - va) * i) / 40; return [v, Pa * s * (va / v) ** K]; });
  return [
    { t: 'poly', open: true, pts: iso(1, v1, v2), color: 0 }, { t: 'line', x1: v2, y1: P2 * s, x2: v2, y2: P3 * s, color: 3 },
    { t: 'poly', open: true, pts: iso(P3, v2, v1), color: 0 }, { t: 'line', x1: v1, y1: P4 * s, x2: v1, y2: s, color: 1 },
    ...[[v1, s, '1'], [v2, P2 * s, '2'], [v2, P3 * s, '3'], [v1, P4 * s, '4']].map(([x, y, t]) => ({ t: 'text', x, y, dx: 8, dy: -4, text: t, anchor: 'start', size: 12, bold: true })),
    { t: 'text', x: v2, y: (P2 + P3) * s / 2, dx: 8, text: 'q in', anchor: 'start', color: 3, size: 11 }, { t: 'text', x: v1, y: (P4 + 1) * s / 2, dx: -6, text: 'q out', anchor: 'end', color: 1, size: 11 },
  ];
}

function genDiesel() {
  const r = pick([16, 18, 20, 22]), rc = pick([1.5, 2, 2.2, 2.5]), T1 = pick([290, 300]);
  const eta = 1 - r ** (1 - K) * ((rc ** K - 1) / (K * (rc - 1))), T2 = T1 * r ** (K - 1), T3 = T2 * rc, qin = CP * (T3 - T2);
  const ask = pick(['eta', 'eta', 'T3', 'q']);
  const v = { eta: eta * 100, T3, q: qin }[ask];
  return {
    points: 15,
    prompt: `An ideal Diesel cycle (cold-air standard) has compression ratio $${r}$ and cutoff ratio $${rc}$; air starts at $${T1}$ K. Find ${{ eta: 'the thermal efficiency (%)', T3: 'the temperature at the end of heat addition (K)', q: 'the heat added (kJ/kg)' }[ask]}.`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter a number.', answer: num(v), answerTex: { eta: `\\eta = ${pct(eta)}\\%`, T3: `T_3 = r_cT_2 = ${r2(T3)}\\text{ K}`, q: `q_{in} = c_p(T_3 - T_2) = ${r2(qin)}\\text{ kJ/kg}` }[ask],
    steps: [
      { key: 'c', title: 'Compression', body: `$T_2 = ${T1}(${r})^{0.4} = ${r2(T2)}$ K` },
      { key: 'h', title: 'Heat at constant pressure', body: `$T_3 = r_cT_2 = ${r2(T3)}$ K, $q_{in} = c_p(T_3 - T_2) = ${r2(qin)}$ kJ/kg` },
      { key: 'e', title: 'Efficiency', body: `$\\eta = 1 - \\frac{1}{r^{k-1}}\\left[\\frac{r_c^k - 1}{k(r_c - 1)}\\right] = 1 - \\frac{${r4((rc ** K - 1) / (K * (rc - 1)))}}{${r3(r ** (K - 1))}} = ${pct(eta)}\\%$. The bracket is > 1, so a Diesel is less efficient than an Otto at the same $r$ — but it can run much higher $r$.` },
    ],
    mistakes: [
      ...(ask === 'eta' ? [{ expr: num((1 - r ** (1 - K)) * 100), step: 'e', why: 'That is the Otto efficiency; the cutoff ratio adds the bracket factor.' }] : []),
      ...(ask === 'q' ? [{ expr: num(CV * (T3 - T2)), step: 'h', why: 'Diesel heat addition is at constant pressure: $c_p$.' }] : []),
      ...(ask === 'T3' ? [{ expr: num(T2 * rc ** (K - 1)), step: 'h', why: 'At constant pressure $T \\propto v$: $T_3 = r_cT_2$.' }] : []),
    ],
  };
}

/* ---------- gas turbines ---------- */
function genBrayton() {
  const rp = pick([8, 10, 12, 14, 16]), T1 = pick([290, 300]), T3 = pick([1100, 1200, 1300, 1400]);
  const X = rp ** ((K - 1) / K), T2s = T1 * X, T4s = T3 / X, eta = 1 - 1 / X;
  const kind = pick(['eta', 'bwr', 'actual', 'regen', 'T2']);
  if (kind === 'actual') {
    const ec = pick([0.8, 0.85, 0.88]), et = pick([0.85, 0.88, 0.9]);
    const wc = (CP * (T2s - T1)) / ec, wt = et * CP * (T3 - T4s), T2 = T1 + wc / CP, qin = CP * (T3 - T2), wnet = wt - wc, ea = wnet / qin;
    const ask = pick(['wnet', 'eta']);
    return {
      points: 25,
      prompt: `A gas-turbine (Brayton) cycle: pressure ratio $${rp}$, compressor inlet $${T1}$ K, turbine inlet $${T3}$ K, compressor efficiency $${ec}$, turbine efficiency $${et}$ (cold-air standard). Find ${ask === 'wnet' ? 'the net work (kJ/kg)' : 'the thermal efficiency (%)'}.`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter a number.', answer: num(ask === 'wnet' ? wnet : ea * 100), answerTex: ask === 'wnet' ? `w_{net} = ${r2(wnet)}\\text{ kJ/kg}` : `\\eta = ${pct(ea)}\\%`,
      steps: [
        { key: 'is', title: 'Isentropic temperatures', body: `$r_p^{(k-1)/k} = ${r4(X)}$: $T_{2s} = ${r2(T2s)}$ K, $T_{4s} = ${r2(T4s)}$ K` },
        { key: 'c', title: 'Real compressor (needs more work)', body: `$w_c = \\frac{c_p(T_{2s} - T_1)}{\\eta_c} = ${r2(wc)}$ kJ/kg, so $T_2 = ${r2(T2)}$ K` },
        { key: 't', title: 'Real turbine (gives less work)', body: `$w_t = \\eta_tc_p(T_3 - T_{4s}) = ${r2(wt)}$ kJ/kg` },
        { key: 'n', title: 'Net', body: `$w_{net} = ${r2(wnet)}$ kJ/kg, $q_{in} = c_p(T_3 - T_2) = ${r2(qin)}$, $\\eta = ${pct(ea)}\\%$ (ideal would be ${pct(eta)}%)` },
      ],
      mistakes: [
        { expr: num(ask === 'wnet' ? CP * (T3 - T4s) - CP * (T2s - T1) : eta * 100), step: 'c', why: 'Include the component efficiencies: they change both work terms.' },
        { expr: num(ask === 'wnet' ? wt - CP * (T2s - T1) * ec : (wt - CP * (T2s - T1) * ec) / (CP * (T3 - T1 - (T2s - T1) * ec)) * 100), step: 'c', why: 'A real compressor needs more work than ideal: divide by $\\eta_c$.' },
      ],
    };
  }
  if (kind === 'regen') {
    const ok = T4s > T2s;
    const er = 1 - (T1 / T3) * X;
    if (!ok) return genBrayton();
    return {
      points: 20, prompt: `An ideal Brayton cycle with an ideal regenerator: pressure ratio $${rp}$, $T_1 = ${T1}$ K, $T_3 = ${T3}$ K. Find the thermal efficiency (%).`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter %.', answer: num(er * 100), answerTex: `\\eta = 1 - \\frac{T_1}{T_3}r_p^{(k-1)/k} = ${pct(er)}\\%`,
      steps: [
        { key: 'c', title: 'Regeneration is possible', body: `$T_4 = ${r2(T4s)}$ K exceeds $T_2 = ${r2(T2s)}$ K, so exhaust heat can preheat the compressed air.` },
        { key: 'e', title: 'Ideal regenerator', body: `With the air heated to $T_4$ before the combustor, $\\eta = 1 - \\frac{T_1}{T_3}r_p^{(k-1)/k} = ${pct(er)}\\%$ vs ${pct(eta)}% without. Unlike plain Brayton, it falls as $r_p$ rises.` },
      ],
      mistakes: [{ expr: num(eta * 100), step: 'e', why: 'That is the plain Brayton efficiency.' }, { expr: num((1 - (T1 / T3) / X) * 100), step: 'e', why: 'The pressure-ratio term multiplies: $\\frac{T_1}{T_3}r_p^{(k-1)/k}$.' }],
    };
  }
  if (kind === 'bwr') {
    const bwr = (T2s - T1) / (T3 - T4s);
    return {
      points: 15, prompt: `Ideal Brayton: $r_p = ${rp}$, $T_1 = ${T1}$ K, $T_3 = ${T3}$ K. Find the back-work ratio $w_c/w_t$ (as a decimal).`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter a decimal.', answer: num(bwr), answerTex: `r_{bw} = ${r4(bwr)}`,
      steps: [{ key: 'w', title: 'Works', body: `$w_c = c_p(${r2(T2s)} - ${T1}) = ${r2(CP * (T2s - T1))}$, $w_t = c_p(${T3} - ${r2(T4s)}) = ${r2(CP * (T3 - T4s))}$ kJ/kg, ratio $${r4(bwr)}$. Gas turbines spend a large fraction of turbine work driving the compressor.` }],
      mistakes: [{ expr: num(1 / bwr), step: 'w', why: 'Back-work ratio is compressor work over turbine work.' }],
    };
  }
  return {
    points: 10, prompt: `Ideal Brayton cycle with pressure ratio $${rp}$, $T_1 = ${T1}$ K. Find ${kind === 'eta' ? 'the thermal efficiency (%)' : 'the compressor exit temperature (K)'}.`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter a number.', answer: num(kind === 'eta' ? eta * 100 : T2s), answerTex: kind === 'eta' ? `\\eta = 1 - r_p^{-(k-1)/k} = ${pct(eta)}\\%` : `T_2 = T_1r_p^{(k-1)/k} = ${r2(T2s)}\\text{ K}`,
    steps: [{ key: 'f', title: 'Isentropic pressure ratio', body: `$\\frac{T_2}{T_1} = r_p^{(k-1)/k} = ${r4(X)}$; $\\eta = 1 - \\frac{1}{${r4(X)}} = ${pct(eta)}\\%$` }],
    mistakes: [{ expr: num(kind === 'eta' ? (1 - rp ** (1 - K)) * 100 : T1 * rp ** (K - 1)), step: 'f', why: 'For a pressure ratio the exponent is $(k-1)/k$; $k-1$ is for a volume ratio.' }],
  };
}

/* ---------- vapour power ---------- */
const BOIL = [{ P: 3, T: 350, h: 3116.1, s: 6.745 }, { P: 8, T: 500, h: 3399.5, s: 6.7266 }, { P: 10, T: 500, h: 3375.1, s: 6.5995 }, { P: 15, T: 600, h: 3583.1, s: 6.6796 }];
const COND = [{ P: 10, Tsat: 45.81, vf: 0.00101, hf: 191.81, hfg: 2392.1, sf: 0.6492, sfg: 7.4996 }, { P: 20, Tsat: 60.06, vf: 0.001017, hf: 251.42, hfg: 2357.5, sf: 0.832, sfg: 7.0752 }, { P: 75, Tsat: 91.76, vf: 0.001037, hf: 384.44, hfg: 2278.0, sf: 1.2132, sfg: 6.2426 }];
function genRankine() {
  const B = pick(BOIL), C = pick(COND), etaT = pick([1, 1, 0.85, 0.9]);
  const wp = C.vf * (B.P * 1000 - C.P), h2 = C.hf + wp, x4s = (B.s - C.sf) / C.sfg, h4s = C.hf + x4s * C.hfg, h4 = B.h - etaT * (B.h - h4s);
  const wt = B.h - h4, qin = B.h - h2, eta = (wt - wp) / qin;
  const ask = etaT < 1 ? pick(['eta', 'wt']) : pick(['wp', 'x', 'eta', 'eta', 'wt']);
  const v = { wp, x: x4s, eta: eta * 100, wt }[ask];
  return {
    points: ask === 'wp' || ask === 'x' ? 15 : 25,
    prompt: `A Rankine cycle: steam leaves the boiler at $${B.P}$ MPa, $${B.T}$°C ($h = ${B.h}$, $s = ${B.s}$) and expands to a condenser at $${C.P}$ kPa (saturated: $v_f = ${C.vf}$ m³/kg, $h_f = ${C.hf}$, $h_{fg} = ${C.hfg}$ kJ/kg, $s_f = ${C.sf}$, $s_{fg} = ${C.sfg}$ kJ/kg·K).${etaT < 1 ? ` The turbine's isentropic efficiency is $${etaT}$.` : ' Pump and turbine are isentropic.'} Find ${{ wp: 'the pump work (kJ/kg)', x: 'the quality at the turbine exit', eta: 'the thermal efficiency (%)', wt: 'the turbine work (kJ/kg)' }[ask]}.`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter a number.', answer: num(v), answerTex: { wp: `w_p = v_f(P_2 - P_1) = ${r3(wp)}\\text{ kJ/kg}`, x: `x_4 = ${r4(x4s)}`, eta: `\\eta = ${pct(eta)}\\%`, wt: `w_t = ${r2(wt)}\\text{ kJ/kg}` }[ask],
    figure: rankineFig(),
    steps: [
      { key: 'p', title: '1→2 pump (liquid, incompressible)', body: `$w_p = v_f(P_2 - P_1) = ${C.vf}(${B.P * 1000} - ${C.P}) = ${r3(wp)}$ kJ/kg, $h_2 = ${r2(h2)}$` },
      { key: 'x', title: '3→4s isentropic expansion', body: `$x_{4s} = \\frac{s_3 - s_f}{s_{fg}} = \\frac{${B.s} - ${C.sf}}{${C.sfg}} = ${r4(x4s)}$, $h_{4s} = h_f + x_{4s}h_{fg} = ${r2(h4s)}$` },
      ...(etaT < 1 ? [{ key: 'a', title: 'Real turbine', body: `$h_4 = h_3 - \\eta_t(h_3 - h_{4s}) = ${r2(h4)}$` }] : []),
      { key: 'e', title: 'Cycle', body: `$w_t = h_3 - h_4 = ${r2(wt)}$, $q_{in} = h_3 - h_2 = ${r2(qin)}$, $\\eta = \\frac{w_t - w_p}{q_{in}} = ${pct(eta)}\\%$` },
    ],
    mistakes: [
      ...(ask === 'wp' ? [{ expr: num(C.vf * B.P), step: 'p', why: 'Units: MPa → kPa (×1000) so the work comes out in kJ/kg.' }] : []),
      ...(ask === 'x' ? [{ expr: num(B.s / C.sfg), step: 'x', why: 'Subtract $s_f$: $x = \\frac{s - s_f}{s_{fg}}$.' }] : []),
      ...(ask === 'eta' ? [{ expr: num((wt / qin) * 100), step: 'e', why: 'Subtract the (small) pump work.' }, { expr: num(((wt - wp) / (B.h - C.hf)) * 100), step: 'p', why: 'Heat is added from $h_2 = h_f + w_p$, not from $h_f$.' }] : []),
      ...(ask === 'wt' && etaT < 1 ? [{ expr: num(B.h - h4s), step: 'a', why: 'That is the isentropic work; multiply by $\\eta_t$.' }] : []),
    ],
  };
}
function rankineFig() {
  const box = (x, y, w, h, t, c) => [{ t: 'poly', pts: [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]], color: c, fill: true, opacity: 0.15 }, { t: 'text', x, y, dy: 4, text: t, color: c, size: 12 }];
  return { kind: 'sketch', height: 210, view: [0, 10, 0, 6], items: [
    ...box(5, 5, 3.2, 1.1, 'boiler', 3), ...box(8.4, 3, 1.8, 1.2, 'turbine', 0), ...box(5, 1, 3.2, 1.1, 'condenser', 1), ...box(1.6, 3, 1.6, 1.1, 'pump', 2),
    { t: 'arrow', x1: 6.6, y1: 5, x2: 8.4, y2: 3.65 }, { t: 'arrow', x1: 8.4, y1: 2.35, x2: 6.6, y2: 1 }, { t: 'arrow', x1: 3.4, y1: 1, x2: 1.6, y2: 2.4 }, { t: 'arrow', x1: 1.6, y1: 3.6, x2: 3.4, y2: 5 },
    { t: 'text', x: 7.7, y: 4.6, text: '3', bold: true }, { t: 'text', x: 7.7, y: 1.4, text: '4', bold: true }, { t: 'text', x: 2.3, y: 1.4, text: '1', bold: true }, { t: 'text', x: 2.3, y: 4.6, text: '2', bold: true },
    { t: 'text', x: 5, y: 5.9, text: 'q in', color: 3, size: 11 }, { t: 'text', x: 9.6, y: 3, text: 'w t', color: 0, size: 11 }, { t: 'text', x: 5, y: 0.2, text: 'q out', color: 1, size: 11 }, { t: 'text', x: 0.4, y: 3, text: 'w p', color: 2, size: 11 },
  ] };
}

/* ================= lessons ================= */
const LBasics = [
  { type: 'text', kind: 'key', title: 'Power cycles and the air-standard model', body: R`A heat engine takes $q_{in}$ from a hot source, rejects $q_{out}$, and produces $w_{net} = q_{in} - q_{out}$; $\eta = w_{net}/q_{in}$. Carnot sets the ceiling: $\eta \le 1 - T_L/T_H$. Real engines are idealized as air-standard cycles: air as an ideal gas, combustion replaced by heat addition, processes internally reversible. "Cold-air standard" also fixes $k = 1.4$, $c_p = 1.005$, $c_v = 0.718$ kJ/kg·K.` },
  { type: 'text', kind: 'method', title: 'Otto cycle (spark ignition)', body: R`1→2 isentropic compression, 2→3 heat in at constant volume, 3→4 isentropic expansion, 4→1 heat out at constant volume. $T_2 = T_1r^{k-1}$, $\eta = 1 - \frac{1}{r^{k-1}}$: efficiency depends only on the compression ratio $r = v_1/v_2$ (limited by knock, $r \approx 8$–$12$).` },
  {
    type: 'graph', title: 'Otto cycle on P–v axes',
    body: R`Raise the compression ratio: the cycle gets taller and thinner, and efficiency climbs, quickly at first and then slowly.`,
    widget: {
      params: [{ key: 'r', label: 'compression ratio r', min: 4, max: 14, step: 0.5, value: 8 }, { key: 'q', label: 'pressure rise in combustion P₃/P₂', min: 1.3, max: 4, step: 0.1, value: 2 }],
      panels: [
        { kind: 'sketch', flex: 1, height: 260, view: [0, 1.15, 0, 1.1], axes: { x: 'v', y: 'P' }, items: (p) => ottoItems(p.r, p.q) },
        { kind: 'plot', flex: 1, height: 260, x: [2, 20], y: [0, 80], xLabel: 'r', yLabel: 'η (%)', curves: [{ fn: (r) => (1 - r ** (1 - K)) * 100, label: 'Otto' }, { fn: (r) => (1 - r ** (1 - K) * ((2 ** K - 1) / (K * 1))) * 100, label: 'Diesel, r_c = 2', color: 1 }], vlines: (p) => [{ x: p.r }] },
      ],
      readout: (p) => `$\\eta_{Otto} = 1 - ${p.r}^{-0.4} = ${pct(1 - p.r ** (1 - K))}\\%$`,
    },
  },
  { type: 'text', kind: 'method', title: 'Diesel cycle (compression ignition)', body: R`Heat in at constant pressure instead (2→3), with cutoff ratio $r_c = v_3/v_2$: $$\eta = 1 - \frac{1}{r^{k-1}}\left[\frac{r_c^k - 1}{k(r_c-1)}\right].$$ The bracket exceeds 1, so at equal $r$ Diesel < Otto, but Diesels run $r = 15$–$22$ and win overall.` },
  { type: 'example', title: 'Worked example: Otto', prompt: R`$r = 8$, $T_1 = 290$ K, $P_1 = 95$ kPa, $q_{in} = 750$ kJ/kg.`, steps: [R`$T_2 = 290(8)^{0.4} = 666.2$ K; $T_3 = 666.2 + 750/0.718 = 1710.8$ K.`, R`$\eta = 1 - 8^{-0.4} = 56.5\%$, $w_{net} = 423.5$ kJ/kg.`, R`$v_1 = 0.287(290)/95 = 0.876$ m³/kg; $MEP = \frac{423.5}{0.876(1 - 1/8)} = 553$ kPa.`] },
  { type: 'quiz', prompt: R`Why can't a gasoline engine just use $r = 20$?`, options: [{ tex: 'The mixture would auto-ignite (knock) during compression', correct: true }, { tex: 'Efficiency falls at high r', why: R`Otto efficiency keeps rising with $r$.` }, { tex: 'The cycle would need constant-pressure heat addition', why: 'That is the Diesel model, not the reason.' }] },
];
const LBray = [
  { type: 'text', kind: 'key', title: 'Brayton cycle (gas turbines)', body: R`Compressor (1→2, isentropic), combustor (2→3, constant $P$), turbine (3→4, isentropic), exhaust/cooler (4→1, constant $P$). With pressure ratio $r_p$: $\frac{T_2}{T_1} = r_p^{(k-1)/k}$ and $\eta = 1 - \frac{1}{r_p^{(k-1)/k}}$.` },
  { type: 'text', kind: 'method', title: 'Back work and maximum net work', body: R`The compressor eats a big share of turbine work: back-work ratio $w_c/w_t$ of 40–80%. For fixed $T_1$, $T_3$ (material limit), net work peaks at $r_p = (T_3/T_1)^{k/(2(k-1))}$ — the best efficiency and the best work per kg are not at the same $r_p$.` },
  {
    type: 'graph', title: 'Efficiency vs net work',
    body: R`Efficiency keeps rising with $r_p$; net work per kg rises then falls (at high $r_p$, $T_2$ approaches $T_3$ and little heat can be added). Raise the turbine inlet temperature to push both up.`,
    widget: {
      params: [{ key: 'T3', label: 'turbine inlet T₃ (K)', min: 900, max: 1800, step: 50, value: 1300 }],
      x: [1.5, 40], y: [0, 100], xLabel: 'pressure ratio r_p',
      curves: (p) => [{ fn: (rp) => (1 - rp ** (-(K - 1) / K)) * 100, label: 'η (%)' }, { fn: (rp) => { const X = rp ** ((K - 1) / K); const w = CP * (p.T3 - p.T3 / X) - CP * (300 * X - 300); return w / 6; }, label: 'w_net / 6 (kJ/kg)', color: 1 }],
      vlines: (p) => [{ x: (p.T3 / 300) ** (K / (2 * (K - 1))), label: 'max work' }],
      readout: (p) => { const rp = (p.T3 / 300) ** (K / (2 * (K - 1))), X = rp ** ((K - 1) / K); return `$T_1 = 300$ K: max net work $${r2(CP * (p.T3 - p.T3 / X) - CP * (300 * X - 300))}$ kJ/kg at $r_p = ${r2(rp)}$ ($\\eta = ${pct(1 - 1 / X)}\\%$)`; },
    },
  },
  { type: 'text', kind: 'method', title: 'Real components', body: R`$\eta_c = \frac{w_{c,s}}{w_c} = \frac{T_{2s} - T_1}{T_2 - T_1}$ (real compressor needs more), $\eta_t = \frac{w_t}{w_{t,s}} = \frac{T_3 - T_4}{T_3 - T_{4s}}$ (real turbine gives less). Because the back-work ratio is large, small component losses cut net work a lot.` },
  { type: 'text', kind: 'key', title: 'Regeneration', body: R`If the turbine exhaust is hotter than the compressor outlet ($T_4 > T_2$), use it to preheat the air. Ideal regenerator: $\eta = 1 - \frac{T_1}{T_3}r_p^{(k-1)/k}$, best at low pressure ratios.` },
  { type: 'example', title: 'Worked example', prompt: R`$r_p = 8$, $T_1 = 300$ K, $T_3 = 1300$ K, $\eta_c = 0.8$, $\eta_t = 0.85$.`, steps: [R`$r_p^{0.2857} = 1.811$: $T_{2s} = 543.4$ K, $T_{4s} = 717.7$ K.`, R`$w_c = \frac{1.005(243.4)}{0.8} = 305.8$; $w_t = 0.85(1.005)(582.3) = 497.4$ kJ/kg.`, R`$w_{net} = 191.6$ kJ/kg; $T_2 = 604.3$ K, $q_{in} = 699.2$, $\eta = 27.4\%$ (ideal: 44.8%).`] },
  { type: 'input', prompt: R`Ideal Brayton with $r_p = 10$: efficiency (%)?`, answer: '48.205', tol: 1e-3, explain: R`$1 - 10^{-0.2857} = 48.2\%$.` },
];
const LRank = [
  { type: 'text', kind: 'key', title: 'The Rankine cycle', body: R`The steam power plant: pump (1→2, liquid compressed), boiler (2→3, heated to superheated steam), turbine (3→4, expansion into the wet region), condenser (4→1, back to saturated liquid). Steam isn't an ideal gas, so states come from steam tables: $h$, $s$, and quality $x = \frac{s - s_f}{s_{fg}}$.` },
  { type: 'graph', title: 'The four components', body: R`Energy balance per component (steady flow, per kg): $w_p = h_2 - h_1 \approx v_f(P_2 - P_1)$, $q_{in} = h_3 - h_2$, $w_t = h_3 - h_4$, $q_{out} = h_4 - h_1$.`, widget: rankineFig() },
  { type: 'example', title: 'Worked example', prompt: R`3 MPa, 350°C ($h = 3116.1$, $s = 6.7450$) to 75 kPa.`, steps: [
    R`Pump: $w_p = 0.001037(3000 - 75) = 3.03$ kJ/kg; $h_2 = 387.47$.`,
    R`$x_4 = \frac{6.7450 - 1.2132}{6.2426} = 0.8861$; $h_4 = 384.44 + 0.8861(2278.0) = 2403.0$.`,
    R`$w_t = 713.1$, $q_{in} = 2728.6$, $\eta = \frac{713.1 - 3.0}{2728.6} = 26.0\%$.`,
  ] },
  {
    type: 'graph', title: 'Why lower condenser pressure helps',
    body: R`Fixed boiler state (3 MPa, 350°C). Lowering the condenser pressure lowers the temperature at which heat is rejected, raising efficiency — at the cost of wetter steam leaving the turbine (bad for blades). Table points from the steam tables.`,
    widget: {
      params: [{ key: 'i', label: 'condenser: 0 = 75 kPa · 1 = 20 kPa · 2 = 10 kPa', min: 0, max: 2, step: 1, value: 0 }],
      x: [0, 2], y: [0, 40], xLabel: 'condenser case',
      curves: [], points: (p) => [2, 1, 0].map((ci, k) => { const C = COND[ci], B = BOIL[0]; const wp = C.vf * (3000 - C.P), x = (B.s - C.sf) / C.sfg, h4 = C.hf + x * C.hfg; return { x: k, y: ((B.h - h4 - wp) / (B.h - C.hf - wp)) * 100, label: `${C.P} kPa: ${r2(((B.h - h4 - wp) / (B.h - C.hf - wp)) * 100)}%`, color: k === p.i ? 3 : 0 }; }),
      readout: (p) => { const C = COND[[2, 1, 0][p.i]], B = BOIL[0]; const x = (B.s - C.sf) / C.sfg; return `$P_{cond} = ${C.P}$ kPa ($T_{sat} = ${C.Tsat}$°C): $x_4 = ${r3(x)}$`; },
    },
  },
  { type: 'quiz', prompt: 'Why is the pump work tiny compared with the turbine work?', options: [{ tex: 'The pump compresses liquid, whose specific volume is ~1000× smaller than steam', correct: true }, { tex: 'The pump is more efficient', why: R`Even an ideal pump: $w = \int v\,dP$, and liquid $v$ is tiny.` }, { tex: 'The pressure rise is small', why: 'The pump raises the pressure by the same amount the turbine drops it.' }] },
];

SA.registerCourse({
  course: 'MAAE 3400',
  chapters: [{ id: 'th-gas', name: 'Gas power cycles' }, { id: 'th-vap', name: 'Vapour power cycles' }],
  topics: [
    { id: 'th-otto', ch: 'th-gas', sec: 'th1', name: 'Otto cycle', desc: 'r, T₂, η, MEP.', gen: genOtto },
    { id: 'th-diesel', ch: 'th-gas', sec: 'th1', name: 'Diesel cycle', desc: 'Cutoff ratio and efficiency.', gen: genDiesel },
    { id: 'th-brayton', ch: 'th-gas', sec: 'th2', name: 'Brayton cycle', desc: 'r_p, back work, η_c, η_t, regeneration.', gen: genBrayton },
    { id: 'th-rankine', ch: 'th-vap', sec: 'th3', name: 'Rankine cycle', desc: 'Pump, quality, η.', gen: genRankine },
  ],
  sections: [
    { id: 'th1', tag: 'Wk 1–2', num: '1', title: 'Air-standard cycles: Otto and Diesel', chapter: 'Winter preview · Gas cycles', skills: ['th-otto', 'th-diesel'], lesson: LBasics },
    { id: 'th2', tag: 'Wk 3–4', num: '2', title: 'Gas turbines: the Brayton cycle', chapter: 'Winter preview · Gas cycles', skills: ['th-brayton'], lesson: LBray },
    { id: 'th3', tag: 'Wk 5–6', num: '3', title: 'Vapour power: the Rankine cycle', chapter: 'Winter preview · Vapour cycles', skills: ['th-rankine'], lesson: LRank },
  ],
});
