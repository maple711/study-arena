'use strict';
/*
 * Study Arena — an Obsidian plugin for pen-based practice and lessons for MATH 3705.
 * Problems are generated from templates with random numbers, so there is
 * an endless supply. You draw your work, type the final answer, and if it
 * is wrong the plugin matches it against common mistakes to point at the
 * step that went wrong, then shows the full worked solution.
 * No network or AI is used.
 */
const obsidian = require('obsidian');
const { Plugin, ItemView, PluginSettingTab, Setting, Notice } = obsidian;
const requestUrl = obsidian.requestUrl;

const VIEW_TYPE = 'study-arena-view';

/* ================================================================== */
/* Small utilities                                                     */
/* ================================================================== */
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function nz(a, b) { let v; do { v = randInt(a, b); } while (v === 0); return v; }
function distinctInts(a, b, count, opts = {}) {
  const out = [];
  while (out.length < count) {
    const v = randInt(a, b);
    if (opts.nonzero && v === 0) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }

class Frac {
  constructor(n, d = 1) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    this.n = n / g; this.d = d / g;
  }
  mul(o) { return new Frac(this.n * o.n, this.d * o.d); }
  neg() { return new Frac(-this.n, this.d); }
  half() { return new Frac(this.n, this.d * 2); }
  add(o) { return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  eq(o) { return this.n === o.n && this.d === o.d; }
  isZero() { return this.n === 0; }
  tex() {
    if (this.d === 1) return String(this.n);
    return (this.n < 0 ? '-' : '') + `\\frac{${Math.abs(this.n)}}{${this.d}}`;
  }
  expr() { return `(${this.n}/${this.d})`; }
}

/* ---------- TeX helpers ---------- */
// v - a, written nicely: s - 3, s + 2, s
const sh = (v, a) => (a === 0 ? v : a > 0 ? `${v} - ${a}` : `${v} + ${-a}`);
// k*v as TeX: 3t, -t, t
const kv = (k, v) => (k === 1 ? v : k === -1 ? `-${v}` : `${k}${v}`);
// e^{kt}, with k = 0 giving '' (so it can be used as a term body)
const ex = (k, v = 't') => (k === 0 ? '' : `e^{${kv(k, v)}}`);
const exOr1 = (k, v = 't') => (k === 0 ? '1' : ex(k, v));
// x^r as a term body
const xp = (r) => (r === 0 ? '' : r === 1 ? 'x' : `x^{${r}}`);
// coefficient prefix: 1 -> '', -1 -> '-', 3 -> '3'
const cf = (k) => (k === 1 ? '' : k === -1 ? '-' : String(k));

// signed sum of terms [{c, body}] -> "3e^{2t} - e^{-t} + 4"
function sumTex(terms) {
  let out = '';
  for (const { c, body = '' } of terms) {
    let neg, mag;
    if (c instanceof Frac) {
      if (c.n === 0) continue;
      neg = c.n < 0;
      mag = c.d === 1 ? Math.abs(c.n) : `\\frac{${Math.abs(c.n)}}{${c.d}}`;
    } else {
      if (c === 0) continue;
      neg = c < 0; mag = Math.abs(c);
    }
    const piece = body ? (mag === 1 ? body : `${mag}${body}`) : String(mag);
    out += out === '' ? (neg ? '-' : '') + piece : (neg ? ' - ' : ' + ') + piece;
  }
  return out || '0';
}
// " + 3r" / " - r" / ""
function st(c, body) {
  if (c === 0) return '';
  const m = Math.abs(c);
  return (c < 0 ? ' - ' : ' + ') + (m === 1 && body ? body : `${m}${body}`);
}
const polyTex = (coeffs, v) => sumTex(coeffs.map((c, i) => {
  const p = coeffs.length - 1 - i;
  return { c, body: p === 0 ? '' : p === 1 ? v : `${v}^${p}` };
}));
// k * \frac{body}{den} with the sign pulled out front
function kFrac(k, body, den) {
  const m = Math.abs(k);
  return `${k < 0 ? '-' : ''}\\frac{${m === 1 ? body : `${m}${body}`}}{${den}}`;
}
const odeTex = (p, q) => `y''${st(p, "y'")}${st(q, 'y')} = 0`;

/* ================================================================== */
/* Expression parser / evaluator / TeX printer                         */
/* ================================================================== */
class ParseError extends Error {}
const FUNCS = ['sinh', 'cosh', 'tanh', 'sqrt', 'sin', 'cos', 'tan', 'exp', 'abs', 'ln', 'log', 'u', 'H'];
const CONSTS = ['pi', 'e'];
const NAMES = [...FUNCS, ...CONSTS].sort((a, b) => b.length - a.length);

function normalizeInput(src) {
  return src
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[ωΩ]/g, 'w').replace(/[θϑ]/g, 'th').replace(/λ/g, 'lam')
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))
    .replace(/π/g, 'pi')
    .replace(/[−–—]/g, '-')
    .replace(/[·×∙⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/√/g, 'sqrt')
    .replace(/[\[{]/g, '(').replace(/[\]}]/g, ')');
}

function tokenize(src, vars) {
  const s = normalizeInput(src);
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)/);
      if (!m) throw new ParseError(`Couldn't read the number near "${s.slice(i, i + 4)}"`);
      toks.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      // longest match among variable names (which may be multi-letter, e.g. w1, th) and known names
      let best = null;
      for (const n of [...vars, ...NAMES]) if (s.startsWith(n, i) && (!best || n.length > best.length)) best = n;
      if (!best) {
        const allowed = vars.length ? `Use only ${vars.join(', ')}` : 'This answer is a number';
        throw new ParseError(`Unknown symbol "${ch}". ${allowed}.`);
      }
      i += best.length;
      if (vars.includes(best) && !(FUNCS.includes(best) || CONSTS.includes(best))) { toks.push({ t: 'var', name: best }); continue; }
      if (FUNCS.includes(best)) {
        const tok = { t: 'fn', name: best };
        if (best === 'u' && s[i] === '_') {
          const mm = s.slice(i + 1).match(/^\(?\s*(-?\d+\.?\d*)\s*\)?/);
          if (mm) { tok.shift = parseFloat(mm[1]); i += 1 + mm[0].length; }
        }
        toks.push(tok);
      } else toks.push({ t: 'const', name: best });
      continue;
    }
    if ('+-*/^()!'.includes(ch)) { toks.push({ t: 'op', v: ch }); i++; continue; }
    throw new ParseError(`Unexpected character "${ch}"`);
  }
  return toks;
}

function parse(src, vars) {
  const toks = tokenize(src, vars);
  if (!toks.length) throw new ParseError('Empty answer');
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v) => toks[p] && toks[p].t === 'op' && toks[p].v === v;
  const expect = (v) => { if (!isOp(v)) throw new ParseError(`Missing "${v}"`); p++; };
  const startsFactor = () => {
    const t = peek();
    return t && (t.t === 'num' || t.t === 'var' || t.t === 'const' || t.t === 'fn' || (t.t === 'op' && t.v === '('));
  };
  const startsSimple = () => { const t = peek(); return t && (t.t === 'num' || t.t === 'var' || t.t === 'const'); };

  function parseExpr() {
    let l = parseTerm();
    while (isOp('+') || isOp('-')) { const op = toks[p++].v; l = { k: 'bin', op, l, r: parseTerm() }; }
    return l;
  }
  function parseTerm() {
    let l = parseImplicit();
    while (isOp('*') || isOp('/')) { const op = toks[p++].v; l = { k: 'bin', op, l, r: parseImplicit() }; }
    return l;
  }
  // implicit multiplication binds tighter than / so "1/2s" means 1/(2s)
  function parseImplicit() {
    let l = parseUnary();
    while (startsFactor()) l = { k: 'bin', op: '*', l, r: parsePower() };
    return l;
  }
  function parseUnary() {
    if (isOp('-')) { p++; return { k: 'neg', a: parseUnary() }; }
    if (isOp('+')) { p++; return parseUnary(); }
    return parsePower();
  }
  function parsePower() {
    const base = parsePostfix();
    if (isOp('^')) {
      p++;
      let e = parseExponent();
      // e^-2t means e^(-2t): let e's exponent absorb simple factors
      if (base.k === 'const' && base.name === 'e') {
        while (startsSimple()) e = { k: 'bin', op: '*', l: e, r: parsePostfix() };
      }
      return { k: 'bin', op: '^', l: base, r: e };
    }
    return base;
  }
  function parseExponent() {
    if (isOp('-')) { p++; return { k: 'neg', a: parseExponent() }; }
    if (isOp('+')) { p++; return parseExponent(); }
    return parsePower();
  }
  function parsePostfix() {
    let n = parsePrimary();
    while (isOp('!')) { p++; n = { k: 'fact', a: n }; }
    return n;
  }
  function parsePrimary() {
    const t = peek();
    if (!t) throw new ParseError('Answer ends too early');
    if (t.t === 'num') { p++; return { k: 'num', v: t.v }; }
    if (t.t === 'var') { p++; return { k: 'var', name: t.name }; }
    if (t.t === 'const') { p++; return { k: 'const', name: t.name }; }
    if (isOp('(')) { p++; const e = parseExpr(); expect(')'); return e; }
    if (t.t === 'fn') {
      p++;
      let pow = null;
      if (isOp('^')) { p++; pow = parseExponent(); } // sin^2(x)
      let arg;
      if (isOp('(')) { p++; arg = parseExpr(); expect(')'); }
      else {
        if (!startsFactor()) throw new ParseError(`"${t.name}" needs an argument`);
        arg = parsePower();
        while (startsSimple()) arg = { k: 'bin', op: '*', l: arg, r: parsePower() };
      }
      let node = { k: 'fn', name: t.name, arg };
      if (t.shift != null) node.shift = t.shift;
      if (pow) node = { k: 'bin', op: '^', l: node, r: pow };
      return node;
    }
    throw new ParseError(`Unexpected "${t.v || t.name}"`);
  }

  const ast = parseExpr();
  if (p < toks.length) {
    const t = toks[p];
    throw new ParseError(t.t === 'op' && t.v === ')' ? 'Too many ")"' : `Unexpected "${t.v || t.name}"`);
  }
  return ast;
}

function evaluate(n, env) {
  switch (n.k) {
    case 'num': return n.v;
    case 'var': return env[n.name];
    case 'const': return n.name === 'pi' ? Math.PI : Math.E;
    case 'neg': return -evaluate(n.a, env);
    case 'fact': {
      const v = evaluate(n.a, env);
      return Number.isInteger(v) && v >= 0 && v < 30 ? fact(v) : NaN;
    }
    case 'bin': {
      const a = evaluate(n.l, env), b = evaluate(n.r, env);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '^': return Math.pow(a, b);
      }
      return NaN;
    }
    case 'fn': {
      let x = evaluate(n.arg, env);
      if (n.shift != null) x -= n.shift;
      switch (n.name) {
        case 'sin': return Math.sin(x);
        case 'cos': return Math.cos(x);
        case 'tan': return Math.tan(x);
        case 'sinh': return Math.sinh(x);
        case 'cosh': return Math.cosh(x);
        case 'tanh': return Math.tanh(x);
        case 'exp': return Math.exp(x);
        case 'ln': case 'log': return Math.log(x);
        case 'sqrt': return Math.sqrt(x);
        case 'abs': return Math.abs(x);
        case 'u': case 'H': return x >= 0 ? 1 : 0;
      }
      return NaN;
    }
  }
  return NaN;
}

const VAR_TEX = { w: '\\omega ', w1: '\\omega_1 ', w2: '\\omega_2 ', th: '\\tilde\\theta ', lam: '\\lambda ' };
let VAR_TEX_Q = null; // per-question overrides (q.varTex), set while a question is shown
function fmtNum(v) {
  if (Number.isInteger(v)) return String(v);
  return String(parseFloat(v.toPrecision(8)));
}
function prec(n) {
  if (n.k === 'bin') {
    if (n.op === '+' || n.op === '-') return 1;
    if (n.op === '*') return 2;
    if (n.op === '/') return 5; // rendered as \frac
    if (n.op === '^') return 4;
  }
  if (n.k === 'neg') return 2;
  return 5;
}
function wrap(n, min) { return prec(n) < min ? `\\left(${toTex(n)}\\right)` : toTex(n); }
function toTex(n) {
  switch (n.k) {
    case 'num': return fmtNum(n.v);
    case 'var': return (VAR_TEX_Q && VAR_TEX_Q[n.name]) || VAR_TEX[n.name] || n.name;
    case 'const': return n.name === 'pi' ? '\\pi ' : 'e';
    case 'neg': return '-' + wrap(n.a, 2.5);
    case 'fact': return wrap(n.a, 5) + '!';
    case 'fn': {
      const a = toTex(n.arg);
      if (n.name === 'exp') return `e^{${a}}`;
      if (n.name === 'sqrt') return `\\sqrt{${a}}`;
      if (n.name === 'abs') return `\\left|${a}\\right|`;
      if (n.name === 'u' || n.name === 'H') {
        const nm = n.shift != null ? `u_{${fmtNum(n.shift)}}` : n.name;
        return `${nm}\\left(${a}\\right)`;
      }
      return `\\${n.name === 'log' ? 'ln' : n.name}\\left(${a}\\right)`;
    }
    case 'bin': {
      if (n.op === '/') return `\\frac{${toTex(n.l)}}{${toTex(n.r)}}`;
      if (n.op === '^') {
        const base = n.l.k === 'fn' && n.l.name !== 'exp' ? `\\left(${toTex(n.l)}\\right)` : wrap(n.l, 5);
        return `{${base}}^{${toTex(n.r)}}`;
      }
      if (n.op === '*') {
        const L = wrap(n.l, 2), R = wrap(n.r, 2.5);
        if (L === '1') return R;
        const dot = /^\{*[0-9.\-]/.test(R);
        return dot ? `${L} \\cdot ${R}` : `${L} ${R}`;
      }
      if (n.op === '+' || n.op === '-') {
        const R = wrap(n.r, 2);
        const neg = R.startsWith('-');
        const sign = (n.op === '+') !== neg ? '+' : '-';
        return `${toTex(n.l)} ${sign} ${neg ? R.slice(1) : R}`;
      }
    }
  }
  return '?';
}

/* ================================================================== */
/* Answer checking                                                     */
/* ================================================================== */
function valuesAt(ast, samples) {
  return samples.map((env) => { try { return evaluate(ast, env); } catch (e) { return NaN; } });
}
function close(a, b, tol, scale) {
  return Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-3 * scale) + 1e-12;
}
function sameValues(ref, vals, tol) {
  const scale = Math.max(...ref.filter(Number.isFinite).map(Math.abs), 1e-12);
  let used = 0;
  for (let i = 0; i < ref.length; i++) {
    if (!Number.isFinite(ref[i])) continue;
    if (!Number.isFinite(vals[i])) return false;
    if (!close(ref[i], vals[i], tol, scale)) return false;
    used++;
  }
  return used >= Math.min(4, ref.length);
}
function niceFactor(r) {
  for (let d = 1; d <= 12; d++) {
    const n = Math.round(r * d);
    if (Math.abs(n / d - r) < 1e-6 * Math.max(1, Math.abs(r))) return new Frac(n, d).tex();
  }
  for (let d = 1; d <= 12; d++) {
    const n = Math.round((r / Math.PI) * d);
    if (n !== 0 && Math.abs((n * Math.PI) / d - r) < 1e-6 * Math.abs(r)) {
      return `${new Frac(n, d).tex()}\\pi`;
    }
    const m = Math.round(r * Math.PI * d);
    if (m !== 0 && Math.abs(m / (Math.PI * d) - r) < 1e-6 * Math.abs(r)) {
      return `\\frac{${m}}{${d === 1 ? '' : d}\\pi}`;
    }
  }
  return fmtNum(+r.toPrecision(4));
}

function diagnose(q, userAst) {
  const uv = valuesAt(userAst, q.samples);
  if (sameValues(q.answerVals, uv, q.tol)) return { correct: true };
  for (const m of q.mistakes) {
    if (sameValues(m.vals, uv, q.tol)) return { correct: false, mistake: m };
  }
  // Generic patterns: constant factor or constant offset
  const ratios = [], diffs = [];
  for (let i = 0; i < uv.length; i++) {
    const c = q.answerVals[i], u = uv[i];
    if (!Number.isFinite(c) || !Number.isFinite(u)) continue;
    diffs.push(u - c);
    if (Math.abs(c) > 1e-9) ratios.push(u / c);
  }
  if (ratios.length >= 4 && q.vars.length) {
    const r0 = ratios[0];
    if (Math.abs(r0) > 1e-9 && ratios.every((r) => close(r, r0, 1e-6, 1))) {
      if (close(r0, -1, 1e-6, 1)) {
        return { correct: false, generic: 'Your answer is exactly the negative of the correct one. Look for a sign error, such as a dropped minus or a subtraction done in the wrong order.' };
      }
      return { correct: false, generic: `Your answer has the right shape but is off by a constant factor of $${niceFactor(r0)}$. Check the constants and coefficients in your last few steps.` };
    }
  }
  if (diffs.length >= 4 && q.vars.length) {
    const d0 = diffs[0];
    if (Math.abs(d0) > 1e-9 && diffs.every((d) => close(d, d0, 1e-6, 1))) {
      return { correct: false, generic: `Your answer is off by a constant ($${niceFactor(d0)}$). Look for a missing or extra constant term.` };
    }
  }
  if (!q.vars.length) {
    const u = uv[0], c = q.answerVals[0];
    if (Number.isFinite(u) && Number.isFinite(c) && c !== 0) {
      if (close(u, -c, 1e-6, 1)) return { correct: false, generic: 'You got the right size but the wrong sign. Check every minus sign in your work.' };
    }
  }
  return { correct: false };
}

/* ================================================================== */
/* Problem generators — MATH 3705                                      */
/* ================================================================== */
const sampS = (minPole) => () => ({ s: rand(Math.max(minPole, 0) + 1, Math.max(minPole, 0) + 6) });
const sampT = (a = 0.05, b = 1.6) => () => ({ t: rand(a, b) });
const sampN = () => { let i = 0; return () => ({ n: (i++ % 8) + 1 }); };

function genLapBasic() {
  const n = randInt(1, 3), a = nz(-4, 4), f = fact(n);
  const tn = n === 1 ? 't' : `t^{${n}}`;
  const ftex = `${tn}e^{${kv(a, 't')}}`;
  const ansTex = `\\frac{${f}}{(${sh('s', a)})^{${n + 1}}}`;
  return {
    points: 10,
    prompt: `Find $\\mathcal{L}\\{${ftex}\\}$.`,
    vars: ['s'], sample: sampS(a), hint: 'Answer in terms of s.',
    answer: `${f}/(s-(${a}))^${n + 1}`, answerTex: ansTex,
    verify: { kind: 'laplace', f: `t^${n}*exp(${a}*t)` },
    steps: [
      { key: 'base', title: 'Transform the power of t', body: `Use $\\mathcal{L}\\{t^{n}\\}=\\dfrac{n!}{s^{n+1}}$, so $\\mathcal{L}\\{${tn}\\} = \\dfrac{${f}}{s^{${n + 1}}}$.` },
      { key: 'shift', title: 'Apply the first shifting theorem', body: `$\\mathcal{L}\\{e^{at}f(t)\\}=F(s-a)$. Here $a=${a}$, so every $s$ becomes $${sh('s', a)}$.` },
      { key: 'res', title: 'Result', body: `$$\\mathcal{L}\\{${ftex}\\} = ${ansTex}$$` },
    ],
    mistakes: [
      { expr: `${f}/(s+(${a}))^${n + 1}`, step: 'shift', why: `You shifted the wrong way. Multiplying by $e^{${kv(a, 't')}}$ replaces $s$ with $${sh('s', a)}$, not $${sh('s', -a)}$.` },
      { expr: `1/(s-(${a}))^${n + 1}`, step: 'base', why: `The $n!$ in the numerator is missing: $\\mathcal{L}\\{${tn}\\}=\\frac{${f}}{s^{${n + 1}}}$.` },
      { expr: `${f}/(s-(${a}))^${n}`, step: 'base', why: `The power of $s$ should be $n+1=${n + 1}$, not $${n}$.` },
      { expr: `${n}/(s-(${a}))^${n + 1}`, step: 'base', why: `The numerator is $n! = ${f}$, not $n = ${n}$.` },
      { expr: `${f}/s^${n + 1}`, step: 'shift', why: `The $e^{${kv(a, 't')}}$ factor was ignored. It shifts $s \\to ${sh('s', a)}$.` },
    ],
  };
}

function genLapTrig() {
  const a = nz(-4, 4), b = randInt(1, 5), isCos = Math.random() < 0.5, k = pick([1, 1, 2, 3, -1, -2]);
  const fn = isCos ? '\\cos' : '\\sin';
  const ftex = `${cf(k)}e^{${kv(a, 't')}}${fn}(${kv(b, 't')})`;
  const denTex = `(${sh('s', a)})^2 + ${b * b}`;
  const numTex = isCos ? (k === 1 ? sh('s', a) : k === -1 ? `-(${sh('s', a)})` : `${k}(${sh('s', a)})`) : String(k * b);
  const ansTex = `\\frac{${numTex}}{${denTex}}`;
  const den = `((s-(${a}))^2+${b * b})`;
  const num = isCos ? `${k}*(s-(${a}))` : `${k * b}`;
  const baseTex = isCos ? `\\mathcal{L}\\{\\cos(${kv(b, 't')})\\} = \\dfrac{s}{s^2+${b * b}}` : `\\mathcal{L}\\{\\sin(${kv(b, 't')})\\} = \\dfrac{${b}}{s^2+${b * b}}`;
  const mistakes = [
    { expr: `${isCos ? `${k}*(s+(${a}))` : num}/((s+(${a}))^2+${b * b})`, step: 'shift', why: `Shift went the wrong way. $e^{${kv(a, 't')}}$ replaces $s$ with $${sh('s', a)}$.` },
    { expr: `${isCos ? `${k * b}` : `${k}*(s-(${a}))`}/${den}`, step: 'base', why: `You used the ${isCos ? 'sine' : 'cosine'} transform. For $${fn}(bt)$ the numerator is ${isCos ? '$s$' : '$b$'}.` },
  ];
  if (isCos) mistakes.push({ expr: `${k}*s/${den}`, step: 'shift', why: `The shift applies to every $s$, including the one in the numerator: $s \\to ${sh('s', a)}$.` });
  if (b > 1) mistakes.push({ expr: `${num}/((s-(${a}))^2+${b})`, step: 'base', why: `The denominator has $b^2 = ${b * b}$, not $b = ${b}$.` });
  if (k !== 1) mistakes.push({ expr: `${isCos ? `(s-(${a}))` : b}/${den}`, step: 'res', why: `The constant ${k} out front got dropped. Linearity: $\\mathcal{L}\\{kf\\}=k\\,F(s)$.` });
  return {
    points: 10,
    prompt: `Find $\\mathcal{L}\\{${ftex}\\}$.`,
    vars: ['s'], sample: sampS(a), hint: 'Answer in terms of s.',
    answer: `${num}/${den}`, answerTex: ansTex,
    verify: { kind: 'laplace', f: `${k}*exp(${a}*t)*${isCos ? 'cos' : 'sin'}(${b}*t)` },
    steps: [
      { key: 'base', title: 'Start from the basic transform', body: `$${baseTex}$` },
      { key: 'shift', title: 'Apply the first shifting theorem', body: `Multiplying by $e^{${kv(a, 't')}}$ replaces every $s$ with $${sh('s', a)}$.` },
      { key: 'res', title: k === 1 ? 'Result' : 'Multiply by the constant', body: `$$\\mathcal{L}\\{${ftex}\\} = ${ansTex}$$` },
    ],
    mistakes,
  };
}

function genLapPF() {
  const [r1, r2] = distinctInts(-4, 4, 2);
  const A = nz(-4, 4), B = nz(-4, 4);
  const al = A + B, be = -(A * r2 + B * r1);
  const expanded = Math.random() < 0.6;
  const numTex = polyTex([al, be], 's');
  const facTex = `(${sh('s', r1)})(${sh('s', r2)})`;
  const denTex = expanded ? polyTex([1, -(r1 + r2), r1 * r2], 's') : facTex;
  const ansTex = sumTex([{ c: A, body: ex(r1) }, { c: B, body: ex(r2) }]);
  const steps = [];
  if (expanded) steps.push({ key: 'factor', title: 'Factor the denominator', body: `$${denTex} = ${facTex}$` });
  steps.push(
    { key: 'setup', title: 'Set up partial fractions', body: `$$\\frac{${numTex}}{${facTex}} = \\frac{A}{${sh('s', r1)}} + \\frac{B}{${sh('s', r2)}}$$` },
    { key: 'consts', title: 'Find A and B (cover-up method)', body: `Cover $(${sh('s', r1)})$ and set $s=${r1}$: $\\;A = \\dfrac{${al * r1 + be}}{${r1 - r2}} = ${A}$.<br>Cover $(${sh('s', r2)})$ and set $s=${r2}$: $\\;B = \\dfrac{${al * r2 + be}}{${r2 - r1}} = ${B}$.` },
    { key: 'invert', title: 'Invert each term', body: `$\\mathcal{L}^{-1}\\left\\{\\dfrac{1}{s-r}\\right\\} = e^{rt}$.` },
    { key: 'res', title: 'Result', body: `$$f(t) = ${ansTex}$$` },
  );
  return {
    points: 15,
    prompt: `Find $\\mathcal{L}^{-1}\\left\\{\\dfrac{${numTex}}{${denTex}}\\right\\}$.`,
    vars: ['t'], sample: sampT(), hint: 'Answer in terms of t, e.g. 2e^(3t) - e^(-t).',
    answer: `${A}*exp(${r1}*t)+(${B})*exp(${r2}*t)`, answerTex: ansTex, steps,
    verify: { kind: 'inverse', F: `(${al}*s+(${be}))/((s-(${r1}))*(s-(${r2})))`, pole: Math.max(r1, r2) },
    mistakes: [
      { expr: `${B}*exp(${r1}*t)+(${A})*exp(${r2}*t)`, step: 'consts', why: `A and B are swapped. A goes with $\\frac{1}{${sh('s', r1)}}$, so it multiplies $${exOr1(r1)}$.` },
      { expr: `${A}*exp(${-r1}*t)+(${B})*exp(${-r2}*t)`, step: 'invert', why: `Sign of the exponent: $\\frac{1}{s-r}$ inverts to $e^{+rt}$, so $\\frac{1}{${sh('s', r1)}} \\to ${exOr1(r1)}$.` },
      { expr: `${B}*exp(${-r1}*t)+(${A})*exp(${-r2}*t)`, step: 'consts', why: `Two slips: A and B are swapped, and the exponent signs are flipped. $\\frac{1}{s-r} \\to e^{rt}$.` },
    ],
  };
}

function genLapIVP() {
  const [r1, r2] = distinctInts(-4, 3, 2);
  const c1 = nz(-3, 3), c2 = nz(-3, 3);
  const p = -(r1 + r2), q = r1 * r2;
  const y0 = c1 + c2, v0 = c1 * r1 + c2 * r2;
  const ansTex = sumTex([{ c: c1, body: ex(r1) }, { c: c2, body: ex(r2) }]);
  const numTex = polyTex([y0, v0 + p * y0], 's');
  const facTex = `(${sh('s', r1)})(${sh('s', r2)})`;
  const pfTex = `\\frac{${c1}}{${sh('s', r1)}} ${c2 < 0 ? '-' : '+'} \\frac{${Math.abs(c2)}}{${sh('s', r2)}}`;
  return {
    points: 20,
    prompt: `Use the Laplace transform to solve $${odeTex(p, q)}$, $\\;y(0)=${y0}$, $\\;y'(0)=${v0}$.`,
    vars: ['t'], sample: sampT(0.05, 1.2), hint: 'Enter y(t) in terms of t.',
    answer: `${c1}*exp(${r1}*t)+(${c2})*exp(${r2}*t)`, answerTex: ansTex,
    verify: { kind: 'ode2', p, q, y0, v0 },
    steps: [
      { key: 'transform', title: 'Transform the equation', body: `Use $\\mathcal{L}\\{y''\\}=s^2Y-s\\,y(0)-y'(0)$ and $\\mathcal{L}\\{y'\\}=sY-y(0)$ on every term.` },
      { key: 'solveY', title: 'Solve for Y(s)', body: `Collect the $Y$ terms: $$Y(s)\\,(${polyTex([1, p, q], 's')}) = ${numTex}$$ so $$Y(s) = \\frac{${numTex}}{${facTex}}$$` },
      { key: 'pf', title: 'Partial fractions', body: `$$Y(s) = ${pfTex}$$` },
      { key: 'invert', title: 'Invert', body: `$\\mathcal{L}^{-1}\\left\\{\\dfrac{1}{s-r}\\right\\} = e^{rt}$ for each term.` },
      { key: 'res', title: 'Result', body: `$$y(t) = ${ansTex}$$` },
    ],
    mistakes: [
      { expr: `-(${c1}*exp(${r1}*t)+(${c2})*exp(${r2}*t))`, step: 'transform', why: `Your answer is the negative of the solution, which usually means the initial-condition terms got the wrong sign. It's $s^2Y - s\\,y(0) - y'(0)$ with minus signs.` },
      { expr: `${c2}*exp(${r1}*t)+(${c1})*exp(${r2}*t)`, step: 'pf', why: `The partial-fraction constants are swapped. Use cover-up: the constant over $(${sh('s', r1)})$ is $${c1}$.` },
      { expr: `${c1}*exp(${-r1}*t)+(${c2})*exp(${-r2}*t)`, step: 'invert', why: `Sign of the exponent: $\\frac{1}{s-r}\\to e^{+rt}$.` },
    ],
  };
}

function genLapStep() {
  const variant = pick(['exp', 'ramp', 'inv']);
  const c = randInt(1, 3);
  if (variant === 'exp') {
    const k = nz(-3, 3);
    const ansTex = `\\frac{e^{-${c}s}}{${sh('s', k)}}`;
    return {
      points: 15,
      prompt: `Find $\\mathcal{L}\\{u(t-${c})\\,e^{${kv(k, `(t-${c})`)}}\\}$.`,
      vars: ['s'], sample: sampS(k), hint: 'Answer in terms of s, e.g. e^(-2s)/(s-1).',
      answer: `exp(-${c}*s)/(s-(${k}))`, answerTex: ansTex,
      verify: { kind: 'laplace', f: `u(t-${c})*exp(${k}*(t-${c}))` },
      steps: [
        { key: 'form', title: 'Recognise the shifted form', body: `This is $u(t-c)f(t-c)$ with $c=${c}$ and $f(t)=e^{${kv(k, 't')}}$.` },
        { key: 'shift', title: 'Second shifting theorem', body: `$\\mathcal{L}\\{u(t-c)f(t-c)\\} = e^{-cs}F(s)$.` },
        { key: 'F', title: 'Transform f', body: `$F(s) = \\mathcal{L}\\{e^{${kv(k, 't')}}\\} = \\dfrac{1}{${sh('s', k)}}$.` },
        { key: 'res', title: 'Result', body: `$$${ansTex}$$` },
      ],
      mistakes: [
        { expr: `exp(${c}*s)/(s-(${k}))`, step: 'shift', why: `The exponential factor is $e^{-cs}$ with a minus sign. A delay in time gives decay in $s$.` },
        { expr: `1/(s-(${k}))`, step: 'shift', why: `The $e^{-${c}s}$ factor from the unit step is missing.` },
        { expr: `exp(-${c}*s)/(s+(${k}))`, step: 'F', why: `$\\mathcal{L}\\{e^{kt}\\} = \\frac{1}{s-k}$, so here it's $\\frac{1}{${sh('s', k)}}$.` },
        { expr: `exp(-${c}*s)*exp(${-k * c})/(s-(${k}))`, step: 'form', why: `The exponent is already written as $(t-${c})$, so $f(t)=e^{${kv(k, 't')}}$ directly. There's no extra $e^{${-k * c}}$ factor.` },
      ],
    };
  }
  if (variant === 'ramp') {
    const ansTex = `e^{-${c}s}\\left(\\frac{1}{s^2} + \\frac{${c}}{s}\\right)`;
    return {
      points: 15,
      prompt: `Find $\\mathcal{L}\\{t\\,u(t-${c})\\}$.`,
      vars: ['s'], sample: sampS(0), hint: 'Answer in terms of s.',
      answer: `exp(-${c}*s)*(1/s^2+${c}/s)`, answerTex: ansTex,
      verify: { kind: 'laplace', f: `u(t-${c})*t` },
      steps: [
        { key: 'rewrite', title: 'Write t in terms of (t − c)', body: `$t = (t-${c}) + ${c}$, so $t\\,u(t-${c}) = u(t-${c})f(t-${c})$ with $f(t) = t + ${c}$.` },
        { key: 'shift', title: 'Second shifting theorem', body: `$\\mathcal{L}\\{u(t-c)f(t-c)\\} = e^{-cs}F(s)$.` },
        { key: 'F', title: 'Transform f', body: `$F(s) = \\mathcal{L}\\{t + ${c}\\} = \\dfrac{1}{s^2} + \\dfrac{${c}}{s}$.` },
        { key: 'res', title: 'Result', body: `$$${ansTex}$$` },
      ],
      mistakes: [
        { expr: `exp(-${c}*s)/s^2`, step: 'rewrite', why: `$t$ isn't a function of $(t-${c})$ yet. Write $t = (t-${c}) + ${c}$; the $+${c}$ adds the $\\frac{${c}}{s}$ term.` },
        { expr: `exp(${c}*s)*(1/s^2+${c}/s)`, step: 'shift', why: `The factor is $e^{-cs}$ with a minus sign.` },
        { expr: `exp(-${c}*s)*(1/s^2-${c}/s)`, step: 'rewrite', why: `$t = (t-${c}) + ${c}$, so the extra term is $+${c}$, not $-${c}$.` },
        { expr: `1/s^2+${c}/s`, step: 'shift', why: `The $e^{-${c}s}$ factor from the unit step is missing.` },
      ],
    };
  }
  // inverse
  const b = randInt(1, 4);
  const ansTex = `u(t-${c})\\sin\\big(${b === 1 ? '' : b}(t-${c})\\big)`;
  return {
    points: 15,
    prompt: `Find $\\mathcal{L}^{-1}\\left\\{\\dfrac{${b === 1 ? '' : b}e^{-${c}s}}{s^2+${b * b}}\\right\\}$.`,
    vars: ['t'], sample: () => ({ t: rand(0.05, 2 * c + 2) }), hint: 'Answer in terms of t. Write the unit step as u(t-2) or u_2(t).',
    answer: `u(t-${c})*sin(${b}*(t-${c}))`, answerTex: ansTex,
    verify: { kind: 'inverse', F: `${b}*exp(-${c}*s)/(s^2+${b * b})`, pole: 0 },
    steps: [
      { key: 'F', title: 'Invert the part without the exponential', body: `$\\mathcal{L}^{-1}\\left\\{\\dfrac{${b}}{s^2+${b * b}}\\right\\} = \\sin(${kv(b, 't')})$.` },
      { key: 'shift', title: 'Second shifting theorem', body: `$e^{-cs}F(s) \\to u(t-c)f(t-c)$ with $c=${c}$: switch on at $t=${c}$ and replace $t$ by $t-${c}$.` },
      { key: 'res', title: 'Result', body: `$$${ansTex}$$` },
    ],
    mistakes: [
      { expr: `u(t-${c})*sin(${b}*t)`, step: 'shift', why: `The argument must be shifted too: $\\sin(${kv(b, 't')})$ becomes $\\sin\\big(${b === 1 ? '' : b}(t-${c})\\big)$.` },
      { expr: `sin(${b}*(t-${c}))`, step: 'shift', why: `The unit step $u(t-${c})$ is missing, so your function is nonzero before $t=${c}$.` },
      { expr: `u(t-${c})*sin(${b}*(t+${c}))`, step: 'shift', why: `The shift is $t \\to t-${c}$, not $t+${c}$.` },
      { expr: `u(t-${c})*cos(${b}*(t-${c}))`, step: 'F', why: `$\\frac{b}{s^2+b^2}$ is the transform of $\\sin(bt)$, not $\\cos(bt)$.` },
    ],
  };
}

function genCauchyEuler() {
  const [r1, r2] = distinctInts(-3, 3, 2);
  const c1 = nz(-3, 3), c2 = nz(-3, 3);
  const al = 1 - (r1 + r2), be = r1 * r2;
  const y1 = c1 + c2, v1 = c1 * r1 + c2 * r2;
  const ode = `x^2y''${st(al, "xy'")}${st(be, 'y')} = 0`;
  const ansTex = sumTex([{ c: c1, body: xp(r1) }, { c: c2, body: xp(r2) }]);
  const mistakes = [
    { expr: `${c2}*x^(${r1})+(${c1})*x^(${r2})`, step: 'ics', why: `The constants are swapped. Solve $C_1 + C_2 = ${y1}$, $${r1}C_1 ${r2 < 0 ? '-' : '+'} ${Math.abs(r2)}C_2 = ${v1}$ again.` },
    { expr: `${c1}*x^(${-r1})+(${c2})*x^(${-r2})`, step: 'roots', why: `The exponents have the wrong sign. The roots of the indicial equation are $r=${r1}$ and $r=${r2}$.` },
  ];
  // the classic slip: r^2 + alpha r + beta = 0 (forgetting r(r-1))
  const disc = al * al - 4 * be;
  if (disc > 1e-6) {
    const q1 = (-al + Math.sqrt(disc)) / 2, q2 = (-al - Math.sqrt(disc)) / 2;
    const C1 = (v1 - q2 * y1) / (q1 - q2), C2 = y1 - C1;
    mistakes.push({ expr: `${C1.toFixed(12)}*x^(${q1.toFixed(12)})+(${C2.toFixed(12)})*x^(${q2.toFixed(12)})`, step: 'indicial', why: `Wrong indicial equation. $y=x^r$ gives $x^2y'' = r(r-1)x^r$, so it's $r(r-1)${st(al, 'r')}${st(be, '')}=0$, not $r^2${st(al, 'r')}${st(be, '')}=0$.` });
  }
  return {
    points: 20,
    prompt: `Solve the Cauchy–Euler equation $${ode}$, $x>0$, with $y(1)=${y1}$, $y'(1)=${v1}$.`,
    vars: ['x'], sample: () => ({ x: rand(0.3, 3) }), hint: 'Enter y(x) in terms of x.',
    answer: `${c1}*x^(${r1})+(${c2})*x^(${r2})`, answerTex: ansTex,
    verify: { kind: 'ce', al, be, y1, v1 },
    steps: [
      { key: 'indicial', title: 'Try y = x^r', body: `Substituting gives the indicial equation $$r(r-1)${st(al, 'r')}${st(be, '')} = 0 \\;\\Longrightarrow\\; ${polyTex([1, al - 1, be], 'r')} = 0$$` },
      { key: 'roots', title: 'Find the roots', body: `$(${sh('r', r1)})(${sh('r', r2)}) = 0$, so $r_1 = ${r1}$, $r_2 = ${r2}$.` },
      { key: 'gen', title: 'General solution', body: `$y = C_1${xp(r1) || '\\cdot 1'} + C_2${xp(r2) || '\\cdot 1'}$` },
      { key: 'ics', title: 'Apply the conditions at x = 1', body: `$y(1) = C_1 + C_2 = ${y1}$ and $y'(1) = ${r1}C_1 ${r2 < 0 ? '-' : '+'} ${Math.abs(r2)}C_2 = ${v1}$, so $C_1 = ${c1}$, $C_2 = ${c2}$.` },
      { key: 'res', title: 'Result', body: `$$y = ${ansTex}$$` },
    ],
    mistakes,
  };
}

function genSeries() {
  let b, c, target, a0, a1, a, val;
  const coeffs = (sgn, denom) => {
    const arr = [new Frac(a0), new Frac(a1)];
    for (let n = 0; n + 2 <= 5; n++) arr[n + 2] = arr[n].mul(new Frac(sgn * -(b * n + c), denom(n)));
    return arr;
  };
  do {
    b = nz(-3, 3); c = nz(-3, 3); target = pick([4, 5]); a0 = nz(-3, 3); a1 = nz(-3, 3);
    a = coeffs(1, (n) => (n + 2) * (n + 1));
    val = a[target];
  } while (val.isZero() || a[target - 2].isZero() || Math.abs(val.d) > 400);
  const ode = `y''${st(b, "xy'")}${st(c, 'y')} = 0`;
  const chain = target === 4
    ? `$a_2 = ${a[2].tex()}$, then $a_4 = ${a[4].tex()}$.`
    : `$a_3 = ${a[3].tex()}$, then $a_5 = ${a[5].tex()}$.`;
  const lin = sumTex([{ c: b, body: 'n' }, { c, body: '' }]);
  const wrongSign = coeffs(-1, (n) => (n + 2) * (n + 1))[target];
  const wrongDen = coeffs(1, (n) => n + 2)[target];
  return {
    points: 15,
    prompt: `For $${ode}$ with $y(0)=${a0}$, $y'(0)=${a1}$, write $y=\\sum_{n\\ge 0} a_n x^n$. Find $a_{${target}}$.`,
    vars: [], sample: () => ({}), tol: 5e-4, hint: 'Enter an exact fraction like 5/24 (or a decimal).',
    answer: val.expr(), answerTex: `a_{${target}} = ${val.tex()}`,
    verify: { kind: 'series', b, c, a0, a1, target },
    steps: [
      { key: 'sub', title: 'Substitute the series', body: `$y' = \\sum n a_n x^{n-1}$, $y'' = \\sum n(n-1)a_n x^{n-2}$. Shift indices so every sum has $x^n$: $$\\sum_{n\\ge0}\\Big[(n+2)(n+1)a_{n+2} + (${lin})a_n\\Big]x^n = 0$$` },
      { key: 'rec', title: 'Recurrence relation', body: `$$a_{n+2} = -\\frac{${lin}}{(n+2)(n+1)}\\,a_n$$` },
      { key: 'start', title: 'Initial coefficients', body: `$a_0 = y(0) = ${a0}$, $a_1 = y'(0) = ${a1}$.` },
      { key: 'iter', title: 'Step the recurrence', body: chain },
    ],
    mistakes: [
      { expr: wrongSign.expr(), step: 'rec', why: 'The minus sign in the recurrence was lost. Moving $(bn+c)a_n$ to the other side makes it negative.' },
      { expr: wrongDen.expr(), step: 'rec', why: 'The denominator should be $(n+2)(n+1)$, which comes from differentiating twice, not just $(n+2)$.' },
      { expr: a[target - 2].expr(), step: 'iter', why: `You stopped one step early. That's $a_{${target - 2}}$; apply the recurrence once more.` },
    ],
  };
}

const L_OPTS = [
  { tex: '\\pi', expr: 'pi', val: Math.PI, isPi: true },
  { tex: '1', expr: '1', val: 1, n: 1 },
  { tex: '2', expr: '2', val: 2, n: 2 },
];
function genFourier() {
  const L = pick(L_OPTS);
  const k = pick([1, 2, 3, -1, -2, 4]);
  const variant = pick(['step', 'odd', 'even']);
  const period = L.isPi ? '2\\pi' : String(2 * L.n);
  const argL = L.isPi ? 'nx' : L.n === 1 ? 'n\\pi x' : `\\frac{n\\pi x}{${L.tex}}`;
  const series = `f(x)=a_0+\\sum_{n=1}^{\\infty}\\left(a_n\\cos ${argL}+b_n\\sin ${argL}\\right)`;
  const nHint = 'Answer in terms of n. Write (-1)^n for cos(nπ).';
  if (variant === 'step') {
    const ansTex = kFrac(k, '\\left(1-(-1)^n\\right)', 'n\\pi');
    return {
      points: 20,
      prompt: `Let $f(x)=\\begin{cases}0, & -${L.tex}<x<0\\\\ ${k}, & 0<x<${L.tex}\\end{cases}$ with period $${period}$, and $${series}$. Find $b_n$.`,
      vars: ['n'], sample: sampN(), hint: nHint,
      answer: `${k}*(1-(-1)^n)/(n*pi)`, answerTex: `b_n = ${ansTex}`,
      verify: { kind: 'fourier', f: `${k}*u(x)`, L: L.val, coef: 'b' },
      steps: [
        { key: 'formula', title: 'Coefficient formula', body: `$$b_n = \\frac{1}{L}\\int_{-L}^{L} f(x)\\sin\\frac{n\\pi x}{L}\\,dx$$ with $L = ${L.tex}$.` },
        { key: 'restrict', title: 'Only the part where f ≠ 0 contributes', body: `$$b_n = \\frac{1}{${L.tex}}\\int_0^{${L.tex}} ${k}\\sin\\frac{n\\pi x}{${L.tex}}\\,dx$$` },
        { key: 'integrate', title: 'Integrate', body: `$$= \\frac{${k}}{${L.tex}}\\left[-\\frac{${L.tex}}{n\\pi}\\cos\\frac{n\\pi x}{${L.tex}}\\right]_0^{${L.tex}} = \\frac{${k}}{n\\pi}\\left(1-\\cos n\\pi\\right)$$` },
        { key: 'simplify', title: 'Use cos nπ = (−1)ⁿ', body: `$$b_n = ${ansTex}$$ which is $${kFrac(k, '2', 'n\\pi')}$ for odd $n$ and $0$ for even $n$.` },
      ],
      mistakes: [
        { expr: `${k}*(1+(-1)^n)/(n*pi)`, step: 'integrate', why: 'Sign slip when evaluating the bracket. $[-\\cos]_0^{L} = -\\cos n\\pi + \\cos 0 = 1 - (-1)^n$.' },
        { expr: `${2 * k}/(n*pi)`, step: 'simplify', why: '$\\cos n\\pi = (-1)^n$, not always $-1$. Even-$n$ coefficients are zero.' },
        { expr: `${k}*(1-(-1)^n)/(2*n*pi)`, step: 'formula', why: 'The prefactor is $\\frac{1}{L}$; there is no extra $\\frac{1}{2}$.' },
      ],
    };
  }
  if (variant === 'odd') {
    const coef = L.isPi ? 2 * k : 2 * k * L.n;
    const ansTex = kFrac(coef, '(-1)^{n+1}', L.isPi ? 'n' : 'n\\pi');
    const ans = `2*${k}*${L.expr}*(-1)^(n+1)/(n*pi)`;
    return {
      points: 20,
      prompt: `Let $f(x) = ${cf(k)}x$ on $-${L.tex}<x<${L.tex}$, with period $${period}$, and $${series}$. Find $b_n$.`,
      vars: ['n'], sample: sampN(), hint: nHint,
      answer: ans, answerTex: `b_n = ${ansTex}`,
      verify: { kind: 'fourier', f: `${k}*x`, L: L.val, coef: 'b' },
      steps: [
        { key: 'odd', title: 'Use symmetry', body: `$f$ is odd, so $a_n=0$ and $$b_n = \\frac{2}{L}\\int_0^{L} ${cf(k)}x\\sin\\frac{n\\pi x}{L}\\,dx,\\quad L=${L.tex}$$` },
        { key: 'ibp', title: 'Integrate by parts', body: `With $u=x$, $dv=\\sin\\frac{n\\pi x}{L}dx$: $$\\int_0^L x\\sin\\frac{n\\pi x}{L}dx = \\left[-\\frac{Lx}{n\\pi}\\cos\\frac{n\\pi x}{L}\\right]_0^L + \\frac{L}{n\\pi}\\int_0^L\\cos\\frac{n\\pi x}{L}dx = -\\frac{L^2\\cos n\\pi}{n\\pi}$$` },
        { key: 'simplify', title: 'Simplify with cos nπ = (−1)ⁿ', body: `$$b_n = \\frac{${2 * k}}{L}\\cdot\\left(-\\frac{L^2(-1)^n}{n\\pi}\\right) = ${ansTex}$$` },
      ],
      mistakes: [
        { expr: `-(${ans})`, step: 'ibp', why: 'Sign error in the integration by parts. The boundary term is $-\\frac{L^2\\cos n\\pi}{n\\pi}$, and $-(-1)^n = (-1)^{n+1}$.' },
        { expr: `(${ans})/2`, step: 'odd', why: 'You dropped the factor of 2. For an odd $f$, $\\frac{1}{L}\\int_{-L}^{L} = \\frac{2}{L}\\int_0^L$.' },
        { expr: `${2 * k}*${L.expr}/(n*pi)`, step: 'simplify', why: '$\\cos n\\pi = (-1)^n$ alternates in sign; the $(-1)^{n+1}$ factor is missing.' },
      ],
    };
  }
  const coef = L.isPi ? 4 * k : 4 * k * L.n * L.n;
  const ansTex = kFrac(coef, '(-1)^{n}', L.isPi ? 'n^2' : 'n^2\\pi^2');
  const ans = `4*${k}*(${L.expr})^2*(-1)^n/(n^2*pi^2)`;
  return {
    points: 20,
    prompt: `Let $f(x) = ${cf(k)}x^2$ on $-${L.tex}<x<${L.tex}$, with period $${period}$, and $${series}$. Find $a_n$ for $n\\ge1$.`,
    vars: ['n'], sample: sampN(), hint: nHint,
    answer: ans, answerTex: `a_n = ${ansTex}`,
    verify: { kind: 'fourier', f: `${k}*x^2`, L: L.val, coef: 'a' },
    steps: [
      { key: 'even', title: 'Use symmetry', body: `$f$ is even, so $b_n=0$ and $$a_n = \\frac{2}{L}\\int_0^{L} ${cf(k)}x^2\\cos\\frac{n\\pi x}{L}\\,dx,\\quad L=${L.tex}$$` },
      { key: 'ibp', title: 'Integrate by parts twice', body: `Let $\\omega = \\frac{n\\pi}{L}$. $$\\int_0^L x^2\\cos\\omega x\\,dx = \\underbrace{\\left[\\frac{x^2\\sin\\omega x}{\\omega}\\right]_0^L}_{0} - \\frac{2}{\\omega}\\int_0^L x\\sin\\omega x\\,dx = \\frac{2L\\cos n\\pi}{\\omega^2}$$` },
      { key: 'simplify', title: 'Simplify', body: `$$a_n = \\frac{${2 * k}}{L}\\cdot\\frac{2L(-1)^n}{\\omega^2} = \\frac{${4 * k}L^2(-1)^n}{n^2\\pi^2} = ${ansTex}$$` },
    ],
    mistakes: [
      { expr: `-(${ans})`, step: 'ibp', why: 'Sign error in the second integration by parts. $\\int_0^L x\\sin\\omega x\\,dx = -\\frac{L\\cos n\\pi}{\\omega}$, and the $-\\frac{2}{\\omega}$ in front makes it positive.' },
      { expr: `(${ans})/2`, step: 'even', why: 'You dropped the factor of 2. For an even $f$, $\\frac{1}{L}\\int_{-L}^{L} = \\frac{2}{L}\\int_0^L$.' },
      { expr: `4*${k}*${L.expr}*(-1)^n/(n*pi)`, step: 'ibp', why: 'Each integration by parts brings out a $\\frac{1}{\\omega}$, so the result has $\\omega^2 = \\frac{n^2\\pi^2}{L^2}$ in the denominator, not $\\omega$.' },
    ],
  };
}

function genHeat() {
  const usePi = Math.random() < 0.6;
  const L = usePi ? L_OPTS[0] : pick([L_OPTS[1], L_OPTS[2]]);
  const c = usePi ? pick([1, 1, 2]) : 1;
  const c2 = c * c;
  const insulated = Math.random() < 0.35;
  const argTex = (m) => {
    if (L.isPi) return kv(m, 'x');
    if (L.n === 1) return `${m === 1 ? '' : m}\\pi x`;
    return m % 2 === 0 ? `${m / 2 === 1 ? '' : m / 2}\\pi x` : `\\frac{${m === 1 ? '' : m}\\pi x}{2}`;
  };
  const rateTex = (m) => {
    if (L.isPi) return String(m * m * c2);
    const num = m * m, den = L.n * L.n;
    const f = new Frac(num, den);
    if (f.d === 1) return `${f.n === 1 ? '' : f.n}\\pi^2`;
    return `\\frac{${f.n === 1 ? '' : f.n}\\pi^2}{${f.d}}`;
  };
  const rate = (m) => `(${m}*pi*${c}/(${L.expr}))^2`;
  const arg = (m) => `${m}*pi*x/(${L.expr})`;
  const decayTex = (m) => `e^{-${rateTex(m)}t}`;
  const eq = `u_t = ${c2 === 1 ? '' : c2}u_{xx}`;
  const sampler = () => {
    return { x: rand(0.05, 0.95) * L.val, t: rand(0.02, 1.2) / ((4 * Math.PI * c / L.val) ** 2) };
  };
  if (!insulated) {
    const [m, p] = distinctInts(1, 4, 2);
    const A = nz(-5, 5), B = nz(-5, 5);
    const icTex = sumTex([{ c: A, body: `\\sin(${argTex(m)})` }, { c: B, body: `\\sin(${argTex(p)})` }]);
    const ansTex = sumTex([{ c: A, body: `${decayTex(m)}\\sin(${argTex(m)})` }, { c: B, body: `${decayTex(p)}\\sin(${argTex(p)})` }]);
    const term = (cc, mm, r) => `(${cc})*exp(-(${r})*t)*sin(${arg(mm)})`;
    const mistakes = [
      { expr: `${term(A, m, `${m}*pi*${c}/(${L.expr})`)}+${term(B, p, `${p}*pi*${c}/(${L.expr})`)}`, step: 'time', why: `The decay rate is $c^2\\lambda_n = \\left(\\frac{n\\pi c}{L}\\right)^2$, which is squared.` },
      { expr: `(${A})*sin(${arg(m)})+(${B})*sin(${arg(p)})`, step: 'time', why: 'Each mode decays in time. The $e^{-c^2\\lambda_n t}$ factor is missing.' },
    ];
    if (c !== 1) mistakes.push({ expr: `${term(A, m, `(${m}*pi/(${L.expr}))^2`)}+${term(B, p, `(${p}*pi/(${L.expr}))^2`)}`, step: 'time', why: `The rate includes $c^2 = ${c2}$: $T_n' = -c^2\\lambda_n T_n$.` });
    return {
      points: 20,
      prompt: `Solve $${eq}$ for $0<x<${L.tex}$, $t>0$, with $u(0,t)=u(${L.tex},t)=0$ and $u(x,0) = ${icTex}$.`,
      vars: ['x', 't'], sample: sampler, hint: 'Enter u in terms of x and t, e.g. 3e^(-4t)sin(2x).',
      answer: `${term(A, m, rate(m))}+${term(B, p, rate(p))}`, answerTex: `u(x,t) = ${ansTex}`,
      verify: { kind: 'heat', c2, L: L.val, bc: 'D', ic: `(${A})*sin(${arg(m)})+(${B})*sin(${arg(p)})` },
      steps: [
        { key: 'sep', title: 'Separate variables', body: `$u = X(x)T(t)$ gives $X''+\\lambda X = 0$ and $T' + ${c2 === 1 ? '' : c2}\\lambda T = 0$.` },
        { key: 'eig', title: 'Eigenfunctions from the boundary conditions', body: `$X(0)=X(${L.tex})=0$ gives $X_n = \\sin\\frac{n\\pi x}{${L.tex}}$, $\\lambda_n = \\left(\\frac{n\\pi}{${L.tex}}\\right)^2$.` },
        { key: 'time', title: 'Time factor', body: `$T_n = e^{-${c2 === 1 ? '' : c2}\\lambda_n t}$, so $$u = \\sum_{n\\ge1} b_n\\,e^{-${c2 === 1 ? '' : c2}\\left(\\frac{n\\pi}{${L.tex}}\\right)^2 t}\\sin\\frac{n\\pi x}{${L.tex}}$$` },
        { key: 'match', title: 'Match the initial condition', body: `$u(x,0)$ is already a combination of eigenfunctions: $b_{${m}} = ${A}$, $b_{${p}} = ${B}$, and all others are $0$.` },
        { key: 'res', title: 'Result', body: `$$u(x,t) = ${ansTex}$$` },
      ],
      mistakes,
    };
  }
  const m = randInt(1, 4), A0 = nz(-5, 5), B = nz(-5, 5);
  const icTex = sumTex([{ c: A0, body: '' }, { c: B, body: `\\cos(${argTex(m)})` }]);
  const ansTex = sumTex([{ c: A0, body: '' }, { c: B, body: `${decayTex(m)}\\cos(${argTex(m)})` }]);
  const mistakes = [
    { expr: `${A0}+(${B})*exp(-(${m}*pi*${c}/(${L.expr}))*t)*cos(${arg(m)})`, step: 'time', why: 'The decay rate is $c^2\\lambda_n = \\left(\\frac{n\\pi c}{L}\\right)^2$, which is squared.' },
    { expr: `(${B})*exp(-(${rate(m)})*t)*cos(${arg(m)})`, step: 'match', why: `The constant term $${A0}$ is the $n=0$ mode ($\\lambda_0 = 0$). It doesn't decay and must stay in the answer.` },
    { expr: `${A0}+(${B})*exp(-(${rate(m)})*t)*sin(${arg(m)})`, step: 'eig', why: 'With insulated ends ($u_x=0$) the eigenfunctions are cosines, not sines.' },
    { expr: `(${A0})*exp(-(${rate(m)})*t)+(${B})*exp(-(${rate(m)})*t)*cos(${arg(m)})`, step: 'time', why: `Each mode decays at its own rate. The $n=0$ mode has $\\lambda_0=0$, so the constant ${A0} does not decay.` },
  ];
  return {
    points: 20,
    prompt: `Solve $${eq}$ for $0<x<${L.tex}$, $t>0$, with insulated ends $u_x(0,t)=u_x(${L.tex},t)=0$ and $u(x,0) = ${icTex}$.`,
    vars: ['x', 't'], sample: sampler, hint: 'Enter u in terms of x and t.',
    answer: `${A0}+(${B})*exp(-(${rate(m)})*t)*cos(${arg(m)})`, answerTex: `u(x,t) = ${ansTex}`,
    verify: { kind: 'heat', c2, L: L.val, bc: 'N', ic: `${A0}+(${B})*cos(${arg(m)})` },
    steps: [
      { key: 'sep', title: 'Separate variables', body: `$u = X(x)T(t)$ gives $X''+\\lambda X = 0$ and $T' + ${c2 === 1 ? '' : c2}\\lambda T = 0$.` },
      { key: 'eig', title: 'Eigenfunctions (insulated ends)', body: `$X'(0)=X'(${L.tex})=0$ gives $X_n = \\cos\\frac{n\\pi x}{${L.tex}}$, $\\lambda_n = \\left(\\frac{n\\pi}{${L.tex}}\\right)^2$, for $n = 0, 1, 2, \\dots$ (with $X_0 = 1$).` },
      { key: 'time', title: 'Time factor', body: `$T_n = e^{-${c2 === 1 ? '' : c2}\\lambda_n t}$, so $$u = a_0 + \\sum_{n\\ge1} a_n\\,e^{-${c2 === 1 ? '' : c2}\\left(\\frac{n\\pi}{${L.tex}}\\right)^2 t}\\cos\\frac{n\\pi x}{${L.tex}}$$` },
      { key: 'match', title: 'Match the initial condition', body: `$a_0 = ${A0}$, $a_{${m}} = ${B}$, and all others are $0$.` },
      { key: 'res', title: 'Result', body: `$$u(x,t) = ${ansTex}$$` },
    ],
    mistakes,
  };
}

function genWave() {
  const c = randInt(1, 3), m = randInt(1, 4), p = randInt(1, 4);
  const A = nz(-4, 4), B = nz(-6, 6);
  const c2 = c * c;
  const bp = new Frac(B, p * c);
  const s = (k, v) => `(${kv(k, v)})`;
  const ansTex = sumTex([
    { c: A, body: `\\cos${s(m * c, 't')}\\sin${s(m, 'x')}` },
    { c: bp, body: `\\sin${s(p * c, 't')}\\sin${s(p, 'x')}` },
  ]);
  const t1 = `(${A})*cos(${m * c}*t)*sin(${m}*x)`;
  const mistakes = [
    { expr: `${t1}+(${B})*sin(${p * c}*t)*sin(${p}*x)`, step: 'vel', why: `Differentiating $\\sin(${kv(p * c, 't')})$ brings out a factor $${p * c}$, so the coefficient is $\\frac{${B}}{${p * c}}$, not $${B}$.` },
    { expr: `${t1}+(${B}/${p * c})*cos(${p * c}*t)*sin(${p}*x)`, step: 'vel', why: 'Initial velocity goes with the $\\sin(nct)$ term, which is zero at $t=0$. A $\\cos$ term would change $u(x,0)$.' },
  ];
  if (c !== 1) mistakes.push({ expr: `(${A})*cos(${m}*t)*sin(${m}*x)+(${B}/${p})*sin(${p}*t)*sin(${p}*x)`, step: 'time', why: `The time frequency is $nc$ with $c = ${c}$ (from $c^2 = ${c2}$).` });
  return {
    points: 25,
    prompt: `Solve $u_{tt} = ${c2 === 1 ? '' : c2}u_{xx}$ on $0<x<\\pi$ with $u(0,t)=u(\\pi,t)=0$, $u(x,0) = ${cf(A)}\\sin(${kv(m, 'x')})$, $u_t(x,0) = ${cf(B)}\\sin(${kv(p, 'x')})$.`,
    vars: ['x', 't'], sample: () => ({ x: rand(0.1, 3), t: rand(0.05, 2) }), hint: 'Enter u in terms of x and t.',
    answer: `${t1}+(${B}/${p * c})*sin(${p * c}*t)*sin(${p}*x)`, answerTex: `u(x,t) = ${ansTex}`,
    verify: { kind: 'wave', c2, L: Math.PI, ic: `(${A})*sin(${m}*x)`, iv: `(${B})*sin(${p}*x)` },
    steps: [
      { key: 'sep', title: 'Separate variables', body: `$X''+\\lambda X=0$, $X(0)=X(\\pi)=0$ gives $X_n=\\sin(nx)$, $\\lambda_n=n^2$. Then $T''+${c2 === 1 ? '' : c2}n^2T=0$.` },
      { key: 'time', title: 'Time factor', body: `$T_n = a_n\\cos(${c === 1 ? '' : c}nt) + b_n\\sin(${c === 1 ? '' : c}nt)$, so $$u = \\sum_{n\\ge1}\\big(a_n\\cos(${c === 1 ? '' : c}nt)+b_n\\sin(${c === 1 ? '' : c}nt)\\big)\\sin(nx)$$` },
      { key: 'disp', title: 'Initial displacement', body: `$u(x,0) = \\sum a_n\\sin(nx)$, so $a_{${m}} = ${A}$ and the other $a_n = 0$.` },
      { key: 'vel', title: 'Initial velocity', body: `$u_t(x,0) = \\sum ${c === 1 ? '' : c}n\\,b_n\\sin(nx)$, so $${p * c}\\,b_{${p}} = ${B}$, giving $b_{${p}} = ${bp.tex()}$.` },
      { key: 'res', title: 'Result', body: `$$u(x,t) = ${ansTex}$$` },
    ],
    mistakes,
  };
}

function genSL() {
  const L = pick([L_OPTS[0], L_OPTS[1], L_OPTS[2], { tex: '3', expr: '3', val: 3, n: 3 }]);
  const bc = pick(['DD', 'NN', 'DN', 'ND']);
  const bcTex = {
    DD: `y(0)=0,\\; y(${L.tex})=0`,
    NN: `y'(0)=0,\\; y'(${L.tex})=0`,
    DN: `y(0)=0,\\; y'(${L.tex})=0`,
    ND: `y'(0)=0,\\; y(${L.tex})=0`,
  }[bc];
  const mixed = bc === 'DN' || bc === 'ND';
  const Le = L.expr;
  const intAns = `(n*pi/(${Le}))^2`;
  const halfAns = `((2*n-1)*pi/(2*${Le}))^2`;
  const intTex = L.isPi ? 'n^2' : L.n === 1 ? 'n^2\\pi^2' : `\\frac{n^2\\pi^2}{${L.n * L.n}}`;
  const halfTex = L.isPi ? '\\frac{(2n-1)^2}{4}' : `\\frac{(2n-1)^2\\pi^2}{${4 * L.n * L.n}}`;
  const ansTex = mixed ? halfTex : intTex;
  const first = bc[0] === 'D' ? '$y(0)=0 \\Rightarrow A = 0$, so $y = B\\sin\\mu x$.' : '$y\'(0)=0 \\Rightarrow B = 0$, so $y = A\\cos\\mu x$.';
  const second = {
    DD: `$y(${L.tex}) = B\\sin(\\mu ${L.tex}) = 0 \\Rightarrow \\mu ${L.tex} = n\\pi$.`,
    NN: `$y'(${L.tex}) = -A\\mu\\sin(\\mu ${L.tex}) = 0 \\Rightarrow \\mu ${L.tex} = n\\pi$.`,
    DN: `$y'(${L.tex}) = B\\mu\\cos(\\mu ${L.tex}) = 0 \\Rightarrow \\mu ${L.tex} = \\frac{(2n-1)\\pi}{2}$.`,
    ND: `$y(${L.tex}) = A\\cos(\\mu ${L.tex}) = 0 \\Rightarrow \\mu ${L.tex} = \\frac{(2n-1)\\pi}{2}$.`,
  }[bc];
  const efn = { DD: '\\sin', NN: '\\cos', DN: '\\sin', ND: '\\cos' }[bc];
  const mistakes = [
    { expr: mixed ? `(2*n-1)*pi/(2*${Le})` : `n*pi/(${Le})`, step: 'res', why: 'That is $\\mu_n = \\sqrt{\\lambda_n}$. The eigenvalue is $\\lambda_n = \\mu_n^2$.' },
  ];
  if (mixed) {
    mistakes.push({ expr: intAns, step: 'bc2', why: 'With one Dirichlet and one Neumann condition, the second condition gives $\\cos(\\mu L)=0$, so $\\mu L$ is an odd multiple of $\\frac{\\pi}{2}$, not $n\\pi$.' });
    mistakes.push({ expr: `((2*n+1)*pi/(2*${Le}))^2`, step: 'res', why: 'Indexing: with $n = 1, 2, 3, \\dots$ the odd multiples are $2n-1$. $2n+1$ skips the first eigenvalue.' });
  } else {
    mistakes.push({ expr: halfAns, step: 'bc2', why: `${bc === 'DD' ? 'Both ends are Dirichlet' : 'Both ends are Neumann'}, so the condition is $\\sin(\\mu L)=0$, giving $\\mu L = n\\pi$.` });
  }
  return {
    points: 15,
    prompt: `Find the ${bc === 'NN' ? 'positive ' : ''}eigenvalues $\\lambda_n$ $(n=1,2,3,\\dots)$ of $y''+\\lambda y=0$, $0<x<${L.tex}$, with $${bcTex}$.`,
    vars: ['n'], sample: sampN(), hint: 'Answer in terms of n.',
    answer: mixed ? halfAns : intAns, answerTex: `\\lambda_n = ${ansTex}`,
    verify: { kind: 'sl', bc, L: L.val },
    steps: [
      { key: 'neg', title: 'Rule out λ < 0 (and λ = 0)', body: bc === 'NN' ? '$\\lambda<0$ gives only $y=0$. $\\lambda=0$ gives the constant eigenfunction $y=1$ ($\\lambda_0=0$), which is not positive.' : '$\\lambda<0$ and $\\lambda=0$ give only the trivial solution $y=0$.' },
      { key: 'gen', title: 'λ = μ² > 0', body: '$y = A\\cos\\mu x + B\\sin\\mu x$.' },
      { key: 'bc1', title: 'First boundary condition', body: first },
      { key: 'bc2', title: 'Second boundary condition', body: second },
      { key: 'res', title: 'Result', body: `$$\\lambda_n = \\mu_n^2 = ${ansTex},\\qquad y_n = ${efn}(\\mu_n x)$$` },
    ],
    mistakes,
  };
}

/* ================================================================== */
/* Section 1.3 — Convolutions and generalized functions                */
/* ================================================================== */
// Convolution convention follows the textbook: (f*g)(t) = ∫_0^t f(t-x) g(x) dx
const fracTex = (num, den) => (den === '1' ? num : `\\frac{${num}}{${den}}`);
// (expr)/(k) as TeX with the sign pulled out: k<0 flips numerator order supplied by caller
function convPair(kinds) {
  const kind = pick(kinds);
  if (kind === 'one-exp') {
    const a = nz(-3, 3);
    const ansTex = a > 0 ? fracTex(`e^{${kv(a, 't')}} - 1`, String(a)) : fracTex(`1 - e^{${kv(a, 't')}}`, String(-a));
    return {
      kind, f: '1', g: `e^{${kv(a, 't')}}`, fExpr: '1', gExpr: `exp(${a}*t)`,
      FG: `1/(s*(s-(${a})))`, FGtex: `\\frac{1}{s(${sh('s', a)})}`, Ftex: '\\frac{1}{s}', Gtex: `\\frac{1}{${sh('s', a)}}`, pole: Math.max(a, 0),
      integral: `\\int_0^t 1\\cdot e^{${kv(a, 'x')}}\\,dx`,
      evalTex: `$$\\int_0^t e^{${kv(a, 'x')}}\\,dx = \\left[\\frac{e^{${kv(a, 'x')}}}{${a}}\\right]_0^t = \\frac{e^{${kv(a, 't')}}-1}{${a}}$$`,
      ans: `(exp(${a}*t)-1)/(${a})`, ansTex,
      mistakes: [
        { expr: `exp(${a}*t)`, step: 'setup', why: 'A convolution is not the product $f(t)g(t)$. You need the integral $\\int_0^t f(t-x)g(x)\\,dx$.' },
        { expr: `(1-exp(${a}*t))/(${a})`, step: 'integrate', why: 'Sign slip when evaluating the bracket: it is (value at $t$) minus (value at $0$), i.e. $e^{at}-1$.' },
        { expr: `exp(${a}*t)-1`, step: 'integrate', why: `Integrating $e^{${kv(a, 'x')}}$ brings out a factor $\\frac{1}{${a}}$.` },
      ],
    };
  }
  if (kind === 'one-sin') {
    const b = randInt(1, 4);
    return {
      kind, f: '1', g: `\\sin(${kv(b, 't')})`, fExpr: '1', gExpr: `sin(${b}*t)`,
      FG: `${b}/(s*(s^2+${b * b}))`, FGtex: `\\frac{${b}}{s(s^2+${b * b})}`, Ftex: '\\frac{1}{s}', Gtex: `\\frac{${b}}{s^2+${b * b}}`, pole: 0,
      integral: `\\int_0^t 1\\cdot \\sin(${kv(b, 'x')})\\,dx`,
      evalTex: `$$\\int_0^t \\sin(${kv(b, 'x')})\\,dx = \\left[-\\frac{\\cos(${kv(b, 'x')})}{${b}}\\right]_0^t = \\frac{1-\\cos(${kv(b, 't')})}{${b}}$$`,
      ans: `(1-cos(${b}*t))/${b}`, ansTex: fracTex(`1 - \\cos(${kv(b, 't')})`, String(b)),
      mistakes: [
        { expr: `sin(${b}*t)`, step: 'setup', why: 'A convolution is not the product $f(t)g(t)$. With $f=1$ you still have to integrate $g$ from 0 to $t$.' },
        { expr: `(cos(${b}*t)-1)/${b}`, step: 'integrate', why: 'Sign slip: $\\left[-\\cos(bx)\\right]_0^t = -\\cos(bt) + \\cos 0 = 1 - \\cos(bt)$.' },
        { expr: `1-cos(${b}*t)`, step: 'integrate', why: `Integrating $\\sin(${kv(b, 'x')})$ brings out a factor $\\frac{1}{${b}}$.` },
      ],
    };
  }
  if (kind === 'one-cos') {
    const b = randInt(2, 4);
    return {
      kind, f: '1', g: `\\cos(${kv(b, 't')})`, fExpr: '1', gExpr: `cos(${b}*t)`,
      FG: `1/(s^2+${b * b})`, FGtex: `\\frac{1}{s^2+${b * b}}`, Ftex: '\\frac{1}{s}', Gtex: `\\frac{s}{s^2+${b * b}}`, pole: 0,
      integral: `\\int_0^t 1\\cdot \\cos(${kv(b, 'x')})\\,dx`,
      evalTex: `$$\\int_0^t \\cos(${kv(b, 'x')})\\,dx = \\left[\\frac{\\sin(${kv(b, 'x')})}{${b}}\\right]_0^t = \\frac{\\sin(${kv(b, 't')})}{${b}}$$`,
      ans: `sin(${b}*t)/${b}`, ansTex: fracTex(`\\sin(${kv(b, 't')})`, String(b)),
      mistakes: [
        { expr: `cos(${b}*t)`, step: 'setup', why: 'A convolution is not the product $f(t)g(t)$. With $f=1$ you still have to integrate $g$ from 0 to $t$.' },
        { expr: `-sin(${b}*t)/${b}`, step: 'integrate', why: 'The antiderivative of $\\cos(bx)$ is $+\\frac{\\sin(bx)}{b}$.' },
        { expr: `sin(${b}*t)`, step: 'integrate', why: `Integrating $\\cos(${kv(b, 'x')})$ brings out a factor $\\frac{1}{${b}}$.` },
      ],
    };
  }
  if (kind === 't-exp') {
    const a = nz(-3, 3), a2 = a * a;
    const lin = `${a < 0 ? '+' : '-'} ${kv(Math.abs(a), 't')}`;
    return {
      kind, f: 't', g: `e^{${kv(a, 't')}}`, fExpr: 't', gExpr: `exp(${a}*t)`,
      FG: `1/(s^2*(s-(${a})))`, FGtex: `\\frac{1}{s^2(${sh('s', a)})}`, Ftex: '\\frac{1}{s^2}', Gtex: `\\frac{1}{${sh('s', a)}}`, pole: Math.max(a, 0),
      integral: `\\int_0^t (t-x)\\,e^{${kv(a, 'x')}}\\,dx`,
      evalTex: `Integrate by parts with $u=t-x$, $dv=e^{${kv(a, 'x')}}dx$: $$\\left[\\frac{(t-x)e^{${kv(a, 'x')}}}{${a}}\\right]_0^t + \\frac{1}{${a}}\\int_0^t e^{${kv(a, 'x')}}\\,dx = -\\frac{t}{${a}} + \\frac{e^{${kv(a, 't')}}-1}{${a2}}$$`,
      ans: `(exp(${a}*t)-1-${a}*t)/${a2}`, ansTex: fracTex(`e^{${kv(a, 't')}} - 1 ${lin}`, String(a2)),
      mistakes: [
        { expr: `t*exp(${a}*t)`, step: 'setup', why: 'A convolution is not the product $f(t)g(t)$. You need $\\int_0^t (t-x)\\,g(x)\\,dx$.' },
        { expr: `(exp(${a}*t)-1+${a}*t)/${a2}`, step: 'integrate', why: `Sign slip in the boundary term: $\\left[\\frac{(t-x)e^{ax}}{a}\\right]_0^t = 0 - \\frac{t}{a}$.` },
        { expr: `(exp(${a}*t)-1-${a}*t)/${a}`, step: 'integrate', why: 'The second integration brings out another $\\frac{1}{a}$, so the denominator is $a^2$.' },
      ],
    };
  }
  if (kind === 't-sin') {
    const b = randInt(1, 3), b2 = b * b;
    return {
      kind, f: 't', g: `\\sin(${kv(b, 't')})`, fExpr: 't', gExpr: `sin(${b}*t)`,
      FG: `${b}/(s^2*(s^2+${b2}))`, FGtex: `\\frac{${b}}{s^2(s^2+${b2})}`, Ftex: '\\frac{1}{s^2}', Gtex: `\\frac{${b}}{s^2+${b2}}`, pole: 0,
      integral: `\\int_0^t (t-x)\\sin(${kv(b, 'x')})\\,dx`,
      evalTex: `Integrate by parts with $u=t-x$, $dv=\\sin(${kv(b, 'x')})dx$: $$\\left[-\\frac{(t-x)\\cos(${kv(b, 'x')})}{${b}}\\right]_0^t - \\frac{1}{${b}}\\int_0^t \\cos(${kv(b, 'x')})\\,dx = \\frac{t}{${b}} - \\frac{\\sin(${kv(b, 't')})}{${b2}}$$`,
      ans: `(${b}*t-sin(${b}*t))/${b2}`, ansTex: fracTex(`${kv(b, 't')} - \\sin(${kv(b, 't')})`, String(b2)),
      mistakes: [
        { expr: `t*sin(${b}*t)`, step: 'setup', why: 'A convolution is not the product $f(t)g(t)$. You need $\\int_0^t (t-x)\\,g(x)\\,dx$.' },
        { expr: `(${b}*t+sin(${b}*t))/${b2}`, step: 'integrate', why: 'Sign slip in the second integral: $-\\frac{1}{b}\\int_0^t\\cos(bx)\\,dx = -\\frac{\\sin(bt)}{b^2}$.' },
        { expr: `(${b}*t-sin(${b}*t))/${b}`, step: 'integrate', why: 'Each integration brings out a $\\frac1b$, so the denominator is $b^2$.' },
      ],
    };
  }
  // exp-exp
  let [a, b] = distinctInts(-3, 3, 2, { nonzero: true });
  if (a < b) [a, b] = [b, a];
  const d = a - b;
  return {
    kind: 'exp-exp', f: exOr1(a), g: exOr1(b), fExpr: `exp(${a}*t)`, gExpr: `exp(${b}*t)`,
    FG: `1/((s-(${a}))*(s-(${b})))`, FGtex: `\\frac{1}{(${sh('s', a)})(${sh('s', b)})}`, Ftex: `\\frac{1}{${sh('s', a)}}`, Gtex: `\\frac{1}{${sh('s', b)}}`, pole: Math.max(a, 0),
    integral: `\\int_0^t e^{${a}(t-x)}e^{${kv(b, 'x')}}\\,dx`,
    evalTex: `$$= e^{${kv(a, 't')}}\\int_0^t e^{${kv(b - a, 'x')}}\\,dx = e^{${kv(a, 't')}}\\cdot\\frac{e^{${kv(b - a, 't')}}-1}{${b - a}} = \\frac{${exOr1(a)} - ${exOr1(b)}}{${d}}$$`,
    ans: `(exp(${a}*t)-exp(${b}*t))/(${d})`, ansTex: fracTex(`${exOr1(a)} - ${exOr1(b)}`, String(d)),
    mistakes: [
      { expr: `exp(${a + b}*t)`, step: 'setup', why: 'A convolution is not the product $f(t)g(t)$. You need $\\int_0^t f(t-x)g(x)\\,dx$.' },
      { expr: `(exp(${b}*t)-exp(${a}*t))/(${d})`, step: 'integrate', why: 'Sign slip when evaluating the bracket: upper limit minus lower limit.' },
      { expr: `exp(${a}*t)-exp(${b}*t)`, step: 'integrate', why: `Integrating $e^{${kv(b - a, 'x')}}$ brings out a factor $\\frac{1}{${b - a}}$.` },
    ],
  };
}

function genConvDirect() {
  const P = convPair(['one-exp', 'one-sin', 'one-cos', 't-exp', 't-sin', 'exp-exp']);
  const swap = P.f !== P.g && Math.random() < 0.5;
  const shown = swap ? `${P.g} * ${P.f}` : `${P.f} * ${P.g}`;
  const swapNote = swap ? ` Since $f*g=g*f$, put $${P.f}$ in the shifted slot $f(t-x)$; it's the easier one to shift.` : '';
  return {
    points: 15,
    prompt: `Evaluate the convolution $${shown}$ directly from the definition.`,
    vars: ['t'], sample: sampT(0.1, 1.5), hint: 'Answer in terms of t.',
    answer: P.ans, answerTex: P.ansTex,
    verify: { kind: 'conv', f: P.fExpr, g: P.gExpr },
    steps: [
      { key: 'setup', title: 'Write the convolution integral', body: `$(f*g)(t)=\\int_0^t f(t-x)\\,g(x)\\,dx$.${swapNote} $$${shown} = ${P.integral}$$` },
      { key: 'integrate', title: 'Evaluate the integral', body: P.evalTex },
      { key: 'res', title: 'Result', body: `$$${shown} = ${P.ansTex}$$` },
    ],
    mistakes: P.mistakes,
  };
}

function genConvInverse() {
  const P = convPair(['one-exp', 'one-sin', 't-exp', 't-sin', 'exp-exp']);
  return {
    points: 15,
    prompt: `Use the convolution theorem to find $\\mathcal{L}^{-1}\\left\\{${P.FGtex}\\right\\}$.`,
    vars: ['t'], sample: sampT(0.1, 1.5), hint: 'Answer in terms of t.',
    answer: P.ans, answerTex: P.ansTex,
    verify: { kind: 'inverse', F: P.FG, pole: P.pole },
    steps: [
      { key: 'thm', title: 'Split into a product of known transforms', body: `$$${P.FGtex} = ${P.Ftex}\\cdot ${P.Gtex} = \\mathcal{L}\\{${P.f}\\}\\,\\mathcal{L}\\{${P.g}\\}$$ so by the convolution theorem the answer is $${P.f} * ${P.g}$.` },
      { key: 'setup', title: 'Write the convolution integral', body: `$$${P.f} * ${P.g} = ${P.integral}$$` },
      { key: 'integrate', title: 'Evaluate the integral', body: P.evalTex },
      { key: 'res', title: 'Result', body: `$$\\mathcal{L}^{-1}\\left\\{${P.FGtex}\\right\\} = ${P.ansTex}$$` },
    ],
    mistakes: P.mistakes.map((m) => (m.step === 'setup' ? { ...m, step: 'thm', why: '$\\mathcal{L}^{-1}\\{F G\\}$ is the convolution $f*g$, not the product $f(t)\\,g(t)$.' } : m)),
  };
}

function genConvLaplace() {
  const fk = pick(['one', 't', 't2', 'exp']);
  const gk = pick(['sin', 'cos', 'exp']);
  const a = nz(-3, 3), b = randInt(1, 4);
  let c = nz(-3, 3); if (fk === 'exp') while (c === a) c = nz(-3, 3);
  const F = {
    one: { tex: '1', num: '1', den: 's', denE: 's', Ftex: '\\frac{1}{s}', pole: 0 },
    t: { tex: 't', num: '1', den: 's^2', denE: 's^2', Ftex: '\\frac{1}{s^2}', pole: 0 },
    t2: { tex: 't^2', num: '2', den: 's^3', denE: 's^3', Ftex: '\\frac{2}{s^3}', pole: 0 },
    exp: { tex: `e^{${kv(a, 't')}}`, num: '1', den: `(${sh('s', a)})`, denE: `(s-(${a}))`, Ftex: `\\frac{1}{${sh('s', a)}}`, pole: a },
  }[fk];
  const G = {
    sin: { tex: `\\sin(${kv(b, 't')})`, num: String(b), den: `(s^2+${b * b})`, denE: `(s^2+${b * b})`, Gtex: `\\frac{${b}}{s^2+${b * b}}`, pole: 0 },
    cos: { tex: `\\cos(${kv(b, 't')})`, num: 's', den: `(s^2+${b * b})`, denE: `(s^2+${b * b})`, Gtex: `\\frac{s}{s^2+${b * b}}`, pole: 0 },
    exp: { tex: `e^{${kv(c, 't')}}`, num: '1', den: `(${sh('s', c)})`, denE: `(s-(${c}))`, Gtex: `\\frac{1}{${sh('s', c)}}`, pole: c },
  }[gk];
  const isNum = (v) => /^\d+$/.test(v);
  const numTex = isNum(F.num) && isNum(G.num) ? String(+F.num * +G.num) : `${F.num === '1' ? '' : F.num}${G.num}`;
  const ansTex = `\\frac{${numTex}}{${F.den}${G.den}}`;
  const answer = `(${F.num})*(${G.num})/(${F.denE}*${G.denE})`;
  const mistakes = [
    { expr: `${F.num}/${F.denE}+${G.num}/${G.denE}`, step: 'thm', why: 'The transform of a convolution is the product $F(s)G(s)$, not the sum.' },
  ];
  if (fk === 'one') mistakes.push({ expr: `${G.num}/${G.denE}`, step: 'thm', why: '$1 * g$ is not $g$. It is $\\int_0^t g(x)\\,dx$, with transform $\\frac{G(s)}{s}$.' });
  if (fk === 'exp' && gk !== 'exp') {
    const prodE = gk === 'sin' ? `${b}/((s-(${a}))^2+${b * b})` : `(s-(${a}))/((s-(${a}))^2+${b * b})`;
    mistakes.push({ expr: prodE, step: 'thm', why: `That is $\\mathcal{L}\\{e^{${kv(a, 't')}}${G.tex}\\}$, the transform of the product. The convolution transforms to $F(s)G(s)$.` });
  }
  if (fk === 't' && gk !== 'exp') {
    const prodE = gk === 'sin' ? `2*${b}*s/(s^2+${b * b})^2` : `(s^2-${b * b})/(s^2+${b * b})^2`;
    mistakes.push({ expr: prodE, step: 'thm', why: `That is $\\mathcal{L}\\{t${G.tex}\\}$, the transform of the product. The convolution transforms to $F(s)G(s)$.` });
  }
  if (fk === 'exp') mistakes.push({ expr: `(${G.num})/((s+(${a}))*${G.denE})`, step: 'F', why: `$\\mathcal{L}\\{e^{${kv(a, 't')}}\\} = \\frac{1}{${sh('s', a)}}$.` });
  return {
    points: 10,
    prompt: `Find $\\mathcal{L}\\{${F.tex} * ${G.tex}\\}$ without evaluating the convolution.`,
    vars: ['s'], sample: sampS(Math.max(F.pole, G.pole)), hint: 'Answer in terms of s.',
    answer, answerTex: ansTex,
    verify: { kind: 'convlap', f: { one: '1', t: 't', t2: 't^2', exp: `exp(${a}*t)` }[fk], g: { sin: `sin(${b}*t)`, cos: `cos(${b}*t)`, exp: `exp(${c}*t)` }[gk], pole: Math.max(F.pole, G.pole, 0) },
    steps: [
      { key: 'thm', title: 'Convolution theorem', body: '$\\mathcal{L}\\{f*g\\} = F(s)\\,G(s)$, so there is no need to compute the integral.' },
      { key: 'F', title: 'Transform each factor', body: `$\\mathcal{L}\\{${F.tex}\\} = ${F.Ftex}$ and $\\mathcal{L}\\{${G.tex}\\} = ${G.Gtex}$.` },
      { key: 'res', title: 'Multiply', body: `$$\\mathcal{L}\\{${F.tex} * ${G.tex}\\} = ${ansTex}$$` },
    ],
    mistakes,
  };
}

function genIntEq() {
  let a, lam, b, k;
  do { a = randInt(-2, 2); lam = pick([1, -1, 2, -2]); b = a + lam; k = nz(-3, 3); } while (b === 0);
  const c = k * b;
  const lamTex = lam === 1 ? '+ ' : lam === -1 ? '- ' : lam > 0 ? `+ ${lam}` : `- ${-lam}`;
  const integralTex = a === 0 ? '\\int_0^t f(x)\\,dx' : `\\int_0^t f(t-x)\\,e^{${kv(a, 'x')}}\\,dx`;
  const ansTex = sumTex([{ c: k * a, body: '' }, { c: k * lam, body: ex(b) }]);
  const answer = `${k * a}+(${k * lam})*exp(${b}*t)`;
  const Kden = a === 0 ? 's' : sh('s', a);
  const steps = [
    { key: 'conv', title: 'Recognise the convolution', body: a === 0 ? '$\\int_0^t f(x)\\,dx = 1 * f$, whose transform is $\\frac{F(s)}{s}$.' : `$\\int_0^t f(t-x)e^{${kv(a, 'x')}}dx = f * e^{${kv(a, 't')}}$, whose transform is $F(s)\\cdot\\frac{1}{${sh('s', a)}}$.` },
    { key: 'transform', title: 'Transform both sides', body: `$$F(s) = \\frac{${c}}{s} ${lamTex}\\frac{F(s)}{${Kden}}$$` },
    { key: 'solve', title: 'Solve for F(s)', body: a === 0
      ? `$$F(s)\\,\\frac{${sh('s', b)}}{s} = \\frac{${c}}{s} \\;\\Rightarrow\\; F(s) = \\frac{${c}}{${sh('s', b)}}$$`
      : `$$F(s)\\,\\frac{${sh('s', b)}}{${sh('s', a)}} = \\frac{${c}}{s} \\;\\Rightarrow\\; F(s) = \\frac{${c}(${sh('s', a)})}{s(${sh('s', b)})}$$` },
  ];
  if (a !== 0) steps.push({ key: 'pf', title: 'Partial fractions', body: `$$F(s) = \\frac{${k * a}}{s} ${k * lam < 0 ? '-' : '+'} \\frac{${Math.abs(k * lam)}}{${sh('s', b)}}$$` });
  steps.push({ key: 'res', title: 'Invert', body: `$$f(t) = ${ansTex}$$` });
  const mistakes = [];
  if (a !== 0) {
    mistakes.push({ expr: `${c}*exp(${lam}*t)`, step: 'conv', why: `The kernel is $e^{${kv(a, 'x')}}$, not 1, so the integral transforms to $\\frac{F(s)}{${sh('s', a)}}$, not $\\frac{F(s)}{s}$.` });
    mistakes.push({ expr: `(${k * lam})*exp(${b}*t)`, step: 'pf', why: `The partial fractions have a $\\frac{${k * a}}{s}$ term too, which inverts to the constant $${k * a}$.` });
  }
  const b2 = a - lam;
  if (b2 !== 0 && b2 !== b) mistakes.push({ expr: `(${c}/${b2})*(${a}-(${lam})*exp(${b2}*t))`, step: 'solve', why: `Sign slip moving the $F(s)$ term across: it should be $F(s)\\left(1 - \\frac{${lam}}{${Kden}}\\right)$.` });
  return {
    points: 20,
    prompt: `Solve the integral equation $$f(t) = ${c} ${lamTex}${integralTex}$$`,
    vars: ['t'], sample: sampT(0.05, 1.2), hint: 'Enter f(t) in terms of t.',
    answer, answerTex: `f(t) = ${ansTex}`,
    verify: { kind: 'inteq', c, lam, a },
    steps, mistakes,
  };
}

function genDeltaSift() {
  const phis = [
    { tex: 'e^{-t^2}', expr: 'exp(-t^2)' },
    { tex: '\\cos(t)\\,e^{-3t^2}', expr: 'cos(t)*exp(-3*t^2)' },
    { tex: 't^2e^{-t}', expr: 't^2*exp(-t)' },
    { tex: '\\sin(t)\\,e^{-t^2}', expr: 'sin(t)*exp(-t^2)' },
    { tex: '(t^2+1)\\cos(t)', expr: '(t^2+1)*cos(t)' },
  ];
  const as = [
    { tex: '2', shift: 't - 2', expr: '2', v: 2 },
    { tex: '-1', shift: 't + 1', expr: '(-1)', v: -1 },
    { tex: '3', shift: 't - 3', expr: '3', v: 3 },
    { tex: '\\frac{\\pi}{4}', shift: 't - \\frac{\\pi}{4}', expr: '(pi/4)', v: Math.PI / 4 },
    { tex: '\\frac{\\pi}{3}', shift: 't - \\frac{\\pi}{3}', expr: '(pi/3)', v: Math.PI / 3 },
    { tex: '\\pi', shift: 't - \\pi', expr: 'pi', v: Math.PI },
  ];
  let phi, A, val;
  do {
    phi = pick(phis); A = pick(as);
    val = evaluate(parse(phi.expr, ['t']), { t: A.v });
  } while (Math.abs(val) < 1e-6);
  const sub = (e, x) => e.replace(/t/g, x);
  const notation = Math.random() < 0.7;
  return {
    points: 10,
    prompt: notation ? `Evaluate $\\displaystyle\\int_{-\\infty}^{\\infty}\\delta(${A.shift})\\,${phi.tex}\\,dt$.` : `Evaluate $\\delta_{${A.tex}}(\\varphi)$ for the test function $\\varphi(t) = ${phi.tex}$.`,
    vars: [], sample: () => ({}), tol: 5e-4, hint: 'Enter an exact value like e^(-9) or cos(pi/4)e^(-3pi^2/16), or a decimal.',
    answer: sub(phi.expr, A.expr), answerTex: `\\varphi(${A.tex}) = ${phi.tex.replace(/t/g, `\\left(${A.tex}\\right)`)}`,
    verify: { kind: 'sift', phi: phi.expr, a: A.v },
    steps: [
      { key: 'sift', title: 'Sifting property', body: '$\\displaystyle\\int_{-\\infty}^{\\infty}\\delta(t-a)\\,\\varphi(t)\\,dt = \\delta_a(\\varphi) = \\varphi(a)$: the delta picks out the value of $\\varphi$ at the impulse point.' },
      { key: 'point', title: 'Find the impulse point', body: `$\\delta(${A.shift})$ fires where $${A.shift} = 0$, i.e. $t = ${A.tex}$.` },
      { key: 'res', title: 'Evaluate', body: `$$\\varphi(${A.tex}) = ${phi.tex.replace(/t/g, `\\left(${A.tex}\\right)`)} \\approx ${fmtNum(+val.toPrecision(6))}$$` },
    ],
    mistakes: [
      { expr: sub(phi.expr, '0'), step: 'point', why: `$\\delta(${A.shift})$ fires at $t=${A.tex}$, not at $t=0$.` },
      { expr: sub(phi.expr, `(-${A.expr})`), step: 'point', why: `Sign slip: $${A.shift} = 0$ gives $t = ${A.tex}$, not $t = -${A.tex.startsWith('-') ? A.tex.slice(1) : A.tex}$.` },
    ],
  };
}

function genDeltaIVP() {
  const variant = pick(['osc', 'osc', 'real', 'osc-ic']);
  const a = randInt(1, 3);
  const k = nz(-4, 4);
  if (variant === 'real') {
    let [r1, r2] = distinctInts(-3, 2, 2);
    if (r1 < r2) [r1, r2] = [r2, r1];
    const p = -(r1 + r2), q = r1 * r2;
    const coef = new Frac(k, r1 - r2);
    const e1 = r1 === 0 ? '1' : `e^{${r1}(t-${a})}`, e2 = r2 === 0 ? '1' : `e^{${r2}(t-${a})}`;
    const ansTex = `${coef.n < 0 ? '-' : ''}${coef.d === 1 ? (Math.abs(coef.n) === 1 ? '' : Math.abs(coef.n)) : `\\frac{${Math.abs(coef.n)}}{${coef.d}}`}\\,u(t-${a})\\left[${e1} - ${e2}\\right]`;
    const body = (sh1, sh2, step) => `(${k}/${r1 - r2})*${step ? `u(t-${a})*` : ''}(exp(${r1}*(${sh1}))-exp(${r2}*(${sh2})))`;
    return {
      points: 20,
      prompt: `Solve $${odeTex(p, q).replace('= 0', `= ${k === 1 ? '' : k === -1 ? '-' : k}\\delta(t-${a})`)}$, $\\;y(0)=0$, $y'(0)=0$.`,
      vars: ['t'], sample: () => ({ t: rand(0.1, a + 1.5) }), hint: 'Answer in terms of t. Write the unit step as u(t-2).',
      answer: body(`t-${a}`, `t-${a}`, true), answerTex: `y(t) = ${ansTex}`,
      verify: { kind: 'deltaivp', p, q, k, a, y0: 0, v0: 0 },
      steps: [
        { key: 'transform', title: 'Transform', body: `$\\mathcal{L}\\{\\delta(t-${a})\\} = e^{-${a}s}$ and the initial conditions are zero, so $$(${polyTex([1, p, q], 's')})\\,Y(s) = ${k === 1 ? '' : k === -1 ? '-' : k}e^{-${a}s}$$` },
        { key: 'pf', title: 'Solve and split', body: `$$Y(s) = ${k === 1 ? '' : k === -1 ? '-' : k}e^{-${a}s}\\cdot\\frac{1}{(${sh('s', r1)})(${sh('s', r2)})} = ${k === 1 ? '' : k === -1 ? '-' : k}e^{-${a}s}\\cdot\\frac{1}{${r1 - r2}}\\left(\\frac{1}{${sh('s', r1)}} - \\frac{1}{${sh('s', r2)}}\\right)$$` },
        { key: 'invert', title: 'Second shifting theorem', body: `$e^{-${a}s}F(s) \\to u(t-${a})f(t-${a})$ with $f(t) = \\frac{1}{${r1 - r2}}\\left(${exOr1(r1)} - ${exOr1(r2)}\\right)$.` },
        { key: 'res', title: 'Result', body: `$$y(t) = ${ansTex}$$ The solution is 0 until the impulse at $t=${a}$; then $y'$ jumps by $${k}$.` },
      ],
      mistakes: [
        { expr: body('t', 't', true), step: 'invert', why: `Shift the argument as well: $e^{r t}$ becomes $e^{r(t-${a})}$.` },
        { expr: body(`t-${a}`, `t-${a}`, false), step: 'invert', why: `The $e^{-${a}s}$ factor gives a unit step $u(t-${a})$, so nothing happens before $t=${a}$.` },
        { expr: `-(${body(`t-${a}`, `t-${a}`, true)})`, step: 'pf', why: `Partial fractions: $\\frac{1}{(s-r_1)(s-r_2)} = \\frac{1}{r_1-r_2}\\left(\\frac{1}{s-r_1}-\\frac{1}{s-r_2}\\right)$. Check the sign.` },
      ],
    };
  }
  const w = randInt(1, 4);
  const y0 = variant === 'osc-ic' ? nz(-3, 3) : 0;
  const coef = new Frac(k, w);
  const kpart = `${coef.n < 0 ? '-' : ''}${coef.d === 1 ? (Math.abs(coef.n) === 1 ? '' : Math.abs(coef.n)) : `\\frac{${Math.abs(coef.n)}}{${coef.d}}`}\\,u(t-${a})\\sin\\big(${w === 1 ? '' : w}(t-${a})\\big)`;
  const hom = y0 ? `${cf(y0)}\\cos(${kv(w, 't')})` : '';
  const ansTex = hom ? `${hom} ${coef.n < 0 ? '' : '+ '}${kpart}` : kpart;
  const hExpr = y0 ? `(${y0})*cos(${w}*t)+` : '';
  const part = (arg, step, scale = true) => `(${k}${scale ? `/${w}` : ''})*${step ? `u(t-${a})*` : ''}sin(${w}*(${arg}))`;
  const mistakes = [
    { expr: hExpr + part('t', true), step: 'invert', why: `Shift the argument as well: $\\sin(${kv(w, 't')})$ becomes $\\sin\\big(${w === 1 ? '' : w}(t-${a})\\big)$.` },
    { expr: hExpr + part(`t-${a}`, false), step: 'invert', why: `The $e^{-${a}s}$ factor gives a unit step $u(t-${a})$, so the impulse has no effect before $t=${a}$.` },
  ];
  if (w !== 1) mistakes.push({ expr: hExpr + part(`t-${a}`, true, false), step: 'solve', why: `$\\mathcal{L}^{-1}\\left\\{\\frac{1}{s^2+${w * w}}\\right\\} = \\frac{1}{${w}}\\sin(${w}t)$. The $\\frac{1}{${w}}$ is missing.` });
  if (y0) mistakes.push({ expr: part(`t-${a}`, true), step: 'transform', why: `The initial condition $y(0)=${y0}$ adds $${y0}s$ to the transformed equation, which gives the $${cf(y0)}\\cos(${kv(w, 't')})$ term.` });
  return {
    points: 20,
    prompt: `Solve $y'' + ${w * w}y = ${k === 1 ? '' : k === -1 ? '-' : k}\\delta(t-${a})$, $\\;y(0)=${y0}$, $y'(0)=0$.`,
    vars: ['t'], sample: () => ({ t: rand(0.1, a + 2) }), hint: 'Answer in terms of t. Write the unit step as u(t-2).',
    answer: hExpr + part(`t-${a}`, true), answerTex: `y(t) = ${ansTex}`,
    verify: { kind: 'deltaivp', p: 0, q: w * w, k, a, y0, v0: 0 },
    steps: [
      { key: 'transform', title: 'Transform', body: `Use $\\mathcal{L}\\{\\delta(t-${a})\\} = e^{-${a}s}$: $$s^2Y - s\\,y(0) - y'(0) + ${w * w}Y = ${k === 1 ? '' : k === -1 ? '-' : k}e^{-${a}s}$$` },
      { key: 'solve', title: 'Solve for Y(s)', body: `$$Y(s) = ${y0 ? `\\frac{${y0}s}{s^2+${w * w}} + ` : ''}${k === 1 ? '' : k === -1 ? '-' : k}\\frac{e^{-${a}s}}{s^2+${w * w}}$$ and $\\mathcal{L}^{-1}\\left\\{\\frac{1}{s^2+${w * w}}\\right\\} = ${w === 1 ? '' : `\\frac{1}{${w}}`}\\sin(${kv(w, 't')})$.` },
      { key: 'invert', title: 'Second shifting theorem', body: `$e^{-${a}s}F(s) \\to u(t-${a})f(t-${a})$: switch on at $t=${a}$ and replace $t$ by $t-${a}$.` },
      { key: 'res', title: 'Result', body: `$$y(t) = ${ansTex}$$ $y$ stays continuous at $t=${a}$, but $y'$ jumps by $${k}$, the strength of the impulse.` },
    ],
    mistakes,
  };
}

/* ================================================================== */
/* Section 2.1 — Basic concepts                                        */
/* ================================================================== */
const xf = (r) => (r === 0 ? 'x' : `(${sh('x', r)})`);
const NICE = [{ tex: 'e^{x}' }, { tex: '3' }, { tex: '\\cos(x)' }, { tex: '(x^2+1)' }, { tex: '2' }, { tex: 'e^{-x}' }];
function setTex(vals) { return vals.slice().sort((p, q) => p - q).map((v) => fmtNum(v)).join(',\\ '); }

function genSingPts() {
  const n = pick([1, 2, 2, 3]);
  const roots = distinctInts(-4, 4, n).sort((p, q) => p - q);
  const cplx = Math.random() < 0.4 ? randInt(1, 3) : 0;
  const Ptex = roots.map(xf).join('') + (cplx ? `(x^2+${cplx * cplx})` : '');
  const asOde = Math.random() < 0.7;
  const Q = pick(NICE), R = pick(NICE);
  const prompt = asOde
    ? `Find all real singular points of $${Ptex}\\,y'' + ${Q.tex}\\,y' + ${R.tex}\\,y = 0$. Enter them separated by commas.`
    : `Find all real points where $f(x) = \\dfrac{${Q.tex}}{${Ptex}}$ is singular. Enter them separated by commas.`;
  const steps = asOde ? [
    { key: 'std', title: 'Standard form', body: `Divide by $${Ptex}$: $$p(x) = \\frac{${Q.tex}}{${Ptex}},\\qquad q(x) = \\frac{${R.tex}}{${Ptex}}$$` },
    { key: 'roots', title: 'Where can p or q fail to be analytic?', body: `The numerators are analytic everywhere and never cancel a factor of the denominator, so $p$ and $q$ are singular exactly where the denominator vanishes.${cplx ? ` The factor $x^2+${cplx * cplx}$ is never 0 for real $x$; its zeros $\\pm ${cplx === 1 ? '' : cplx}i$ are complex singular points.` : ''}` },
    { key: 'res', title: 'Result', body: `Real singular points: $x = ${setTex(roots)}$. Every other real point is ordinary.` },
  ] : [
    { key: 'std', title: 'Quotients of analytic functions', body: 'The numerator and each factor of the denominator are analytic everywhere, and a quotient is analytic wherever the denominator is nonzero (Theorem 2.2).' },
    { key: 'roots', title: 'Zeros of the denominator', body: `Set each real factor to zero.${cplx ? ` $x^2+${cplx * cplx}$ has no real zeros.` : ''}` },
    { key: 'res', title: 'Result', body: `$f$ is singular at $x = ${setTex(roots)}$ and analytic everywhere else.` },
  ];
  return {
    points: 10, type: 'set', prompt,
    answerSet: roots, answerTex: `x = ${setTex(roots)}`, hint: 'Separate values with commas, e.g. -2, 3.',
    verify: { kind: 'none' },
    steps,
    mistakes: [
      { set: roots.map((r) => -r), step: 'roots', why: 'Sign slip: the factor $(x - r)$ vanishes at $x = r$, so $(x+2)$ gives $x=-2$.' },
    ],
  };
}

function genTaylorCoef() {
  const fn = pick(['exp', 'geo', 'cos', 'sin', 'ln']);
  const k = pick([2, 3, -2, -1, -3]);
  let n;
  if (fn === 'cos') n = pick([2, 4]);
  else if (fn === 'sin') n = pick([3, 5]);
  else n = randInt(2, 4);
  const kn = Math.pow(k, n);
  let val, ftex, dTex, wrongSign = null;
  if (fn === 'exp') { val = new Frac(kn, fact(n)); ftex = `e^{${kv(k, 'x')}}`; dTex = `f^{(${n})}(x) = (${k})^{${n}}e^{${kv(k, 'x')}}`; }
  if (fn === 'geo') { val = new Frac(kn); ftex = `\\dfrac{1}{1 ${k > 0 ? '-' : '+'} ${kv(Math.abs(k), 'x')}}`; dTex = `f^{(${n})}(x) = \\dfrac{${n}!\\,(${k})^{${n}}}{(1 ${k > 0 ? '-' : '+'} ${kv(Math.abs(k), 'x')})^{${n + 1}}}`; }
  if (fn === 'cos') { const sgn = (n / 2) % 2 ? -1 : 1; val = new Frac(sgn * kn, fact(n)); ftex = `\\cos(${kv(k, 'x')})`; dTex = `f^{(${n})}(x) = ${sgn < 0 ? '-' : ''}(${k})^{${n}}\\cos(${kv(k, 'x')})`; wrongSign = val.neg(); }
  if (fn === 'sin') { const sgn = ((n - 1) / 2) % 2 ? -1 : 1; val = new Frac(sgn * kn, fact(n)); ftex = `\\sin(${kv(k, 'x')})`; dTex = `f^{(${n})}(x) = ${sgn < 0 ? '-' : ''}(${k})^{${n}}\\cos(${kv(k, 'x')})`; wrongSign = val.neg(); }
  if (fn === 'ln') { const sgn = n % 2 ? 1 : -1; val = new Frac(sgn * kn, n); ftex = `\\ln(1 ${k > 0 ? '+' : '-'} ${kv(Math.abs(k), 'x')})`; dTex = `f^{(${n})}(x) = \\dfrac{${sgn < 0 ? '-' : ''}(${n - 1})!\\,(${k})^{${n}}}{(1 ${k > 0 ? '+' : '-'} ${kv(Math.abs(k), 'x')})^{${n}}}`; wrongSign = val.neg(); }
  const fn0 = val.mul(new Frac(fact(n)));
  const mistakes = [
    { expr: fn0.expr(), step: 'divide', why: `That's $f^{(${n})}(0)$. The coefficient is $\\frac{f^{(${n})}(0)}{${n}!}$.` },
    { expr: val.mul(new Frac(k, kn)).expr(), step: 'deriv', why: `Each derivative brings out another factor of $${k}$ (chain rule), so you get $(${k})^{${n}}$, not $${k}$.` },
  ];
  if (wrongSign) mistakes.push({ expr: wrongSign.expr(), step: 'deriv', why: 'Sign error: the derivatives cycle in sign, so track the pattern carefully.' });
  return {
    points: 10,
    prompt: `Find the coefficient $a_{${n}}$ of $x^{${n}}$ in the Taylor series of $f(x) = ${ftex}$ about $x_0 = 0$.`,
    vars: [], sample: () => ({}), tol: 5e-4, hint: 'Enter an exact fraction like -4/3, or a decimal.',
    answer: val.expr(), answerTex: `a_{${n}} = ${val.tex()}`,
    verify: { kind: 'taylor', fn, k, n },
    steps: [
      { key: 'formula', title: 'Taylor coefficient formula', body: `$a_n = \\dfrac{f^{(n)}(x_0)}{n!}$ (Theorem 2.1), so you need the ${n}th derivative at 0.` },
      { key: 'deriv', title: `Differentiate ${n} times`, body: `$${dTex}$` },
      { key: 'divide', title: 'Evaluate at 0 and divide by n!', body: `$f^{(${n})}(0) = ${fn0.tex()}$, so $$a_{${n}} = \\frac{${fn0.tex()}}{${n}!} = ${val.tex()}$$` },
    ],
    mistakes,
  };
}

function genRadius() {
  const fam = pick(['A', 'B', 'C', 'D']);
  const x0 = pick([0, 0, 1, -2, 3]);
  const k = pick([2, 3, 4, -2, -3]);
  const center = x0 === 0 ? 'x^n' : `(${sh('x', x0)})^n`;
  const kp = k < 0 ? `(${k})^n` : `${k}^n`;
  let anTex, R, ratioTex;
  if (fam === 'A') { anTex = `\\frac{${kp}}{n+1}`; R = new Frac(1, Math.abs(k)); ratioTex = `\\left|\\frac{a_n}{a_{n+1}}\\right| = \\frac{|${k}|^n}{n+1}\\cdot\\frac{n+2}{|${k}|^{n+1}} = \\frac{n+2}{${Math.abs(k)}(n+1)} \\to \\frac{1}{${Math.abs(k)}}`; }
  if (fam === 'B') { anTex = `\\frac{n+1}{${kp}}`; R = new Frac(Math.abs(k)); ratioTex = `\\left|\\frac{a_n}{a_{n+1}}\\right| = \\frac{n+1}{|${k}|^n}\\cdot\\frac{|${k}|^{n+1}}{n+2} = \\frac{${Math.abs(k)}(n+1)}{n+2} \\to ${Math.abs(k)}`; }
  if (fam === 'C') { anTex = `\\frac{n^2+1}{${kp}}`; R = new Frac(Math.abs(k)); ratioTex = `\\left|\\frac{a_n}{a_{n+1}}\\right| = \\frac{${Math.abs(k)}(n^2+1)}{(n+1)^2+1} \\to ${Math.abs(k)}`; }
  if (fam === 'D') { anTex = `n\\,${kp}`; R = new Frac(1, Math.abs(k)); ratioTex = `\\left|\\frac{a_n}{a_{n+1}}\\right| = \\frac{n}{${Math.abs(k)}(n+1)} \\to \\frac{1}{${Math.abs(k)}}`; }
  const recip = new Frac(R.d, R.n);
  return {
    points: 10,
    prompt: `Find the radius of convergence of $\\displaystyle\\sum_{n=0}^{\\infty} ${anTex}\\,${center}$.`,
    vars: [], sample: () => ({}), tol: 5e-4, hint: 'Enter a number or fraction.',
    answer: R.expr(), answerTex: `R = ${R.tex()}`,
    verify: { kind: 'radius', fam, k },
    steps: [
      { key: 'formula', title: 'Ratio-test formula (Theorem 2.4)', body: '$R = \\displaystyle\\lim_{n\\to\\infty}\\left|\\frac{a_n}{a_{n+1}}\\right|$, with $a_n$ on top. The centre of the series doesn\'t affect $R$.' },
      { key: 'ratio', title: 'Compute the ratio and its limit', body: `With $a_n = ${anTex}$: $$${ratioTex}$$` },
      { key: 'res', title: 'Result', body: `$R = ${R.tex()}$, so the series converges for $|${x0 === 0 ? 'x' : sh('x', x0)}| < ${R.tex()}$.` },
    ],
    mistakes: [
      { expr: recip.expr(), step: 'formula', why: 'That\'s the reciprocal: $\\left|\\frac{a_{n+1}}{a_n}\\right|$ tends to $\\frac{1}{R}$. Put $a_n$ on top to get $R$ itself.' },
    ],
  };
}

/* ================================================================== */
/* Section 2.2 — Solutions about ordinary points                       */
/* ================================================================== */
function genRadiusODE() {
  for (;;) {
    const nReal = pick([0, 1, 1, 2]);
    const reals = nReal ? distinctInts(-4, 5, nReal) : [];
    const hasC = nReal === 0 || Math.random() < 0.6;
    const h = randInt(-2, 2), c = randInt(1, 3);
    const x0 = randInt(-3, 4);
    if (reals.includes(x0)) continue;
    const dists = reals.map((r) => ({ v: Math.abs(x0 - r), expr: String(Math.abs(x0 - r)), tex: String(Math.abs(x0 - r)) }));
    let cd = null;
    if (hasC) {
      const sq = (x0 - h) ** 2 + c * c;
      const root = Math.sqrt(sq);
      cd = Number.isInteger(root) ? { v: root, expr: String(root), tex: String(root) } : { v: root, expr: `sqrt(${sq})`, tex: `\\sqrt{${sq}}` };
      dists.push(cd);
    }
    const best = dists.reduce((m, d) => (d.v < m.v ? d : m));
    const realBest = reals.length ? dists.slice(0, reals.length).reduce((m, d) => (d.v < m.v ? d : m)) : null;
    const worst = dists.reduce((m, d) => (d.v > m.v ? d : m));
    const cTex = hasC ? (h === 0 ? `(x^2+${c * c})` : `\\left((${sh('x', h)})^2+${c * c}\\right)`) : '';
    const Ptex = reals.map(xf).join('') + cTex;
    const Q = pick(NICE), R = pick(NICE);
    const cRoots = hasC ? `${h === 0 ? '' : h}${h === 0 ? '' : ' '}\\pm ${c === 1 ? '' : c}i` : '';
    const mistakes = [];
    if (hasC && realBest && realBest.v > best.v + 1e-9) mistakes.push({ expr: realBest.expr, step: 'cplx', why: `Complex singular points count. $${cRoots}$ is only $${cd.tex}$ from $x_0=${x0}$, closer than any real singular point.` });
    if (worst.v > best.v + 1e-9) mistakes.push({ expr: worst.expr, step: 'min', why: 'The guarantee uses the nearest singular point, the smallest distance, not the farthest.' });
    if (x0 !== 0) {
      const fromOrigin = reals.length ? Math.min(...reals.map(Math.abs)) : null;
      if (fromOrigin != null && Math.abs(fromOrigin - best.v) > 1e-9) mistakes.push({ expr: String(fromOrigin), step: 'dist', why: `Measure distances from the expansion point $x_0 = ${x0}$, not from the origin.` });
    }
    return {
      points: 15,
      prompt: `By Theorem 2.5, a power series solution of $${Ptex}\\,y'' + ${Q.tex}\\,y' + ${R.tex}\\,y = 0$ about $x_0 = ${x0}$ has radius of convergence $R \\ge \\rho$. Find the largest such guaranteed $\\rho$.`,
      vars: [], sample: () => ({}), tol: 1e-4, hint: 'Exact values like sqrt(5) are fine.',
      answer: best.expr, answerTex: `\\rho = ${best.tex}`,
      verify: { kind: 'none' },
      steps: [
        { key: 'sing', title: 'List the singular points', body: `They are the zeros of $${Ptex}$${reals.length ? `: real ones at $x = ${setTex(reals)}$` : ''}${hasC ? `${reals.length ? ', and ' : ': '}complex ones at $x = ${cRoots}$` : ''}.` },
        { key: 'cplx', title: 'Complex singular points count too', body: hasC ? `Distance from $${x0}$ to $${cRoots}$: $\\sqrt{(${x0}-${h === 0 ? 0 : h})^2+${c}^2} = ${cd.tex}$.` : 'There are no complex singular points here.' },
        { key: 'dist', title: 'Distances from x₀', body: `Measured from $x_0=${x0}$: ${dists.map((d) => `$${d.tex}$`).join(', ')}.` },
        { key: 'min', title: 'Take the nearest', body: `$\\rho = ${best.tex}$, so the series converges at least for $|x - ${x0}| < ${best.tex}$.` },
      ],
      mistakes,
    };
  }
}

function genSeriesPoly() {
  let p0, p1, q0, q1, a0, a1, a;
  const coeffs = (sgn, A0 = a0, A1 = a1) => {
    const c = [new Frac(A0), new Frac(A1)];
    for (let n = 0; n + 2 <= 4; n++) {
      let s = new Frac(0);
      s = s.add(new Frac(p0 * (n + 1)).mul(c[n + 1]));
      s = s.add(new Frac(p1 * n + q0).mul(c[n]));
      if (n >= 1) s = s.add(new Frac(q1).mul(c[n - 1]));
      c[n + 2] = s.mul(new Frac(-sgn, (n + 2) * (n + 1)));
    }
    return c;
  };
  do {
    p0 = pick([0, 0, 1, -1, 2]); p1 = pick([0, 1, -1, 2]); q0 = pick([0, 1, -1, 2, -2]); q1 = pick([0, 1, -1]);
    a0 = nz(-2, 3); a1 = nz(-2, 2);
    a = coeffs(1);
  } while ((p0 === 0 && p1 === 0 && q1 === 0) || a.slice(2).some((c) => c.d > 60) || a[4].isZero());
  const pTex = sumTex([{ c: p0, body: '' }, { c: p1, body: 'x' }]);
  const qTex = sumTex([{ c: q0, body: '' }, { c: q1, body: 'x' }]);
  const term = (c, body) => ({ c, body });
  const polyAns = (arr) => sumTex([term(arr[0], ''), term(arr[1], 'x'), term(arr[2], 'x^2'), term(arr[3], 'x^3'), term(arr[4], 'x^4')]);
  const expr = (arr) => arr.map((c, i) => `${c.expr()}*x^${i}`).join('+');
  const yp = pTex === '0' ? '' : (p0 && p1 ? ` + (${pTex})y'` : st(p0 || p1, p1 ? "xy'" : "y'"));
  const yq = qTex === '0' ? '' : (q0 && q1 ? ` + (${qTex})y` : st(q0 || q1, q1 ? 'xy' : 'y'));
  const ode = `y''${yp}${yq} = 0`;
  const wrong = coeffs(-1);
  const recBody = `$$a_{n+2} = -\\frac{${p0 ? `${p0}(n+1)a_{n+1}` : ''}${p0 && (p1 || q0) ? ' + ' : ''}${p1 || q0 ? `(${sumTex([{ c: p1, body: 'n' }, { c: q0, body: '' }])})a_n` : ''}${q1 ? ` ${q1 < 0 ? '-' : '+'} ${Math.abs(q1) === 1 ? '' : Math.abs(q1)}a_{n-1}` : ''}}{(n+2)(n+1)}$$${q1 ? ' with $a_{-1} = 0$.' : ''}`;
  return {
    points: 20,
    prompt: `Find the Taylor polynomial of degree 4 for the solution of $${ode}$, $y(0)=${a0}$, $y'(0)=${a1}$, i.e. $y \\approx a_0 + a_1x + a_2x^2 + a_3x^3 + a_4x^4$.`,
    vars: ['x'], sample: () => ({ x: rand(-1.5, 1.5) }), hint: 'Enter the polynomial in x, e.g. 1 + 2x - x^2/2 + ...',
    answer: expr(a), answerTex: `y \\approx ${polyAns(a)}`,
    verify: { kind: 'seriespoly', p0, p1, q0, q1, a0, a1 },
    steps: [
      { key: 'ics', title: 'First two coefficients', body: `$a_0 = y(0) = ${a0}$ and $a_1 = y'(0) = ${a1}$.` },
      { key: 'sub', title: 'Substitute and match powers of x', body: 'Put $y=\\sum a_nx^n$ into the equation, shift indices so every sum shows $x^n$, and set each coefficient to 0.' },
      { key: 'rec', title: 'Recursion relation', body: recBody },
      { key: 'iter', title: 'Step it', body: `$a_2 = ${a[2].tex()}$, $a_3 = ${a[3].tex()}$, $a_4 = ${a[4].tex()}$.` },
      { key: 'res', title: 'Result', body: `$$y \\approx ${polyAns(a)}$$` },
    ],
    mistakes: [
      { expr: expr(wrong), step: 'rec', why: 'The minus sign in the recursion was lost. Every term moves to the other side when solving for $a_{n+2}$.' },
      { expr: expr([...a.slice(0, 4), new Frac(0)]), step: 'iter', why: 'The $x^4$ term is missing. Apply the recursion once more to get $a_4$.' },
      { expr: expr(coeffs(1, a1, a0)), step: 'ics', why: '$a_0$ comes from $y(0)$ and $a_1$ from $y\'(0)$. They look swapped.' },
    ],
  };
}

/* ================================================================== */
/* Section 2.3 — Regular singular points                               */
/* ================================================================== */
const pw = (c, k) => (k === 0 ? '' : k === 1 ? xf(c) : c === 0 ? `x^{${k}}` : `(${sh('x', c)})^{${k}}`);

function genClassify() {
  const c = randInt(-3, 3);
  let i, j;
  if (Math.random() < 0.15) { i = 0; j = 0; } else { do { i = randInt(0, 2); j = randInt(0, 3); } while (i === 0 && j === 0); }
  const al = nz(-4, 4), be = nz(-4, 4);
  const extra = Math.random() < 0.4 ? (() => { let d; do { d = randInt(-3, 3); } while (d === c); return d; })() : null;
  const m = Math.max(i, j, i === 0 && j === 0 ? 1 : 0);
  // Present: (x-c)^m (x-d) y'' + al (x-c)^{m-i} y' + be (x-c)^{m-j} y = 0  (for ordinary case include (x-c) in all)
  const mi = i === 0 && j === 0 ? m : m - i, mj = i === 0 && j === 0 ? m : m - j;
  const Ptex = `${pw(c, m)}${extra != null ? xf(extra) : ''}` || '';
  const term = (k, p, y) => `${k < 0 ? ' - ' : ' + '}${Math.abs(k) === 1 ? '' : Math.abs(k)}${p}${y}`;
  const ode = `${Ptex}\\,y''${term(al, pw(c, mi), "y'")}${term(be, pw(c, mj), 'y')} = 0`;
  const truth = i === 0 && j === 0 ? 'ord' : i <= 1 && j <= 2 ? 'reg' : 'irr';
  const ex = extra != null ? xf(extra) : '';
  const den = (k) => `${pw(c, k)}${ex}` || '1';
  const pTex = i === 0 && j === 0 ? `\\frac{${al}}{${ex || '1'}}` : `\\frac{${al}}{${den(i)}}`;
  const qTex = i === 0 && j === 0 ? `\\frac{${be}}{${ex || '1'}}` : `\\frac{${be}}{${den(j)}}`;
  const xc = c === 0 ? 'x' : `(${sh('x', c)})`;
  const fr = (k, e) => (e >= 0 ? `\\frac{${k}${pw(c, e)}}{${ex || '1'}}` : `\\frac{${k}}{${den(-e)}}`);
  const xpTex = fr(al, 1 - i), xqTex = fr(be, 2 - j);
  const pBad = i >= 2, qBad = j >= 3;
  const reasons = {
    ord: 'Both $p$ and $q$ are analytic at $x_0$ (no factor of $x - x_0$ left in a denominator), so $x_0$ is an ordinary point.',
    reg: `$x_0$ is singular, but $${xc}p(x)$ and $${xc}^2q(x)$ are both analytic there, so it is a regular singular point.`,
    irr: `${pBad ? `$${xc}p(x) = ${xpTex}$ still blows up at $x_0$` : ''}${pBad && qBad ? ', and ' : ''}${qBad ? `$${xc}^2q(x) = ${xqTex}$ still blows up at $x_0$` : ''}, so $x_0$ is an irregular singular point.`,
  };
  const label = { ord: 'Ordinary point', reg: 'Regular singular point', irr: 'Irregular singular point' };
  const options = ['ord', 'reg', 'irr'].map((key) => ({
    tex: label[key], correct: key === truth,
    why: key === truth ? '' : `You chose "${label[key].toLowerCase()}". ${reasons[truth]}`,
    step: key === 'ord' || truth === 'ord' ? 'std' : 'test',
  }));
  return {
    points: 10, type: 'choice',
    prompt: `Classify the point $x_0 = ${c}$ for the equation $$${ode}$$`,
    options, answerTex: label[truth], hint: 'Pick one.',
    verify: { kind: 'none' },
    steps: [
      { key: 'std', title: 'Standard form', body: `Divide by the coefficient of $y''$: $$p(x) = ${pTex},\\qquad q(x) = ${qTex}$$ ${truth === 'ord' ? 'Neither has a factor that vanishes at $x_0$, so both are analytic there.' : `At least one of them blows up at $x_0=${c}$, so $x_0$ is a singular point.`}` },
      { key: 'test', title: 'Regular-singular test', body: truth === 'ord' ? 'Not needed, since the point is ordinary.' : `$$${xc}\\,p(x) = ${xpTex},\\qquad ${xc}^2q(x) = ${xqTex}$$ ${truth === 'reg' ? 'Both are analytic at $x_0$.' : 'At least one is still singular at $x_0$.'}` },
      { key: 'res', title: 'Conclusion', body: reasons[truth] },
    ],
    mistakes: [],
  };
}

function genEulerCases() {
  const kind = pick(['distinct', 'repeated', 'complex']);
  if (kind === 'distinct') { const q = genCauchyEuler(); q.points = 20; return q; }
  if (kind === 'repeated') {
    const r = pick([-2, -1, 1, 2, 3]);
    const b = 1 - 2 * r, c = r * r;
    const C1 = nz(-3, 3), C2 = nz(-3, 3);
    const y1 = C1, v1 = r * C1 + C2;
    const ode = `x^2y''${st(b, "xy'")}${st(c, 'y')} = 0`;
    const xr = r === 1 ? 'x' : `x^{${r}}`;
    const inner = sumTex([{ c: C1, body: '' }, { c: C2, body: '\\ln x' }]);
    const ansTex = `${xr}\\left(${inner}\\right)`;
    return {
      points: 20,
      prompt: `Solve the Euler equation $${ode}$, $x>0$, with $y(1)=${y1}$, $y'(1)=${v1}$.`,
      vars: ['x'], sample: () => ({ x: rand(0.3, 3) }), hint: 'Enter y(x). Use ln(x) for the natural log.',
      answer: `x^(${r})*(${C1}+(${C2})*ln(x))`, answerTex: `y = ${ansTex}`,
      verify: { kind: 'ce', al: b, be: c, y1, v1 },
      steps: [
        { key: 'indicial', title: 'Indicial equation', body: `$y=x^r$ gives $$r(r-1)${st(b, 'r')}${st(c, '')} = ${polyTex([1, b - 1, c], 'r')} = (${sh('r', r)})^2 = 0$$` },
        { key: 'case', title: 'Repeated root', body: `$r=${r}$ is a double root, so the second solution needs a log: $$y = x^{${r}}\\big(C_1 + C_2\\ln x\\big)$$` },
        { key: 'ics', title: 'Apply the conditions at x = 1', body: `$y(1) = C_1 = ${y1}$. $y'(x) = ${r}x^{${r - 1}}(C_1 + C_2\\ln x) + C_2x^{${r - 1}}$, so $y'(1) = ${r}C_1 + C_2 = ${v1}$, giving $C_2 = ${C2}$.` },
        { key: 'res', title: 'Result', body: `$$y = ${ansTex}$$` },
      ],
      mistakes: [
        { expr: `${y1}*x^(${r})`, step: 'case', why: 'With a repeated root, $x^r$ alone gives only one solution. The second is $x^r\\ln x$.' },
        { expr: `x^(${r})*(${C1}+(${v1})*ln(x))`, step: 'ics', why: `$y'(1) = ${r}C_1 + C_2$; the derivative of $x^{${r}}$ contributes too. So $C_2 = ${v1} - (${r * C1})$.` },
      ],
    };
  }
  const lam = pick([-1, 0, 1, 2]), mu = randInt(1, 3);
  const b = 1 - 2 * lam, c = lam * lam + mu * mu;
  const C1 = nz(-3, 3), C2 = nz(-3, 3);
  const y1 = C1, v1 = lam * C1 + mu * C2;
  const ode = `x^2y''${st(b, "xy'")}${st(c, 'y')} = 0`;
  const lnArg = `${mu === 1 ? '' : mu}\\ln x`;
  const inner = sumTex([{ c: C1, body: `\\cos(${lnArg})` }, { c: C2, body: `\\sin(${lnArg})` }]);
  const pre = lam === 0 ? '' : lam === 1 ? 'x' : `x^{${lam}}`;
  const ansTex = pre ? `${pre}\\left(${inner}\\right)` : inner;
  const ans = (A, B, arg = `${mu}*ln(x)`) => `x^(${lam})*((${A})*cos(${arg})+(${B})*sin(${arg}))`;
  const mistakes = [
    { expr: ans(C1, C2, `${mu}*x`), step: 'case', why: 'For Euler equations the oscillation is in $\\ln x$: $x^{i\\mu} = e^{i\\mu\\ln x}$, giving $\\cos(\\mu\\ln x)$, not $\\cos(\\mu x)$.' },
    { expr: ans(C2, C1), step: 'ics', why: '$y(1) = C_1$ picks the cosine coefficient, since $\\cos(0)=1$ and $\\sin(0)=0$. The constants look swapped.' },
  ];
  if (lam !== 0 || mu !== 1) mistakes.push({ expr: ans(C1, v1), step: 'ics', why: `$y'(1) = ${lam}C_1 + ${mu}C_2$, so $C_2 = \\frac{${v1} - (${lam * C1})}{${mu}}$.` });
  return {
    points: 25,
    prompt: `Solve the Euler equation $${ode}$, $x>0$, with $y(1)=${y1}$, $y'(1)=${v1}$.`,
    vars: ['x'], sample: () => ({ x: rand(0.3, 3) }), hint: 'Enter y(x). Use ln(x) for the natural log.',
    answer: ans(C1, C2), answerTex: `y = ${ansTex}`,
    verify: { kind: 'ce', al: b, be: c, y1, v1 },
    steps: [
      { key: 'indicial', title: 'Indicial equation', body: `$y=x^r$ gives $$r(r-1)${st(b, 'r')}${st(c, '')} = ${polyTex([1, b - 1, c], 'r')} = 0 \\;\\Rightarrow\\; r = ${lam === 0 ? '' : lam}\\pm ${mu === 1 ? '' : mu}i$$` },
      { key: 'case', title: 'Complex roots λ ± iμ', body: `$y = x^{\\lambda}\\big(C_1\\cos(\\mu\\ln x) + C_2\\sin(\\mu\\ln x)\\big)$ with $\\lambda = ${lam}$, $\\mu = ${mu}$.` },
      { key: 'ics', title: 'Apply the conditions at x = 1', body: `At $x=1$, $\\ln 1 = 0$: $y(1) = C_1 = ${y1}$ and $y'(1) = ${lam}C_1 + ${mu}C_2 = ${v1}$, so $C_2 = ${C2}$.` },
      { key: 'res', title: 'Result', body: `$$y = ${ansTex}$$` },
    ],
    mistakes,
  };
}

// Frobenius family: A x^2 y'' + x(B0 + B1 x) y' + (C0 + C1 x) y = 0 with chosen indicial roots
function frobODE(caseKind) {
  let A, r1, r2; // r as Frac
  if (caseKind === 'i') { A = 2; const ri = randInt(-1, 2); const m = pick([-3, -1, 1, 3]); r1 = new Frac(ri); r2 = new Frac(m, 2); }
  else if (caseKind === 'ii') { A = 1; const r = randInt(-1, 2); r1 = new Frac(r); r2 = new Frac(r); }
  else { A = pick([1, 2]); const r = randInt(-1, 2), N = randInt(1, 3); r1 = new Frac(r); r2 = new Frac(r - N); }
  if (r1.n * r2.d < r2.n * r1.d) [r1, r2] = [r2, r1];
  const sum = r1.add(r2), prod = r1.mul(r2);
  const B0 = A - A * sum.n / sum.d, C0 = A * prod.n / prod.d;
  return { A, r1, r2, B0, C0 };
}
function frobTex({ A, B0, B1, C0, C1 }) {
  const yp = [B1, B0].filter((v) => v !== 0).length === 2 ? ` + (${polyTex([B1, B0, 0], 'x')})y'` : B1 ? st(B1, "x^2y'") : B0 ? st(B0, "xy'") : '';
  const yy = C0 && C1 ? ` + (${polyTex([C1, C0], 'x')})y` : C1 ? st(C1, 'xy') : C0 ? st(C0, 'y') : '';
  return `${A === 1 ? '' : A}x^2y''${yp}${yy} = 0`;
}

function genIndicial() {
  const F = frobODE(pick(['i', 'ii', 'iii']));
  const B1 = pick([0, 1, -1, 2]), C1 = nz(-2, 2);
  const ode = frobTex({ ...F, B1, C1 });
  const p0 = new Frac(F.B0, F.A), q0 = new Frac(F.C0, F.A);
  const vals = [F.r1.n / F.r1.d, F.r2.n / F.r2.d];
  // mistake: forgot the -1 in r^2 + (p0-1) r + q0
  const pv = p0.n / p0.d, qv = q0.n / q0.d, disc = pv * pv - 4 * qv;
  const mistakes = [{ set: vals.map((v) => -v), step: 'roots', why: 'Sign slip when reading off the roots from the factored indicial equation.' }];
  if (disc >= 0) mistakes.push({ set: [(-pv + Math.sqrt(disc)) / 2, (-pv - Math.sqrt(disc)) / 2], step: 'indicial', why: 'The indicial equation is $r^2 + (p_0 - 1)r + q_0 = 0$. The $-1$ comes from $r(r-1)$ in $x^2y\'\'$.' });
  const rTex = (r) => r.tex();
  const same = F.r1.eq(F.r2);
  return {
    points: 15, type: 'set',
    prompt: `$x_0 = 0$ is a regular singular point of $$${ode}$$ Find the indicial roots.`,
    answerSet: vals, answerTex: same ? `r_1 = r_2 = ${rTex(F.r1)}` : `r_1 = ${rTex(F.r1)},\\ r_2 = ${rTex(F.r2)}`, hint: 'Enter both roots separated by a comma (repeat a double root, or enter it once).',
    verify: { kind: 'indicial', A: F.A, B0: F.B0, C0: F.C0, roots: vals },
    allowSingleForDouble: same,
    steps: [
      { key: 'p0', title: 'Find p₀ and q₀', body: `Standard form gives $xp(x) = \\frac{${F.B0}${B1 ? st(B1, 'x') : ''}}{${F.A}}$ and $x^2q(x) = \\frac{${F.C0}${st(C1, 'x')}}{${F.A}}$. Their values at $0$: $p_0 = ${p0.tex()}$, $q_0 = ${q0.tex()}$.` },
      { key: 'indicial', title: 'Indicial equation', body: `$$r^2 + (p_0 - 1)r + q_0 = ${sumTex([{ c: new Frac(1), body: 'r^2' }, { c: new Frac(p0.n - p0.d, p0.d), body: 'r' }, { c: q0, body: '' }])} = 0$$` },
      { key: 'roots', title: 'Solve', body: `$r_1 = ${rTex(F.r1)}$, $r_2 = ${rTex(F.r2)}$ (with $r_1 \\ge r_2$). Then $r_1 - r_2 = ${F.r1.add(F.r2.neg()).tex()}$ decides the Frobenius case.` },
    ],
    mistakes,
  };
}

function genFrobCase() {
  const kind = pick(['i', 'ii', 'iii']);
  const F = frobODE(kind);
  const B1 = pick([0, 1, -1]), C1 = nz(-2, 2);
  const ode = frobTex({ ...F, B1, C1 });
  const diff = F.r1.add(F.r2.neg());
  const opts = {
    i: 'Case (i): $y_2 = \\sum b_n x^{n+r_2}$, a second plain Frobenius series',
    ii: 'Case (ii): $y_2 = y_1\\ln x + \\sum_{n\\ge1} b_n x^{n+r_1}$',
    iii: 'Case (iii): $y_2 = A\\,y_1\\ln x + \\sum b_n x^{n+r_2}$',
  };
  const whyFor = {
    i: `Case (i) needs $r_1 - r_2$ not to be an integer, but here $r_1 - r_2 = ${diff.tex()}$.`,
    ii: `Case (ii) needs equal roots, but here $r_1 - r_2 = ${diff.tex()}$.`,
    iii: `Case (iii) needs $r_1 - r_2$ to be a positive integer, but here $r_1 - r_2 = ${diff.tex()}$.`,
  };
  return {
    points: 15, type: 'choice',
    prompt: `For $$${ode}$$ about the regular singular point $x_0 = 0$, which form does the second solution $y_2$ take (Theorem 2.7)?`,
    options: ['i', 'ii', 'iii'].map((k) => ({ tex: opts[k], correct: k === kind, why: whyFor[k], step: 'case' })),
    answerTex: opts[kind], hint: 'Find the indicial roots first.',
    verify: { kind: 'none' },
    steps: [
      { key: 'p0', title: 'Indicial equation', body: `$p_0 = ${new Frac(F.B0, F.A).tex()}$, $q_0 = ${new Frac(F.C0, F.A).tex()}$, so $r^2 + (p_0-1)r + q_0 = 0$.` },
      { key: 'roots', title: 'Roots', body: `$r_1 = ${F.r1.tex()}$, $r_2 = ${F.r2.tex()}$, so $r_1 - r_2 = ${diff.tex()}$.` },
      { key: 'case', title: 'Pick the case', body: `${kind === 'i' ? 'Not an integer, so case (i): two independent Frobenius series.' : kind === 'ii' ? 'Equal roots, so case (ii): the second solution carries $y_1 \\ln x$.' : 'A positive integer, so case (iii): the second solution may carry $A\\,y_1\\ln x$ (A can turn out to be 0).'}` },
    ],
    mistakes: [],
  };
}

function genFrobCoef() {
  let F, B1, C1, a, target;
  do {
    F = frobODE(pick(['i', 'ii', 'iii']));
    B1 = pick([0, 1, -1, 2]); C1 = nz(-2, 2); target = pick([1, 2]);
    a = [new Frac(1)];
    for (let n = 1; n <= 2; n++) {
      const num = new Frac(B1).mul(new Frac(n - 1).add(F.r1)).add(new Frac(C1));
      const den = new Frac(F.A * n).mul(new Frac(n).add(F.r1).add(F.r2.neg()));
      a[n] = num.neg().mul(new Frac(den.d, den.n)).mul(a[n - 1]);
    }
  } while (a[target].isZero() || a[target].d > 400);
  const ode = frobTex({ ...F, B1, C1 });
  const r1 = F.r1;
  const val = a[target];
  const mistakes = [
    { expr: val.neg().expr(), step: 'rec', why: 'Sign slip: solving for $a_n$ moves the $a_{n-1}$ term to the other side, which makes it negative.' },
  ];
  if (target === 2) mistakes.push({ expr: a[1].expr(), step: 'iter', why: 'That\'s $a_1$. Apply the recursion once more for $a_2$.' });
  const diff = F.r1.add(F.r2.neg());
  const numT = sumTex([{ c: B1, body: '(n-1+r)' }, { c: C1, body: '' }]);
  const recTex = `a_n = -\\frac{${numT}}{F(n+r)}\\,a_{n-1},\\quad F(\\rho) = ${F.A === 1 ? '' : F.A}(\\rho - r_1)(\\rho - r_2)$$ With $r = r_1$: $F(n+r_1) = ${F.A === 1 ? '' : F.A}n(n + ${diff.tex()})$, so $$a_n = -\\frac{${sumTex([{ c: B1, body: `(n-1${r1.n === 0 ? '' : (r1.n < 0 ? ' - ' : ' + ') + new Frac(Math.abs(r1.n), r1.d).tex()})` }, { c: C1, body: '' }])}}{${F.A === 1 ? '' : F.A}n(n + ${diff.tex()})}\\,a_{n-1}`;
  return {
    points: 20,
    prompt: `For $$${ode}$$ the larger indicial root is $r_1 = ${r1.tex()}$. With $y_1 = \\sum_{n\\ge0} a_n x^{n+r_1}$ and $a_0 = 1$, find $a_{${target}}$.`,
    vars: [], sample: () => ({}), tol: 5e-4, hint: 'Enter an exact fraction.',
    answer: val.expr(), answerTex: `a_{${target}} = ${val.tex()}`,
    verify: { kind: 'frobcoef', A: F.A, B0: F.B0, B1, C0: F.C0, C1, r1: r1.n / r1.d, target },
    steps: [
      { key: 'sub', title: 'Substitute the Frobenius series', body: '$y=\\sum a_nx^{n+r}$. The $x^2y\'\'$, $xy\'$ and constant terms keep the power $x^{n+r}$; terms with an extra $x$ are shifted $n \\to n-1$.' },
      { key: 'rec', title: 'Recursion relation (n ≥ 1)', body: `$$${recTex}$$ The denominator is the indicial polynomial evaluated at $n+r$.` },
      { key: 'iter', title: `Use r = r₁ = ${r1.tex()}`, body: `$a_1 = ${a[1].tex()}$${target === 2 ? `, $a_2 = ${a[2].tex()}$` : ''}.` },
    ],
    mistakes,
  };
}

function genBessel() {
  const nus = [
    { tex: '1', sq: '1', int: true, v: 1 }, { tex: '2', sq: '4', int: true, v: 2 }, { tex: '3', sq: '9', int: true, v: 3 },
    { tex: '\\frac{1}{2}', sq: '\\frac{1}{4}', int: false, v: 0.5 }, { tex: '\\frac{3}{2}', sq: '\\frac{9}{4}', int: false, v: 1.5 },
    { tex: '\\frac{1}{3}', sq: '\\frac{1}{9}', int: false, v: 1 / 3 }, { tex: '\\sqrt{2}', sq: '2', int: false, v: Math.SQRT2 },
    { tex: '\\sqrt{5}', sq: '5', int: false, v: Math.sqrt(5) }, { tex: '0', sq: '0', int: true, v: 0 },
  ];
  const nu = pick(nus), lam = pick([1, 2, 3, 4]);
  const L2 = lam * lam;
  const inner = nu.sq === '0' ? `${L2 === 1 ? '' : L2}x^2` : `${L2 === 1 ? '' : L2}x^2 - ${nu.sq}`;
  const ode = `x^2y'' + xy' + \\left(${inner}\\right)y = 0`;
  const arg = `${lam === 1 ? '' : lam}x`;
  const J = (o, a) => `J_{${o}}(${a})`;
  const correct = nu.int ? `y = c_1${J(nu.tex, arg)} + c_2Y_{${nu.tex}}(${arg})` : `y = c_1${J(nu.tex, arg)} + c_2${J(`-${nu.tex}`, arg)}`;
  const opts = [{ tex: `$${correct}$`, correct: true, why: '', step: 'thm' }];
  const add = (t, why, step) => { if (!opts.some((o) => o.tex === `$${t}$`)) opts.push({ tex: `$${t}$`, correct: false, why, step }); };
  if (nu.int && nu.v > 0) add(`y = c_1${J(nu.tex, arg)} + c_2${J(`-${nu.tex}`, arg)}`, `For integer $\\nu$, $J_{-\\nu}$ is a multiple of $J_\\nu$, so it doesn't give a second independent solution. Use $Y_{${nu.tex}}$.`, 'thm');
  if (nu.sq !== nu.tex) add(nu.int ? `y = c_1${J(nu.sq, arg)} + c_2Y_{${nu.sq}}(${arg})` : `y = c_1${J(nu.sq, arg)} + c_2${J(`-${nu.sq}`, arg)}`, `The constant term is $\\nu^2 = ${nu.sq}$, so the order is $\\nu = ${nu.tex}$, not $${nu.sq}$.`, 'read');
  if (lam !== 1) add(nu.int ? `y = c_1${J(nu.tex, `${L2}x`)} + c_2Y_{${nu.tex}}(${L2}x)` : `y = c_1${J(nu.tex, `${L2}x`)} + c_2${J(`-${nu.tex}`, `${L2}x`)}`, `The coefficient of $x^2$ is $\\lambda^2 = ${L2}$, so the argument is $\\lambda x = ${arg}$, not $${L2}x$.`, 'read');
  add(nu.v === 0 ? `y = c_1 + c_2\\ln x` : `y = c_1x^{${nu.tex}} + c_2x^{-${nu.tex}}`, 'That solves the Euler equation you get by dropping the $\\lambda^2x^2$ term. Here that term makes it a Bessel equation.', 'read');
  add(`y = c_1${J(nu.tex, arg)}`, 'A second-order equation needs two independent solutions in its general solution.', 'thm');
  return {
    points: 15, type: 'choice',
    prompt: `Which is the general solution of $$${ode},\\quad x>0?$$`,
    options: opts, answerTex: `$${correct}$`, hint: 'Match it to Bessel\'s equation with parameter λ.',
    verify: { kind: 'none' },
    steps: [
      { key: 'read', title: 'Match the standard form', body: `Compare with $x^2y''+xy'+(\\lambda^2x^2-\\nu^2)y=0$: $\\lambda^2 = ${L2}$ so $\\lambda = ${lam}$, and $\\nu^2 = ${nu.sq}$ so $\\nu = ${nu.tex}$.` },
      { key: 'thm', title: 'Theorem 2.8', body: nu.int ? `$\\nu = ${nu.tex}$ is an integer, so $J_{-\\nu}$ is not independent of $J_\\nu$. Use $y_2 = Y_{${nu.tex}}(${arg})$.` : `$\\nu = ${nu.tex}$ is not an integer, so $J_{${nu.tex}}(${arg})$ and $J_{-${nu.tex}}(${arg})$ are independent. ($Y_{${nu.tex}}$ would also work.)` },
      { key: 'res', title: 'General solution', body: `$$${correct}$$` },
    ],
    mistakes: [],
  };
}

/* ================================================================== */
/* SYSC 3600 — electromechanical modelling, Laplace, PFE               */
/* ================================================================== */
const rnd = (v) => Math.round(v * 1e9) / 1e9;
const nf = (v) => fmtNum(rnd(v));
// linear factor "(a s + b)" with numbers
const linS = (a, b) => `${a === 1 ? '' : nf(a)}s + ${nf(b)}`;

function motorParams() {
  const R = pick([1, 2, 4, 5]), L = pick([0.5, 1, 2]), J = pick([0.5, 1, 2]), b = pick([0.1, 0.2, 0.5, 1]);
  const K = pick([0.5, 1, 2]);
  const Kb = Math.random() < 0.6 ? K : pick([0.5, 1, 2].filter((v) => v !== K));
  return { R, L, J, b, K, Kb };
}

function genMotorTF() {
  const variant = pick(['omega', 'omega', 'theta', 'current']);
  if (variant === 'field') {
    const Rf = pick([1, 2, 5]), Lf = pick([0.5, 1, 2]), J = pick([0.5, 1, 2]), b = pick([0.1, 0.5, 1]), Kf = pick([0.5, 1, 2, 3]);
    const den = `s(${linS(Lf, Rf)})(${linS(J, b)})`;
    const ansTex = `\\frac{\\Theta(s)}{E_f(s)} = \\frac{${nf(Kf)}}{${den}}`;
    return {
      points: 20,
      prompt: `A field-controlled DC motor has field resistance $R_f = ${nf(Rf)}\\,\\Omega$, field inductance $L_f = ${nf(Lf)}$ H and torque constant $K_f = ${nf(Kf)}$ N·m/A (armature current held constant). The rotor and load have $J = ${nf(J)}$ kg·m² and $b = ${nf(b)}$ N·m·s/rad. Find $\\dfrac{\\Theta(s)}{E_f(s)}$.`,
      vars: ['s'], sample: () => ({ s: rand(0.5, 6) }), hint: 'Answer in terms of s.',
      answer: `${Kf}/(s*(${Lf}*s+${Rf})*(${J}*s+${b}))`, answerTex: ansTex,
      verify: { kind: 'motor', variant, Rf, Lf, J, b, Kf },
      steps: [
        { key: 'eqs', title: 'Write the two equations', body: `Field circuit: $L_f\\dfrac{di_f}{dt} + R_fi_f = e_f$. Torque: $T = K_fi_f$. Shaft: $J\\ddot\\theta + b\\dot\\theta = T$. The armature current is constant, so there is no back-emf coupling.` },
        { key: 'lap', title: 'Transform (zero initial conditions)', body: `$(L_fs + R_f)I_f = E_f$ and $s(Js + b)\\Theta = K_fI_f$.` },
        { key: 'elim', title: 'Eliminate I_f', body: `$$\\frac{\\Theta(s)}{E_f(s)} = \\frac{K_f}{s(L_fs+R_f)(Js+b)}$$` },
        { key: 'res', title: 'Plug in the numbers', body: `$$${ansTex}$$` },
      ],
      mistakes: [
        { expr: `${Kf}/((${Lf}*s+${Rf})*(${J}*s+${b}))`, step: 'lap', why: 'That is $\\Omega(s)/E_f(s)$. Position is the integral of speed, so $\\Theta = \\Omega/s$: one more factor of $s$ in the denominator.' },
        { expr: `${Kf}*s/((${Lf}*s+${Rf})*(${J}*s+${b}))`, step: 'lap', why: '$\\Theta = \\Omega/s$, so divide by $s$, don\'t multiply.' },
      ],
    };
  }
  const { R, L, J, b, K, Kb } = motorParams();
  const a2 = rnd(L * J), a1 = rnd(L * b + R * J), a0 = rnd(R * b + K * Kb);
  const denE = `((${L}*s+${R})*(${J}*s+${b})+${rnd(K * Kb)})`;
  const denTex = `(${linS(L, R)})(${linS(J, b)}) + ${nf(K * Kb)}`;
  const expTex = `${nf(a2) === '1' ? '' : nf(a2)}s^2 + ${nf(a1)}s + ${nf(a0)}`;
  let ans, lhs, ansTex, numTex;
  if (variant === 'omega') { ans = `${K}/${denE}`; lhs = '\\frac{\\Omega(s)}{V(s)}'; numTex = nf(K); }
  else if (variant === 'theta') { ans = `${K}/(s*${denE})`; lhs = '\\frac{\\Theta(s)}{V(s)}'; numTex = nf(K); }
  else { ans = `(${J}*s+${b})/${denE}`; lhs = '\\frac{I(s)}{V(s)}'; numTex = linS(J, b); }
  const sOut = variant === 'theta' ? 's' : '';
  ansTex = `${lhs} = \\frac{${numTex}}{${sOut}(${expTex})}`.replace('{(', '{(').replace(`{${''}(${expTex})}`, `{${expTex}}`);
  const mistakes = [
    { expr: ans.replace(`+${rnd(K * Kb)})`, ')'), step: 'emf', why: `The back emf is missing. $e_m = k_m\\omega$ feeds back into the armature circuit and adds $k_tk_m = ${nf(K * Kb)}$ to the denominator.` },
    { expr: ans.replace(`+${rnd(K * Kb)})`, `-${rnd(K * Kb)})`), step: 'emf', why: 'Sign of the back emf: $V = Ri + L\\frac{di}{dt} + e_m$, so it opposes the applied voltage and the $k_tk_m$ term is added.' },
  ];
  if (variant === 'omega') mistakes.push({ expr: `${K}/(s*${denE})`, step: 'elim', why: 'That is $\\Theta(s)/V(s)$. Speed is $\\Omega(s)$, with no extra $\\frac1s$.' });
  if (variant === 'theta') mistakes.push({ expr: `${K}/${denE}`, step: 'elim', why: 'That is the speed transfer function. Position $\\Theta = \\Omega/s$ needs an extra $\\frac1s$.' });
  if (variant === 'current') mistakes.push({ expr: `${K}/${denE}`, step: 'elim', why: 'That is $\\Omega/V$. For the current, solve the mechanical equation for $\\Omega = \\frac{K I}{Js+b}$ and substitute into the circuit equation instead.' });
  if (K !== Kb) mistakes.push({ expr: ans.replace(`+${rnd(K * Kb)})`, `+${rnd(K * K)})`), step: 'emf', why: `The coupling term is $k_t\\cdot k_m = ${nf(K)}\\cdot${nf(Kb)}$, one torque constant and one back-emf constant.` });
  const what = { omega: 'the speed transfer function $\\dfrac{\\Omega(s)}{V(s)}$', theta: 'the position transfer function $\\dfrac{\\Theta(s)}{V(s)}$', current: '$\\dfrac{I(s)}{V(s)}$' }[variant];
  return {
    points: 20,
    prompt: `A DC motor has $R = ${nf(R)}\\,\\Omega$, armature inductance $L = ${nf(L)}$ H (include it), torque constant $k_t = ${nf(K)}$ N·m/A and back-emf constant $k_m = ${nf(Kb)}$ V·s/rad. It drives $J = ${nf(J)}$ kg·m² with viscous friction $b = ${nf(b)}$ N·m·s/rad. Find ${what}.`,
    vars: ['s'], sample: () => ({ s: rand(0.5, 6) }), hint: 'Answer in terms of s. Factored or expanded both work.',
    answer: ans, answerTex: ansTex,
    verify: { kind: 'motor', variant, R, L, J, b, K, Kb },
    steps: [
      { key: 'eqs', title: 'Write the coupled equations', body: 'Circuit (KVL): $L\\dfrac{di}{dt} + Ri + e_m = V$ with back emf $e_m = k_m\\omega$. Torque: $\\tau = k_ti$. Shaft: $J\\dot\\omega + b\\omega = \\tau$.' },
      { key: 'emf', title: 'Transform (zero initial conditions)', body: '$$(Ls + R)I(s) = V(s) - k_m\\Omega(s), \\qquad (Js + b)\\Omega(s) = k_tI(s)$$' },
      { key: 'elim', title: 'Eliminate the other variable', body: `${variant === 'current' ? 'Substitute $\\Omega = \\frac{k_tI}{Js+b}$ into the circuit equation: $$\\frac{I}{V} = \\frac{Js+b}{(Ls+R)(Js+b) + k_tk_m}$$' : `Substitute $I = \\frac{(Js+b)\\Omega}{K}$: $$\\frac{\\Omega}{V} = \\frac{k_t}{(Ls+R)(Js+b) + k_tk_m}$$${variant === 'theta' ? ' and $\\Theta = \\Omega/s$.' : ''}`}` },
      { key: 'res', title: 'Plug in the numbers', body: `$$${lhs} = \\frac{${numTex}}{${sOut}\\left[${denTex}\\right]} = ${ansTex.split(' = ')[1]}$$` },
    ],
    mistakes,
  };
}

function genMotorFirst() {
  const { R, J, b, K, Kb } = motorParams();
  const D = rnd(R * b + K * Kb);
  const tau = rnd(R * J / D), Km = rnd(K / D);
  const V = pick([6, 10, 12, 24]);
  const variant = pick(['tau', 'wss', 'tf', 'wt']);
  const intro = `A DC motor has $R = ${nf(R)}\\,\\Omega$, negligible inductance ($i = (V - e_m)/R$), $k_t = ${nf(K)}$ N·m/A, $k_m = ${nf(Kb)}$ V·s/rad, $J = ${nf(J)}$ kg·m² and $b = ${nf(b)}$ N·m·s/rad.`;
  const base = [
    { key: 'model', title: 'No inductance', body: 'With no inductance the circuit is algebraic: $i = \\dfrac{V - e_m}{R}$ with $e_m = k_m\\omega$, and the torque is $\\tau = k_ti$.' },
    { key: 'sub', title: 'Substitute into the shaft equation', body: `$$J\\dot\\omega + b\\omega = \\frac{k_t}{R}(V - k_m\\omega) \\;\\Rightarrow\\; RJ\\,\\dot\\omega + (Rb + k_tk_m)\\,\\omega = k_tV$$ Here $Rb + k_tk_m = ${nf(R * b)} + ${nf(K * Kb)} = ${nf(D)}$.` },
    { key: 'std', title: 'Standard first-order form', body: `$$\\frac{\\Omega(s)}{V(s)} = \\frac{G_0}{\\tau_m s + 1},\\quad G_0 = \\frac{k_t}{Rb+k_tk_m} = ${nf(Km)},\\quad \\tau_m = \\frac{RJ}{Rb+k_tk_m} = ${nf(tau)}\\text{ s}$$` },
  ];
  const noEmfTau = rnd(J / b), noEmfW = rnd(V * K / (R * b));
  if (variant === 'tau') return {
    points: 15, prompt: `${intro} Find the mechanical time constant $\\tau_m$ (in seconds).`,
    vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter a number.',
    answer: String(tau), answerTex: `\\tau_m = ${nf(tau)}\\text{ s}`,
    verify: { kind: 'motor1', what: 'tau', R, J, b, K, Kb },
    steps: base,
    mistakes: [
      { expr: String(noEmfTau), step: 'sub', why: `$J/b$ ignores the back emf. Back emf acts like extra damping $\\frac{k_tk_m}{R}$, so $\\tau_m = \\frac{RJ}{Rb+k_tk_m}$.` },
      { expr: String(rnd(1 / tau)), step: 'std', why: `That is $1/\\tau_m$, the pole magnitude. The time constant is its reciprocal.` },
    ],
  };
  if (variant === 'wss') return {
    points: 15, prompt: `${intro} A constant ${V} V is applied. Find the steady-state speed $\\omega_{ss}$ in rad/s.`,
    vars: [], sample: () => ({}), tol: 2e-3, hint: 'Enter a number.',
    answer: String(rnd(V * Km)), answerTex: `\\omega_{ss} = ${nf(V * Km)}\\text{ rad/s}`,
    verify: { kind: 'motor1', what: 'wss', R, J, b, K, Kb, V },
    steps: [...base, { key: 'ss', title: 'Steady state', body: `Set $\\dot\\omega = 0$ (or use the final value theorem): $\\omega_{ss} = G_0V = ${nf(Km)}\\times${V} = ${nf(V * Km)}$ rad/s.` }],
    mistakes: [
      { expr: String(noEmfW), step: 'sub', why: 'Without back emf the speed would be $\\frac{k_tV}{Rb}$. The back emf limits the speed; include the $k_tk_m$ term.' },
      { expr: String(rnd(V / Kb)), step: 'ss', why: '$V/k_m$ is the no-friction, no-load speed. Friction $b$ also takes some torque here.' },
    ],
  };
  if (variant === 'tf') return {
    points: 15, prompt: `${intro} Find $\\dfrac{\\Omega(s)}{V(s)}$.`,
    vars: ['s'], sample: () => ({ s: rand(0.3, 5) }), hint: 'Answer in terms of s.',
    answer: `${K}/(${rnd(R * J)}*s+${D})`, answerTex: `\\frac{\\Omega(s)}{V(s)} = \\frac{${nf(K)}}{${linS(rnd(R * J), D)}}`,
    verify: { kind: 'motor1', what: 'tf', R, J, b, K, Kb },
    steps: base,
    mistakes: [
      { expr: `${K}/(${rnd(R * J)}*s+${rnd(R * b)})`, step: 'sub', why: `The back emf adds $k_tk_m = ${nf(K * Kb)}$ to the constant term of the denominator.` },
      { expr: `${K}/(${J}*s+${b})`, step: 'model', why: '$I = \\frac{V - k_m\\Omega}{R}$, so the $R$ and the back emf both have to come through.' },
    ],
  };
  return {
    points: 20, prompt: `${intro} The motor starts at rest and a ${V} V step is applied at $t=0$. Find $\\omega(t)$.`,
    vars: ['t'], sample: () => ({ t: rand(0.05, 3 * tau) }), hint: 'Answer in terms of t, e.g. 8(1 - e^(-2t)).',
    answer: `${rnd(V * Km)}*(1-exp(-t/${tau}))`, answerTex: `\\omega(t) = ${nf(V * Km)}\\left(1 - e^{-t/${nf(tau)}}\\right)`,
    verify: { kind: 'motor1', what: 'wt', R, J, b, K, Kb, V },
    steps: [...base, { key: 'step', title: 'Step response', body: `$\\Omega(s) = \\frac{G_0}{\\tau_m s+1}\\cdot\\frac{${V}}{s} = ${nf(V * Km)}\\left(\\frac1s - \\frac{1}{s + 1/\\tau_m}\\right)$, so $$\\omega(t) = ${nf(V * Km)}\\left(1 - e^{-t/${nf(tau)}}\\right)$$` }],
    mistakes: [
      { expr: `${rnd(V * Km)}*exp(-t/${tau})`, step: 'step', why: 'Starting from rest, $\\omega(0) = 0$ and it rises toward $\\omega_{ss}$: $\\omega_{ss}(1 - e^{-t/\\tau})$.' },
      { expr: `${rnd(V * Km)}*(1-exp(-t*${tau}))`, step: 'step', why: `The exponent is $-t/\\tau_m$; you multiplied by $\\tau_m = ${nf(tau)}$ instead.` },
      { expr: `${noEmfW}*(1-exp(-t/${noEmfTau}))`, step: 'sub', why: 'The back emf changes both the final speed and the time constant. Keep the $k_tk_m$ term.' },
    ],
  };
}

function genGear() {
  const n1 = pick([10, 20, 25]), n2 = pick([40, 50, 60, 100].filter((v) => v > n1));
  const Jm = pick([0.01, 0.02, 0.05]), JL = pick([1, 2, 4, 5]), bm = pick([0.01, 0.02]), bL = pick([0.5, 1, 2]);
  const r = n1 / n2;
  const what = pick(['J', 'b', 'speed']);
  if (what === 'speed') {
    const wm = pick([100, 150, 200, 300]);
    const ans = rnd(wm * r);
    return {
      points: 10, prompt: `A motor gear of radius $r_1 = ${n1}$ mm drives a load gear of radius $r_2 = ${n2}$ mm. The motor turns at $${wm}$ rad/s. Find the load speed $\\omega_L$ in rad/s.`,
      vars: [], sample: () => ({}), tol: 1e-4, hint: 'Enter a number.',
      answer: String(ans), answerTex: `\\omega_L = ${nf(ans)}\\text{ rad/s}`,
      verify: { kind: 'none' },
      steps: [
        { key: 'contact', title: 'Gears share the contact-point speed', body: 'No slip at the contact point: $r_1\\omega_m = r_2\\omega_L$ (and torques scale the other way: $\\tau_L = \\frac{r_2}{r_1}\\tau_m$).' },
        { key: 'res', title: 'Solve', body: `$\\omega_L = \\frac{r_1}{r_2}\\omega_m = \\frac{${n1}}{${n2}}\\times${wm} = ${nf(ans)}$ rad/s. A big load gear slows the load down.` },
      ],
      mistakes: [{ expr: String(rnd(wm / r)), step: 'contact', why: 'The ratio is upside down. The bigger gear turns slower, so $\\omega_L = \\frac{r_1}{r_2}\\omega_m$.' }],
    };
  }
  const isJ = what === 'J';
  const m = isJ ? Jm : bm, L = isJ ? JL : bL;
  const ans = rnd(m + r * r * L);
  const sym = isJ ? 'J' : 'b';
  return {
    points: 15,
    prompt: `A motor (${isJ ? `$J_m = ${nf(Jm)}$ kg·m²` : `$b_m = ${nf(bm)}$ N·m·s/rad`}) drives a load (${isJ ? `$J_L = ${nf(JL)}$ kg·m²` : `$b_L = ${nf(bL)}$ N·m·s/rad`}) through gears of radius $r_1 = ${n1}$ mm (motor side) and $r_2 = ${n2}$ mm (load side). Find the equivalent ${isJ ? 'inertia $J_{eq}$' : 'damping $b_{eq}$'} referred to the motor shaft.`,
    vars: [], sample: () => ({}), tol: 1e-4, hint: 'Enter a number.',
    answer: String(ans), answerTex: `${sym}_{eq} = ${nf(ans)}`,
    verify: { kind: 'gear', m, L, r },
    steps: [
      { key: 'kin', title: 'Speed ratio', body: `$\\omega_L = \\frac{r_1}{r_2}\\omega_m = ${nf(r)}\\,\\omega_m$.` },
      { key: 'refl', title: 'Reflect the load to the motor side', body: `${isJ ? 'k_tinetic energy' : 'Power dissipated'} must match: ${isJ ? '$\\tfrac12J_L\\omega_L^2 = \\tfrac12\\left(\\frac{r_1}{r_2}\\right)^2J_L\\,\\omega_m^2$' : '$b_L\\omega_L^2 = \\left(\\frac{r_1}{r_2}\\right)^2b_L\\,\\omega_m^2$'}, so the load counts as $\\left(\\frac{r_1}{r_2}\\right)^2${sym}_L$ on the motor shaft.` },
      { key: 'res', title: 'Add', body: `$$${sym}_{eq} = ${sym}_m + \\left(\\frac{${n1}}{${n2}}\\right)^2${sym}_L = ${nf(m)} + ${nf(r * r)}\\times${nf(L)} = ${nf(ans)}$$` },
    ],
    mistakes: [
      { expr: String(rnd(m + r * L)), step: 'refl', why: 'The gear ratio enters squared, $(r_1/r_2)^2$, because both the torque and the speed get scaled.' },
      { expr: String(rnd(m + L / (r * r))), step: 'refl', why: 'Ratio upside down. Referred to the fast motor shaft the load looks smaller: multiply by $(r_1/r_2)^2 < 1$.' },
      { expr: String(rnd(m + L)), step: 'refl', why: 'The load can\'t just be added; it has to be reflected through the gears first.' },
    ],
  };
}

function genLapLin() {
  const pool = ['const', 't', 't2', 'exp', 'sin', 'cos', 'dsin'];
  const kinds = pool.sort(() => Math.random() - 0.5).slice(0, 3);
  const terms = [];
  let maxPole = 0;
  for (const k of kinds) {
    const c = nz(-5, 5);
    if (k === 'const') terms.push({ c, ft: '', F: `${c}/s`, Ft: kFrac(c, '1', 's'), wrong: `${c}`, why: `A constant ${c} is ${c}·u(t), whose transform is $\\frac{${c}}{s}$, not ${c}.` });
    if (k === 't') terms.push({ c, ft: 't', F: `${c}/s^2`, Ft: kFrac(c, '1', 's^2'), wrong: `${c}/s`, why: '$\\mathcal{L}\\{t\\} = \\frac{1}{s^2}$, not $\\frac1s$.' });
    if (k === 't2') terms.push({ c, ft: 't^2', F: `${2 * c}/s^3`, Ft: kFrac(2 * c, '1', 's^3'), wrong: `${c}/s^3`, why: '$\\mathcal{L}\\{t^2\\} = \\frac{2!}{s^3}$. The $2!$ is missing.' });
    if (k === 'exp') { const a = nz(-4, 3); maxPole = Math.max(maxPole, -a); terms.push({ c, ft: `e^{${kv(-a, 't')}}`, F: `${c}/(s+(${a}))`, Ft: kFrac(c, '1', sh('s', -a)), wrong: `${c}/(s-(${a}))`, why: `$\\mathcal{L}\\{e^{-at}\\} = \\frac{1}{s+a}$; check the sign: $e^{${kv(-a, 't')}} \\to \\frac{1}{${sh('s', -a)}}$.` }); }
    if (k === 'sin') { const w = randInt(1, 5); terms.push({ c, ft: `\\sin(${kv(w, 't')})`, F: `${c * w}/(s^2+${w * w})`, Ft: kFrac(c * w, '1', `s^2+${w * w}`), wrong: `${c}*s/(s^2+${w * w})`, why: '$\\sin\\omega t \\to \\frac{\\omega}{s^2+\\omega^2}$; the $s$ on top belongs to cosine.' }); }
    if (k === 'cos') { const w = randInt(1, 5); terms.push({ c, ft: `\\cos(${kv(w, 't')})`, F: `${c}*s/(s^2+${w * w})`, Ft: kFrac(c, 's', `s^2+${w * w}`), wrong: `${c * w}/(s^2+${w * w})`, why: '$\\cos\\omega t \\to \\frac{s}{s^2+\\omega^2}$; the $\\omega$ on top belongs to sine.' }); }
    if (k === 'dsin') { const a = randInt(1, 3), w = randInt(1, 4); terms.push({ c, ft: `e^{-${a === 1 ? '' : a}t}\\sin(${kv(w, 't')})`, F: `${c * w}/((s+${a})^2+${w * w})`, Ft: kFrac(c * w, '1', `(s+${a})^2+${w * w}`), wrong: `${c * w}/((s-${a})^2+${w * w})`, why: `Shift in $s$: $e^{-at}f(t) \\to F(s+a)$, so it's $(s+${a})^2$.` }); }
  }
  const ftex = sumTex(terms.map((t) => ({ c: t.c, body: t.ft })));
  const answer = terms.map((t) => `(${t.F})`).join('+');
  const ansTex = terms.map((t, i) => (i && !t.Ft.startsWith('-') ? '+ ' : '') + t.Ft).join(' ');
  const mistakes = terms.map((t, i) => ({ expr: terms.map((u, j) => `(${j === i ? u.wrong : u.F})`).join('+'), step: 'table', why: t.why }));
  return {
    points: 10,
    prompt: `Find the Laplace transform of $f(t) = ${ftex}$ for $t \\ge 0$.`,
    vars: ['s'], sample: () => ({ s: rand(maxPole + 1, maxPole + 6) }), hint: 'Answer in terms of s. Leave it as a sum of terms.',
    answer, answerTex: `F(s) = ${ansTex}`,
    verify: { kind: 'laplace', f: terms.map((t, i) => {
      const k = kinds[i];
      if (k === 'const') return `${t.c}`;
      if (k === 't') return `${t.c}*t`;
      if (k === 't2') return `${t.c}*t^2`;
      return `${t.c}*(${t.ft.replace(/\\sin/g, 'sin').replace(/\\cos/g, 'cos').replace(/e\^\{(-?\d*)t\}/, (m0, g) => `exp(${g === '-' ? -1 : g === '' ? 1 : g}*t)`).replace(/\(([\d]*)t\)/g, (m0, g) => `(${g || 1}*t)`)})`;
    }).join('+') },
    steps: [
      { key: 'lin', title: 'Linearity', body: 'Transform term by term and keep the constants: $\\mathcal{L}\\{af+bg\\} = aF + bG$.' },
      { key: 'table', title: 'Use the table', body: terms.map((t) => `$${t.ft || '1'} \\to ${t.Ft.replace(/^-?\\frac\{(\d+)/, (m0) => m0)}$`).join(', ') + ' (with the coefficients included).' },
      { key: 'res', title: 'Result', body: `$$F(s) = ${ansTex}$$` },
    ],
    mistakes,
  };
}

function genLapODE() {
  const first = Math.random() < 0.35;
  const inp = pick(['step', 'exp', 'none']);
  const A = nz(-4, 5);
  const a = randInt(1, 4);
  const inTex = inp === 'step' ? `${A}u(t)` : inp === 'exp' ? `${cf(A)}e^{-${a === 1 ? '' : a}t}` : '0';
  const inS = inp === 'step' ? `${A}/s` : inp === 'exp' ? `${A}/(s+${a})` : '0';
  const inSTex = inp === 'step' ? `\\frac{${A}}{s}` : inp === 'exp' ? kFrac(A, '1', `s+${a}`) : '0';
  if (first) {
    const p = randInt(1, 5), y0 = nz(-3, 3);
    const ans = `(${inS}+${y0})/(s+${p})`;
    return {
      points: 15,
      prompt: `Take the Laplace transform of $\\dot y + ${p}y = ${inTex}$, $y(0) = ${y0}$, and solve for $Y(s)$.`,
      vars: ['s'], sample: () => ({ s: rand(0.5, 6) }), hint: 'Answer in terms of s (no need to invert).',
      answer: ans, answerTex: `Y(s) = \\frac{${inSTex} ${y0 < 0 ? '-' : '+'} ${Math.abs(y0)}}{s+${p}}`,
      verify: { kind: 'odeY', order: 1, p, q: 0, y0, v0: 0, inp, A, a },
      steps: [
        { key: 'deriv', title: 'Derivative rule', body: '$\\mathcal{L}\\{\\dot y\\} = sY(s) - y(0)$.' },
        { key: 'input', title: 'Transform the input', body: `$\\mathcal{L}\\{${inTex}\\} = ${inSTex}$.` },
        { key: 'solve', title: 'Collect Y(s)', body: `$sY - (${y0}) + ${p}Y = ${inSTex}$, so $(s+${p})Y = ${inSTex} ${y0 < 0 ? '-' : '+'} ${Math.abs(y0)}$.` },
      ],
      mistakes: [
        { expr: `(${inS}-(${y0}))/(s+${p})`, step: 'deriv', why: 'Sign of the initial condition: $\\mathcal{L}\\{\\dot y\\} = sY - y(0)$, so $y(0)$ ends up added on the right-hand side.' },
        { expr: `(${inS})/(s+${p})`, step: 'deriv', why: 'The initial condition $y(0)$ is missing. That would be the zero-initial-condition (transfer-function) result.' },
        ...(inp === 'step' ? [{ expr: `(${A}+${y0})/(s+${p})`, step: 'input', why: `A step of height ${A} transforms to $\\frac{${A}}{s}$, not ${A}.` }] : []),
      ],
    };
  }
  let [r1, r2] = distinctInts(-4, -1, 2);
  const p = -(r1 + r2), q = r1 * r2;
  const y0 = randInt(-2, 3), v0 = randInt(-3, 3);
  const icNum = `${y0}*s+${v0 + p * y0}`;
  const ans = `(${inS}+${icNum})/(s^2+${p}*s+${q})`;
  const icTex = polyTex([y0, v0 + p * y0], 's');
  return {
    points: 15,
    prompt: `Take the Laplace transform of $\\ddot y + ${p}\\dot y + ${q}y = ${inTex}$, $y(0) = ${y0}$, $\\dot y(0) = ${v0}$, and solve for $Y(s)$.`,
    vars: ['s'], sample: () => ({ s: rand(0.5, 6) }), hint: 'Answer in terms of s (no need to invert).',
    answer: ans, answerTex: `Y(s) = \\frac{${inp === 'none' ? '' : `${inSTex} + `}${icTex}}{s^2 + ${p}s + ${q}}`,
    verify: { kind: 'odeY', order: 2, p, q, y0, v0, inp, A, a },
    steps: [
      { key: 'deriv', title: 'Derivative rules', body: '$\\mathcal{L}\\{\\dot y\\} = sY - y(0)$ and $\\mathcal{L}\\{\\ddot y\\} = s^2Y - sy(0) - \\dot y(0)$.' },
      { key: 'input', title: 'Transform the input', body: `$\\mathcal{L}\\{${inTex}\\} = ${inSTex}$.` },
      { key: 'solve', title: 'Collect Y(s)', body: `$$\\big(s^2Y - ${y0}s - (${v0})\\big) + ${p}\\big(sY - ${y0}\\big) + ${q}Y = ${inSTex}$$ $$\\Rightarrow (s^2+${p}s+${q})\\,Y = ${inSTex}${icTex === '0' ? '' : ` + (${icTex})`}$$` },
    ],
    mistakes: [
      { expr: `(${inS}-(${icNum}))/(s^2+${p}*s+${q})`, step: 'deriv', why: 'Sign of the initial-condition terms: they are subtracted on the left, so they end up added on the right.' },
      ...(y0 !== 0 || v0 !== 0 ? [{ expr: `(${inS})/(s^2+${p}*s+${q})`, step: 'deriv', why: 'The initial conditions are missing. With nonzero $y(0)$ or $\\dot y(0)$ they add a polynomial in $s$ to the numerator.' }] : []),
      ...(y0 !== 0 ? [{ expr: `(${inS}+${y0}*s+${v0})/(s^2+${p}*s+${q})`, step: 'solve', why: `The $${p}\\dot y$ term also contributes $-${p}y(0)$, so the constant in the numerator is $\\dot y(0) + ${p}y(0) = ${v0 + p * y0}$.` }] : []),
    ],
  };
}

function genFVT() {
  if (Math.random() < 0.6) {
    const [p1, p2] = distinctInts(1, 5, 2);
    const K = pick([2, 3, 4, 5, 6, 10]), z = randInt(1, 4);
    const ans = rnd(K * z / (p1 * p2));
    return {
      points: 10,
      prompt: `$Y(s) = \\dfrac{${K}(s+${z})}{s(s+${p1})(s+${p2})}$. Find $y(\\infty)$.`,
      vars: [], sample: () => ({}), tol: 1e-4, hint: 'Enter a number or fraction.',
      answer: `${K}*${z}/(${p1 * p2})`, answerTex: `y(\\infty) = ${new Frac(K * z, p1 * p2).tex()}`,
      verify: { kind: 'fvt', Y: `${K}*(s+${z})/(s*(s+${p1})*(s+${p2}))`, at: 0 },
      steps: [
        { key: 'check', title: 'Check that the FVT applies', body: `The poles of $sY(s)$ are $-${p1}$ and $-${p2}$, both in the left half-plane, so $y(t)$ settles.` },
        { key: 'fvt', title: 'Final value theorem', body: `$$y(\\infty) = \\lim_{s\\to0} sY(s) = \\frac{${K}(0+${z})}{(0+${p1})(0+${p2})} = ${new Frac(K * z, p1 * p2).tex()}$$` },
      ],
      mistakes: [
        { expr: `${K}/(${p1 * p2})`, step: 'fvt', why: `The zero at $s=-${z}$ contributes a factor $${z}$ when you set $s=0$.` },
        { expr: `${K}*${z}/(${p1 + p2})`, step: 'fvt', why: 'Multiply the pole factors at $s=0$, don\'t add them.' },
      ],
    };
  }
  const b1 = nz(-4, 5), b0 = randInt(1, 9), a1 = randInt(1, 6), a0 = randInt(1, 9);
  return {
    points: 10,
    prompt: `$Y(s) = \\dfrac{${polyTex([b1, b0], 's')}}{s^2 + ${a1}s + ${a0}}$. Use the initial value theorem to find $y(0^+)$.`,
    vars: [], sample: () => ({}), tol: 1e-4, hint: 'Enter a number.',
    answer: String(b1), answerTex: `y(0^+) = ${b1}`,
    verify: { kind: 'fvt', Y: `(${b1}*s+${b0})/(s^2+${a1}*s+${a0})`, at: Infinity },
    steps: [
      { key: 'ivt', title: 'Initial value theorem', body: '$y(0^+) = \\displaystyle\\lim_{s\\to\\infty} sY(s)$.' },
      { key: 'lim', title: 'Take the limit', body: `$$sY(s) = \\frac{${b1}s^2 + ${b0}s}{s^2+${a1}s+${a0}} \\to ${b1}\\quad\\text{as } s\\to\\infty$$ (ratio of the leading coefficients).` },
    ],
    mistakes: [
      { expr: new Frac(b0, a0).expr(), step: 'ivt', why: 'That is $\\lim_{s\\to0}Y(s)$. The initial value uses $s\\to\\infty$ and multiplies by $s$ first.' },
      { expr: '0', step: 'ivt', why: 'Multiply by $s$ before taking the limit. $Y(s)$ itself goes to 0, but $sY(s)$ doesn\'t.' },
    ],
  };
}

function genPF3() {
  const roots = distinctInts(-4, 0, 3).sort((x, y) => y - x);
  const res = roots.map(() => nz(-3, 3));
  // numerator = sum A_k * prod_{j!=k}(s - r_j), as polynomial coefficients
  const mulLin = (poly, r) => { const out = new Array(poly.length + 1).fill(0); poly.forEach((c, i) => { out[i] += c; out[i + 1] += -r * c; }); return out; };
  let num = [0, 0, 0];
  roots.forEach((rk, k) => {
    let p = [1];
    roots.forEach((rj, j) => { if (j !== k) p = mulLin(p, rj); });
    p.forEach((c, i) => { num[i] += res[k] * c; });
  });
  const numTex = polyTex(num, 's');
  const denTex = roots.map((r) => (r === 0 ? 's' : `(${sh('s', r)})`)).join('');
  const terms = roots.map((r, k) => ({ c: res[k], body: ex(r) }));
  const ansTex = sumTex(terms);
  const ans = roots.map((r, k) => `(${res[k]})*exp(${r}*t)`).join('+');
  const residueTex = roots.map((r, k) => {
    const others = roots.filter((_, j) => j !== k).map((rj) => `(${r} ${rj > 0 ? '-' : '+'} ${Math.abs(rj)})`).join('');
    return `$a_{${k + 1}} = \\left.\\frac{N(s)}{${roots.filter((_, j) => j !== k).map((rj) => (rj === 0 ? 's' : `(${sh('s', rj)})`)).join('')}}\\right|_{s=${r}} = ${res[k]}$`;
  }).join('<br>');
  const mistakes = [
    { expr: roots.map((r, k) => `(${res[k]})*exp(${-r}*t)`).join('+'), step: 'inv', why: 'Sign of the exponent: $\\frac{1}{s+p} \\to e^{-pt}$, so a pole at $s=-p$ gives $e^{-pt}$.' },
  ];
  if (roots.includes(0)) mistakes.push({ expr: roots.map((r, k) => (r === 0 ? '0' : `(${res[k]})*exp(${r}*t)`)).join('+'), step: 'inv', why: 'The pole at $s=0$ gives a constant term: $\\frac{a}{s} \\to a$ (a step).' });
  return {
    points: 15,
    prompt: `Use partial fractions to find $\\mathcal{L}^{-1}\\left\\{\\dfrac{${numTex}}{${denTex}}\\right\\}$.`,
    vars: ['t'], sample: sampT(0.05, 1.5), hint: 'Answer in terms of t.',
    answer: ans, answerTex: `f(t) = ${ansTex}`,
    verify: { kind: 'inverse', F: `(${num[0]}*s^2+${num[1]}*s+${num[2]})/(${roots.map((r) => `(s-(${r}))`).join('*')})`, pole: Math.max(...roots) },
    steps: [
      { key: 'form', title: 'Set up the expansion', body: `Three distinct poles at $s = ${roots.join(', ')}$: $$\\frac{N(s)}{${denTex}} = ${roots.map((r, k) => `\\frac{a_{${k + 1}}}{${r === 0 ? 's' : sh('s', r)}}`).join(' + ')}$$` },
      { key: 'cover', title: 'Cover-up for each residue', body: residueTex },
      { key: 'inv', title: 'Invert term by term', body: `$\\frac{a}{s+p} \\to ae^{-pt}$: $$f(t) = ${ansTex}$$` },
    ],
    mistakes,
  };
}

function genPFRepeated() {
  const p = randInt(-3, -1), A = nz(-3, 3), B = nz(-4, 4);
  const withQ = Math.random() < 0.55;
  let q = 0, C = 0;
  if (withQ) { do { q = randInt(-4, 0); } while (q === p); C = nz(-3, 3); }
  // numerator = A(s-p)(s-q) + B(s-q) + C(s-p)^2   (or A(s-p) + B)
  let num;
  if (withQ) num = [A + C, -A * (p + q) + B - 2 * C * p, A * p * q - B * q + C * p * p];
  else num = [A, B - A * p];
  const numTex = polyTex(num, 's');
  const sp = sh('s', p), sq = q === 0 ? 's' : `(${sh('s', q)})`;
  const denTex = withQ ? `(${sp})^2${sq}` : `(${sp})^2`;
  const ePt = `e^{${kv(p, 't')}}`;
  const ansTex = sumTex([{ c: A, body: ePt }, { c: B, body: `t${ePt}` }, ...(withQ ? [{ c: C, body: ex(q) }] : [])]);
  const ans = `(${A})*exp(${p}*t)+(${B})*t*exp(${p}*t)${withQ ? `+(${C})*exp(${q}*t)` : ''}`;
  const Fexpr = withQ ? `(${num[0]}*s^2+${num[1]}*s+${num[2]})/((s-(${p}))^2*(s-(${q})))` : `(${num[0]}*s+${num[1]})/((s-(${p}))^2)`;
  return {
    points: 20,
    prompt: `Use partial fractions to find $\\mathcal{L}^{-1}\\left\\{\\dfrac{${numTex}}{${denTex}}\\right\\}$.`,
    vars: ['t'], sample: sampT(0.05, 1.5), hint: 'Answer in terms of t, e.g. 2e^(-t) + 3te^(-t).',
    answer: ans, answerTex: `f(t) = ${ansTex}`,
    verify: { kind: 'inverse', F: Fexpr, pole: Math.max(p, q) },
    steps: [
      { key: 'form', title: 'Set up the expansion', body: `A repeated pole needs one term per power: $$\\frac{N(s)}{${denTex}} = \\frac{b_1}{${sp}} + \\frac{b_2}{(${sp})^2}${withQ ? ` + \\frac{c}{${q === 0 ? 's' : sh('s', q)}}` : ''}$$` },
      { key: 'top', title: 'Highest power by cover-up', body: `$b_2 = \\left.(${sp})^2F(s)\\right|_{s=${p}} = ${B}$${withQ ? `, and $c = \\left.${q === 0 ? 's' : `(${sh('s', q)})`}F(s)\\right|_{s=${q}} = ${C}$` : ''}.` },
      { key: 'deriv', title: 'Lower power by differentiating', body: `$b_1 = \\left.\\dfrac{d}{ds}\\Big[(${sp})^2F(s)\\Big]\\right|_{s=${p}} = ${A}$${withQ ? ` (or match the $s^2$ coefficients: $b_1 + c = ${num[0]}$)` : ' (or match the $s$ coefficient of the numerator)'}.` },
      { key: 'inv', title: 'Invert', body: `$\\frac{1}{(s+a)^2} \\to te^{-at}$, so $$f(t) = ${ansTex}$$` },
    ],
    mistakes: [
      { expr: `(${A})*exp(${p}*t)+(${B})*exp(${p}*t)${withQ ? `+(${C})*exp(${q}*t)` : ''}`, step: 'inv', why: '$\\frac{1}{(s+a)^2}$ inverts to $te^{-at}$. The factor $t$ is missing.' },
      { expr: `(${A})*exp(${-p}*t)+(${B})*t*exp(${-p}*t)${withQ ? `+(${C})*exp(${-q}*t)` : ''}`, step: 'inv', why: 'Sign of the exponent: a pole at $s=-a$ gives $e^{-at}$.' },
      { expr: `(${B})*t*exp(${p}*t)${withQ ? `+(${C})*exp(${q}*t)` : ''}`, step: 'form', why: `A double pole needs both $\\frac{b_1}{${sp}}$ and $\\frac{b_2}{(${sp})^2}$. The $b_1$ term is missing.` },
    ],
  };
}

function genPFComplex() {
  const sg = randInt(1, 3), w = randInt(1, 3), A = nz(-3, 3), B = nz(-4, 4);
  const withQ = Math.random() < 0.4;
  let q = 0, C = 0;
  if (withQ) { q = randInt(-4, 0); C = nz(-3, 3); }
  const c2 = 2 * sg, c0 = sg * sg + w * w;
  // quadratic part numerator: A(s+sg) + B w = A s + (A sg + B w)
  const n1 = A, n0 = A * sg + B * w;
  let num, denTex, Fexpr;
  const quadTex = `s^2 + ${c2}s + ${c0}`;
  if (withQ) {
    // C(s^2 + c2 s + c0) + (n1 s + n0)(s - q)
    num = [C + n1, C * c2 + n0 - n1 * q, C * c0 - n0 * q];
    denTex = `${q === 0 ? 's' : `(${sh('s', q)})`}(${quadTex})`;
    Fexpr = `(${num[0]}*s^2+${num[1]}*s+${num[2]})/((s-(${q}))*(s^2+${c2}*s+${c0}))`;
  } else {
    num = [n1, n0];
    denTex = quadTex;
    Fexpr = `(${n1}*s+${n0})/(s^2+${c2}*s+${c0})`;
  }
  const numTex = polyTex(num, 's');
  const wT = w === 1 ? 't' : `${w}t`;
  const inner = sumTex([{ c: A, body: `\\cos ${wT}` }, { c: B, body: `\\sin ${wT}` }]);
  const ansTex = `${withQ ? `${sumTex([{ c: C, body: ex(q) }])} + ` : ''}e^{-${sg === 1 ? '' : sg}t}\\left(${inner}\\right)`;
  const quadAns = (a, bb, sgn = -1) => `exp(${sgn * sg}*t)*((${a})*cos(${w}*t)+(${bb})*sin(${w}*t))`;
  const ans = `${withQ ? `(${C})*exp(${q}*t)+` : ''}${quadAns(A, B)}`;
  const pre = withQ ? `(${C})*exp(${q}*t)+` : '';
  const mistakes = [
    { expr: pre + quadAns(A, B, 1), step: 'square', why: `$(s+${sg})^2$ means the poles sit at $-${sg}\\pm j\\omega$: the envelope is $e^{-${sg === 1 ? '' : sg}t}$, which decays.` },
    { expr: pre + quadAns(B, A), step: 'split', why: `The $(s+${sg})$ part goes with cosine and the constant $\\omega$ part goes with sine. They look swapped.` },
  ];
  if (w !== 1) mistakes.push({ expr: pre + quadAns(A, B * w), step: 'split', why: `$\\frac{\\omega}{(s+\\sigma)^2+\\omega^2} \\to e^{-\\sigma t}\\sin\\omega t$ needs $\\omega = ${w}$ on top, so the leftover constant $${B * w}$ must be split as $${B}\\cdot${w}$.` });
  mistakes.push({ expr: pre + `exp(${-sg}*t)*((${A})*cos(${w}*t)+(${n0})*sin(${w}*t))`, step: 'split', why: `Write the numerator as $A(s+${sg}) + B\\cdot${w}$ first. The constant left over after pulling out $A(s+${sg})$ is $${n0} - ${A * sg} = ${B * w}$, not $${n0}$.` });
  return {
    points: 20,
    prompt: `Use partial fractions to find $\\mathcal{L}^{-1}\\left\\{\\dfrac{${numTex}}{${denTex}}\\right\\}$.`,
    vars: ['t'], sample: sampT(0.05, 2), hint: 'Answer in terms of t, e.g. e^(-2t)(3cos(t) - sin(t)).',
    answer: ans, answerTex: `f(t) = ${ansTex}`,
    verify: { kind: 'inverse', F: Fexpr, pole: withQ ? Math.max(q, -sg) : -sg },
    steps: [
      ...(withQ ? [{ key: 'real', title: 'Peel off the real pole', body: `$$\\frac{N(s)}{${denTex}} = \\frac{c}{${q === 0 ? 's' : sh('s', q)}} + \\frac{\\alpha s + \\beta}{${quadTex}},\\qquad c = \\left.\\frac{N(s)}{${quadTex}}\\right|_{s=${q}} = ${C}$$ Then match coefficients to get $\\alpha = ${n1}$, $\\beta = ${n0}$.` }] : []),
      { key: 'square', title: 'Complete the square', body: `$${quadTex} = (s+${sg})^2 + ${w * w}$, so $\\sigma = ${sg}$ and $\\omega = ${w}$ (complex poles $-${sg}\\pm ${w === 1 ? '' : w}j$).` },
      { key: 'split', title: 'Rewrite the numerator', body: `$${polyTex([n1, n0], 's')} = ${A}(s+${sg}) + ${B * w} = ${A}(s+${sg}) + ${B}\\cdot${w}$$$\\frac{${polyTex([n1, n0], 's')}}{(s+${sg})^2+${w * w}} = ${A}\\frac{s+${sg}}{(s+${sg})^2+${w * w}} + ${B}\\frac{${w}}{(s+${sg})^2+${w * w}}$$` },
      { key: 'inv', title: 'Invert', body: `$\\frac{s+\\sigma}{(s+\\sigma)^2+\\omega^2}\\to e^{-\\sigma t}\\cos\\omega t$, $\\frac{\\omega}{(s+\\sigma)^2+\\omega^2}\\to e^{-\\sigma t}\\sin\\omega t$: $$f(t) = ${ansTex}$$` },
    ],
    mistakes,
  };
}

/* ---------- state equations (lecture 5 method) ---------- */
function linTex(terms) { // [{c, v:'V'|'\\omega_1'|...}]
  return sumTex(terms.map((t) => ({ c: rnd(t.c), body: t.v })));
}
function linExpr(terms) { return terms.map((t) => `(${rnd(t.c)})*${t.e}`).join('+'); }

function genStateEq() {
  const sys = pick(['motorJ', 'spring', 'spring', 'gear', 'induct']);
  const R = pick([1, 2, 4]), kt = pick([0.5, 1, 2]), km = Math.random() < 0.7 ? kt : pick([0.5, 1, 2].filter((v) => v !== kt));
  const motorTxt = `a DC motor ($R = ${nf(R)}\\,\\Omega$, $k_t = ${nf(kt)}$ N·m/A, $k_m = ${nf(km)}$ V·s/rad${sys === 'induct' ? '' : ', armature inductance negligible'}) driven by voltage $V$`;
  const hintVars = (list) => `Type ${list}.`;
  const lawsMotor = '$i = \\frac{V - e_m}{R}$, $e_m = k_m\\omega$, $\\tau = k_ti$';
  if (sys === 'motorJ' || sys === 'gear') {
    const J = pick([0.5, 1, 2]), b = pick([0.1, 0.2, 0.5]);
    const gear = sys === 'gear';
    const r1 = gear ? pick([1, 2]) : 1, r2 = gear ? pick([3, 4, 5]) : 1;
    const n = r2 / r1; // tau_L = n tau_m, w_m = n w_L
    const cV = n * kt / (J * R), cW = -(n * n * kt * km / (J * R) + b / J);
    const terms = [{ c: cV, v: 'V', e: 'V' }, { c: cW, v: '\\omega', e: 'w' }];
    const ans = linExpr(terms);
    const mk = (cv, cw) => linExpr([{ c: cv, e: 'V' }, { c: cw, e: 'w' }]);
    const mistakes = [
      { expr: mk(cV, -b / J), step: 'elim', why: `The back emf is missing. $i = \\frac{V - k_m\\omega_m}{R}$ gives a $-\\frac{${gear ? 'n^2' : ''}k_tk_m}{JR}\\omega$ term that acts like extra damping.` },
      { expr: mk(cV * J, cW * J), step: 'law', why: `Newton's law is $J\\dot\\omega = \\sum\\tau$, so divide every term by $J = ${nf(J)}$.` },
      { expr: mk(cV * R, -(n * n * kt * km / J + b / J)), step: 'elim', why: 'The current is $\\frac{V - e_m}{R}$, so both the $V$ and the back-emf terms carry a $\\frac1R$.' },
    ];
    if (gear) {
      mistakes.push({ expr: mk(cV, -(n * kt * km / (J * R) + b / J)), step: 'gear', why: `The ratio appears twice in the back-emf term: once for the torque ($\\tau_L = \\frac{r_2}{r_1}\\tau_m$) and once for the speed ($\\omega_m = \\frac{r_2}{r_1}\\omega_L$), so it's $(r_2/r_1)^2 = ${nf(n * n)}$.` });
      mistakes.push({ expr: mk(kt / (n * J * R), -(kt * km / (n * n * J * R) + b / J)), step: 'gear', why: 'The gear ratio is upside down. The small motor gear drives the big load gear, so the load torque is multiplied by $\\frac{r_2}{r_1} > 1$.' });
    }
    return {
      points: 20,
      prompt: gear
        ? `${motorTxt[0].toUpperCase() + motorTxt.slice(1)} turns a gear of radius $r_1 = ${r1}$ cm, which meshes with a gear of radius $r_2 = ${r2}$ cm on a load shaft ($J_L = ${nf(J)}$ kg·m², viscous friction $b = ${nf(b)}$ N·m·s/rad). Neglect the motor and gear inertia. With state $\\omega_L$, find $\\dot\\omega_L$.`
        : `${motorTxt[0].toUpperCase() + motorTxt.slice(1)} spins an inertia $J = ${nf(J)}$ kg·m² with viscous friction $b = ${nf(b)}$ N·m·s/rad. With state $\\omega$, find $\\dot\\omega$.`,
      vars: ['V', 'w'], sample: () => ({ V: rand(-5, 5), w: rand(-5, 5) }), hint: hintVars(gear ? 'ω_L as w, e.g. 2V - 1.5w' : 'ω as w, e.g. 2V - 1.5w'),
      answer: ans, answerTex: `\\dot\\omega${gear ? '_L' : ''} = ${linTex(terms).replace('\\omega', gear ? '\\omega_L' : '\\omega')}`,
      verify: { kind: 'none' },
      steps: [
        { key: 'es', title: 'Energy-storage elements → states', body: `Only the inertia stores energy (no inductance), so this is a first-order system with state $\\omega${gear ? '_L' : ''}$.` },
        { key: 'law', title: 'Newton on the inertia', body: gear ? '$J_L\\dot\\omega_L = \\tau_L - b\\omega_L$' : '$J\\dot\\omega = \\tau - b\\omega$' },
        ...(gear ? [{ key: 'gear', title: 'Gear relations', body: `$\\omega_m = \\frac{r_2}{r_1}\\omega_L = ${nf(n)}\\omega_L$ and $\\tau_L = \\frac{r_2}{r_1}\\tau_m = ${nf(n)}\\tau_m$.` }] : []),
        { key: 'elim', title: 'Remove the intermediate variables', body: `Motor: ${lawsMotor}${gear ? ' (with $\\omega = \\omega_m$)' : ''}. Substituting: $$${gear ? 'J_L\\dot\\omega_L = \\frac{r_2}{r_1}\\cdot\\frac{k_t}{R}\\left(V - k_m\\frac{r_2}{r_1}\\omega_L\\right) - b\\omega_L' : 'J\\dot\\omega = \\frac{k_t}{R}(V - k_m\\omega) - b\\omega'}$$` },
        { key: 'res', title: 'Divide by the inertia', body: `$$\\dot\\omega${gear ? '_L' : ''} = ${linTex(terms).replace('\\omega', gear ? '\\omega_L' : '\\omega')}$$` },
      ],
      mistakes,
    };
  }
  if (sys === 'induct') {
    const L = pick([0.5, 1, 2]), J = pick([0.5, 1, 2]), b = pick([0.1, 0.5, 1]);
    const ask = pick(['i', 'w']);
    if (ask === 'i') {
      const terms = [{ c: 1 / L, v: 'V', e: 'V' }, { c: -R / L, v: 'i', e: 'i' }, { c: -km / L, v: '\\omega', e: 'w' }];
      const mk = (a, bb, c) => linExpr([{ c: a, e: 'V' }, { c: bb, e: 'i' }, { c: c, e: 'w' }]);
      return {
        points: 20,
        prompt: `${motorTxt[0].toUpperCase() + motorTxt.slice(1)}, with armature inductance $L = ${nf(L)}$ H, spins $J = ${nf(J)}$ kg·m² ($b = ${nf(b)}$ N·m·s/rad). Using states $i$ and $\\omega$, find $\\dfrac{di}{dt}$.`,
        vars: ['V', 'i', 'w'], sample: () => ({ V: rand(-5, 5), i: rand(-5, 5), w: rand(-5, 5) }), hint: hintVars('ω as w, e.g. 2V - 4i - w'),
        answer: linExpr(terms), answerTex: `\\frac{di}{dt} = ${linTex(terms)}`,
        verify: { kind: 'none' },
        steps: [
          { key: 'es', title: 'Energy-storage elements → states', body: 'The inductor ($i$) and the inertia ($\\omega$): a second-order system.' },
          { key: 'law', title: 'KVL around the armature', body: '$V = Ri + L\\dfrac{di}{dt} + e_m$ with $e_m = k_m\\omega$.' },
          { key: 'res', title: 'Solve for di/dt', body: `$$\\frac{di}{dt} = \\frac{1}{L}\\left(V - Ri - k_m\\omega\\right) = ${linTex(terms)}$$` },
        ],
        mistakes: [
          { expr: mk(1 / L, -R / L, km / L), step: 'law', why: 'The back emf opposes the supply: $V = Ri + L\\dot i + e_m$, so $-k_m\\omega$ appears with a minus sign.' },
          { expr: mk(1, -R, -km), step: 'res', why: `$L\\dot i = \\dots$, so every term is divided by $L = ${nf(L)}$.` },
          { expr: mk(1 / L, -R / L, 0), step: 'law', why: 'The back-emf term $e_m = k_m\\omega$ is missing from KVL.' },
        ],
      };
    }
    const terms = [{ c: kt / J, v: 'i', e: 'i' }, { c: -b / J, v: '\\omega', e: 'w' }];
    const mk = (a, c) => linExpr([{ c: a, e: 'i' }, { c: c, e: 'w' }]);
    return {
      points: 15,
      prompt: `${motorTxt[0].toUpperCase() + motorTxt.slice(1)}, with armature inductance $L = ${nf(L)}$ H, spins $J = ${nf(J)}$ kg·m² ($b = ${nf(b)}$ N·m·s/rad). Using states $i$ and $\\omega$, find $\\dot\\omega$.`,
      vars: ['V', 'i', 'w'], sample: () => ({ V: rand(-5, 5), i: rand(-5, 5), w: rand(-5, 5) }), hint: hintVars('ω as w'),
      answer: linExpr(terms), answerTex: `\\dot\\omega = ${linTex(terms)}`,
      verify: { kind: 'none' },
      steps: [
        { key: 'es', title: 'Energy-storage elements → states', body: 'The inductor ($i$) and the inertia ($\\omega$). With $i$ as a state, the current is no longer $(V-e_m)/R$; it is its own variable.' },
        { key: 'law', title: 'Newton on the rotor', body: '$J\\dot\\omega = \\tau - b\\omega = k_ti - b\\omega$.' },
        { key: 'res', title: 'Divide by J', body: `$$\\dot\\omega = ${linTex(terms)}$$` },
      ],
      mistakes: [
        { expr: linExpr([{ c: kt / (J * R), e: 'V' }, { c: -(kt * km / (J * R) + b / J), e: 'w' }]), step: 'es', why: 'That is the model without inductance. Here $i$ is a state, so write the torque as $k_ti$ directly.' },
        { expr: mk(kt, -b), step: 'res', why: `Divide by $J = ${nf(J)}$.` },
        { expr: mk(km / J, -b / J), step: 'law', why: 'Torque uses the torque constant: $\\tau = k_ti$.' },
      ],
    };
  }
  // spring system (lecture example)
  const J1 = pick([0.5, 1, 2]), J2 = pick([1, 2, 4]), k = pick([2, 5, 10]), b2 = pick([0, 0, 0.5, 1]);
  const ask = pick(['w1', 'w1', 'w2', 'th']);
  const desc = `${motorTxt[0].toUpperCase() + motorTxt.slice(1)} turns an inertia $J_1 = ${nf(J1)}$ kg·m². $J_1$ is connected by a torsional spring $k = ${nf(k)}$ N·m/rad to a second inertia $J_2 = ${nf(J2)}$ kg·m²${b2 ? ` with viscous friction $b = ${nf(b2)}$ N·m·s/rad` : ''}. Use the states $\\omega_1$, $\\omega_2$ and the spring twist $\\tilde\\theta = \\theta_1 - \\theta_2$.`;
  const vars = ['V', 'w1', 'w2', 'th'];
  const sample = () => ({ V: rand(-5, 5), w1: rand(-5, 5), w2: rand(-5, 5), th: rand(-2, 2) });
  const hint = hintVars('ω₁ as w1, ω₂ as w2 and the twist (theta-tilde) as th, e.g. 2V - w1 - 5th');
  const L = (arr) => linExpr(arr.map(([c, e]) => ({ c, e })));
  const stepsBase = [
    { key: 'es', title: 'Energy-storage elements → states', body: `$J_1$ ($\\omega_1$), $J_2$ ($\\omega_2$) and the spring ($\\tilde\\theta$): third order. The spring torque is $\\tau_s = k\\tilde\\theta$.` },
  ];
  if (ask === 'w1') {
    const terms = [{ c: kt / (J1 * R), v: 'V', e: 'V' }, { c: -kt * km / (J1 * R), v: '\\omega_1', e: 'w1' }, { c: -k / J1, v: '\\tilde\\theta', e: 'th' }];
    return {
      points: 25, prompt: `${desc} Find $\\dot\\omega_1$.`, vars, sample, hint,
      answer: linExpr(terms), answerTex: `\\dot\\omega_1 = ${linTex(terms)}`,
      verify: { kind: 'none' },
      steps: [...stepsBase,
        { key: 'law', title: 'Newton on J₁', body: 'The motor torque drives $J_1$ and the twisted spring pulls back: $J_1\\dot\\omega_1 = \\tau - \\tau_s = \\tau - k\\tilde\\theta$.' },
        { key: 'elim', title: 'Remove the intermediate variables', body: `${lawsMotor} with $\\omega = \\omega_1$: $$J_1\\dot\\omega_1 = \\frac{k_t}{R}V - \\frac{k_tk_m}{R}\\omega_1 - k\\tilde\\theta$$` },
        { key: 'res', title: 'Divide by J₁', body: `$$\\dot\\omega_1 = ${linTex(terms)}$$` }],
      mistakes: [
        { expr: L([[kt / (J1 * R), 'V'], [-kt * km / (J1 * R), 'w1'], [k / J1, 'th']]), step: 'law', why: 'With $\\tilde\\theta = \\theta_1 - \\theta_2 > 0$ the spring is wound up and resists $J_1$, so it enters as $-k\\tilde\\theta$.' },
        { expr: L([[kt / (J1 * R), 'V'], [-k / J1, 'th']]), step: 'elim', why: 'The back emf is missing: $i = \\frac{V - k_m\\omega_1}{R}$ gives a $-\\frac{k_tk_m}{J_1R}\\omega_1$ term.' },
        { expr: L([[kt / R, 'V'], [-kt * km / R, 'w1'], [-k, 'th']]), step: 'res', why: `Divide every term by $J_1 = ${nf(J1)}$.` },
        { expr: L([[kt / (J1 * R), 'V'], [-kt * km / (J1 * R), 'w1'], [-k / J1, 'th'], [k / J1, 'w2']]), step: 'law', why: 'The spring torque depends on the twist $\\tilde\\theta$, not directly on $\\omega_2$; $\\omega_2$ only enters through $\\dot{\\tilde\\theta}$.' },
      ],
    };
  }
  if (ask === 'w2') {
    const terms = [{ c: k / J2, v: '\\tilde\\theta', e: 'th' }, ...(b2 ? [{ c: -b2 / J2, v: '\\omega_2', e: 'w2' }] : [])];
    return {
      points: 20, prompt: `${desc} Find $\\dot\\omega_2$.`, vars, sample, hint,
      answer: linExpr(terms), answerTex: `\\dot\\omega_2 = ${linTex(terms)}`,
      verify: { kind: 'none' },
      steps: [...stepsBase,
        { key: 'law', title: 'Newton on J₂', body: `The only drive on $J_2$ is the spring: $J_2\\dot\\omega_2 = \\tau_s${b2 ? ' - b\\omega_2' : ''} = k\\tilde\\theta${b2 ? ' - b\\omega_2' : ''}$.` },
        { key: 'res', title: 'Divide by J₂', body: `$$\\dot\\omega_2 = ${linTex(terms)}$$` }],
      mistakes: [
        { expr: linExpr(terms.map((t) => (t.e === 'th' ? { ...t, c: -t.c } : t))), step: 'law', why: 'A positive twist $\\tilde\\theta = \\theta_1 - \\theta_2$ pulls $J_2$ forward, so $+k\\tilde\\theta$ drives it.' },
        { expr: linExpr(terms.map((t) => ({ ...t, c: t.c * J2 }))), step: 'res', why: `Divide by $J_2 = ${nf(J2)}$.` },
        { expr: linExpr([...terms, { c: kt / (J2 * R), e: 'V' }]), step: 'law', why: 'The motor torque acts on $J_1$, not $J_2$. $J_2$ only feels the spring.' },
      ],
    };
  }
  return {
    points: 10, prompt: `${desc} Find $\\dot{\\tilde\\theta}$.`, vars, sample, hint,
    answer: 'w1-w2', answerTex: '\\dot{\\tilde\\theta} = \\omega_1 - \\omega_2',
    verify: { kind: 'none' },
    steps: [...stepsBase,
      { key: 'twist', title: 'Differentiate the twist', body: '$\\tilde\\theta = \\theta_1 - \\theta_2$, so $\\dot{\\tilde\\theta} = \\dot\\theta_1 - \\dot\\theta_2 = \\omega_1 - \\omega_2$. This is a kinematic relation, with no physics constants.' }],
    mistakes: [
      { expr: 'w2-w1', step: 'twist', why: 'The twist is defined as $\\theta_1 - \\theta_2$, so its rate is $\\omega_1 - \\omega_2$, in that order.' },
      { expr: `${k}*(w1-w2)`, step: 'twist', why: 'No $k$ here. $\\dot{\\tilde\\theta}$ is purely kinematic; $k$ only appears in the torque $k\\tilde\\theta$.' },
    ],
  };
}

function genOrder() {
  const systems = [
    { d: 'A DC motor (armature inductance negligible) spins an inertia $J$ with viscous friction $b$.', n: 1, why: 'Only $J$ stores energy (kinetic). $R$ and $b$ dissipate, and with no inductance the current is algebraic.' },
    { d: 'A DC motor with armature inductance $L$ spins an inertia $J$ with viscous friction $b$.', n: 2, why: '$L$ (magnetic, state $i$) and $J$ (kinetic, state $\\omega$) both store energy.' },
    { d: 'A DC motor (no inductance) turns $J_1$, which is connected by a torsional spring $k$ to $J_2$.', n: 3, why: '$J_1$, $J_2$ and the spring $k$ each store energy: states $\\omega_1$, $\\omega_2$, $\\tilde\\theta$.' },
    { d: 'A DC motor with inductance $L$ turns $J_1$, which is connected by a torsional spring $k$ to $J_2$ with friction $b$.', n: 4, why: '$L$, $J_1$, $J_2$ and $k$: four energy-storage elements, so states $i$, $\\omega_1$, $\\omega_2$, $\\tilde\\theta$.' },
    { d: 'A DC motor (no inductance, rotor inertia $J_m$) drives a load inertia $J_L$ through a pair of rigid gears.', n: 1, why: 'Rigid gears lock $\\omega_L = \\frac{r_1}{r_2}\\omega_m$, so $J_m$ and $J_L$ are not independent. They act as one equivalent inertia: one state.' },
    { d: 'A voltage source drives a series $R$–$L$–$C$ circuit.', n: 2, why: '$L$ (state $i$) and $C$ (state $V_C$) store energy; $R$ only dissipates.' },
    { d: 'A force pushes a mass $m$ attached to a wall by a spring $k$ and a damper $b$.', n: 2, why: '$m$ (state $v$) and the spring (state: its stretch $\\tilde x$) store energy; the damper dissipates.' },
    { d: 'A DC motor (no inductance) turns $J_1$; a flexible shaft (stiffness $k$) connects it to $J_2$, which drives $J_3$ through a second spring $k_2$.', n: 5, why: 'Three inertias and two springs: five energy-storage elements.' },
  ];
  const S = pick(systems);
  const nums = [...new Set([S.n, ...[1, 2, 3, 4, 5].filter((v) => v !== S.n).sort(() => Math.random() - 0.5).slice(0, 3)])].sort((a, b) => a - b);
  return {
    points: 10, type: 'choice',
    prompt: `${S.d} What is the order of the system (the number of state variables)?`,
    options: nums.map((v) => ({ tex: `${v}`, correct: v === S.n, why: `Count the independent energy-storage elements. ${S.why}`, step: 'count' })),
    answerTex: `${S.n}`, hint: 'Count energy-storage elements.',
    verify: { kind: 'none' },
    steps: [
      { key: 'rule', title: 'Order = number of independent energy-storage elements', body: 'Inertias ($m$, $J$) store kinetic energy, springs store potential energy, inductors store magnetic energy and capacitors store electric energy. Resistors, dampers and gears don\'t store energy.' },
      { key: 'count', title: 'Count them', body: `${S.why} Order $= ${S.n}$.` },
    ],
    mistakes: [],
  };
}

const CHAPTERS = [
  { id: 'ch1', course: 'MATH 3705', name: 'Laplace transform' },
  { id: 'ch2', course: 'MATH 3705', name: 'Series solutions' },
  { id: 'ch3', course: 'MATH 3705', name: 'Fourier series' },
  { id: 'ch4', course: 'MATH 3705', name: 'PDEs' },
  { id: 'ch5', course: 'MATH 3705', name: 'Sturm–Liouville' },
  { id: 'sy-em', course: 'SYSC 3600', name: 'Electromechanical modelling' },
  { id: 'sy-lt', course: 'SYSC 3600', name: 'Laplace transform' },
  { id: 'sy-pf', course: 'SYSC 3600', name: 'Inverse Laplace (PFE)' },
];
const COURSES = ['MATH 3705', 'SYSC 3600'];
const TOPICS = [
  { id: 'lap-basic', ch: 'ch1', name: 'tⁿ·eᵃᵗ transforms', gen: genLapBasic },
  { id: 'lap-trig', ch: 'ch1', name: 'Shifted sin / cos', gen: genLapTrig },
  { id: 'lap-pf', ch: 'ch1', name: 'Inverse via partial fractions', gen: genLapPF },
  { id: 'lap-ivp', ch: 'ch1', name: 'IVPs with Laplace', gen: genLapIVP },
  { id: 'lap-step', ch: 'ch1', name: 'Unit step functions', gen: genLapStep },
  { id: 'conv-direct', ch: 'ch1', sec: '1.3', name: 'Convolution integrals', desc: 'Evaluate f * g straight from the definition.', gen: genConvDirect },
  { id: 'conv-laplace', ch: 'ch1', sec: '1.3', name: 'Transform of a convolution', desc: 'L{f * g} = F(s)G(s), no integral needed.', gen: genConvLaplace },
  { id: 'conv-inverse', ch: 'ch1', sec: '1.3', name: 'Inverse via convolution', desc: 'Split F(s)G(s) and convolve.', gen: genConvInverse },
  { id: 'int-eq', ch: 'ch1', sec: '1.3', name: 'Integral equations', desc: 'Unknown inside a convolution? Transform and solve for F(s).', gen: genIntEq },
  { id: 'delta-sift', ch: 'ch1', sec: '1.3', name: 'Dirac delta: sifting', desc: '∫δ(t − a)φ(t)dt = φ(a).', gen: genDeltaSift },
  { id: 'delta-ivp', ch: 'ch1', sec: '1.3', name: 'Impulse IVPs', desc: 'IVPs driven by δ(t − a).', gen: genDeltaIVP },
  { id: 'sing-pts', ch: 'ch2', sec: '2.1', name: 'Singular points', desc: 'Where p(x) or q(x) stops being analytic.', gen: genSingPts },
  { id: 'taylor-coef', ch: 'ch2', sec: '2.1', name: 'Taylor coefficients', desc: 'aₙ = f⁽ⁿ⁾(x₀)/n!.', gen: genTaylorCoef },
  { id: 'radius', ch: 'ch2', sec: '2.1', name: 'Radius of convergence', desc: 'R = lim |aₙ/aₙ₊₁|.', gen: genRadius },
  { id: 'radius-ode', ch: 'ch2', sec: '2.2', name: 'Guaranteed radius (Thm 2.5)', desc: 'Distance to the nearest singular point, complex ones included.', gen: genRadiusODE },
  { id: 'ser-rec', ch: 'ch2', sec: '2.2', name: 'Recursion coefficients', desc: 'Derive the recursion and step it to aₙ.', gen: genSeries },
  { id: 'series-poly', ch: 'ch2', sec: '2.2', name: 'Series solution of an IVP', desc: 'Taylor polynomial of the solution up to x⁴.', gen: genSeriesPoly },
  { id: 'classify', ch: 'ch2', sec: '2.3', name: 'Regular vs irregular', desc: 'Classify a point with the (x − x₀)p, (x − x₀)²q test.', gen: genClassify },
  { id: 'euler', ch: 'ch2', sec: '2.3', name: 'Cauchy–Euler (all 3 cases)', desc: 'Distinct, repeated and complex indicial roots.', gen: genEulerCases },
  { id: 'indicial', ch: 'ch2', sec: '2.3', name: 'Indicial roots', desc: 'r² + (p₀ − 1)r + q₀ = 0.', gen: genIndicial },
  { id: 'frob-case', ch: 'ch2', sec: '2.3', name: 'Frobenius cases', desc: 'Which form does y₂ take (Theorem 2.7)?', gen: genFrobCase },
  { id: 'frob-coef', ch: 'ch2', sec: '2.3', name: 'Frobenius coefficients', desc: 'Recursion for y₁ with the larger root.', gen: genFrobCoef },
  { id: 'bessel', ch: 'ch2', sec: '2.3', name: 'Bessel’s equation', desc: 'Read off ν and λ, pick J₋ν or Yν.', gen: genBessel },
  { id: 'four', ch: 'ch3', name: 'Fourier coefficients', gen: genFourier },
  { id: 'pde-heat', ch: 'ch4', name: 'Heat equation', gen: genHeat },
  { id: 'pde-wave', ch: 'ch4', name: 'Wave equation', gen: genWave },
  { id: 'sl', ch: 'ch5', name: 'Eigenvalue problems', gen: genSL },
  { id: 'sy-order', ch: 'sy-em', sec: 'em', name: 'System order', desc: 'Count the energy-storage elements.', gen: genOrder },
  { id: 'sy-state', ch: 'sy-em', sec: 'em', name: 'State equations', desc: 'First-order ODEs for each state (lecture 5 method).', gen: genStateEq },
  { id: 'sy-motor1', ch: 'sy-em', sec: 'em', name: 'Motor: τ, ω_ss, ω(t)', desc: 'First-order motor model with back emf.', gen: genMotorFirst },
  { id: 'sy-motortf', ch: 'sy-em', sec: 'em', name: 'Motor transfer functions', desc: 'Ω/V, Θ/V, I/V including inductance.', gen: genMotorTF },
  { id: 'sy-gear', ch: 'sy-em', sec: 'em', name: 'Gears', desc: 'Speed ratio and reflected J, b.', gen: genGear },
  { id: 'sy-lin', ch: 'sy-lt', sec: 'lt', name: 'Transform from the table', desc: 'Linearity plus the standard pairs.', gen: genLapLin },
  { id: 'sy-basic', ch: 'sy-lt', sec: 'lt', name: 'Shift theorem', desc: 'e^{−at}f(t) → F(s + a).', gen: genLapTrig },
  { id: 'sy-ode', ch: 'sy-lt', sec: 'lt', name: 'ODE → Y(s)', desc: 'Derivative rule with initial conditions.', gen: genLapODE },
  { id: 'sy-fvt', ch: 'sy-lt', sec: 'lt', name: 'Initial & final value', desc: 'y(0⁺) and y(∞) straight from Y(s).', gen: genFVT },
  { id: 'sy-pf2', ch: 'sy-pf', sec: 'pfe', name: 'Distinct real poles', desc: 'Cover-up method, two poles.', gen: genLapPF },
  { id: 'sy-pf3', ch: 'sy-pf', sec: 'pfe', name: 'Three poles (incl. s = 0)', desc: 'Step-response style expansions.', gen: genPF3 },
  { id: 'sy-pfrep', ch: 'sy-pf', sec: 'pfe', name: 'Repeated poles', desc: '1/(s+a)² → t e^{−at}.', gen: genPFRepeated },
  { id: 'sy-pfcx', ch: 'sy-pf', sec: 'pfe', name: 'Complex poles', desc: 'Complete the square → e^{−σt}(A cos ωt + B sin ωt).', gen: genPFComplex },
  { id: 'sy-ivp', ch: 'sy-pf', sec: 'pfe', name: 'Solve an IVP end to end', desc: 'Transform, solve for Y(s), expand, invert.', gen: genLapIVP },
];
TOPICS.forEach((t) => { t.course = CHAPTERS.find((c) => c.id === t.ch).course; });

/* ---------- Lessons (Learn mode) ---------- */
const R = String.raw;
const SECTIONS = [
  {
    id: '1.3', course: 'MATH 3705', tag: '§ 1.3', title: 'Convolutions and generalized functions', chapter: 'Chapter 1 · Laplace transform',
    skills: ['conv-direct', 'conv-laplace', 'conv-inverse', 'int-eq', 'delta-sift', 'delta-ivp'],
    cards: [
      { kind: 'key', title: 'What a convolution is', body: R`For functions defined on $t \ge 0$, the convolution of $f$ and $g$ is $$(f*g)(t) = \int_0^t f(t-x)\,g(x)\,dx.$$ The result is a new function of $t$; $x$ is just the integration variable. It is not the product: $t * \sin t$ is not $t\sin t$.` },
      { kind: 'key', title: 'It commutes', body: R`Substituting $y = t - x$ shows that $f*g = g*f$. Use this to put whichever function is easier to shift into the $f(t-x)$ slot. Constants and $t$ are the easiest.` },
      { kind: 'method', title: 'The convolution theorem (Theorem 1.14)', body: R`If $\mathcal{L}\{f\}=F(s)$ and $\mathcal{L}\{g\}=G(s)$, then $$\mathcal{L}\{f*g\} = F(s)\,G(s), \qquad \mathcal{L}^{-1}\{F(s)\,G(s)\} = f*g.$$ It has two uses: transforming a convolution without doing the integral, and inverting a product of two transforms you already recognise.` },
      { kind: 'example', title: 'Worked example: t ∗ e²ᵗ', body: R`$$t*e^{2t} = \int_0^t (t-x)\,e^{2x}\,dx.$$ By parts with $u=t-x$, $dv=e^{2x}dx$: $$\left[\frac{(t-x)e^{2x}}{2}\right]_0^t + \frac12\int_0^t e^{2x}dx = -\frac t2 + \frac{e^{2t}-1}{4} = \frac{e^{2t}-1-2t}{4}.$$ Check with the theorem: $\mathcal{L}\{t\}\,\mathcal{L}\{e^{2t}\} = \dfrac{1}{s^2(s-2)}$, which is exactly the transform of that answer.` },
      { kind: 'method', title: 'Integral equations', body: R`When the unknown $f$ sits inside a convolution, as in $f(t) = g(t) + \int_0^t f(t-x)\,k(x)\,dx$, transform both sides. The integral becomes $F(s)K(s)$: $$F(s) = G(s) + F(s)K(s) \;\Rightarrow\; F(s) = \frac{G(s)}{1-K(s)}.$$ Then invert. A plain $\int_0^t f(x)\,dx$ is $1*f$, with transform $\dfrac{F(s)}{s}$.` },
      { kind: 'example', title: 'Worked example', body: R`Solve $f(t) = 3 + 2\int_0^t f(x)\,dx$. Transforming gives $F = \frac3s + \frac{2F}{s}$, so $F\left(1-\frac2s\right)=\frac3s$, giving $F = \dfrac{3}{s-2}$ and $f(t) = 3e^{2t}$. Check: $3 + 2\int_0^t 3e^{2x}dx = 3 + 3(e^{2t}-1) = 3e^{2t}$.` },
      { kind: 'key', title: 'The Dirac delta', body: R`$\delta(t-a)$ models a unit impulse at $t=a$. Think of it as the limit of pulses of width $2\varepsilon$ and height $\frac{1}{2\varepsilon}$, which all have area 1. It isn't a real function; it's defined by what it does to smooth test functions $\varphi$: $$\int_{-\infty}^{\infty}\delta(t-a)\,\varphi(t)\,dt = \varphi(a).$$ This is the sifting property, also written $\delta_a(\varphi)=\varphi(a)$.` },
      { kind: 'method', title: 'Delta in the Laplace transform', body: R`$\mathcal{L}\{\delta(t-a)\} = e^{-as}$ for $a \ge 0$, and $\mathcal{L}\{\delta(t)\}=1$. In an IVP the impulse produces an $e^{-as}$ factor, so the second shifting theorem turns its contribution into a $u(t-a)$ term.` },
      { kind: 'example', title: 'Worked example', body: R`Solve $y''+4y = \delta(t-1)$, $y(0)=y'(0)=0$. Transforming gives $(s^2+4)Y = e^{-s}$, so $Y = \dfrac{e^{-s}}{s^2+4}$. Since $\mathcal{L}^{-1}\left\{\frac{1}{s^2+4}\right\} = \frac12\sin 2t$, $$y(t) = \tfrac12\,u(t-1)\sin\big(2(t-1)\big).$$ Nothing happens until $t=1$. Then $y'$ jumps by 1 (the impulse strength) while $y$ stays continuous.` },
    ],
  },
  {
    id: '2.1', course: 'MATH 3705', tag: '§ 2.1', title: 'Basic concepts', chapter: 'Chapter 2 · Series solutions',
    skills: ['sing-pts', 'taylor-coef', 'radius'],
    cards: [
      { kind: 'key', title: 'Why series?', body: R`With constant coefficients, $Ay''+By'+Cy=0$ is solved by $y=e^{rx}$. Once the coefficients depend on $x$, as in $$P(x)\,y''+Q(x)\,y'+R(x)\,y=0,$$ that trick fails. Chapter 2 builds the solutions as power series instead.` },
      { kind: 'key', title: 'Taylor coefficients (Theorem 2.1)', body: R`If $f(x)=\sum a_n(x-x_0)^n$ near $x_0$, then $$a_n = \frac{f^{(n)}(x_0)}{n!}.$$ In particular, if a power series is identically 0 on an interval, every coefficient is 0. That's what lets you set each coefficient to zero when solving ODEs.` },
      { kind: 'key', title: 'Analytic vs singular', body: R`$f$ is analytic at $x_0$ if its Taylor series about $x_0$ converges to $f$ near $x_0$; otherwise $x_0$ is a singular point. Polynomials, $e^x$, $\sin x$ and $\cos x$ are analytic everywhere. Sums, products and quotients of analytic functions are analytic, as long as the denominator is nonzero. So $\frac{P(x)}{Q(x)}$ is singular exactly where $Q=0$ (after cancelling common factors).` },
      { kind: 'method', title: 'Radius of convergence (Theorem 2.4)', body: R`$\sum a_n(x-x_0)^n$ converges for $|x-x_0|<R$ and diverges for $|x-x_0|>R$, where $$R = \lim_{n\to\infty}\left|\frac{a_n}{a_{n+1}}\right|.$$ Keep $a_n$ on top. The centre $x_0$ doesn't affect $R$.` },
      { kind: 'method', title: 'Ordinary and singular points of an ODE', body: R`Divide by $P(x)$ to get the standard form $y''+p(x)y'+q(x)y=0$ with $p=\frac QP$, $q=\frac RP$. $x_0$ is an ordinary point if both $p$ and $q$ are analytic there, and a singular point otherwise. In practice: the zeros of $P$, unless they cancel.` },
      { kind: 'example', title: 'Worked example', body: R`$(x^2-9)\,y'' + e^x y' + y = 0$ has $p = \frac{e^x}{x^2-9}$ and $q=\frac{1}{x^2-9}$. Both fail only where $x^2=9$, so the singular points are $x=\pm3$ and every other point is ordinary.` },
    ],
  },
  {
    id: '2.2', course: 'MATH 3705', tag: '§ 2.2', title: 'Solutions about ordinary points', chapter: 'Chapter 2 · Series solutions',
    skills: ['radius-ode', 'ser-rec', 'series-poly'],
    cards: [
      { kind: 'key', title: 'The guarantee (Theorem 2.5)', body: R`If $x_0$ is an ordinary point, the general solution is a power series $$y=\sum_{n=0}^\infty a_n(x-x_0)^n$$ with $a_0$ and $a_1$ arbitrary. Its radius of convergence is at least the distance from $x_0$ to the nearest singular point, and complex singular points count. With no singular points at all, $R=\infty$.` },
      { kind: 'example', title: 'Radius lower bound', body: R`$(x^2+4)\,y''+y'+y=0$ has singular points $\pm2i$. About $x_0=1$ the distance is $|1-2i| = \sqrt{5}$, so $R \ge \sqrt5$, even though there are no real singular points.` },
      { kind: 'method', title: 'The recipe', body: R`1. Write $y=\sum a_nx^n$, $y'=\sum na_nx^{n-1}$, $y''=\sum n(n-1)a_nx^{n-2}$.<br>2. Substitute, and move any $x$ factors inside the sums.<br>3. Shift indices so every sum shows $x^n$ and starts at the same $n$. The key shift is $$\sum_{n\ge2}n(n-1)a_nx^{n-2}=\sum_{n\ge0}(n+2)(n+1)a_{n+2}x^n.$$ 4. Combine into one sum and set the bracket to 0. That's the recursion relation.<br>5. Step through it starting from $a_0$ and $a_1$.` },
      { kind: 'example', title: 'Worked example: y″ − xy′ − y = 0', body: R`Substituting gives $\sum\big[(n+2)(n+1)a_{n+2} - na_n - a_n\big]x^n = 0$, so $$a_{n+2} = \frac{a_n}{n+2}.$$ Even terms: $a_2=\frac{a_0}{2}$, $a_4=\frac{a_0}{2\cdot4}$, …, giving $y_1 = \sum\frac{x^{2k}}{2^kk!} = e^{x^2/2}$. Odd terms: $a_3=\frac{a_1}{3}$, $a_5=\frac{a_1}{3\cdot5}$, …` },
      { kind: 'key', title: 'Initial conditions', body: R`$a_0 = y(0)$ and $a_1 = y'(0)$. If the recursion is too messy to solve in general, compute $a_2,\dots,a_N$ and use $a_0+a_1x+\dots+a_Nx^N$ as an approximate solution.` },
    ],
  },
  {
    id: '2.3', course: 'MATH 3705', tag: '§ 2.3', title: 'Solutions about regular singular points', chapter: 'Chapter 2 · Series solutions',
    skills: ['classify', 'euler', 'indicial', 'frob-case', 'frob-coef', 'bessel'],
    cards: [
      { kind: 'key', title: 'Regular vs irregular (Definition 2.5)', body: R`Let $x_0$ be a singular point of $y''+py'+qy=0$. It is regular if both $$(x-x_0)\,p(x) \quad\text{and}\quad (x-x_0)^2\,q(x)$$ are analytic at $x_0$, and irregular otherwise. Rule of thumb: $p$ may blow up no worse than $\frac{1}{x-x_0}$, and $q$ no worse than $\frac{1}{(x-x_0)^2}$.` },
      { kind: 'method', title: 'Cauchy–Euler equations', body: R`For $ax^2y''+bxy'+cy=0$, try $y=x^r$ ($x>0$) to get the indicial equation $$ar(r-1)+br+c=0.$$ Distinct real roots give $y=c_1x^{r_1}+c_2x^{r_2}$.<br>A repeated root gives $y=x^{r}(c_1+c_2\ln x)$.<br>Complex roots $\lambda\pm i\mu$ give $y=x^\lambda\big(c_1\cos(\mu\ln x)+c_2\sin(\mu\ln x)\big)$.<br>For $x<0$ use $|x|$. For $(x-x_0)$ versions, substitute $t=x-x_0$.` },
      { kind: 'example', title: 'Worked example (complex roots)', body: R`$x^2y''-xy'+5y=0$: $r(r-1)-r+5=r^2-2r+5=0$, so $r=1\pm2i$ and $$y=x\big(c_1\cos(2\ln x)+c_2\sin(2\ln x)\big).$$` },
      { kind: 'method', title: 'Frobenius method', body: R`Near a regular singular point $x_0=0$, try $y=\sum_{n\ge0}c_nx^{n+r}$. With $p_0 = \lim_{x\to0}x\,p(x)$ and $q_0=\lim_{x\to0}x^2q(x)$, the indicial equation is $$r^2+(p_0-1)r+q_0=0,$$ with roots $r_1\ge r_2$. The larger root always gives a solution $y_1=\sum a_nx^{n+r_1}$.` },
      { kind: 'key', title: 'Which second solution? (Theorem 2.7)', body: R`Case (i), $r_1-r_2$ not an integer: $y_2=\sum b_nx^{n+r_2}$.<br>Case (ii), $r_1=r_2$: $y_2=y_1\ln x+\sum_{n\ge1} b_nx^{n+r_1}$.<br>Case (iii), $r_1-r_2$ a positive integer: $y_2=A\,y_1\ln x+\sum b_nx^{n+r_2}$, where $A$ may be 0.<br>The series converge at least out to the nearest other singular point.` },
      { kind: 'example', title: 'Worked example', body: R`$2x^2y''+3xy'-(1+x)y=0$ has $p_0=\frac32$ and $q_0=-\frac12$, so $r^2+\frac12r-\frac12=0$ and $r_1=\frac12$, $r_2=-1$. The difference $\frac32$ is not an integer, so this is case (i). With $r=\frac12$ the recursion is $a_n = \dfrac{a_{n-1}}{n(2n+3)}$, giving $a_1=\frac15$ and $a_2=\frac{1}{70}$.` },
      { kind: 'key', title: 'Bessel’s equation (Theorem 2.8)', body: R`$x^2y''+xy'+(\lambda^2x^2-\nu^2)y=0$ ($\nu\ge0$, $\lambda>0$) has indicial roots $\pm\nu$. One solution is $y_1=J_\nu(\lambda x)$. For the second, use $y_2 = J_{-\nu}(\lambda x)$ if $\nu$ is not an integer, or $y_2=Y_\nu(\lambda x)$, which works for any $\nu$. When $\nu$ is an integer, $J_{-\nu}$ is just a multiple of $J_\nu$. $$J_\nu(x)=\sum_{k\ge0}\frac{(-1)^k}{k!\,\Gamma(\nu+k+1)}\left(\frac x2\right)^{2k+\nu}$$` },
      { kind: 'example', title: 'Worked example', body: R`$x^2y''+xy'+\left(16x^2-\tfrac14\right)y=0$ has $\lambda=4$ and $\nu=\frac12$. That's not an integer, so $y=c_1J_{1/2}(4x)+c_2J_{-1/2}(4x)$.` },
    ],
  },
];
SECTIONS.push(
  {
    id: 'em', course: 'SYSC 3600', tag: 'Lec 5', num: 'L5', title: 'Modelling electromechanical systems', chapter: 'Quiz 2 · Electromechanical modelling',
    skills: ['sy-order', 'sy-state', 'sy-motor1', 'sy-motortf', 'sy-gear'],
    cards: [
      { kind: 'method', title: 'The four-step procedure', body: R`1. Identify the input (and output).<br>2. Find every energy-storage element. Their number is the order of the system.<br>3. Each element's state gets a first-order ODE from physics (Newton, KVL, KCL).<br>4. Eliminate intermediate variables ($i$, $\tau$, $e_m$, $\tau_s$, …) so that each derivative depends only on states and inputs.` },
      { kind: 'key', title: 'What stores energy (and what doesn\'t)', body: R`Inertia: $\sum\tau = J\dot\omega$ (state $\omega$). Mass: $\sum F = m\dot v$ (state $v$).<br>Torsional spring: $\tau = k\tilde\theta$ (state: twist $\tilde\theta$). Linear spring: $F = k\tilde x$.<br>Inductor: $V_L = L\dot i$ (state $i$). Capacitor: $i = C\dot V_C$ (state $V_C$).<br>Dissipative, no state: resistor $V_R = Ri$, damper $\tau = b\omega$. Gears and transformers just relate variables: $\omega_2 = \frac{r_1}{r_2}\omega_1$, $\tau_2 = \frac{r_2}{r_1}\tau_1$.` },
      { kind: 'key', title: 'The DC motor element', body: R`$$i = \frac{V - e_m}{R},\qquad e_m = k_m\omega,\qquad \tau = k_t\,i$$ The back emf $e_m$ is a built-in feedback: the faster the rotor spins, the less current flows. Substituting gives $\tau = \frac{k_t}{R}V - \frac{k_tk_m}{R}\omega$, which looks like a source plus extra damping $\frac{k_tk_m}{R}$.` },
      { kind: 'example', title: 'Worked example: motor → J₁ → spring → J₂', body: R`Energy storage: $J_1$, $J_2$, spring $k$, so the states are $\omega_1$, $\omega_2$, $\tilde\theta=\theta_1-\theta_2$, and the input is $V$.<br>$J_1$: $J_1\dot\omega_1 = \tau - k\tilde\theta = \frac{k_t}{R}V - \frac{k_tk_m}{R}\omega_1 - k\tilde\theta$.<br>$J_2$: $J_2\dot\omega_2 = k\tilde\theta$.<br>Spring: $\dot{\tilde\theta} = \omega_1 - \omega_2$. $$\dot\omega_1 = \frac{k_t}{J_1R}V - \frac{k_tk_m}{J_1R}\omega_1 - \frac{k}{J_1}\tilde\theta,\quad \dot\omega_2 = \frac{k}{J_2}\tilde\theta,\quad \dot{\tilde\theta} = \omega_1-\omega_2$$` },
      { kind: 'method', title: 'Motor + inertia: the first-order model', body: R`$J\dot\omega + b\omega = \frac{k_t}{R}(V - k_m\omega)$ gives $RJ\dot\omega + (Rb + k_tk_m)\omega = k_tV$, so $$\frac{\Omega(s)}{V(s)} = \frac{G_0}{\tau_ms+1},\qquad G_0 = \frac{k_t}{Rb+k_tk_m},\qquad \tau_m = \frac{RJ}{Rb+k_tk_m}.$$ A step of $V_0$ volts gives $\omega(t) = G_0V_0\left(1-e^{-t/\tau_m}\right)$. Without the back emf you'd wrongly get $\tau = J/b$.` },
      { kind: 'method', title: 'If the inductance is included', body: R`$L\dot i = V - Ri - k_m\omega$ and $J\dot\omega = k_ti - b\omega$: second order, with states $i$ and $\omega$. With zero initial conditions, $$\frac{\Omega(s)}{V(s)} = \frac{k_t}{(Ls+R)(Js+b)+k_tk_m},\qquad \frac{\Theta(s)}{V(s)} = \frac{1}{s}\cdot\frac{\Omega(s)}{V(s)}.$$` },
      { kind: 'key', title: 'Gears', body: R`No slip at the contact: $r_1\omega_1 = r_2\omega_2$. Power is conserved, so $\tau_2 = \frac{r_2}{r_1}\tau_1$: a big output gear trades speed for torque. Reflected onto the motor shaft, a load looks like $\left(\frac{r_1}{r_2}\right)^2J_L$ and $\left(\frac{r_1}{r_2}\right)^2b_L$. Rigidly geared inertias are not independent states.` },
    ],
  },
  {
    id: 'lt', course: 'SYSC 3600', tag: 'Lec 6–7', num: 'L6', title: 'The Laplace transform', chapter: 'Quiz 2 · Laplace transform',
    skills: ['sy-lin', 'sy-basic', 'sy-ode', 'sy-fvt'],
    cards: [
      { kind: 'key', title: 'Definition', body: R`$$F(s) = \mathcal{L}\{f(t)\} = \int_0^\infty f(t)\,e^{-st}\,dt$$ (one-sided: signals are taken as zero for $t<0$, i.e. multiplied by $u(t)$).` },
      { kind: 'key', title: 'Pairs to know cold', body: R`$\delta(t)\to1$, $u(t)\to\frac1s$, $t\to\frac1{s^2}$, $t^n\to\frac{n!}{s^{n+1}}$, $e^{-at}\to\frac{1}{s+a}$<br>$\sin\omega t\to\frac{\omega}{s^2+\omega^2}$, $\cos\omega t\to\frac{s}{s^2+\omega^2}$<br>$e^{-at}\sin\omega t\to\frac{\omega}{(s+a)^2+\omega^2}$, $e^{-at}\cos\omega t\to\frac{s+a}{(s+a)^2+\omega^2}$, $te^{-at}\to\frac{1}{(s+a)^2}$` },
      { kind: 'method', title: 'Properties', body: R`Linearity: $af+bg\to aF+bG$.<br>Shift in $s$: $e^{-at}f(t)\to F(s+a)$.<br>Time delay: $f(t-T)u(t-T)\to e^{-Ts}F(s)$.<br>Derivatives: $\dot f\to sF-f(0)$, $\ddot f\to s^2F-sf(0)-\dot f(0)$.<br>Integral: $\int_0^tf\,d\tau\to\frac{F(s)}{s}$. Convolution: $h*x\to H(s)X(s)$.` },
      { kind: 'example', title: 'Worked example: an ODE', body: R`$\dot y+3y=6$, $y(0)=1$. Transform: $sY-1+3Y=\frac6s$, so $$Y=\frac{s+6}{s(s+3)}=\frac2s-\frac1{s+3}\;\Rightarrow\;y(t)=2-e^{-3t}.$$ Check: $y(0)=1$, and $\dot y+3y = 3e^{-3t}+6-3e^{-3t}=6$.` },
      { kind: 'key', title: 'Initial and final value theorems', body: R`$$y(0^+)=\lim_{s\to\infty}sY(s),\qquad y(\infty)=\lim_{s\to0}sY(s)$$ The final value theorem only holds if every pole of $sY(s)$ is in the left half-plane; a single pole of $Y$ at $s=0$ is fine. Example: $Y=\frac{10}{s(s+2)(s+5)}$ gives $y(\infty)=\frac{10}{10}=1$.` },
    ],
  },
  {
    id: 'pfe', course: 'SYSC 3600', tag: 'Lec 7', num: 'PFE', title: 'Inverse Laplace by partial fractions', chapter: 'Quiz 2 · Inverse Laplace transform',
    skills: ['sy-pf2', 'sy-pf3', 'sy-pfrep', 'sy-pfcx', 'sy-ivp'],
    cards: [
      { kind: 'key', title: 'The idea', body: R`Split $F(s)=\frac{B(s)}{A(s)}$ into simple terms that are each in the table. It must be proper ($\deg B<\deg A$); if not, long-divide first. You get one term per pole, counting repeats.` },
      { kind: 'method', title: 'Distinct real poles: cover-up', body: R`$$F(s)=\sum_k\frac{a_k}{s+p_k},\qquad a_k=\Big[(s+p_k)F(s)\Big]_{s=-p_k},\qquad f(t)=\sum_k a_ke^{-p_kt}.$$ Example: $\frac{s+3}{(s+1)(s+2)}$: $a_1=\frac{-1+3}{-1+2}=2$ and $a_2=\frac{-2+3}{-2+1}=-1$, so $f=2e^{-t}-e^{-2t}$.` },
      { kind: 'method', title: 'Repeated poles', body: R`$(s+p)^r$ needs $r$ terms: $\frac{b_r}{(s+p)^r}+\dots+\frac{b_1}{s+p}$, with $$b_r=\Big[(s+p)^rF\Big]_{s=-p},\qquad b_{r-1}=\frac{d}{ds}\Big[(s+p)^rF\Big]_{s=-p},\ \dots$$ Invert with $\frac{1}{(s+p)^k}\to\frac{t^{k-1}}{(k-1)!}e^{-pt}$. Example: $\frac{s+3}{(s+1)^2}=\frac{1}{s+1}+\frac{2}{(s+1)^2}$, so $f=e^{-t}+2te^{-t}$.` },
      { kind: 'method', title: 'Complex poles: complete the square', body: R`Keep the quadratic and write it as $(s+\sigma)^2+\omega^2$. Split the numerator as $A(s+\sigma)+B\omega$: $$\frac{A(s+\sigma)+B\omega}{(s+\sigma)^2+\omega^2}\to e^{-\sigma t}\big(A\cos\omega t+B\sin\omega t\big).$$ Example: $\frac{2s+8}{s^2+2s+5}=\frac{2(s+1)+3\cdot2}{(s+1)^2+4}$, so $f=e^{-t}(2\cos2t+3\sin2t)$.` },
      { kind: 'key', title: 'Sanity checks', body: R`Count: the number of terms equals the number of poles. Initial value: $f(0^+)$ must equal $\lim_{s\to\infty}sF(s)$. Stability: poles in the left half-plane give decaying terms; a pole at $0$ gives a constant (step).` },
    ],
  },
);
SECTIONS.forEach((sec) => { if (!sec.num) sec.num = sec.id; });
const MASTERY_STREAK = 3;

// Tidy generated TeX: \frac{X}{1} -> X
function tidyTex(str) {
  if (typeof str !== 'string') return str;
  let out = str;
  for (let i = 0; i < 2; i++) out = out.replace(/\\frac\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}\{1\}/g, '{$1}');
  return out;
}
function tidyQuestion(q) {
  q.prompt = tidyTex(q.prompt);
  q.answerTex = tidyTex(q.answerTex);
  q.steps.forEach((s) => { s.body = tidyTex(s.body); });
  (q.mistakes || []).forEach((m) => { m.why = tidyTex(m.why); });
  (q.options || []).forEach((o) => { o.tex = tidyTex(o.tex); o.why = tidyTex(o.why); });
  return q;
}

// Build a checkable question from a generator
function makeQuestion(topic) {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const q = tidyQuestion(topic.gen());
      q.topic = topic;
      q.type = q.type || 'expr';
      q.tol = q.tol || 1e-6;
      q.vars = q.vars || [];
      const keyIndex = Object.fromEntries(q.steps.map((s, i) => [s.key, i]));
      const stepIdx = (k) => (keyIndex[k] != null ? keyIndex[k] : -1);
      if (q.type === 'choice') {
        q.options = q.options.slice().sort(() => Math.random() - 0.5);
        q.options.forEach((o) => { o.stepIndex = stepIdx(o.step); });
        q.mistakes = [];
        return q;
      }
      if (q.type === 'set') {
        q.mistakes = q.mistakes.filter((m, i, arr) => m.set.every(Number.isFinite) && !sameSet(m.set, q.answerSet)
          && !arr.slice(0, i).some((p) => sameSet(p.set, m.set)));
        q.mistakes.forEach((m) => { m.stepIndex = stepIdx(m.step); });
        return q;
      }
      q.samples = Array.from({ length: q.vars.length ? 10 : 1 }, () => q.sample());
      q.answerAst = parse(q.answer, q.vars);
      q.answerVals = valuesAt(q.answerAst, q.samples);
      if (q.answerVals.filter(Number.isFinite).length < Math.min(4, q.samples.length)) continue;
      const kept = [];
      for (const m of q.mistakes) {
        try {
          m.vals = valuesAt(parse(m.expr, q.vars), q.samples);
          m.stepIndex = stepIdx(m.step);
          if (sameValues(q.answerVals, m.vals, q.tol)) continue;
          if (kept.some((k) => sameValues(k.vals, m.vals, q.tol))) continue;
          kept.push(m);
        } catch (e) { /* skip unparsable mistake */ }
      }
      q.mistakes = kept;
      return q;
    } catch (e) {
      if (attempt === 19) throw e;
    }
  }
  throw new Error('Could not generate a question');
}

/* ---------- set answers ---------- */
function uniqNums(arr) {
  const out = [];
  for (const v of arr) if (!out.some((u) => Math.abs(u - v) < 1e-6 * Math.max(1, Math.abs(v)))) out.push(v);
  return out;
}
function sameSet(a, b) {
  const A = uniqNums(a), B = uniqNums(b);
  return A.length === B.length && A.every((v) => B.some((u) => Math.abs(u - v) < 1e-6 * Math.max(1, Math.abs(v))));
}
function parseSet(text) {
  const items = text.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (!items.length) throw new ParseError('Empty answer');
  return items.map((it) => {
    const ast = parse(it.replace(/^[a-z]\s*=\s*/i, ''), []);
    return { ast, v: evaluate(ast, {}) };
  });
}
function diagnoseSet(q, vals) {
  if (sameSet(vals, q.answerSet)) return { correct: true };
  for (const m of q.mistakes) if (sameSet(vals, m.set)) return { correct: false, mistake: m };
  const truth = uniqNums(q.answerSet), got = uniqNums(vals);
  const has = (arr, v) => arr.some((u) => Math.abs(u - v) < 1e-6 * Math.max(1, Math.abs(v)));
  const missing = truth.filter((v) => !has(got, v)), extra = got.filter((v) => !has(truth, v));
  const fmt = (arr) => arr.map((v) => `$${niceFactor(v)}$`).join(', ');
  const parts = [];
  if (missing.length && missing.length < truth.length) parts.push(`You're missing ${fmt(missing)}.`);
  if (extra.length) parts.push(`${fmt(extra)} ${extra.length > 1 ? "don't" : "doesn't"} belong.`);
  if (missing.length === truth.length && !extra.length) parts.push('None of the expected values appear.');
  return { correct: false, generic: parts.join(' ') || undefined };
}

/* ================================================================== */
/* Drawing board                                                       */
/* ================================================================== */
const INK = { blue: '#2f6fde', red: '#e5484d', green: '#2e9d5b' };

class Board {
  constructor(parent, opts) {
    this.opts = opts; // { scrollEl, penOnly: () => bool }
    this.strokes = [];
    this.undoStack = [];
    this.tool = 'pen';
    this.color = 'ink';
    this.height = 560;
    this.wrap = document.createElement('div');
    this.wrap.className = 'sa-canvas-wrap';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sa-canvas';
    this.wrap.appendChild(this.canvas);
    parent.appendChild(this.wrap);
    this.ctx = this.canvas.getContext('2d');
    this.active = null;
    this.scrolling = null;
    this.bind();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.wrap);
    this.resize();
  }
  destroy() { this.ro.disconnect(); }
  resize() {
    const w = this.wrap.clientWidth || 600;
    const dpr = window.devicePixelRatio || 1;
    this.w = w;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redraw();
  }
  addSpace() { this.height += 480; this.resize(); }
  inkColor(key) {
    if (key !== 'ink') return INK[key];
    return getComputedStyle(this.canvas).getPropertyValue('--text-normal').trim() || '#222';
  }
  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  pressure(e) {
    if (e.pointerType === 'pen') return e.pressure > 0 ? e.pressure : 0.5;
    return 0.5;
  }
  bind() {
    const c = this.canvas;
    const stop = (e) => e.stopPropagation();
    c.addEventListener('touchstart', stop, { passive: true });
    c.addEventListener('touchmove', (e) => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); }, { passive: false });
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('pointerup', (e) => this.up(e));
    c.addEventListener('pointercancel', (e) => this.up(e));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(e) {
    if (e.pointerType === 'touch' && this.opts.penOnly()) {
      // fingers scroll the page instead of drawing (palm-friendly)
      this.scrolling = { id: e.pointerId, y: e.clientY };
      return;
    }
    if (this.active) return;
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const penEraser = e.pointerType === 'pen' && ((e.buttons & 32) || (e.buttons & 2) || e.button === 5);
    const [x, y] = this.pos(e);
    if (this.tool === 'eraser' || penEraser) {
      this.undoStack.push(this.strokes.slice());
      this.active = { id: e.pointerId, erase: true, changed: false };
      this.eraseAt(x, y);
      return;
    }
    this.undoStack.push(this.strokes.slice());
    if (this.undoStack.length > 100) this.undoStack.shift();
    const stroke = { color: this.color, pts: [[x, y, this.pressure(e)]] };
    this.active = { id: e.pointerId, stroke };
    this.strokes.push(stroke);
    this.drawDot(stroke);
  }
  move(e) {
    if (this.scrolling && e.pointerId === this.scrolling.id) {
      const dy = e.clientY - this.scrolling.y;
      this.scrolling.y = e.clientY;
      if (this.opts.scrollEl) this.opts.scrollEl.scrollTop -= dy;
      return;
    }
    if (!this.active || e.pointerId !== this.active.id) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      const [x, y] = this.pos(ev);
      if (this.active.erase) { this.eraseAt(x, y); continue; }
      const s = this.active.stroke;
      s.pts.push([x, y, this.pressure(ev)]);
      this.drawTail(s);
    }
  }
  up(e) {
    if (this.scrolling && e.pointerId === this.scrolling.id) { this.scrolling = null; return; }
    if (!this.active || e.pointerId !== this.active.id) return;
    if (this.active.erase && !this.active.changed) this.undoStack.pop();
    this.active = null;
  }
  eraseAt(x, y) {
    const r = 14;
    const before = this.strokes.length;
    this.strokes = this.strokes.filter((s) => !s.pts.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 < r * r));
    if (this.strokes.length !== before) { this.active.changed = true; this.redraw(); }
  }
  width(p) { return 1.2 + 2.6 * p; }
  drawDot(s) {
    const [x, y, p] = s.pts[0];
    this.ctx.fillStyle = this.inkColor(s.color);
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.width(p) / 2, 0, Math.PI * 2);
    this.ctx.fill();
  }
  // draw the newest segment using midpoint quadratic smoothing
  drawTail(s, i = s.pts.length - 1) {
    const ctx = this.ctx, pts = s.pts;
    if (i < 1) return;
    const p0 = pts[Math.max(0, i - 2)], p1 = pts[i - 1], p2 = pts[i];
    const m1 = i >= 2 ? [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2] : [p1[0], p1[1]];
    const m2 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    ctx.strokeStyle = this.inkColor(s.color);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.width((p1[2] + p2[2]) / 2);
    ctx.beginPath();
    ctx.moveTo(m1[0], m1[1]);
    ctx.quadraticCurveTo(p1[0], p1[1], m2[0], m2[1]);
    ctx.stroke();
  }
  redraw() {
    this.ctx.clearRect(0, 0, this.w || 10000, this.height);
    for (const s of this.strokes) {
      this.drawDot(s);
      for (let i = 1; i < s.pts.length; i++) this.drawTail(s, i);
    }
  }
  undo() { if (this.undoStack.length) { this.strokes = this.undoStack.pop(); this.redraw(); } }
  clear() { if (this.strokes.length) { this.undoStack.push(this.strokes.slice()); this.strokes = []; this.redraw(); } }
  reset() { this.strokes = []; this.undoStack = []; this.height = 560; this.resize(); }
  isEmpty() { return this.strokes.length === 0; }
  // Export only the inked area on white, for saving into the vault
  async toPng() {
    if (!this.strokes.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of this.strokes) for (const [x, y] of s.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const pad = 24, scale = 2;
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((x1 - x0) * scale); cv.height = Math.ceil((y1 - y0) * scale);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
    const saved = { ctx: this.ctx, inkColor: this.inkColor };
    this.ctx = ctx;
    this.inkColor = (k) => (k === 'ink' ? '#111111' : INK[k]);
    for (const s of this.strokes) { this.drawDot(s); for (let i = 1; i < s.pts.length; i++) this.drawTail(s, i); }
    this.ctx = saved.ctx; this.inkColor = saved.inkColor;
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    return blob ? await blob.arrayBuffer() : null;
  }
}

/* ================================================================== */
/* Math rendering                                                      */
/* ================================================================== */
function mathEl(tex, display) {
  try {
    if (obsidian.renderMath) return obsidian.renderMath(tex, display);
  } catch (e) { /* fall through */ }
  const span = document.createElement('span');
  span.textContent = tex;
  return span;
}
function flushMath() { try { obsidian.finishRenderMath && obsidian.finishRenderMath(); } catch (e) { /* ignore */ } }
// Render a string containing $inline$ / $$display$$ math and <br>
function renderRich(el, str) {
  // \$ and \% are literal characters (currency); inside math they are passed through to TeX.
  const re = /\$\$((?:\\[\s\S]|[^$\\])+?)\$\$|\$((?:\\[\s\S]|[^$\\])+?)\$|<br>|\\[$%]/g;
  const text = (t) => el.appendChild(document.createTextNode(t));
  let last = 0, m;
  str = String(str);
  while ((m = re.exec(str))) {
    if (m.index > last) text(str.slice(last, m.index));
    if (m[0].length === 2 && m[0][0] === '\\') { text(m[0][1]); last = re.lastIndex; continue; }
    if (m[0] === '<br>') el.appendChild(document.createElement('br'));
    else if (m[1] != null) { const d = document.createElement('div'); d.className = 'sa-display'; d.appendChild(mathEl(m[1], true)); el.appendChild(d); }
    else el.appendChild(mathEl(m[2], false));
    last = re.lastIndex;
  }
  if (last < str.length) text(str.slice(last));
  flushMath();
}

/* ================================================================== */
/* Interactive widgets (SVG, no libraries)                             */
/* ================================================================== */
const SVGNS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}
function niceStep(range, target = 6) {
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}
function ticks(min, max, target) {
  const step = niceStep(max - min, target);
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9 * step; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}
const tickLabel = (v) => (Math.abs(v) >= 1e6 ? `${+(v / 1e6).toPrecision(3)}M` : Math.abs(v) >= 1e4 ? `${+(v / 1e3).toPrecision(3)}k` : Math.abs(v) < 1e-3 && v !== 0 ? v.toExponential(0) : String(+v.toPrecision(4)));
const PALETTE = ['var(--sa-c1)', 'var(--sa-c2)', 'var(--sa-c3)', 'var(--sa-c4)', 'var(--sa-c5)'];
const colorOf = (c, i) => (c == null ? PALETTE[i % PALETTE.length] : typeof c === 'number' ? PALETTE[c % PALETTE.length] : c);
let clipSeq = 0;

// 2-D function plot. spec: {x:[a,b], y:[c,d]|'auto', xLabel, yLabel, curves(p)|curves:[{fn,label,color,dash,width}], areas(p), points(p), vlines(p), hlines(p)}
function drawPlot(svgRoot, spec, p, box) {
  const W = box.w, H = box.h, m = { l: 46, r: 14, t: 14, b: 34 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const xr = typeof spec.x === 'function' ? spec.x(p) : spec.x;
  const curves = (typeof spec.curves === 'function' ? spec.curves(p) : spec.curves || []).filter(Boolean);
  const N = spec.samples || 320;
  const sampled = curves.map((c) => {
    const pts = [];
    for (let k = 0; k <= N; k++) {
      const x = xr[0] + ((xr[1] - xr[0]) * k) / N;
      let y; try { y = c.fn(x, p); } catch (e) { y = NaN; }
      pts.push([x, y]);
    }
    return pts;
  });
  let yr = typeof spec.y === 'function' ? spec.y(p) : spec.y;
  if (!yr || yr === 'auto') {
    let lo = Infinity, hi = -Infinity;
    for (const pts of sampled) for (const [, y] of pts) if (Number.isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
    if (!Number.isFinite(lo)) { lo = -1; hi = 1; }
    if (spec.includeZero !== false) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const pad = (hi - lo) * 0.08 || 1;
    yr = [lo - pad, hi + pad];
  }
  const X = (x) => m.l + ((x - xr[0]) / (xr[1] - xr[0])) * pw;
  const Y = (y) => m.t + (1 - (y - yr[0]) / (yr[1] - yr[0])) * ph;
  const g = svg('g', {}, svgRoot);
  const clipId = `sa-clip-${++clipSeq}`;
  const defs = svg('defs', {}, g);
  const cp = svg('clipPath', { id: clipId }, defs);
  svg('rect', { x: m.l, y: m.t, width: pw, height: ph }, cp);
  // grid + ticks
  for (const t of ticks(xr[0], xr[1], 7)) {
    svg('line', { x1: X(t), x2: X(t), y1: m.t, y2: m.t + ph, class: 'sa-grid' }, g);
    svg('text', { x: X(t), y: m.t + ph + 16, class: 'sa-tick', 'text-anchor': 'middle' }, g).textContent = tickLabel(t);
  }
  for (const t of ticks(yr[0], yr[1], 5)) {
    svg('line', { x1: m.l, x2: m.l + pw, y1: Y(t), y2: Y(t), class: 'sa-grid' }, g);
    svg('text', { x: m.l - 6, y: Y(t) + 4, class: 'sa-tick', 'text-anchor': 'end' }, g).textContent = tickLabel(t);
  }
  if (yr[0] < 0 && yr[1] > 0) svg('line', { x1: m.l, x2: m.l + pw, y1: Y(0), y2: Y(0), class: 'sa-axis' }, g);
  if (xr[0] < 0 && xr[1] > 0) svg('line', { x1: X(0), x2: X(0), y1: m.t, y2: m.t + ph, class: 'sa-axis' }, g);
  svg('rect', { x: m.l, y: m.t, width: pw, height: ph, class: 'sa-frame' }, g);
  if (spec.xLabel) svg('text', { x: m.l + pw, y: H - 4, class: 'sa-axis-label', 'text-anchor': 'end' }, g).textContent = spec.xLabel;
  if (spec.yLabel) svg('text', { x: 4, y: m.t + 2, class: 'sa-axis-label', 'dominant-baseline': 'hanging' }, g).textContent = spec.yLabel;
  const inner = svg('g', { 'clip-path': `url(#${clipId})` }, g);
  // shaded areas: {fn, a, b, color}
  for (const [i, a] of ((typeof spec.areas === 'function' ? spec.areas(p) : spec.areas) || []).entries()) {
    const lo = Math.max(a.a, xr[0]), hi = Math.min(a.b, xr[1]);
    if (!(hi > lo)) continue;
    let d = `M${X(lo)},${Y(0)}`;
    const n = 120;
    for (let k = 0; k <= n; k++) { const x = lo + ((hi - lo) * k) / n; let y; try { y = a.fn(x, p); } catch (e) { y = 0; } if (!Number.isFinite(y)) y = 0; d += `L${X(x)},${Y(Math.max(Math.min(y, yr[1] * 2), yr[0] * 2))}`; }
    d += `L${X(hi)},${Y(0)}Z`;
    svg('path', { d, class: 'sa-area', style: `fill:${colorOf(a.color, i)}` }, inner);
  }
  for (const v of (typeof spec.hlines === 'function' ? spec.hlines(p) : spec.hlines) || []) {
    svg('line', { x1: m.l, x2: m.l + pw, y1: Y(v.y), y2: Y(v.y), class: 'sa-refline' }, inner);
    if (v.label) svg('text', { x: m.l + pw - 4, y: Y(v.y) - 4, class: 'sa-ref-label', 'text-anchor': 'end' }, inner).textContent = v.label;
  }
  for (const v of (typeof spec.vlines === 'function' ? spec.vlines(p) : spec.vlines) || []) {
    svg('line', { x1: X(v.x), x2: X(v.x), y1: m.t, y2: m.t + ph, class: 'sa-refline' }, inner);
    if (v.label) svg('text', { x: X(v.x) + 4, y: m.t + 12, class: 'sa-ref-label' }, inner).textContent = v.label;
  }
  sampled.forEach((pts, i) => {
    const c = curves[i];
    let d = '', pen = false;
    const yLo = yr[0] - (yr[1] - yr[0]) * 3, yHi = yr[1] + (yr[1] - yr[0]) * 3;
    for (const [x, y] of pts) {
      if (!Number.isFinite(y) || y < yLo || y > yHi) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`; pen = true;
    }
    svg('path', { d, class: 'sa-curve', style: `stroke:${colorOf(c.color, i)};stroke-width:${c.width || 2.4}px;${c.dash ? 'stroke-dasharray:6 5;' : ''}` }, inner);
  });
  for (const pt of (typeof spec.points === 'function' ? spec.points(p) : spec.points) || []) {
    if (!Number.isFinite(pt.y)) continue;
    svg('circle', { cx: X(pt.x), cy: Y(pt.y), r: 4.5, class: 'sa-point', style: pt.color != null ? `fill:${colorOf(pt.color, 0)}` : '' }, inner);
    if (pt.label) svg('text', { x: X(pt.x) + 7, y: Y(pt.y) - 7, class: 'sa-point-label' }, inner).textContent = pt.label;
  }
  // legend
  const labeled = curves.map((c, i) => ({ c, i })).filter(({ c }) => c.label);
  if (labeled.length) {
    let lx = m.l + 8;
    labeled.forEach(({ c, i }) => {
      svg('line', { x1: lx, x2: lx + 16, y1: m.t + 12, y2: m.t + 12, style: `stroke:${colorOf(c.color, i)};stroke-width:3px;${c.dash ? 'stroke-dasharray:4 3;' : ''}` }, g);
      const t = svg('text', { x: lx + 20, y: m.t + 16, class: 'sa-legend' }, g);
      t.textContent = c.label;
      lx += 30 + c.label.length * 7;
    });
  }
}

// Cash flow diagram. spec: {flows(p) -> [{t, amount, label}], n(p)|n, unit}
function drawCashflow(svgRoot, spec, p, box) {
  const W = box.w, H = box.h, m = { l: 22, r: 22, t: 26, b: 26 };
  const flows = (typeof spec.flows === 'function' ? spec.flows(p) : spec.flows) || [];
  const n = Math.max(1, typeof spec.n === 'function' ? spec.n(p) : spec.n || Math.max(...flows.map((f) => f.t), 1));
  const maxA = Math.max(...flows.map((f) => Math.abs(f.amount)), 1);
  const X = (t) => m.l + (t / n) * (W - m.l - m.r);
  const y0 = H / 2, half = H / 2 - m.t;
  const g = svg('g', {}, svgRoot);
  svg('line', { x1: m.l - 6, x2: W - m.r + 6, y1: y0, y2: y0, class: 'sa-axis' }, g);
  const every = n > 24 ? Math.ceil(n / 12) : 1;
  for (let t = 0; t <= n; t++) {
    svg('line', { x1: X(t), x2: X(t), y1: y0 - 4, y2: y0 + 4, class: 'sa-axis' }, g);
    if (t % every === 0 || t === n) svg('text', { x: X(t), y: y0 + (flows.some((f) => f.t === t && f.amount < 0) ? -8 : 18), class: 'sa-tick', 'text-anchor': 'middle' }, g).textContent = String(t);
  }
  if (spec.unit) svg('text', { x: W - m.r + 6, y: y0 - 8, class: 'sa-axis-label', 'text-anchor': 'end' }, g).textContent = spec.unit;
  const byT = {};
  for (const f of flows) (byT[f.t] = byT[f.t] || []).push(f);
  for (const f of flows) {
    if (!f.amount) continue;
    const stack = byT[f.t].filter((o) => Math.sign(o.amount) === Math.sign(f.amount));
    const k = stack.indexOf(f), w = stack.length;
    const x = X(f.t) + (w > 1 ? (k - (w - 1) / 2) * 7 : 0);
    const len = Math.max(10, (Math.abs(f.amount) / maxA) * (half - 14));
    const up = f.amount > 0;
    const y1 = up ? y0 - len : y0 + len;
    const cls = up ? 'sa-flow-in' : 'sa-flow-out';
    svg('line', { x1: x, x2: x, y1: y0, y2: y1, class: cls }, g);
    svg('path', { d: up ? `M${x - 5},${y1 + 8}L${x},${y1}L${x + 5},${y1 + 8}` : `M${x - 5},${y1 - 8}L${x},${y1}L${x + 5},${y1 - 8}`, class: cls + ' sa-arrowhead' }, g);
    if (f.label !== '' && (w === 1 || k === 0)) {
      const txt = f.label != null ? f.label : `${up ? '' : '−'}${fmtMoney(Math.abs(f.amount))}`;
      svg('text', { x: f.t >= n && n > 6 ? x + 6 : x, y: up ? y1 - 6 : y1 + 15, class: 'sa-flow-label', 'text-anchor': f.t >= n && n > 6 ? 'end' : 'middle' }, g).textContent = txt;
    }
  }
}
function fmtMoney(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return `$${+(v / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `$${Math.round(v / 1e3)}k`;
  return `$${+v.toFixed(2)}`.replace(/\.00$/, '');
}

// s-plane: poles(p) -> [{re,im}], zeros(p)
function drawSPlane(svgRoot, spec, p, box) {
  const W = box.w, H = box.h, m = 24;
  const lim = spec.lim || 5;
  const X = (re) => m + ((re + lim) / (2 * lim)) * (W - 2 * m);
  const Y = (im) => m + ((lim - im) / (2 * lim)) * (H - 2 * m);
  const g = svg('g', {}, svgRoot);
  svg('rect', { x: m, y: m, width: (W - 2 * m) / 2, height: H - 2 * m, class: 'sa-lhp' }, g);
  svg('line', { x1: m, x2: W - m, y1: Y(0), y2: Y(0), class: 'sa-axis' }, g);
  svg('line', { x1: X(0), x2: X(0), y1: m, y2: H - m, class: 'sa-axis' }, g);
  svg('text', { x: W - m, y: Y(0) - 6, class: 'sa-axis-label', 'text-anchor': 'end' }, g).textContent = 'Re';
  svg('text', { x: X(0) + 6, y: m + 10, class: 'sa-axis-label' }, g).textContent = 'Im';
  svg('text', { x: m + 6, y: H - m - 6, class: 'sa-tick' }, g).textContent = 'stable side';
  for (const t of ticks(-lim, lim, 5)) if (t) svg('text', { x: X(t), y: Y(0) + 14, class: 'sa-tick', 'text-anchor': 'middle' }, g).textContent = tickLabel(t);
  for (const z of (spec.zeros ? spec.zeros(p) : [])) svg('circle', { cx: X(z.re), cy: Y(z.im), r: 6, class: 'sa-zero' }, g);
  for (const q of spec.poles(p)) {
    const x = X(Math.max(-lim, Math.min(lim, q.re))), y = Y(Math.max(-lim, Math.min(lim, q.im)));
    svg('path', { d: `M${x - 6},${y - 6}L${x + 6},${y + 6}M${x - 6},${y + 6}L${x + 6},${y - 6}`, class: 'sa-pole' }, g);
  }
}

// Block diagram (static): {forward:[labels], feedback:label|null, sign:'-'|'+', input:'R', output:'C'}
function drawBlocks(svgRoot, spec, p, box) {
  const W = box.w, H = box.h;
  const g = svg('g', {}, svgRoot);
  const fw = spec.forward || [];
  const yMid = spec.feedback ? H * 0.38 : H / 2;
  const sumX = 70, bw = 96, bh = 40, gap = 34;
  const startX = sumX + 18 + gap;
  const arrow = (x1, y1, x2, y2) => { svg('line', { x1, y1, x2, y2, class: 'sa-wire' }, g); const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1); svg('path', { d: `M${x2 - 7 * dx - 5 * dy},${y2 - 7 * dy - 5 * dx}L${x2},${y2}L${x2 - 7 * dx + 5 * dy},${y2 - 7 * dy + 5 * dx}`, class: 'sa-wire sa-arrowhead' }, g); };
  svg('text', { x: 8, y: yMid - 8, class: 'sa-block-io' }, g).textContent = spec.input || 'R(s)';
  if (spec.feedback) {
    svg('circle', { cx: sumX, cy: yMid, r: 14, class: 'sa-sum' }, g);
    svg('text', { x: sumX - 22, y: yMid - 14, class: 'sa-tick' }, g).textContent = '+';
    svg('text', { x: sumX - 14, y: yMid + 28, class: 'sa-tick' }, g).textContent = spec.sign || '−';
    arrow(8, yMid, sumX - 14, yMid);
  }
  let x = spec.feedback ? sumX + 14 : 8;
  fw.forEach((lab, i) => {
    const bx = startX + i * (bw + gap);
    arrow(x, yMid, bx, yMid);
    svg('rect', { x: bx, y: yMid - bh / 2, width: bw, height: bh, rx: 6, class: 'sa-block' }, g);
    svg('text', { x: bx + bw / 2, y: yMid + 5, class: 'sa-block-label', 'text-anchor': 'middle' }, g).textContent = lab;
    x = bx + bw;
  });
  const outX = Math.min(W - 10, x + gap + 20);
  arrow(x, yMid, outX, yMid);
  svg('text', { x: outX - 34, y: yMid - 8, class: 'sa-block-io' }, g).textContent = spec.output || 'C(s)';
  if (spec.feedback) {
    const tapX = x + gap / 2 + 4, fy = H * 0.8;
    svg('circle', { cx: tapX, cy: yMid, r: 3, class: 'sa-tap' }, g);
    svg('line', { x1: tapX, y1: yMid, x2: tapX, y2: fy, class: 'sa-wire' }, g);
    const fbx = (sumX + tapX) / 2 - bw / 2;
    arrow(tapX, fy, fbx + bw, fy);
    svg('rect', { x: fbx, y: fy - bh / 2, width: bw, height: bh, rx: 6, class: 'sa-block' }, g);
    svg('text', { x: fbx + bw / 2, y: fy + 5, class: 'sa-block-label', 'text-anchor': 'middle' }, g).textContent = spec.feedback;
    svg('line', { x1: fbx, y1: fy, x2: sumX, y2: fy, class: 'sa-wire' }, g);
    arrow(sumX, fy, sumX, yMid + 14);
  }
}


// Simulation diagram: integrator chain with feedback gains.
// spec: {n, input:'u', output:'y', inGain:'b' | null, signals:['ÿ','ẏ','y'], fb:[label for each integrator output, null = none]}
function drawChain(svgRoot, spec, p, box) {
  const W = box.w, H = box.h, n = spec.n || 2;
  const g = svg('g', {}, svgRoot);
  const yMid = 56, bw = 54, bh = 36;
  const arrow = (x1, y1, x2, y2) => { svg('line', { x1, y1, x2, y2, class: 'sa-wire' }, g); const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1); svg('path', { d: `M${x2 - 7 * dx - 5 * dy},${y2 - 7 * dy - 5 * dx}L${x2},${y2}L${x2 - 7 * dx + 5 * dy},${y2 - 7 * dy + 5 * dx}`, class: 'sa-wire sa-arrowhead' }, g); };
  let x = 8;
  svg('text', { x, y: yMid - 10, class: 'sa-block-io' }, g).textContent = spec.input || 'u';
  if (spec.inGain) {
    arrow(x, yMid, x + 34, yMid);
    svg('path', { d: `M${x + 34},${yMid - 16}L${x + 66},${yMid}L${x + 34},${yMid + 16}Z`, class: 'sa-block' }, g);
    svg('text', { x: x + 46, y: yMid + 4, class: 'sa-block-label', 'text-anchor': 'middle', style: 'font-size:12px' }, g).textContent = spec.inGain;
    x += 66;
  }
  const sumX = x + 34;
  arrow(x, yMid, sumX - 14, yMid);
  svg('circle', { cx: sumX, cy: yMid, r: 14, class: 'sa-sum' }, g);
  svg('text', { x: sumX, y: yMid + 5, class: 'sa-tick', 'text-anchor': 'middle' }, g).textContent = 'Σ';
  const span = (W - sumX - 60) / n;
  const taps = [];
  let cx = sumX + 14;
  const sig = spec.signals || [];
  for (let i = 0; i < n; i++) {
    const bx = sumX + 14 + span * i + (span - bw) / 2 + 6;
    arrow(cx, yMid, bx, yMid);
    if (sig[i]) svg('text', { x: (cx + bx) / 2, y: yMid - 8, class: 'sa-tick', 'text-anchor': 'middle' }, g).textContent = sig[i];
    svg('rect', { x: bx, y: yMid - bh / 2, width: bw, height: bh, rx: 6, class: 'sa-block' }, g);
    svg('text', { x: bx + bw / 2, y: yMid + 7, class: 'sa-block-label', 'text-anchor': 'middle', style: 'font-size:20px' }, g).textContent = '∫';
    cx = bx + bw;
    taps.push(cx + 14);
  }
  arrow(cx, yMid, W - 8, yMid);
  if (sig[n]) svg('text', { x: W - 30, y: yMid - 8, class: 'sa-block-io' }, g).textContent = sig[n];
  (spec.fb || []).forEach((lab, i) => {
    if (!lab) return;
    const tx = taps[i], fy = yMid + 40 + 34 * (n - 1 - i);
    svg('circle', { cx: tx, cy: yMid, r: 3, class: 'sa-tap' }, g);
    svg('line', { x1: tx, y1: yMid, x2: tx, y2: fy, class: 'sa-wire' }, g);
    const gx = (sumX + tx) / 2;
    arrow(tx, fy, gx + 22, fy);
    svg('path', { d: `M${gx + 22},${fy - 13}L${gx - 8},${fy}L${gx + 22},${fy + 13}Z`, class: 'sa-block' }, g);
    svg('text', { x: gx + 10, y: fy + 4, class: 'sa-block-label', 'text-anchor': 'middle', style: 'font-size:12px' }, g).textContent = lab;
    svg('line', { x1: gx - 8, y1: fy, x2: sumX + (i % 2 ? 6 : -6), y2: fy, class: 'sa-wire' }, g);
    arrow(sumX + (i % 2 ? 6 : -6), fy, sumX + (i % 2 ? 6 : -6), yMid + 13);
    svg('text', { x: sumX + (i % 2 ? 10 : -16), y: yMid + 26, class: 'sa-tick' }, g).textContent = '−';
  });
}


// Free-form diagram with equal x/y scale (Mohr's circles, stress elements, cross-sections, wave fronts).
// spec: {kind:'sketch', view:[x0,x1,y0,y1] | (p)=>[...], axes:{x:'σ', y:'τ', ticks:true}, items:(p)=>[item...]}
// items (data coordinates, y up):
//  {t:'line'|'arrow', x1,y1,x2,y2, color, dash, width}   {t:'poly', pts:[[x,y]...], fill, color, open}
//  {t:'circle', x,y,r, color, fill, dash}   {t:'dot', x,y, color, size}   {t:'arc', x,y,r, a0,a1 (rad), color}
//  {t:'text', x,y, text, color, anchor:'start'|'middle'|'end', dx,dy (px), size, bold}
// color: palette index 0–4, 'text', 'muted', or any CSS colour.
function drawSketch(svgRoot, spec, p, box) {
  const W = box.w, H = box.h, m = 18;
  const v = typeof spec.view === 'function' ? spec.view(p) : spec.view || [-1, 1, -1, 1];
  const [x0, x1, y0, y1] = v;
  const k = Math.min((W - 2 * m) / (x1 - x0), (H - 2 * m) / (y1 - y0));
  const ox = (W - k * (x1 - x0)) / 2, oy = (H - k * (y1 - y0)) / 2;
  const X = (x) => ox + (x - x0) * k, Y = (y) => H - oy - (y - y0) * k;
  const col = (c) => (c == null ? 'var(--text-normal)' : c === 'text' ? 'var(--text-normal)' : c === 'muted' ? 'var(--text-muted)' : typeof c === 'number' ? PALETTE[c % PALETTE.length] : c);
  const g = svg('g', {}, svgRoot);
  const ax = spec.axes;
  if (ax) {
    if (ax.grid) for (const t of ticks(x0, x1, 8)) svg('line', { x1: X(t), x2: X(t), y1: Y(y0), y2: Y(y1), class: 'sa-grid' }, g);
    if (ax.grid) for (const t of ticks(y0, y1, 6)) svg('line', { x1: X(x0), x2: X(x1), y1: Y(t), y2: Y(t), class: 'sa-grid' }, g);
    if (y0 <= 0 && y1 >= 0) svg('line', { x1: X(x0), x2: X(x1), y1: Y(0), y2: Y(0), class: 'sa-axis' }, g);
    if (x0 <= 0 && x1 >= 0) svg('line', { x1: X(0), x2: X(0), y1: Y(y0), y2: Y(y1), class: 'sa-axis' }, g);
    if (ax.ticks) {
      const yA = y0 <= 0 && y1 >= 0 ? 0 : y0, xA = x0 <= 0 && x1 >= 0 ? 0 : x0;
      for (const t of ticks(x0, x1, 7)) if (t) svg('text', { x: X(t), y: Y(yA) + 13, class: 'sa-tick', 'text-anchor': 'middle' }, g).textContent = tickLabel(t);
      for (const t of ticks(y0, y1, 5)) if (t) svg('text', { x: X(xA) - 4, y: Y(t) + 4, class: 'sa-tick', 'text-anchor': 'end' }, g).textContent = tickLabel(t);
    }
    if (ax.x) svg('text', { x: X(x1) - 2, y: Y(y0 <= 0 && y1 >= 0 ? 0 : y0) - 6, class: 'sa-axis-label', 'text-anchor': 'end' }, g).textContent = ax.x;
    if (ax.y) svg('text', { x: X(x0 <= 0 && x1 >= 0 ? 0 : x0) + 6, y: Y(y1) + 12, class: 'sa-axis-label' }, g).textContent = ax.y;
  }
  const items = (typeof spec.items === 'function' ? spec.items(p) : spec.items) || [];
  const head = (xa, ya, xb, yb, c, w) => {
    const ang = Math.atan2(yb - ya, xb - xa), L = 7 + w;
    const pts = [[xb, yb], [xb - L * Math.cos(ang - 0.4), yb - L * Math.sin(ang - 0.4)], [xb - L * Math.cos(ang + 0.4), yb - L * Math.sin(ang + 0.4)]];
    svg('polygon', { points: pts.map((q) => q.join(',')).join(' '), fill: c, stroke: 'none' }, g);
  };
  for (const it of items) {
    if (!it) continue;
    const c = col(it.color), w = it.width || 2;
    const dash = it.dash ? '5 4' : null;
    if (it.t === 'line' || it.t === 'arrow') {
      const xa = X(it.x1), ya = Y(it.y1), xb = X(it.x2), yb = Y(it.y2);
      if (Math.hypot(xb - xa, yb - ya) < 0.5) continue;
      svg('line', { x1: xa, y1: ya, x2: xb, y2: yb, stroke: c, 'stroke-width': w, 'stroke-dasharray': dash, 'stroke-linecap': 'round' }, g);
      if (it.t === 'arrow') head(xa, ya, xb, yb, c, w);
    } else if (it.t === 'poly') {
      const d = it.pts.map((q, i) => `${i ? 'L' : 'M'}${X(q[0])},${Y(q[1])}`).join('') + (it.open ? '' : 'Z');
      svg('path', { d, stroke: c, 'stroke-width': w, fill: it.fill ? (it.fill === true ? c : col(it.fill)) : 'none', 'fill-opacity': it.fill ? (it.opacity || 0.15) : null, 'stroke-dasharray': dash, 'stroke-linejoin': 'round' }, g);
    } else if (it.t === 'circle') {
      svg('circle', { cx: X(it.x), cy: Y(it.y), r: Math.abs(it.r) * k, stroke: c, 'stroke-width': w, fill: it.fill ? c : 'none', 'fill-opacity': it.fill ? (it.opacity || 0.12) : null, 'stroke-dasharray': dash }, g);
    } else if (it.t === 'dot') {
      svg('circle', { cx: X(it.x), cy: Y(it.y), r: it.size || 4, fill: c }, g);
    } else if (it.t === 'arc') {
      const a0 = it.a0, a1 = it.a1, r = it.r;
      const P = (a) => `${X(it.x + r * Math.cos(a))},${Y(it.y + r * Math.sin(a))}`;
      const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0, sweep = a1 > a0 ? 0 : 1;
      svg('path', { d: `M${P(a0)}A${r * k},${r * k} 0 ${large} ${sweep} ${P(a1)}`, stroke: c, 'stroke-width': it.width || 1.5, fill: 'none', 'stroke-dasharray': dash }, g);
    } else if (it.t === 'text') {
      const e = svg('text', { x: X(it.x) + (it.dx || 0), y: Y(it.y) + (it.dy || 0), class: 'sa-sketch-text', 'text-anchor': it.anchor || 'middle', fill: c, 'font-size': it.size || 12, 'font-weight': it.bold ? 600 : null }, g);
      e.textContent = String(it.text);
    }
  }
}

const DRAWERS = { plot: drawPlot, cashflow: drawCashflow, splane: drawSPlane, blocks: drawBlocks, chain: drawChain, sketch: drawSketch };

// A widget: optional sliders + one or more panels + a live readout.
// spec: {params:[{key,label,min,max,step,value,fmt}], panels:[{kind, height, ...}] | (single panel fields + kind), readout(p) -> rich string, caption}
function makeWidget(parent, spec) {
  const wrap = h('div', 'sa-widget', parent);
  const p = {};
  for (const prm of spec.params || []) p[prm.key] = prm.value;
  const panels = spec.panels || [spec];
  const row = h('div', 'sa-widget-panels' + (panels.length > 1 ? ' is-multi' : ''), wrap);
  const svgs = panels.map((pan) => {
    const w = pan.width || (panels.length > 1 ? 340 : 640), hgt = pan.height || (pan.kind === 'cashflow' ? 230 : pan.kind === 'blocks' ? 190 : pan.kind === 'chain' ? 70 + 34 * (pan.n || 2) + 40 : pan.kind === 'splane' ? 300 : pan.kind === 'sketch' ? 320 : 300);
    const s = svg('svg', { viewBox: `0 0 ${w} ${hgt}`, class: 'sa-svg', preserveAspectRatio: 'xMidYMid meet' }, row);
    s.style.flex = panels.length > 1 ? `${pan.flex || 1} 1 0` : '';
    return { s, pan, box: { w, h: hgt } };
  });
  const readout = spec.readout ? h('div', 'sa-widget-readout', wrap) : null;
  const draw = () => {
    for (const { s, pan, box } of svgs) {
      while (s.firstChild) s.removeChild(s.firstChild);
      try { DRAWERS[pan.kind || 'plot'](s, pan, p, box); } catch (e) { console.error('Study Arena widget', e); }
    }
    if (readout) { readout.innerHTML = ''; try { renderRich(readout, spec.readout(p)); } catch (e) { readout.textContent = ''; } }
  };
  if ((spec.params || []).length) {
    const ctr = h('div', 'sa-sliders', wrap);
    for (const prm of spec.params) {
      const r = h('label', 'sa-slider', ctr);
      const top = h('div', 'sa-slider-top', r);
      h('span', 'sa-slider-name', top, prm.label || prm.key);
      const val = h('span', 'sa-slider-val', top);
      const inp = h('input', '', r);
      Object.assign(inp, { type: 'range', min: prm.min, max: prm.max, step: prm.step || (prm.max - prm.min) / 100, value: prm.value });
      const show = () => { val.textContent = prm.fmt ? prm.fmt(p[prm.key]) : String(+(+p[prm.key]).toPrecision(4)); };
      show();
      inp.addEventListener('input', () => { p[prm.key] = parseFloat(inp.value); show(); draw(); });
      // keep the pen/finger from scrolling the page while dragging
      inp.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    }
  }
  if (spec.caption) renderRich(h('div', 'sa-widget-caption', wrap), spec.caption);
  draw();
  return wrap;
}

/* ---------- numeric helpers for course content ---------- */
// RK4 for vector ODE x' = f(t, x); returns sampler(t)
function simulate(f, x0, T, n = 600) {
  const dt = T / n, xs = [x0.slice()];
  let x = x0.slice(), t = 0;
  for (let k = 0; k < n; k++) {
    const k1 = f(t, x), a = x.map((v, i) => v + (dt / 2) * k1[i]);
    const k2 = f(t + dt / 2, a), b = x.map((v, i) => v + (dt / 2) * k2[i]);
    const k3 = f(t + dt / 2, b), c = x.map((v, i) => v + dt * k3[i]);
    const k4 = f(t + dt, c);
    x = x.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    t += dt; xs.push(x);
  }
  return (tq, i = 0) => {
    if (!(tq >= 0)) return NaN;
    const kf = Math.min(n, tq / dt), k0 = Math.floor(kf), k1 = Math.min(n, k0 + 1), w = kf - k0;
    return xs[k0][i] * (1 - w) + xs[k1][i] * w;
  };
}
function bisect(fn, a, b, it = 80) {
  let fa = fn(a);
  for (let k = 0; k < it; k++) { const m = (a + b) / 2, fm = fn(m); if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m; }
  return (a + b) / 2;
}
const gammaFn = (z) => { // Lanczos
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFn(1 - z));
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  z -= 1; let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
};
const besselJ = (nu, x) => { let s = 0; for (let k = 0; k < 40; k++) { const term = Math.pow(-1, k) / (fact(k) * gammaFn(nu + k + 1)) * Math.pow(x / 2, 2 * k + nu); s += term; if (Math.abs(term) < 1e-14) break; } return s; };

/* ================================================================== */
/* Course registry + API for course modules (courses/*.js)              */
/* ================================================================== */
function registerCourse(def) {
  const course = def.course;
  if (!course) throw new Error('registerCourse: missing "course"');
  if (!COURSES.includes(course)) COURSES.push(course);
  for (const c of def.chapters || []) if (!CHAPTERS.some((x) => x.id === c.id)) CHAPTERS.push({ ...c, course });
  for (const t of def.topics || []) {
    if (TOPICS.some((x) => x.id === t.id)) throw new Error(`Topic id "${t.id}" already exists`);
    if (!CHAPTERS.some((c) => c.id === t.ch)) throw new Error(`Topic "${t.id}" uses unknown chapter "${t.ch}"`);
    TOPICS.push({ ...t, course });
  }
  for (const s of def.sections || []) {
    const old = SECTIONS.find((x) => x.id === s.id);
    if (old) { Object.assign(old, s); continue; }
    SECTIONS.push({ num: s.id, tag: s.id, ...s, course });
  }
  for (const [id, patch] of Object.entries(def.extendSections || {})) {
    const sec = SECTIONS.find((x) => x.id === id);
    if (sec) Object.assign(sec, patch);
  }
  // put this course's sections in a given order (others keep their place after them)
  if (def.sectionOrder) {
    const rank = (sec) => { const i = def.sectionOrder.indexOf(sec.id); return sec.course === course && i >= 0 ? i : 1e6; };
    const mine = SECTIONS.filter((x) => x.course === course).sort((a, b) => rank(a) - rank(b));
    let k = 0;
    for (let i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].course === course) SECTIONS[i] = mine[k++];
  }
  // move/rename existing topics, e.g. { 'lap-basic': { sec: '1.1' } }
  for (const [id, patch] of Object.entries(def.extendTopics || {})) {
    const t = TOPICS.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  }
}
const SA_API = {
  registerCourse, rand, randInt, pick, nz, distinctInts, fact, gcd, Frac, sh, kv, ex, exOr1, xp, cf, sumTex, st, polyTex, kFrac,
  fmtNum, parse, evaluate, simulate, bisect, gammaFn, besselJ, fmtMoney, R: String.raw,
  rnd: (v) => Math.round(v * 1e9) / 1e9, nf: (v) => fmtNum(Math.round(v * 1e9) / 1e9),
};
function loadCourseSource(code, name) {
  // course files are plain JS bodies that receive the API object as `SA`
  new Function('SA', code)(SA_API);
}

function lessonBeats(sec) {
  if (sec.lesson) return sec.lesson;
  return (sec.cards || []).map((c) => ({ type: 'text', kind: c.kind, title: c.title, body: c.body }));
}

/* ================================================================== */
/* The view                                                            */
/* ================================================================== */
function h(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
function icon(el, name) { try { obsidian.setIcon && obsidian.setIcon(el, name); } catch (e) { /* ignore */ } }
const topicById = (id) => TOPICS.find((t) => t.id === id);
const topicLabel = (t) => (t.sec && t.course === 'MATH 3705' ? `${t.sec} · ${t.name}` : t.name);
const sectionById = (id) => SECTIONS.find((s) => s.id === id);
const secTag = (id) => (sectionById(id) ? sectionById(id).tag : id);

class StudyView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.q = null;
    this.state = 'answering';
    this.hintUsed = false;
    this.lastTopic = null;
    this.mode = 'practice';
    this.focus = null; // { skill } when practising a single skill from Learn
    this.choice = null;
  }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Study Arena'; }
  getIcon() { return 'graduation-cap'; }

  async onOpen() {
    this.build();
    this.newQuestion();
  }
  async onClose() { if (this.board) this.board.destroy(); }

  get data() { return this.plugin.data; }

  button(parent, label, onClick, cls = '', iconName = null) {
    const b = h('button', 'sa-btn ' + cls, parent);
    if (iconName) { const i = h('span', 'sa-btn-icon', b); icon(i, iconName); }
    h('span', 'sa-btn-label', b, label);
    b.addEventListener('click', (e) => { e.preventDefault(); onClick(e); });
    return b;
  }

  /* ---------- mastery ---------- */
  mastery(id) {
    if (!this.data.mastery[id]) this.data.mastery[id] = { streak: 0, mastered: false };
    return this.data.mastery[id];
  }
  dots(parent, id) {
    const m = this.mastery(id);
    const wrap = h('span', 'sa-dots' + (m.mastered ? ' is-mastered' : ''), parent);
    for (let i = 0; i < MASTERY_STREAK; i++) h('span', 'sa-dot' + (m.mastered || i < m.streak ? ' is-on' : ''), wrap);
    wrap.setAttribute('aria-label', m.mastered ? 'Mastered' : `${m.streak} of ${MASTERY_STREAK} in a row`);
    return wrap;
  }
  sectionProgress(sec) {
    const done = sec.skills.filter((id) => this.mastery(id).mastered).length;
    return { done, total: sec.skills.length };
  }

  build() {
    const root = this.contentEl;
    root.innerHTML = '';
    root.classList.add('sa-view');

    const top = h('div', 'sa-top', root);
    const brand = h('div', 'sa-brand', top);
    h('span', 'sa-brand-name', brand, 'Study Arena');
    this.courseSel = h('select', 'sa-course dropdown', brand);
    for (const c of COURSES) { const o = h('option', '', this.courseSel, c); o.value = c; }
    this.courseSel.value = this.data.course;
    this.courseSel.addEventListener('change', () => this.setCourse(this.courseSel.value));
    const tabs = h('div', 'sa-tabs', top);
    this.tabPractice = h('button', 'sa-tab', tabs, 'Practice');
    this.tabLearn = h('button', 'sa-tab', tabs, 'Learn');
    this.tabPractice.addEventListener('click', () => this.setMode('practice', true));
    this.tabLearn.addEventListener('click', () => this.openLearn(this.data.lastSectionBy[this.data.course]));
    this.scoreEl = h('div', 'sa-pill sa-score', top);
    this.streakEl = h('div', 'sa-pill sa-streak', top);
    h('div', 'sa-spacer', top);
    this.topicsBtn = this.button(top, 'Topics', () => this.togglePanel('topics'), 'sa-ghost', 'list-checks');
    this.button(top, 'Stats', () => this.togglePanel('stats'), 'sa-ghost', 'bar-chart-2');
    this.panel = h('div', 'sa-panel', root);
    this.panel.hidden = true;

    /* practice */
    this.practiceEl = h('div', 'sa-main', root);
    const left = h('div', 'sa-left', this.practiceEl);
    this.right = h('div', 'sa-right', this.practiceEl);
    this.banner = h('div', 'sa-card sa-banner', left);
    this.banner.hidden = true;
    this.qCard = h('div', 'sa-card sa-question', left);

    const boardCard = h('div', 'sa-card sa-board', left);
    const tb = h('div', 'sa-toolbar', boardCard);
    this.toolBtns = {};
    this.toolBtns.pen = this.button(tb, 'Pen', () => this.setTool('pen'), 'sa-tool', 'pencil');
    this.toolBtns.eraser = this.button(tb, 'Eraser', () => this.setTool('eraser'), 'sa-tool', 'eraser');
    const swatches = h('div', 'sa-swatches', tb);
    this.swatchEls = {};
    for (const key of ['ink', 'blue', 'red', 'green']) {
      const sw = h('button', 'sa-swatch sa-swatch-' + key, swatches);
      sw.setAttribute('aria-label', key === 'ink' ? 'Default ink' : key);
      sw.addEventListener('click', () => { this.board.color = key; this.setTool('pen'); this.refreshSwatches(); });
      this.swatchEls[key] = sw;
    }
    h('div', 'sa-spacer', tb);
    this.button(tb, 'Undo', () => this.board.undo(), 'sa-tool', 'undo-2');
    this.button(tb, 'Clear', () => this.board.clear(), 'sa-tool', 'trash-2');
    this.penOnlyBtn = this.button(tb, 'Pen only', () => this.togglePenOnly(), 'sa-tool', 'hand');
    this.board = new Board(boardCard, { scrollEl: this.contentEl, penOnly: () => this.data.penOnly });
    const more = h('div', 'sa-more', boardCard);
    this.button(more, 'More space', () => this.board.addSpace(), 'sa-ghost', 'plus');

    const ans = h('div', 'sa-card sa-answer', left);
    this.exprArea = h('div', 'sa-expr-area', ans);
    const row = h('div', 'sa-answer-row', this.exprArea);
    this.answerLabel = h('label', 'sa-answer-label', row, 'Final answer');
    this.input = h('input', 'sa-input', row);
    this.input.type = 'text';
    this.input.setAttribute('autocomplete', 'off');
    this.input.setAttribute('autocapitalize', 'off');
    this.input.setAttribute('autocorrect', 'off');
    this.input.spellcheck = false;
    this.input.addEventListener('input', () => this.updatePreview());
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.check(); } });
    this.keys = h('div', 'sa-keys', this.exprArea);
    this.previewEl = h('div', 'sa-preview', this.exprArea);
    this.choiceArea = h('div', 'sa-choices', ans);
    const actions = h('div', 'sa-actions', ans);
    this.checkBtn = this.button(actions, 'Check answer', () => this.check(), 'mod-cta sa-primary', 'check');
    this.hintBtn = this.button(actions, 'Hint (½ points)', () => this.hint(), 'sa-ghost', 'lightbulb');
    this.revealBtn = this.button(actions, 'Show solution', () => this.reveal(), 'sa-ghost', 'eye');
    this.skipBtn = this.button(actions, 'Skip', () => this.newQuestion(), 'sa-ghost', 'skip-forward');

    /* learn */
    this.learnEl = h('div', 'sa-learn', root);
    this.learnEl.hidden = true;

    this.refreshScore();
    this.refreshTools();
    this.setMode('practice', false);
  }

  async setCourse(c) {
    this.data.course = c;
    this.focus = null;
    await this.plugin.save();
    this.panel.hidden = true;
    if (this.mode === 'learn') this.openLearn(this.data.lastSectionBy[c]);
    this.newQuestion();
  }

  setMode(mode, clearFocus) {
    this.mode = mode;
    if (mode === 'practice' && clearFocus && this.focus) { this.focus = null; this.newQuestion(); }
    this.practiceEl.hidden = mode !== 'practice';
    this.learnEl.hidden = mode !== 'learn';
    this.tabPractice.classList.toggle('is-active', mode === 'practice');
    this.tabLearn.classList.toggle('is-active', mode === 'learn');
    this.topicsBtn.hidden = mode !== 'practice';
    this.panel.hidden = true;
    this.contentEl.scrollTop = 0;
  }

  setTool(t) { this.board.tool = t; this.refreshTools(); }
  refreshTools() {
    for (const [k, b] of Object.entries(this.toolBtns)) b.classList.toggle('is-active', this.board.tool === k);
    this.penOnlyBtn.classList.toggle('is-active', !!this.data.penOnly);
    this.refreshSwatches();
  }
  refreshSwatches() {
    for (const [k, el] of Object.entries(this.swatchEls)) el.classList.toggle('is-active', this.board.color === k && this.board.tool === 'pen');
  }
  async togglePenOnly() {
    this.data.penOnly = !this.data.penOnly;
    await this.plugin.save();
    this.refreshTools();
    new Notice(this.data.penOnly ? 'Pen only: fingers scroll, the S Pen draws.' : 'Fingers can draw too.');
  }
  refreshScore() {
    this.scoreEl.textContent = `${this.data.points} pts`;
    this.streakEl.textContent = `Streak ${this.data.streak}`;
    this.streakEl.classList.toggle('is-hot', this.data.streak >= 3);
  }

  /* ---------- question lifecycle ---------- */
  pickTopic() {
    if (this.focus) return topicById(this.focus.skill);
    const mine = TOPICS.filter((t) => t.course === this.data.course);
    const sel = mine.filter((t) => this.data.selected.includes(t.id));
    const pool = sel.length ? sel : mine;
    const choices = pool.length > 1 ? pool.filter((t) => t.id !== this.lastTopic) : pool;
    return pick(choices);
  }

  newQuestion() {
    const topic = this.pickTopic();
    this.lastTopic = topic.id;
    this.q = makeQuestion(topic);
    this.state = 'answering';
    this.hintUsed = false;
    this.choice = null;
    this.input.value = '';
    this.input.disabled = false;
    this.board.reset();
    this.renderBanner();
    this.renderQuestion();
    this.renderAnswerArea();
    this.right.innerHTML = '';
    this.right.classList.remove('has-result');
    this.setActionsEnabled(true);
    this.contentEl.scrollTop = 0;
  }

  setActionsEnabled(on) {
    for (const b of [this.checkBtn, this.hintBtn, this.revealBtn]) b.disabled = !on;
    this.hintBtn.disabled = !on || this.hintUsed;
  }

  renderBanner() {
    const b = this.banner;
    b.innerHTML = '';
    b.hidden = !this.focus;
    if (!this.focus) return;
    const t = topicById(this.focus.skill);
    const sec = SECTIONS.find((s) => s.id === t.sec);
    const m = this.mastery(t.id);
    const l = h('div', 'sa-banner-main', b);
    h('div', 'sa-banner-kicker', l, `Learning ${sec.tag} · ${sec.title}`);
    const nameRow = h('div', 'sa-banner-name', l);
    h('span', '', nameRow, t.name);
    this.dots(nameRow, t.id);
    h('div', 'sa-banner-sub', l, m.mastered ? 'Mastered. Keep going or move on to the next skill.' : `Get ${MASTERY_STREAK} right in a row to master this skill.`);
    const act = h('div', 'sa-banner-actions', b);
    this.button(act, 'Back to lesson', () => this.openLearn(sec.id), 'sa-ghost sa-small', 'book-open');
    const next = this.nextSkill(sec, t.id);
    if (m.mastered && next) this.button(act, 'Next skill', () => this.practiceSkill(next), 'mod-cta sa-small', 'arrow-right');
  }

  nextSkill(sec, current) {
    const idx = sec.skills.indexOf(current);
    const after = [...sec.skills.slice(idx + 1), ...sec.skills.slice(0, idx)];
    return after.find((id) => !this.mastery(id).mastered) || null;
  }

  renderQuestion() {
    const q = this.q;
    VAR_TEX_Q = q.varTex || null;
    const c = this.qCard;
    c.innerHTML = '';
    const meta = h('div', 'sa-meta', c);
    const ch = CHAPTERS.find((x) => x.id === q.topic.ch);
    h('span', 'sa-tag', meta, q.topic.sec ? secTag(q.topic.sec) : ch.name);
    h('span', 'sa-tag sa-tag-soft', meta, q.topic.name);
    h('span', 'sa-tag sa-tag-points', meta, `${q.points} pts`);
    const body = h('div', 'sa-prompt', c);
    renderRich(body, q.prompt);
    if (q.figure) { try { makeWidget(c, q.figure); } catch (e) { console.error(e); } }
    h('div', 'sa-hint-line', c, q.hint);
    this.hintBox = h('div', 'sa-hintbox', c);
    this.hintBox.hidden = true;
  }

  renderAnswerArea() {
    const q = this.q;
    const isChoice = q.type === 'choice';
    this.exprArea.hidden = isChoice;
    this.choiceArea.hidden = !isChoice;
    this.choiceArea.innerHTML = '';
    if (isChoice) {
      q.options.forEach((o, i) => {
        const b = h('button', 'sa-choice', this.choiceArea);
        h('span', 'sa-choice-letter', b, String.fromCharCode(65 + i));
        renderRich(h('span', 'sa-choice-text', b), o.tex);
        b.addEventListener('click', () => {
          if (this.state !== 'answering') return;
          this.choice = i;
          [...this.choiceArea.children].forEach((el, k) => el.classList.toggle('is-selected', k === i));
        });
      });
      return;
    }
    this.answerLabel.textContent = q.type === 'set' ? 'Values' : 'Final answer';
    this.renderKeys();
    this.updatePreview();
  }

  renderKeys() {
    this.keys.innerHTML = '';
    const q = this.q, v = q.vars;
    let keys;
    if (q.type === 'set') keys = [',', '-', '/', 'sqrt(', '(', ')', 'π'];
    else {
      keys = [...v, 'e^(', '^', '(', ')', '/', 'π'];
      if (v.includes('t') || v.includes('x')) keys.push('sin(', 'cos(');
      if (v.includes('x') && ['euler', 'ser-ce'].includes(q.topic.id)) keys.push('ln(');
      if (v.includes('n')) keys.push('(-1)^n');
      if (['lap-step', 'delta-ivp'].includes(q.topic.id)) keys.push('u(t-');
      if (!v.length) keys.push('sqrt(');
    }
    keys.push('⌫');
    for (const k of keys) {
      const b = h('button', 'sa-key', this.keys, k);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.input.disabled) return;
        const el = this.input;
        const s = el.selectionStart != null ? el.selectionStart : el.value.length;
        const eIdx = el.selectionEnd != null ? el.selectionEnd : s;
        if (k === '⌫') {
          if (s === eIdx && s > 0) { el.value = el.value.slice(0, s - 1) + el.value.slice(eIdx); el.setSelectionRange(s - 1, s - 1); }
          else { el.value = el.value.slice(0, s) + el.value.slice(eIdx); el.setSelectionRange(s, s); }
        } else {
          const ins = k === 'π' ? 'pi' : k === ',' ? ', ' : k;
          el.value = el.value.slice(0, s) + ins + el.value.slice(eIdx);
          el.setSelectionRange(s + ins.length, s + ins.length);
        }
        this.updatePreview();
      });
    }
  }

  readAnswer(txt) {
    if (this.q.type === 'set') {
      const items = parseSet(txt);
      return { vals: items.map((i) => i.v), tex: items.map((i) => toTex(i.ast)).join(',\\ ') };
    }
    // plain-number answers (money, rates): accept "$1,157.63" or "19.56%"
    if (!(this.q.vars || []).length) txt = txt.replace(/\$/g, '').replace(/(\d),(?=\d{3}(?!\d))/g, '$1').replace(/%\s*$/, '');
    const ast = parse(txt, this.q.vars);
    return { ast, tex: toTex(ast) };
  }

  updatePreview() {
    const txt = this.input.value.trim();
    this.previewEl.innerHTML = '';
    this.previewEl.classList.remove('is-error');
    if (!txt) { h('span', 'sa-muted', this.previewEl, 'Your answer will appear here as math, so you can check how it was read.'); return; }
    try {
      const r = this.readAnswer(txt);
      this.previewEl.appendChild(mathEl(r.tex, false));
      flushMath();
    } catch (e) {
      this.previewEl.classList.add('is-error');
      this.previewEl.textContent = e instanceof ParseError ? e.message : 'Could not read that answer';
    }
  }

  hint() {
    if (this.state !== 'answering' || this.hintUsed) return;
    this.hintUsed = true;
    this.hintBtn.disabled = true;
    const s = this.q.steps[0];
    this.hintBox.hidden = false;
    this.hintBox.innerHTML = '';
    h('div', 'sa-hint-title', this.hintBox, `Hint: ${s.title}`);
    renderRich(h('div', '', this.hintBox), s.body);
  }

  async check() {
    if (this.state !== 'answering') return;
    const q = this.q;
    let res, userTex = null, userRich = null, userText = '';
    if (q.type === 'choice') {
      if (this.choice == null) { new Notice('Pick an option first.'); return; }
      const o = q.options[this.choice];
      res = o.correct ? { correct: true } : { correct: false, mistake: { why: o.why, stepIndex: o.stepIndex } };
      userRich = o.tex; userText = o.tex;
      [...this.choiceArea.children].forEach((el, k) => {
        el.classList.toggle('is-right', q.options[k].correct);
        el.classList.toggle('is-wrong', k === this.choice && !o.correct);
      });
    } else {
      const txt = this.input.value.trim();
      if (!txt) { new Notice('Enter your answer first.'); this.input.focus(); return; }
      let r;
      try { r = this.readAnswer(txt); } catch (e) {
        new Notice(e instanceof ParseError ? e.message : 'Could not read that answer');
        return;
      }
      res = q.type === 'set' ? diagnoseSet(q, r.vals) : diagnose(q, r.ast);
      userTex = r.tex; userText = txt;
      this.input.disabled = true;
    }
    this.state = 'done';
    this.setActionsEnabled(false);
    const st = this.statFor(q.topic.id);
    let earned = 0, bonus = 0, newlyMastered = false;
    if (res.correct) {
      earned = this.hintUsed ? Math.ceil(q.points / 2) : q.points;
      bonus = Math.min(this.data.streak, 5) * 2;
      this.data.points += earned + bonus;
      this.data.streak += 1;
      this.data.bestStreak = Math.max(this.data.bestStreak, this.data.streak);
      st.right += 1;
      if (q.topic.sec) {
        const m = this.mastery(q.topic.id);
        m.streak += 1;
        if (!m.mastered && m.streak >= MASTERY_STREAK) { m.mastered = true; newlyMastered = true; }
      }
    } else {
      this.data.streak = 0;
      st.wrong += 1;
      if (q.topic.sec) this.mastery(q.topic.id).streak = 0;
    }
    await this.plugin.save();
    this.refreshScore();
    this.renderBanner();
    this.lastAttempt = { userText, userTex, userRich, res, earned, bonus, newlyMastered };
    this.renderResult();
    if (!res.correct && this.data.saveMistakes) this.saveAttempt(true);
  }

  async reveal() {
    if (this.state !== 'answering') return;
    this.state = 'done';
    this.input.disabled = true;
    this.setActionsEnabled(false);
    this.data.streak = 0;
    this.statFor(this.q.topic.id).revealed += 1;
    if (this.q.topic.sec) this.mastery(this.q.topic.id).streak = 0;
    if (this.q.type === 'choice') [...this.choiceArea.children].forEach((el, k) => el.classList.toggle('is-right', this.q.options[k].correct));
    await this.plugin.save();
    this.refreshScore();
    this.renderBanner();
    this.lastAttempt = { userText: '', userTex: null, userRich: null, res: { correct: false, revealed: true }, earned: 0, bonus: 0 };
    this.renderResult();
  }

  statFor(id) {
    if (!this.data.stats[id]) this.data.stats[id] = { right: 0, wrong: 0, revealed: 0 };
    return this.data.stats[id];
  }

  renderResult() {
    const q = this.q, a = this.lastAttempt, res = a.res;
    const r = this.right;
    r.innerHTML = '';
    r.classList.add('has-result');
    const card = h('div', 'sa-card sa-result', r);
    const v = h('div', 'sa-verdict ' + (res.correct ? 'is-right' : res.revealed ? 'is-neutral' : 'is-wrong'), card);
    if (res.correct) {
      h('div', 'sa-verdict-title', v, a.newlyMastered ? 'Correct, skill mastered!' : 'Correct');
      h('div', 'sa-verdict-sub', v, `+${a.earned} points${a.bonus ? `  ·  +${a.bonus} streak bonus` : ''}${this.hintUsed ? '  ·  hint used' : ''}`);
    } else if (res.revealed) {
      h('div', 'sa-verdict-title', v, 'Worked solution');
      h('div', 'sa-verdict-sub', v, 'No points this time. Try the next one on your own.');
    } else {
      h('div', 'sa-verdict-title', v, 'Not quite');
      h('div', 'sa-verdict-sub', v, 'Streak reset. Here is where it went off track.');
    }

    const cmp = h('div', 'sa-compare', card);
    const showAns = (parent, tex, rich) => {
      const box = h('div', 'sa-cmp-math', parent);
      if (rich != null) renderRich(box, rich); else box.appendChild(mathEl(tex, false));
    };
    if (a.userTex || a.userRich) {
      const y = h('div', 'sa-cmp ' + (res.correct ? 'is-right' : 'is-wrong'), cmp);
      h('div', 'sa-cmp-label', y, q.type === 'choice' ? 'Your choice' : 'Your answer');
      showAns(y, a.userTex, a.userRich);
    }
    if (!res.correct) {
      const c = h('div', 'sa-cmp is-right', cmp);
      h('div', 'sa-cmp-label', c, 'Correct answer');
      showAns(c, q.answerTex, q.type === 'choice' ? q.answerTex : null);
    }
    flushMath();

    const badIndex = res.mistake ? res.mistake.stepIndex : -1;
    if (!res.correct && !res.revealed) {
      const d = h('div', 'sa-diag', card);
      if (res.mistake) {
        const step = q.steps[badIndex];
        h('div', 'sa-diag-title', d, step ? `Where it went wrong: step ${badIndex + 1}, ${step.title}` : 'Where it went wrong');
        renderRich(h('div', 'sa-diag-body', d), res.mistake.why);
      } else if (res.generic) {
        h('div', 'sa-diag-title', d, 'What your answer tells us');
        renderRich(h('div', 'sa-diag-body', d), res.generic);
      } else {
        h('div', 'sa-diag-title', d, "This doesn't match a common slip");
        h('div', 'sa-diag-body', d, 'Go through the steps below one at a time and compare each with your work on the board. The first one that differs is your mistake.');
      }
    }

    const wrap = res.correct ? h('details', 'sa-steps-wrap', card) : h('div', 'sa-steps-wrap', card);
    if (res.correct) h('summary', 'sa-steps-summary', wrap, 'See the full worked solution');
    else h('div', 'sa-steps-heading', wrap, 'Worked solution');
    const ol = h('ol', 'sa-steps', wrap);
    q.steps.forEach((s, i) => {
      let cls = '';
      if (badIndex >= 0) cls = i < badIndex ? 'is-ok' : i === badIndex ? 'is-bad' : 'is-next';
      const li = h('li', 'sa-step ' + cls, ol);
      const head = h('div', 'sa-step-head', li);
      h('span', 'sa-step-num', head, String(i + 1));
      h('span', 'sa-step-title', head, s.title);
      if (i === badIndex) h('span', 'sa-step-flag', head, 'went wrong here');
      renderRich(h('div', 'sa-step-body', li), s.body);
    });

    const actions = h('div', 'sa-actions', card);
    this.button(actions, 'Next question', () => this.newQuestion(), 'mod-cta sa-primary', 'arrow-right');
    const saveBtn = this.button(actions, 'Save to vault', async () => {
      saveBtn.disabled = true;
      await this.saveAttempt(false);
    }, 'sa-ghost', 'save');
    if (!res.correct && !res.revealed && this.data.saveMistakes) { saveBtn.disabled = true; saveBtn.querySelector('.sa-btn-label').textContent = 'Saved to Mistakes'; }
    if (q.topic.sec && !this.focus) this.button(actions, `Lesson ${secTag(q.topic.sec)}`, () => this.openLearn(q.topic.sec), 'sa-ghost', 'book-open');

    setTimeout(() => {
      if (this.contentEl.clientWidth < 1000) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else this.contentEl.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }

  /* ---------- Learn mode ---------- */
  async openLearn(secId) {
    const mineS = SECTIONS.filter((s) => s.course === this.data.course);
    const sec = mineS.find((s) => s.id === secId) || mineS[0];
    this.data.lastSectionBy[this.data.course] = sec.id;
    this.plugin.save();
    this.setMode('learn');
    this.renderLearn(sec);
  }

  practiceSkill(id) {
    this.focus = { skill: id };
    this.setMode('practice', false);
    this.newQuestion();
  }

  renderLearn(sec) {
    const L = this.learnEl;
    L.innerHTML = '';
    const nav = h('nav', 'sa-learn-nav', L);
    h('div', 'sa-learn-nav-title', nav, 'Sections');
    for (const s of SECTIONS.filter((x) => x.course === this.data.course)) {
      const p = this.sectionProgress(s);
      const beats = lessonBeats(s);
      const lp = Math.min(this.data.lessonPos[s.id] || 0, beats.length);
      const item = h('button', 'sa-nav-item' + (s.id === sec.id ? ' is-active' : ''), nav);
      const top = h('div', 'sa-nav-top', item);
      h('span', 'sa-nav-num', top, s.num);
      h('span', 'sa-nav-title', top, s.title);
      const bar = h('div', 'sa-bar', item);
      h('div', 'sa-bar-fill', bar).style.width = `${(100 * p.done) / Math.max(1, p.total)}%`;
      h('div', 'sa-nav-meta', item, `${lp >= beats.length ? 'Lesson done' : lp ? `Lesson ${lp}/${beats.length}` : 'Lesson not started'} · ${p.done}/${p.total} skills`);
      item.addEventListener('click', () => this.openLearn(s.id));
    }

    const main = h('div', 'sa-learn-main', L);
    const head = h('div', 'sa-learn-head', main);
    h('div', 'sa-learn-kicker', head, sec.chapter || sec.course);
    h('h2', 'sa-learn-title', head, `${sec.course === 'MATH 3705' ? `${sec.id}  ` : ''}${sec.title}`);
    const p = this.sectionProgress(sec);
    h('div', 'sa-learn-progress', head, p.done === p.total ? 'Every skill in this section is mastered.' : `Work through the lesson, then practise each skill until you get ${MASTERY_STREAK} in a row. ${p.done} of ${p.total} skills mastered.`);

    const grid = h('div', 'sa-learn-grid', main);
    const lessonCol = h('div', 'sa-lesson', grid);
    const side = h('aside', 'sa-skills', grid);
    h('div', 'sa-skills-title', side, 'Skills to practise');
    for (const id of sec.skills) {
      const t = topicById(id);
      if (!t) continue;
      const m = this.mastery(id);
      const row = h('div', 'sa-skill' + (m.mastered ? ' is-mastered' : ''), side);
      const info = h('div', 'sa-skill-info', row);
      const nm = h('div', 'sa-skill-name', info);
      h('span', '', nm, t.name);
      this.dots(nm, id);
      h('div', 'sa-skill-desc', info, t.desc || '');
      this.button(row, m.mastered ? 'Practise again' : 'Practise', () => this.practiceSkill(id), m.mastered ? 'sa-ghost sa-small' : 'mod-cta sa-small');
    }
    const next = sec.skills.find((id) => topicById(id) && !this.mastery(id).mastered);
    if (next) this.button(side, `Start with ${topicById(next).name}`, () => this.practiceSkill(next), 'sa-ghost sa-start', 'play');

    this.renderLesson(lessonCol, sec);
    flushMath();
  }

  /* ---------- Brilliant-style lesson player ---------- */
  renderLesson(col, sec) {
    col.innerHTML = '';
    const beats = lessonBeats(sec);
    const pos = () => Math.min(this.data.lessonPos[sec.id] || 0, beats.length);
    const bar = h('div', 'sa-lesson-bar', col);
    const barFill = h('div', 'sa-lesson-bar-fill', h('div', 'sa-lesson-track', bar));
    const barText = h('span', 'sa-lesson-bar-text', bar);
    const tools = h('div', 'sa-lesson-tools', bar);
    const restart = h('button', 'sa-linkbtn', tools, 'Restart');
    const showAll = h('button', 'sa-linkbtn', tools, 'Show all');
    restart.addEventListener('click', () => { this.data.lessonPos[sec.id] = 0; this.plugin.save(); this.renderLesson(col, sec); });
    showAll.addEventListener('click', () => { this.data.lessonPos[sec.id] = beats.length; this.plugin.save(); this.renderLesson(col, sec); });
    const list = h('div', 'sa-beats', col);
    const updateBar = () => {
      const k = pos();
      barFill.style.width = `${(100 * k) / beats.length}%`;
      barText.textContent = k >= beats.length ? `Lesson complete · ${beats.length} steps` : `Step ${k + 1} of ${beats.length}`;
    };
    const advance = (fromEl) => {
      const k = pos();
      this.data.lessonPos[sec.id] = k + 1;
      this.plugin.save();
      updateBar();
      if (fromEl) fromEl.classList.remove('is-current');
      const el = k + 1 < beats.length ? this.buildBeat(list, beats[k + 1], k + 1, true, advance) : this.buildLessonEnd(list, sec);
      flushMath();
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    };
    const k = pos();
    beats.forEach((b, i) => { if (i <= k && i < beats.length) this.buildBeat(list, b, i, i === k, advance); });
    if (k >= beats.length) this.buildLessonEnd(list, sec);
    updateBar();
  }

  buildLessonEnd(list, sec) {
    const el = h('section', 'sa-beat sa-beat-end', list);
    h('div', 'sa-beat-kind', el, 'Lesson complete');
    h('h3', 'sa-lesson-title', el, 'Now make it stick');
    h('div', 'sa-lesson-body', el, 'Practise each skill until you get 3 in a row. Wrong answers show which step went wrong, and you can come back to any step above.');
    const next = sec.skills.find((id) => topicById(id) && !this.mastery(id).mastered) || sec.skills[0];
    if (next) this.button(h('div', 'sa-beat-actions', el), `Practise ${topicById(next).name}`, () => this.practiceSkill(next), 'mod-cta', 'play');
    return el;
  }

  buildBeat(list, b, idx, current, advance) {
    const el = h('section', `sa-beat sa-beat-${b.type} is-${b.kind || b.type}${current ? ' is-current' : ''}`, list);
    const KIND = { key: 'Key idea', method: 'Method', example: 'Worked example', quiz: 'Quick check', input: 'Try it', graph: 'Explore', text: 'Idea', note: 'Note' };
    h('div', 'sa-beat-kind', el, b.label || KIND[b.type === 'text' ? (b.kind || 'text') : b.type]);
    if (b.title) h('h3', 'sa-lesson-title', el, b.title);
    const body = h('div', 'sa-lesson-body', el);
    const actions = h('div', 'sa-beat-actions');
    const cont = () => {
      if (!current) return;
      actions.innerHTML = '';
      const btn = this.button(actions, 'Continue', () => { btn.disabled = true; actions.remove(); advance(el); }, 'mod-cta sa-continue', 'arrow-down');
    };
    if (b.type === 'text') {
      renderRich(body, b.body);
      el.appendChild(actions); cont();
    } else if (b.type === 'graph') {
      if (b.body) renderRich(body, b.body);
      makeWidget(el, b.widget);
      if (b.after) renderRich(h('div', 'sa-lesson-body', el), b.after);
      el.appendChild(actions); cont();
    } else if (b.type === 'example') {
      if (b.prompt) renderRich(body, b.prompt);
      if (b.widget) makeWidget(el, b.widget);
      const ol = h('ol', 'sa-ex-steps', el);
      const steps = b.steps.map((s) => (typeof s === 'string' ? { body: s } : s));
      let shown = 0;
      const showStep = () => {
        const s = steps[shown++];
        const li = h('li', 'sa-ex-step', ol);
        if (s.title) h('div', 'sa-ex-step-title', li, s.title);
        renderRich(h('div', '', li), s.body);
        flushMath();
      };
      el.appendChild(actions);
      if (!current) { while (shown < steps.length) showStep(); }
      else {
        const stepBtn = () => {
          actions.innerHTML = '';
          if (shown < steps.length) this.button(actions, shown === 0 ? 'Show the first step' : `Next step (${shown + 1}/${steps.length})`, () => { showStep(); stepBtn(); }, 'sa-ghost sa-step-btn', 'chevron-down');
          else cont();
        };
        stepBtn();
      }
    } else if (b.type === 'quiz') {
      renderRich(body, b.prompt);
      const opts = h('div', 'sa-choices sa-quiz', el);
      const fb = h('div', 'sa-quiz-fb', el);
      el.appendChild(actions);
      let wrongs = 0, done = !current;
      const order = b.options.map((o, i) => i);
      if (current) order.sort(() => Math.random() - 0.5);
      const btns = [];
      order.forEach((oi, k) => {
        const o = b.options[oi];
        const btn = h('button', 'sa-choice', opts);
        h('span', 'sa-choice-letter', btn, String.fromCharCode(65 + k));
        renderRich(h('span', 'sa-choice-text', btn), o.tex);
        btns.push({ btn, o });
        btn.addEventListener('click', () => {
          if (done) return;
          if (o.correct) {
            done = true;
            btn.classList.add('is-right');
            fb.className = 'sa-quiz-fb is-right'; fb.innerHTML = '';
            renderRich(fb, `Correct. ${b.explain || o.why || ''}`);
            cont();
          } else {
            wrongs++;
            btn.classList.add('is-wrong');
            fb.className = 'sa-quiz-fb is-wrong'; fb.innerHTML = '';
            renderRich(fb, `Not quite. ${o.why || ''}${wrongs >= 2 ? ' The correct answer is highlighted.' : ' Try again.'}`);
            if (wrongs >= 2) { done = true; btns.forEach(({ btn: bb, o: oo }) => { if (oo.correct) bb.classList.add('is-right'); }); if (b.explain) renderRich(h('div', 'sa-quiz-explain', fb), b.explain); cont(); }
          }
          flushMath();
        });
      });
      if (!current) { btns.forEach(({ btn, o }) => { if (o.correct) btn.classList.add('is-right'); }); if (b.explain) { fb.className = 'sa-quiz-fb is-right'; renderRich(fb, b.explain); } }
    } else if (b.type === 'input') {
      renderRich(body, b.prompt);
      const row = h('div', 'sa-answer-row sa-input-beat', el);
      const inp = h('input', 'sa-input', row);
      inp.type = 'text'; inp.placeholder = b.placeholder || 'Your answer';
      inp.setAttribute('autocomplete', 'off'); inp.spellcheck = false;
      const chk = this.button(row, 'Check', () => check(), 'mod-cta sa-small');
      const fb = h('div', 'sa-quiz-fb', el);
      el.appendChild(actions);
      let wrongs = 0;
      const vars = b.vars || [];
      const check = () => {
        let ok = false;
        try {
          const want = parse(String(b.answer), vars), got = parse(inp.value, vars);
          const samples = Array.from({ length: vars.length ? 8 : 1 }, () => Object.fromEntries(vars.map((v) => [v, rand(0.3, 2.5)])));
          ok = sameValues(valuesAt(want, samples), valuesAt(got, samples), b.tol || 2e-3);
        } catch (e) { fb.className = 'sa-quiz-fb is-wrong'; fb.textContent = e instanceof ParseError ? e.message : 'Could not read that.'; return; }
        fb.innerHTML = '';
        if (ok) { fb.className = 'sa-quiz-fb is-right'; renderRich(fb, `Correct. ${b.explain || ''}`); inp.disabled = true; chk.disabled = true; cont(); }
        else {
          wrongs++;
          fb.className = 'sa-quiz-fb is-wrong';
          renderRich(fb, wrongs >= 2 ? `The answer is $${b.answerTex || b.answer}$. ${b.explain || ''}` : `Not quite. ${b.hint || 'Check your working and try again.'}`);
          if (wrongs >= 2) { inp.disabled = true; chk.disabled = true; cont(); }
        }
        flushMath();
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
      if (!current) { inp.value = String(b.answerTex ? '' : b.answer); inp.disabled = true; chk.disabled = true; fb.className = 'sa-quiz-fb is-right'; renderRich(fb, `Answer: $${b.answerTex || b.answer}$. ${b.explain || ''}`); }
    }
    return el;
  }

  /* ---------- save attempt as a note ---------- */
  async saveAttempt(auto) {
    try {
      const q = this.q, a = this.lastAttempt;
      const vault = this.app.vault;
      const sub = a.res.correct ? 'Solved' : 'Mistakes';
      const folder = obsidian.normalizePath(`${this.data.folder || 'Study Arena'}/${sub}`);
      await ensureFolder(vault, folder);
      const m = obsidian.moment ? obsidian.moment() : null;
      const stamp = m ? m.format('YYYY-MM-DD HHmm') : new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '');
      const clean = (s) => s.replace(/[\\/:*?"<>|#^[\]]/g, '');
      let base = clean(`${stamp} ${q.topic.name}`);
      let n = 1;
      while (vault.getAbstractFileByPath(`${folder}/${base}.md`)) base = clean(`${stamp} ${q.topic.name} ${++n}`);
      let embed = '';
      const png = await this.board.toPng();
      if (png) {
        await vault.createBinary(`${folder}/${base}.png`, png);
        embed = `\n## My work\n![[${base}.png]]\n`;
      }
      const verdict = a.res.correct ? 'correct' : a.res.revealed ? 'revealed' : 'wrong';
      const asMd = (tex, rich) => (rich != null ? rich : `$${tex}$`);
      const lines = [
        '---', `course: ${q.topic.course}`, `topic: "${q.topic.name}"`, q.topic.sec ? `section: "${q.topic.sec}"` : null,
        `result: ${verdict}`, `date: ${m ? m.format('YYYY-MM-DD') : new Date().toISOString().slice(0, 10)}`, 'tags: [study-arena]', '---',
        `# ${q.topic.name}`, '', `**Question:** ${q.prompt}`, '',
      ].filter((l) => l !== null);
      if (a.userTex || a.userRich) lines.push(`**My answer:** ${asMd(a.userTex, a.userRich)}`, '');
      lines.push(`**Correct answer:** ${asMd(q.answerTex, q.type === 'choice' ? q.answerTex : null)}`, '');
      if (a.res.mistake) {
        const stp = q.steps[a.res.mistake.stepIndex];
        lines.push(`> [!warning] Where it went wrong${stp ? `: step ${a.res.mistake.stepIndex + 1}, ${stp.title}` : ''}`, `> ${a.res.mistake.why}`, '');
      } else if (a.res.generic) {
        lines.push('> [!warning] Diagnosis', `> ${a.res.generic}`, '');
      }
      lines.push('## Worked solution');
      q.steps.forEach((s, i) => lines.push(`${i + 1}. **${s.title}**: ${s.body.replace(/<br>/g, ' ')}`));
      lines.push(embed);
      await vault.create(`${folder}/${base}.md`, lines.join('\n'));
      new Notice(auto ? `Saved to ${folder}` : `Saved "${base}"`);
    } catch (e) {
      console.error('Study Arena save failed', e);
      new Notice('Could not save this attempt to the vault.');
    }
  }

  /* ---------- panels ---------- */
  togglePanel(which) {
    if (!this.panel.hidden && this.panelKind === which) { this.panel.hidden = true; return; }
    this.panelKind = which;
    this.panel.hidden = false;
    this.panel.innerHTML = '';
    if (which === 'topics') this.renderTopics(); else this.renderStats();
  }

  renderTopics() {
    const p = this.panel;
    const head = h('div', 'sa-panel-head', p);
    h('div', 'sa-panel-title', head, 'Practice topics');
    const allBtn = this.button(head, 'Select all', async () => {
      this.data.selected = [...new Set([...this.data.selected, ...TOPICS.filter((t) => t.course === this.data.course).map((t) => t.id)])];
      await this.plugin.save();
      this.panel.innerHTML = ''; this.renderTopics();
    }, 'sa-ghost');
    allBtn.classList.add('sa-small');
    if (this.focus) {
      const note = h('div', 'sa-panel-note', p);
      h('span', '', note, `You're practising one skill from Learn mode (${topicById(this.focus.skill).name}). `);
      const exit = h('button', 'sa-linkbtn', note, 'Switch to mixed practice');
      exit.addEventListener('click', () => { this.focus = null; this.panel.hidden = true; this.newQuestion(); });
    }
    for (const ch of CHAPTERS.filter((c) => c.course === this.data.course)) {
      const g = h('div', 'sa-topic-group', p);
      h('div', 'sa-topic-ch', g, ch.name);
      const chips = h('div', 'sa-chips', g);
      for (const t of TOPICS.filter((x) => x.ch === ch.id)) {
        const chip = h('button', 'sa-chip', chips, topicLabel(t));
        chip.classList.toggle('is-on', this.data.selected.includes(t.id));
        chip.addEventListener('click', async () => {
          const on = this.data.selected.includes(t.id);
          if (on && this.data.selected.filter((id) => topicById(id) && topicById(id).course === this.data.course).length === 1) { new Notice('Keep at least one topic selected.'); return; }
          this.data.selected = on ? this.data.selected.filter((x) => x !== t.id) : [...this.data.selected, t.id];
          chip.classList.toggle('is-on', !on);
          await this.plugin.save();
        });
      }
    }
    h('div', 'sa-muted sa-panel-foot', p, 'New questions are drawn at random from the selected topics.');
  }

  renderStats() {
    const p = this.panel;
    const head = h('div', 'sa-panel-head', p);
    h('div', 'sa-panel-title', head, `Your stats · ${this.data.course}`);
    const tiles = h('div', 'sa-tiles', p);
    let right = 0, wrong = 0, revealed = 0;
    const mine = TOPICS.filter((t) => t.course === this.data.course);
    for (const t of mine) { const s = this.data.stats[t.id]; if (s) { right += s.right; wrong += s.wrong; revealed += s.revealed; } }
    const attempts = right + wrong + revealed;
    const mastered = mine.filter((t) => t.sec && this.mastery(t.id).mastered).length;
    const tile = (label, val) => { const t = h('div', 'sa-tile', tiles); h('div', 'sa-tile-val', t, String(val)); h('div', 'sa-tile-label', t, label); };
    tile('Points', this.data.points);
    tile('Best streak', this.data.bestStreak);
    tile('Skills mastered', `${mastered}/${mine.filter((t) => t.sec).length}`);
    tile('Accuracy', attempts ? `${Math.round((100 * right) / attempts)}%` : '—');
    const table = h('div', 'sa-stat-table', p);
    for (const t of mine) {
      const s = this.data.stats[t.id] || { right: 0, wrong: 0, revealed: 0 };
      const n = s.right + s.wrong + s.revealed;
      const row = h('div', 'sa-stat-row', table);
      h('div', 'sa-stat-name', row, topicLabel(t));
      const bar = h('div', 'sa-bar', row);
      h('div', 'sa-bar-fill', bar).style.width = n ? `${(100 * s.right) / n}%` : '0%';
      h('div', 'sa-stat-num', row, n ? `${s.right}/${n}` : '—');
    }
    const foot = h('div', 'sa-panel-foot', p);
    let armed = false;
    const reset = this.button(foot, 'Reset stats', async () => {
      if (!armed) { armed = true; reset.querySelector('.sa-btn-label').textContent = 'Tap again to reset'; return; }
      Object.assign(this.data, { points: 0, streak: 0, bestStreak: 0, stats: {}, mastery: {} });
      await this.plugin.save();
      this.refreshScore();
      this.renderBanner();
      this.panel.innerHTML = ''; this.renderStats();
    }, 'sa-ghost sa-small');
  }
}

async function ensureFolder(vault, path) {
  const parts = path.split('/');
  let cur = '';
  for (const part of parts) {
    cur = cur ? `${cur}/${part}` : part;
    if (!vault.getAbstractFileByPath(cur)) {
      try { await vault.createFolder(cur); } catch (e) { /* may already exist */ }
    }
  }
}

/* ================================================================== */
/* Plugin + settings                                                   */
/* ================================================================== */
const DEFAULTS = {
  points: 0, streak: 0, bestStreak: 0, stats: {}, mastery: {}, lessonPos: {},
  selected: null,
  penOnly: true, saveMistakes: true, folder: 'Study Arena', course: 'MATH 3705',
  updateRepo: '', updateBranch: 'main', checkUpdatesOnStart: true, lastSectionBy: { 'MATH 3705': '1.3', 'SYSC 3600': 'em' },
};

function cmpVersion(a, b) {
  const pa = String(a).split('.').map((x) => parseInt(x, 10) || 0), pb = String(b).split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}

class StudyArenaPlugin extends Plugin {
  async loadCourses() {
    const adapter = this.app.vault.adapter;
    const dir = `${this.manifest.dir}/courses`;
    try {
      if (!(await adapter.exists(dir))) return;
      const { files } = await adapter.list(dir);
      for (const f of files.filter((x) => x.endsWith('.js')).sort()) {
        try { loadCourseSource(await adapter.read(f), f); }
        catch (e) { console.error('Study Arena course', f, e); new Notice(`Study Arena: couldn't load ${f.split('/').pop()} (${e.message})`); }
      }
    } catch (e) { console.error('Study Arena courses', e); }
  }

  async onload() {
    await this.loadCourses();
    const saved = (await this.loadData()) || {};
    this.data = Object.assign({}, DEFAULTS, { selected: TOPICS.map((t) => t.id) }, saved);
    if (!this.data.lessonPos) this.data.lessonPos = {};
    // newly added topics are switched on for existing users too
    const V1_IDS = ['lap-basic', 'lap-trig', 'lap-pf', 'lap-ivp', 'lap-step', 'lap-conv', 'ser-ce', 'ser-rec', 'four', 'pde-heat', 'pde-wave', 'sl'];
    const known = saved.knownTopics || V1_IDS;
    const fresh = TOPICS.map((t) => t.id).filter((id) => !known.includes(id) && !(saved.selected || []).includes(id));
    this.data.selected = [...this.data.selected.filter((id) => TOPICS.some((t) => t.id === id)), ...(saved.selected ? fresh : [])];
    if (!this.data.selected.length) this.data.selected = TOPICS.map((t) => t.id);
    this.data.knownTopics = TOPICS.map((t) => t.id);
    if (!this.data.mastery) this.data.mastery = {};
    if (!COURSES.includes(this.data.course)) this.data.course = COURSES[0];
    this.data.lastSectionBy = Object.assign({}, DEFAULTS.lastSectionBy, this.data.lastSectionBy || {}, saved.lastSection && !saved.lastSectionBy ? { 'MATH 3705': saved.lastSection } : {});
    delete this.data.lastSection;
    try { if (obsidian.loadMathJax) await obsidian.loadMathJax(); } catch (e) { /* ignore */ }
    this.registerView(VIEW_TYPE, (leaf) => new StudyView(leaf, this));
    this.addRibbonIcon('graduation-cap', 'Open Study Arena', () => this.activate());
    this.addCommand({ id: 'open', name: 'Open Study Arena', callback: () => this.activate() });
    this.addCommand({ id: 'learn', name: 'Open Study Arena lessons', callback: async () => { const v = await this.activate(); if (v) v.openLearn(this.data.lastSectionBy[this.data.course]); } });
    this.addSettingTab(new StudySettingTab(this.app, this));
    this.addCommand({ id: 'update', name: 'Update Study Arena (download the latest version)', callback: () => this.update({ interactive: true }) });
    this.addCommand({ id: 'reload', name: 'Reload Study Arena (pick up files changed in the vault)', callback: () => this.reloadSelf('Study Arena reloaded.') });
    if (this.data.checkUpdatesOnStart && this.data.updateRepo) {
      this.app.workspace.onLayoutReady(() => setTimeout(() => this.update({ interactive: false }).catch(() => {}), 4000));
    }
  }
  async save() { await this.saveData(this.data); }

  /* ---------- self-update from GitHub ---------- */
  // The repo root holds the plugin files plus update.json: { "version": "1.6.0", "files": ["main.js", "styles.css", "courses/10-…js", …] }.
  // Files are fetched from the exact commit (raw.githubusercontent.com/<repo>/<sha>/…) so nothing is served stale.
  async update({ interactive }) {
    const repo = (this.data.updateRepo || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { if (interactive) new Notice('Study Arena: set the GitHub repo (owner/name) in Settings → Study Arena first.'); return; }
    if (!requestUrl) { if (interactive) new Notice('Study Arena: this Obsidian version cannot download updates.'); return; }
    const branch = this.data.updateBranch || 'main';
    const note = interactive ? new Notice('Study Arena: checking for updates…', 0) : null;
    const done = (msg, ms = 6000) => { if (note) note.hide(); if (msg) new Notice(msg, ms); };
    try {
      const head = await requestUrl({ url: `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(branch)}`, headers: { Accept: 'application/vnd.github+json' } });
      const sha = head.json && head.json.sha;
      if (!sha) throw new Error('could not read the latest commit');
      const raw = (f) => `https://raw.githubusercontent.com/${repo}/${sha}/${f.split('/').map(encodeURIComponent).join('/')}`;
      const info = (await requestUrl({ url: raw('update.json') })).json;
      if (!info || !info.version || !Array.isArray(info.files)) throw new Error('update.json is missing or malformed');
      const cur = this.manifest.version;
      if (cmpVersion(info.version, cur) <= 0) { done(interactive ? `Study Arena is up to date (v${cur}).` : null); return; }
      if (!interactive) {
        const n = new Notice(`Study Arena v${info.version} is available (you have v${cur}). Tap to update.`, 15000);
        n.noticeEl.addEventListener('click', () => { n.hide(); this.update({ interactive: true }); });
        return;
      }
      // download everything first; only write once all files arrived intact
      const files = info.files.filter((f) => typeof f === 'string' && !f.includes('..') && f !== 'data.json');
      const got = {};
      for (const f of files) {
        if (note) note.setMessage(`Study Arena: downloading ${f}…`);
        const r = await requestUrl({ url: raw(f) });
        if (r.status !== 200 || !r.text) throw new Error(`could not download ${f}`);
        got[f] = r.text;
      }
      const man = JSON.parse(got['manifest.json'] || '{}');
      if (man.id !== this.manifest.id) throw new Error('manifest.json in the repo is not Study Arena');
      if (got['main.js'] && !/StudyArenaPlugin/.test(got['main.js'])) throw new Error('main.js in the repo looks wrong');
      const adapter = this.app.vault.adapter, dir = this.manifest.dir;
      for (const f of files) {
        const parts = f.split('/');
        for (let i = 1; i < parts.length; i++) { const d = `${dir}/${parts.slice(0, i).join('/')}`; if (!(await adapter.exists(d))) await adapter.mkdir(d); }
      }
      for (const f of files.filter((x) => x !== 'manifest.json')) await adapter.write(`${dir}/${f}`, got[f]);
      // remove course modules that were renamed or dropped, so nothing loads twice
      const keep = new Set(files.filter((f) => f.startsWith('courses/')).map((f) => `${dir}/${f}`));
      if (await adapter.exists(`${dir}/courses`)) for (const f of (await adapter.list(`${dir}/courses`)).files) if (f.endsWith('.js') && !keep.has(f)) await adapter.remove(f);
      await adapter.write(`${dir}/manifest.json`, got['manifest.json']);
      done(null);
      await this.reloadSelf(`Study Arena updated to v${info.version}${info.notes ? ': ' + info.notes : '.'}`);
    } catch (e) {
      console.error('Study Arena update', e);
      done(interactive ? `Study Arena: update failed (${e.message || e}). Nothing was changed.` : null, 8000);
    }
  }
  async reloadSelf(msg) {
    const plugins = this.app.plugins, id = this.manifest.id;
    setTimeout(async () => {
      try { await plugins.disablePlugin(id); await plugins.enablePlugin(id); if (msg) new Notice(msg, 6000); }
      catch (e) { new Notice('Study Arena: please turn the plugin off and on in Community plugins.'); }
    }, 50);
  }
  async activate() {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = ws.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    ws.revealLeaf(leaf);
    return leaf.view instanceof StudyView ? leaf.view : null;
  }
}

class StudySettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.innerHTML = '';
    const d = this.plugin.data;
    new Setting(containerEl).setName('Pen only').setDesc('Only the stylus draws. Fingers scroll the page, so your palm won\'t leave marks.')
      .addToggle((t) => t.setValue(d.penOnly).onChange(async (v) => { d.penOnly = v; await this.plugin.save(); }));
    new Setting(containerEl).setName('Save wrong answers automatically').setDesc('Writes a note with the question, your drawing, the diagnosis and the worked solution to the Mistakes folder.')
      .addToggle((t) => t.setValue(d.saveMistakes).onChange(async (v) => { d.saveMistakes = v; await this.plugin.save(); }));
    new Setting(containerEl).setName('Folder').setDesc('Where saved attempts go (Mistakes/ and Solved/ subfolders).')
      .addText((t) => t.setValue(d.folder).onChange(async (v) => { d.folder = v.trim() || 'Study Arena'; await this.plugin.save(); }));
    containerEl.createEl('h3', { text: 'Updates' });
    new Setting(containerEl).setName('GitHub repo').setDesc('Where new versions are published, as owner/name (e.g. alexsylvestre/study-arena).')
      .addText((t) => t.setPlaceholder('owner/study-arena').setValue(d.updateRepo || '').onChange(async (v) => { d.updateRepo = v.trim(); await this.plugin.save(); }));
    new Setting(containerEl).setName('Check for updates when Obsidian starts').setDesc('Shows a notice you can tap when a new version is available.')
      .addToggle((t) => t.setValue(d.checkUpdatesOnStart !== false).onChange(async (v) => { d.checkUpdatesOnStart = v; await this.plugin.save(); }));
    new Setting(containerEl).setName(`Installed version: ${this.plugin.manifest.version}`).setDesc('Downloads the latest version from the repo and reloads the plugin. Your points and progress are kept.')
      .addButton((b) => b.setButtonText('Update now').setCta().onClick(() => this.plugin.update({ interactive: true })))
      .addButton((b) => b.setButtonText('Reload').onClick(() => this.plugin.reloadSelf('Study Arena reloaded.')));
  }
}

module.exports = StudyArenaPlugin;
// exposed for testing
module.exports.__engine = { cmpVersion, parse, evaluate, toTex, diagnose, diagnoseSet, makeQuestion, TOPICS, SECTIONS, CHAPTERS, COURSES, valuesAt, sameValues, sameSet, parseSet, loadCourseSource, lessonBeats, SA_API, makeWidget, renderRich, MASTERY_STREAK };
