const KEY='personal-radio-schedule-v2-cloud',SETTINGS_PASSWORD_HASH='6a61eb7383e868f226d30d31c95348371760d993de5a098747a36923bdcaf25c',DAYS=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const SEED=[['Вход в лабиринт','https://www.youtube.com/watch?v=SwOWMrHAS2o'],['Ивы для альпинария','https://www.youtube.com/watch?v=CXDCBn29Yqo&t=214s'],['Почему Азовское море','https://www.youtube.com/watch?v=zV_S-Cv6U4k'],['Проксима b','https://www.youtube.com/watch?v=-GXVoE7d9FE&t=1674s'],['Короткие встречи','https://www.youtube.com/watch?v=Qaj3RRFNP5c'],['Внутренний ребёнок','https://www.youtube.com/watch?v=LSgKMqvtDjQ'],['Банки Уорхола','https://www.youtube.com/watch?v=4N3Gq1eioLI'],['Путешествие по галактике','https://www.youtube.com/watch?v=pcElsNXRZmU'],['Главная шиза русского языка','https://www.youtube.com/watch?v=RUV-d1-ocqQ&t=816s'],['Настройщик','https://www.youtube.com/watch?v=ZyqH0v7Nyz8'],['План реконструкции Москвы','https://www.youtube.com/watch?v=tT391lJV2x4'],['Придумать себя','https://www.youtube.com/watch?v=tRTA1oro0Ow'],['Собака Баскервилей','https://www.youtube.com/watch?v=FO55XSs1guE'],['Увлеченья','https://www.youtube.com/watch?v=GIHXUn7lglw'],['Из жизни отдыхающих','https://www.youtube.com/watch?v=uYw1w6OoV9k']];
const fresh=()=>({version:2,settings:{timezone:'Europe/Moscow',defaultUrl:'',defaultTitle:'',idDuration:30,idUrl:'assets/station_id_30s.mp3'},slots:{}});
const $=s=>document.querySelector(s),audio=$('#audio-player'),API=window.RADIO_API_URL||'';let state=read(),selected,player,ready=false,playing=false,last='',writeKey='',playRun=0,completedFrame='';
function read(){try{let x=JSON.parse(localStorage.getItem(KEY));if(!x||x.version!==2||!x.settings||!x.slots)return fresh();x.settings=Object.assign({},fresh().settings,x.settings);return x}catch{return fresh()}}function save(){localStorage.setItem(KEY,JSON.stringify(state));if(!API){note('Расписание сохранено только локально.',true);return}if(!writeKey){note('Введите ключ Cloudflare через настройки, затем сохраните.',true);return}fetch(API,{method:'PUT',headers:{'Content-Type':'application/json','X-Radio-Key':writeKey},body:JSON.stringify(state)}).then(function(r){if(!r.ok)throw Error();note('Расписание сохранено в Cloudflare.')}).catch(function(){note('Cloudflare не сохранил расписание: проверьте ключ.',true)})}function remote(attempt){if(!API)return;return fetch(API,{cache:'no-store'}).then(function(r){if(!r.ok)throw Error();return r.json()}).then(function(x){if(x&&x.version===2&&x.settings&&x.slots){state=x;localStorage.setItem(KEY,JSON.stringify(state));draw();tick();note('Расписание загружено.')}}).catch(function(){if(!attempt){setTimeout(function(){remote(true)},700);return}note('Не удалось загрузить расписание Cloudflare.',true)})}function note(t,b=false){let n=$('#notice');n.textContent=t;n.classList.toggle('error',b)}function k(d,h){return String(48+h)}
function now(date=new Date()){let zone=state.settings.timezone;try{new Intl.DateTimeFormat('en-US',{timeZone:zone})}catch{zone='Europe/Moscow';state.settings.timezone=zone;save();note('Часовой пояс сброшен на Europe/Moscow.',true)}let o=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(x=>x.type!='literal').map(x=>[x.type,x.value]));return{day:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(o.weekday),hour:+o.hour,min:+o.minute,sec:+o.second}}
function fallback(){return{type:'program',url:state.settings.defaultUrl,originalTitle:state.settings.defaultTitle,userTitle:'',start:0,inherited:true}}function get(d,h){return Object.assign({},state.slots[k(d,h)]||fallback())}function name(x){return x.userTitle||x.originalTitle||''}function duration(x){return Math.max(1,Math.min(300,+x.idDuration||+state.settings.idDuration||30))}
function frame(){let p=now(),x=get(p.day,p.hour),s=p.min*60+p.sec,id=duration(x);return s>=3600-id?{kind:'id',url:state.settings.idUrl,start:s-(3600-id),key:`id:${k(p.day,p.hour)}`,p}:{kind:'program',url:x.url,start:(+x.start||0)+s,key:`program:${k(p.day,p.hour)}:${x.url}`,p,x}}
function isYT(u=''){return/(youtu\.be|youtube\.com)/i.test(u)}function vid(u=''){try{let x=new URL(u);return x.searchParams.get('v')||x.pathname.split('/').filter(Boolean).pop()}catch{return''}}
function draw(){
  const time=now(), root=$('#schedule');
  root.textContent='';
  for(let hour=0;hour<24;hour++){
    const key=k(time.day,hour), program=get(time.day,hour);
    const cell=document.createElement('article');
    cell.className=hour===time.hour?'slot current':'slot';
    cell.dataset.key=key;
    cell.innerHTML=`<span class="slot-time">${String(hour).padStart(2,'0')}:00</span>
      <strong class="slot-title"></strong><span class="slot-author"></span>
      <div class="chat-area"><div class="chat-messages"></div>
      <textarea class="slot-chat" rows="2" maxlength="500" enterkeyhint="enter"
        aria-label="Комментарий. Сохраняется при выходе из поля"></textarea></div>`;
    cell.querySelector('.slot-title').textContent=name(program);
    const status=program.lockUntil>Date.now()?'● Занято':'○ Свободно';
    cell.querySelector('.slot-author').textContent=program.author?`${status} · ${program.author}`:status;
    const chat=cell.querySelector('.slot-chat'), messages=cell.querySelector('.chat-messages');
    chat.placeholder=program.author?'Написать: '+program.author:'Написать комментарий';
    cell.onclick=event=>{if(!event.target.closest('.chat-area'))edit(key)};
    let pending=Promise.resolve();
    chat.onblur=()=>{
      const draft=chat.value, message=draft.trim();
      if(!message)return;
      chat.value='';
      pending=pending.then(async()=>{
        try{
          const response=await fetch(API+'chat/'+key,{
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({text:message}),keepalive:true
          });
          if(!response.ok)throw Error();
          await loadChat(key,messages);
        }catch{
          chat.value=chat.value?draft+'\n'+chat.value:draft;
          note('Комментарий не сохранён. Вернитесь в поле и попробуйте ещё раз.',true);
        }
      });
      return pending;
    };
    root.append(cell);
    loadChat(key,messages);
  }
}
const commentMarks=['●','○','◆','◇','■','□','✦','✧','✶','✷','▲'];
function commentMark(row){
  // Keep the same mark for a saved comment in every browser.
  const seed=`${row.time}:${row.text}`;
  let hash=2166136261;
  for(let i=0;i<seed.length;i++)hash=Math.imul(hash^seed.charCodeAt(i),16777619);
  return commentMarks[(hash>>>0)%commentMarks.length];
}
async function loadChat(key,el){
  try{
    const response=await fetch(API+'chat/'+key,{cache:'no-store'});
    if(!response.ok)return;
    const rows=await response.json();
    el.textContent='';
    for(const row of rows){
      const item=document.createElement('p');
      const mark=document.createElement('span');
      mark.className='comment-mark';
      mark.setAttribute('aria-hidden','true');
      mark.textContent=commentMark(row);
      const message=document.createElement('span');
      message.textContent=row.text;
      item.append(mark,message);
      el.append(item);
    }
  }catch{}
}
let authorLabel=document.createElement('label');authorLabel.textContent='Подпись (необязательно)';let authorInput=document.createElement('input');authorInput.name='author';authorInput.maxLength=80;authorInput.placeholder='Имя или псевдоним';authorLabel.append(authorInput);$('#editor-form').insertBefore(authorLabel,$('#original-title'));
let editingRevision='';
function editorError(message=''){
  const error=$('#editor-error');
  error.textContent=message;
  error.hidden=!message;
}
let openingEditor=false;
async function edit(key){
  if(openingEditor||$('#editor').open)return;
  openingEditor=true;
  try{
    if(API){
      const response=await fetch(API,{cache:'no-store'});
      if(response.ok){
        const schedule=await response.json();
        if(schedule.version===2&&schedule.slots)state.slots=schedule.slots;
      }
    }
  }catch{
    // Open the last known entry if a fresh copy is temporarily unavailable.
  }finally{
    openingEditor=false;
  }
  selected=key;
  const x=state.slots[key]||fallback(), h=Number(key)%24, form=$('#editor-form');
  editingRevision=x.revision||'';
  $('#editor-heading').textContent=`${String(h).padStart(2,'0')}:00`;
  form.url.value=x.url||'';
  form.userTitle.value=x.userTitle||'';
  form.elements.author.value=x.author||'';
  form.start.value=x.start||0;
  $('#original-title').textContent=x.originalTitle?'Исходное: '+x.originalTitle:'';
  $('#clear-cell').hidden=!state.slots[key];
  const hint=$('#editor-hint');
  hint.hidden=!state.slots[key]||x.lockUntil>Date.now();
  hint.textContent=hint.hidden?'':'Час свободен. Чтобы занять его, сохраните новую программу.';
  editorError();
  $('#editor').showModal();
}
function visitorToken(){let token=localStorage.getItem('radio-visitor-token');if(!token){let bytes=new Uint8Array(32);crypto.getRandomValues(bytes);token=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem('radio-visitor-token',token)}return token}
let slotRequestPending=false;
async function updateSlot(method, slot){
  if(slotRequestPending)return;
  const key=selected, revision=editingRevision;
  const clear=method==='DELETE', headers={'Content-Type':'application/json'};
  slotRequestPending=true;
  editorError();
  try{
    const response=await fetch(API+'slots/'+key,{
      method,headers,body:JSON.stringify({token:visitorToken(),revision,slot})
    });
    if(response.status===403){
      const previous=state.slots[key];
      editorError(previous&&!(previous.lockUntil>Date.now())
        ? 'Очистить старую запись может её автор. Час свободен: сохраните свою программу вместо неё.'
        : 'Очистить карточку можно из браузера, в котором её сохранили.');
      return;
    }
    if(response.status===409){
      const result=await response.json().catch(()=>({}));
      editorError(result.error==='locked'
        ? 'Час пока занят другим слушателем.'
        : 'Расписание обновилось. Откройте карточку заново, чтобы увидеть актуальную запись.');
      remote();
      return;
    }
    if(!response.ok)throw Error();
    if(selected===key&&editingRevision===revision)$('#editor').close();
    await remote();
    note(clear?'Ячейка очищена.':'Программа сохранена.');
  }catch{
    editorError(clear?'Не удалось очистить ячейку.':'Не удалось сохранить программу.');
  }finally{
    slotRequestPending=false;
  }
}
$('#editor-form').onsubmit=e=>{
  if(e.submitter?.value==='cancel')return;
  e.preventDefault();
  const form=e.currentTarget, old=state.slots[selected]||{}, url=form.url.value.trim();
  const slot={
    url,userTitle:form.userTitle.value.trim(),author:form.elements.author.value.trim(),
    originalTitle:(old.url===url&&old.originalTitle)||(isYT(url)?'YouTube':'Аудио'),start:Number(form.start.value)||0
  };
  if(!slot.url){editorError('Укажите ссылку на программу.');return}
  updateSlot('PUT',slot);
};
$('#clear-cell').onclick=()=>updateSlot('DELETE');
function onProgramEnd(){let a=frame();if(!playing||a.kind!=='program'||last!==a.key||!a.x||a.x.inherited)return;completedFrame=a.key;last='';sync()}
audio.onended=onProgramEnd;
function allowPlayer(){if(!player)return;let f=player.getIframe&&player.getIframe();if(f)f.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture')}function inject(){if(document.querySelector('[data-yt]'))return;let s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.dataset.yt='';document.head.append(s)}window.onYouTubeIframeAPIReady=()=>{player=new YT.Player('youtube-player',{height:'200',width:'200',playerVars:{playsinline:1,controls:0,rel:0,enablejsapi:1,origin:location.origin},events:{onReady:()=>{allowPlayer();ready=true;last='';sync()},onStateChange:e=>{if(e.data===0)onProgramEnd()},onError:()=>note('Источник YouTube недоступен в этом браузере.',true),onAutoplayBlocked:()=>note('Браузер заблокировал запуск. Нажмите Play ещё раз.',true)}});allowPlayer()};
function sync(){if(!playing)return;let a=frame(),run=playRun;if(completedFrame&&completedFrame!==a.key)completedFrame='';if(completedFrame===a.key&&a.kind==='program')a={kind:'fallback',url:state.settings.defaultUrl,start:0,key:'fallback:'+a.key};if(a.key===last)return;last=a.key;if(!a.url){note('Не задан источник по умолчанию.',true);return}if(isYT(a.url)){audio.onloadedmetadata=null;audio.pause();inject();if(ready){player.loadVideoById({videoId:vid(a.url),startSeconds:a.start});player.playVideo()}}else{if(ready)player.stopVideo();let seek=function(){if(playing&&run===playRun)try{audio.currentTime=a.start}catch(e){}};if(audio.src!==new URL(a.url,location.href).href){audio.onloadedmetadata=seek;audio.src=a.url;audio.load();audio.play().catch(()=>note('Нажмите Play, чтобы включить звук.'))}else{seek();audio.play().catch(()=>note('Нажмите Play, чтобы включить звук.'))}}}
function tick(){let p=now(),s=p.min*60+p.sec;$('#clock').textContent=new Intl.DateTimeFormat('ru-RU',{timeZone:state.settings.timezone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date());$('#current-title').textContent=name(get(p.day,p.hour));$('#to-hour').textContent=`${String(Math.floor((3600-s)/60)).padStart(2,'0')}:${String((3600-s)%60).padStart(2,'0')}`;document.querySelectorAll('.slot.current').forEach(x=>x.classList.remove('current'));let e=$(`.slot[data-key="${k(p.day,p.hour)}"]`);if(e)e.classList.add('current');sync()}
async function settings(){let password=window.prompt('Пароль для настроек');if(password===null)return;let bytes=new TextEncoder().encode(password),digest=await crypto.subtle.digest('SHA-256',bytes),hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==SETTINGS_PASSWORD_HASH){note('Неверный пароль.',true);return}let f=$('#settings-form'),a;for(a in state.settings)if(f.elements[a])f.elements[a].value=state.settings[a];$('#settings').showModal()}$('#settings-button').onclick=settings;$('#settings-form').onsubmit=e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();let f=e.currentTarget,x=Object.fromEntries(new FormData(f));writeKey=x.writeKey||writeKey;delete x.writeKey;try{Intl.DateTimeFormat(undefined,{timeZone:x.timezone})}catch{note('Неизвестный часовой пояс.',true);return}x.idDuration=+x.idDuration;state.settings=x;save();$('#settings').close();draw();last='';sync()};$('#export-data').onclick=()=>{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='radio-schedule.json';a.click()};
function toggle(){let b=$('#play');if(playing){playing=false;playRun++;last='';audio.onloadedmetadata=null;audio.pause();audio.removeAttribute('src');audio.load();if(ready&&player)player.stopVideo();if(b)b.textContent='▶';return}playing=true;playRun++;last='';if(b)b.textContent='❚❚';sync()}let playButton=$('#play');if(playButton)playButton.onclick=toggle;document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='s'&&e.altKey){e.preventDefault();settings()}});try{draw();inject();tick();remote();setInterval(tick,500)}catch(error){console.error(error);note('Не удалось загрузить расписание. Очистите сохранённые данные сайта и обновите страницу.',true)}
