'use strict';
/* MyFitness — 부위별 운동 기록 / 월간 목표 달성률 (데이터는 브라우저 localStorage에 저장) */

const KEY = 'myfitness.v1';
const PARTS = [
  { id: 'shoulder', name: '어깨' }, { id: 'chest', name: '가슴' }, { id: 'back', name: '등' },
  { id: 'lowback', name: '허리' }, { id: 'arm', name: '팔' }, { id: 'abs', name: '복근' },
  { id: 'leg', name: '허벅지' }, { id: 'calf', name: '종아리' }, { id: 'cardio', name: '유산소' },
];
const NAMES = Object.fromEntries(PARTS.map(p => [p.id, p.name]));
const PAIN = [
  { v: 0, t: '느낌없음', c: '#03b26c' },
  { v: 1, t: '살짝 아픔', c: '#ff8a1f' },
  { v: 2, t: '많이 아픔', c: '#f04452' },
];
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const ACCENT = '#3182f6', GOLD = '#ffb400';

const I = {
  gear: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.7 1.7 1l.4 2.5h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.3.9 2-3.4-2-1.5Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m5 9 7 7 7-7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>',
  down2: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  up2: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
};
const ic = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

/* ---------- 유틸 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const fmtPct = p => p == null ? '–' : (p >= 100 ? Math.round(p) : +p.toFixed(1)) + '%';
const fmtN = n => (+n.toFixed(1)).toLocaleString('ko-KR');
const todayS = () => ymd(new Date());
const curYM = () => todayS().slice(0, 7);
const shortDate = s => { const d = parseD(s); return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`; };
const monthOf = ym => +ym.slice(5, 7);

/* ---------- 데이터 ---------- */
function seed() {
  const ex = (part, name, unit, reps, sets) => ({ id: uid(), part, name, unit, monthDays: 8, perWeek: 2, reps, sets });
  const pec = ex('chest', '팩덱플라이', '회', 10, 3);
  const vsq = ex('leg', '퓨어 브이스쿼트', '회', 10, 3);
  const lat = ex('back', '랫풀다운', '회', 15, 3);
  const run = ex('cardio', '런닝', '분', 20, 1);
  const lg = (exId, date, weight, reps, sets, memo = '') => ({ id: uid(), date, exId, weight, reps, sets, pain: 0, memo });
  return {
    v: 2,
    settings: { monthDays: 8, perWeek: 2 },
    exercises: [pec, vsq, lat, run],
    logs: [
      lg(pec.id, '2026-10-22', 15, 10, 3), lg(pec.id, '2026-10-29', 15, 10, 3),
      lg(vsq.id, '2026-10-22', 20, 10, 3), lg(vsq.id, '2026-10-29', 20, 10, 4),
      lg(lat.id, '2026-10-29', 20, 15, 3),
      lg(run.id, '2026-10-22', 0, 20, 1, '2.75km'), lg(run.id, '2026-10-29', 0, 15, 1, '2km'),
    ],
  };
}
function migrate(o) {                                          // v1(누적 목표일수) → v2(월 목표일수)
  const perWeek = o.settings?.perWeek || 2;
  if (!o.v || o.v < 2) {
    o.exercises.forEach(e => { e.monthDays = (e.perWeek || perWeek) * 4; delete e.goalDays; });
    o.settings = { monthDays: perWeek * 4, perWeek };
    o.v = 2;
  }
  o.settings = { monthDays: 8, perWeek: 2, ...o.settings };
  return o;
}
function load() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY));
    if (o && Array.isArray(o.exercises) && Array.isArray(o.logs)) return migrate(o);
  } catch (e) { /* 첫 실행 */ }
  return seed();
}
let S = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(S));

/* ---------- 계산 ---------- */
const exOf = id => S.exercises.find(e => e.id === id);
const unitOf = e => e ? e.unit : '회';
const target = e => e.monthDays * e.reps * e.sets;            // 분모: 월 목표일 × 회 × 세트
const amount = l => l.reps * l.sets;                          // 분자: 기록 1건 = 회 × 세트

function weekRange(dateStr) {                                  // 일~토
  const d = parseD(dateStr); d.setDate(d.getDate() - d.getDay());
  const s = ymd(d); d.setDate(d.getDate() + 6);
  return [s, ymd(d)];
}
// ym: 'YYYY-MM' — 해당 월의 기록만 분자로 집계 (매월 1일 0부터 다시 시작)
function compute(ym = curYM()) {
  const monthLogs = S.logs.filter(l => l.date.startsWith(ym));
  const done = {};
  monthLogs.forEach(l => { done[l.exId] = (done[l.exId] || 0) + amount(l); });
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
  return {
    exs, parts, total: sum(exs), ym,
    days: new Set(monthLogs.map(l => l.date)).size, count: monthLogs.length,
    weekDays: new Set(S.logs.filter(l => l.date >= w0 && l.date <= w1).map(l => l.date)).size,
  };
}

/* ---------- 색상 ---------- */
function pctColor(p) {
  if (p == null || p <= 0) return '#e9edf3';
  if (p > 100) return GOLD;
  const t = Math.min(p, 100) / 100;
  return `hsl(215 ${Math.round(88 + 4 * t)}% ${Math.round(88 - 42 * t)}%)`;
}
const inkOn = p => (p > 100 ? '#3b2a00' : p >= 45 ? '#fff' : p > 0 ? '#1d3b6e' : '#6b7684');
const barColor = p => p > 100 ? GOLD : ACCENT;

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
    return { color: pctColor(p.pct), ink: inkOn(p.pct), pct: fmtPct(p.pct), pain: painOf(part), glow: p.pct > 100 };
  };
  const tp = C.total.pct ?? 0;
  $('#app').innerHTML = `
    ${bodyDefs()}
    <section class="card hero">
      <div class="herotop"><span class="cap">${monthOf(C.ym)}월 운동 진행도</span><span class="cap">매월 1일 초기화</span></div>
      <div class="bignum${tp > 100 ? ' gold' : ''}">${C.total.pct == null ? '–' : fmtPct(C.total.pct).replace('%', '')}<span>%</span></div>
      <div class="track"><span style="width:${Math.min(tp, 100)}%;background:${barColor(tp)}"></span></div>
      <div class="stats">
        <div><span class="cap">운동일</span><b>${C.days}<small>/${S.settings.monthDays}일</small></b></div>
        <div><span class="cap">이번 주</span><b>${C.weekDays}<small>/${S.settings.perWeek}일</small></b></div>
        <div><span class="cap">기록</span><b>${C.count}<small>건</small></b></div>
      </div>
    </section>

    <section class="card statusbox">
      <div class="sechead"><h2>부위별 현황</h2>
        <div class="seg">${[['front', '앞면'], ['back', '뒷면']].map(([v, n]) => `<button class="${v === bodyView ? 'on' : ''}" data-view="${v}">${n}</button>`).join('')}</div></div>
      <div class="statgrid">
        <div class="figcol">${bodySVG(bodyView, info, NAMES)}</div>
        <div class="statcol">
          ${PARTS.map(p => {
            const x = C.parts[p.id], pn = painOf(p.id);
            return `<button class="prow" data-part="${p.id}">
              <span class="pt"><span class="pn">${p.name}${pn ? `<i class="pd p${pn}"></i>` : ''}</span><span class="pv${x.pct > 100 ? ' gold' : ''}">${fmtPct(x.pct)}</span></span>
              <span class="pb"><span style="width:${Math.min(x.pct ?? 0, 100)}%;background:${barColor(x.pct ?? 0)}"></span></span></button>`;
          }).join('')}
        </div>
      </div>
      <div class="legend"><span class="lgbar"><i></i></span><span>0%</span><span class="sp"></span><span>100%</span>
        <span class="sw gold"></span><span>초과달성</span><span class="pd p1"></span><span>살짝 아픔</span><span class="pd p2"></span><span>많이 아픔</span></div>
    </section>

    <section class="card" id="calCard">${calendarHTML()}</section>

    <details class="card hist" id="hist" ${$('#hist')?.open ? 'open' : ''}>
      <summary><span>일일 기록</span><small>${new Set(S.logs.map(l => l.date)).size}일 · ${S.logs.length}건</small>${ic('down')}</summary>
      <div class="histbody">${historyHTML()}</div>
    </details>
    <footer>데이터는 이 기기의 브라우저에 저장됩니다</footer>`;
}

/* ---------- 달력 ---------- */
function calendarHTML() {
  const { y, m } = cal;
  const ym = `${y}-${pad(m + 1)}`;
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const byDate = {};
  S.logs.forEach(l => { (byDate[l.date] ||= []).push(l); });
  let cells = '';
  for (let i = 0; i < first.getDay(); i++) cells += '<span class="day empty"></span>';
  for (let d = 1; d <= last.getDate(); d++) {
    const ds = `${ym}-${pad(d)}`;
    const has = !!byDate[ds];
    cells += `<button class="day${has ? ' has' : ''}${ds === todayS() ? ' today' : ''}${ds === selDate ? ' sel' : ''}" data-date="${ds}">
      <b>${d}</b>${has ? `<span class="ck">${ic('check')}</span>` : ''}</button>`;
  }
  const M = compute(ym);
  const goal = S.settings.monthDays;
  const hit = M.days >= goal;
  const dayLogs = byDate[selDate] || [];
  return `
    <div class="calhead"><button class="ibtn" data-cal="-1" aria-label="이전 달">${ic('left')}</button>
      <div class="caltitle"><h2>${y}년 ${m + 1}월</h2>
        <span class="mchip${hit ? ' hit' : ''}" title="이번 달 목표 달성일 / 달성률"><b>${M.days}/${goal}일</b><i></i><b>${fmtPct(M.total.pct)}</b></span></div>
      <button class="ibtn" data-cal="1" aria-label="다음 달">${ic('right')}</button></div>
    <div class="calgrid">${DOW.map((d, i) => `<span class="dow${i === 0 ? ' sun' : ''}">${d}</span>`).join('')}${cells}</div>
    <div class="daystrip">
      <div class="dshead"><b>${shortDate(selDate)}</b><button class="btn tint sm" data-addon="${selDate}">${ic('plus')}기록 추가</button></div>
      ${dayLogs.length ? dayLogs.map(logLine).join('') : '<p class="empty">기록이 없어요</p>'}
    </div>`;
}
function logLine(l) {
  const e = exOf(l.exId), u = unitOf(e), p = PAIN[l.pain || 0];
  const main = u === '분' ? `${l.reps}분` : `${l.weight ? l.weight + 'kg · ' : ''}${l.reps}회 × ${l.sets}세트`;
  return `<div class="logline"><span class="tag">${NAMES[e?.part] || '?'}</span>
    <span class="ln"><b>${esc(e?.name || '(삭제된 종목)')}</b><em>${main}${l.memo ? ` · ${esc(l.memo)}` : ''}</em></span>
    <i class="pd p${l.pain || 0}" title="${p.t}"></i><button class="link" data-edit="${l.id}">수정</button></div>`;
}

/* ---------- 일일 기록 (접이식) ---------- */
function historyHTML() {
  const dates = [...new Set(S.logs.map(l => l.date))].sort().reverse();
  if (!dates.length) return '<p class="empty">아직 기록이 없어요</p>';
  return dates.map(ds => {
    const ls = S.logs.filter(l => l.date === ds);
    return `<details class="hday" data-d="${ds}" ${openHist.has(ds) ? 'open' : ''}>
      <summary><b>${ds.slice(0, 4)}.${ds.slice(5, 7)}.${ds.slice(8)} <em>${DOW[parseD(ds).getDay()]}</em></b>
        <small>${[...new Set(ls.map(l => NAMES[exOf(l.exId)?.part] || '?'))].join(' · ')}</small>${ic('down')}</summary>
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
  const ym = (rec.date || todayS()).slice(0, 7);
  const C = compute(ym);
  const P = C.parts[rec.part];
  const list = S.exercises.filter(e => e.part === rec.part);
  const e = exOf(rec.exId), u = unitOf(e);
  dlg.innerHTML = `<form method="dialog" class="sheet" id="recForm">
    <div class="grab"></div>
    <div class="sheethead"><h2>${rec.editId ? '기록 수정' : '운동 기록'}</h2><button type="button" class="ibtn" data-close aria-label="닫기">${ic('close')}</button></div>
    <div class="chips">${PARTS.map(p => `<button type="button" class="chip${p.id === rec.part ? ' on' : ''}" data-rp="${p.id}">${p.name}</button>`).join('')}</div>

    <div class="partsum">
      <div class="pshead"><span class="cap">${monthOf(ym)}월 ${NAMES[rec.part]} 달성률</span><b class="big">${fmtPct(P.pct)}</b></div>
      ${P.list.map(x => `<div class="exrow"><span class="en">${esc(x.e.name)}</span><span class="ev">${fmtPct(x.pct)}</span>
        <span class="pb"><span style="width:${Math.min(x.pct ?? 0, 100)}%;background:${barColor(x.pct ?? 0)}"></span></span>
        <small>${fmtN(x.d)} / ${fmtN(x.t)}${x.e.unit} · 이번 주 ${x.weekDays}/${x.e.perWeek}일</small></div>`).join('') || '<p class="empty">이 부위에 등록된 종목이 없어요.<br>옵션에서 종목을 추가해주세요.</p>'}
    </div>

    ${list.length ? `
    <label>운동 종목<select name="exId">${list.map(x => `<option value="${x.id}" ${x.id === rec.exId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    <label>운동 날짜<input type="date" name="date" value="${rec.date}" required></label>
    <div class="grid3">
      ${u === '분' ? '' : `<label>무게(kg)<input type="number" name="weight" inputmode="decimal" step="0.5" min="0" value="${rec.weight}" placeholder="맨몸 0"></label>`}
      <label>${u === '분' ? '시간(분)' : '세트당 횟수'}<input type="number" name="reps" inputmode="decimal" min="0.1" step="any" value="${rec.reps}" required></label>
      ${u === '분' ? '' : `<label>세트 수<input type="number" name="sets" inputmode="numeric" min="1" step="1" value="${rec.sets}" required></label>`}
    </div>
    <div class="lbl">운동 후 느낌</div>
    <div class="pains">${PAIN.map(p => `<label class="pain"><input type="radio" name="pain" value="${p.v}" ${p.v === rec.pain ? 'checked' : ''}><span style="--c:${p.c}"><i></i>${p.t}</span></label>`).join('')}</div>
    <label>메모<input type="text" name="memo" value="${esc(rec.memo)}" placeholder="${u === '분' ? '예: 2.75km' : '선택 입력'}"></label>
    <div class="btns">${rec.editId ? '<button type="button" class="btn danger" data-del>삭제</button>' : ''}<button type="submit" class="btn solid lg">${rec.editId ? '저장' : '기록하기'}</button></div>` : ''}
  </form>`;
}
dlg.addEventListener('change', ev => {
  if (!rec) return;
  const f = $('#recForm'); if (!f || !f.contains(ev.target)) return;
  const n = ev.target.name;
  if (n === 'exId') { syncRec(); rec.exId = ev.target.value; recPickDefaults(!rec.editId); drawRecord(); }
  if (n === 'date') { syncRec(); drawRecord(); }
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
    if (confirm('이 기록을 삭제할까요?')) { S.logs = S.logs.filter(l => l.id !== rec.editId); save(); closeDlg(); }
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
function openOptions() { rec = null; drawOptions(); dlg.showModal(); }
function exSummary(x) { return `분모 ${fmtN(x.t)}${x.e.unit} · 이번 달 ${fmtN(x.d)}${x.e.unit} (${fmtPct(x.pct)})`; }
function drawOptions() {
  const C = compute();
  const scroll = $('.sheet')?.scrollTop || 0;
  dlg.innerHTML = `<div class="sheet" id="optSheet">
    <div class="grab"></div>
    <div class="sheethead"><h2>옵션</h2><button type="button" class="ibtn" data-close aria-label="닫기">${ic('close')}</button></div>

    <h3>월간 목표</h3>
    <p class="hint">종목별 분모는 <b>월 목표일수 × 회 × 세트</b>이고, 이번 달 기록이 분자로 쌓여요. 매월 1일에 0부터 다시 시작하며 지난 달 기록은 달력에서 볼 수 있어요.<br>예) 월 8일 × 10회 × 3세트 = 240 → 하루 30회 = 12.5%</p>
    <div class="grid2">
      <label>월 목표 운동일수<input type="number" min="1" max="31" data-set="monthDays" value="${S.settings.monthDays}"></label>
      <label>주당 목표 일수<input type="number" min="1" max="7" data-set="perWeek" value="${S.settings.perWeek}"></label>
    </div>
    <p class="hint">달력과 홈의 '목표 달성일' 기준이고, 새 종목의 기본값으로도 쓰여요.</p>
    <button type="button" class="btn tint" data-applyall>모든 종목에 이 목표 적용</button>

    <h3>부위별 운동 종목</h3>
    ${PARTS.map(p => {
      const list = C.parts[p.id].list;
      return `<div class="optpart"><div class="ophead"><b>${p.name}</b><span>${fmtPct(C.parts[p.id].pct)}</span></div>
        ${list.map(x => `<div class="optex" data-ex="${x.e.id}">
          <div class="oname"><input class="nm" data-f="name" value="${esc(x.e.name)}"><button type="button" class="ibtn sm" data-delex="${x.e.id}" aria-label="삭제">${ic('trash')}</button></div>
          <div class="ogrid">
            <label>월 목표일<input type="number" min="1" data-f="monthDays" value="${x.e.monthDays}"></label>
            <label>주당(일)<input type="number" min="1" max="7" data-f="perWeek" value="${x.e.perWeek}"></label>
            <label>${x.e.unit === '분' ? '분' : '회/세트'}<input type="number" min="1" data-f="reps" value="${x.e.reps}"></label>
            ${x.e.unit === '분' ? '<span></span>' : `<label>세트<input type="number" min="1" data-f="sets" value="${x.e.sets}"></label>`}
          </div>
          <small>${exSummary(x)}</small></div>`).join('') || '<p class="empty sm">등록된 종목 없음</p>'}
        <div class="addex" data-addpart="${p.id}"><input placeholder="종목 이름" data-newname><select data-newunit><option>회</option><option>분</option></select>
          <button type="button" class="btn tint sm" data-addex>추가</button></div></div>`;
    }).join('')}

    <h3>데이터</h3>
    <div class="btns wrap"><button type="button" class="btn tint sm" data-export>${ic('down2')}내보내기</button>
      <label class="btn tint sm filebtn">${ic('up2')}가져오기<input type="file" accept="application/json" data-import hidden></label>
      <button type="button" class="btn danger sm" data-reset>전체 초기화</button></div>
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
dlg.addEventListener('change', ev => {                          // 값 확정 시 해당 종목 요약만 갱신 (포커스 유지)
  if (!$('#optSheet')) return;
  if (ev.target.dataset.f && ev.target.dataset.f !== 'name') {
    const row = ev.target.closest('[data-ex]'), x = compute().exs.find(v => v.e.id === row.dataset.ex);
    $('small', row).textContent = exSummary(x);
  }
  if (ev.target.matches('[data-import]')) {
    const f = ev.target.files[0]; if (!f) return;
    f.text().then(txt => {
      try {
        const o = JSON.parse(txt);
        if (!Array.isArray(o.exercises) || !Array.isArray(o.logs)) throw 0;
        if (!confirm('현재 데이터를 가져온 파일로 덮어쓸까요?')) return;
        S = migrate(o); save(); drawOptions();
      } catch (e) { alert('올바른 백업 파일이 아니에요.'); }
    });
  }
});
dlg.addEventListener('click', ev => {
  if (!$('#optSheet')) return;
  const t = ev.target.closest('button'); if (!t) return;
  if (t.dataset.applyall !== undefined) {
    if (confirm('모든 종목의 월 목표일수/주당 일수를 위 값으로 바꿀까요?')) {
      S.exercises.forEach(e => { e.monthDays = S.settings.monthDays; e.perWeek = S.settings.perWeek; }); save(); drawOptions();
    }
  }
  if (t.dataset.delex) {
    const e = exOf(t.dataset.delex), n = S.logs.filter(l => l.exId === e.id).length;
    if (confirm(`'${e.name}' 종목을 삭제할까요?${n ? `\n이 종목의 기록 ${n}건도 함께 삭제돼요.` : ''}`)) {
      S.exercises = S.exercises.filter(x => x.id !== e.id); S.logs = S.logs.filter(l => l.exId !== e.id); save(); drawOptions();
    }
  }
  if (t.dataset.addex !== undefined) {
    const box = t.closest('[data-addpart]'), name = $('[data-newname]', box).value.trim();
    if (!name) return;
    const unit = $('[data-newunit]', box).value;
    S.exercises.push({ id: uid(), part: box.dataset.addpart, name, unit, monthDays: S.settings.monthDays, perWeek: S.settings.perWeek, reps: unit === '분' ? 20 : 10, sets: unit === '분' ? 1 : 3 });
    save(); drawOptions();
  }
  if (t.dataset.export !== undefined) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
    a.download = `myfitness-${todayS()}.json`; a.click(); URL.revokeObjectURL(a.href);
  }
  if (t.dataset.reset !== undefined && confirm('모든 기록과 종목을 초기화할까요? (되돌릴 수 없어요)')) {
    S = seed(); save(); drawOptions();
  }
});

/* ---------- 메인 이벤트 ---------- */
document.addEventListener('click', ev => {
  const t = ev.target;
  if (t.closest('#btnAdd')) return openRecord();
  if (t.closest('#btnOpt')) return openOptions();
  const reg = t.closest('[data-part]');
  if (reg && !dlg.contains(reg)) return openRecord({ part: reg.dataset.part });
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
