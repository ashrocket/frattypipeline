import { GameModel, DISTRICTS } from './model.js';
import { WorldRenderer } from './renderer-flat.js';
import { GameAudio } from './audio.js';
const $ = id => document.getElementById(id);
const model = new GameModel();
const audio = new GameAudio(text => { $('track-label').textContent = text; });
let world;
try { world = new WorldRenderer($('world')); }
catch (error) { $('fatal').hidden = false; $('fatal-message').textContent = 'The game graphics couldn’t start. Reload or try a current browser.'; console.error(error); }
const safeStore = { get(key) { try { return localStorage.getItem(key); } catch { return null; } }, set(key,value) { try { localStorage.setItem(key,value); } catch { /* Optional local scores. */ } } };
let best = Number(safeStore.get('fratty-pipeline:v3:best')) || 0;
$('title-best').textContent = String(best).padStart(6,'0');
let session = null, token = null, leaseUntil = 0, requestPending = false, queueTimer = null;
let operation = 0, resumePhase = 'playing', pendingEntry = false;
let lastActivity = performance.now(), previousFocus = null, dialogAction = null, secondaryAction = null;
let toastTimer, lastHud = 0, lastFrame = performance.now();
const keys = new Set(), touch = { x:0,y:0,fire:false,dash:false,jump:false };
const isTouch = () => matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0 || innerWidth <= 700 || (innerWidth <= 1000 && innerHeight <= 550);
function resize() {
  model.portrait = isTouch() && innerHeight > innerWidth;
  document.body.dataset.orientation = model.portrait ? 'portrait' : 'landscape';
  world?.resize();
  $('touch-controls').hidden = !isTouch() || !['playing','paused','transform'].includes(model.phase);
}
addEventListener('resize',resize); resize();
function showDialog({kicker='GREEK ROW',title,body,primary='CONTINUE ↗',action,secondary,back}) {
  if ($('dialog').hidden) previousFocus = document.activeElement;
  $('dialog-kicker').textContent=kicker; $('dialog-title').textContent=title; $('dialog-body').innerHTML=body;
  $('dialog-primary').textContent=primary; $('dialog-primary').disabled=!action; dialogAction=action;
  $('dialog-secondary').hidden=!secondary; $('dialog-secondary').textContent=secondary || ''; secondaryAction=back;
  $('dialog').hidden=false; ($('dialog-primary').disabled?$('dialog-secondary'):$('dialog-primary')).focus(); clearInput();
}
function hideDialog() { $('dialog').hidden=true; previousFocus?.focus?.(); }
$('dialog-primary').addEventListener('click',()=>dialogAction?.());
$('dialog-secondary').addEventListener('click',()=>secondaryAction?.());
function clearInput() { keys.clear(); touch.x=0;touch.y=0;touch.fire=false;touch.dash=false;touch.jump=false;$('stick').style.transform=''; }
function notify(text) { if (!text) return; $('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2200); }
function setGameScreen(active) { $('app').dataset.screen=active?'game':'title';$('title-screen').hidden=active;$('hud').hidden=!active;$('pause-btn').hidden=!active;resize(); }
async function request(path,data={}) {
  const requestStarted=performance.now();
  const response = await fetch(`/api/queue/${path}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(7000)});
  const result=await response.json(); if(!response.ok) {const error=new Error(result.message || result.error || 'The door is temporarily offline.'); error.status=response.status;throw error;} return {...result,requestStarted};
}
function acceptSession(result) {
  session=result;token=result.token;leaseUntil=result.requestStarted+Math.max(0,result.leaseSeconds*1000-2000);
  $('server-status').innerHTML=`<i></i>${result.activeCount} / ${result.capacity} ON THE ROW`;
  clearTimeout(queueTimer);queueTimer=setTimeout(heartbeat, result.heartbeatSeconds*1000);
}
function showQueue() {
  showDialog({kicker:'THE 20 PLAYER CLUB',title:'HOLD YOUR SPOT.',body:`<div class="queue-count">${session.position}<small>YOUR PLACE<br>IN THE QUEUE</small></div><p>Greek Row is at capacity. Keep this tab open and we’ll let you in automatically when a spot opens.</p><p><b>${session.activeCount} / 20 playing now.</b> No signup. First in, first out.</p>`,primary:'WAITING FOR YOUR TURN…',secondary:'LEAVE THE QUEUE',back:leave});
}
function enterRun() {
  if(document.hidden) {pendingEntry=true;return;}
  pendingEntry=false;hideDialog();setGameScreen(true);lastActivity=performance.now();
  if(['title','won','lost'].includes(model.phase)) {model.reset();resize();model.start();}
  else if(model.phase==='paused') {model.phase=resumePhase;$('transformation').hidden=resumePhase!=='transform';}
  resize();updateHud();
}
function suspendRun() {
  if(['playing','transform'].includes(model.phase)){resumePhase=model.phase;model.phase='paused';}
  $('transformation').hidden=true;clearInput();
}
function connectionProblem(expired=false) {
  suspendRun();
  showDialog({kicker:expired?'YOUR SPOT HAS EXPIRED':'THE DOOR LOST CONNECTION',title:expired?'BACK TO THE LINE.':'HANG TIGHT.',body:`<p>${expired?'Your run is paused. Rejoin to reserve another spot and continue.':'Your run is paused while we reconnect to the waiting room.'}</p><p>Progress stays here while this tab is open.</p>`,primary:expired?'REJOIN ↗':'RECONNECT ↗',action:join,secondary:'BACK TO TITLE',back:leave});
}
async function join() {
  if(requestPending)return;requestPending=true;const ticket=++operation;audio.start();
  showDialog({kicker:'THE 20 PLAYER CLUB',title:'CHECKING THE DOOR.',body:'<p>Reserving your spot on Greek Row…</p>',primary:'CONNECTING…',secondary:'BACK',back:leave});
  try {
    const result=await request('join',token?{token}:{});
    if(ticket!==operation){await request('leave',{token:result.token});return;}acceptSession(result);
    if(result.status==='active')enterRun();else showQueue();
  } catch(error) {
    if(ticket!==operation)return;
    showDialog({kicker:'THE DOOR IS TAKING A BREAK',title:'CAN’T CONNECT YET.',body:'<p>The waiting room is unavailable. Your run will start as soon as we can reserve a spot.</p>',primary:'TRY AGAIN ↗',action:join,secondary:'BACK',back:leave});
  } finally {if(ticket===operation)requestPending=false;}
}
async function heartbeat() {
  if(!token)return;
  if(document.hidden) {queueTimer=setTimeout(heartbeat,5000);return;}
  if(session?.status==='active'&&performance.now()-lastActivity>120000) {const releasing=release();connectionProblem(true);await releasing;return;}
  if(requestPending) {queueTimer=setTimeout(heartbeat,1000);return;}
  requestPending=true;const ticket=++operation;
  try {
    const wasWaiting=session?.status==='waiting',result=await request('heartbeat',{token});
    if(ticket!==operation){await request('leave',{token:result.token});return;}acceptSession(result);
    if(result.status==='active'&&(wasWaiting||pendingEntry))enterRun();else if(result.status==='waiting')showQueue();
  } catch(error) {
    if(ticket!==operation)return;
    if(error.status===410){token=null;session=null;}connectionProblem(error.status===410);
  } finally {if(ticket===operation)requestPending=false;}
}
async function release() {
  ++operation;requestPending=false;pendingEntry=false;const old=token;token=null;session=null;leaseUntil=0;clearTimeout(queueTimer);
  $('server-status').innerHTML='<i></i>20 PLAYER CLUB';
  if(old)try{await request('leave',{token:old});}catch{ /* Server lease expires independently. */ }
}
async function leave() {const releasing=release();model.reset();resize();setGameScreen(false);hideDialog();$('transformation').hidden=true;await releasing;}
function pause() {
  if(!['playing','transform'].includes(model.phase))return;suspendRun();
  showDialog({kicker:'TAKE A BREATHER',title:'STILL A PUNK.',body:'<p>Your run is paused. Your spot stays reserved while you’re here; inactive spots return to the queue after two minutes.</p>',primary:'BACK TO THE RIOT ↗',action:resume,secondary:'END RUN',back:leave});
}
async function resume() {
  audio.start();lastActivity=performance.now();
  if(!token || performance.now()>=leaseUntil) {connectionProblem(true);return;}
  if(requestPending)return;
  requestPending=true;const ticket=++operation;
  try { const result=await request('heartbeat',{token});if(ticket!==operation){await request('leave',{token:result.token});return;}acceptSession(result);if(result.status==='active'){hideDialog();model.phase=resumePhase;$('transformation').hidden=resumePhase!=='transform';}else showQueue(); }
  catch(error){if(ticket===operation)connectionProblem(error.status===410);}finally{if(ticket===operation)requestPending=false;}
}
function how() {
  showDialog({kicker:'A CRASH COURSE IN BAD INFLUENCE',title:'HOW TO RIOT.',body:'<div class="instructions"><div><strong>01</strong><span><b>CARVE THROUGH THE ROW.</b>Left/right rolls along the street. Up/down moves into and out of depth. Use WASD, arrows, or the thumb stick. Space ollies; Shift pushes for speed.</span></div><div><strong>02</strong><span><b>GLOWING LAWN? LIGHT IT UP.</b>Hold F / J or THROW. Bottles aim at the nearest lawn in range. Ammo refills. Clear all 12 houses to win.</span></div><div><strong>03</strong><span><b>THE MAKEOVER ISN’T THE END.</b>Rush swag and perfume clouds fill the makeover meter, adding preppy clothes. A full makeover turns you into a sorority girl. Your first two punk comebacks hit harder; the third ends the run.</span></div><div><strong>✦</strong><span><b>KEEP YOUR SCENE ALIVE.</b>Ride through a coffee stand’s pickup lane to undo some makeover. Ollie over trouble for trick points. Vinyl refills ammo; lightning gives a shield. Chain houses for up to ×8 points.</span></div></div>',primary:'I’M IN ↗',action:()=>{hideDialog();join();},secondary:'BACK',back:hideDialog});
}
$('how-btn').addEventListener('click',how);$('start-btn').addEventListener('click',join);$('pause-btn').addEventListener('click',pause);
$('sound-btn').addEventListener('click',()=>{const muted=audio.toggle();$('sound-btn').textContent=muted?'♪̸':'♫';$('sound-btn').setAttribute('aria-pressed',String(!muted));});
function updateHud() {
  $('score').textContent=String(model.score).padStart(6,'0');
  $('lives').innerHTML=Array.from({length:3},(_,i)=>`<span style="display:inline;font-size:inherit;letter-spacing:inherit" class="${i>=model.lives?'spent':''}">✦</span>`).join(' ');
  $('lives').setAttribute('aria-label',`${model.lives} punk lives`);
  $('combo').textContent=`×${model.combo}`;$('combo-fill').style.width=`${model.comboTime*10}%`;
  $('burned').textContent=model.burned;
  const district=Math.min(2,Math.floor(model.burned/4));$('district').textContent=`0${district+1} / ${DISTRICTS[district]}`;
  $('house-progress').innerHTML=model.houses.map(h=>`<i class="${h.burned?'down':''}" title="${h.name}${h.burned?' — down':''}"></i>`).join('');
  const makeover=model.player.pipeline;$('pressure-fill').style.width=`${makeover}%`;$('pressure-number').textContent=`${Math.floor(makeover)}%`;
  $('identity').textContent=makeover>=100?'SORORITY GIRL':makeover>=70?'ONE OF THE SISTERS?':makeover>=35?'THE PREPPY CREEP':model.player.level===2?'MAXIMUM PUNK':model.player.level===1?'BACK LOUDER':'PUNK, UNFILTERED';
  $('ammo').textContent=Array.from({length:5},(_,i)=>i<Math.floor(model.ammo)?'●':'○').join(' ');
  $('dash-state').textContent=model.player.jumpHeight>0.05?'AIRBORNE':model.player.dashing>0?'PUSHING':model.dashCooldown?`${model.dashCooldown.toFixed(1)}s`:'ROLLING ↗';
  const target=model.houses[model.targetId];
  $('target-name').textContent=target&&!target.burned?target.name.toUpperCase():'NEXT HOUSE AHEAD';
  $('target-health').textContent=target&&!target.burned?`${Math.ceil(target.hp)} HITS LEFT · ${isTouch()?'HOLD THROW':'HOLD F TO THROW'}`:'Keep moving. Your next target will light up.';
}
function endRun(won) {
  best=Math.max(best,model.score);safeStore.set('fratty-pipeline:v3:best',String(best));$('title-best').textContent=String(best).padStart(6,'0');
  release();$('touch-controls').hidden=true;$('pause-btn').hidden=true;
  const rank=won?(model.lives===3?'ROW LEGEND':model.player.level===2?'MAXIMUM PUNK':'SCENE HERO'):'STILL AN OUTSIDER';
  showDialog({kicker:rank,title:won?'THE ROW IS YOURS.':'NEVER GO QUIET.',body:`<p>${won?'Every chapter closed. Every lawn lit. You made it through the pipeline on your own terms.':'Three lives, a few questionable makeovers. Greek Row is still standing. Go back louder.'}</p><div class="result-stats"><div><span>SCORE</span><strong>${model.score.toLocaleString()}</strong></div><div><span>FRATS DOWN</span><strong>${model.burned} / 12</strong></div><div><span>BEST</span><strong>${best.toLocaleString()}</strong></div></div>`,primary:'ONE MORE RIOT ↗',action:join,secondary:'BACK TO TITLE',back:leave});
}
function input() {
  const sx=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0)+touch.x;
  const sy=(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0)+touch.y;
  return {x:model.portrait?-sy:sx,z:model.portrait?sx:sy,fire:keys.has('KeyF')||keys.has('KeyJ')||touch.fire,push:keys.has('ShiftLeft')||keys.has('ShiftRight')||touch.dash,jump:keys.has('Space')||touch.jump};
}
addEventListener('keydown',e=>{
  lastActivity=performance.now();
  if(!$('dialog').hidden) {
    if(e.code==='Tab') {const buttons=[...$('dialog').querySelectorAll('button:not([hidden]):not(:disabled)')];if(!buttons.length)return;const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    if(e.code==='Escape'&&model.phase==='paused')resume();return;
  }
  if(e.code==='KeyP'||e.code==='Escape'){pause();return;}
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyF','KeyJ','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code)&&model.phase==='playing'){e.preventDefault();keys.add(e.code);if(!e.repeat){if(['KeyF','KeyJ'].includes(e.code))model.throwBottle();if(e.code==='Space')model.ollie();if(['ShiftLeft','ShiftRight'].includes(e.code))model.push();}}
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('pointerdown',()=>{lastActivity=performance.now();});addEventListener('pointermove',()=>{if(touch.x||touch.y)lastActivity=performance.now();});
addEventListener('blur',()=>{clearInput();pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();clearInput();}else if(token){lastActivity=performance.now();heartbeat();}});
addEventListener('pagehide',()=>{if(token)navigator.sendBeacon('/api/queue/leave',new Blob([JSON.stringify({token})],{type:'application/json'}));});
let joyId=null,origin={x:0,y:0};
$('joystick').addEventListener('pointerdown',e=>{joyId=e.pointerId;origin={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);});
$('joystick').addEventListener('pointermove',e=>{if(e.pointerId!==joyId)return;const dx=e.clientX-origin.x,dy=e.clientY-origin.y,scale=Math.max(1,Math.hypot(dx,dy)/34);touch.x=dx/scale/34;touch.y=dy/scale/34;$('stick').style.transform=`translate(${dx/scale}px,${dy/scale}px)`;lastActivity=performance.now();});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(ev,()=>{joyId=null;touch.x=0;touch.y=0;$('stick').style.transform='';});
for(const [id,property] of [['fire-touch','fire'],['dash-touch','dash'],['ollie-touch','jump']]){
  $(id).addEventListener('pointerdown',e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touch[property]=true;if(property==='fire')model.throwBottle();else if(property==='jump')model.ollie();else model.push();});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])$(id).addEventListener(ev,()=>{touch[property]=false;});
}
function frame(now){
  const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;
  if(['playing','transform'].includes(model.phase)&&(!session||session.status!=='active'||now>=leaseUntil)){connectionProblem(true);}
  const controls=input();if(model.phase==='playing'&&(controls.x||controls.z||controls.fire||controls.push||controls.jump))lastActivity=now;
  model.tick(dt,controls);
  for(const event of model.drainEvents()){
    audio.effect(event.type);
    if(['impact','burn','pickup','smash','coffee','trick'].includes(event.type))world?.burst(event.x,event.z,['pickup','coffee','trick'].includes(event.type)?0xdcf866:0xff713c,event.type==='burn'?40:14);
    if(event.type==='transform'){$('transformation').hidden=false;$('transform-copy').textContent=model.lives>1?'The comeback is going to be louder.':'One last makeover. The scene will remember you.';}
    else if(event.type==='reborn'){$('transformation').hidden=true;notify(event.text);}
    else if(event.type==='won'||event.type==='lost'){$('transformation').hidden=true;endRun(event.type==='won');}
    else notify(event.text);
  }
  world?.render(model,dt);audio.tick();
  if(now-lastHud>90){updateHud();lastHud=now;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// A read-only diagnostic snapshot for browser verification; it cannot alter the run or admission.
Object.defineProperty(window,'frattyDebug',{value:()=>({phase:model.phase,score:model.score,lives:model.lives,burned:model.burned,pressure:model.player.pipeline,level:model.player.level,ammo:model.ammo,player:{...model.player},targetId:model.targetId,portrait:model.portrait,queue:session?{status:session.status,activeCount:session.activeCount,position:session.position}:null,render:world?.stats?.()})});
