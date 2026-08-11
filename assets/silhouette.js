import { STAGES, stageOf, TOTAL_SESSIONS } from './logic.js';

/* 체격 배율 — 단계가 오를수록 커진다 */
const bulkOf = level => 1 + level * 0.085;
const FINAL_BULK = bulkOf(7);

/* 파라메트릭 인체 실루엣. b가 클수록 어깨·골반이 넓어진다 */
function figure(b) {
  const cx = 60;
  const sh = 22 * b, wa = 13 * b, hip = 16 * b;
  return {
    head: { cx, cy: 22, r: 8.5 * Math.min(b, 1.3) },
    torso: `M${cx - sh} 34 L${cx + sh} 34 L${cx + wa} 63 L${cx + hip} 80 L${cx - hip} 80 L${cx - wa} 63 Z`,
    arms: `M${cx - sh + 2} 37 L${cx - sh - 5 * b} 62 L${cx - sh - 3 * b} 86`
        + ` M${cx + sh - 2} 37 L${cx + sh + 5 * b} 62 L${cx + sh + 3 * b} 86`,
    legs: `M${cx - hip + 4} 80 L${cx - hip + 2} 108 L${cx - hip} 132`
        + ` M${cx + hip - 4} 80 L${cx + hip - 2} 108 L${cx + hip} 132`,
    limb: 6.5 * b
  };
}

function figureMarkup(f, cls) {
  return `<g class="${cls}">
    <circle cx="${f.head.cx}" cy="${f.head.cy}" r="${f.head.r}"/>
    <path d="${f.torso}"/>
    <path d="${f.arms}" fill="none" stroke-width="${f.limb}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${f.legs}" fill="none" stroke-width="${f.limb * 1.15}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

export function silhouetteSVG(count) {
  const st = stageOf(count);
  const pct = count / TOTAL_SESSIONS;
  const cur = figure(bulkOf(st.level));
  const ghost = figure(FINAL_BULK);
  const fillY = 140 - 140 * pct;          // 아래에서 위로 차오른다

  return `<svg viewBox="0 0 120 140" role="img" aria-label="거인화 ${st.level}단계 ${st.name}, ${count}/36 완료">
    <defs>
      <clipPath id="sil-fill"><rect x="0" y="${fillY}" width="120" height="${140 - fillY}"/></clipPath>
    </defs>
    <!-- 최종형 윤곽: 남은 거리 -->
    <g fill="none" stroke="rgba(0,0,0,.13)" stroke-width="1" stroke-dasharray="3 3">
      <circle cx="${ghost.head.cx}" cy="${ghost.head.cy}" r="${ghost.head.r}"/>
      <path d="${ghost.torso}"/>
    </g>
    <!-- 현재 단계: 미충전 -->
    ${figureMarkup(cur, 'sil-empty')}
    <!-- 현재 단계: 진행률만큼 충전 -->
    <g clip-path="url(#sil-fill)">${figureMarkup(cur, 'sil-full')}</g>
    ${st.level >= 5 ? `<g class="sil-glow" clip-path="url(#sil-fill)">${figureMarkup(cur, 'sil-full')}</g>` : ''}
  </svg>`;
}

export function stageSheetHTML(count) {
  const cur = stageOf(count);
  const nextSt = STAGES.find(s => s.level === cur.level + 1);
  const remain = nextSt ? nextSt.from - count : 0;

  return `<div class="grab"></div><div class="role">METAMORPHOSIS</div><h3>거인화 단계</h3>
    <p class="hint">${count} / ${TOTAL_SESSIONS} 완료 · 현재 ${cur.level}단계 ${cur.name}${
      nextSt ? ` · 다음 단계까지 ${remain}세션` : ' · 완주'}</p>
    <div class="stagelist">
      ${STAGES.map(s => `<div class="sg ${s.level === cur.level ? 'on' : ''} ${count > s.to ? 'past' : ''}">
        <span class="sg-l">${s.level}</span>
        <b>${s.name}</b>
        <span class="sg-r">${s.from === s.to ? `${s.from}` : `${s.from}–${s.to}`}</span>
      </div>`).join('')}
    </div>
    <p class="disc">성취율은 완료 세션을 36으로 나눈 값이다. 실루엣 내부는 이 비율만큼 차오르고, 형태는 6세션마다 바뀐다.</p>`;
}
