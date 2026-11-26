const KEY='personal-radio-schedule-v2-cloud',SETTINGS_PASSWORD_HASH='6a61eb7383e868f226d30d31c95348371760d993de5a098747a36923bdcaf25c',DAYS=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const SEED=[['Вход в лабиринт','https://www.youtube.com/watch?v=SwOWMrHAS2o'],['Ивы для альпинария','https://www.youtube.com/watch?v=CXDCBn29Yqo&t=214s'],['Почему Азовское море','https://www.youtube.com/watch?v=zV_S-Cv6U4k'],['Проксима b','https://www.youtube.com/watch?v=-GXVoE7d9FE&t=1674s'],['Короткие встречи','https://www.youtube.com/watch?v=Qaj3RRFNP5c'],['Внутренний ребёнок','https://www.youtube.com/watch?v=LSgKMqvtDjQ'],['Банки Уорхола','https://www.youtube.com/watch?v=4N3Gq1eioLI'],['Путешествие по галактике','https://www.youtube.com/watch?v=pcElsNXRZmU'],['Главная шиза русского языка','https://www.youtube.com/watch?v=RUV-d1-ocqQ&t=816s'],['Настройщик','https://www.youtube.com/watch?v=ZyqH0v7Nyz8'],['План реконструкции Москвы','https://www.youtube.com/watch?v=tT391lJV2x4'],['Придумать себя','https://www.youtube.com/watch?v=tRTA1oro0Ow'],['Собака Баскервилей','https://www.youtube.com/watch?v=FO55XSs1guE'],['Увлеченья','https://www.youtube.com/watch?v=GIHXUn7lglw'],['Из жизни отдыхающих','https://www.youtube.com/watch?v=uYw1w6OoV9k']];
const fresh=()=>({version:2,settings:{timezone:'Europe/Moscow',defaultUrl:'',defaultTitle:'',idDuration:30,idUrl:'assets/station_id_30s.mp3'},slots:{}});
const $=s=>document.querySelector(s),audio=$('#audio-player'),API=window.RADIO_API_URL||'';let state=read(),selected,player,ready=false,playing=false,last='',writeKey='',playRun=0,completedFrame='';
function read(){try{let x=JSON.parse(localStorage.getItem(KEY));if(!x||x.version!==2||!x.settings||!x.slots)return fresh();x.settings=Object.assign({},fresh().settings,x.settings);return x}catch{return fresh()}}
async function saveSettings(settings){
  if(!writeKey){note('Введите ключ Cloudflare, чтобы сохранить общие настройки',true);return false}
  try{
    const response=await fetch(API,{
      method:'PUT',headers:{'Content-Type':'application/json','X-Radio-Key':writeKey},
      body:JSON.stringify({version:2,settings,slots:{}})
    });
    if(!response.ok)throw Error();
    await remote(true);
    note('Настройки сохранены');
    return true;
  }catch{
    note('Не удалось сохранить настройки — проверьте ключ Cloudflare',true);
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
      if(refreshFailed&&$('#notice').textContent==='Не удалось обновить расписание')note('');
      refreshFailed=false;
    }catch{
      if(refreshing===request&&!refreshFailed){
        refreshFailed=true;
        note('Не удалось обновить расписание',true);
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
function showSlotStatus(cell, program) {
  const busy = Boolean(program?.busy);
  const status = busy ? 'Занято' : 'Свободно';
  const author = program?.author || '';
  const label = cell.querySelector('.slot-author');
  const dot = label.querySelector('.slot-status');
  const stateLabel = label.querySelector('.slot-state');
  const credit = label.querySelector('.slot-credit');
  const creditText = author ? `· ${author}` : '';

  dot.classList.toggle('is-busy', busy);
  if (stateLabel.textContent !== status) stateLabel.textContent = status;
  if (credit.textContent !== creditText) credit.textContent = creditText;
  label.title = author ? `${status} · ${author}` : status;
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
      <strong class="slot-title"></strong>
      <span class="slot-author"><span class="slot-status" aria-hidden="true"></span><span class="slot-state"></span><span class="slot-credit"></span></span>
      <div class="chat-area"><div class="chat-messages"></div>
      <textarea class="slot-chat" rows="2" maxlength="500" enterkeyhint="send"
        aria-label="Комментарий — Enter для отправки"></textarea></div>`;
    cell.querySelector('.slot-title').textContent=name(program);
    showSlotStatus(cell,state.slots[key]);
    const chat=cell.querySelector('.slot-chat');
    chat.placeholder=program.author?'Написать: '+program.author:'Написать комментарий';
    cell.onclick=event=>{if(!event.target.closest('.chat-area'))edit(key)};
    chat.onkeydown = event => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      if (!event.repeat) sendComment(key, chat);
    };
    root.append(cell);
  }
}
async function sendComment(key, composer) {
  if (composer.readOnly) return;
  const text = composer.value.trim();
  if (!text) return;

  composer.readOnly = true;
  try {
    const response = await fetch(API + 'chat/' + key, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({text}),
      keepalive: true
    });
    if (!response.ok) throw Error();
    composer.value = '';
    if ($('#notice').textContent === 'Комментарий не сохранён — нажмите Enter, чтобы повторить') note('');
    remote(true);
  } catch {
    note('Комментарий не сохранён — нажмите Enter, чтобы повторить', true);
  } finally {
    composer.readOnly = false;
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
const commentAvatars = [
  '🐈', '🐕', '🐇', '🐿️', '🦔', '🐢', '🐙', '🐧', '🦜', '🦦', '🦩', '🦥',
  '🚶', '🏃', '🕺', '💃', '🧘', '🤸', '🏄', '🚴'
];

function commentAvatar(row) {
  const seed = String(row.id || `${row.time}:${row.text}`);
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  const avatar = document.createElement('span');
  avatar.className = 'comment-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = commentAvatars[(hash >>> 0) % commentAvatars.length];
  return avatar;
}
const renderedChats = new WeakMap();
function renderChat(key,el,rows){
  const content = JSON.stringify(rows);
  const previous = renderedChats.get(el);
  if (previous?.content === content || el.matches(':focus-within') || el.querySelector('[data-dirty]')) return;
  renderedChats.set(el, {content, count: rows.length});
  const scrollToLatest = rows.length > (previous?.count ?? 0);
  const messages = [];
  const items=document.createDocumentFragment();
  for(const row of rows){
    const item=document.createElement('p');
    const avatar = commentAvatar(row);
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
    const save = async () => {
      if (message.readOnly) return;
      const text = message.value.trim();
      if (text === row.text) {
        delete message.dataset.dirty;
        return;
      }

      message.dataset.dirty = 'true';
      message.readOnly = true;
      try {
        const response = await fetch(API + 'chat/' + key + '/' + row.id, {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({text}),
          keepalive: true
        });
        if (!response.ok && (text || response.status !== 404)) throw Error();
        delete message.dataset.dirty;

        if (text) {
          row.text = text;
        } else {
          const wasFocused = document.activeElement === message;
          item.remove();
          if (wasFocused) el.parentElement.querySelector('.slot-chat')?.focus({preventScroll: true});
          note('Комментарий удалён');
        }
        remote(true);
      } catch {
        note(text
          ? 'Изменения комментария не сохранены — вернитесь в поле и попробуйте ещё раз'
          : 'Не удалось удалить комментарий — нажмите Backspace, чтобы повторить', true);
      } finally {
        message.readOnly = false;
      }
    };
    message.oninput = event => {
      resize();
      if (!event.isComposing && message.value === '') save();
    };
    message.onkeydown = event => {
      if (event.key !== 'Backspace' || event.isComposing || event.repeat || message.value) return;
      event.preventDefault();
      save();
    };
    message.onblur = save;
    item.append(avatar,message);
    items.append(item);
    messages.push(message);
  }
  el.replaceChildren(items);
  requestAnimationFrame(() => {
    if (renderedChats.get(el)?.content !== content) return;
    const heights = messages.map(message => message.scrollHeight);
    messages.forEach((message, index) => {
      message.style.height = heights[index] + 'px';
    });
    if (scrollToLatest) el.scrollTop = el.scrollHeight;
  });
}
let authorLabel=document.createElement('label');authorLabel.textContent='Автор или рубрика (необязательно)';let authorInput=document.createElement('input');authorInput.name='author';authorInput.maxLength=80;authorInput.placeholder='Имя, рубрика или оба';authorLabel.append(authorInput);$('#editor-form').insertBefore(authorLabel,$('#original-title'));
function editorError(message=''){
  const error=$('#editor-error');
  error.textContent=message;
  error.hidden=!message;
}
const slotWrites = new Set();
const unsavedSlots = new Map();

function edit(key){
  if($('#editor').open)return;
  if (slotWrites.has(key)) {
    note('Эта ячейка ещё сохраняется');
    return;
  }
  selected=key;
  const x=unsavedSlots.get(key)||state.slots[key]||{}, h=Number(key)%24, form=$('#editor-form');
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
async function updateSlot(method, slot) {
  const key = selected;
  if (slotWrites.has(key)) return;

  const clear = method === 'DELETE';
  slotWrites.add(key);
  $('#editor').close();
  note(clear ? 'Очищаем ячейку' : 'Сохраняем программу');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(API + 'slots/' + key, {
      method,
      signal: controller.signal,
      ...(clear ? {} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify({slot})})
    });
    if (!response.ok) throw Error();

    unsavedSlots.delete(key);
    if (clear) delete state.slots[key];
    else state.slots[key] = {...slot, type: 'program'};
    updateSchedule();
    tick();
    note(clear ? 'Ячейка очищена' : 'Программа сохранена');
    remote(true);
  } catch {
    if (!clear) unsavedSlots.set(key, slot);
    note(clear ? 'Не удалось очистить ячейку' : 'Не удалось сохранить программу — откройте ячейку, чтобы повторить', true);
  } finally {
    clearTimeout(timeout);
    slotWrites.delete(key);
  }
}
$('#editor-form').onsubmit=e=>{
  if(e.submitter?.value==='cancel')return;
  e.preventDefault();
  const form=e.currentTarget, old=state.slots[selected]||{};
  let url = form.url.value.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) throw Error();
      url = parsed.href;
    } catch {
      editorError('Укажите ссылку, которая начинается с https:// или http://');
      return;
    }
  }
  const slot={
    url,userTitle:form.userTitle.value.trim(),author:form.elements.author.value.trim(),
    busy:form.elements.busy.value==='busy',
    originalTitle:(old.url===url&&old.originalTitle)||(url?(isYT(url)?'YouTube':'Аудио'):''),
    start:Math.max(0,Number(form.start.value)||0)
  };
  updateSlot('PUT',slot);
};
$('#clear-cell').onclick=()=>updateSlot('DELETE');
$('#reset-radio').onclick=async event=>{
  const key=$('#settings-form').elements.writeKey.value.trim()||writeKey;
  if(!key){window.alert('Введите ключ Cloudflare, чтобы выполнить сброс');return}
  if(window.prompt('Будут удалены все программы и комментарии, музыка по умолчанию и джингл сохранятся\nДля подтверждения введите СБРОС')!=='СБРОС')return;
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
    note('Программы и комментарии сброшены');
  }catch{window.alert('Не удалось выполнить сброс — проверьте ключ Cloudflare')}
  finally{button.disabled=false}
};
function onProgramEnd(){let a=frame();if(!playing||a.kind!=='program'||last!==a.key||!a.x||a.x.inherited)return;completedFrame=a.key;last='';sync()}
audio.onended=onProgramEnd;
const youtubeLoadingMessage = 'Нажмите ▶, когда YouTube-плеер загрузится';
let youtubeSource;


function inject() {
  if (document.querySelector('[data-yt]')) return;
  const script = document.createElement('script');
  script.src = 'https://www.youtube.com/iframe_api';
  script.dataset.yt = '';
  script.onerror = () => {
    script.remove();
    if ($('#notice').textContent === youtubeLoadingMessage) {
      note('Не удалось загрузить YouTube — нажмите ▶, чтобы повторить', true);
    }
  };
  document.head.append(script);
}

window.onYouTubeIframeAPIReady = () => {
  const embed = new URL('https://www.youtube.com/embed/');
  embed.search = new URLSearchParams({
    enablejsapi: '1', origin: location.origin, playsinline: '1', controls: '1', rel: '0'
  }).toString();

  const iframe = document.createElement('iframe');
  iframe.id = 'youtube-player';
  iframe.title = 'Плеер YouTube';
  iframe.width = '200';
  iframe.height = '200';
  iframe.tabIndex = -1;
  iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
  iframe.src = embed.href;
  $('#youtube-player').replaceWith(iframe);

  player = new YT.Player(iframe, {
    events: {
      onReady: () => {
        ready = true;
        if ($('#notice').textContent === youtubeLoadingMessage) {
          note('YouTube-плеер готов к запуску — нажмите ▶');
        }
      },
      onStateChange: event => {
        if (event.data === 0) onProgramEnd();
      },
      onError: event => {
        if (playing && youtubeSource) {
          stopPlayback();
          note(`Источник YouTube недоступен в этом браузере (код ${event.data})`, true);
        }
      },
      onAutoplayBlocked: () => {
        if (playing && youtubeSource) {
          stopPlayback();
          note('Браузер заблокировал YouTube — попробуйте ▶ ещё раз', true);
        }
      }
    }
  });
};

function sync() {
  if (!playing) return;
  let source = frame();
  const run = playRun;
  if (completedFrame && completedFrame !== source.key) completedFrame = '';
  if (completedFrame === source.key && source.kind === 'program') {
    source = {kind: 'fallback', url: state.settings.defaultUrl, start: 0, key: 'fallback:' + source.key};
  }
  if (source.key === last) return;
  last = source.key;
  if (!source.url) {
    stopPlayback();
    note('Не задан источник по умолчанию', true);
    return;
  }

  if (isYT(source.url)) {
    if (!ready) {
      stopPlayback();
      note(youtubeLoadingMessage);
      inject();
      return;
    }
    audio.onloadedmetadata = null;
    audio.onerror = null;
    audio.pause();
    youtubeSource = source;
    player.loadVideoById({videoId: vid(source.url), startSeconds: source.start});
    return;
  }

  youtubeSource = null;
  if (ready) player.stopVideo();
  const seek = () => {
    if (playing && run === playRun) {
      try { audio.currentTime = source.start; } catch {}
    }
  };
  const audioFailed = error => {
    if (!playing || run !== playRun || last !== source.key) return;
    stopPlayback();
    const message = error?.name === 'NotAllowedError'
      ? 'Браузер заблокировал звук — нажмите ▶ ещё раз'
      : 'Не удалось воспроизвести аудио — проверьте ссылку';
    note(message, true);
  };

  audio.onerror = () => {
    if (audio.error) audioFailed(audio.error);
  };

  try {
    const url = new URL(source.url, location.href).href;
    if (audio.src !== url) {
      audio.onloadedmetadata = seek;
      audio.src = url;
    } else {
      seek();
    }
    audio.play()?.catch(audioFailed);
  } catch (error) {
    audioFailed(error);
  }
}

const programRotationStart = performance.now();

function tick(){
  const date = new Date();
  const current = now(date);
  const seconds = current.min * 60 + current.sec;
  const remaining = 3600 - seconds;
  $('#clock').textContent=new Intl.DateTimeFormat('ru-RU',{
    timeZone:state.settings.timezone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  }).format(date);
  const showNext = Math.floor((performance.now() - programRotationStart) / 5000) % 2 === 1;
  const program = showNext ? now(new Date(date.getTime() + remaining * 1000)) : current;
  const title = name(get(program.day, program.hour)) || '—';
  const time = `${String(program.hour).padStart(2, '0')}:00`;
  const text = showNext ? `Далее: ${time} ${title}` : `Сейчас: ${title}`;
  const line = $('#program-line');
  if (line.textContent !== text) {
    line.textContent = text;
    line.title = text;
  }
  $('#to-hour').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  const currentKey=k(current.day,current.hour);
  document.querySelectorAll('#schedule .slot').forEach(cell=>{
    const key=cell.dataset.key;
    cell.classList.toggle('current',key===currentKey);
  });
  sync();
}
async function settings(){let password=window.prompt('Пароль для настроек');if(password===null)return;let bytes=new TextEncoder().encode(password),digest=await crypto.subtle.digest('SHA-256',bytes),hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==SETTINGS_PASSWORD_HASH){note('Неверный пароль',true);return}let f=$('#settings-form'),a;for(a in state.settings)if(f.elements[a])f.elements[a].value=state.settings[a];$('#settings').showModal()}$('#settings-button').onclick=settings;$('#settings-form').onsubmit=async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();let f=e.currentTarget,x=Object.fromEntries(new FormData(f));writeKey=x.writeKey||writeKey;delete x.writeKey;try{Intl.DateTimeFormat(undefined,{timeZone:x.timezone})}catch{note('Неизвестный часовой пояс',true);return}x.idDuration=+x.idDuration;if(await saveSettings(x))$('#settings').close()};$('#export-data').onclick=()=>{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='radio-schedule.json';a.click()};
function stopPlayback() {
  playing = false;
  youtubeSource = null;
  playRun++;
  last = '';
  audio.onloadedmetadata = null;
  audio.onerror = null;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  if (ready) player.stopVideo();
  const button = $('#play');
  if (button) button.textContent = '▶';
}

function toggle() {
  if (playing) {
    stopPlayback();
    return;
  }

  if (isYT(frame().url) && !ready) {
    note(youtubeLoadingMessage);
    inject();
    return;
  }

  note('');
  playing = true;
  playRun++;
  last = '';
  const button = $('#play');
  if (button) button.textContent = '❚❚';
  sync();
}

let playButton=$('#play');if(playButton)playButton.onclick=toggle;document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='s'&&e.altKey){e.preventDefault();settings()}});try{draw();inject();tick();remote();setInterval(tick,500);setInterval(()=>remote(),15000);window.addEventListener('focus',()=>remote());document.addEventListener('visibilitychange',()=>{if(!document.hidden)remote()})}catch(error){console.error(error);note('Не удалось загрузить расписание — очистите сохранённые данные сайта и обновите страницу',true)}
