#!/usr/bin/env node
// Study Arena course checker.
//   node tools/check-course.js                 check every courses/*.js
//   node tools/check-course.js 30-ecor3800.js  check one module (others still load first)
//   N=200 node tools/check-course.js           generate more questions per topic (default 40)
// Exits non-zero on any failure. If the `katex` npm package is resolvable, every TeX string is
// also compiled with it; otherwise a structural TeX check is used.
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');
const N = +process.env.N || 40;
let katex = null;
try { katex = require('katex'); } catch (e) { /* optional */ }

/* ---------- TeX checking ---------- */
const texErrors = [];
function checkTex(tex, where) {
  if (katex) {
    try { katex.renderToString(tex, { throwOnError: true, strict: false }); } catch (e) { texErrors.push(`${where}: ${e.message.split('\n')[0]}  ←  ${tex.slice(0, 120)}`); }
    return;
  }
  let d = 0;
  for (let i = 0; i < tex.length; i++) {
    if (tex[i] === '\\') { i++; continue; }
    if (tex[i] === '{') d++;
    if (tex[i] === '}') d--;
    if (d < 0) break;
    if (tex[i] === '%') { texErrors.push(`${where}: unescaped % in math (use \\%)  ←  ${tex.slice(0, 120)}`); return; }
  }
  if (d !== 0) texErrors.push(`${where}: unbalanced braces  ←  ${tex.slice(0, 120)}`);
  if (/undefined|NaN|Infinity/.test(tex)) texErrors.push(`${where}: contains undefined/NaN  ←  ${tex.slice(0, 120)}`);
}

/* ---------- minimal DOM so lessons and widgets can render ---------- */
let currentWhere = '';
class Node_ {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.style = {}; this._text = ''; this.listeners = {}; this.hidden = false; this.disabled = false; this.value = ''; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  get firstChild() { return this.children[0] || null; }
  setAttribute(k, v) { if (/NaN|undefined/.test(String(v))) throw new Error(`SVG attribute ${k}="${v}"`); this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  set textContent(t) { this._text = String(t); this.children = []; if (/\bNaN\b|undefined/.test(this._text)) throw new Error(`text "${this._text}"`); if (this.tagName === 'text' && /\\|\{,\}/.test(this._text)) throw new Error(`SVG label contains TeX (labels are plain text): "${this._text}"`); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set innerHTML(t) { this.children = []; this._text = ''; }
  get innerHTML() { return ''; }
  get classList() { const s = this; return { add() {}, remove() {}, toggle() {}, contains() { return false; } }; }
  set className(v) { this._cls = v; }
  get className() { return this._cls || ''; }
  scrollIntoView() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
global.document = {
  createElement: (t) => new Node_(t),
  createElementNS: (ns, t) => new Node_(t),
  createTextNode: (t) => { const n = new Node_('#text'); n._text = String(t); return n; },
};
global.window = global;

/* ---------- mock obsidian ---------- */
const obsidianMock = {
  ItemView: class { constructor(leaf) { this.leaf = leaf; } },
  Plugin: class {}, PluginSettingTab: class {}, Setting: class {}, Notice: class { constructor(m) { console.log('Notice:', m); } },
  normalizePath: (p) => p, setIcon() {},
  renderMath: (tex, display) => { checkTex(tex, currentWhere); const n = new Node_('span'); n._text = tex; return n; },
  finishRenderMath: () => {}, loadMathJax: async () => {},
};
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { if (req === 'obsidian') return 'obsidian'; return origResolve.call(this, req, ...rest); };
require.cache.obsidian = { id: 'obsidian', filename: 'obsidian', loaded: true, exports: obsidianMock };

const P = require(path.join(ROOT, 'main.js'));
const E = P.__engine;
const { parse, makeQuestion, TOPICS, SECTIONS, COURSES, valuesAt, sameValues, sameSet, parseSet, loadCourseSource, lessonBeats, makeWidget, renderRich } = E;

/* ---------- load modules ---------- */
const dir = path.join(ROOT, 'courses');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort() : [];
const only = process.argv[2] ? path.basename(process.argv[2]) : null;
const before = new Set(TOPICS.map((t) => t.id));
const sectionsBefore = new Map(SECTIONS.map((s) => [s.id, JSON.stringify(Object.keys(s))]));
let fails = 0;
const fail = (...a) => { fails++; if (fails <= 60) console.log('  ✗', ...a); };
const topicsFrom = {};
for (const f of files) {
  const pre = new Set(TOPICS.map((t) => t.id));
  try { loadCourseSource(fs.readFileSync(path.join(dir, f), 'utf8'), f); } catch (e) { fail(`${f}: failed to load: ${e.stack || e.message}`); continue; }
  topicsFrom[f] = TOPICS.filter((t) => !pre.has(t.id)).map((t) => t.id);
}
console.log(`Loaded ${files.length} module(s): ${files.join(', ')}  (katex: ${katex ? 'yes' : 'no, structural TeX check'})`);
console.log(`Courses: ${COURSES.join(', ')}  ·  ${TOPICS.length} topics  ·  ${SECTIONS.length} sections`);

/* ---------- which topics/sections to test ---------- */
const testTopics = only ? TOPICS.filter((t) => (topicsFrom[only] || []).includes(t.id)) : TOPICS;
const testSections = only ? SECTIONS.filter((s) => s.skills.some((id) => testTopics.find((t) => t.id === id)) || !sectionsBefore.has(s.id)) : SECTIONS;

/* ---------- structural checks ---------- */
for (const s of SECTIONS) {
  for (const id of s.skills) if (!TOPICS.find((t) => t.id === id)) fail(`section ${s.id}: skill "${id}" is not a topic`);
  if (!s.course) fail(`section ${s.id}: no course`);
}
for (const t of TOPICS) if (!t.course) fail(`topic ${t.id}: no course`);

/* ---------- questions ---------- */
function richCheck(str, where) {
  if (str == null) return;
  currentWhere = where;
  const el = new Node_('div');
  renderRich(el, str);
  // after removing math spans and escaped \$ / \%, any "$" left is an unmatched delimiter
  const rest = String(str).replace(/\$\$((?:\\[\s\S]|[^$\\])+?)\$\$|\$((?:\\[\s\S]|[^$\\])+?)\$|\\[$%]/g, '');
  if (rest.includes('$')) fail(`${where}: stray $ (write currency as \\$ in text)  ←  ${String(str).slice(0, 100)}`);
}
for (const t of testTopics) {
  const t0 = Date.now();
  let n = 0;
  for (let k = 0; k < N; k++) {
    let q;
    try { q = makeQuestion(t); } catch (e) { fail(`${t.id}: generator threw: ${e.message}`); break; }
    n++;
    const where = `${t.id}`;
    richCheck(q.prompt, `${where} prompt`);
    if (q.answerTex) { if (q.type === 'choice') richCheck(q.answerTex, `${where} answerTex`); else { currentWhere = `${where} answerTex`; checkTex(q.answerTex, currentWhere); } }
    for (const s of q.steps || []) { if (!s.key || !s.title) fail(`${where}: step missing key/title`); richCheck(s.body, `${where} step ${s.key}`); }
    if (q.figure) { currentWhere = `${where} figure`; try { makeWidget(new Node_('div'), q.figure); } catch (e) { fail(`${where}: figure threw: ${e.message}`); } }
    const keys = new Set((q.steps || []).map((s) => s.key));
    if (q.type === 'choice') {
      const right = q.options.filter((o) => o.correct).length;
      if (right !== 1) fail(`${where}: choice has ${right} correct options  ←  ${q.prompt.slice(0, 80)}`);
      for (const o of q.options) { richCheck(o.tex, `${where} option`); if (o.why) richCheck(o.why, `${where} option why`); if (o.step && !keys.has(o.step)) fail(`${where}: option points to unknown step "${o.step}"`); }
      continue;
    }
    for (const m of q.mistakes) { if (m.step && !keys.has(m.step)) fail(`${where}: mistake points to unknown step "${m.step}"`); if (m.why) richCheck(m.why, `${where} mistake`); }
    if (q.type === 'set') {
      if (!(q.answerSet || []).length || !q.answerSet.every(Number.isFinite)) fail(`${where}: set answer missing or not finite`);
      continue;
    }
    if (!q.answerVals.every(Number.isFinite)) fail(`${where}: answer not finite: ${q.answer}`);
    // the correct answer typed back in must be accepted
    try { const got = valuesAt(parse(q.answer, q.vars), q.samples); if (!sameValues(q.answerVals, got, q.tol)) fail(`${where}: answer not accepted`); } catch (e) { fail(`${where}: answer does not parse: ${q.answer}`); }
    // optional self-check hook: q.selfCheck() returns true or an error string
    if (typeof q.selfCheck === 'function') { const r = q.selfCheck(); if (r !== true) fail(`${where}: selfCheck: ${r}`); }
  }
  const ms = Date.now() - t0;
  if (ms > N * 60) console.log(`  ! ${t.id}: slow (${ms} ms for ${n})`);
}

/* ---------- lessons ---------- */
const BEATS = new Set(['text', 'example', 'quiz', 'input', 'graph']);
for (const s of testSections) {
  const beats = lessonBeats(s);
  if (!beats.length) fail(`section ${s.id}: lesson is empty`);
  beats.forEach((b, i) => {
    const where = `lesson ${s.id}#${i + 1} (${b.type})`;
    if (!BEATS.has(b.type)) return fail(`${where}: unknown beat type`);
    if (b.title) richCheck(b.title, where);
    richCheck(b.body, where); richCheck(b.prompt, where); richCheck(b.explain, where); richCheck(b.after, where);
    if (b.widget) { currentWhere = where; try { makeWidget(new Node_('div'), b.widget); } catch (e) { fail(`${where}: widget threw: ${e.message}`); }
      // sweep each slider to its ends
      for (const prm of b.widget.params || []) for (const v of [prm.min, prm.max]) {
        const spec = Object.assign({}, b.widget, { params: b.widget.params.map((q) => (q === prm ? Object.assign({}, q, { value: v }) : q)) });
        try { makeWidget(new Node_('div'), spec); } catch (e) { fail(`${where}: widget threw at ${prm.key}=${v}: ${e.message}`); }
      }
    }
    if (b.type === 'graph' && !b.widget) fail(`${where}: graph beat needs a widget`);
    if (b.type === 'example') { if (!Array.isArray(b.steps) || !b.steps.length) fail(`${where}: example needs steps`); (b.steps || []).forEach((st) => richCheck(typeof st === 'string' ? st : st.body, where)); }
    if (b.type === 'quiz') {
      const right = (b.options || []).filter((o) => o.correct).length;
      if (right !== 1) fail(`${where}: quiz needs exactly one correct option (has ${right})`);
      (b.options || []).forEach((o) => { richCheck(o.tex, where); richCheck(o.why, where); });
    }
    if (b.type === 'input') {
      try { parse(String(b.answer), b.vars || []); } catch (e) { fail(`${where}: answer "${b.answer}" does not parse`); }
      if (b.answerTex) { currentWhere = where; checkTex(b.answerTex, where); }
    }
  });
}

for (const e of texErrors.slice(0, 40)) console.log('  ✗ TeX', e);
fails += texErrors.length;
console.log(fails ? `\n${fails} problem(s) found.` : `\nAll good: ${testTopics.length} topics × ${N} questions, ${testSections.length} lessons.`);
process.exit(fails ? 1 : 0);
