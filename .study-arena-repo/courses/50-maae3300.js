// MAAE 3300 — Fluid Mechanics II. Lecture notes 1–6: review of Fluids I, ideal-gas thermodynamics,
// stagnation properties, speed of sound and Mach number, normal shocks, isentropic variable-area flow.
const { R, pick, randInt, rand, rnd, bisect } = SA;
const K = 1.4, RAIR = 287, CP = 1005, G = 9.81;
const r2 = (v) => +v.toFixed(2), r3 = (v) => +v.toFixed(3), r4 = (v) => +v.toFixed(4);
const num = (v) => String(rnd(v));
const TOL = 3e-3;
const D2R = Math.PI / 180;
// isentropic + shock functions (k = 1.4 unless given)
const TT0 = (M, k = K) => 1 / (1 + ((k - 1) / 2) * M * M);
const pp0 = (M, k = K) => TT0(M, k) ** (k / (k - 1));
const rr0 = (M, k = K) => TT0(M, k) ** (1 / (k - 1));
const AAs = (M, k = K) => (1 / M) * ((2 / (k + 1)) * (1 + ((k - 1) / 2) * M * M)) ** ((k + 1) / (2 * (k - 1)));
const shockMy = (M, k = K) => Math.sqrt((M * M + 2 / (k - 1)) / ((2 * k * M * M) / (k - 1) - 1));
const shockP = (M, k = K) => (2 * k * M * M - (k - 1)) / (k + 1);
const shockRho = (M, k = K) => ((k + 1) * M * M) / ((k - 1) * M * M + 2);
const shockT = (M, k = K) => shockP(M, k) / shockRho(M, k);
const shockP0 = (M, k = K) => { const My = shockMy(M, k); return (shockP(M, k) * pp0(M, k)) / pp0(My, k); };

/* ================= Review ================= */
function genContinuity() {
  if (Math.random() < 0.5) {
    const D1 = pick([0.1, 0.15, 0.2, 0.3]), D2 = pick([0.05, 0.075, 0.1]), V1 = pick([1, 1.5, 2, 3]);
    if (D2 >= D1) return genContinuity();
    const V2 = V1 * (D1 / D2) ** 2;
    return {
      points: 10, prompt: `Water flows at $${V1}$ m/s in a $${D1 * 1000}$ mm pipe that reduces to $${D2 * 1000}$ mm. Find the velocity (m/s) in the smaller pipe.`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter m/s.', answer: num(V2), answerTex: `V_2 = V_1\\left(\\frac{D_1}{D_2}\\right)^2 = ${r3(V2)}\\text{ m/s}`,
      steps: [{ key: 'q', title: 'Incompressible continuity', body: R`$Q = A_1V_1 = A_2V_2$; areas scale with $D^2$.` }],
      mistakes: [{ expr: num((V1 * D1) / D2), step: 'q', why: 'Area goes with $D^2$, not $D$.' }, { expr: num(V1 * (D2 / D1) ** 2), step: 'q', why: 'The flow speeds up in the smaller pipe.' }],
    };
  }
  const m = pick([20, 40, 60]), p = pick([300, 500, 750]), Tc = pick([20, 120, 250]), D = pick([0.3, 0.4, 0.5]);
  const rho = (p * 1e3) / (RAIR * (Tc + 273.15)), V = m / (rho * Math.PI * D * D / 4);
  return {
    points: 15, prompt: `Air leaves an engine at $${m}$ kg/s with absolute pressure $${p}$ kPa and $${Tc}$ °C through a $${D}$ m diameter exit. Find the exit velocity (m/s).`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter m/s.', answer: num(V), answerTex: `V = \\frac{\\dot m}{\\rho A} = ${r2(V)}\\text{ m/s}`,
    steps: [
      { key: 'rho', title: 'Ideal gas density', body: `$\\rho = \\frac{p}{RT} = \\frac{${p}\\times10^3}{287(${Tc} + 273.15)} = ${r3(rho)}$ kg/m³` },
      { key: 'v', title: 'Mass flow', body: `$\\dot m = \\rho AV$ with $A = \\frac{\\pi(${D})^2}{4} = ${r4((Math.PI * D * D) / 4)}$ m², so $V = ${r2(V)}$ m/s.` },
    ],
    mistakes: [{ expr: num(m / (((p * 1e3) / (RAIR * Tc)) * Math.PI * D * D / 4)), step: 'rho', why: 'The ideal-gas law needs absolute temperature (K).' }, { expr: num(m / (rho * Math.PI * D * D)), step: 'v', why: 'Area is $\\pi D^2/4$.' }],
  };
}

function genPump() {
  const Q = pick([0.1, 0.2, 0.3]), D1 = pick([0.25, 0.3]), D2 = pick([0.15, 0.2]), p1 = -pick([10, 25, 40]), p2 = pick([300, 500, 700]), dz = pick([5, 10, 15]), Pin = pick([150, 250, 310, 400]);
  const V1 = Q / (Math.PI * D1 * D1 / 4), V2 = Q / (Math.PI * D2 * D2 / 4);
  const h = ((p2 - p1) * 1e3) / (1000 * G) + (V2 * V2 - V1 * V1) / (2 * G) + dz, P = (1000 * G * Q * h) / 1e3;
  if (P >= Pin) return genPump();
  const askEff = Math.random() < 0.4;
  return {
    points: 20,
    prompt: `A pump delivers $${Q}$ m³/s of water. Suction: $${D1}$ m pipe, $${p1}$ kPa(gauge). Discharge: $${D2}$ m pipe, $${p2}$ kPa(gauge), $${dz}$ m higher. ${askEff ? `If it draws $${Pin}$ kW, what is its efficiency (as a decimal)?` : 'Find the ideal pumping power (kW).'}`,
    vars: [], sample: () => ({}), tol: TOL, hint: askEff ? 'Enter a decimal, e.g. 0.82' : 'Enter kW.', answer: num(askEff ? P / Pin : P), answerTex: askEff ? `\\eta = ${r3(P / Pin)}` : `\\dot W = \\rho gQh_p = ${r2(P)}\\text{ kW}`,
    steps: [
      { key: 'v', title: 'Velocities', body: `$V_1 = \\frac{Q}{A_1} = ${r3(V1)}$, $V_2 = ${r3(V2)}$ m/s` },
      { key: 'h', title: 'Pump head (energy equation)', body: `$h_p = \\frac{p_2 - p_1}{\\rho g} + \\frac{V_2^2 - V_1^2}{2g} + (z_2 - z_1) = ${r2(((p2 - p1) * 1e3) / (1000 * G))} + ${r3((V2 * V2 - V1 * V1) / (2 * G))} + ${dz} = ${r2(h)}$ m` },
      { key: 'p', title: 'Power', body: `$\\dot W = \\rho gQh_p = ${r2(P)}$ kW${askEff ? `, $\\eta = \\frac{${r2(P)}}{${Pin}} = ${r3(P / Pin)}$` : ''}` },
    ],
    mistakes: [
      { expr: num(askEff ? ((1000 * G * Q * (((p2 + p1) * 1e3) / (1000 * G) + (V2 * V2 - V1 * V1) / (2 * G) + dz)) / 1e3) / Pin : (1000 * G * Q * (((p2 + p1) * 1e3) / (1000 * G) + (V2 * V2 - V1 * V1) / (2 * G) + dz)) / 1e3), step: 'h', why: `The suction pressure is negative (gauge): $p_2 - p_1 = ${p2} - (${p1}) = ${p2 - p1}$ kPa.` },
      { expr: num(askEff ? ((1000 * G * Q * (((p2 - p1) * 1e3) / (1000 * G) + dz)) / 1e3) / Pin : (1000 * G * Q * (((p2 - p1) * 1e3) / (1000 * G) + dz)) / 1e3), step: 'h', why: 'Include the velocity-head change; the pipes have different diameters.' },
      ...(askEff ? [{ expr: num(Pin / P), step: 'p', why: 'Efficiency is useful power over consumed power, less than 1.' }] : []),
    ],
  };
}

function genPipeLoss() {
  const nu = 1e-6, D = pick([0.01, 0.02, 0.05]), Vv = pick([0.05, 0.08, 0.1, 0.5, 1, 2]), L = pick([5, 10, 20, 50]);
  const Re = (Vv * D) / nu;
  if (Re < 2000) {
    const f = 64 / Re, hL = (f * (L / D) * Vv * Vv) / (2 * G);
    const askF = Math.random() < 0.35;
    return {
      points: 15, prompt: `Water ($\\nu = 1.0\\times10^{-6}$ m²/s) flows at $${Vv}$ m/s through a $${D * 1000}$ mm pipe, $${L}$ m long. ${askF ? 'Find the Darcy friction factor $f$.' : 'Find the head loss $h_L$ (m).'}`,
      vars: [], sample: () => ({}), tol: TOL, hint: askF ? 'Enter a number.' : 'Enter metres.', answer: num(askF ? f : hL), answerTex: askF ? `f = \\frac{64}{Re} = ${r4(f)}` : `h_L = f\\frac LD\\frac{V^2}{2g} = ${r4(hL)}\\text{ m}`,
      steps: [
        { key: 're', title: 'Reynolds number', body: `$Re = \\frac{VD}{\\nu} = ${r2(Re)} < 2000$: laminar.` },
        { key: 'f', title: 'Laminar friction factor', body: `$f = \\frac{64}{Re} = ${r4(f)}$` },
        ...(askF ? [] : [{ key: 'h', title: 'Darcy–Weisbach', body: `$h_L = f\\frac{L}{D}\\frac{V^2}{2g} = ${r4(hL)}$ m` }]),
      ],
      mistakes: askF ? [{ expr: num(16 / Re), step: 'f', why: '$16/Re$ is the Fanning factor; the course uses Darcy: $64/Re$.' }] : [{ expr: num((f * L * Vv * Vv) / (2 * G)), step: 'h', why: 'Use $L/D$, not $L$.' }, { expr: num((f * (L / D) * Vv * Vv) / G), step: 'h', why: 'Velocity head is $V^2/2g$.' }],
    };
  }
  const Kv = pick([0.5, 1.5, 5, 10]), n = randInt(1, 4), Vt = pick([1, 2, 3]);
  const hm = (n * Kv * Vt * Vt) / (2 * G);
  return {
    points: 10, prompt: `A single pipe carries water at $${Vt}$ m/s through ${n} fitting${n > 1 ? 's' : ''} with loss coefficient $K_L = ${Kv}$ each. Find the total minor head loss (m).`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter metres.', answer: num(hm), answerTex: `h_m = \\sum K_L\\frac{V^2}{2g} = ${r4(hm)}\\text{ m}`,
    steps: [{ key: 'k', title: 'Minor losses', body: `$h_m = \\left(\\sum K_L\\right)\\frac{V^2}{2g} = ${n * Kv}\\times\\frac{${Vt}^2}{2(9.81)} = ${r4(hm)}$ m` }],
    mistakes: [{ expr: num((Kv * Vt * Vt) / (2 * G)), step: 'k', why: 'Add the loss coefficients of every fitting.' }, { expr: num(n * Kv * Vt), step: 'k', why: 'Loss coefficients multiply the velocity head $V^2/2g$.' }],
  };
}

/* ================= Ideal gas + isentropic ================= */
function genIsentropicProcess() {
  const p1 = pick([800, 1000, 1200, 1500]), p2 = pick([100, 150, 200]), T1 = pick([900, 1000, 1200]), eta = pick([0.8, 0.85, 0.9]);
  const T2s = T1 * (p2 / p1) ** ((K - 1) / K), T2 = T1 - eta * (T1 - T2s);
  const ask = pick(['T2s', 'T2', 'ds']);
  const ds = CP * Math.log(T2 / T1) - RAIR * Math.log(p2 / p1);
  const v = { T2s, T2, ds }[ask];
  return {
    points: 20,
    prompt: `Air ($k = 1.4$, $c_p = 1005$, $R = 287$ J/kg·K) expands adiabatically in a turbine from $${p1}$ kPa, $${T1}$ K to $${p2}$ kPa. The actual temperature drop is $${eta * 100}\\%$ of the ideal one. Find ${{ T2s: 'the ideal (isentropic) exit temperature (K)', T2: 'the actual exit temperature (K)', ds: 'the actual entropy change $s_2 - s_1$ (J/kg·K)' }[ask]}.`,
    vars: [], sample: () => ({}), tol: TOL, hint: ask === 'ds' ? 'Enter J/kg·K.' : 'Enter kelvin.', answer: num(v), answerTex: { T2s: `T_{2s} = ${r2(T2s)}\\text{ K}`, T2: `T_2 = ${r2(T2)}\\text{ K}`, ds: `s_2 - s_1 = ${r2(ds)}\\text{ J/kg·K}` }[ask].replace('J/kg·K', 'J/(kg\\,K)'),
    steps: [
      { key: 's', title: 'Isentropic relation', body: `$\\frac{T_{2s}}{T_1} = \\left(\\frac{p_2}{p_1}\\right)^{(k-1)/k}$: $T_{2s} = ${T1}\\left(\\frac{${p2}}{${p1}}\\right)^{0.2857} = ${r2(T2s)}$ K` },
      { key: 'a', title: 'Actual temperature', body: `$T_2 = T_1 - ${eta}(T_1 - T_{2s}) = ${r2(T2)}$ K` },
      { key: 'ds', title: 'Entropy change', body: `$s_2 - s_1 = c_p\\ln\\frac{T_2}{T_1} - R\\ln\\frac{p_2}{p_1} = ${r2(ds)}$ J/kg·K $> 0$: the real expansion is irreversible.` },
    ],
    mistakes: [
      { expr: num(ask === 'ds' ? CP * Math.log(T2 / T1) + RAIR * Math.log(p2 / p1) : ask === 'T2s' ? T1 * (p2 / p1) ** (1 / K) : T1 - eta * (T1 - T1 * (p2 / p1) ** (1 / K))), step: ask === 'ds' ? 'ds' : 's', why: ask === 'ds' ? 'The pressure term is subtracted: $-R\\ln(p_2/p_1)$.' : 'The exponent is $(k-1)/k$, not $1/k$.' },
      ...(ask === 'T2' ? [{ expr: num(T2s), step: 'a', why: 'That is the ideal exit temperature; the real turbine extracts less, so $T_2 > T_{2s}$.' }] : []),
      ...(ask === 'ds' ? [{ expr: '0', step: 'ds', why: 'Only the ideal process is isentropic.' }] : []),
    ],
  };
}

/* ================= Stagnation + Mach ================= */
function genStagnation() {
  const kind = pick(['T0', 'M', 'p0', 'pitot']);
  if (kind === 'pitot') {
    const p0 = pick([120, 150, 200]), p = pick([80, 100]), T0 = pick([300, 373, 400]);
    if (p >= p0) return genStagnation();
    const T = T0 * (p / p0) ** ((K - 1) / K), V = Math.sqrt(2 * CP * (T0 - T)), Vin = Math.sqrt((2 * (p0 - p) * 1e3) / ((p0 * 1e3) / (RAIR * T0)));
    return {
      points: 20, prompt: `A Pitot-static probe in air reads $p_0 = ${p0}$ kPa, $p = ${p}$ kPa, $T_0 = ${T0}$ K. Find the air velocity (m/s) treating the flow as compressible.`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter m/s.', answer: num(V), answerTex: `V = \\sqrt{2c_p(T_0 - T)} = ${r2(V)}\\text{ m/s}`,
      steps: [
        { key: 't', title: 'Static temperature (isentropic)', body: `$T = T_0\\left(\\frac{p}{p_0}\\right)^{(k-1)/k} = ${r2(T)}$ K` },
        { key: 'v', title: 'Energy equation', body: `$c_pT + \\frac{V^2}{2} = c_pT_0 \\Rightarrow V = \\sqrt{2(1005)(${T0} - ${r2(T)})} = ${r2(V)}$ m/s` },
      ],
      mistakes: [{ expr: num(Vin), step: 't', why: `That is the incompressible (Bernoulli) answer; at this speed compressibility matters (${r2((Math.abs(V - Vin) / V) * 100)}% off).` }],
    };
  }
  const T = pick([216.66, 250, 288.15, 300]), Vv = pick([200, 300, 500, 700, 924]);
  const c = Math.sqrt(K * RAIR * T), M = Vv / c, T0 = T / TT0(M);
  if (kind === 'T0') return {
    points: 15, prompt: `Air at $T = ${T}$ K moves at $${Vv}$ m/s. Find the stagnation temperature $T_0$ (K).`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter kelvin.', answer: num(T0), answerTex: `T_0 = T + \\frac{V^2}{2c_p} = ${r2(T0)}\\text{ K}`,
    steps: [{ key: 'e', title: 'Stagnation enthalpy', body: `$c_pT_0 = c_pT + \\frac{V^2}{2}$: $T_0 = ${T} + \\frac{${Vv}^2}{2(1005)} = ${r2(T0)}$ K (equivalently $\\frac{T_0}{T} = 1 + \\frac{k-1}{2}Ma^2$ with $Ma = ${r3(M)}$).` }],
    mistakes: [{ expr: num(T + (Vv * Vv) / CP), step: 'e', why: 'Kinetic energy per unit mass is $V^2/2$.' }, { expr: num(T + (Vv * Vv) / (2 * RAIR)), step: 'e', why: 'Use $c_p$, not $R$.' }],
  };
  if (kind === 'p0') {
    const p = pick([30, 50, 80, 101.3]), M2 = pick([0.3, 0.5, 0.8, 1.5, 2]);
    const p0 = p / pp0(M2), pinc = p + 0.5 * K * p * M2 * M2;
    return {
      points: 15, prompt: `Air flows at $Ma = ${M2}$ with static pressure $${p}$ kPa. Find the stagnation pressure (kPa).`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter kPa.', answer: num(p0), answerTex: `p_0 = p\\left(1 + 0.2Ma^2\\right)^{3.5} = ${r2(p0)}\\text{ kPa}`,
      steps: [{ key: 'i', title: 'Isentropic stagnation relation', body: `$\\frac{p_0}{p} = \\left(1 + \\frac{k-1}{2}Ma^2\\right)^{k/(k-1)} = ${r4(1 / pp0(M2))}$` }],
      mistakes: [{ expr: num(pinc), step: 'i', why: '$p + \\frac12\\rho V^2$ is the incompressible estimate; it underestimates $p_0$ at higher Mach.' }, { expr: num(p * (1 + 0.2 * M2 * M2)), step: 'i', why: 'That is $T_0/T$. Pressure has the exponent $k/(k-1) = 3.5$.' }],
    };
  }
  const T0t = pick([500, 600, 773.15]), Tamb = 216.66;
  const Mt = Math.sqrt((T0t / Tamb - 1) / 0.2);
  return {
    points: 15, prompt: `At 20 km altitude ($T = 216.66$ K), at what Mach number does the nose stagnation temperature reach $${T0t}$ K?`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter Mach number.', answer: num(Mt), answerTex: `Ma = \\sqrt{\\frac{T_0/T - 1}{0.2}} = ${r3(Mt)}`,
    steps: [{ key: 'm', title: 'Invert T₀/T', body: `$\\frac{T_0}{T} = 1 + 0.2Ma^2 = ${r4(T0t / Tamb)}$, so $Ma = ${r3(Mt)}$.` }],
    mistakes: [{ expr: num((T0t / Tamb - 1) / 0.2), step: 'm', why: 'That is $Ma^2$; take the square root.' }, { expr: num(Math.sqrt(T0t / Tamb - 1)), step: 'm', why: 'Divide by $\\frac{k-1}{2} = 0.2$.' }],
  };
}

function genSound() {
  const kind = pick(['c', 'angle', 'delay']);
  const gas = pick([{ n: 'air', k: 1.4, R: 287 }, { n: 'air', k: 1.4, R: 287 }, { n: 'helium', k: 1.66, R: 2077 }]);
  const Tc = pick([-50, 0, 20, 30]), T = Tc + 273.15, c = Math.sqrt(gas.k * gas.R * T);
  if (kind === 'c') {
    const V = pick([100, 250, 400, 600]);
    const ask = Math.random() < 0.5 ? 'c' : 'M';
    return {
      points: 10, prompt: ask === 'c' ? `Find the speed of sound (m/s) in ${gas.n} ($k = ${gas.k}$, $R = ${gas.R}$ J/kg·K) at $${Tc}$ °C.` : `An object moves at $${V}$ m/s through ${gas.n} ($k = ${gas.k}$, $R = ${gas.R}$) at $${Tc}$ °C. What is its Mach number?`,
      vars: [], sample: () => ({}), tol: TOL, hint: ask === 'c' ? 'Enter m/s.' : 'Enter a number.', answer: num(ask === 'c' ? c : V / c), answerTex: ask === 'c' ? `c = \\sqrt{kRT} = ${r2(c)}\\text{ m/s}` : `Ma = \\frac{V}{c} = ${r3(V / c)}`,
      steps: [{ key: 'c', title: 'Ideal gas sound speed', body: `$c = \\sqrt{kRT} = \\sqrt{${gas.k}(${gas.R})(${r2(T)})} = ${r2(c)}$ m/s (absolute temperature!)` }, ...(ask === 'M' ? [{ key: 'm', title: 'Mach number', body: `$Ma = ${V}/${r2(c)} = ${r3(V / c)}$` }] : [])],
      mistakes: [{ expr: num(ask === 'c' ? Math.sqrt(gas.k * gas.R * Math.max(Tc, 1)) : V / Math.sqrt(gas.k * gas.R * Math.max(Tc, 1))), step: 'c', why: 'Use kelvin in $kRT$.' }, { expr: num(ask === 'c' ? Math.sqrt(gas.R * T) : V / Math.sqrt(gas.R * T)), step: 'c', why: 'Sound waves are isentropic: include $k$ (Newton\'s isothermal $\\sqrt{RT}$ is wrong).' }],
    };
  }
  const M = pick([1.2, 1.5, 2, 2.5, 3]), alpha = Math.asin(1 / M) / D2R;
  if (kind === 'angle') return {
    points: 10, prompt: `What is the Mach angle (degrees) for a body moving at $Ma = ${M}$?`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter degrees.', answer: num(alpha), answerTex: `\\alpha = \\arcsin\\frac{1}{Ma} = ${r2(alpha)}^\\circ`,
    figure: machFig(M),
    steps: [{ key: 'a', title: 'Mach cone geometry', body: R`In time $t$ the body travels $Vt$ while the first wave has grown to radius $ct$: $\sin\alpha = \frac{ct}{Vt} = \frac{1}{Ma}$.` }],
    mistakes: [{ expr: num(Math.acos(1 / M) / D2R), step: 'a', why: '$\\sin\\alpha = 1/Ma$ (opposite over hypotenuse), not $\\cos$.' }, { expr: num(Math.atan(1 / M) / D2R), step: 'a', why: 'The hypotenuse is $Vt$: use $\\arcsin$.' }],
  };
  const h = pick([1000, 2000, 5000]), Ta = 20, ca = Math.sqrt(K * RAIR * (Ta + 273.15)), V = M * ca, dt = h / (V * Math.tan(Math.asin(1 / M)));
  return {
    points: 20, prompt: `An aircraft flies at $Ma = ${M}$ at altitude $${h}$ m (air at 20 °C). How many seconds after it passes directly overhead do you hear it?`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter seconds.', answer: num(dt), answerTex: `\\Delta t = \\frac{h}{V\\tan\\alpha} = ${r3(dt)}\\text{ s}`,
    figure: machFig(M),
    steps: [
      { key: 'c', title: 'Speeds and angle', body: `$c = \\sqrt{1.4(287)(293.15)} = ${r2(ca)}$ m/s, $V = ${r2(V)}$ m/s, $\\alpha = \\arcsin\\frac1{${M}} = ${r2(Math.asin(1 / M) / D2R)}^\\circ$` },
      { key: 'x', title: 'Where the cone reaches you', body: `The cone passes over you when the plane is $x = \\frac{h}{\\tan\\alpha} = ${r2(h / Math.tan(Math.asin(1 / M)))}$ m past.` },
      { key: 't', title: 'Time', body: `$\\Delta t = \\frac{x}{V} = ${r3(dt)}$ s` },
    ],
    mistakes: [{ expr: num(h / ca), step: 'x', why: 'The sound you hear was not emitted when the plane was overhead; it comes from the Mach cone.' }, { expr: num((h * Math.tan(Math.asin(1 / M))) / V), step: 'x', why: '$\\tan\\alpha = h/x$, so $x = h/\\tan\\alpha$.' }],
  };
}
function machFig(M) {
  return { kind: 'sketch', height: 220, view: [-1, 7.5, -2.4, 2.4], items: waveItems(M, 6) };
}
function waveItems(M, n) {
  // source now at x = M*n (c = 1, one wave per time unit), emitted at times 0..n-1
  const items = [];
  const xs = M * n;
  for (let k = 0; k < n; k++) items.push({ t: 'circle', x: M * k, y: 0, r: n - k, color: 'muted', width: 1.2 });
  items.push({ t: 'dot', x: xs, y: 0, color: 1, size: 5 });
  if (M > 1) { const a = Math.asin(1 / M), L = n * M * 1.05; items.push({ t: 'line', x1: xs, y1: 0, x2: xs - L * Math.cos(a), y2: L * Math.sin(a), color: 3 }, { t: 'line', x1: xs, y1: 0, x2: xs - L * Math.cos(a), y2: -L * Math.sin(a), color: 3 }, { t: 'text', x: xs - 0.55 * L * Math.cos(a), y: 0.55 * L * Math.sin(a), dx: 6, dy: -6, text: `α = ${(a / D2R).toFixed(1)}°`, anchor: 'start', color: 3, size: 12 }); }
  return items;
}

/* ================= Normal shocks ================= */
function genShock() {
  const M = pick([1.3, 1.5, 1.8, 2, 2.5, 3]), ask = pick(['My', 'p', 'T', 'p0', 'pitot']);
  if (ask === 'pitot') {
    const px = pick([10, 12, 15, 20]), p0y = px * shockP0(M) / pp0(M);
    return {
      points: 25, prompt: `A total-pressure probe in a supersonic air stream reads $p_{0y} = ${r2(p0y)}$ kPa behind its bow shock, while a wall tap reads the upstream static pressure $p_x = ${px}$ kPa. Find the upstream Mach number.`,
      vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter Ma_x.', answer: num(M), answerTex: `Ma_x = ${M}`,
      steps: [
        { key: 'split', title: 'Split the ratio', body: R`$\frac{p_{0y}}{p_x} = \frac{p_{0y}}{p_y}\cdot\frac{p_y}{p_x}$: isentropic deceleration behind the shock, times the normal-shock static pressure jump.` },
        { key: 'solve', title: 'Solve for Maₓ', body: `$\\frac{p_{0y}}{p_x} = ${r4(p0y / px)}$. Iterating (or the normal-shock table) gives $Ma_x = ${M}$, $Ma_y = ${r3(shockMy(M))}$.` },
      ],
      mistakes: [{ expr: num(Math.sqrt(((p0y / px) ** (2 / 7) - 1) / 0.2)), step: 'split', why: 'The probe sits behind a shock; the plain isentropic $p_0/p$ relation ignores the stagnation-pressure loss.' }],
      verify: { kind: 'self' },
    };
  }
  const v = { My: shockMy(M), p: shockP(M), T: shockT(M), p0: shockP0(M) }[ask];
  return {
    points: 15,
    prompt: `Air ($k = 1.4$) at $Ma_x = ${M}$ passes through a normal shock. Find ${{ My: 'the downstream Mach number $Ma_y$', p: 'the static pressure ratio $p_y/p_x$', T: 'the static temperature ratio $T_y/T_x$', p0: 'the stagnation pressure ratio $p_{0y}/p_{0x}$' }[ask]}.`,
    vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter a number.', answer: num(v), answerTex: `${{ My: 'Ma_y', p: '\\frac{p_y}{p_x}', T: '\\frac{T_y}{T_x}', p0: '\\frac{p_{0y}}{p_{0x}}' }[ask]} = ${r4(v)}`,
    steps: [
      { key: 'eq', title: 'Normal-shock relations', body: { My: R`$Ma_y^2 = \dfrac{Ma_x^2 + \frac{2}{k-1}}{\frac{2k}{k-1}Ma_x^2 - 1}$`, p: R`$\dfrac{p_y}{p_x} = \dfrac{2kMa_x^2 - (k-1)}{k+1}$`, T: R`$\dfrac{T_y}{T_x} = \dfrac{1 + \frac{k-1}{2}Ma_x^2}{1 + \frac{k-1}{2}Ma_y^2}$ (since $T_0$ is constant)`, p0: R`$\dfrac{p_{0y}}{p_{0x}} = \dfrac{p_y}{p_x}\cdot\dfrac{(p_0/p)_y}{(p_0/p)_x}$` }[ask] },
      { key: 'n', title: 'Numbers', body: `$Ma_y = ${r4(shockMy(M))}$, $\\frac{p_y}{p_x} = ${r4(shockP(M))}$, $\\frac{T_y}{T_x} = ${r4(shockT(M))}$, $\\frac{p_{0y}}{p_{0x}} = ${r4(shockP0(M))}$` },
    ],
    mistakes: [
      ...(ask === 'My' ? [{ expr: num(1 / M), step: 'eq', why: 'Not simply $1/Ma_x$; use the shock relation.' }] : []),
      ...(ask === 'p0' ? [{ expr: '1', step: 'eq', why: 'Stagnation temperature is conserved across a shock; stagnation pressure is not (entropy rises).' }, { expr: num(shockP(M)), step: 'eq', why: 'That is the static pressure ratio. The stagnation pressure falls.' }] : []),
      ...(ask === 'T' ? [{ expr: '1', step: 'eq', why: 'Stagnation temperature is constant; static temperature rises.' }, { expr: num(shockRho(M)), step: 'eq', why: 'That is the density ratio.' }] : []),
      ...(ask === 'p' ? [{ expr: num(1 / pp0(M)), step: 'eq', why: 'That is the isentropic $p_0/p$; a shock is not isentropic.' }] : []),
    ],
  };
}

/* ================= Isentropic duct flow ================= */
function genNozzle() {
  const kind = pick(['AAs', 'Mfrom', 'critical', 'duct']);
  if (kind === 'AAs') {
    const M = pick([0.3, 0.5, 0.8, 1.5, 2, 2.5, 3]);
    return {
      points: 15, prompt: `For isentropic air flow ($k = 1.4$), find the area ratio $A/A^*$ at $Ma = ${M}$.`,
      vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter a number.', answer: num(AAs(M)), answerTex: `\\frac{A}{A^*} = ${r4(AAs(M))}`,
      steps: [{ key: 'f', title: 'Area–Mach relation', body: R`$\dfrac{A}{A^*} = \dfrac{1}{Ma}\left[\dfrac{2}{k+1}\left(1 + \dfrac{k-1}{2}Ma^2\right)\right]^{\frac{k+1}{2(k-1)}}$, exponent 3 for air.` }],
      mistakes: [{ expr: num((1 / M) * ((2 / (K + 1)) * (1 + ((K - 1) / 2) * M * M)) ** 2.5), step: 'f', why: 'The exponent is $\\frac{k+1}{2(k-1)} = 3$ for $k = 1.4$.' }, { expr: num(1 / M), step: 'f', why: 'Density changes too; $A/A^* \\ne 1/Ma$.' }],
    };
  }
  if (kind === 'Mfrom') {
    const ratio = pick([1.5, 2, 2.5, 4]), sup = Math.random() < 0.6;
    const M = sup ? bisect((m) => AAs(m) - ratio, 1.0001, 10) : bisect((m) => AAs(m) - ratio, 0.01, 0.9999);
    return {
      points: 20, prompt: `In a converging–diverging nozzle with a sonic throat, find the ${sup ? 'supersonic' : 'subsonic'} Mach number where $A/A^* = ${ratio}$.`,
      vars: [], sample: () => ({}), tol: 3e-3, hint: 'Enter Mach number.', answer: num(M), answerTex: `Ma = ${r4(M)}`,
      steps: [
        { key: 'two', title: 'Two solutions', body: R`Every $A/A^* > 1$ has one subsonic and one supersonic solution. Which one occurs depends on the back pressure; downstream of a sonic throat with a low back pressure, it's the supersonic branch.` },
        { key: 'it', title: 'Solve', body: `Iterating $\\frac{A}{A^*}(Ma) = ${ratio}$ on the ${sup ? 'supersonic' : 'subsonic'} branch gives $Ma = ${r4(M)}$ (table D.1 to check).` },
      ],
      mistakes: [{ expr: num(sup ? bisect((m) => AAs(m) - ratio, 0.01, 0.9999) : bisect((m) => AAs(m) - ratio, 1.0001, 10)), step: 'two', why: `That is the ${sup ? 'subsonic' : 'supersonic'} solution of the same area ratio.` }],
      verify: { kind: 'self' },
    };
  }
  if (kind === 'critical') {
    const p0 = pick([200, 500, 700]), T0 = pick([300, 400, 500]), ask = pick(['p', 'T', 'V']);
    const Ts = T0 * TT0(1), ps = p0 * pp0(1), Vs = Math.sqrt(K * RAIR * Ts);
    const v = { p: ps, T: Ts, V: Vs }[ask];
    return {
      points: 15, prompt: `Air flows isentropically from a reservoir at $p_0 = ${p0}$ kPa, $T_0 = ${T0}$ K through a choked converging nozzle. Find the ${{ p: 'pressure (kPa)', T: 'temperature (K)', V: 'velocity (m/s)' }[ask]} at the exit (throat).`,
      vars: [], sample: () => ({}), tol: TOL, hint: 'Enter a number.', answer: num(v), answerTex: { p: `p^* = 0.5283p_0 = ${r2(ps)}\\text{ kPa}`, T: `T^* = 0.8333T_0 = ${r2(Ts)}\\text{ K}`, V: `V^* = \\sqrt{kRT^*} = ${r2(Vs)}\\text{ m/s}` }[ask],
      steps: [
        { key: 'c', title: 'Choked means sonic at the exit', body: R`A converging nozzle can accelerate the flow at most to $Ma = 1$, at its exit. That is the critical state (*).` },
        { key: 'r', title: 'Critical ratios (k = 1.4)', body: R`$\frac{T^*}{T_0} = \frac{2}{k+1} = 0.8333$, $\frac{p^*}{p_0} = 0.5283$, $\frac{\rho^*}{\rho_0} = 0.6339$, and $V^* = c^* = \sqrt{kRT^*}$.` },
      ],
      mistakes: [{ expr: num(ask === 'p' ? p0 : ask === 'T' ? T0 : 0), step: 'c', why: 'Those are reservoir (stagnation) values; the flow at the exit is moving at sonic speed.' }, ...(ask === 'V' ? [{ expr: num(Math.sqrt(K * RAIR * T0)), step: 'r', why: 'Use the static temperature $T^*$, not $T_0$, in the sound speed.' }] : [])],
    };
  }
  const T1 = pick([300, 311, 350]), V1 = pick([100, 150, 200]), p1 = pick([300, 345, 400]), M2 = pick([1.5, 1.8, 2, 2.5]);
  const T0 = T1 + (V1 * V1) / (2 * CP), M1 = V1 / Math.sqrt(K * RAIR * T1), p0 = p1 / pp0(M1);
  const T2 = T0 * TT0(M2), p2 = p0 * pp0(M2), V2 = M2 * Math.sqrt(K * RAIR * T2);
  const ask = pick(['T2', 'p2', 'V2']);
  const v = { T2, p2, V2 }[ask];
  return {
    points: 25, prompt: `Air flows steadily and isentropically in a duct. At section 1: $p = ${p1}$ kPa, $T = ${T1}$ K, $V = ${V1}$ m/s. At section 2, $Ma = ${M2}$. Find ${{ T2: '$T_2$ (K)', p2: '$p_2$ (kPa)', V2: '$V_2$ (m/s)' }[ask]}.`,
    vars: [], sample: () => ({}), tol: TOL, hint: 'Enter a number.', answer: num(v), answerTex: { T2: `T_2 = ${r2(T2)}\\text{ K}`, p2: `p_2 = ${r2(p2)}\\text{ kPa}`, V2: `V_2 = ${r2(V2)}\\text{ m/s}` }[ask],
    steps: [
      { key: 's1', title: 'Stagnation state from section 1', body: `$T_0 = T_1 + \\frac{V_1^2}{2c_p} = ${r2(T0)}$ K; $Ma_1 = \\frac{V_1}{\\sqrt{kRT_1}} = ${r4(M1)}$; $p_0 = p_1\\left(1 + 0.2Ma_1^2\\right)^{3.5} = ${r2(p0)}$ kPa` },
      { key: 's2', title: 'Same T₀ and p₀ at section 2', body: `$T_2 = T_0\\left(1 + 0.2(${M2})^2\\right)^{-1} = ${r2(T2)}$ K, $p_2 = p_0\\left(1 + 0.2(${M2})^2\\right)^{-3.5} = ${r2(p2)}$ kPa` },
      { key: 'v', title: 'Velocity', body: `$V_2 = Ma_2\\sqrt{kRT_2} = ${r2(V2)}$ m/s` },
    ],
    mistakes: [
      { expr: num(ask === 'T2' ? T1 * TT0(M2) : ask === 'p2' ? p1 * pp0(M2) : M2 * Math.sqrt(K * RAIR * T1 * TT0(M2))), step: 's1', why: 'Section 1 is not at rest: find the stagnation values first ($Ma_1 \\ne 0$).' },
      ...(ask === 'V2' ? [{ expr: num(M2 * Math.sqrt(K * RAIR * T1)), step: 'v', why: 'Use the local sound speed at section 2; the gas cooled as it accelerated.' }] : []),
    ],
  };
}

/* ================= Lessons ================= */
const LR = [
  { type: 'text', kind: 'key', title: 'Fluids I in one page', body: R`Continuity: $\dot m = \rho AV$ (incompressible: $Q = AV$ constant). Bernoulli along a streamline (steady, inviscid, incompressible, no machines): $p + \frac12\rho V^2 + \rho gz = $ const. Stagnation pressure $p_0 = p + \frac12\rho V^2$.` },
  { type: 'text', kind: 'method', title: 'Energy (head) equation with machines and losses', body: R`$\frac{p_1}{\rho g} + \frac{V_1^2}{2g} + z_1 + h_p = \frac{p_2}{\rho g} + \frac{V_2^2}{2g} + z_2 + h_t + h_L$. Pump power to the fluid $\rho gQh_p$; efficiency = useful power / consumed power.` },
  { type: 'example', title: 'Slides example: pump', prompt: R`$Q = 0.3$ m³/s; suction $0.25$ m at $-25$ kPa(g); discharge $0.2$ m at $700$ kPa(g), $10$ m higher; 310 kW input.`, steps: [
    R`$V_1 = 6.11$, $V_2 = 9.55$ m/s.`,
    R`$h_p = \frac{725000}{9810} + \frac{9.55^2 - 6.11^2}{2(9.81)} + 10 = 73.9 + 2.75 + 10 = 86.6$ m.`,
    R`Ideal power $= 9810(0.3)(86.6) = 255$ kW; $\eta = 255/310 = 0.82$.`,
  ] },
  { type: 'text', kind: 'key', title: 'Pipe friction', body: R`$Re = \frac{\rho VD}{\mu} = \frac{VD}{\nu}$: laminar below 2000, turbulent above 4000. Darcy–Weisbach $h_L = f\frac{L}{D}\frac{V^2}{2g}$, with $f = 64/Re$ (laminar) or Colebrook / Haaland / Moody (turbulent). Minor losses $h_m = K_L\frac{V^2}{2g}$.` },
  {
    type: 'graph', title: 'Friction factor vs Reynolds number',
    body: R`Laminar $64/Re$ on the left, Haaland's turbulent curve on the right for your roughness. Slide $\varepsilon/D$.`,
    widget: {
      params: [{ key: 'e', label: 'log₁₀(ε/D)', min: -6, max: -1.5, step: 0.25, value: -4 }],
      x: [2.5, 7], y: [0, 0.1], xLabel: 'log₁₀ Re', yLabel: 'f',
      curves: (p) => [{ fn: (x) => (x < 3.4 ? 64 / 10 ** x : NaN), label: 'laminar 64/Re' }, { fn: (x) => (x > 3.6 ? (1 / (-1.8 * Math.log10((10 ** p.e / 3.7) ** 1.11 + 6.9 / 10 ** x))) ** 2 : NaN), label: 'turbulent (Haaland)', color: 1 }],
      vlines: [{ x: Math.log10(2000), label: '2000' }, { x: Math.log10(4000), label: '4000' }],
      readout: (p) => `$\\varepsilon/D = ${(10 ** p.e).toExponential(1)}$: at $Re = 10^6$, $f = ${r4((1 / (-1.8 * Math.log10((10 ** p.e / 3.7) ** 1.11 + 6.9 / 1e6))) ** 2)}$`,
    },
  },
  { type: 'quiz', prompt: R`Water ($\nu = 10^{-6}$ m²/s) at 0.1 m/s in a 10 mm tube is`, options: [{ tex: 'Laminar ($Re = 1000$)', correct: true }, { tex: 'Turbulent', why: R`$Re = \frac{0.1(0.01)}{10^{-6}} = 1000 < 2000$.` }, { tex: 'Transitional', why: 'Transitional is 2000–4000.' }] },
];
const LT = [
  { type: 'text', kind: 'key', title: 'Ideal gas, constant specific heats', body: R`$p = \rho RT$ (absolute $p$, $T$). $du = c_vdT$, $dh = c_pdT$, $c_p - c_v = R$, $k = c_p/c_v$, so $c_p = \frac{kR}{k-1}$. Air: $k = 1.4$, $R = 287$, $c_p = 1005$ J/kg·K.` },
  { type: 'text', kind: 'method', title: 'Entropy', body: R`$s_2 - s_1 = c_p\ln\frac{T_2}{T_1} - R\ln\frac{p_2}{p_1} = c_v\ln\frac{T_2}{T_1} + R\ln\frac{\rho_1}{\rho_2}$. Isentropic (adiabatic + frictionless): $\frac{T_2}{T_1} = \left(\frac{p_2}{p_1}\right)^{\frac{k-1}{k}} = \left(\frac{\rho_2}{\rho_1}\right)^{k-1}$, i.e. $p/\rho^k$ = const.` },
  {
    type: 'graph', title: 'Isentropic temperature vs pressure ratio',
    body: R`How cold does air get when it expands isentropically? Compare $k = 1.4$ (air) with $k = 1.67$ (helium).`,
    widget: {
      params: [{ key: 'T1', label: 'T₁ (K)', min: 300, max: 1600, step: 50, value: 1000 }],
      x: [0.02, 1], y: 'auto', xLabel: 'p₂ / p₁', yLabel: 'T₂ (K)',
      curves: (p) => [{ fn: (r) => p.T1 * r ** (0.4 / 1.4), label: 'air k = 1.4' }, { fn: (r) => p.T1 * r ** (0.67 / 1.67), label: 'helium k = 1.67', color: 1 }],
      readout: (p) => `At $p_2/p_1 = 0.1$: air $T_2 = ${r2(p.T1 * 0.1 ** (0.4 / 1.4))}$ K`,
    },
  },
  { type: 'example', title: 'Slides example: turbine', prompt: R`Air from 180 psia, 1600 °R to 14.7 psia; actual $\Delta T$ is 85% of the ideal.`, steps: [
    R`$T_{2s} = 1600\left(\frac{14.7}{180}\right)^{0.4/1.4} = 782$ °R.`,
    R`$T_2 = 1600 - 0.85(1600 - 782) = 905$ °R.`,
    R`$\Delta h = c_p(905 - 1600) = -4.17\times10^6$ ft·lb/slug; $\Delta s = c_p\ln\frac{905}{1600} - R\ln\frac{14.7}{180} = 877$ ft·lb/(slug·°R) $> 0$.`,
  ] },
  { type: 'quiz', prompt: 'A flow through a normal shock is', options: [{ tex: 'Adiabatic but not isentropic', correct: true }, { tex: 'Isentropic', why: 'Large gradients inside the shock make it irreversible: entropy rises.' }, { tex: 'Neither adiabatic nor isentropic', why: 'The shock is too thin for heat transfer: it is adiabatic.' }] },
];
const LS = [
  { type: 'text', kind: 'key', title: 'Stagnation properties', body: R`Bring the flow to rest adiabatically, frictionlessly, with no work: $h_0 = h + \frac{V^2}{2}$, so $T_0 = T + \frac{V^2}{2c_p}$. With $p_0$ and $\rho_0$ from the isentropic relations. $T_0$ measures the total energy; $p_0$ also carries the "quality" (it drops when entropy rises).` },
  { type: 'text', kind: 'method', title: 'In terms of Mach number', body: R`$\frac{T_0}{T} = 1 + \frac{k-1}{2}Ma^2$, $\frac{p_0}{p} = \left(1 + \frac{k-1}{2}Ma^2\right)^{\frac{k}{k-1}}$, $\frac{\rho_0}{\rho} = \left(1 + \frac{k-1}{2}Ma^2\right)^{\frac{1}{k-1}}$.` },
  {
    type: 'graph', title: 'When does compressibility matter?',
    body: R`Compare the exact $p_0/p$ with the incompressible Bernoulli estimate $1 + \frac{k}{2}Ma^2$, and see the density change. Below $Ma \approx 0.3$ density changes by under 5%.`,
    widget: {
      params: [{ key: 'M', label: 'Mach number', min: 0, max: 2, step: 0.05, value: 0.3 }],
      x: [0, 2], y: [0.9, 8], xLabel: 'Ma',
      curves: [{ fn: (M) => 1 / pp0(M), label: 'p₀/p exact' }, { fn: (M) => 1 + 0.7 * M * M, label: 'Bernoulli 1 + kMa²/2', dash: true, color: 1 }, { fn: (M) => 1 / rr0(M), label: 'ρ₀/ρ', color: 2 }],
      vlines: (p) => [{ x: p.M, label: `Ma = ${p.M}` }],
      readout: (p) => `$\\frac{p_0}{p} = ${r4(1 / pp0(p.M))}$ vs Bernoulli $${r4(1 + 0.7 * p.M * p.M)}$; $\\frac{\\rho_0}{\\rho} = ${r4(1 / rr0(p.M))}$ (${r2((1 / rr0(p.M) - 1) * 100)}% density change)`,
    },
  },
  { type: 'example', title: 'Slides example: SR-71 at 20 km', prompt: R`$V = 3326$ km/h $= 923.9$ m/s, $T = 216.66$ K. Nose temperature?`, steps: [
    R`$c = \sqrt{1.4(287)(216.66)} = 295.1$ m/s, $Ma = 3.13$.`,
    R`$\frac{T_0}{T} = 1 + 0.2(3.13)^2 = 2.960$, $T_0 = 641.4$ K $= 368$ °C.`,
    R`For $T_0 = 500$ °C $= 773$ K: $Ma = \sqrt{(773/216.66 - 1)/0.2} = 3.58$.`,
  ] },
  { type: 'text', kind: 'key', title: 'Speed of sound and Mach number', body: R`$c = \sqrt{(\partial p/\partial\rho)_s} = \sqrt{E_v/\rho}$; for an ideal gas $c = \sqrt{kRT}$, depending only on temperature. $Ma = V/c$: subsonic below 1, supersonic above, transonic about 0.9–1.2, hypersonic above 5–6.` },
  {
    type: 'graph', title: 'Wave fronts from a moving source',
    body: R`Each circle is a pressure pulse emitted earlier. Below $Ma = 1$ the waves stay ahead of the source; above it they pile up on the Mach cone, $\sin\alpha = 1/Ma$.`,
    widget: { params: [{ key: 'M', label: 'Mach number', min: 0, max: 3, step: 0.05, value: 1.5 }], kind: 'sketch', height: 300, view: [-6.5, 19, -6.5, 6.5], items: (p) => waveItems(p.M, 6), readout: (p) => (p.M > 1 ? `$\\alpha = \\arcsin(1/${p.M}) = ${r2(Math.asin(1 / p.M) / D2R)}^\\circ$: the zone of silence is ahead of the cone.` : p.M === 1 ? 'Sonic: the fronts pile up into a single Mach wave through the source.' : 'Subsonic: pressure information reaches upstream (compressed in front, stretched behind: the Doppler effect).') },
  },
  { type: 'example', title: 'Slides example: hearing a supersonic flyby', prompt: R`$Ma = 1.5$ at 1000 m, 20 °C.`, steps: [
    R`$c = 343.2$ m/s, $V = 514.8$ m/s, $\alpha = 41.8^\circ$.`,
    R`The cone reaches you when the plane is $x = h/\tan\alpha = 1118$ m past.`,
    R`$\Delta t = 1118/514.8 = 2.17$ s.`,
  ] },
];
const LN = [
  { type: 'text', kind: 'key', title: 'Normal shock waves', body: R`A very thin (~1 μm), adiabatic but irreversible jump. Supersonic in, subsonic out: $Ma_y < 1$, $V$ drops, $p$, $T$, $\rho$ rise, $T_0$ is constant, $p_0$ drops and $s$ rises. The reverse (subsonic → supersonic) would decrease entropy, so it never happens.` },
  { type: 'text', kind: 'method', title: 'The relations (k = 1.4 tables)', body: R`$Ma_y^2 = \frac{Ma_x^2 + 2/(k-1)}{\frac{2k}{k-1}Ma_x^2 - 1}$, $\quad\frac{p_y}{p_x} = \frac{2kMa_x^2 - (k-1)}{k+1}$, $\quad\frac{\rho_y}{\rho_x} = \frac{(k+1)Ma_x^2}{(k-1)Ma_x^2 + 2}$, $\quad\frac{T_y}{T_x} = \frac{p_y/p_x}{\rho_y/\rho_x}$.` },
  {
    type: 'graph', title: 'Shock strength vs upstream Mach',
    body: R`Everything is a function of $Ma_x$. The stronger the shock, the bigger the jumps and the larger the stagnation-pressure loss.`,
    widget: {
      params: [{ key: 'M', label: 'Maₓ', min: 1, max: 4, step: 0.05, value: 2 }],
      panels: [
        { kind: 'plot', x: [1, 4], y: [0, 6], xLabel: 'Maₓ', curves: [{ fn: (m) => shockP(m) / 3, label: 'p_y/p_x (÷3)' }, { fn: (m) => shockT(m), label: 'T_y/T_x', color: 1 }, { fn: (m) => shockRho(m), label: 'ρ_y/ρ_x', color: 2 }], vlines: (p) => [{ x: p.M }] },
        { kind: 'plot', x: [1, 4], y: [0, 1.05], xLabel: 'Maₓ', curves: [{ fn: (m) => shockMy(m), label: 'Ma_y', color: 3 }, { fn: (m) => shockP0(m), label: 'p0y/p0x', color: 4 }], vlines: (p) => [{ x: p.M }] },
      ],
      readout: (p) => `$Ma_x = ${p.M}$: $Ma_y = ${r4(shockMy(p.M))}$, $p_y/p_x = ${r3(shockP(p.M))}$, $T_y/T_x = ${r3(shockT(p.M))}$, $\\rho_y/\\rho_x = ${r3(shockRho(p.M))}$, $p_{0y}/p_{0x} = ${r4(shockP0(p.M))}$`,
    },
  },
  { type: 'example', title: 'Slides example: Pitot probe in supersonic flow', prompt: R`Probe reads $p_{0y} = 60$ psia behind its bow shock, wall tap $p_x = 12$ psia, $T_0 = 1000$ °R.`, steps: [
    R`$\frac{p_{0y}}{p_x} = 5 = \frac{p_{0y}}{p_y}\cdot\frac{p_y}{p_x}$ (isentropic after the shock × shock jump).`,
    R`Solving (or the table): $Ma_x \approx 1.9$.`,
    R`$T_x = T_0\left(1 + 0.2(1.9)^2\right)^{-1} \approx 581$ °R (the slides read ≈590 °R from the chart), then $V_x = Ma_x\sqrt{kRT_x}$.`,
  ] },
  { type: 'quiz', prompt: 'Across a normal shock, which stays the same?', options: [{ tex: R`$T_0$`, correct: true }, { tex: R`$p_0$`, why: 'Stagnation pressure drops because entropy rises.' }, { tex: R`$s$`, why: 'Entropy increases: the shock is irreversible.' }] },
];
const LI = [
  { type: 'text', kind: 'key', title: 'Area–velocity relation', body: R`For steady isentropic 1-D flow, $\frac{dA}{A} = \frac{dV}{V}(Ma^2 - 1)$. Subsonic: a converging duct accelerates the flow. Supersonic: a diverging duct accelerates it. $Ma = 1$ can only occur where $dA = 0$, at a throat.` },
  { type: 'text', kind: 'method', title: 'Critical state and A/A*', body: R`At $Ma = 1$: $T^* = 0.8333T_0$, $p^* = 0.5283p_0$, $\rho^* = 0.6339\rho_0$. $A^*$ is the area that would make the flow sonic: $\frac{A}{A^*} = \frac{1}{Ma}\left[\frac{2}{k+1}\left(1 + \frac{k-1}{2}Ma^2\right)\right]^{\frac{k+1}{2(k-1)}}$.` },
  {
    type: 'graph', title: 'A/A* has two branches',
    body: R`Each area ratio above 1 has a subsonic and a supersonic Mach number. In a converging–diverging nozzle with a sonic throat and low back pressure, the flow takes the supersonic branch after the throat.`,
    widget: {
      params: [{ key: 'r', label: 'A / A*', min: 1, max: 5, step: 0.05, value: 2 }],
      x: [0.1, 4], y: [0, 6], xLabel: 'Ma', yLabel: 'A/A*',
      curves: [{ fn: (m) => AAs(m), label: 'A/A*' }],
      hlines: (p) => [{ y: p.r, label: `A/A* = ${p.r}` }],
      points: (p) => (p.r > 1.0001 ? [{ x: bisect((m) => AAs(m) - p.r, 0.01, 0.9999), y: p.r, label: 'subsonic' }, { x: bisect((m) => AAs(m) - p.r, 1.0001, 10), y: p.r, label: 'supersonic', color: 1 }] : [{ x: 1, y: 1, label: 'throat' }]),
      readout: (p) => (p.r > 1.0001 ? `$Ma = ${r4(bisect((m) => AAs(m) - p.r, 0.01, 0.9999))}$ or $${r4(bisect((m) => AAs(m) - p.r, 1.0001, 10))}$` : 'Sonic throat: $A = A^*$'),
    },
  },
  {
    type: 'graph', title: 'Inside a converging–diverging nozzle',
    body: R`A nozzle with a sonic throat at $x = 0.5$. Pick the branch after the throat: supersonic (design operation) or subsonic (high back pressure, a venturi).`,
    widget: {
      params: [{ key: 'sup', label: 'after throat: supersonic (1) / subsonic (0)', min: 0, max: 1, step: 1, value: 1 }],
      x: [0, 1], y: [0, 3], xLabel: 'x',
      curves: (p) => { const A = (x) => 1 + 4 * (x - 0.5) ** 2; const M = (x) => (A(x) < 1 + 1e-9 ? 1 : x < 0.5 || !p.sup ? bisect((m) => AAs(m) - A(x), 0.01, 1) : bisect((m) => AAs(m) - A(x), 1, 10)); return [{ fn: A, label: 'A/A*', dash: true, color: 1 }, { fn: M, label: 'Ma' }, { fn: (x) => pp0(M(x)), label: 'p/p₀', color: 2 }]; },
      readout: (p) => (p.sup ? 'Accelerates through $Ma = 1$ at the throat: $p$ keeps falling.' : 'Stays subsonic: speeds up to the throat, then slows and recovers pressure.'),
    },
  },
  { type: 'example', title: 'Slides example: duct flow', prompt: R`Point 1: 50 psia, 100 °F, 500 ft/s. Point 2: $Ma = 1.8$, isentropic.`, steps: [
    R`$T_1 = 559.7$ °R, $T_0 = T_1 + \frac{V_1^2}{2c_p} = 580.5$ °R; $Ma_1 = 0.43$.`,
    R`$T_0$, $p_0$ constant: $T_2 = \frac{580.5}{1 + 0.2(1.8)^2} = 352.2$ °R.`,
    R`$p_2 = 9.88$ psia, $V_2 = 1.8\sqrt{kRT_2} = 1660$ ft/s. Accelerating cooled and depressurized the gas, with no loss of total energy.`,
  ] },
  { type: 'quiz', prompt: R`Subsonic air enters a converging-only nozzle. The highest Mach number it can reach is`, options: [{ tex: '1, at the exit', correct: true }, { tex: 'Above 1 if the back pressure is low enough', why: 'Without a diverging section the flow chokes at $Ma = 1$; lowering the back pressure further changes nothing inside.' }, { tex: '1, anywhere inside', why: 'Sonic flow needs $dA = 0$: the minimum area, which for a converging nozzle is the exit.' }] },
];

SA.registerCourse({
  course: 'MAAE 3300',
  chapters: [
    { id: 'f-rev', name: 'Review of Fluids I' },
    { id: 'f-thermo', name: 'Ideal gas and isentropic processes' },
    { id: 'f-comp', name: 'Compressible flow' },
  ],
  topics: [
    { id: 'fl-cont', ch: 'f-rev', sec: 'fl-rev', name: 'Continuity', desc: 'Q = AV and ṁ = ρAV.', gen: genContinuity },
    { id: 'fl-pump', ch: 'f-rev', sec: 'fl-rev', name: 'Pump head and power', desc: 'Energy equation with a machine.', gen: genPump },
    { id: 'fl-loss', ch: 'f-rev', sec: 'fl-rev', name: 'Pipe losses', desc: 'Re, 64/Re, Darcy, K_L.', gen: genPipeLoss },
    { id: 'fl-isen', ch: 'f-thermo', sec: 'fl-thermo', name: 'Isentropic processes', desc: 'T–p relation and entropy change.', gen: genIsentropicProcess },
    { id: 'fl-stag', ch: 'f-comp', sec: 'fl-mach', name: 'Stagnation properties', desc: 'T₀, p₀ and Mach.', gen: genStagnation },
    { id: 'fl-sound', ch: 'f-comp', sec: 'fl-mach', name: 'Speed of sound and Mach cone', desc: '√(kRT), sin α = 1/Ma.', gen: genSound },
    { id: 'fl-shock', ch: 'f-comp', sec: 'fl-shock', name: 'Normal shocks', desc: 'Jumps across the shock.', gen: genShock },
    { id: 'fl-nozzle', ch: 'f-comp', sec: 'fl-nozzle', name: 'Nozzles and A/A*', desc: 'Critical state, area–Mach.', gen: genNozzle },
  ],
  sections: [
    { id: 'fl-rev', tag: 'LN 1', num: '1', title: 'Review: Bernoulli, pumps and pipe flow', chapter: 'Lecture Note 1', skills: ['fl-cont', 'fl-pump', 'fl-loss'], lesson: LR },
    { id: 'fl-thermo', tag: 'LN 2', num: '2', title: 'Ideal gases and isentropic processes', chapter: 'Lecture Note 2', skills: ['fl-isen'], lesson: LT },
    { id: 'fl-mach', tag: 'LN 2–3', num: '3', title: 'Stagnation, speed of sound and Mach', chapter: 'Lecture Notes 2–3', skills: ['fl-stag', 'fl-sound'], lesson: LS },
    { id: 'fl-shock', tag: 'LN 4', num: '4', title: 'Normal shock waves', chapter: 'Lecture Note 4', skills: ['fl-shock'], lesson: LN },
    { id: 'fl-nozzle', tag: 'LN 5–6', num: '5', title: 'Isentropic flow in variable-area ducts', chapter: 'Lecture Notes 5–6', skills: ['fl-nozzle'], lesson: LI },
  ],
});
