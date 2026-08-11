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
