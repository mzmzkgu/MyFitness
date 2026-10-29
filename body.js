'use strict';
// 인체 일러스트(SVG). 오른쪽 절반만 정의하고 mirror()로 왼쪽을 만든다. (viewBox 0 0 200 440, 중심 x=100)

function mirror(d) {
  return d.replace(/([MLCQZ])([^MLCQZ]*)/g, (m, c, args) => {
    if (c === 'Z') return 'Z';
    const n = args.match(/-?\d*\.?\d+/g).map(Number);
    return c + n.map((v, i) => (i % 2 === 0 ? +(200 - v).toFixed(2) : v)).join(' ');
  });
}
const both = d => d + ' ' + mirror(d);

// 실루엣 (오른쪽 절반)
const OUTLINE = `M100,48 L108,48 C109,55 109,59 111,63
C124,66 137,70 146,76 C156,80 163,90 163,103 C163,116 162,132 161,148
C161,162 165,180 167,198 C170,204 171,220 169,230 C167,238 160,240 158,232
C157,222 154,212 152,200 C149,182 146,166 145,150 C144,136 143,122 142,108
C140,122 135,148 130,170 C128,184 134,198 137,212 C140,232 138,258 134,282
C132,296 130,306 127,314 C132,334 133,350 127,372 C124,388 122,402 123,416
C130,421 135,430 133,437 L108,437 C106,432 106,425 107,416
C108,402 108,386 108,366 C108,346 107,326 105,308 C104,286 103,262 102,242 L100,234 Z`;

// 부위별 근육 영역 (오른쪽 절반). lab: 라벨 위치, mid: 정중앙 라벨 여부
const REGIONS = {
  front: [
    { part: 'shoulder', lab: [150, 92],
      d: `M114,65 C126,68 138,72 146,77 C156,81 162,90 162,103 C162,112 161,118 160,122
          C153,121 147,116 144,108 C141,98 132,88 120,81 C116,76 114,70 114,65 Z` },
    { part: 'chest', lab: [120, 106],
      d: `M101,83 C108,79 118,79 127,84 C136,90 141,99 141,108 C139,117 131,124 120,126
          C111,128 104,125 101,121 Z` },
    { part: 'abs', lab: [111, 158],
      d: `M101,131 C108,130 116,130 122,131 C124,148 124,166 122,184 C116,188 108,188 101,188 Z
          M125,133 C130,142 131,156 129,170 C128,178 130,186 133,196 C128,194 125,192 124,189 C126,170 126,150 125,133 Z` },
    { part: 'arm', lab: [152, 142],
      d: `M143,111 C148,121 154,125 160,126 L159,150 C153,153 148,151 145,147 C144,134 143,122 143,111 Z
          M159,157 C163,170 166,186 166,200 C160,203 155,201 153,197 C150,182 147,169 145,155 C150,158 155,159 159,157 Z` },
    { part: 'leg', lab: [118, 244],
      d: `M101,200 C111,198 126,200 135,210 C139,234 137,258 133,280 C131,290 129,297 126,302
          C118,305 111,304 106,301 C104,282 103,260 102,240 L101,232 Z` },
    { part: 'calf', lab: [117, 346],
      d: `M107,318 C114,314 122,314 127,318 C131,336 131,352 127,372 C124,386 122,398 123,412
          L110,412 C109,398 108,382 108,364 C108,348 106,332 107,318 Z` },
  ],
  back: [
    { part: 'shoulder', lab: [152, 94],
      d: `M114,65 C126,68 138,72 146,77 C156,81 162,90 162,103 C162,112 161,118 160,122
          C153,121 147,116 144,108 C141,98 132,88 120,81 C116,76 114,70 114,65 Z` },
    { part: 'back', lab: [118, 112],
      d: `M101,56 C106,58 109,61 111,64 C122,67 134,72 144,78 C138,89 128,97 117,103 C110,107 104,112 101,124 Z
          M141,108 C140,127 136,146 130,168 C120,166 109,160 101,156 L101,128 C112,126 130,120 141,108 Z` },
    { part: 'lowback', lab: [110, 182],
      d: `M101,160 C110,163 120,168 129,171 C130,182 133,192 136,202 C124,202 111,200 101,198 Z` },
    { part: 'arm', lab: [152, 142],
      d: `M143,111 C148,121 154,125 160,126 L159,150 C153,153 148,151 145,147 C144,134 143,122 143,111 Z
          M159,157 C163,170 166,186 166,200 C160,203 155,201 153,197 C150,182 147,169 145,155 C150,158 155,159 159,157 Z` },
    { part: 'leg', lab: [118, 236],
      d: `M101,204 C112,203 127,205 136,213 C138,226 134,238 124,244 C114,246 106,242 101,238 Z
          M102,248 C112,250 124,248 132,246 C134,262 133,280 130,292 C128,298 126,302 124,304
          C116,306 110,304 106,301 C104,284 103,266 102,248 Z` },
    { part: 'calf', lab: [117, 340],
      d: `M107,317 C114,311 123,312 127,318 C132,336 131,352 125,370 C121,376 114,376 110,368
          C106,352 105,332 107,317 Z` },
  ],
};

// 장식선 (근육 결/구분선)
const DECOR = {
  front: [
    'M101,140 C108,141 116,141 122,140', 'M101,152 C108,153 116,153 122,152', 'M101,164 C108,165 116,165 122,164',
    'M101,176 C108,177 116,177 122,176',
    'M104,119 C112,122 124,121 132,114',          // 대흉근 하단
    'M122,84 C126,92 126,100 124,108',            // 가슴-어깨 경계 결
    'M112,222 C112,250 110,276 108,298',          // 대퇴사두 분리
    'M124,215 C128,240 126,266 124,290',
  ],
  back: [
    'M101,70 L101,150', 'M101,160 L101,198',
    'M108,140 C116,146 124,152 130,160',
    'M112,222 C112,240 112,252 112,262',
    'M101,246 C112,248 124,246 133,244',
    'M118,330 C119,346 119,358 117,368',          // 비복근 분리
  ],
};

const SKIN = '#1b2431';

function bodyDefs() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".30"/><stop offset=".5" stop-color="#fff" stop-opacity=".02"/>
      <stop offset="1" stop-color="#000" stop-opacity=".30"/></linearGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#26334a"/><stop offset=".5" stop-color="#1a2332"/><stop offset="1" stop-color="#26334a"/></linearGradient>
    <radialGradient id="aura" cx=".5" cy=".42" r=".6">
      <stop offset="0" stop-color="#3ddc97" stop-opacity=".16"/><stop offset="1" stop-color="#3ddc97" stop-opacity="0"/></radialGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs></svg>`;
}

// view: 'front' | 'back'
// info(part) => { color, pct(text), pain(0~2), glow(bool) }  /  names: {part: 이름}
function bodySVG(view, info, names) {
  const regs = REGIONS[view].map(r => {
    const i = info(r.part);
    const d = both(r.d);
    const lx = r.lab[0], ly = r.lab[1];
    const labX = ['abs', 'chest', 'back', 'lowback'].includes(r.part) ? 100 : lx;
    const pain = i.pain ? `<circle class="pain p${i.pain}" cx="${lx + (r.part === 'abs' ? 10 : 8)}" cy="${ly - 14}" r="3.6"/>` : '';
    return `<g class="region${i.glow ? ' over' : ''}" data-part="${r.part}" tabindex="0" role="button" aria-label="${names[r.part]}">
      <path d="${d}" fill="${i.color}" stroke="#0b0f14" stroke-width="1.2" stroke-linejoin="round" ${i.glow ? 'filter="url(#glow)"' : ''}/>
      <path d="${d}" fill="url(#shine)" pointer-events="none"/>
      <text x="${labX}" y="${ly - 2}" class="rn">${names[r.part]}</text>
      <text x="${labX}" y="${ly + 8}" class="rp">${i.pct}</text>${pain}
    </g>`;
  }).join('');
  const deco = DECOR[view].map(d => `<path d="${both(d)}" class="deco"/>`).join('');
  return `<svg viewBox="0 0 200 440" class="body" role="img" aria-label="${view === 'front' ? '앞면' : '뒷면'}">
    <ellipse cx="100" cy="215" rx="100" ry="225" fill="url(#aura)" pointer-events="none"/>
    <path d="${both(OUTLINE)}" fill="url(#skin)" stroke="#2c3b52" stroke-width="1.4" stroke-linejoin="round"/>
    <ellipse cx="100" cy="29" rx="17" ry="22" fill="url(#skin)" stroke="#2c3b52" stroke-width="1.4"/>
    ${view === 'back' ? '<path d="M84,22 C88,8 112,8 116,22 C112,14 88,14 84,22 Z" fill="#2c3b52"/>' : ''}
    ${deco}${regs}
  </svg>`;
}
