# 회차 표기 · 계급장 실루엣 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 화면의 요일 표기를 주차+회차로 바꾸고, 졸라맨 실루엣을 조사병단 계급이 붙은 흉상 실루엣으로 교체한다.

**Architecture:** 두 변경 모두 표시 계층에만 닿는다. `PARTS`/`WEEKS.days`의 요일 키, `sessionIndex(w, day)` 시그니처, `done` 저장 스키마는 그대로다. 실루엣은 `assets/silhouette.js` 내부를 통째로 교체하되 `silhouetteSVG(count)`/`stageSheetHTML(count)` 시그니처를 유지해 호출부를 건드리지 않는다.

**Tech Stack:** 바닐라 JS(ES 모듈), 인라인 SVG, `node --test`, 헤드리스 Chrome(CDP) 검증, GitHub Pages

설계 문서:
- `docs/superpowers/specs/2026-08-12-session-numbering-design.md`
- `docs/superpowers/specs/2026-08-12-rank-silhouette-design.md`

시안(참조용, 저장소 밖): `scratchpad/mock/mock6.html`

## Global Constraints

- 작업 브랜치 `feat/rank-silhouette`. Task 5 전까지 `main`에 병합하지 않는다.
- 복구 기준점: 태그 `v2-progress`(현재 배포본), `v1-original`(최초 원본).
- 외부 라이브러리·빌드 도구·외부 이미지 파일을 추가하지 않는다. 실루엣은 인라인 SVG여야 한다.
- 빈 `catch{}`를 쓰지 않는다.
- 세션 총수 36, 성취율 = 완료 ÷ 36. 단계는 8개로 유지한다.
- `assets/logic.js`는 아무것도 import하지 않는다.
- 브라우저가 로드하는 모든 모듈 경로에 버전 쿼리를 붙인다. **이번 배포에서 `?v=3` → `?v=4`로 올린다.** `test/logic.test.js`의 `../assets/logic.js` import에는 붙이지 않는다.
- `PARTS["일"]`은 삭제하지 않는다.
- 커밋 메시지는 한국어로 쓰고 다음 줄로 끝낸다:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- 로컬 확인은 `python3 -m http.server`. ES 모듈은 `file://`에서 로드되지 않는다.

## 파일 구조

| 파일 | 이번 변경에서의 역할 |
|---|---|
| `assets/logic.js` | `STAGES` 각 항목에 `rank` 추가. 그 외 불변 |
| `assets/silhouette.js` | 렌더링 전면 교체 (흉상·머리카락·오라·불티·번개) |
| `assets/app.js` | 요일 → 회차 표기, `DAYS` 제거, 계급 배지 |
| `index.html` | `.day.rest` 제거, 계급 배지 CSS, 모듈 버전 쿼리 |
| `test/logic.test.js` | `rank` 검증 추가 |

---

### Task 1: 요일 표기를 회차로 전환

**Files:**
- Modify: `assets/app.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `TRAINING_DAYS`(길이 6, `['월','화','수','목','금','토']`), `sessionIndex`, `sessionAt`, `nextSession`, `backlog`, `isDone`, `fmtWhen`, `PARTS`, `WEEKS`, `IC`, `esc` — 모두 이미 존재
- Produces: `slotNo(day) -> 1..6` — 이 태스크 안에서만 쓴다. `silhouette.js`는 요일을 다루지 않는다

- [ ] **Step 1: `TRAINING_DAYS` import 추가하고 `DAYS` 제거**

`assets/app.js`의 `./logic.js` import 목록 맨 앞에 `TRAINING_DAYS`를 추가한다. 현재 줄을 먼저 읽고 기존 심볼을 하나도 빠뜨리지 말 것.

9행의 `const DAYS=["일","월","화","수","목","금","토"];`를 삭제한다. 이후 스텝에서 참조를 전부 걷어낸다.

- [ ] **Step 2: 회차 헬퍼 추가**

`sessionLabel` 바로 위에 넣는다.

```js
/* 요일 키를 회차 번호로. 화면에는 회차만 나온다 */
const slotNo = day => TRAINING_DAYS.indexOf(day) + 1;
```

- [ ] **Step 3: `sessionLabel` 교체**

```js
/* "3주차 3회차 · 하체후면/팔" */
function sessionLabel(i) {
  const s = sessionAt(i);
  if (!s) return '';
  return `${s.w + 1}주차 ${slotNo(s.day)}회차 · ${PARTS[s.day][0]}`;
}
```

- [ ] **Step 4: 홈 히어로 문구 교체**

`vHome` 안의 다음 줄을

```js
<p class="sub">주 6일 · 일요일 휴식. 1주차는 느린 템포로 자세를 만들고, 6주차에 최고 중량 1회로 마무리한다.</p>
```

이렇게 바꾼다.

```js
<p class="sub">한 주 6회차 · 순서대로 진행한다. 1주차는 느린 템포로 자세를 만들고, 6주차에 최고 중량 1회로 마무리한다.</p>
```

- [ ] **Step 5: 주차 화면을 6행으로**

`vWeek` 안의 `DAYS.map(...)` 블록 전체를 교체한다. 휴식 분기가 통째로 사라진다.

```js
${(() => {
  const next = nextSession(state.done);
  const back = backlog(state.done);
  return TRAINING_DAYS.map((d, i) => {
    const idx = sessionIndex(wi, d);
    const done = isDone(idx);
    const late = back.includes(idx);
    const isNext = idx === next;
    const mains = w.days[d].flat().filter(b => b.k === 'main').map(b => b.ex).join(' · ');
    const at = done ? (state.done[String(idx)].at || 0) : 0;
    return `<button class="day ${done ? 'done' : ''} ${late ? 'late' : ''} ${isNext ? 'next' : ''}"
      data-go="day" data-w="${wi}" data-d="${d}" style="animation-delay:${i * 35}ms">
      <span class="day-d">${i + 1}</span>
      <span class="day-b"><b>${esc(PARTS[d][0])}</b><span>${esc(mains)}</span></span>
      <span class="day-s">${done ? (at ? esc(fmtWhen(at)) : '완료') : late ? '밀림' : isNext ? '다음' : ''}</span>
      <span class="chev">${IC.chev}</span></button>`;
  }).join('');
})()}
```

- [ ] **Step 6: 상세 화면 헤더와 페이저**

`vDay` 안의 헤더를 바꾼다.

```js
<div><div class="top-s">WEEK ${w.n} · ${slotNo(d)}회차</div><div class="top-t">${esc(PARTS[d][0])}</div></div></div>
```

그리고 페이저의 경계 계산을 바꾼다. **일요일이 인덱스 0에 있다는 기존 전제가 사라지므로 경계값이 함께 바뀐다.**

현재 `vDay`는 296행에서 지역 변수 이름으로 `next`를 쓰고 있다(`const prev=di>1?DAYS[di-1]:null, next=di<6?DAYS[di+1]:null;`). 아래처럼 `next2`로 바꿔 의미를 분명히 한다 — 이 값은 "다음 회차 슬롯"이지 `nextSession()`의 결과가 아니다.

```js
const di = TRAINING_DAYS.indexOf(d);
const prev = di > 0 ? TRAINING_DAYS[di - 1] : null;
const next2 = di < 5 ? TRAINING_DAYS[di + 1] : null;
```

페이저 마크업:

```js
<div class="pager">
  <button ${prev ? `data-go="day" data-w="${wi}" data-d="${prev}" data-dir="l"` : 'disabled'}>← ${prev ? slotNo(prev) + '회차' : ''}</button>
  <button ${next2 ? `data-go="day" data-w="${wi}" data-d="${next2}"` : 'disabled'}>${next2 ? slotNo(next2) + '회차' : ''} →</button>
</div>
```

- [ ] **Step 7: 스와이프 경계 수정**

`bindSwipe` 안에서 같은 전제가 복제되어 있다. 함께 고친다.

```js
const i = TRAINING_DAYS.indexOf(cur.d);
if (dx < 0 && i < 5) { state.stack.pop(); push({ v: 'day', w: cur.w, d: TRAINING_DAYS[i + 1] }, 'fwd') }
if (dx > 0 && i > 0) { state.stack.pop(); push({ v: 'day', w: cur.w, d: TRAINING_DAYS[i - 1] }, 'back') }
```

- [ ] **Step 8: 죽은 CSS 제거**

`index.html`에서 `.day.rest` 규칙 2개를 삭제한다.

```css
.day.rest{opacity:.6;border-style:dashed;box-shadow:none;background:transparent}
.day.rest .day-d{background:transparent;border-color:var(--edge2);color:var(--muted)}
```

- [ ] **Step 9: 검사**

```bash
node --test && node --check assets/app.js
```

Expected: 28 pass, 문법 통과.

```bash
grep -rn "DAYS\b" assets/app.js | grep -v TRAINING_DAYS
```

Expected: 출력 없음. 남아 있으면 참조를 놓친 것이다.

```bash
grep -rn "요일" assets/app.js
```

Expected: 출력 없음.

- [ ] **Step 10: 브라우저 확인**

헤드리스 Chrome을 CDP로 띄워 `python3 -m http.server`에 붙는다. Chrome은 보통 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`에 있다.

390×844에서 확인하고 관측값을 보고한다.

1. 주차 화면 행이 **6개**이고 배지가 `1`–`6`인가. 휴식 행이 없는가
2. **1회차 상세에서 이전 버튼이 `disabled`인가**
3. **6회차 상세에서 다음 버튼이 `disabled`인가**
4. 1회차에서 오른쪽 스와이프, 6회차에서 왼쪽 스와이프가 아무 일도 하지 않는가 (`Input.dispatchTouchEvent`로 실제 스와이프를 발생시켜 `state.stack` 길이와 현재 뷰가 그대로인지 확인)
5. 페이지 전체 텍스트(`document.body.innerText`)에 `요일`이나 단독 요일 글자가 남아 있지 않은가
6. 완료 기록이 변경 전과 동일하게 읽히는가 — 세션 완료 후 리로드해 유지되는지

- [ ] **Step 11: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
변경: 화면 표기를 요일에서 주차+회차로

달력을 쓰지 않는데 "3주차 수요일"은 앱이 지키지 않는 약속이다.
일요일 휴식 행을 없애고 주차 화면을 6행으로 줄였다.
데이터 키와 저장 스키마는 그대로라 마이그레이션이 없다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: STAGES에 계급 추가

**Files:**
- Modify: `assets/logic.js`
- Modify: `test/logic.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `STAGES[i].rank: string` — Task 3·4가 쓴다

- [ ] **Step 1: 실패하는 테스트 작성**

`test/logic.test.js` 끝에 덧붙인다.

```js
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
```

- [ ] **Step 2: 실패 확인**

```bash
node --test
```

Expected: FAIL — `rank`가 `undefined`

- [ ] **Step 3: 구현**

`assets/logic.js`의 `STAGES`를 교체한다. `level`/`name`/`from`/`to`는 한 글자도 바꾸지 않고 `rank`만 추가한다.

```js
export const STAGES = [
  { level: 0, rank: '훈련병', name: '인간',              from: 0,  to: 0  },
  { level: 1, rank: '신병',   name: '각성',              from: 1,  to: 6  },
  { level: 2, rank: '정예병', name: '경화',              from: 7,  to: 12 },
  { level: 3, rank: '분대장', name: '변이',              from: 13, to: 18 },
  { level: 4, rank: '특무병', name: '거인화',            from: 19, to: 24 },
  { level: 5, rank: '반장',   name: '초대형',            from: 25, to: 30 },
  { level: 6, rank: '부단장', name: '임계',              from: 31, to: 35 },
  { level: 7, rank: '단장',   name: '울트라맨 · 완전체',  from: 36, to: 36 }
];
```

- [ ] **Step 4: 통과 확인**

```bash
node --test
```

Expected: 30 pass (기존 28 + 신규 2). 기존 단계 경계 테스트가 그대로 통과해야 한다 — 하나라도 깨지면 `from`/`to`를 건드린 것이다.

- [ ] **Step 5: 커밋**

```bash
git add assets/logic.js test/logic.test.js
git commit -m "$(cat <<'EOF'
기능: 거인화 8단계에 조사병단 계급 추가

훈련병부터 단장까지. 단계 경계와 이름은 그대로 두고 rank만 더했다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 실루엣 렌더링 교체

이 계획의 핵심이다. 전신 졸라맨을 흉상으로 바꾼다.

**Files:**
- Modify: `assets/silhouette.js` (내용 전면 교체)

**Interfaces:**
- Consumes: `STAGES`, `stageOf`, `TOTAL_SESSIONS` (logic.js)
- Produces: `silhouetteSVG(count) -> string`, `stageSheetHTML(count) -> string` — **시그니처 불변**. `app.js` 호출부는 건드리지 않는다

- [ ] **Step 1: `assets/silhouette.js` 전체 교체**

기존 `figure`/`figureMarkup`/`bulkOf`/`FINAL_BULK`는 전부 사라진다. import 줄의 버전 쿼리는 현재 파일에 있는 값을 그대로 유지한다(Task 5에서 일괄 변경).

```js
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
  return `<path d="${d}" fill="url(#au${uid})" opacity="${(0.18 + p * 0.62).toFixed(2)}"/>`;
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
    const x = 60 + Math.cos(a) * r * 0.76, y = 88 + Math.sin(a) * r;
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
```

- [ ] **Step 2: 문법과 테스트**

```bash
node --check assets/silhouette.js && node --test
```

Expected: 통과, 30 pass.

- [ ] **Step 3: 기계 검증 — 이 태스크에서 가장 중요한 스텝**

`assets/silhouette.js`는 `logic.js`만 import하므로 Node에서 직접 돌릴 수 있다. 다음을 실제로 실행하고 관측값을 보고한다.

1. **오라가 0–36 전 구간에서 단조 비감소인가.** `silhouetteSVG(c)`의 오라 `path`에서 `rx`에 해당하는 값을 직접 계산(`26 + c/36*34`)하는 대신, 출력된 `opacity` 속성값을 뽑아 `c`가 커질 때 줄지 않는지 확인한다. **단계 경계 6→7, 12→13, 18→19, 24→25, 30→31, 35→36을 반드시 포함한다.** 폐기한 공식이 정확히 여기서 깨졌다.
2. **불티 슬롯 수와 채움 수.** 0–36 전 구간에서 슬롯 총수와 채워진 수를 뽑아 표로 보고한다. 기대: 0단계 슬롯 0개, 1–5단계 6개, **6단계 5개**, 7단계 6개 전부 채움. 각 단계 첫 세션에서 1칸, 마지막 세션에서 전 칸.
3. **고유 id.** 한 프로세스에서 `silhouetteSVG(14)`를 두 번 불러 `au` 그라디언트 id가 서로 다른지, 각 출력 안에서 `<radialGradient id="X">`와 `fill="url(#X)"`가 일치하는지.
4. **well-formed XML.** 0–36 전부를 `python3 -c "import xml.dom.minidom,sys; xml.dom.minidom.parseString(sys.stdin.read())"`에 통과시킨다.
5. `stageSheetHTML`을 0–36 전 구간에서 호출해 `.sg on`이 정확히 하나인지, `다음 계급까지 N회차`가 경계에서 맞는지, 36에서 `완주`인지.

- [ ] **Step 4: 커밋**

```bash
git add assets/silhouette.js
git commit -m "$(cat <<'EOF'
변경: 실루엣을 전신에서 흉상으로 교체

팔다리를 선으로 그리는 한 어떤 파라미터로도 졸라맨을 벗어날 수
없어 상반신만 남겼다. 머리카락 덩어리와 오라가 표현을 전담한다.
진행률은 오라 크기(단조)와 불티 개수(한 회차마다 +1)로 나눴다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 홈 계급 배지와 시트 스타일

**Files:**
- Modify: `assets/app.js` (`vHome`의 상태 카드)
- Modify: `index.html` (CSS)

**Interfaces:**
- Consumes: `stageOf(count).rank` (Task 2), `silhouetteSVG` (Task 3)
- Produces: 없음

- [ ] **Step 1: 상태 카드에 계급 표시**

`vHome`의 다음 줄을

```js
<div class="st-name"><b>${st.level}단계</b><span>${esc(st.name)}</span></div>
```

이렇게 바꾼다. 계급이 주가 되고 단계 번호는 배지로, 단계명은 아래 작은 줄로 내린다.

```js
<div class="st-name"><b>${esc(st.rank)}</b><i>${st.level}단계</i></div>
<div class="st-sub">${esc(st.name)}</div>
```

- [ ] **Step 2: CSS 교체와 추가**

`index.html`의 기존 `.st-name` 규칙 3개를 아래로 바꾼다.

```css
.st-name{margin-top:10px;display:flex;gap:7px;justify-content:center;align-items:center}
.st-name b{font-size:20px;font-weight:900;letter-spacing:-.02em}
.st-name i{font-style:normal;font-size:10.5px;font-weight:700;color:var(--rust);
  border:1px solid var(--rust);border-radius:4px;padding:1px 5px}
.st-sub{margin-top:3px;font-size:11.5px;color:var(--muted)}
```

그리고 시트의 단계 목록에 계급명 옆 단계명 칸이 생겼으므로 규칙을 추가한다.

```css
.sg-n{font-size:11px;color:var(--muted)}
```

기존 `.sg b{flex:1;font-weight:700}`을 `.sg b{font-weight:700}`으로 바꾸고, 대신 `.sg-n`이 남는 폭을 먹도록 한다.

```css
.sg b{font-weight:700}
.sg-n{flex:1;text-align:left;padding-left:6px;font-size:11px;color:var(--muted)}
```

- [ ] **Step 3: 검사**

```bash
node --check assets/app.js && node --test
```

Expected: 통과, 30 pass.

방출되는 모든 클래스에 규칙이 있는지 확인한다.

```bash
for c in st-name st-sub sg-l sg-n sg-r; do printf "%-8s %s\n" "$c" "$(grep -c "\.$c" index.html)"; done
```

Expected: 전부 1 이상.

- [ ] **Step 4: 브라우저 확인**

헤드리스 Chrome으로 390×844에서 확인하고 관측값을 보고한다.

1. 홈 상태 카드에 `분대장` + `3단계` 배지 + `변이`가 나오는가 (localStorage에 13세션 완료를 심고 리로드)
2. 실루엣이 시안(`scratchpad/mock/mock6.html`)과 같은 형태인가 — 머리카락이 뻗치고 오라가 뒤에 깔리는가
3. 오라가 크림색 카드 배경(`--bg2`)에서 보이는가. 뿌옇게 묻히면 `aura()`의 opacity 계수를 올리고 그 사실을 보고한다
4. 실루엣을 눌러 시트가 열리고 8단계가 계급명과 함께 나오는가, 현재 계급이 강조되는가
5. 0 / 13 / 25 / 36에서 각각 스크린샷을 찍어 스크래치패드에 저장하고 경로를 보고한다
6. 같은 단계 안에서 13 → 14 → 15로 올릴 때 불티가 하나씩 늘어나는 것이 눈에 보이는가

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
기능: 홈 상태 카드에 조사병단 계급 표시

계급을 주 문구로 올리고 단계 번호는 배지로, 단계명은 아래로 내렸다.
단계 시트에도 계급명을 함께 보여준다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 버전 쿼리 상향 · 배포

**Files:**
- Modify: `index.html`, `assets/app.js`, `assets/silhouette.js` (버전 쿼리)

**Interfaces:**
- Consumes: Task 1–4
- Produces: 배포된 앱

- [ ] **Step 1: 모듈 경로 버전 쿼리를 `?v=4`로**

`index.html`의 script 태그, `assets/app.js`의 import 4개, `assets/silhouette.js`의 import 1개를 전부 `?v=4`로 바꾼다.

`test/logic.test.js`의 `../assets/logic.js`는 **쿼리 없이 그대로 둔다.**

이번 배포는 `app.js`와 `silhouette.js`가 함께 바뀌므로, 캐시된 옛 `silhouette.js`가 새 `app.js`와 짝지어지면 실루엣만 예전 졸라맨으로 뜬다. 버전을 올리지 않으면 실제로 발생한다.

- [ ] **Step 2: 확인**

```bash
node --test && node --check assets/app.js assets/silhouette.js
grep -rn "\.js?v=" index.html assets/*.js
grep -n "assets/logic.js" test/logic.test.js
```

Expected: 30 pass. 브라우저가 읽는 경로는 전부 `?v=4`, 테스트 import는 쿼리 없음.

- [ ] **Step 3: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
빌드: 모듈 버전 쿼리를 v4로 상향

app.js와 silhouette.js가 함께 바뀌어, 캐시된 옛 silhouette.js가
새 app.js와 짝지어지면 실루엣만 이전 버전으로 뜬다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: 사람 확인 게이트**

여기서 멈춘다. `main` 병합은 사람이 브라우저에서 실루엣과 회차 표기를 직접 보고 승인한 뒤에 한다. **서브에이전트는 이 스텝 이후를 수행하지 않는다.**

- [ ] **Step 5: 병합과 배포** (사람 승인 후에만)

```bash
git switch main
git merge --no-ff feat/rank-silhouette -m "병합: 회차 표기 · 계급장 실루엣"
git push origin main
```

- [ ] **Step 6: Pages 빌드 확인**

```bash
gh api repos/yohan7998/UltraMan-Plan/pages/builds/latest --jq '.status, .error.message'
```

Expected: `built`

- [ ] **Step 7: 배포 URL 검증**

https://yohan7998.github.io/UltraMan-Plan/ 에서 헤드리스 Chrome으로 확인한다.

1. 콘솔 에러 0건
2. 주차 화면 6행, 배지 `1`–`6`, 휴식 행 없음
3. 홈에 계급이 표시되고 실루엣이 새 형태인가
4. 1회차 이전 버튼·6회차 다음 버튼이 비활성인가
5. 완료 → 리로드 → 유지되는가
6. `?v=4`가 실제로 적용되어 새 `silhouette.js`가 로드되는가

- [ ] **Step 8: 태그**

```bash
git tag -a v3-rank -m "회차 표기 · 계급장 실루엣. 배포 URL 검증 완료."
git push origin v3-rank
```

---

## 롤백

```bash
git reset --hard v2-progress && git push --force origin main
```

훈련 기록은 `localStorage`에 있고 이번 변경은 저장 스키마를 건드리지 않으므로, 코드를 되돌려도 기록은 그대로 읽힌다.
