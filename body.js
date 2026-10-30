'use strict';
// 귀여운 2.5등신 캐릭터(SVG). 오른쪽 절반만 정의하고 mirror()로 왼쪽을 만든다. (viewBox 0 0 200 330, 중심 x=100)

function mirror(d) {
  return d.replace(/([MLCQZ])([^MLCQZ]*)/g, (m, c, args) => {
    if (c === 'Z') return 'Z';
    const n = args.match(/-?\d*\.?\d+/g).map(Number);
    return c + n.map((v, i) => (i % 2 === 0 ? +(200 - v).toFixed(2) : v)).join(' ');
  });
}
const both = d => d + ' ' + mirror(d);

// 몸통 실루엣 (오른쪽 절반): 통통한 몸 + 짧은 팔다리
const OUTLINE = `M100,68 L111,68 C120,71 130,75 138,80 C149,83 157,92 157,104
C158,118 159,132 159,144 C160,156 163,168 162,180 C162,194 150,198 146,190
C143,184 143,172 143,160 C143,148 142,138 141,128 C140,120 140,112 137,106
C137,122 133,140 131,156 C131,166 137,172 138,184 C139,200 139,216 137,232
C136,244 135,252 133,262 C134,272 132,282 130,290 C134,296 139,302 135,311
L106,311 C103,304 104,296 106,290 C106,272 106,256 105,242
C104,226 103,210 102,198 L100,194 Z`;

// 부위별 영역 (오른쪽 절반). lab: 라벨 위치
const REGIONS = {
  front: [
    { part: 'shoulder', lab: [147, 98],
      d: `M114,74 C124,76 133,79 139,83 C149,86 155,94 155,104 C155,111 155,115 154,119
          C148,119 142,114 140,106 C138,97 130,90 121,86 C117,82 115,78 114,74 Z` },
    { part: 'chest', lab: [118, 108],
      d: `M101,92 C108,88 118,88 126,92 C134,96 138,104 137,112 C135,120 127,124 118,124
          C110,124 103,122 101,118 Z` },
    { part: 'abs', lab: [114, 150],
      d: `M101,131 C110,129 120,129 127,131 C129,146 128,160 125,172 C118,177 108,177 101,177 Z` },
    { part: 'arm', lab: [150, 138],
      d: `M143,110 C147,117 151,121 155,122 L158,142 C153,147 147,145 143,141 C142,130 143,120 143,110 Z
          M143,150 C148,152 154,152 158,150 C160,158 161,166 161,172 C155,175 148,175 144,172 C143,165 143,157 143,150 Z` },
    { part: 'leg', lab: [118, 212],
      d: `M101,182 C112,180 128,182 137,190 C140,208 139,224 136,238 C128,244 114,244 105,240
          C104,224 102,204 101,182 Z` },
    { part: 'calf', lab: [119, 268],
      d: `M106,250 C114,248 126,248 133,252 C135,264 133,274 130,283 C124,287 112,287 107,283
          C106,272 106,260 106,250 Z` },
  ],
  back: [
    { part: 'shoulder', lab: [147, 98],
      d: `M114,74 C124,76 133,79 139,83 C149,86 155,94 155,104 C155,111 155,115 154,119
          C148,119 142,114 140,106 C138,97 130,90 121,86 C117,82 115,78 114,74 Z` },
    { part: 'back', lab: [118, 108],
      d: `M101,76 C106,76 110,77 113,79 C124,82 134,86 140,92 C139,106 137,122 133,138 C124,142 112,142 101,142 Z` },
    { part: 'lowback', lab: [116, 159],
      d: `M101,147 C112,147 124,146 131,144 C131,154 132,164 135,174 C124,176 112,176 101,176 Z` },
    { part: 'arm', lab: [150, 138],
      d: `M143,110 C147,117 151,121 155,122 L158,142 C153,147 147,145 143,141 C142,130 143,120 143,110 Z
          M143,150 C148,152 154,152 158,150 C160,158 161,166 161,172 C155,175 148,175 144,172 C143,165 143,157 143,150 Z` },
    { part: 'leg', lab: [118, 216],
      d: `M101,182 C112,180 128,182 137,190 C139,200 136,210 128,214 C116,216 106,212 101,208 Z
          M102,220 C112,222 124,222 135,220 C137,228 137,234 136,238 C128,244 114,244 105,240 C104,234 103,226 102,220 Z` },
    { part: 'calf', lab: [119, 268],
      d: `M106,250 C114,248 126,248 133,252 C135,264 133,274 130,283 C124,287 112,287 107,283
          C106,272 106,260 106,250 Z` },
  ],
};

// 부드러운 장식선
const DECOR = {
  front: ['M101,142 C108,143 118,143 126,142', 'M101,156 C108,157 118,157 126,156', 'M104,121 C112,125 124,124 132,116'],
  back: ['M101,86 L101,142', 'M101,148 L101,176', 'M101,214 L101,226'],
};

function bodyDefs() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffdcb8"/><stop offset="1" stop-color="#f0b98d"/></linearGradient>
    <linearGradient id="suit" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#34425c"/><stop offset=".5" stop-color="#2a3650"/><stop offset="1" stop-color="#34425c"/></linearGradient>
    <linearGradient id="shoe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9d3e3"/></linearGradient>
    <radialGradient id="aura" cx=".5" cy=".45" r=".55">
      <stop offset="0" stop-color="#3ddc97" stop-opacity=".18"/><stop offset="1" stop-color="#3ddc97" stop-opacity="0"/></radialGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs></svg>`;
}

const SHOE = 'M106,289 C109,283 127,283 130,289 C135,295 140,302 135,311 L106,311 C103,304 104,296 106,289 Z';
const HAIR = '#4a3426';

function headSVG(view) {
  const ears = `<circle cx="66" cy="43" r="6" fill="url(#skin)" stroke="#c98f66" stroke-width="1"/><circle cx="134" cy="43" r="6" fill="url(#skin)" stroke="#c98f66" stroke-width="1"/>`;
  const neck = `<rect x="92" y="62" width="16" height="14" rx="5" fill="url(#skin)"/>`;
  const head = `<ellipse cx="100" cy="40" rx="34" ry="31" fill="url(#skin)" stroke="#c98f66" stroke-width="1.2"/>`;
  if (view === 'back') {
    return `${neck}${ears}${head}
      <path d="M66,40 C64,6 136,6 134,40 C135,56 122,69 100,69 C78,69 65,56 66,40 Z" fill="${HAIR}"/>
      <path d="M80,22 C90,14 108,14 118,22" fill="none" stroke="#6b4c39" stroke-width="3" stroke-linecap="round"/>`;
  }
  return `${neck}${ears}${head}
    <path d="M66,38 C63,8 137,8 134,38 C128,28 118,22 108,20 C98,26 82,26 72,32 C70,34 68,36 66,38 Z" fill="${HAIR}"/>
    <path d="M78,17 C88,11 106,11 118,17" fill="none" stroke="#6b4c39" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="86" cy="45" rx="3.6" ry="4.6" fill="#2a2118"/><ellipse cx="114" cy="45" rx="3.6" ry="4.6" fill="#2a2118"/>
    <circle cx="87.4" cy="43.2" r="1.3" fill="#fff"/><circle cx="115.4" cy="43.2" r="1.3" fill="#fff"/>
    <circle cx="76" cy="55" r="5.2" fill="#ff8fa0" opacity=".5"/><circle cx="124" cy="55" r="5.2" fill="#ff8fa0" opacity=".5"/>
    <path d="M93,55 Q100,63 107,55" fill="#fff" stroke="#8a3d33" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// view: 'front' | 'back'
// info(part) => { color, pct(text), pain(0~2), glow(bool) }  /  names: {part: 이름}
function bodySVG(view, info, names) {
  const regs = REGIONS[view].map(r => {
    const i = info(r.part);
    const d = both(r.d);
    const lx = r.lab[0], ly = r.lab[1];
    const labX = ['abs', 'chest', 'back', 'lowback'].includes(r.part) ? 100 : lx;
    const pain = i.pain ? `<circle class="pain p${i.pain}" cx="${lx + 9}" cy="${ly - 12}" r="3.8"/>` : '';
    return `<g class="region${i.glow ? ' over' : ''}" data-part="${r.part}" tabindex="0" role="button" aria-label="${names[r.part]}">
      <path d="${d}" fill="${i.color}" stroke="#0b0f14" stroke-opacity=".7" stroke-width="1.1" stroke-linejoin="round" ${i.glow ? 'filter="url(#glow)"' : ''}/>
      <path d="${d}" fill="url(#shine)" pointer-events="none"/>
      <text x="${labX}" y="${ly - 2}" class="rn">${names[r.part]}</text>
      <text x="${labX}" y="${ly + 8}" class="rp">${i.pct}</text>${pain}
    </g>`;
  }).join('');
  const deco = DECOR[view].map(d => `<path d="${both(d)}" class="deco"/>`).join('');
  const hands = `<circle cx="152" cy="186" r="9.5" fill="url(#skin)" stroke="#c98f66" stroke-width="1" pointer-events="none"/><circle cx="48" cy="186" r="9.5" fill="url(#skin)" stroke="#c98f66" stroke-width="1" pointer-events="none"/>`;
  return `<svg viewBox="0 0 200 330" class="body" role="img" aria-label="${view === 'front' ? '앞면' : '뒷면'}">
    <ellipse cx="100" cy="170" rx="100" ry="172" fill="url(#aura)" pointer-events="none"/>
    <path d="${both(OUTLINE)}" fill="url(#suit)" stroke="#4a5b7a" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="${both(SHOE)}" fill="url(#shoe)" stroke="#8d9bb3" stroke-width="1.2" stroke-linejoin="round" pointer-events="none"/>
    ${deco}${regs}${hands}${headSVG(view)}
  </svg>`;
}
