import { STAGES, stageOf, TOTAL_SESSIONS } from './logic.js?v=3';

/* 화면 전환 중 두 실루엣이 300ms 겹친다. 그라디언트 id가 중복되면
   들어오는 쪽이 나가는 쪽의 정의를 참조하므로 호출마다 고유 id를 만든다. */
let uidSeq = 0;

const TONE = ['#9A9086', '#B4441F', '#BB5220', '#C56420',
              '#D07A22', '#DC9128', '#E8AB33', '#F2C64C'];

const P = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;

/* 흉상 — 팔다리를 그리지 않는다. 어깨는 넓고 낮게, 승모근은 곡선으로.
   직선 사다리꼴로 하면 볼링핀처럼 보인다. */
function bust(L) {
  const cx = 60, hy = 60, hr = 15.5 + L * 0.35;
  const shW = 30 + L * 3.6, shTop = hy + hr + 9;
  const sh = `M${P(cx - shW, 140)} L${P(cx - shW, shTop + 9)}
              C${P(cx - shW + 2, shTop - 4)} ${P(cx - 13, shTop - 7)} ${P(cx - 8.5, hy + hr - 2)}
              L${P(cx + 8.5, hy + hr - 2)}
              C${P(cx + 13, shTop - 7)} ${P(cx + shW - 2, shTop - 4)} ${P(cx + shW, shTop + 9)}
              L${P(cx + shW, 140)} Z`;
  return { cx, hy, hr, sh };
}

/* 머리카락 — 하나의 닫힌 덩어리. 낱개 선으로 그리면 성게가 된다.
   왼쪽이 짧고 오른쪽으로 갈수록 길어지며 전체가 뒤로 쓸린다.
   좌우대칭이면 왕관이나 태양처럼 보인다. */
function hair(L, b) {
  const { cx, hy, hr } = b;
  if (L === 0) {
    return `M${P(cx - hr - 0.5, hy + 1)} C${P(cx - hr - 1, hy - hr * 1.4)} ${P(cx + hr + 1, hy - hr * 1.4)} ${P(cx + hr + 0.5, hy + 1)}
            C${P(cx + hr * 0.6, hy - hr * 0.7)} ${P(cx - hr * 0.6, hy - hr * 0.7)} ${P(cx - hr - 0.5, hy + 1)} Z`;
  }
  const n = 6 + L, len = 8 + L * 5.6, sweep = 3.2 + L * 2.2;
  let d = `M${P(cx - hr - 1, hy + 4)}`;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 0.5) / n, t2 = (i + 1) / n;
    const A = x => Math.PI - Math.PI * x;
    const grow = 0.45 + 0.85 * t1;
    const jag = (i % 2 ? 0.62 : 1) * grow;
    const a1 = A(t1), tipR = hr + len * jag;
    const tx = cx + Math.cos(a1) * tipR * 0.9 + sweep * (0.4 + t1);
    const ty = hy - Math.sin(a1) * tipR - len * jag * 0.42;
    const a2 = A(t2), bx = cx + Math.cos(a2) * hr, by = hy - Math.sin(a2) * hr;
    const ax = cx + Math.cos(A(t0)) * hr * 1.02, ay = hy - Math.sin(A(t0)) * hr * 1.02;
    d += ` L${P(ax + (tx - ax) * 0.2, ay + (ty - ay) * 0.16)} L${P(tx, ty)} L${P(bx, by)}`;
  }
  d += ` L${P(cx + hr + 1, hy + 4)} C${P(cx + hr * 0.5, hy - hr * 0.5)} ${P(cx - hr * 0.5, hy - hr * 0.5)} ${P(cx - hr - 1, hy + 4)} Z`;
  return d;
}

/* 오라 — 뒤에 깔리는 채워진 불꽃. 전체 진행률에만 연동해 단조 증가한다. */
function aura(p, uid) {
  if (p <= 0) return '';
  const cx = 60, cy = 86;
  const rx = 26 + p * 34, ry = 44 + p * 54, n = 7 + Math.round(p * 8);
  let d = `M${P(cx - rx * 0.5, cy + ry * 0.55)}`;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = Math.PI * (1 - t) * 0.94 + Math.PI * 0.03;
    const jag = (i % 2 ? 0.86 : 1.04);
    const x = cx + Math.cos(a) * rx * jag, y = cy - Math.sin(a) * ry * jag;
    const qx = cx + Math.cos(a + 0.18) * rx * 0.5, qy = cy - Math.sin(a + 0.18) * ry * 0.5;
    d += ` Q${P(qx, qy)} ${P(x, y)}`;
  }
  d += ` L${P(cx + rx * 0.5, cy + ry * 0.55)} Z`;
  return `<path d="${d}" fill="url(#au${uid})" opacity="${(0.34 + p * 0.66).toFixed(2)}"/>`;
}

/* 불티 — 현재 단계에서 완료한 세션 수. 한 세션 = 한 칸.
   단계마다 세션 수가 다르다: 1~5단계는 6, 6단계는 5, 0·7단계는 특수. */
function sparks(count, L) {
  const st = STAGES[L];   /* STAGES는 level 순으로 정렬돼 있어 인덱스 == level */
  const span = st.to - st.from + 1;
  const slots = L === 0 ? 0 : (L === 7 ? 6 : span);
  if (slots === 0) return '';
  const filled = L === 7 ? 6 : count - st.from + 1;
  let on = '', off = '';
  for (let i = 0; i < slots; i++) {
    const a = -Math.PI * 0.86 + (slots === 1 ? 0.5 : i / (slots - 1)) * Math.PI * 1.72;
    const r = 54;
    const x = 60 + Math.cos(a) * r * 0.76, y = 86 + Math.sin(a) * r * 0.88;
    const s = i < filled ? 3.6 : 2.2;
    const d = `M${P(x, y - s)} L${P(x + s * 0.7, y)} L${P(x, y + s)} L${P(x - s * 0.7, y)} Z`;
    if (i < filled) on += d; else off += d;
  }
  return (off ? `<path d="${off}" fill="#2E2A24" opacity=".13"/>` : '')
       + (on ? `<path d="${on}" fill="#E8A02C" opacity=".98"/>` : '');
}

/* 번개 — 5단계부터 */
function bolts(p, L) {
  if (L < 5) return '';
  const n = (L - 4) * 2 + 1, out = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
    const x = 60 + side * (41 + k * 7), y = 34 + k * 30;
    out.push(`M${x} ${y} l${side * 7} 10 l${-side * 5} 2.5 l${side * 8} 12`);
  }
  return `<path d="${out.join(' ')}" fill="none" stroke="#8FD3F0"
    stroke-width="${(1.6 + p * 1.2).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"
    opacity="${(0.45 + p * 0.5).toFixed(2)}"/>`;
}

export function silhouetteSVG(count) {
  const st = stageOf(count);
  const L = st.level;
  const p = count / TOTAL_SESSIONS;
  const uid = ++uidSeq;
  const b = bust(L);
  const body = `<path d="${b.sh}"/><circle cx="${b.cx}" cy="${b.hy}" r="${b.hr}"/><path d="${hair(L, b)}"/>`;
  return `<svg viewBox="0 0 120 140" role="img" aria-label="${st.rank} ${L}단계 ${st.name}, ${count}/${TOTAL_SESSIONS} 완료">
    <defs>
      <radialGradient id="au${uid}" cx="50%" cy="68%" r="62%">
        <stop offset="0" stop-color="#F0B63C" stop-opacity=".9"/>
        <stop offset=".55" stop-color="#E8A02C" stop-opacity=".45"/>
        <stop offset="1" stop-color="#E8A02C" stop-opacity="0"/>
      </radialGradient>
    </defs>
    ${aura(p, uid)}${bolts(p, L)}${sparks(count, L)}
    <g fill="${TONE[L]}">${body}</g>
  </svg>`;
}

export function stageSheetHTML(count) {
  const cur = stageOf(count);
  const nextSt = STAGES.find(s => s.level === cur.level + 1);
  const remain = nextSt ? nextSt.from - count : 0;

  return `<div class="grab"></div><div class="role">METAMORPHOSIS</div><h3>계급과 단계</h3>
    <p class="hint">${count} / ${TOTAL_SESSIONS} 완료 · 현재 <b>${cur.rank}</b> (${cur.level}단계 ${cur.name})${
      nextSt ? ` · 다음 계급까지 ${remain}회차` : ' · 완주'}</p>
    <div class="stagelist">
      ${STAGES.map(s => `<div class="sg ${s.level === cur.level ? 'on' : ''} ${count > s.to ? 'past' : ''}">
        <span class="sg-l">${s.level}</span>
        <b>${s.rank}</b>
        <span class="sg-n">${s.name}</span>
        <span class="sg-r">${s.from === s.to ? `${s.from}` : `${s.from}–${s.to}`}</span>
      </div>`).join('')}
    </div>
    <p class="disc">형태는 계급에 따라 바뀌고, 오라는 전체 진행률에 따라 자란다. 실루엣 주위의 불티는 현재 계급에서 완료한 회차 수다.</p>`;
}
