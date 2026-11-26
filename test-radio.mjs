import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('./cloudflare-worker.js',import.meta.url),'utf8');
const {RadioRoom}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

const store=new Map([['chat:48',[{time:123,text:'Ранее сохранённый комментарий'}]]]);
const storage={
  async get(key){return structuredClone(store.get(key));},
  async put(key,value){store.set(key,structuredClone(value));},
  async delete(key){return store.delete(key);},
  async list({prefix}){return new Map([...store].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>[key,structuredClone(value)]));},
  async transaction(fn){return fn(this);}
};
const initial={
  version:2,settings:{timezone:'Europe/Moscow',defaultUrl:'https://example.com/music.mp3'},
  slots:{48:{url:'https://example.com/existing.mp3',ownerHash:'previous',lockUntil:Date.now()+3600000}}
};
const room=new RadioRoom({storage,blockConcurrencyWhile:fn=>fn()},{SCHEDULES:{get:async()=>JSON.stringify(initial)},RADIO_WRITE_KEY:'admin-test'});
const call=(path,method='GET',body,headers={})=>room.fetch(new Request('https://test.invalid'+path,{
  method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})
}));
const read=async path=>(await call(path)).json();
const admin={'X-Radio-Key':'admin-test'};
const previous=await read('/live');
assert.equal(previous.schedule.slots['48'].url,initial.slots['48'].url);
assert.equal(previous.schedule.slots['48'].ownerHash,undefined);
assert.equal(previous.schedule.slots['48'].lockUntil,undefined);
assert.equal(previous.chats['48'][0].text,'Ранее сохранённый комментарий');

assert.equal((await call('/slots/48','PUT',{slot:{url:initial.slots['48'].url,author:'Кино',busy:true}})).status,200);
assert.equal((await read('/')).slots['48'].busy,true);
assert.equal((await call('/slots/48','PUT',{revision:'stale',slot:{url:'https://example.com/next.mp3',author:'Автор · Кино',busy:false}})).status,200);
assert.equal((await read('/')).slots['48'].author,'Автор · Кино');
assert.equal((await read('/')).slots['48'].busy,false);
assert.equal((await call('/slots/49','PUT',{slot:{author:'Музыка',busy:true}})).status,200);
assert.equal((await read('/')).slots['49'].url,'');

assert.equal((await call('/slots/48','DELETE')).status,200);
assert.equal((await read('/')).slots['48'],undefined);
const legacy=previous.chats['48'][0];
assert.equal((await call('/chat/48/'+legacy.id,'PUT',{text:'Поправка'})).status,200);
assert.equal((await read('/chat/48'))[0].text,'Поправка');
assert.equal((await call('/chat/48','POST',{text:'Новая строка'})).status,200);
const chat=(await read('/live')).chats['48'];
assert.equal(chat.length,2);
assert.equal((await call('/chat/48/'+chat[1].id,'PUT',{text:'Исправлено'})).status,200);
assert.equal((await read('/chat/48'))[1].text,'Исправлено');
assert.equal((await call('/chat/48/'+chat[1].id,'PUT',{text:''})).status,200);
assert.equal((await read('/chat/48')).length,1);
assert.equal((await call('/','PUT',initial)).status,403);
assert.equal((await call('/','DELETE',{confirm:'reset'})).status,403);
assert.equal((await call('/','DELETE',{},admin)).status,400);
assert.equal((await call('/','DELETE',{confirm:'reset'},admin)).status,200);
assert.deepEqual(await read('/live'),{schedule:{...initial,slots:{}},chats:{}});
console.log('Public wiki editing, manual status, persistent and editable chat, and protected reset passed.');
