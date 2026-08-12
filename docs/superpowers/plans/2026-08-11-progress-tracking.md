# 거인화 진행 관리 · 성취율 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 훈련 완료 기록이 실제로 저장되게 고치고, 36세션 순번 큐 기반 이월과 거인화 실루엣 성취율 시각화를 추가한다.

**Architecture:** 단일 1.2MB `index.html`을 `index.html` + `assets/{data,images,logic,app}.js` ES 모듈로 분리한다. 모든 계산은 DOM 의존이 없는 순수 함수로 `logic.js`에 모아 Node 내장 테스트 러너로 검증하고, `app.js`는 상태·저장·렌더링만 맡는다. 저장은 `window.storage`(존재하지 않는 API)에서 `localStorage`로 교체한다.

**Tech Stack:** 바닐라 JS(ES 모듈), 인라인 SVG, `localStorage`, `node --test`(의존성 없음), GitHub Pages

설계 문서: `docs/superpowers/specs/2026-08-11-ultraman-progress-design.md`

## Global Constraints

- 작업 브랜치는 `feat/progress-tracking`. Task 9 전까지 `main`에 병합하지 않는다. GitHub Pages는 `main`만 배포하므로 작업 중 라이브 앱은 영향받지 않는다.
- 복구 기준점 태그 `v1-original` = 커밋 `74afa3d`. 어떤 상황에서도 여기로 되돌릴 수 있다.
- **빈 `catch{}`를 쓰지 않는다.** 모든 catch는 최소한 `console.warn` 또는 사용자에게 보이는 경고를 남긴다. 이번 버그의 근본 원인이다.
- 외부 라이브러리·빌드 도구를 추가하지 않는다. 폰트 CDN 링크(`index.html:14-16`)만 기존대로 유지한다.
- 저장 키는 `geoinhwa:v3`. 구 키 `geoinhwa:v2`는 읽기만 하고 삭제하지 않는다.
- 세션 총수는 36(6주 × 월~토). 일요일은 큐에 없다.
- 성취율은 `완료 세션 ÷ 36` 하나로 고정한다. 가중치·감점을 섞지 않는다.
- 모든 커밋 메시지는 한국어로 쓰고 다음 줄로 끝낸다:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- 로컬 확인은 `python3 -m http.server 8000` 후 `http://localhost:8000`. ES 모듈은 `file://`에서 로드되지 않는다.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `index.html` | 문서 뼈대, 인라인 CSS, 경고 배너 마크업, `app.js` 로드 |
| `assets/data.js` | 프로그램 데이터: `PARTS` `WEEKS` `RULES` `RM_BASE` `RM_LIFT` `EXMETA` |
| `assets/images.js` | `IMG` — 운동 사진 base64. 분리 후 수정하지 않는다 |
| `assets/logic.js` | 순수 계산 함수. DOM·localStorage·`Date.now()` 의존 없음 |
| `assets/app.js` | 상태, 저장 계층, 렌더링, 이벤트 |
| `test/logic.test.js` | `logic.js` 테스트 |
| `package.json` | `{"type":"module"}` — `node --check`와 `node --test`가 ESM을 인식하게 함 |

`logic.js`가 순수한 이유가 핵심이다. 밀린 훈련 판정과 단계 경계는 눈으로 검토해서는 틀린 걸 못 잡는다. 테스트로 고정해야 한다.

---

### Task 1: 파일 분리 (동작 불변)

기계적 분리만 한다. 로직은 한 줄도 바꾸지 않는다. 565행 한 줄이 1.13MB라 손으로 편집하면 위험하므로 스크립트로 자른다.

**Files:**
- Create: `assets/data.js`, `assets/images.js`, `assets/app.js`, `package.json`
- Modify: `index.html` (1.2MB → 약 30KB)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `assets/data.js` → `export { PARTS, WEEKS, RULES, RM_BASE, RM_LIFT, EXMETA }`
  - `assets/images.js` → `export const IMG`
  - `assets/app.js` → 진입점. `<script type="module" src="assets/app.js?v=3">`로만 로드된다

현재 `index.html`의 경계 (1-indexed):

| 행 | 내용 | 목적지 |
|---|---|---|
| 1–268 | head + CSS + body 열기 + `#app` `#sheet` div | `index.html` 유지 |
| 269 | `<script>` | 삭제 |
| 270–562 | 프로그램 데이터 | `assets/data.js` |
| 563–564 | `</script>` `<script>` | 삭제 |
| 565 | `const IMG={…}` | `assets/images.js` |
| 566 | `const EXMETA={…}` | `assets/data.js` 끝에 |
| 567–568 | `</script>` `<script>` | 삭제 |
| 569–841 | 앱 로직 | `assets/app.js` |
| 842 | `</script>` | 삭제 |
| 843–844 | `</body></html>` | `index.html` 유지 |

- [ ] **Step 1: 분리 스크립트 작성**

`/tmp/split.py`에 작성한다(저장소에 커밋하지 않는다).

```python
import io, os

src = io.open('index.html', encoding='utf-8').read().split('\n')

def seg(a, b):                      # 1-indexed 포함 구간
    return '\n'.join(src[a-1:b])

head    = seg(1, 268)
data    = seg(270, 562)
img     = src[565-1]
exmeta  = src[566-1]
app     = seg(569, 841)
tail    = seg(843, 844)

assert head.startswith('<!DOCTYPE html>'), 'head 경계 어긋남'
assert img.startswith('const IMG='), 'IMG 행 어긋남'
assert exmeta.startswith('const EXMETA='), 'EXMETA 행 어긋남'
assert 'const DAYS=' in app, 'app 경계 어긋남'
assert '<script' not in data and '<script' not in app, '스크립트 태그가 섞임'

os.makedirs('assets', exist_ok=True)

io.open('assets/images.js', 'w', encoding='utf-8').write('export ' + img + '\n')

io.open('assets/data.js', 'w', encoding='utf-8').write(
    data + '\n\n' + exmeta + '\n\n'
    'export { PARTS, WEEKS, RULES, RM_BASE, RM_LIFT, EXMETA };\n')

io.open('assets/app.js', 'w', encoding='utf-8').write(
    "import { IMG } from './images.js';\n"
    "import { PARTS, WEEKS, RULES, RM_BASE, RM_LIFT, EXMETA } from './data.js';\n"
    + app + '\n')

io.open('index.html', 'w', encoding='utf-8').write(
    head + '\n<script type="module" src="assets/app.js?v=3"></script>\n' + tail + '\n')

print('완료')
```

- [ ] **Step 2: 스크립트 실행**

```bash
python3 /tmp/split.py
```

Expected: `완료` 출력. assert가 하나라도 걸리면 행 경계가 어긋난 것이므로 멈추고 실제 행 번호를 다시 확인한다.

- [ ] **Step 3: `package.json` 생성**

```json
{
  "name": "ultraman-plan",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "serve": "python3 -m http.server 8000"
  }
}
```

- [ ] **Step 4: 문법 검사**

```bash
node --check assets/data.js && node --check assets/images.js && node --check assets/app.js && echo "문법 OK"
```

Expected: `문법 OK`

- [ ] **Step 5: 데이터 모듈이 실제로 import되는지 확인**

```bash
node -e "import('./assets/data.js').then(m=>console.log(Object.keys(m).join(',')))"
```

Expected: `PARTS,WEEKS,RULES,RM_BASE,RM_LIFT,EXMETA` (순서는 다를 수 있음)

```bash
node -e "import('./assets/data.js').then(m=>console.log(m.WEEKS.length, Object.keys(m.PARTS).length))"
```

Expected: `6 7`

- [ ] **Step 6: 크기 확인**

```bash
ls -la index.html assets/
```

Expected: `index.html`이 약 30KB, `assets/images.js`가 약 1.13MB. `index.html`이 여전히 1MB대라면 분리가 안 된 것이다.

- [ ] **Step 7: 브라우저에서 동작 불변 확인**

```bash
python3 -m http.server 8000
```

`http://localhost:8000`에서 확인한다. 콘솔에 에러가 없어야 하고, 다음이 분리 전과 똑같이 동작해야 한다.

1. 홈 → 주차 → 요일 이동
2. 하단 4개 탭 전환
3. 운동 사진 썸네일 탭 → 바텀시트에 사진 2장과 큐가 뜨는가
4. 1RM 탭에서 숫자를 바꾸면 퍼센트 표가 갱신되는가

(이 시점에는 완료 체크가 저장되지 않는 것이 정상이다. Task 4에서 고친다.)

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
리팩터링: 단일 HTML을 ES 모듈 4개로 분리

1.2MB 파일의 95%가 한 줄(운동 사진 base64)이라 편집이 위험했다.
로직을 담은 app.js가 35KB로 줄어 이후 작업이 안전해진다.
동작은 변경하지 않았다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 세션 좌표 변환 (logic.js 착수)

**Files:**
- Create: `assets/logic.js`, `test/logic.test.js`

**Interfaces:**
- Consumes: 없음. `logic.js`는 아무것도 import하지 않는다
- Produces:
  - `TRAINING_DAYS: string[]` — `["월","화","수","목","금","토"]`
  - `TOTAL_SESSIONS: number` — `36`
  - `sessionIndex(w: number, day: string) -> number` — 0–35, 잘못된 입력이면 `-1`
  - `sessionAt(i: number) -> {w: number, day: string} | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/logic.test.js`:

```js
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
node --test
```

Expected: FAIL — `Cannot find module .../assets/logic.js`

- [ ] **Step 3: 최소 구현**

`assets/logic.js`:

```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test
```

Expected: PASS — 6개 테스트 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add assets/logic.js test/logic.test.js
git commit -m "$(cat <<'EOF'
기능: 세션 좌표 변환 함수 추가

주차·요일과 0~35 순번 사이를 왕복 변환한다.
달력 대신 순번 큐로 스케줄을 다루기 위한 기반이다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 진행률 · 밀린 훈련 · 거인화 단계

이 계획에서 가장 틀리기 쉬운 부분이다. "8번을 했는데 5번이 비어 있으면 5번은 밀린 것"은 말로는 간단하지만 경계에서 어긋난다. 테스트로 고정한다.

**Files:**
- Modify: `assets/logic.js`, `test/logic.test.js`

**Interfaces:**
- Consumes: `TOTAL_SESSIONS`, `sessionIndex` (Task 2)
- Produces:
  - `progress(done) -> {count: number, total: 36, pct: number}` — `pct`는 0–1
  - `nextSession(done) -> number | null` — 가장 작은 미완료 순번. 전부 완료면 `null`
  - `backlog(done) -> number[]` — 밀린 순번 오름차순
  - `weekProgress(done) -> number[]` — 길이 6, 각 원소 0–1
  - `STAGES` — 8개 단계 정의 배열
  - `stageOf(count) -> {level, name, from, to}`
  - `lastDone(done) -> {index: number, at: number|null} | null`

`done`의 형태: `{ "7": { at: 1754900000000, seq: 5 } }`. 키가 있으면 완료, 없으면 미완료.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/logic.test.js` 끝에 덧붙인다. import 줄도 함께 수정한다.

```js
import {
  TRAINING_DAYS, TOTAL_SESSIONS, sessionIndex, sessionAt,
  progress, nextSession, backlog, weekProgress, STAGES, stageOf, lastDone
} from '../assets/logic.js';

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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
node --test
```

Expected: FAIL — `progress is not a function` 계열 에러

- [ ] **Step 3: 구현**

`assets/logic.js` 끝에 덧붙인다.

```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test
```

Expected: PASS — 전체 통과. 특히 `STAGES는 0~36을 빈틈없이 덮는다`가 통과해야 단계 표에 구멍이 없다는 뜻이다.

- [ ] **Step 5: 커밋**

```bash
git add assets/logic.js test/logic.test.js
git commit -m "$(cat <<'EOF'
기능: 진행률·밀린 훈련·거인화 단계 계산 추가

이월은 상태로 저장하지 않고 계산한다. 완료한 것 중 가장 뒤를
지나쳤는데 안 한 세션이 곧 밀린 훈련이다.
경계 조건을 테스트로 고정했다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 저장 계층 교체 — 버그 수정

원래 문제를 고치는 작업이다. 이 태스크가 끝나면 체크가 새로고침 후에도 남아 있어야 한다.

**Files:**
- Modify: `assets/logic.js`, `test/logic.test.js` (`migrateV2` 추가)
- Modify: `assets/app.js` (`store` 교체, `state.done` 스키마 변경, 완료 토글)
- Modify: `index.html` (경고 배너 마크업 + CSS)

**Interfaces:**
- Consumes: `sessionIndex` (Task 2)
- Produces:
  - `migrateV2(v2) -> {v: 3, done: object, rm: object, scaleOn: boolean}` (logic.js)
  - `app.js` 내부: `storageOk: boolean`, `save()`, `load()`, `toggleDone(i)`, `showStorageWarning(msg)`

- [ ] **Step 1: migrateV2 실패 테스트 작성**

`test/logic.test.js`의 import에 `migrateV2`를 추가하고 끝에 덧붙인다.

```js
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
node --test
```

Expected: FAIL — `migrateV2 is not a function`

- [ ] **Step 3: migrateV2 구현**

`assets/logic.js` 끝에 덧붙인다.

```js
/* 구 스키마: { done: { "0-월": true }, rm, scaleOn }
   완료 시각과 순서를 알 수 없으므로 null로 둔다 */
export function migrateV2(v2) {
  const out = { v: 3, done: {}, rm: {}, scaleOn: false };
  if (!v2 || typeof v2 !== 'object') return out;

  const src = (v2.done && typeof v2.done === 'object') ? v2.done : {};
  for (const key of Object.keys(src)) {
    if (!src[key]) continue;
    const m = /^(\d+)-(.+)$/.exec(key);
    if (!m) continue;
    const i = sessionIndex(Number(m[1]), m[2]);
    if (i < 0) continue;
    out.done[String(i)] = { at: null, seq: null };
  }

  if (v2.rm && typeof v2.rm === 'object') out.rm = Object.assign({}, v2.rm);
  out.scaleOn = !!v2.scaleOn;
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test
```

Expected: PASS

- [ ] **Step 5: 경고 배너 마크업 추가**

`index.html`의 `<div id="app">` 바로 앞(267행 위치)에 넣는다.

```html
<div id="warn" class="warn" hidden></div>
```

`</style>` 바로 앞에 CSS를 넣는다.

```css
.warn{position:fixed;top:0;left:0;right:0;z-index:99;padding:10px 14px;
  background:#8C2F1E;color:#fff;font-size:12.5px;line-height:1.5;
  box-shadow:0 2px 10px rgba(0,0,0,.25)}
.warn[hidden]{display:none}
```

- [ ] **Step 6: app.js의 store 교체**

`assets/app.js` 2번째 줄(기존 import 아래)에 logic import를 추가한다.

```js
import {
  sessionIndex, sessionAt, progress, nextSession, backlog,
  weekProgress, stageOf, lastDone, migrateV2
} from './logic.js';
```

(Task 8에서 `validateBackup`을, Task 9에서 버전 쿼리를 이 줄에 추가한다.)

기존 `const store={…}` 블록(원래 `index.html:572-576`) 전체를 아래로 교체한다.

```js
const KEY = 'geoinhwa:v3';
const KEY_V2 = 'geoinhwa:v2';
const PROBE = 'geoinhwa:probe';
let storageOk = true;

function showStorageWarning(msg) {
  const el = document.getElementById('warn');
  el.textContent = msg || '⚠ 이 브라우저에서는 기록이 저장되지 않습니다. (사파리 시크릿 모드 등) 기록이 남지 않으니 확인 후 사용하세요.';
  el.hidden = false;
}

/* 실제로 쓰고 되읽어 확인한다. 존재 여부만 보면 시크릿 모드를 못 잡는다 */
function probeStorage() {
  try {
    localStorage.setItem(PROBE, '1');
    const ok = localStorage.getItem(PROBE) === '1';
    localStorage.removeItem(PROBE);
    return ok;
  } catch (e) {
    console.warn('저장소 점검 실패:', e);
    return false;
  }
}

function applyState(o) {
  state.done = (o && o.done && typeof o.done === 'object') ? o.done : {};
  state.rm = Object.assign({}, RM_BASE, (o && o.rm) || {});
  state.scaleOn = !!(o && o.scaleOn);
}

const store = {
  load() {
    storageOk = probeStorage();
    if (!storageOk) { showStorageWarning(); return; }

    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { applyState(JSON.parse(raw)); }
      catch (e) {
        console.warn('v3 기록 파싱 실패:', e);
        showStorageWarning('⚠ 저장된 기록을 읽을 수 없습니다. 1RM 화면의 기록 불러오기로 복원하세요.');
      }
      return;
    }

    const rawV2 = localStorage.getItem(KEY_V2);
    if (rawV2) {
      try {
        applyState(migrateV2(JSON.parse(rawV2)));
        store.save();
        console.info('v2 기록을 v3로 옮겼습니다.');
      } catch (e) {
        console.warn('v2 기록을 옮기지 못했습니다. 새로 시작합니다:', e);
      }
    }
  },

  save() {
    if (!storageOk) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: 3, done: state.done, rm: state.rm, scaleOn: state.scaleOn
      }));
    } catch (e) {
      storageOk = false;
      console.warn('저장 실패:', e);
      showStorageWarning('⚠ 기록을 저장하지 못했습니다: ' + e.message);
    }
  }
};

function nextSeq() {
  let m = 0;
  for (const k of Object.keys(state.done)) {
    const s = state.done[k] && state.done[k].seq;
    if (typeof s === 'number' && s > m) m = s;
  }
  return m + 1;
}

function toggleDone(i) {
  const k = String(i);
  if (Object.prototype.hasOwnProperty.call(state.done, k)) delete state.done[k];
  else state.done[k] = { at: Date.now(), seq: nextSeq() };
  store.save();
  return Object.prototype.hasOwnProperty.call(state.done, k);
}

const isDone = i => Object.prototype.hasOwnProperty.call(state.done, String(i));
```

`store.load()`가 `async`가 아니게 되었으므로 마지막 줄(원래 `index.html:840`)을 바꾼다.

```js
store.load(); paint('none');
```

- [ ] **Step 7: 완료 버튼을 순번 기반으로 교체**

`vDay` 안의 `const key=wi+'-'+d, done=!!state.done[key]`를 바꾼다.

```js
const idx = sessionIndex(wi, d), done = isDone(idx);
```

같은 함수의 완료 버튼 마크업에서 `data-done="${key}"`를 `data-done="${idx}"`로 바꾼다.

`vWeek` 안의 `const rest=d==="일", key=wi+'-'+d, done=!!state.done[key]`를 바꾼다.

```js
const rest = d === '일';
const idx = rest ? -1 : sessionIndex(wi, d);
const done = idx >= 0 && isDone(idx);
```

클릭 핸들러의 `data-done` 처리(원래 `index.html:777-780`)를 바꾼다.

```js
const dn = e.target.closest('[data-done]');
if (dn) {
  const on = toggleDone(Number(dn.dataset.done));
  dn.classList.toggle('on', on);
  dn.textContent = on ? '훈련 완료됨 · 다시 누르면 해제' : '오늘 훈련 완료로 표시';
  return;
}
```

`bindRM` 안의 `store.save()` 두 곳은 그대로 둔다. 새 `store.save()`가 같은 이름이므로 수정 불필요하다.

- [ ] **Step 8: 문법 검사와 테스트**

```bash
node --check assets/app.js && node --test
```

Expected: 문법 통과 + 테스트 전체 PASS

- [ ] **Step 9: 브라우저에서 저장 확인 — 이 태스크의 핵심**

```bash
python3 -m http.server 8000
```

1. 1주차 월요일 → "오늘 훈련 완료로 표시" 클릭
2. **새로고침(F5)**
3. 다시 1주차 월요일 진입 → 여전히 "훈련 완료됨"이어야 한다
4. 주차 화면에서도 월요일이 완료 표시여야 한다
5. 개발자 도구 → Application → Local Storage에 `geoinhwa:v3` 키가 있고 값이 `{"v":3,"done":{"0":{"at":…,"seq":1}},…}` 형태여야 한다
6. 시크릿 모드(사파리 개인정보 보호 브라우징)로 열어 경고 배너가 뜨는지 확인한다

3번이 실패하면 이 태스크는 완료된 것이 아니다.

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
수정: 훈련 기록이 저장되지 않던 문제

window.storage는 표준 API가 아니라 아티팩트 샌드박스 전용이다.
일반 브라우저에서 undefined였고 빈 catch가 그 실패를 숨겨왔다.
localStorage로 교체하고, 쓰고 되읽는 점검과 경고 배너를 붙였다.
완료 기록에 시각과 순서를 남기도록 스키마를 v3로 올렸다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 홈 대시보드 — 진행 현황

실루엣은 Task 6에서 넣는다. 여기서는 숫자와 목록을 먼저 실제 데이터로 만든다.

**Files:**
- Modify: `assets/app.js` (`vHome`)
- Modify: `index.html` (CSS 추가)

**Interfaces:**
- Consumes: `progress`, `nextSession`, `backlog`, `weekProgress`, `stageOf`, `lastDone`, `sessionAt` (Task 2·3), `isDone` (Task 4)
- Produces: `sessionLabel(i) -> string` — `"3주차 수요일 · 하체후면/팔"` 형태. Task 7에서도 쓴다

- [ ] **Step 1: 라벨 헬퍼 추가**

`assets/app.js`의 `vHome` 위에 넣는다.

```js
/* "3주차 수요일 · 하체후면/팔" */
function sessionLabel(i) {
  const s = sessionAt(i);
  if (!s) return '';
  return `${s.w + 1}주차 ${s.day}요일 · ${PARTS[s.day][0]}`;
}

function fmtWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
```

- [ ] **Step 2: vHome 교체**

`vHome` 전체를 아래로 바꾼다. 하드코딩된 `const pct=[62,68,75,81,88,94]`가 사라지는 것이 핵심이다.

```js
function vHome() {
  const pr = progress(state.done);
  const st = stageOf(pr.count);
  const next = nextSession(state.done);
  const allBack = backlog(state.done);
  const nextIsLate = next !== null && allBack.includes(next);
  const back = allBack.filter(i => i !== next);   /* 다음 훈련 카드와 중복 표시하지 않는다 */
  const wp = weekProgress(state.done);
  const last = lastDone(state.done);

  const pctTxt = (pr.pct * 100).toFixed(1);

  return `
  <div class="top"><div><div class="top-s">SURVEY CORPS · 105</div></div></div>

  <div class="hero">
    <div class="stamp">6주 블록<b>선형 주기화</b></div>
    <div class="eyebrow">TRAINING ORDER</div>
    <h1>거인화<br><em>프로그램</em></h1>
  </div>

  <div class="status">
    <div id="silhouette"></div>
    <div class="st-name"><b>${st.level}단계</b><span>${esc(st.name)}</span></div>
    <div class="st-bar"><i style="width:${pr.pct * 100}%"></i></div>
    <div class="st-num"><b>${pr.count}</b><span>/ ${pr.total}</span><em>${pctTxt}%</em></div>
    ${last && last.at ? `<div class="st-last">마지막 훈련 ${fmtWhen(last.at)}</div>` : ''}
  </div>

  ${next === null ? `
  <div class="nextcard done"><span class="lb">완주</span>
    <b>36세션 전부 완료</b><span class="dt">울트라맨 · 완전체</span></div>` : `
  <button class="nextcard" data-go="day" data-w="${sessionAt(next).w}" data-d="${sessionAt(next).day}">
    <span class="lb">${nextIsLate ? '▶ 다음 훈련 · 밀림' : '▶ 다음 훈련'}</span>
    <b>${esc(sessionLabel(next))}</b>
    <span class="dt">${esc(WEEKS[sessionAt(next).w].focus)}</span>
  </button>`}

  ${back.length ? `
  <div class="slab warnslab"><h2>⚠ 밀린 훈련</h2><span>${back.length}</span></div>
  <div class="backlog">
    ${back.map(i => `<button class="bl" data-go="day" data-w="${sessionAt(i).w}" data-d="${sessionAt(i).day}">
      <span class="dot"></span><b>${esc(sessionLabel(i))}</b><span class="chev">${IC.chev}</span></button>`).join('')}
  </div>` : ''}

  <div class="slab"><h2>주차별 달성</h2><span>${pr.count} / ${pr.total}</span></div>
  <div class="ladder">${wp.map((p, i) =>
    `<i class="${p === 1 ? 'full' : ''}" style="height:${Math.max(p * 100, 4)}%;animation-delay:${i * 55}ms"><b>${i + 1}주</b></i>`
  ).join('')}</div>

  <div class="slab"><h2>주차 선택</h2><span>6 WEEKS</span></div>
  <div class="weeks">
    ${WEEKS.map((w, i) => {
      const c = Math.round(wp[i] * 6);
      return `
      <button class="wk ${w.n === 6 ? 'peak' : ''} ${c === 6 ? 'cleared' : ''}" data-go="week" data-w="${i}" style="animation-delay:${i * 40}ms">
        <span class="wk-n">${w.n}<small>주차</small></span>
        <span class="wk-b"><b>${esc(w.focus)}</b><span>${w.term.map(t => t[0] + ' · ' + t[1]).join(' / ')}</span></span>
        <span class="tag">${c}/6</span>
      </button>`;
    }).join('')}
  </div>

  <div class="slab"><h2>훈련 전 확인</h2></div>
  <div class="tiles">
    <button class="tile" data-go="rules"><span class="ic">${IC.doc}</span><b>훈련 수칙</b><span>13개 항목 · 전원 필독</span></button>
    <button class="tile" data-go="rm"><span class="ic">${IC.gauge}</span><b>1RM 기준</b><span>계산기 · 퍼센트 표</span></button>
  </div>`;
}
```

- [ ] **Step 3: CSS 추가**

`index.html`의 `</style>` 앞에 넣는다.

```css
.status{margin:14px 16px 4px;padding:18px 16px 16px;background:var(--bg2);
  border:1px solid rgba(0,0,0,.08);border-radius:14px;text-align:center}
#silhouette{display:flex;justify-content:center;min-height:150px}
#silhouette svg{width:120px;height:140px}
.st-name{margin-top:10px;display:flex;gap:8px;justify-content:center;align-items:baseline}
.st-name b{font-size:15px}
.st-name span{font-size:19px;font-weight:800;letter-spacing:-.02em}
.st-bar{margin:12px 0 8px;height:7px;border-radius:4px;background:rgba(0,0,0,.1);overflow:hidden}
.st-bar i{display:block;height:100%;background:var(--rust);transition:width .45s ease}
.st-num{display:flex;gap:5px;justify-content:center;align-items:baseline;font-variant-numeric:tabular-nums}
.st-num b{font-size:26px;font-weight:900}
.st-num span{font-size:13px;color:var(--muted)}
.st-num em{margin-left:8px;font-style:normal;font-size:13px;font-weight:700;color:var(--rust)}
.st-last{margin-top:8px;font-size:11.5px;color:var(--muted)}

.nextcard{display:block;width:calc(100% - 32px);margin:12px 16px;padding:14px 16px;
  text-align:left;background:var(--rust);color:#fff;border:0;border-radius:12px;cursor:pointer}
.nextcard .lb{display:block;font-size:11px;font-weight:700;opacity:.85;letter-spacing:.04em}
.nextcard b{display:block;margin-top:5px;font-size:16px;font-weight:800}
.nextcard .dt{display:block;margin-top:3px;font-size:12px;opacity:.8}
.nextcard.done{background:#2E2A24}

.warnslab h2{color:#8C2F1E}
.backlog{margin:0 16px}
.bl{display:flex;align-items:center;gap:10px;width:100%;margin-bottom:6px;padding:11px 13px;
  background:rgba(140,47,30,.07);border:1px solid rgba(140,47,30,.25);border-radius:10px;
  text-align:left;cursor:pointer}
.bl .dot{width:7px;height:7px;border-radius:50%;background:#8C2F1E;flex:none}
.bl b{flex:1;font-size:13.5px;font-weight:700}
.bl .chev{display:flex;color:var(--muted)}
.ladder i.full{opacity:1}
.wk.cleared .tag{background:var(--rust);color:#fff}
```

- [ ] **Step 4: 문법 검사**

```bash
node --check assets/app.js && node --test
```

Expected: 통과

- [ ] **Step 5: 브라우저 확인**

`http://localhost:8000`에서 시나리오대로 확인한다.

1. 기록이 비어 있을 때: `0 / 36`, `0.0%`, 0단계 인간, 다음 훈련 = 1주차 월요일, 밀린 훈련 섹션 없음, 사다리 전부 바닥
2. 1주차 월·화·수를 완료 → `3 / 36`, `8.3%`, 1단계 각성, 1주 막대가 절반, 주차 버튼 `3/6`
3. **2주차 목요일만 완료** → 밀린 훈련 섹션에 앞의 미완료가 나열되고, 다음 훈련 카드에 "밀림" 표시가 붙는가
4. 밀린 훈련 항목을 누르면 해당 요일 화면으로 가는가
5. 새로고침해도 전부 유지되는가

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
기능: 홈을 진행 대시보드로 전환

하드코딩된 가짜 사다리 그래프(62/68/75/81/88/94)를 주차별
실제 완료율로 교체했다. 다음 훈련 카드와 밀린 훈련 목록을
추가해 앱을 열자마자 현황이 보이게 했다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 거인화 실루엣

**Files:**
- Create: `assets/silhouette.js`
- Modify: `assets/app.js` (`vHome`에서 호출, 실루엣 탭 시 시트 열기)

**Interfaces:**
- Consumes: `STAGES`, `stageOf`, `progress` (Task 3)
- Produces:
  - `silhouetteSVG(count: number) -> string` — 인라인 SVG 문자열
  - `stageSheetHTML(count: number) -> string` — 바텀시트 내용

`app.js`가 아니라 별도 파일로 두는 이유: SVG 조립은 렌더링 로직과 성격이 다르고, 나중에 형태를 다듬을 때 `app.js`를 건드리지 않아도 된다.

- [ ] **Step 1: silhouette.js 작성**

```js
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
```

- [ ] **Step 2: app.js에 연결**

import를 추가한다.

```js
import { silhouetteSVG, stageSheetHTML } from './silhouette.js';
```

`vHome`의 `<div id="silhouette"></div>`를 채운다.

```js
<div id="silhouette" data-stage>${silhouetteSVG(pr.count)}</div>
```

클릭 핸들러에서 `[data-back]` 처리 바로 다음에 넣는다.

```js
if (e.target.closest('[data-stage]')) {
  sheetIn.innerHTML = stageSheetHTML(progress(state.done).count);
  sheet.classList.add('open');
  return;
}
```

- [ ] **Step 3: CSS 추가**

`index.html`의 `</style>` 앞에 넣는다.

```css
#silhouette{cursor:pointer}
.sil-empty{fill:rgba(0,0,0,.16);stroke:rgba(0,0,0,.16)}
.sil-full{fill:var(--rust);stroke:var(--rust)}
.sil-glow{filter:drop-shadow(0 0 6px var(--rust));opacity:.75}
.stagelist{margin:14px 0 4px}
.sg{display:flex;align-items:center;gap:10px;padding:9px 11px;margin-bottom:5px;
  border-radius:9px;background:rgba(0,0,0,.04);font-size:13.5px}
.sg-l{width:20px;height:20px;flex:none;display:flex;align-items:center;justify-content:center;
  border-radius:50%;background:rgba(0,0,0,.12);font-size:11px;font-weight:800}
.sg b{flex:1;font-weight:700}
.sg-r{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}
.sg.past{opacity:.55}
.sg.on{background:rgba(140,47,30,.12);outline:1.5px solid var(--rust)}
.sg.on .sg-l{background:var(--rust);color:#fff}
```

- [ ] **Step 4: 문법 검사**

```bash
node --check assets/silhouette.js && node --check assets/app.js && node --test
```

Expected: 통과

- [ ] **Step 5: 단계별 렌더링 눈으로 확인**

브라우저 콘솔에서 각 단계를 강제로 만들어 본다.

```js
// 콘솔에서 실행 — 18세션 완료 상태를 만든다
const d = {}; for (let i = 0; i < 18; i++) d[String(i)] = { at: Date.now(), seq: i + 1 };
localStorage.setItem('geoinhwa:v3', JSON.stringify({ v: 3, done: d, rm: {}, scaleOn: false }));
location.reload();
```

`0, 1, 7, 13, 19, 25, 31, 36`으로 바꿔가며 확인한다.

- 단계가 오를수록 실루엣이 실제로 굵어지는가
- 내부 붉은 채움이 아래에서 위로 올라가는가
- 25 이상에서 발광이 들어오는가
- 36에서 완전히 채워지고 "울트라맨 · 완전체"가 뜨는가
- 실루엣을 누르면 8단계 시트가 열리고 현재 단계가 강조되는가

확인이 끝나면 기록을 비운다.

```js
localStorage.removeItem('geoinhwa:v3'); location.reload();
```

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
기능: 거인화 실루엣으로 성취율 시각화

인라인 SVG로 8단계 실루엣을 그린다. 형태는 6세션마다 도약하고
내부 채움은 36세션 기준으로 연속해서 차오른다. 외부 이미지를
쓰지 않아 파일 크기는 늘지 않는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 주차 · 요일 화면의 진행 상태 표시

**Files:**
- Modify: `assets/app.js` (`vWeek`, `vDay`)
- Modify: `index.html` (CSS 추가)

**Interfaces:**
- Consumes: `sessionIndex`, `nextSession`, `backlog`, `isDone`, `fmtWhen` (Task 2·4·5)
- Produces: 없음 (화면 변경만)

- [ ] **Step 1: vWeek의 요일 항목을 세 상태로**

`vWeek` 안의 `DAYS.map(...)` 블록을 바꾼다.

```js
${(() => {
  const next = nextSession(state.done);
  const back = backlog(state.done);
  return DAYS.map((d, i) => {
    const rest = d === '일';
    const idx = rest ? -1 : sessionIndex(wi, d);
    const done = idx >= 0 && isDone(idx);
    const late = idx >= 0 && back.includes(idx);
    const isNext = idx >= 0 && idx === next;
    const part = PARTS[d][0];
    const mains = rest ? '휴식' : w.days[d].flat().filter(b => b.k === 'main').map(b => b.ex).join(' · ');
    const at = done ? (state.done[String(idx)].at || 0) : 0;
    return `<button class="day ${rest ? 'rest' : ''} ${done ? 'done' : ''} ${late ? 'late' : ''} ${isNext ? 'next' : ''}"
      ${rest ? 'disabled' : `data-go="day" data-w="${wi}" data-d="${d}"`} style="animation-delay:${i * 35}ms">
      <span class="day-d">${d}</span>
      <span class="day-b"><b>${esc(part)}</b><span>${esc(mains)}</span></span>
      <span class="day-s">${done ? (at ? esc(fmtWhen(at)) : '완료') : late ? '밀림' : isNext ? '다음' : ''}</span>
      <span class="chev">${rest ? '' : IC.chev}</span></button>`;
  }).join('');
})()}
```

- [ ] **Step 2: vDay에 밀림 띠와 완료 시각 추가**

`vDay`의 `const idx = sessionIndex(wi, d), done = isDone(idx);` 아래에 넣는다.

```js
const late = backlog(state.done).includes(idx);
const at = done ? (state.done[String(idx)].at || 0) : 0;
```

`${notes.map(...)}` 앞에 밀림 띠를 넣는다.

```js
${late ? '<div class="latebar">이 훈련은 밀려 있습니다. 지나쳤지만 아직 완료하지 않았습니다.</div>' : ''}
```

완료 버튼 아래에 시각을 표시한다. `<div class="donebar">` 블록을 바꾼다.

```js
<div class="donebar">
  <button class="donebtn ${done ? 'on' : ''}" data-done="${idx}">${done ? '훈련 완료됨 · 다시 누르면 해제' : '오늘 훈련 완료로 표시'}</button>
  ${at ? `<div class="doneat">${esc(fmtWhen(at))} 완료</div>` : ''}
</div>
```

- [ ] **Step 3: CSS 추가**

```css
.day-s{margin-right:6px;font-size:11px;font-weight:700;color:var(--muted);white-space:nowrap}
.day.done .day-s{color:var(--rust)}
.day.late{background:rgba(140,47,30,.07);border-color:rgba(140,47,30,.3)}
.day.late .day-s{color:#8C2F1E}
.day.next{outline:2px solid var(--rust);outline-offset:-2px}
.latebar{margin:10px 16px;padding:10px 13px;border-radius:9px;
  background:rgba(140,47,30,.1);border:1px solid rgba(140,47,30,.3);
  font-size:12.5px;font-weight:700;color:#8C2F1E}
.doneat{margin-top:7px;text-align:center;font-size:11.5px;color:var(--muted)}
```

- [ ] **Step 4: 문법 검사**

```bash
node --check assets/app.js && node --test
```

Expected: 통과

- [ ] **Step 5: 브라우저 확인**

1. 아무것도 안 한 상태에서 1주차 → 월요일에 "다음" 표시와 테두리 강조
2. 월·화 완료 → 완료 시각이 요일 줄에 뜨고, 수요일이 "다음"으로 이동
3. 3주차 목요일만 완료 → 1·2주차와 3주차 앞부분 요일이 "밀림"으로 표시되는가
4. 밀린 요일에 들어가면 상단에 밀림 띠가 뜨는가
5. 완료 해제(다시 누르기) 후 새로고침 → 해제 상태가 유지되는가

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
기능: 주차·요일 화면에 완료/밀림/다음 상태 표시

요일 항목을 세 상태로 구분하고 완료 시각을 함께 보여준다.
밀린 세션에 들어가면 상단에 안내 띠를 띄운다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 기록 백업 · 불러오기 · 초기화

6주치 기록이 브라우저 데이터 삭제 한 번에 사라지는 걸 막고, 프로그램을 두 번째 돌릴 때 리셋할 수단을 준다.

**Files:**
- Modify: `assets/logic.js`, `test/logic.test.js` (`validateBackup` 추가)
- Modify: `assets/app.js` (`vRM`, `bindRM`)
- Modify: `index.html` (CSS 추가)

**Interfaces:**
- Consumes: `TOTAL_SESSIONS` (Task 2)
- Produces: `validateBackup(obj) -> {ok: true, data: object} | {ok: false, reason: string}`

- [ ] **Step 1: 실패하는 테스트 작성**

import에 `validateBackup`을 추가하고 `test/logic.test.js` 끝에 덧붙인다.

```js
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
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
node --test
```

Expected: FAIL — `validateBackup is not a function`

- [ ] **Step 3: 구현**

`assets/logic.js` 끝에 덧붙인다.

```js
export function validateBackup(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, reason: '객체가 아닙니다' };
  if (o.v !== 3) return { ok: false, reason: `지원하지 않는 버전입니다 (v${o.v})` };
  if (!o.done || typeof o.done !== 'object' || Array.isArray(o.done)) {
    return { ok: false, reason: 'done 항목이 없거나 형태가 다릅니다' };
  }

  const done = {};
  for (const k of Object.keys(o.done)) {
    const n = Number(k);
    if (!Number.isInteger(n) || n < 0 || n >= TOTAL_SESSIONS) continue;
    const e = o.done[k] || {};
    done[String(n)] = {
      at: typeof e.at === 'number' ? e.at : null,
      seq: typeof e.seq === 'number' ? e.seq : null
    };
  }

  return {
    ok: true,
    data: {
      v: 3,
      done,
      rm: (o.rm && typeof o.rm === 'object' && !Array.isArray(o.rm)) ? Object.assign({}, o.rm) : {},
      scaleOn: !!o.scaleOn
    }
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test
```

Expected: PASS

- [ ] **Step 5: vRM에 UI 추가**

`vRM`의 마지막 `<p class="disc">…</p>` 앞에 넣는다.

```js
<div class="card"><h3>기록 관리</h3>
  <p class="hint">브라우저 데이터를 지우면 훈련 기록이 사라진다. 주기적으로 내보내 두면 복구할 수 있다.</p>
  <div class="btnrow">
    <button class="mbtn" id="expBtn">기록 내보내기</button>
    <button class="mbtn" id="impBtn">기록 불러오기</button>
  </div>
  <textarea id="bkText" class="bk" rows="4" placeholder="여기에 백업 JSON을 붙여넣고 불러오기를 누른다" spellcheck="false"></textarea>
  <div id="bkMsg" class="bkmsg"></div>
  <button class="mbtn danger" id="resetBtn">전체 초기화</button>
</div>
```

- [ ] **Step 6: bindRM에 동작 추가**

`bindRM` 함수 끝(`tg.addEventListener` 다음)에 넣는다.

```js
const ta = root.querySelector('#bkText');
const msg = root.querySelector('#bkMsg');
const say = (t, bad) => { msg.textContent = t; msg.className = 'bkmsg' + (bad ? ' bad' : ' good'); };

root.querySelector('#expBtn').addEventListener('click', () => {
  ta.value = JSON.stringify({ v: 3, done: state.done, rm: state.rm, scaleOn: state.scaleOn });
  ta.select();
  say('내보냈다. 이 텍스트를 안전한 곳에 복사해 둘 것.');
});

root.querySelector('#impBtn').addEventListener('click', () => {
  let parsed;
  try { parsed = JSON.parse(ta.value); }
  catch (e) { say('JSON을 읽을 수 없다: ' + e.message, true); return; }

  const r = validateBackup(parsed);
  if (!r.ok) { say('불러오지 못했다: ' + r.reason, true); return; }

  state.done = r.data.done;
  state.rm = Object.assign({}, RM_BASE, r.data.rm);
  state.scaleOn = r.data.scaleOn;
  store.save();
  say(`${Object.keys(r.data.done).length}개 세션을 불러왔다.`);
  replaceTo({ v: 'home' });
});

root.querySelector('#resetBtn').addEventListener('click', () => {
  if (!confirm('훈련 기록과 1RM을 전부 지운다. 되돌릴 수 없다. 진행할까?')) return;
  state.done = {};
  state.rm = Object.assign({}, RM_BASE);
  state.scaleOn = false;
  store.save();
  replaceTo({ v: 'home' });
});
```

- [ ] **Step 7: CSS 추가**

```css
.btnrow{display:flex;gap:8px;margin-top:10px}
.mbtn{flex:1;padding:11px;border:1px solid rgba(0,0,0,.18);border-radius:9px;
  background:var(--bg);font-size:13px;font-weight:700;cursor:pointer}
.mbtn.danger{width:100%;margin-top:10px;border-color:rgba(140,47,30,.4);color:#8C2F1E}
.bk{width:100%;margin-top:9px;padding:9px;border:1px solid rgba(0,0,0,.15);border-radius:8px;
  font-family:ui-monospace,monospace;font-size:11px;resize:vertical;background:var(--bg)}
.bkmsg{margin-top:7px;font-size:12px;min-height:16px}
.bkmsg.good{color:var(--rust)}
.bkmsg.bad{color:#8C2F1E;font-weight:700}
```

- [ ] **Step 8: 문법 검사와 테스트**

```bash
node --check assets/app.js && node --test
```

Expected: 통과

- [ ] **Step 9: 왕복 확인**

1. 세션 몇 개를 완료하고 1RM 값을 바꾼다
2. 1RM 화면 → 기록 내보내기 → 텍스트를 따로 복사해 둔다
3. 전체 초기화 → 홈이 `0 / 36`으로 돌아가는가
4. 복사해 둔 텍스트를 붙여넣고 불러오기 → 완료 기록과 1RM이 복원되는가
5. 아무 문자열이나 붙여넣고 불러오기 → 사유가 표시되고 기존 기록이 손상되지 않는가

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
기능: 기록 내보내기·불러오기·초기화

브라우저 데이터 삭제로 6주치 기록이 사라지는 것을 막고,
프로그램을 다시 시작할 수단을 준다. 불러오기는 스키마를
검증한 뒤에만 반영하고 실패 사유를 표시한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: 캐시 무효화 · 배포 · 실기 검증

파일이 여러 개로 나뉜 뒤 유일하게 새로 생긴 위험은 부분 배포다. `index.html`은 새 버전인데 브라우저가 `app.js`는 캐시된 옛 버전을 쓰는 상황을 막는다.

**Files:**
- Modify: `index.html` (버전 쿼리 확정)
- Modify: `assets/app.js`, `assets/data.js`, `assets/silhouette.js` (import 경로에 버전 쿼리)

**Interfaces:**
- Consumes: 앞선 모든 태스크
- Produces: `main`에 배포된 동작하는 앱

- [ ] **Step 1: 모든 모듈 경로에 버전 쿼리 부착**

`index.html`:

```html
<script type="module" src="assets/app.js?v=3"></script>
```

`assets/app.js`:

```js
import { IMG } from './images.js?v=3';
import { PARTS, WEEKS, RULES, RM_BASE, RM_LIFT, EXMETA } from './data.js?v=3';
import { sessionIndex, sessionAt, progress, nextSession, backlog, weekProgress, stageOf, lastDone, migrateV2, validateBackup } from './logic.js?v=3';
import { silhouetteSVG, stageSheetHTML } from './silhouette.js?v=3';
```

`assets/silhouette.js`:

```js
import { STAGES, stageOf, TOTAL_SESSIONS } from './logic.js?v=3';
```

브라우저는 `?v=3`이 붙은 URL을 별개 리소스로 취급하므로 옛 캐시를 쓰지 않는다. 앞으로 배포할 때마다 이 숫자를 올린다.

- [ ] **Step 2: 쿼리가 Node 테스트를 깨지 않는지 확인**

```bash
node --test && node --check assets/app.js
```

Expected: PASS. `test/logic.test.js`는 `../assets/logic.js`를 쿼리 없이 import하므로 영향받지 않는다.

- [ ] **Step 3: 전체 시나리오 최종 확인 (로컬)**

```bash
python3 -m http.server 8000
```

캐시를 완전히 비우고(개발자 도구 → Network → Disable cache 체크 후 강제 새로고침) 처음부터 확인한다.

1. 콘솔에 에러가 없다
2. 세션 완료 → 새로고침 → 유지된다
3. 건너뛰고 완료 → 홈에 밀린 훈련이 정확히 뜬다
4. 완료 수에 따라 실루엣 단계와 채움이 바뀐다
5. 주차별 달성 막대가 실제 완료 상황과 일치한다
6. 내보내기 → 초기화 → 불러오기로 기록이 복원된다
7. 운동 사진 시트, 1RM 계산기, 중량 환산 토글이 분리 전과 똑같이 동작한다

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
빌드: 모듈 경로에 버전 쿼리 부착

파일 분리로 생긴 부분 배포 위험(index.html은 새 버전인데
app.js는 캐시된 옛 버전)을 막는다. 배포마다 숫자를 올린다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: main에 병합하고 푸시**

여기서 처음으로 라이브 앱이 바뀐다. 되돌리려면 `git reset --hard v1-original` 후 강제 푸시하면 된다.

```bash
git switch main
git merge --no-ff feat/progress-tracking -m "$(cat <<'EOF'
병합: 진행 관리 · 성취율 기능

저장 버그 수정, 36세션 순번 큐 이월, 거인화 실루엣 성취율,
기록 백업·초기화를 포함한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
git push origin v1-original
```

- [ ] **Step 6: GitHub Pages 빌드 확인**

```bash
gh api repos/yohan7998/UltraMan-Plan/pages/builds/latest --jq '.status, .error.message'
```

Expected: `built`. `errored`면 메시지를 확인한다. 빌드에는 보통 1분 안팎 걸린다.

- [ ] **Step 7: 실제 배포 URL에서 검증 — 이 계획의 최종 관문**

로컬 확인만으로는 부족하다. 이번 버그는 아티팩트 샌드박스에서 `window.storage`가 정상 작동했기 때문에 발생했다. 환경이 다르면 결과가 다르다.

https://yohan7998.github.io/UltraMan-Plan/ 에서 확인한다.

1. 세션 완료 체크 → 새로고침 → 유지되는가
2. 세션 몇 개를 건너뛰고 완료 → 홈에 밀린 훈련이 정확히 뜨는가
3. 완료 수에 따라 실루엣 단계와 채움이 바뀌는가
4. 주차별 달성 막대가 실제 완료 상황과 일치하는가
5. 내보내기 → 초기화 → 불러오기로 기록이 복원되는가
6. **폰에서 홈 화면에 추가한 PWA로도 1–5가 동작하는가**

6번은 반드시 실기로 확인한다. PWA로 설치된 상태는 브라우저 탭과 저장소 동작이 다를 수 있다.

- [ ] **Step 8: 배포 확인 태그**

```bash
git tag -a v2-progress -m "진행 관리·성취율. 배포 URL에서 검증 완료." 
git push origin v2-progress
```

---

## 롤백

배포 후 문제가 발견되면:

```bash
git revert -m 1 HEAD        # 병합 커밋 되돌리기
git push origin main
```

원본으로 완전히 되돌리려면:

```bash
git reset --hard v1-original
git push --force origin main
```

기록은 `localStorage`에 있으므로 코드를 되돌려도 사라지지 않는다. 다만 `v1-original`은 저장 기능 자체가 동작하지 않는 버전이라 기록을 읽지 못한다.
