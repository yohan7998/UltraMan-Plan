import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAINING_DAYS, TOTAL_SESSIONS, sessionIndex, sessionAt,
  progress, nextSession, backlog, weekProgress, STAGES, stageOf, lastDone,
  migrateV2, validateBackup
} from '../assets/logic.js';

test('훈련일은 월~토 6일이고 총 36세션이다', () => {
  assert.deepEqual(TRAINING_DAYS, ['월','화','수','목','금','토']);
  assert.equal(TOTAL_SESSIONS, 36);
});

test('sessionIndex는 주차와 요일을 순번으로 바꾼다', () => {
  assert.equal(sessionIndex(0, '월'), 0);
  assert.equal(sessionIndex(0, '토'), 5);
  assert.equal(sessionIndex(1, '월'), 6);
  assert.equal(sessionIndex(5, '토'), 35);
});

test('sessionIndex는 잘못된 입력에 -1을 준다', () => {
  assert.equal(sessionIndex(0, '일'), -1, '일요일은 훈련일이 아니다');
  assert.equal(sessionIndex(6, '월'), -1, '7주차는 없다');
  assert.equal(sessionIndex(-1, '월'), -1);
  assert.equal(sessionIndex(1.5, '월'), -1);
  assert.equal(sessionIndex(0, '금요일'), -1);
});

test('sessionAt은 순번을 주차와 요일로 되돌린다', () => {
  assert.deepEqual(sessionAt(0), { w: 0, day: '월' });
  assert.deepEqual(sessionAt(14), { w: 2, day: '수' });
  assert.deepEqual(sessionAt(35), { w: 5, day: '토' });
});

test('sessionAt은 범위 밖에 null을 준다', () => {
  assert.equal(sessionAt(-1), null);
  assert.equal(sessionAt(36), null);
  assert.equal(sessionAt(2.5), null);
});

test('36개 순번 전부 왕복 변환된다', () => {
  for (let i = 0; i < 36; i++) {
    const s = sessionAt(i);
    assert.equal(sessionIndex(s.w, s.day), i, `${i}번에서 왕복 실패`);
  }
});

/* 테스트용 done 만들기 — 순번 배열을 받아 완료 기록으로 바꾼다 */
const mk = (...idx) => Object.fromEntries(
  idx.map((i, n) => [String(i), { at: 1000 + n, seq: n + 1 }])
);

test('progress는 완료 수와 비율을 준다', () => {
  assert.deepEqual(progress({}), { count: 0, total: 36, pct: 0 });
  assert.deepEqual(progress(mk(0, 1, 2)), { count: 3, total: 36, pct: 3 / 36 });
  const all = mk(...Array.from({ length: 36 }, (_, i) => i));
  assert.deepEqual(progress(all), { count: 36, total: 36, pct: 1 });
});

test('progress는 범위 밖 키를 세지 않는다', () => {
  assert.equal(progress({ '36': {}, '-1': {}, 'abc': {} }).count, 0);
});

test('nextSession은 가장 작은 미완료를 준다', () => {
  assert.equal(nextSession({}), 0);
  assert.equal(nextSession(mk(0, 1, 2)), 3);
  assert.equal(nextSession(mk(8)), 0, '앞이 비었으면 그쪽이 먼저다');
  const all = mk(...Array.from({ length: 36 }, (_, i) => i));
  assert.equal(nextSession(all), null, '전부 완료면 null');
});

test('backlog — 하나도 안 했으면 비어 있다', () => {
  assert.deepEqual(backlog({}), []);
});

test('backlog — 앞에서부터 순서대로 했으면 비어 있다', () => {
  assert.deepEqual(backlog(mk(0, 1, 2, 3)), []);
});

test('backlog — 건너뛴 것이 밀린 훈련이다', () => {
  assert.deepEqual(backlog(mk(0, 1, 2, 3, 5, 6, 7)), [4]);
  assert.deepEqual(backlog(mk(0, 8)), [1, 2, 3, 4, 5, 6, 7]);
});

test('backlog — 마지막 하나만 했으면 앞 35개가 전부 밀린다', () => {
  assert.deepEqual(backlog(mk(35)), Array.from({ length: 35 }, (_, i) => i));
});

test('backlog — 전부 완료면 비어 있다', () => {
  const all = mk(...Array.from({ length: 36 }, (_, i) => i));
  assert.deepEqual(backlog(all), []);
});

test('weekProgress는 주차별 완료율을 준다', () => {
  assert.deepEqual(weekProgress({}), [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(weekProgress(mk(0, 1, 2)), [0.5, 0, 0, 0, 0, 0]);
  assert.deepEqual(weekProgress(mk(6, 7, 8, 9, 10, 11)), [0, 1, 0, 0, 0, 0]);
  assert.deepEqual(weekProgress(mk(35)), [0, 0, 0, 0, 0, 1 / 6]);
});

test('STAGES는 0~36을 빈틈없이 덮는다', () => {
  assert.equal(STAGES.length, 8);
  for (let c = 0; c <= 36; c++) {
    const hit = STAGES.filter(s => c >= s.from && c <= s.to);
    assert.equal(hit.length, 1, `완료 ${c}개가 ${hit.length}개 단계에 걸린다`);
  }
});

test('stageOf는 경계에서 정확하다', () => {
  const lv = c => stageOf(c).level;
  assert.equal(lv(0), 0);
  assert.equal(lv(1), 1);   assert.equal(lv(6), 1);
  assert.equal(lv(7), 2);   assert.equal(lv(12), 2);
  assert.equal(lv(13), 3);  assert.equal(lv(18), 3);
  assert.equal(lv(19), 4);  assert.equal(lv(24), 4);
  assert.equal(lv(25), 5);  assert.equal(lv(30), 5);
  assert.equal(lv(31), 6);  assert.equal(lv(35), 6);
  assert.equal(lv(36), 7);
  assert.equal(stageOf(36).name, '울트라맨 · 완전체');
});

test('lastDone은 가장 나중에 완료한 세션을 준다', () => {
  assert.equal(lastDone({}), null);
  const d = { '3': { at: 500, seq: 1 }, '9': { at: 900, seq: 2 } };
  assert.deepEqual(lastDone(d), { index: 9, at: 900 });
});

test('lastDone은 seq가 없으면 가장 큰 순번을 대신 쓴다', () => {
  const migrated = { '3': { at: null, seq: null }, '9': { at: null, seq: null } };
  assert.deepEqual(lastDone(migrated), { index: 9, at: null });
});

test('비표준 키는 progress와 backlog가 모두 무시한다', () => {
  const nonCanonical = { '07': {}, '10': {} };
  assert.equal(progress(nonCanonical).count, 1, '비표준 "07"은 무시하고 "10"만 센다');
  assert.deepEqual(backlog(nonCanonical), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], '세션 7은 완료되지 않음');
});

test('migrateV2는 주차-요일 키를 순번으로 바꾼다', () => {
  const v2 = { done: { '0-월': true, '2-수': true }, rm: { '스쿼트': 100 }, scaleOn: true };
  const out = migrateV2(v2);
  assert.equal(out.v, 3);
  assert.deepEqual(Object.keys(out.done).sort(), ['0', '14']);
  assert.deepEqual(out.done['0'], { at: null, seq: null });
  assert.deepEqual(out.rm, { '스쿼트': 100 });
  assert.equal(out.scaleOn, true);
});

test('migrateV2는 false 값을 완료로 보지 않는다', () => {
  assert.deepEqual(migrateV2({ done: { '0-월': false } }).done, {});
});

test('migrateV2는 손상된 입력에 빈 상태를 준다', () => {
  for (const bad of [null, undefined, 'x', 42, {}, { done: 'x' }]) {
    const out = migrateV2(bad);
    assert.equal(out.v, 3);
    assert.deepEqual(out.done, {});
    assert.deepEqual(out.rm, {});
    assert.equal(out.scaleOn, false);
  }
});

test('migrateV2는 알 수 없는 키를 버린다', () => {
  const out = migrateV2({ done: { '0-일': true, '9-월': true, '쓰레기': true } });
  assert.deepEqual(out.done, {}, '일요일·7주차 이상·형식 불명은 모두 버린다');
});

test('validateBackup은 정상 백업을 통과시킨다', () => {
  const good = { v: 3, done: { '0': { at: 1, seq: 1 } }, rm: { '스쿼트': 100 }, scaleOn: true };
  const r = validateBackup(good);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.done, good.done);
});

test('validateBackup은 형태가 아닌 것을 거른다', () => {
  assert.equal(validateBackup(null).ok, false);
  assert.equal(validateBackup('x').ok, false);
  assert.equal(validateBackup({ v: 2, done: {} }).ok, false, '버전이 다르면 거부');
  assert.equal(validateBackup({ v: 3 }).ok, false, 'done이 없으면 거부');
  assert.equal(validateBackup({ v: 3, done: 'x' }).ok, false);
});

test('validateBackup은 범위 밖 세션 키를 거른다', () => {
  const r = validateBackup({ v: 3, done: { '0': {}, '99': {}, 'zz': {} } });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.data.done), ['0'], '유효한 키만 남긴다');
});

test('validateBackup은 빠진 필드를 기본값으로 채운다', () => {
  const r = validateBackup({ v: 3, done: {} });
  assert.deepEqual(r.data.rm, {});
  assert.equal(r.data.scaleOn, false);
});

test('STAGES의 모든 단계에 계급이 붙어 있다', () => {
  const ranks = STAGES.map(s => s.rank);
  assert.deepEqual(ranks, [
    '훈련병', '신병', '정예병', '분대장', '특무병', '반장', '부단장', '단장'
  ]);
});

test('stageOf는 계급을 함께 준다', () => {
  assert.equal(stageOf(0).rank, '훈련병');
  assert.equal(stageOf(13).rank, '분대장');
  assert.equal(stageOf(36).rank, '단장');
});
