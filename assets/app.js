import { IMG } from './images.js';
import { PARTS, WEEKS, RULES, RM_BASE, RM_LIFT, EXMETA } from './data.js';
import {
  sessionIndex, sessionAt, progress, nextSession, backlog,
  weekProgress, stageOf, lastDone, migrateV2
} from './logic.js';

const DAYS=["일","월","화","수","목","금","토"];
const state={stack:[{v:"home"}],lastWeek:0,done:{},rm:Object.assign({},RM_BASE),scaleOn:false};

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

const stack=document.getElementById('stack');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const floor25=v=>Math.max(2.5,Math.floor(v/2.5)*2.5);
const fmt=v=>(Math.round(v*10)/10).toString();
const photo=(n,i)=>(IMG[n]&&IMG[n][i])||'';
function tempoOf(tag){switch(tag){
  case '5T2P':return{txt:'내릴 때 5초에 걸쳐, 맨 아래에서 2초 정지 후 밀어올린다.'};
  case '3T1P':return{txt:'내릴 때 3초에 걸쳐, 맨 아래에서 1초 정지 후 밀어올린다.'};
  case 'P':return{txt:'내린 뒤 1초 미만으로 짧게 멈췄다가 밀어올린다.'};
  case 'TnG':return{txt:'터치 앤 고 — 찍고 지체 없이 바로 밀어올린다.'};
  default:return{txt:'반동 없이 통제된 속도로 올리고 내린다.'};}}
function scaled(exName,w){
  if(!state.scaleOn) return w;
  const lift=RM_LIFT[exName]; if(!lift) return w;
  const ratio=state.rm[lift]/RM_BASE[lift];
  if(!isFinite(ratio)||ratio<=0||ratio===1) return w;
  const num=parseFloat(w); if(isNaN(num)) return w;
  return fmt(floor25(num*ratio));
}
const IC={
 arrow:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
 chev:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
 doc:'<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>',
 gauge:'<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 12l4-3"/></svg>',
 home:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
 cal:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
 play:'<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
};

function vHome(){
  const pct=[62,68,75,81,88,94];
  return `
  <div class="top"><div><div class="top-s">SURVEY CORPS · 105</div></div></div>
  <div class="hero">
    <div class="stamp">6주 블록<b>선형 주기화</b></div>
    <div class="eyebrow">TRAINING ORDER</div>
    <h1>거인화<br><em>프로그램</em></h1>
    <p class="sub">주 6일 · 일요일 휴식. 1주차는 느린 템포로 자세를 만들고, 6주차에 최고 중량 1회로 마무리한다.</p>
  </div>
  <div class="ladder">${pct.map((p,i)=>`<i style="height:${p}%;animation-delay:${i*55}ms"><b>${i+1}주</b></i>`).join('')}</div>
  <div class="slab"><h2>주차 선택</h2><span>6 WEEKS</span></div>
  <div class="weeks">
    ${WEEKS.map((w,i)=>`
      <button class="wk ${w.n===6?'peak':''}" data-go="week" data-w="${i}" style="animation-delay:${i*40}ms">
        <span class="wk-n">${w.n}<small>주차</small></span>
        <span class="wk-b"><b>${esc(w.focus)}</b><span>${w.term.map(t=>t[0]+' · '+t[1]).join(' / ')}</span></span>
        <span class="tag">${w.term.map(t=>t[0]).join('+')}</span>
      </button>`).join('')}
  </div>
  <div class="slab"><h2>훈련 전 확인</h2></div>
  <div class="tiles">
    <button class="tile" data-go="rules"><span class="ic">${IC.doc}</span><b>훈련 수칙</b><span>13개 항목 · 전원 필독</span></button>
    <button class="tile" data-go="rm"><span class="ic">${IC.gauge}</span><b>1RM 기준</b><span>계산기 · 퍼센트 표</span></button>
  </div>`;
}
function vWeek(wi){
  const w=WEEKS[wi];
  return `
  <div class="top"><button class="back" data-back>${IC.arrow}</button>
    <div><div class="top-s">WEEK ${w.n}</div><div class="top-t">${esc(w.focus)}</div></div></div>
  <div class="hero" style="padding:18px 20px 14px">
    <div class="eyebrow">${w.n}주차 계획</div>
  </div>
  <div class="termbar"><b>용어설명</b>
    ${w.term.map(t=>`<p><b>${t[0]}</b> : ${esc(t[1])}</p>`).join('')}</div>
  <div class="days">
    ${DAYS.map((d,i)=>{
      const rest = d === '일';
      const idx = rest ? -1 : sessionIndex(wi, d);
      const done = idx >= 0 && isDone(idx);
      const part=PARTS[d][0];
      const mains=rest?'휴식':w.days[d].flat().filter(b=>b.k==='main').map(b=>b.ex).join(' · ');
      return `<button class="day ${rest?'rest':''} ${done?'done':''}" ${rest?'disabled':`data-go="day" data-w="${wi}" data-d="${d}"`} style="animation-delay:${i*35}ms">
        <span class="day-d">${d}</span>
        <span class="day-b"><b>${esc(part)}</b><span>${esc(mains)}</span></span>
        <span class="chev">${rest?'':IC.chev}</span></button>`;
    }).join('')}
  </div>`;
}
function setRow(no,s,exName){
  const w=scaled(exName,s.w), ch=state.scaleOn&&w!==s.w;
  return `<div class="set"><span class="no">${no}</span>
    <span class="wt" ${ch?'style="color:var(--rust)"':''}>${esc(w)}<u>kg ×</u>${esc(s.r)}</span>
    ${s.t?`<span class="tp">${s.t}</span>`:''}</div>`;
}
function blockHTML(b){
  if(b.k==='pick'){
    return `<div class="blk">
      <div class="blk-t"><div class="nm"><span class="rl">${esc(b.role)}</span><b>다음 중 택 1</b></div></div>
      <div class="spec"><span class="q">${esc(b.spec)}</span><span class="lbl">세트 × 횟수</span></div>
      <div class="opts">${b.opts.map(o=>`<button class="opt" data-ex="${esc(o)}"><img src="${photo(o,0)}" alt="${esc(o)}" loading="lazy">${esc(o)}</button>`).join('')}</div>
      <p class="pick-note">${b.role.indexOf('보조운동 B')===0?'횟수 범위 안에서 자극과 펌핑 위주. 쉬는시간 자유.':'횟수 범위 안에서 실시.'}</p>
    </div>`;
  }
  const isMain=b.k==='main';
  return `<div class="blk ${isMain?'main':''}">
    <div class="blk-t">
      <button class="thumb" data-ex="${esc(b.ex)}" data-tempo="${(b.sets[0]&&b.sets[0].t)||''}"><img src="${photo(b.ex,0)}" alt="${esc(b.ex)}" loading="lazy"></button>
      <div class="nm"><span class="rl">${esc(b.role)}</span><b>${esc(b.ex)}</b></div>
    </div>
    <div class="sets">${b.sets.map((s,i)=>setRow('SET '+(i+1),s,b.ex)).join('')}</div>
  </div>`;
}
function vDay(wi,d){
  const w=WEEKS[wi], groups=w.days[d], names=PARTS[d][1];
  const idx = sessionIndex(wi, d), done = isDone(idx);
  const di=DAYS.indexOf(d);
  const prev=di>1?DAYS[di-1]:null, next=di<6?DAYS[di+1]:null;
  const notes=(w.notes&&w.notes[d])||[];
  return `
  <div class="top"><button class="back" data-back>${IC.arrow}</button>
    <div><div class="top-s">WEEK ${w.n} · ${d}요일</div><div class="top-t">${esc(PARTS[d][0])}</div></div></div>
  <div class="dayhead">
    <div class="k">${w.term.map(t=>t[0]).join(' / ')}</div>
    <h2>${esc(PARTS[d][0])}</h2>
    <div class="m">메인 3분 이상 휴식 · 보조A 2분 이상 휴식</div>
  </div>
  ${notes.map(n=>`<div class="note">${esc(n)}</div>`).join('')}
  ${groups.map((g,gi)=>`<div class="grouphead">${esc(names[gi]||'')}</div>${g.map(b=>blockHTML(b)).join('')}`).join('')}
  <div class="donebar"><button class="donebtn ${done?'on':''}" data-done="${idx}">${done?'훈련 완료됨 · 다시 누르면 해제':'오늘 훈련 완료로 표시'}</button></div>
  <div class="pager">
    <button ${prev?`data-go="day" data-w="${wi}" data-d="${prev}" data-dir="l"`:'disabled'}>← ${prev||''}요일</button>
    <button ${next?`data-go="day" data-w="${wi}" data-d="${next}"`:'disabled'}>${next||''}요일 →</button>
  </div>`;
}
function vRules(){
  return `<div class="top"><button class="back" data-back>${IC.arrow}</button>
    <div><div class="top-s">NOTICE</div><div class="top-t">훈련생 전원 주목</div></div></div>
  <div class="hero" style="padding-bottom:16px"><div class="eyebrow">주의사항</div>
    <p class="sub" style="margin-top:12px">시트에 적힌 13개 항목이다. 중량보다 이쪽이 먼저다.</p></div>
  ${RULES.map((r,i)=>`<div class="rule" style="animation-delay:${i*25}ms"><span class="n">${i+1}</span>
     <p>${esc(r[0])}${r[1]?`<span class="sub">(${esc(r[1])})</span>`:''}</p></div>`).join('')}`;
}
function vRM(){
  const lifts=["스쿼트","벤치프레스","데드리프트","오버헤드프레스"];
  const pcts=[0.5,0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95];
  return `<div class="top"><button class="back" data-back>${IC.arrow}</button>
    <div><div class="top-s">1RM</div><div class="top-t">기준 중량</div></div></div>
  <div class="hero" style="padding-bottom:12px"><div class="eyebrow">1RM 입력</div>
    <p class="sub" style="margin-top:12px">프로그램 시작 전에 측정한다. 단 1kg라도 초과 입력하지 말 것.</p></div>
  <div class="card"><h3>1RM 계산기</h3>
    <p class="hint">든 중량과 횟수를 넣으면 예상 1RM이 나온다 (Epley 방식, 소수점 버림)</p>
    <div class="frow">
      <div class="f"><label>중량 KG</label><input id="calcW" type="number" inputmode="decimal" value="80"></div>
      <div class="f"><label>REPS</label><input id="calcR" type="number" inputmode="numeric" value="2"></div></div>
    <div class="out"><span>예상 1RM</span><b id="calcOut">85</b><span>kg</span></div></div>
  <div class="card"><div class="sw">
      <div><div class="t">이 1RM으로 중량 환산해서 보기</div>
      <div class="d">기본값은 시트 원본 중량 그대로. 켜면 원본 1RM(스쿼트·벤치·데드 80 / OHP 40) 대비 비례 환산해 표시한다.</div></div>
      <button class="toggle ${state.scaleOn?'on':''}" id="scaleTg" aria-label="중량 환산"></button></div></div>
  ${lifts.map(l=>`<div class="card"><h3>${l}</h3>
    <div class="frow"><div class="f"><label>1RM 입력</label>
      <input class="rmIn" data-lift="${l}" type="number" inputmode="decimal" value="${state.rm[l]}"></div></div>
    <div class="pcts" data-pcts="${l}">
      ${pcts.map(p=>`<div class="pct"><i>${Math.round(p*100)}%</i><b>${fmt(floor25(state.rm[l]*p))}</b></div>`).join('')}
    </div></div>`).join('')}
  <p class="disc" style="padding:0 16px 8px">환산값은 참고용 비례 계산이다. 시트의 세부 수식(보조 종목 −5kg/−10kg 등)과 어긋날 수 있으니, 애매하면 수칙 11번대로 낮은 쪽을 택한다.</p>`;
}

const NAV=[["home","홈",IC.home],["week","주차",IC.cal],["rules","수칙",IC.doc],["rm","1RM",IC.gauge]];
function renderNav(){
  const cur=state.stack[state.stack.length-1].v;
  document.getElementById('nav').innerHTML=NAV.map(n=>
    `<button data-nav="${n[0]}" class="${cur===n[0]||(n[0]==='week'&&cur==='day')?'on':''}">${n[2]}<b>${n[1]}</b></button>`).join('');
}
function html(){
  const v=state.stack[state.stack.length-1];
  if(v.v==='home')return vHome();
  if(v.v==='week')return vWeek(v.w);
  if(v.v==='day')return vDay(v.w,v.d);
  if(v.v==='rules')return vRules();
  if(v.v==='rm')return vRM();
  return '';
}
let busy=false;
function paint(dir){
  const old=stack.querySelector('.view');
  const el=document.createElement('div');
  el.className='view '+(dir==='back'?'enter-l':dir==='none'?'':'enter-r');
  el.innerHTML=html();
  stack.appendChild(el);
  if(old){old.className='view '+(dir==='back'?'exit-r':'exit-l');busy=true;setTimeout(()=>{old.remove();busy=false},300);}
  renderNav();
  if(state.stack[state.stack.length-1].v==='rm') bindRM(el);
  bindSwipe(el);
}
function push(v,dir){state.stack.push(v);paint(dir||'fwd')}
function replaceTo(v){state.stack=[v];paint('none')}
function back(){if(state.stack.length>1){state.stack.pop();paint('back')}}

document.addEventListener('click',e=>{
  if(e.target.closest('[data-back]')){back();return}
  const nav=e.target.closest('[data-nav]');
  if(nav){const v=nav.dataset.nav;
    if(v==='home')replaceTo({v:'home'});
    else if(v==='week'){state.stack=[{v:'home'},{v:'week',w:state.lastWeek}];paint('none')}
    else {state.stack=[{v:'home'},{v:v}];paint('none')}
    return;}
  const th=e.target.closest('[data-ex]');
  if(th){openSheet(th.dataset.ex,th.dataset.tempo||'');return}
  const dn=e.target.closest('[data-done]');
  if(dn){
    const on=toggleDone(Number(dn.dataset.done));
    dn.classList.toggle('on',on);
    dn.textContent=on?'훈련 완료됨 · 다시 누르면 해제':'오늘 훈련 완료로 표시';
    return;}
  const g=e.target.closest('[data-go]');
  if(g&&!busy){const v=g.dataset.go;
    if(v==='week'){state.lastWeek=+g.dataset.w;push({v:'week',w:+g.dataset.w})}
    else if(v==='day'){const cur=state.stack[state.stack.length-1];
      if(cur.v==='day'){state.stack.pop();push({v:'day',w:+g.dataset.w,d:g.dataset.d},g.dataset.dir==='l'?'back':'fwd')}
      else push({v:'day',w:+g.dataset.w,d:g.dataset.d});}
    else push({v:v});}
});
function bindSwipe(el){
  let x0=null,y0=null;
  el.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY},{passive:true});
  el.addEventListener('touchend',e=>{
    if(x0===null)return;
    const dx=e.changedTouches[0].clientX-x0, dy=e.changedTouches[0].clientY-y0; x0=null;
    if(Math.abs(dx)<62||Math.abs(dy)>50)return;
    const cur=state.stack[state.stack.length-1];
    if(cur.v!=='day')return;
    const i=DAYS.indexOf(cur.d);
    if(dx<0&&i<6){state.stack.pop();push({v:'day',w:cur.w,d:DAYS[i+1]},'fwd')}
    if(dx>0&&i>1){state.stack.pop();push({v:'day',w:cur.w,d:DAYS[i-1]},'back')}
  },{passive:true});
}
function bindRM(root){
  const cw=root.querySelector('#calcW'),cr=root.querySelector('#calcR'),co=root.querySelector('#calcOut');
  const calc=()=>{const w=parseFloat(cw.value)||0,r=parseFloat(cr.value)||0;co.textContent=Math.floor(w*(1+r/30))||0};
  cw.addEventListener('input',calc);cr.addEventListener('input',calc);calc();
  root.querySelectorAll('.rmIn').forEach(inp=>{
    inp.addEventListener('input',()=>{
      const l=inp.dataset.lift,v=parseFloat(inp.value)||0;
      state.rm[l]=v;store.save();
      const box=root.querySelector(`[data-pcts="${l}"]`);
      [...box.children].forEach((c,i)=>{c.querySelector('b').textContent=fmt(floor25(v*(0.5+i*0.05)))});
    });
  });
  const tg=root.querySelector('#scaleTg');
  tg.addEventListener('click',()=>{state.scaleOn=!state.scaleOn;tg.classList.toggle('on',state.scaleOn);store.save()});
}

const sheet=document.getElementById('sheet'),sheetIn=document.getElementById('sheetIn');
function openSheet(name,tempoTag){
  const meta=EXMETA[name]; if(!meta) return;
  const tag=(tempoTag||'').replace(/[()]/g,'');
  const T=tempoOf(tag);
  sheetIn.innerHTML=
    '<div class="grab"></div><div class="role">FORM PHOTO</div><h3>'+esc(name)+'</h3>'
   +'<div class="strip">'
   +'<figure class="fr"><div class="fr-i"><img src="'+photo(name,0)+'" alt="'+esc(name)+' 시작 자세"></div>'
   +'<figcaption><b>시작 자세</b><span>여기서 정지 상태로 출발</span></figcaption></figure>'
   +'<figure class="fr"><div class="fr-i"><img src="'+photo(name,1)+'" alt="'+esc(name)+' 동작 지점"></div>'
   +'<figcaption><b>동작 지점</b><span>여기까지 갔다가 되돌아온다</span></figcaption></figure>'
   +'</div>'
   +'<div class="tband"><b>'+(tag||'템포')+'</b><span>'+T.txt+'</span></div>'
   +'<ul class="cues">'+meta.cue.map(c=>'<li>'+esc(c)+'</li>').join('')+'</ul>'
   +(meta.sub?'<p class="subnote">'+esc(meta.sub)+'</p>':'')
   +'<a class="ytb" href="https://www.youtube.com/results?search_query='+encodeURIComponent(name+' 자세')+'" target="_blank" rel="noopener">'+IC.play+'유튜브에서 '+esc(name)+' 영상 보기</a>'
   +'<p class="disc">사진은 동작의 시작과 끝 지점을 보여주는 참고용이다. 수칙 6번대로 실제 자세는 측면에서 직접 촬영해 확인할 것.</p>';
  sheet.classList.add('open');
  const figs=sheetIn.querySelectorAll('.fr-i');
  figs.forEach((f,i)=>{const s=document.createElement('span');s.className='fr-n';s.textContent=(i+1);f.appendChild(s)});
}
function closeSheet(){sheet.classList.remove('open')}
sheet.addEventListener('click',e=>{if(e.target===sheet||e.target.classList.contains('grab'))closeSheet()});

store.load(); paint('none');

