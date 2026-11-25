// The Durable Object serializes changes; KV remains the original import source.
const headers = {'Access-Control-Allow-Origin':'https://indexmod.github.io','Access-Control-Allow-Methods':'GET, PUT, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Radio-Key','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const empty = {version:2,settings:{timezone:'Europe/Moscow',defaultUrl:'',defaultTitle:'',idDuration:30,idUrl:'assets/station_id_30s.mp3'},slots:{}};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const validSlot=k=>/^([4-6][0-9]|7[01])$/.test(k)&&Number(k)>=48;
const validToken=token=>typeof token==='string'&&token.length>=32&&token.length<=200;
const isAdmin=(request,env)=>Boolean(env.RADIO_WRITE_KEY&&request.headers.get('X-Radio-Key')===env.RADIO_WRITE_KEY);
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
    if(match[1]==='slots'&&method==='DELETE'){
      const body=await request.json().catch(()=>null);
      if(!body||typeof body.revision!=='string')return reply({error:'invalid data'},400);
      const admin=isAdmin(request,this.env);
      const ownerHash=validToken(body.token)?await digest(body.token):null;
      if(!admin&&!ownerHash)return reply({error:'forbidden'},403);
      const result=await this.state.storage.transaction(async tx=>{
        const schedule=await tx.get('schedule');
        const slot=schedule.slots[key];
        if(!slot)return body.revision?409:200;
        if(body.revision!==(slot.revision||''))return 409;
        if(!admin&&slot.ownerHash!==ownerHash)return 403;
        delete schedule.slots[key];
        await tx.put('schedule',schedule);
        return 200;
      });
      if(result===409)return reply({error:'conflict'},409);
      if(result===403)return reply({error:'forbidden'},403);
      return reply({ok:true});
    }
    if(match[1]==='slots'&&method==='PUT'){
      const body=await request.json().catch(()=>null);
      const admin=isAdmin(request,this.env);
      if(!body?.slot||typeof body.revision!=='string'||(!admin&&!validToken(body.token))){
        return reply({error:'invalid data'},400);
      }
      const program=body.slot;
      const author=String(program.author??'').trim();
      const title=String(program.userTitle??'').trim();
      let url;
      try{url=new URL(program.url)}catch{return reply({error:'invalid url'},400)}
      if(!['https:','http:'].includes(url.protocol)||author.length>80||title.length>120){
        return reply({error:'invalid data'},400);
      }
      const tokenHash=admin?null:await digest(body.token);
      const result=await this.state.storage.transaction(async tx=>{
        const schedule=await tx.get('schedule');
        const previous=schedule.slots[key];
        if(body.revision!==(previous?.revision||''))return {error:'conflict'};
        if(!admin&&previous?.lockUntil>Date.now()&&previous.ownerHash!==tokenHash){
          return {error:'locked'};
        }
        const slot={
          type:'program',url:url.href,userTitle:title,author,
          originalTitle:String(program.originalTitle??'').slice(0,300),
          start:Math.max(0,Number(program.start)||0),revision:crypto.randomUUID()
        };
        if(!admin){
          slot.ownerHash=tokenHash;
          slot.lockUntil=nextEnd(Number(key)-48,schedule.settings.timezone||'Europe/Moscow');
        }else if(previous?.ownerHash){
          slot.ownerHash=previous.ownerHash;
          slot.lockUntil=previous.lockUntil;
        }
        schedule.slots[key]=slot;
        await tx.put('schedule',schedule);
        return {ok:true};
      });
      return reply(result,result.error?409:200);
    }return reply({error:'method not allowed'},405);
  }
}
export default {async fetch(request,env){if(request.method==='OPTIONS')return new Response(null,{headers});try{return await env.RADIO_ROOM.get(env.RADIO_ROOM.idFromName('station')).fetch(request)}catch(e){return reply({error:'service unavailable'},503)}}};
