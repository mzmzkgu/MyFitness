"""MyFitness 아이콘 생성기: favicon.svg/.ico, apple-touch-icon, icon-192/512, icon-maskable-512 를 저장소 루트에 만든다.
사용: python3 tools/make_icons.py   (playwright + pillow 필요)
- simple  : 탭용. 운동화만 크게 (작은 크기에서 글씨는 안 읽힘)
- full    : 홈 화면/앱 아이콘. 운동화 + Fitness
- maskable: 안드로이드 어댑티브 아이콘용. 가운데 약 2/3만 보이므로 콘텐츠를 60% 안쪽으로 축소
"""
import math
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BG1, BG2 = '#7fcaff', '#3d9fff'                      # 하늘색 그라데이션
MASK_SCALE = 0.66                                    # 마스커블: 콘텐츠 축소 비율 (안전영역 안쪽)


def sneaker(simple=False):
    p0, p1 = (244, 194), (326, 258)
    ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0]) + math.pi / 2
    laces = ''
    for t in (0.12, 0.38, 0.64):
        x = p0[0] + (p1[0] - p0[0]) * t; y = p0[1] + (p1[1] - p0[1]) * t
        dx, dy = math.cos(ang) * 11, math.sin(ang) * 11
        laces += f'<path d="M{x - dx:.1f},{y - dy:.1f} L{x + dx:.1f},{y + dy:.1f}"/>'
    detail = '' if simple else laces + '<path d="M346,238 C360,262 362,290 358,310"/><path d="M106,192 C132,184 162,188 184,200" stroke-width="6"/>'
    return f'''<g>
    <path fill="#fff" d="M100,312 L100,188 C100,174 110,166 124,166 C150,166 172,172 190,186 C196,177 204,162 214,152 C222,142 240,140 248,152 L276,198 C292,224 330,238 366,250 C398,260 418,280 420,312 Z"/>
    <path fill="#fff" d="M92,342 C92,326 100,319 112,319 L396,319 C416,319 428,332 424,346 C422,357 412,363 400,363 L114,363 C100,363 92,355 92,342 Z"/>
    <g stroke="#52a9ff" stroke-width="{14 if simple else 9}" stroke-linecap="round" fill="none">{detail}<path d="M128,298 C180,300 222,266 262,232"/></g>
  </g>'''


def text(size, y):
    return (f'<text x="256" y="{y}" text-anchor="middle" font-family="Inter,Helvetica Neue,Arial,DejaVu Sans,sans-serif" '
            f'font-weight="800" font-size="{size}" letter-spacing="1" fill="#fff">Fitness</text>')


def svg(kind, rounded):
    if kind == 'simple':
        body = f'<g transform="translate(256,256) scale(1.22) translate(-260,-250)">{sneaker(True)}</g>'
    elif kind == 'full':
        body = f'<g transform="translate(-4,-14)">{sneaker()}</g>{text(100, 452)}'
    else:  # maskable
        body = (f'<g transform="translate(256,256) scale({MASK_SCALE}) translate(-256,-256)">'
                f'<g transform="translate(-4,-14)">{sneaker()}</g>{text(86, 444)}</g>')
    rx = 112 if rounded else 0
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">'
            f'<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{BG1}"/><stop offset="1" stop-color="{BG2}"/></linearGradient></defs>'
            f'<rect width="512" height="512" rx="{rx}" fill="url(#bg)"/>{body}</svg>')


JOBS = [  # (종류, 둥근모서리, 크기, 출력 파일)
    ('full', False, 180, 'apple-touch-icon.png'),     # iOS는 자체적으로 모서리를 깎으므로 꽉 찬 사각형
    ('full', True, 192, 'icon-192.png'),
    ('full', True, 512, 'icon-512.png'),
    ('maskable', False, 512, 'icon-maskable-512.png'),  # 꽉 찬 사각형 + 안전영역
    ('simple', True, 256, '_favicon256.png'),
]

if __name__ == '__main__':
    (ROOT / 'favicon.svg').write_text(svg('simple', True))
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        for kind, rounded, size, out in JOBS:
            s = svg(kind, rounded).replace('viewBox="0 0 512 512" width="512" height="512"', f'viewBox="0 0 512 512" width="{size}" height="{size}"', 1)
            pg.set_viewport_size({'width': size, 'height': size})
            pg.set_content('<body style="margin:0;background:transparent">' + s + '</body>')
            pg.screenshot(path=str(ROOT / out), omit_background=True)
        b.close()
    tmp = ROOT / '_favicon256.png'
    Image.open(tmp).convert('RGBA').save(ROOT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    tmp.unlink()
    print('done')
