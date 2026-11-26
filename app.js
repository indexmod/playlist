const KEY='personal-radio-schedule-v2-cloud',SETTINGS_PASSWORD_HASH='6a61eb7383e868f226d30d31c95348371760d993de5a098747a36923bdcaf25c',DAYS=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const SEED=[['Вход в лабиринт','https://www.youtube.com/watch?v=SwOWMrHAS2o'],['Ивы для альпинария','https://www.youtube.com/watch?v=CXDCBn29Yqo&t=214s'],['Почему Азовское море','https://www.youtube.com/watch?v=zV_S-Cv6U4k'],['Проксима b','https://www.youtube.com/watch?v=-GXVoE7d9FE&t=1674s'],['Короткие встречи','https://www.youtube.com/watch?v=Qaj3RRFNP5c'],['Внутренний ребёнок','https://www.youtube.com/watch?v=LSgKMqvtDjQ'],['Банки Уорхола','https://www.youtube.com/watch?v=4N3Gq1eioLI'],['Путешествие по галактике','https://www.youtube.com/watch?v=pcElsNXRZmU'],['Главная шиза русского языка','https://www.youtube.com/watch?v=RUV-d1-ocqQ&t=816s'],['Настройщик','https://www.youtube.com/watch?v=ZyqH0v7Nyz8'],['План реконструкции Москвы','https://www.youtube.com/watch?v=tT391lJV2x4'],['Придумать себя','https://www.youtube.com/watch?v=tRTA1oro0Ow'],['Собака Баскервилей','https://www.youtube.com/watch?v=FO55XSs1guE'],['Увлеченья','https://www.youtube.com/watch?v=GIHXUn7lglw'],['Из жизни отдыхающих','https://www.youtube.com/watch?v=uYw1w6OoV9k']];
const fresh=()=>({version:2,settings:{timezone:'Europe/Moscow',defaultUrl:'',defaultTitle:'',idDuration:30,idUrl:'assets/station_id_30s.mp3'},slots:{}});
const $=s=>document.querySelector(s),audio=$('#audio-player'),API=window.RADIO_API_URL||'';let state=read(),selected,player,ready=false,playing=false,last='',writeKey='',playRun=0,completedFrame='';
function read(){try{let x=JSON.parse(localStorage.getItem(KEY));if(!x||x.version!==2||!x.settings||!x.slots)return fresh();x.settings=Object.assign({},fresh().settings,x.settings);return x}catch{return fresh()}}
async function saveSettings(settings){
  if(!writeKey){note('Введите ключ Cloudflare, чтобы сохранить общие настройки.',true);return false}
  try{
    const response=await fetch(API,{
      method:'PUT',headers:{'Content-Type':'application/json','X-Radio-Key':writeKey},
      body:JSON.stringify({version:2,settings,slots:{}})
    });
    if(!response.ok)throw Error();
    await remote(true);
    note('Настройки сохранены.');
    return true;
  }catch{
    note('Не удалось сохранить настройки. Проверьте ключ Cloudflare.',true);
    return false;
  }
}
let refreshing, refreshFailed=false;
function remote(force=false){
  if(!API)return;
  if(refreshing&&!force)return refreshing;
  const request=(async()=>{
    try{
      let response=await fetch(API+'live',{cache:'no-store'});
      let snapshot;
      if(response.status===404){
        response=await fetch(API,{cache:'no-store'});
        if(response.ok)snapshot={schedule:await response.json()};
      }else if(response.ok){
        snapshot=await response.json();
      }
      if(snapshot?.schedule?.version!==2||!snapshot.schedule.slots||!snapshot.schedule.settings)throw Error();
      if(refreshing!==request)return;
      state=snapshot.schedule;
      try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}
      updateSchedule(snapshot.chats);
      tick();
      if(refreshFailed&&$('#notice').textContent==='Не удалось обновить расписание.')note('');
      refreshFailed=false;
    }catch{
      if(refreshing===request&&!refreshFailed){
        refreshFailed=true;
        note('Не удалось обновить расписание.',true);
      }
    }finally{
      if(refreshing===request)refreshing=null;
    }
  })();
  refreshing=request;
  return request;
}
function note(t,b=false){let n=$('#notice');n.textContent=t;n.classList.toggle('error',b)}function k(d,h){return String(48+h)}
function now(date=new Date()){let zone=state.settings.timezone;try{new Intl.DateTimeFormat('en-US',{timeZone:zone})}catch{zone='Europe/Moscow';state.settings.timezone=zone}let o=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(x=>x.type!='literal').map(x=>[x.type,x.value]));return{day:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(o.weekday),hour:+o.hour,min:+o.minute,sec:+o.second}}
function fallback(){return{type:'program',url:state.settings.defaultUrl,originalTitle:state.settings.defaultTitle,userTitle:'',start:0,inherited:true}}function get(d,h){const slot=state.slots[k(d,h)],base=fallback();if(!slot)return base;if(slot.url)return {...slot};return {...slot,url:base.url,start:0,originalTitle:slot.originalTitle||base.originalTitle,inherited:true}}function name(x){return x.userTitle||x.originalTitle||''}function duration(x){return Math.max(1,Math.min(300,+x.idDuration||+state.settings.idDuration||30))}
function frame(){let p=now(),x=get(p.day,p.hour),s=p.min*60+p.sec,id=duration(x);return s>=3600-id?{kind:'id',url:state.settings.idUrl,start:s-(3600-id),key:`id:${k(p.day,p.hour)}`,p}:{kind:'program',url:x.url,start:(+x.start||0)+s,key:`program:${k(p.day,p.hour)}:${x.url}`,p,x}}
function isYT(u=''){return/(youtu\.be|youtube\.com)/i.test(u)}function vid(u=''){try{let x=new URL(u);return x.searchParams.get('v')||x.pathname.split('/').filter(Boolean).pop()}catch{return''}}
function showSlotStatus(cell,program){
  const label=cell.querySelector('.slot-author');
  const status=program?.busy?'● Занято':'○ Свободно';
  const text=[status,program?.author].filter(Boolean).join(' · ');
  if(label.textContent!==text){
    label.textContent=text;
    label.title=text;
  }
}
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
    showSlotStatus(cell,state.slots[key]);
    const chat=cell.querySelector('.slot-chat');
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
          await remote(true);
        }catch{
          chat.value=chat.value?draft+'\n'+chat.value:draft;
          note('Комментарий не сохранён. Вернитесь в поле и попробуйте ещё раз.',true);
        }
      });
      return pending;
    };
    root.append(cell);
  }
}
function updateSchedule(chats){
  document.querySelectorAll('#schedule .slot').forEach(cell=>{
    const key=cell.dataset.key, program=state.slots[key];
    const title=cell.querySelector('.slot-title'), nextTitle=name(program||fallback());
    if(title.textContent!==nextTitle)title.textContent=nextTitle;
    showSlotStatus(cell,program);
    cell.querySelector('.slot-chat').placeholder=program?.author?'Написать: '+program.author:'Написать комментарий';
    if(chats)renderChat(key,cell.querySelector('.chat-messages'),chats[key]||[]);
  });
}
const commentMarks=['●','○','◆','◇','■','□','✦','✧','✶','✷','▲'];
function commentMark(row){
  // Keep the same mark for a saved comment in every browser.
  const seed=row.id||`${row.time}:${row.text}`;
  let hash=2166136261;
  for(let i=0;i<seed.length;i++)hash=Math.imul(hash^seed.charCodeAt(i),16777619);
  return commentMarks[(hash>>>0)%commentMarks.length];
}
const renderedChats=new WeakMap();
function renderChat(key,el,rows){
  const content=JSON.stringify(rows);
  if(renderedChats.get(el)===content||el.matches(':focus-within')||el.querySelector('[data-dirty]'))return;
  renderedChats.set(el,content);
  const items=document.createDocumentFragment();
  for(const row of rows){
    const item=document.createElement('p');
    const mark=document.createElement('span');
    mark.className='comment-mark';
    mark.setAttribute('aria-hidden','true');
    mark.textContent=commentMark(row);
    const message=document.createElement('textarea');
    message.className='comment-edit';
    message.rows=1;
    message.maxLength=500;
    message.value=row.text;
    message.setAttribute('aria-label','Редактировать комментарий');
    const resize=()=>{
      message.style.height='auto';
      message.style.height=message.scrollHeight+'px';
    };
    message.oninput=resize;
    message.onblur=async()=>{
      const text=message.value.trim();
      if(text===row.text){delete message.dataset.dirty;return}
      message.dataset.dirty='true';
      message.readOnly=true;
      try{
        const response=await fetch(API+'chat/'+key+'/'+row.id,{
          method:'PUT',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({text}),keepalive:true
        });
        if(!response.ok)throw Error();
        row.text=text;
        delete message.dataset.dirty;
        await remote(true);
      }catch{note('Правка комментария не сохранена. Вернитесь в поле и попробуйте ещё раз.',true)}
      finally{message.readOnly=false}
    };
    item.append(mark,message);
    items.append(item);
    requestAnimationFrame(resize);
  }
  el.replaceChildren(items);
}
let authorLabel=document.createElement('label');authorLabel.textContent='Автор или рубрика (необязательно)';let authorInput=document.createElement('input');authorInput.name='author';authorInput.maxLength=80;authorInput.placeholder='Имя, рубрика или оба';authorLabel.append(authorInput);$('#editor-form').insertBefore(authorLabel,$('#original-title'));
function editorError(message=''){
  const error=$('#editor-error');
  error.textContent=message;
  error.hidden=!message;
}
function edit(key){
  if($('#editor').open)return;
  selected=key;
  const x=state.slots[key]||{}, h=Number(key)%24, form=$('#editor-form');
  $('#editor-heading').textContent=`${String(h).padStart(2,'0')}:00`;
  form.url.value=x.url||'';
  form.userTitle.value=x.userTitle||'';
  form.elements.author.value=x.author||'';
  form.elements.busy.value=x.busy?'busy':'free';
  form.start.value=x.start||0;
  $('#original-title').textContent=x.originalTitle?'Исходное: '+x.originalTitle:'';
  $('#clear-cell').hidden=!state.slots[key];
  editorError();
  $('#editor').showModal();
}
let slotRequestPending=false;
async function updateSlot(method, slot){
  if(slotRequestPending)return;
  const key=selected, clear=method==='DELETE';
  slotRequestPending=true;
  editorError();
  try{
    const response=await fetch(API+'slots/'+key,{
      method,...(clear?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({slot})})
    });
    if(!response.ok)throw Error();
    if(selected===key)$('#editor').close();
    await remote(true);
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
    busy:form.elements.busy.value==='busy',
    originalTitle:(old.url===url&&old.originalTitle)||(url?(isYT(url)?'YouTube':'Аудио'):''),
    start:Number(form.start.value)||0
  };
  updateSlot('PUT',slot);
};
$('#clear-cell').onclick=()=>updateSlot('DELETE');
$('#reset-radio').onclick=async event=>{
  const key=$('#settings-form').elements.writeKey.value.trim()||writeKey;
  if(!key){window.alert('Введите ключ Cloudflare, чтобы выполнить сброс.');return}
  if(window.prompt('Будут удалены все программы и комментарии. Музыка по умолчанию и джингл сохранятся. Для подтверждения введите СБРОС.')!=='СБРОС')return;
  const button=event.currentTarget;
  button.disabled=true;
  try{
    const response=await fetch(API,{
      method:'DELETE',headers:{'Content-Type':'application/json','X-Radio-Key':key},
      body:JSON.stringify({confirm:'reset'})
    });
    if(!response.ok)throw Error();
    writeKey=key;
    $('#settings').close();
    await remote(true);
    note('Программы и комментарии сброшены.');
  }catch{window.alert('Не удалось выполнить сброс. Проверьте ключ Cloudflare.')}
  finally{button.disabled=false}
};
function onProgramEnd(){let a=frame();if(!playing||a.kind!=='program'||last!==a.key||!a.x||a.x.inherited)return;completedFrame=a.key;last='';sync()}
audio.onended=onProgramEnd;
function allowPlayer(){if(!player)return;let f=player.getIframe&&player.getIframe();if(f)f.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture')}function inject(){if(document.querySelector('[data-yt]'))return;let s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.dataset.yt='';document.head.append(s)}window.onYouTubeIframeAPIReady=()=>{player=new YT.Player('youtube-player',{height:'200',width:'200',playerVars:{playsinline:1,controls:0,rel:0,enablejsapi:1,origin:location.origin},events:{onReady:()=>{allowPlayer();ready=true;last='';sync()},onStateChange:e=>{if(e.data===0)onProgramEnd()},onError:()=>note('Источник YouTube недоступен в этом браузере.',true),onAutoplayBlocked:()=>note('Браузер заблокировал запуск. Нажмите Play ещё раз.',true)}});allowPlayer()};
function sync(){if(!playing)return;let a=frame(),run=playRun;if(completedFrame&&completedFrame!==a.key)completedFrame='';if(completedFrame===a.key&&a.kind==='program')a={kind:'fallback',url:state.settings.defaultUrl,start:0,key:'fallback:'+a.key};if(a.key===last)return;last=a.key;if(!a.url){note('Не задан источник по умолчанию.',true);return}if(isYT(a.url)){audio.onloadedmetadata=null;audio.pause();inject();if(ready){player.loadVideoById({videoId:vid(a.url),startSeconds:a.start});player.playVideo()}}else{if(ready)player.stopVideo();let seek=function(){if(playing&&run===playRun)try{audio.currentTime=a.start}catch(e){}};if(audio.src!==new URL(a.url,location.href).href){audio.onloadedmetadata=seek;audio.src=a.url;audio.load();audio.play().catch(()=>note('Нажмите Play, чтобы включить звук.'))}else{seek();audio.play().catch(()=>note('Нажмите Play, чтобы включить звук.'))}}}
function tick(){
  const current=now(), seconds=current.min*60+current.sec;
  $('#clock').textContent=new Intl.DateTimeFormat('ru-RU',{
    timeZone:state.settings.timezone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  }).format(new Date());
  $('#current-title').textContent=name(get(current.day,current.hour));
  const remaining=3600-seconds;
  $('#to-hour').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  const currentKey=k(current.day,current.hour);
  document.querySelectorAll('#schedule .slot').forEach(cell=>{
    const key=cell.dataset.key;
    cell.classList.toggle('current',key===currentKey);
  });
  sync();
}
async function settings(){let password=window.prompt('Пароль для настроек');if(password===null)return;let bytes=new TextEncoder().encode(password),digest=await crypto.subtle.digest('SHA-256',bytes),hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==SETTINGS_PASSWORD_HASH){note('Неверный пароль.',true);return}let f=$('#settings-form'),a;for(a in state.settings)if(f.elements[a])f.elements[a].value=state.settings[a];$('#settings').showModal()}$('#settings-button').onclick=settings;$('#settings-form').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();let f=e.currentTarget,x=Object.fromEntries(new FormData(f));writeKey=x.writeKey||writeKey;delete x.writeKey;try{Intl.DateTimeFormat(undefined,{timeZone:x.timezone})}catch{note('Неизвестный часовой пояс.',true);return}x.idDuration=+x.idDuration;if(await saveSettings(x))$('#settings').close()};$('#export-data').onclick=()=>{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='radio-schedule.json';a.click()};
function toggle(){let b=$('#play');if(playing){playing=false;playRun++;last='';audio.onloadedmetadata=null;audio.pause();audio.removeAttribute('src');audio.load();if(ready&&player)player.stopVideo();if(b)b.textContent='▶';return}playing=true;playRun++;last='';if(b)b.textContent='❚❚';sync()}let playButton=$('#play');if(playButton)playButton.onclick=toggle;document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='s'&&e.altKey){e.preventDefault();settings()}});try{draw();inject();tick();remote();setInterval(tick,500);setInterval(()=>remote(),15000);window.addEventListener('focus',()=>remote());document.addEventListener('visibilitychange',()=>{if(!document.hidden)remote()})}catch(error){console.error(error);note('Не удалось загрузить расписание. Очистите сохранённые данные сайта и обновите страницу.',true)}
