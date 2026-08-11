import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAINING_DAYS, TOTAL_SESSIONS, sessionIndex, sessionAt } from '../assets/logic.js';

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
