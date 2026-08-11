/* 순수 계산 함수만 둔다. DOM·localStorage·Date.now()를 쓰지 않는다.
   브라우저와 Node 양쪽에서 그대로 import된다. */

export const TRAINING_DAYS = ['월', '화', '수', '목', '금', '토'];
export const TOTAL_SESSIONS = TRAINING_DAYS.length * 6;

export function sessionIndex(w, day) {
  const d = TRAINING_DAYS.indexOf(day);
  if (!Number.isInteger(w) || w < 0 || w > 5 || d < 0) return -1;
  return w * TRAINING_DAYS.length + d;
}

export function sessionAt(i) {
  if (!Number.isInteger(i) || i < 0 || i >= TOTAL_SESSIONS) return null;
  return {
    w: Math.floor(i / TRAINING_DAYS.length),
    day: TRAINING_DAYS[i % TRAINING_DAYS.length]
  };
}

/* done에 순번 i가 있는가. 프로토타입 체인을 타지 않게 hasOwnProperty로 본다 */
const has = (done, i) => Object.prototype.hasOwnProperty.call(done, String(i));

/* done의 유효한 순번만 오름차순으로 */
function doneIndices(done) {
  if (!done || typeof done !== 'object') return [];
  return Object.keys(done)
    .map(Number)
    .filter(n => Number.isInteger(n) && n >= 0 && n < TOTAL_SESSIONS)
    .sort((a, b) => a - b);
}

export function progress(done) {
  const count = doneIndices(done).length;
  return { count, total: TOTAL_SESSIONS, pct: count / TOTAL_SESSIONS };
}

export function nextSession(done) {
  for (let i = 0; i < TOTAL_SESSIONS; i++) if (!has(done, i)) return i;
  return null;
}

/* 완료한 것 중 가장 뒤 순번을 지나쳤는데 아직 안 한 것 = 밀린 훈련 */
export function backlog(done) {
  const idx = doneIndices(done);
  if (idx.length === 0) return [];
  const maxDone = idx[idx.length - 1];
  const out = [];
  for (let i = 0; i < maxDone; i++) if (!has(done, i)) out.push(i);
  return out;
}

export function weekProgress(done) {
  const per = TRAINING_DAYS.length;
  return Array.from({ length: 6 }, (_, w) => {
    let c = 0;
    for (let d = 0; d < per; d++) if (has(done, w * per + d)) c++;
    return c / per;
  });
}

export const STAGES = [
  { level: 0, name: '인간',              from: 0,  to: 0  },
  { level: 1, name: '각성',              from: 1,  to: 6  },
  { level: 2, name: '경화',              from: 7,  to: 12 },
  { level: 3, name: '변이',              from: 13, to: 18 },
  { level: 4, name: '거인화',            from: 19, to: 24 },
  { level: 5, name: '초대형',            from: 25, to: 30 },
  { level: 6, name: '임계',              from: 31, to: 35 },
  { level: 7, name: '울트라맨 · 완전체',  from: 36, to: 36 }
];

export function stageOf(count) {
  return STAGES.find(s => count >= s.from && count <= s.to) || STAGES[0];
}

export function lastDone(done) {
  const idx = doneIndices(done);
  if (idx.length === 0) return null;
  let best = null;
  for (const i of idx) {
    const seq = done[String(i)] && done[String(i)].seq;
    if (typeof seq === 'number' && (best === null || seq > best.seq)) {
      best = { seq, index: i, at: done[String(i)].at ?? null };
    }
  }
  /* seq가 하나도 없으면(마이그레이션된 기록) 순서를 알 수 없으므로
     가장 큰 순번으로 대신하고 시각은 알 수 없음으로 둔다 */
  if (!best) return { index: idx[idx.length - 1], at: null };
  return { index: best.index, at: best.at };
}
