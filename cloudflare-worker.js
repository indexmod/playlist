// KV supplies the original schedule. The Durable Object stores the live station.
const headers={
  'Access-Control-Allow-Origin':'https://indexmod.github.io',
  'Access-Control-Allow-Methods':'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, X-Radio-Key',
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store'
};
const empty={version:2,settings:{timezone:'Europe/Moscow',defaultUrl:'',defaultTitle:'',idDuration:30,idUrl:'assets/station_id_30s.mp3'},slots:{}};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const isAdmin=(request,env)=>Boolean(env.RADIO_WRITE_KEY&&request.headers.get('X-Radio-Key')===env.RADIO_WRITE_KEY);
const validSlot=key=>/^\d{2}$/.test(key)&&Number(key)>=48&&Number(key)<=71;
const legacyId=(row,index)=>'legacy-'+row.time+'-'+index;

function publicSchedule(schedule){
  for(const slot of Object.values(schedule.slots)){
    delete slot.ownerHash;
    delete slot.lockUntil;
  }
  return schedule;
}

async function readChats(storage,key){
  const chats={};
  const old=key
    ? [['chat:'+key,await storage.get('chat:'+key)||[]]]
    : await storage.list({prefix:'chat:'});
  for(const [storageKey,rows] of old){
    chats[storageKey.slice(5)]=rows.flatMap((row,index)=>row?[{...row,id:legacyId(row,index)}]:[]);
  }
  const messages=await storage.list({prefix:key?'comment:'+key+':':'comment:'});
  for(const [storageKey,row] of messages){
    const hour=storageKey.split(':')[1];
    (chats[hour]??=[]).push(row);
  }
  for(const rows of Object.values(chats))rows.sort((a,b)=>a.time-b.time);
  return chats;
}

async function changeComment(storage,key,id,text){
  return storage.transaction(async tx=>{
    const legacy=id.match(/^legacy-(\d+)-(\d+)$/);
    if(legacy){
      const storageKey='chat:'+key, rows=await tx.get(storageKey)||[];
      const index=Number(legacy[2]), row=rows[index];
      if(!row||legacyId(row,index)!==id)return false;
      rows[index]=text?{...row,text}:null;
      await tx.put(storageKey,rows);
      return true;
    }
    const storageKey='comment:'+key+':'+id;
    const row=await tx.get(storageKey);
    if(!row)return false;
    if(text)await tx.put(storageKey,{...row,text});
    else await tx.delete(storageKey);
    return true;
  });
}

export class RadioRoom{
  constructor(state,env){
    this.storage=state.storage;
    this.env=env;
    this.ready=state.blockConcurrencyWhile(async()=>{
      if(await this.storage.get('schedule'))return;
      const raw=await env.SCHEDULES.get('current');
      const initial=raw?JSON.parse(raw):structuredClone(empty);
      if(initial?.version!==2||!initial.slots||!initial.settings)throw Error('Invalid existing schedule');
      await this.storage.put('schedule',initial);
    });
  }

  async fetch(request){
    await this.ready;
    const {pathname}=new URL(request.url);
    const method=request.method, storage=this.storage;
    if(method==='GET'&&pathname==='/')return reply(publicSchedule(await storage.get('schedule')));
    if(method==='GET'&&pathname==='/live'){
      const schedule=await storage.get('schedule');
      return reply({schedule:publicSchedule(schedule),chats:await readChats(storage)});
    }
    if(pathname==='/'&&(method==='PUT'||method==='DELETE')){
      if(!isAdmin(request,this.env))return reply({error:'forbidden'},403);
      const body=await request.json().catch(()=>null);
      if(method==='PUT'){
        if(body?.version!==2||!body.settings)return reply({error:'invalid settings'},400);
        await storage.transaction(async tx=>{
          const schedule=await tx.get('schedule');
          schedule.settings=body.settings;
          await tx.put('schedule',schedule);
        });
      }else{
        if(body?.confirm!=='reset')return reply({error:'confirmation required'},400);
        await storage.transaction(async tx=>{
          const schedule=await tx.get('schedule');
          schedule.slots={};
          await tx.put('schedule',schedule);
          for(const prefix of ['chat:','comment:']){
            const data=await tx.list({prefix});
            for(const key of data.keys())await tx.delete(key);
          }
        });
      }
      return reply({ok:true});
    }

    const match=pathname.match(/^\/(slots|chat)\/(\d+)(?:\/([a-zA-Z0-9-]{1,80}))?$/);
    if(!match||!validSlot(match[2]))return reply({error:'not found'},404);
    const [,resource,key,id]=match;
    if(resource==='chat'){
      if(method==='GET'&&!id)return reply((await readChats(storage,key))[key]||[]);
      if((method==='POST'&&!id)||(method==='PUT'&&id)){
        const body=await request.json().catch(()=>null);
        if(typeof body?.text!=='string')return reply({error:'invalid message'},400);
        const text=body.text.trim();
        if(text.length>500||(!text&&method==='POST'))return reply({error:'invalid message'},400);
        if(id){
          if(!await changeComment(storage,key,id,text))return reply({error:'not found'},404);
        }else{
          const row={id:crypto.randomUUID(),text,time:Date.now()};
          await storage.put('comment:'+key+':'+row.id,row);
        }
        return reply({ok:true});
      }
    }else if(!id){
      if(method==='DELETE'){
        await storage.transaction(async tx=>{
          const schedule=await tx.get('schedule');
          delete schedule.slots[key];
          await tx.put('schedule',schedule);
        });
        return reply({ok:true});
      }
      if(method==='PUT'){
        const body=await request.json().catch(()=>null);
        const program=body?.slot;
        if(!program)return reply({error:'invalid data'},400);
        const author=String(program.author??'').trim();
        const title=String(program.userTitle??'').trim();
        let url=String(program.url??'').trim();
        if(url){
          try{
            const parsed=new URL(url);
            if(!['https:','http:'].includes(parsed.protocol))throw Error();
            url=parsed.href;
          }catch{return reply({error:'invalid url'},400)}
        }
        if(author.length>80||title.length>120||url.length>2048)return reply({error:'invalid data'},400);
        await storage.transaction(async tx=>{
          const schedule=await tx.get('schedule');
          schedule.slots[key]={
            type:'program',url,userTitle:title,author,busy:program.busy===true,
            originalTitle:String(program.originalTitle??'').slice(0,300),
            start:Math.max(0,Number(program.start)||0)
          };
          await tx.put('schedule',schedule);
        });
        return reply({ok:true});
      }
    }
    return reply({error:'method not allowed'},405);
  }
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{headers});
    try{
      return await env.RADIO_ROOM.get(env.RADIO_ROOM.idFromName('station')).fetch(request);
    }catch{
      return reply({error:'service unavailable'},503);
    }
  }
};
