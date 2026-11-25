// The Durable Object serializes changes; KV remains the original import source.
const headers = {'Access-Control-Allow-Origin':'https://indexmod.github.io','Access-Control-Allow-Methods':'GET, PUT, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Radio-Key','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const empty = {version:2,settings:{timezone:'Europe/Moscow',defaultUrl:'',defaultTitle:'',idDuration:30,idUrl:'assets/station_id_30s.mp3'},slots:{}};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const validSlot=k=>/^([4-6][0-9]|7[01])$/.test(k)&&Number(k)>=48;
function nextEnd(hour,zone){const now=Date.now();const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));const get=t=>Number(parts.find(x=>x.type===t).value);let offset=(hour-get('hour')+24)%24;return now+((offset+1)*3600-get('minute')*60-get('second'))*1000;}
async function digest(token){let b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');}
export class RadioRoom {
  constructor(state,env){this.state=state;this.env=env;this.ready=state.blockConcurrencyWhile(async()=>{let v=await state.storage.get('schedule');if(!v){let raw=await env.SCHEDULES.get('current');let initial=raw?JSON.parse(raw):structuredClone(empty);if(!initial||initial.version!==2||!initial.slots||!initial.settings)throw Error('Invalid existing schedule');await state.storage.put('schedule',initial);}});}
  async fetch(request){await this.ready;let u=new URL(request.url),method=request.method;
    if(method==='GET'&&u.pathname==='/'){
      const schedule=await this.state.storage.get('schedule');
      for(const slot of Object.values(schedule.slots)) delete slot.ownerHash;
      return reply(schedule);
    }
    if(method==='PUT'&&u.pathname==='/'){if(!this.env.RADIO_WRITE_KEY||request.headers.get('X-Radio-Key')!==this.env.RADIO_WRITE_KEY)return reply({error:'forbidden'},403);let data=await request.json();if(!data||data.version!==2||!data.settings||!data.slots)return reply({error:'invalid schedule'},400);await this.state.storage.transaction(async tx=>{let current=await tx.get('schedule');current.settings=data.settings;await tx.put('schedule',current)});return reply({ok:true});}
    const match=u.pathname.match(/^\/(slots|chat)\/(\d+)$/);if(!match||!validSlot(match[2]))return reply({error:'not found'},404);let key=match[2];
    if(match[1]==='chat'&&method==='GET')return reply(await this.state.storage.get('chat:'+key)||[]);
    if(match[1]==='chat'&&method==='POST'){let body=await request.json(),text=String(body.text||'').trim();if(!text||text.length>500)return reply({error:'invalid message'},400);await this.state.storage.transaction(async tx=>{let rows=await tx.get('chat:'+key)||[];rows.push({text,time:Date.now()});await tx.put('chat:'+key,rows.slice(-100));});return reply({ok:true});}
    if(match[1]==='slots'&&method==='PUT'){let body=await request.json();if(typeof body.token!=='string'||body.token.length<32||body.token.length>200||!body.slot)return reply({error:'invalid data'},400);let tokenHash=await digest(body.token),s=body.slot;let url;try{url=new URL(s.url)}catch{return reply({error:'invalid url'},400)}if(!['https:','http:'].includes(url.protocol)||!String(s.author||'').trim()||String(s.author).length>80||String(s.userTitle||'').length>120)return reply({error:'invalid data'},400);
      let result=await this.state.storage.transaction(async tx=>{let data=await tx.get('schedule'),old=data.slots[key],rev=old&&old.revision||'';if((body.revision||'')!==rev)return {error:'conflict'};if(old&&old.lockUntil>Date.now()&&old.ownerHash!==tokenHash)return {error:'locked'};let slot={type:'program',url:url.href,userTitle:String(s.userTitle||'').trim(),originalTitle:String(s.originalTitle||'').slice(0,300),author:String(s.author).trim(),start:Math.max(0,Number(s.start)||0),ownerHash:tokenHash,lockUntil:nextEnd(Number(key)-48,data.settings.timezone||'Europe/Moscow'),revision:crypto.randomUUID()};data.slots[key]=slot;await tx.put('schedule',data);return {ok:true};});return reply(result,result.error?409:200);
    }return reply({error:'method not allowed'},405);
  }
}
export default {async fetch(request,env){if(request.method==='OPTIONS')return new Response(null,{headers});try{return await env.RADIO_ROOM.get(env.RADIO_ROOM.idFromName('station')).fetch(request)}catch(e){return reply({error:'service unavailable'},503)}}};
