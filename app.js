'use strict';
/* MyFitness — 부위별 운동 기록/목표 달성률 앱 (초안, 데이터는 브라우저 localStorage에 저장) */

const KEY = 'myfitness.v1';
const PARTS = [
  { id: 'shoulder', name: '어깨' }, { id: 'chest', name: '가슴' }, { id: 'back', name: '등' },
  { id: 'lowback', name: '허리' }, { id: 'arm', name: '팔' }, { id: 'abs', name: '복근' },
  { id: 'leg', name: '허벅지' }, { id: 'calf', name: '종아리' }, { id: 'cardio', name: '유산소' },
];
const NAMES = Object.fromEntries(PARTS.map(p => [p.id, p.name]));
const PAIN = [
  { v: 0, t: '느낌없음', c: '#3ddc97' },
  { v: 1, t: '살짝 아픔', c: '#f5c542' },
  { v: 2, t: '많이 아픔', c: '#ff5d5d' },
];
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/* ---------- 유틸 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const fmtPct = p => p == null ? '–' : (p >= 100 ? Math.round(p) : +p.toFixed(1)) + '%';
const fmtN = n => (+n.toFixed(1)).toLocaleString('ko-KR');
const todayS = () => ymd(new Date());
const shortDate = s => { const d = parseD(s); return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`; };

/* ---------- 데이터 ---------- */
function seed() {
  const ex = (part, name, unit, reps, sets) => ({ id: uid(), part, name, unit, goalDays: 50, perWeek: 2, reps, sets });
  const pec = ex('chest', '팩덱플라이', '회', 10, 3);
  const vsq = ex('leg', '퓨어 브이스쿼트', '회', 10, 3);
  const lat = ex('back', '랫풀다운', '회', 15, 3);
  const run = ex('cardio', '런닝', '분', 20, 1);
  const lg = (exId, date, weight, reps, sets, memo = '') => ({ id: uid(), date, exId, weight, reps, sets, pain: 0, memo });
  return {
    v: 1,
    settings: { goalDays: 50, perWeek: 2 },
    exercises: [pec, vsq, lat, run],
    logs: [
      lg(pec.id, '2026-10-22', 15, 10, 3), lg(pec.id, '2026-10-29', 15, 10, 3),
      lg(vsq.id, '2026-10-22', 20, 10, 3), lg(vsq.id, '2026-10-29', 20, 10, 4),
      lg(lat.id, '2026-10-29', 20, 15, 3),
      lg(run.id, '2026-10-22', 0, 20, 1, '2.75km'), lg(run.id, '2026-10-29', 0, 15, 1, '2km'),
    ],
  };
}
function load() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY));
    if (o && Array.isArray(o.exercises) && Array.isArray(o.logs)) return { settings: { goalDays: 50, perWeek: 2 }, ...o };
  } catch (e) { /* 첫 실행 */ }
  return seed();
}
let S = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(S));

/* ---------- 계산 ---------- */
const exOf = id => S.exercises.find(e => e.id === id);
const unitOf = e => e ? e.unit : '회';
const target = e => e.goalDays * e.reps * e.sets;            // 분모: 목표일 × 회 × 세트
const amount = l => l.reps * l.sets;                          // 분자: 기록 1건 = 회 × 세트

function weekRange(dateStr) {                                  // 일~토
  const d = parseD(dateStr); d.setDate(d.getDate() - d.getDay());
  const s = ymd(d); d.setDate(d.getDate() + 6);
  return [s, ymd(d)];
}
function compute() {
  const done = {};
  S.logs.forEach(l => { done[l.exId] = (done[l.exId] || 0) + amount(l); });
  const [w0, w1] = weekRange(todayS());
  const week = {};
  S.logs.forEach(l => { if (l.date >= w0 && l.date <= w1) (week[l.exId] ||= new Set()).add(l.date); });
  const exs = S.exercises.map(e => {
    const t = target(e), d = done[e.id] || 0;
    return { e, t, d, pct: t > 0 ? d / t * 100 : null, weekDays: week[e.id]?.size || 0 };
  });
  const sum = list => {
    const t = list.reduce((a, x) => a + x.t, 0), d = list.reduce((a, x) => a + x.d, 0);
    return { t, d, pct: t > 0 ? d / t * 100 : null };
  };
  const parts = {};
  PARTS.forEach(p => {
    const list = exs.filter(x => x.e.part === p.id);
    parts[p.id] = { ...sum(list), list };
  });
  const allDates = new Set(S.logs.map(l => l.date));
  const weekDates = new Set(S.logs.filter(l => l.date >= w0 && l.date <= w1).map(l => l.date));
  return { exs, parts, total: sum(exs), days: allDates.size, weekDays: weekDates.size };
}

/* ---------- 색상 ---------- */
function pctColor(p) {
  if (p == null || p <= 0) return '#262f3f';
  if (p > 100) return '#f5c542';
  const t = Math.min(p, 100) / 100;
  return `hsl(${Math.round(205 - 65 * t)} ${Math.round(40 + 40 * t)}% ${Math.round(28 + 24 * t)}%)`;
}
const barColor = p => p > 100 ? '#f5c542' : pctColor(Math.max(p, 8));

function painOf(partId) {                                      // 최근 14일 중 가장 최근 날의 최대 통증
  const since = new Date(); since.setDate(since.getDate() - 14);
  const s = ymd(since);
  const ls = S.logs.filter(l => exOf(l.exId)?.part === partId && l.date >= s && l.pain > 0);
  if (!ls.length) return 0;
  const last = ls.reduce((a, l) => l.date > a ? l.date : a, '');
  return Math.max(...ls.filter(l => l.date === last).map(l => l.pain));
}

/* ---------- 메인 화면 ---------- */
let cal = (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })();
let selDate = todayS();
let openHist = new Set();
let bodyView = 'front';

function render() {
  const C = compute();
  const info = part => {
    const p = C.parts[part];
    return { color: pctColor(p.pct), pct: fmtPct(p.pct), pain: painOf(part), glow: p.pct > 100 };
  };
  const tp = Math.min(C.total.pct ?? 0, 100);
  const R = 34, L = 2 * Math.PI * R;
  $('#app').innerHTML = `
    ${bodyDefs()}
    <section class="card total">
      <svg viewBox="0 0 80 80" class="ring"><circle cx="40" cy="40" r="${R}" class="rbg"/>
        <circle cx="40" cy="40" r="${R}" class="rfg ${C.total.pct > 100 ? 'gold' : ''}" stroke-dasharray="${(L * tp / 100).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 40 40)"/>
        <text x="40" y="45" text-anchor="middle" class="rt">${fmtPct(C.total.pct)}</text></svg>
      <div class="tinfo">
        <div class="tlabel">전체 운동 진행도</div>
        <div class="tnum">${fmtN(C.total.d)} <small>/ ${fmtN(C.total.t)}</small></div>
        <div class="tsub">운동한 날 <b>${C.days}</b>일 · 이번 주 <b>${C.weekDays}</b>일</div>
      </div>
    </section>

    <section class="card statusbox">
      <div class="figcol">
        <div class="viewtabs">${[['front', '앞면'], ['back', '뒷면']].map(([v, n]) => `<button class="${v === bodyView ? 'on' : ''}" data-view="${v}">${n}</button>`).join('')}</div>
        ${bodySVG(bodyView, info, NAMES)}
      </div>
      <div class="statcol">
        ${PARTS.map(p => {
          const x = C.parts[p.id];
          return `<button class="prow" data-part="${p.id}">
            <span class="pt"><span class="pn">${p.name}${painOf(p.id) ? `<i class="pd p${painOf(p.id)}"></i>` : ''}</span><span class="pv">${fmtPct(x.pct)}</span></span>
            <span class="pb"><span style="width:${Math.min(x.pct ?? 0, 100)}%;background:${barColor(x.pct ?? 0)}"></span></span></button>`;
        }).join('')}
      </div>
      <div class="legend"><span><i style="background:${pctColor(1)}"></i>시작</span><span><i style="background:${pctColor(50)}"></i>50%</span>
        <span><i style="background:${pctColor(100)}"></i>100%</span><span><i style="background:#f5c542"></i>초과달성</span>
        <span><i class="pd p1"></i>살짝 아픔</span><span><i class="pd p2"></i>많이 아픔</span></div>
    </section>

    <section class="card" id="calCard">${calendarHTML()}</section>

    <details class="card hist" id="hist" ${$('#hist')?.open ? 'open' : ''}>
      <summary>📒 일일 기록 <small>(${new Set(S.logs.map(l => l.date)).size}일 · ${S.logs.length}건)</small></summary>
      <div class="histbody">${historyHTML()}</div>
    </details>
    <footer>MyFitness 초안 · 데이터는 이 기기의 브라우저에 저장돼요</footer>`;
}

/* ---------- 달력 ---------- */
function calendarHTML() {
  const { y, m } = cal;
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const byDate = {};
  S.logs.forEach(l => { (byDate[l.date] ||= []).push(l); });
  let cells = '';
  for (let i = 0; i < first.getDay(); i++) cells += '<span class="day empty"></span>';
  for (let d = 1; d <= last.getDate(); d++) {
    const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
    const ls = byDate[ds];
    const parts = ls ? [...new Set(ls.map(l => exOf(l.exId)?.part).filter(Boolean))].slice(0, 4) : [];
    cells += `<button class="day${ls ? ' has' : ''}${ds === todayS() ? ' today' : ''}${ds === selDate ? ' sel' : ''}" data-date="${ds}">
      <b>${d}</b>${ls ? '<em>✓</em>' : ''}<span class="dots">${parts.map(p => `<i class="c-${p}"></i>`).join('')}</span></button>`;
  }
  const monthDays = new Set(S.logs.filter(l => l.date.startsWith(`${y}-${pad(m + 1)}`)).map(l => l.date)).size;
  const dayLogs = byDate[selDate] || [];
  return `
    <div class="calhead"><button class="ic" data-cal="-1">‹</button>
      <h3>${y}년 ${m + 1}월 <small>${monthDays}일 운동</small></h3><button class="ic" data-cal="1">›</button></div>
    <div class="calgrid">${DOW.map((d, i) => `<span class="dow${i === 0 ? ' sun' : ''}">${d}</span>`).join('')}${cells}</div>
    <div class="daystrip">
      <div class="dshead"><b>${shortDate(selDate)}</b><button class="mini primary" data-addon="${selDate}">＋ 기록</button></div>
      ${dayLogs.length ? dayLogs.map(logLine).join('') : '<p class="muted">이 날은 기록이 없어요.</p>'}
    </div>`;
}
function logLine(l) {
  const e = exOf(l.exId), u = unitOf(e), p = PAIN[l.pain || 0];
  const main = u === '분' ? `${l.reps}분` : `${l.weight ? l.weight + 'kg · ' : ''}${l.reps}회 × ${l.sets}세트`;
  return `<div class="logline"><span class="tag">${NAMES[e?.part] || '?'}</span>
    <span class="ln"><b>${esc(e?.name || '(삭제된 종목)')}</b> ${main}${l.memo ? ` <em>${esc(l.memo)}</em>` : ''}</span>
    <i class="pd p${l.pain || 0}" title="${p.t}"></i><button class="mini" data-edit="${l.id}">수정</button></div>`;
}

/* ---------- 일일 기록 (접이식) ---------- */
function historyHTML() {
  const dates = [...new Set(S.logs.map(l => l.date))].sort().reverse();
  if (!dates.length) return '<p class="muted">아직 기록이 없어요.</p>';
  return dates.map(ds => {
    const ls = S.logs.filter(l => l.date === ds);
    return `<details class="hday" data-d="${ds}" ${openHist.has(ds) ? 'open' : ''}>
      <summary>${shortDate(ds)} <small>${[...new Set(ls.map(l => NAMES[exOf(l.exId)?.part] || '?'))].join(' · ')}</small></summary>
      ${ls.map(logLine).join('')}</details>`;
  }).join('');
}

/* ---------- 기록 팝업 ---------- */
const dlg = $('#dlg');
function closeDlg() { dlg.close(); }
dlg.addEventListener('click', e => { if (e.target === dlg) closeDlg(); });
dlg.addEventListener('close', () => { render(); });

let rec = null; // 현재 편집 중인 기록 폼 상태
function openRecord({ part, date, editId } = {}) {
  const l = editId ? S.logs.find(x => x.id === editId) : null;
  const e0 = l ? exOf(l.exId) : null;
  rec = {
    editId: l?.id || null,
    part: l ? (e0?.part || 'chest') : (part || PARTS.find(p => S.exercises.some(e => e.part === p.id))?.id || 'chest'),
    exId: l?.exId || null,
    date: l?.date || date || todayS(),
    weight: l ? l.weight : '', reps: l ? l.reps : '', sets: l ? l.sets : '',
    pain: l?.pain || 0, memo: l?.memo || '',
  };
  recPickDefaults(!l);
  drawRecord();
  dlg.showModal();
}
function recPickDefaults(prefill) {
  const list = S.exercises.filter(e => e.part === rec.part);
  if (!list.some(e => e.id === rec.exId)) rec.exId = list[0]?.id || null;
  if (prefill && rec.exId) {                                  // 직전 기록 값을 기본값으로
    const e = exOf(rec.exId);
    const last = [...S.logs].filter(x => x.exId === rec.exId).sort((a, b) => a.date.localeCompare(b.date)).pop();
    rec.weight = last ? last.weight : '';
    rec.reps = last ? last.reps : e.reps;
    rec.sets = last ? last.sets : e.sets;
  }
}
function drawRecord() {
  const C = compute();
  const P = C.parts[rec.part];
  const list = S.exercises.filter(e => e.part === rec.part);
  const e = exOf(rec.exId), u = unitOf(e);
  dlg.innerHTML = `<form method="dialog" class="sheet" id="recForm">
    <div class="sheethead"><h2>${rec.editId ? '기록 수정' : '운동 기록'}</h2><button type="button" class="ic" data-close>✕</button></div>
    <div class="chips">${PARTS.map(p => `<button type="button" class="chip${p.id === rec.part ? ' on' : ''}" data-rp="${p.id}">${p.name}</button>`).join('')}</div>

    <div class="partsum"><b>${NAMES[rec.part]}</b> <span class="big">${fmtPct(P.pct)}</span>
      ${P.list.map(x => `<div class="exrow"><span>${esc(x.e.name)}</span>
        <span class="pb"><span style="width:${Math.min(x.pct ?? 0, 100)}%;background:${barColor(x.pct ?? 0)}"></span></span>
        <span class="pv">${fmtPct(x.pct)}</span>
        <small>${fmtN(x.d)}/${fmtN(x.t)}${x.e.unit} · 이번 주 ${x.weekDays}/${x.e.perWeek}일</small></div>`).join('') || '<p class="muted">이 부위에 등록된 종목이 없어요. ⚙️ 옵션에서 추가해줘!</p>'}
    </div>

    ${list.length ? `
    <label>운동 종목<select name="exId">${list.map(x => `<option value="${x.id}" ${x.id === rec.exId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    <label>운동 날짜<input type="date" name="date" value="${rec.date}" required></label>
    <div class="grid3">
      ${u === '분' ? '' : `<label>무게(kg)<input type="number" name="weight" inputmode="decimal" step="0.5" min="0" value="${rec.weight}" placeholder="맨몸=0"></label>`}
      <label>${u === '분' ? '시간(분)' : '세트당 횟수'}<input type="number" name="reps" inputmode="decimal" min="0.1" step="any" value="${rec.reps}" required></label>
      ${u === '분' ? '' : `<label>세트 수<input type="number" name="sets" inputmode="numeric" min="1" step="1" value="${rec.sets}" required></label>`}
    </div>
    <div class="lbl">운동 후 느낌</div>
    <div class="pains">${PAIN.map(p => `<label class="pain"><input type="radio" name="pain" value="${p.v}" ${p.v === rec.pain ? 'checked' : ''}><span style="--c:${p.c}">${p.t}</span></label>`).join('')}</div>
    <label>메모<input type="text" name="memo" value="${esc(rec.memo)}" placeholder="${u === '분' ? '예: 2.75km' : '선택'}"></label>
    <div class="btns">${rec.editId ? '<button type="button" class="danger" data-del>삭제</button>' : ''}<button type="submit" class="primary">${rec.editId ? '저장' : '기록하기'}</button></div>` : ''}
  </form>`;
}
dlg.addEventListener('change', ev => {
  if (!rec) return;
  const f = $('#recForm'); if (!f || !f.contains(ev.target)) return;
  const n = ev.target.name;
  if (n === 'exId') { syncRec(); rec.exId = ev.target.value; recPickDefaults(!rec.editId); drawRecord(); }
});
function syncRec() {                                            // 폼 → rec
  const f = $('#recForm'); if (!f) return;
  const fd = new FormData(f);
  ['date', 'weight', 'reps', 'sets', 'memo'].forEach(k => { if (fd.has(k)) rec[k] = fd.get(k); });
  if (fd.has('pain')) rec.pain = +fd.get('pain');
}
dlg.addEventListener('click', ev => {
  const t = ev.target.closest('button'); if (!t) return;
  if (t.dataset.close !== undefined) return closeDlg();
  if (t.dataset.rp && rec) { syncRec(); rec.part = t.dataset.rp; rec.exId = null; recPickDefaults(!rec.editId); drawRecord(); }
  if (t.dataset.del !== undefined && rec?.editId) {
    if (confirm('이 기록을 삭제할까?')) { S.logs = S.logs.filter(l => l.id !== rec.editId); save(); closeDlg(); }
  }
});
dlg.addEventListener('submit', ev => {
  if (ev.target.id !== 'recForm') return;
  syncRec();
  const e = exOf(rec.exId); if (!e) return;
  const u = unitOf(e);
  const row = {
    id: rec.editId || uid(), date: rec.date, exId: rec.exId,
    weight: u === '분' ? 0 : num(rec.weight), reps: num(rec.reps), sets: u === '분' ? 1 : Math.max(1, Math.round(num(rec.sets, 1))),
    pain: rec.pain, memo: String(rec.memo || '').trim(),
  };
  if (!row.date || row.reps <= 0) return ev.preventDefault();
  const i = S.logs.findIndex(l => l.id === row.id);
  if (i >= 0) S.logs[i] = row; else S.logs.push(row);
  save();
  selDate = row.date;
  const d = parseD(row.date); cal = { y: d.getFullYear(), m: d.getMonth() };
  rec = null;
});

/* ---------- 옵션 팝업 ---------- */
function openOptions() { drawOptions(); dlg.showModal(); rec = null; }
function drawOptions() {
  const C = compute();
  const scroll = $('.sheet')?.scrollTop || 0;
  dlg.innerHTML = `<div class="sheet" id="optSheet">
    <div class="sheethead"><h2>⚙️ 옵션</h2><button type="button" class="ic" data-close>✕</button></div>

    <h3>🎯 운동 목표치</h3>
    <p class="hint">종목별 <b>분모 = 목표일수 × 회 × 세트</b>. 기록 1건(회×세트)이 분자로 쌓여요. 예) 50일 × 10회 × 3세트 = 1500 → 하루 30회 = 2%</p>
    <div class="grid2 defaults">
      <label>새 종목 기본 목표일수<input type="number" min="1" data-set="goalDays" value="${S.settings.goalDays}"></label>
      <label>새 종목 기본 주당 일수<input type="number" min="1" max="7" data-set="perWeek" value="${S.settings.perWeek}"></label>
    </div>
    <button type="button" class="mini" data-applyall>⬇ 모든 종목에 기본 목표 적용</button>

    <h3>🏋️ 부위별 운동 종목</h3>
    ${PARTS.map(p => {
      const list = C.parts[p.id].list;
      return `<div class="optpart"><div class="ophead"><b>${p.name}</b><span>${fmtPct(C.parts[p.id].pct)}</span></div>
        ${list.map(x => `<div class="optex" data-ex="${x.e.id}">
          <div class="oname"><input class="nm" data-f="name" value="${esc(x.e.name)}"><button type="button" class="ic sm" data-delex="${x.e.id}" title="삭제">🗑</button></div>
          <div class="ogrid">
            <label>목표일<input type="number" min="1" data-f="goalDays" value="${x.e.goalDays}"></label>
            <label>주당(일)<input type="number" min="1" max="7" data-f="perWeek" value="${x.e.perWeek}"></label>
            <label>${x.e.unit === '분' ? '분' : '회/세트'}<input type="number" min="1" data-f="reps" value="${x.e.reps}"></label>
            ${x.e.unit === '분' ? '<span></span>' : `<label>세트<input type="number" min="1" data-f="sets" value="${x.e.sets}"></label>`}
          </div>
          <small class="muted">분모 ${fmtN(x.t)}${x.e.unit} · 달성 ${fmtN(x.d)}${x.e.unit} (${fmtPct(x.pct)})</small></div>`).join('') || '<p class="muted">등록된 종목 없음</p>'}
        <div class="addex" data-addpart="${p.id}"><input placeholder="종목 이름 추가" data-newname><select data-newunit><option>회</option><option>분</option></select>
          <button type="button" class="mini primary" data-addex>추가</button></div></div>`;
    }).join('')}

    <h3>💾 데이터</h3>
    <div class="btns wrap"><button type="button" class="mini" data-export>⬆ 내보내기(JSON)</button>
      <label class="mini filebtn">⬇ 가져오기<input type="file" accept="application/json" data-import hidden></label>
      <button type="button" class="mini danger" data-reset>전체 초기화</button></div>
  </div>`;
  const s = $('.sheet'); if (s) s.scrollTop = scroll;
}
dlg.addEventListener('input', ev => {                          // 옵션 입력은 즉시 저장 (다시 그리지 않음 → 입력 포커스 유지)
  if (!$('#optSheet')) return;
  const t = ev.target;
  if (t.dataset.set) { S.settings[t.dataset.set] = Math.max(1, Math.round(num(t.value, 1))); save(); }
  if (t.dataset.f) {
    const e = exOf(t.closest('[data-ex]').dataset.ex), f = t.dataset.f;
    if (f === 'name') e.name = t.value.trim() || e.name;
    else e[f] = Math.max(1, Math.round(num(t.value, 1)));
    save();
  }
});
dlg.addEventListener('change', ev => {                          // 값 확정 시 분모/달성 표시 갱신
  if (!$('#optSheet')) return;
  if (ev.target.dataset.f && ev.target.dataset.f !== 'name') {     // 포커스 유지하려고 해당 종목 요약만 갱신
    const row = ev.target.closest('[data-ex]'), x = compute().exs.find(v => v.e.id === row.dataset.ex);
    $('small', row).textContent = `분모 ${fmtN(x.t)}${x.e.unit} · 달성 ${fmtN(x.d)}${x.e.unit} (${fmtPct(x.pct)})`;
  }
  if (ev.target.matches('[data-import]')) {
    const f = ev.target.files[0]; if (!f) return;
    f.text().then(txt => {
      try {
        const o = JSON.parse(txt);
        if (!Array.isArray(o.exercises) || !Array.isArray(o.logs)) throw 0;
        if (!confirm('현재 데이터를 가져온 파일로 덮어쓸까?')) return;
        S = { settings: { goalDays: 50, perWeek: 2 }, ...o }; save(); drawOptions();
      } catch (e) { alert('올바른 백업 파일이 아니에요.'); }
    });
  }
});
dlg.addEventListener('click', ev => {
  if (!$('#optSheet')) return;
  const t = ev.target.closest('button'); if (!t) return;
  if (t.dataset.applyall !== undefined) {
    if (confirm('모든 종목의 목표일수/주당일수를 기본값으로 바꿀까?')) {
      S.exercises.forEach(e => { e.goalDays = S.settings.goalDays; e.perWeek = S.settings.perWeek; }); save(); drawOptions();
    }
  }
  if (t.dataset.delex) {
    const e = exOf(t.dataset.delex), n = S.logs.filter(l => l.exId === e.id).length;
    if (confirm(`'${e.name}' 종목을 삭제할까?${n ? `\n이 종목의 기록 ${n}건도 같이 삭제돼요.` : ''}`)) {
      S.exercises = S.exercises.filter(x => x.id !== e.id); S.logs = S.logs.filter(l => l.exId !== e.id); save(); drawOptions();
    }
  }
  if (t.dataset.addex !== undefined) {
    const box = t.closest('[data-addpart]'), name = $('[data-newname]', box).value.trim();
    if (!name) return;
    const unit = $('[data-newunit]', box).value;
    S.exercises.push({ id: uid(), part: box.dataset.addpart, name, unit, goalDays: S.settings.goalDays, perWeek: S.settings.perWeek, reps: unit === '분' ? 20 : 10, sets: unit === '분' ? 1 : 3 });
    save(); drawOptions();
  }
  if (t.dataset.export !== undefined) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
    a.download = `myfitness-${todayS()}.json`; a.click(); URL.revokeObjectURL(a.href);
  }
  if (t.dataset.reset !== undefined && confirm('모든 기록과 종목을 초기화할까? (되돌릴 수 없어요)')) {
    S = seed(); save(); drawOptions();
  }
});

/* ---------- 메인 이벤트 ---------- */
document.addEventListener('click', ev => {
  const t = ev.target;
  if (t.closest('#btnAdd')) return openRecord();
  if (t.closest('#btnOpt')) return openOptions();
  const reg = t.closest('[data-part]');
  if (reg && !dlg.contains(reg) && !reg.closest('.addex')) return openRecord({ part: reg.dataset.part });
  const vw = t.closest('[data-view]'); if (vw) { bodyView = vw.dataset.view; return render(); }
  const nav = t.closest('[data-cal]');
  if (nav) { cal.m += +nav.dataset.cal; if (cal.m < 0) { cal.m = 11; cal.y--; } if (cal.m > 11) { cal.m = 0; cal.y++; } $('#calCard').innerHTML = calendarHTML(); return; }
  const day = t.closest('.day[data-date]');
  if (day) { selDate = day.dataset.date; $('#calCard').innerHTML = calendarHTML(); return; }
  const add = t.closest('[data-addon]'); if (add) return openRecord({ date: add.dataset.addon });
  const ed = t.closest('[data-edit]'); if (ed) return openRecord({ editId: ed.dataset.edit });
});
document.addEventListener('keydown', ev => {
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches?.('g.region')) { ev.preventDefault(); openRecord({ part: ev.target.dataset.part }); }
});
document.addEventListener('toggle', ev => {
  const d = ev.target; if (d.classList?.contains('hday')) d.open ? openHist.add(d.dataset.d) : openHist.delete(d.dataset.d);
}, true);

render();
