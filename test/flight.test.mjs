import test from 'node:test';
import assert from 'node:assert/strict';
import {chapters,planes,gate,finishGate,groundY,obstacles,clamp} from '../dist/js/data.js';
import {newRun,step} from '../dist/js/sim.js';
const neutral={x:0,y:0,boost:false};
function fly(s,input,frames){
 for(let i=0;i<frames&&!s.end;i++)step(s,input,1/60);
}
test('diving gains momentum, climbing costs momentum, and boost consumes charge',()=>{
 const dive=newRun(chapters[0],planes[0],'story'),climb={...dive},boost={...dive};
 fly(dive,{...neutral,y:-1},30);fly(climb,{...neutral,y:1},30);fly(boost,{...neutral,boost:true},30);
 assert.ok(dive.speed>climb.speed);assert.ok(boost.energy<100);assert.ok(boost.speed>dive.speed);
});
test('collecting resources updates the same run once',()=>{
 const s=newRun(chapters[0],planes[0],'endless');fly(s,neutral,265);
 assert.equal(s.quantum,5);assert.equal(s.rings,1);assert.equal(s.bonusTime,5);
 for(const [i,event] of [[2,'time'],[3,'wind']]){
  const a=gate(s.chapter,i);Object.assign(s,{x:a.x,y:a.y,z:a.z-.1,cursor:i,energy:30});
  const messages=[];step(s,neutral,1/60,id=>messages.push(id));assert.ok(messages.includes(event));
  if(i===2)assert.equal(s.bonusTime,16);else assert.equal(s.energy,100);
 }
});
test('ground, obstacles and time end a flight',()=>{
 const s=newRun(chapters[0],planes[0],'story');s.y=groundY(s.chapter,0,0);step(s,neutral,1/60);assert.equal(s.end,'Ground contact');
 const hit=newRun(chapters[0],planes[0],'story'),o=obstacles(hit.chapter,3)[0];Object.assign(hit,{x:o.x,y:groundY(hit.chapter,o.x,o.z)+4,z:o.z-.1});step(hit,neutral,1/60);assert.equal(hit.end,'Obstacle contact');
 const t=newRun(chapters[0],planes[0],'endless');t.time=.002;step(t,neutral,1/60);assert.equal(t.end,'Out of time');
});
test('each timed chapter can be cleared without boost by steering through the checkpoints',()=>{
 const pd=(c,m,ox,oy)=>{
  const idx=Math.min(c.cursor,m.length-2),a=m[idx],b=m[idx+1],n=m[Math.min(idx+2,m.length-1)];
  const t=clamp((c.z+8-a.z)/(b.z-a.z),0,1),lead=clamp((c.z+16-b.z)/16,0,1)*.25;
  return {x:clamp((a.x+(b.x-a.x)*t+(n.x-b.x)*lead+ox-c.x)*.55-c.vx*.18,-1,1),y:clamp((a.y+(b.y-a.y)*t+oy-c.y)*.50-c.vy*.14,-1,1),boost:false};
 };
 const safe=(s,m,ox,oy,strict)=>{
  const c={...s};
  for(let k=0;k<110&&!c.end;k++)step(c,pd(c,m,k<36?ox:0,k<36?oy:0),1/60);
  return (!c.end||c.end==='complete')&&(!strict||(c.rings-s.rings)===(c.cursor-s.cursor));
 };
 for(const c of chapters){
  const s=newRun(c,planes[0],'story');
  const markers=[{x:0,y:17,z:0},...Array.from({length:s.requiredRings},(_,i)=>gate(c,i,true)),finishGate(c)];
  let ox=0,oy=0,hold=0;
  for(let i=0;i<13000&&!s.end;i++){
   const b=markers[Math.min(s.cursor+1,markers.length-1)];
   if(hold>0&&b.z-s.z>=20)hold--;else{hold=0;ox=0;oy=0;}
   if(hold===0&&i%3===0&&!safe(s,markers,0,0,false)){
    const d=b.x>=s.x?1:-1;
    const alts=[[0,10],[0,14],[d*10,0],[-d*10,0],[d*10,8],[-d*10,8],[d*15,0],[-d*15,0]];
    const hit=alts.find(([ax,ay])=>safe(s,markers,ax,ay,true))||alts.find(([ax,ay])=>safe(s,markers,ax,ay,false));
    if(hit){[ox,oy]=hit;hold=36;}
   }
   step(s,pd(s,markers,ox,oy),1/60);
  }
  assert.equal(s.end,'complete',c.name+' '+s.end+' at '+s.z);
  assert.equal(s.rings,s.requiredRings);
 }
});
test('endless flights continue after the chapter finish',()=>{
 const s=newRun(chapters[0],planes[0],'endless');s.z=s.chapter.length-.1;s.y=40;step(s,neutral,1/60);assert.ok(s.z>s.chapter.length);assert.equal(s.end,'');
});
test('idle flight progresses more slowly and cannot clear any chapter',()=>{
 for(const c of chapters){
  const s=newRun(c,planes[0],'story');
  assert.equal(s.time,9);
  fly(s,neutral,60);
  assert.ok(s.z<20);
  fly(s,neutral,1200);
  assert.notEqual(s.end,'');
  assert.notEqual(s.end,'complete');
  assert.ok(s.z<c.length);
 }
});
test('missing even one checkpoint blocks completion despite time left on the clock',()=>{
 const s=newRun(chapters[0],planes[0],'story');
 const f=finishGate(s.chapter);
 Object.assign(s,{x:f.x,y:f.y,z:f.z-.02,cursor:s.requiredRings,rings:s.requiredRings-1,time:5});
 step(s,{...neutral,boost:true},1/60);
 assert.equal(s.end,'Checkpoint missed');
 assert.ok(s.time>0);
});
test('a missed checkpoint grants no time and leaves other checkpoints reachable',()=>{
 const s=newRun(chapters[0],planes[0],'story');
 const first=gate(s.chapter,0,true),second=gate(s.chapter,1,true);
 Object.assign(s,{x:first.x+20,y:first.y+20,z:first.z-.02});
 step(s,neutral,1/60);
 assert.equal(s.cursor,1);
 assert.equal(s.rings,0);
 assert.equal(s.bonusTime,0);
 assert.ok(s.time<9);
 assert.equal(s.end,'');
 Object.assign(s,{x:second.x,y:second.y,z:second.z-.02});
 step(s,neutral,1/60);
 assert.equal(s.cursor,2);
 assert.equal(s.rings,1);
 assert.ok(s.time>9);
});
test('crossing the edge of the final ring uses the position at its plane',()=>{
 const s=newRun(chapters[0],planes[0],'story');
 const f=finishGate(s.chapter);
 Object.assign(s,{x:f.x+f.radius-.02,y:f.y,z:f.z-.02,vx:15,cursor:s.requiredRings,rings:s.requiredRings});
 step(s,{...neutral,x:1},1/60);
 assert.equal(s.end,'complete');
 assert.equal(s.z,f.z);
 assert.ok(s.x<f.x+f.radius);
});
test('flight attitude eases in and settles after the pilot releases the controls',()=>{
 const s=newRun(chapters[0],planes[0],'story');
 step(s,{...neutral,x:1,y:1},1/60);
 const firstBank=s.bank,firstPitch=s.pitch;
 assert.ok(firstBank>0&&firstBank<.05);
 assert.ok(firstPitch>0&&firstPitch<.05);
 fly(s,{...neutral,x:1,y:1},22);
 assert.ok(s.bank>firstBank&&s.pitch>firstPitch);
 fly(s,neutral,60);
 assert.ok(Math.abs(s.bank)<.06&&Math.abs(s.pitch)<.08);
});
