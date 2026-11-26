import {clamp,groundY,gate,checkpointCount,finishGate,obstacles} from './data.js';
const cruiseSpeed=plane=>16+plane.speed*.85;
export function newRun(chapter,plane,mode){
 const speed=cruiseSpeed(plane);
 return {chapter,plane,mode,x:0,y:17,z:0,vx:0,vy:0,speed,forwardSpeed:speed,bank:0,pitch:0,energy:100,time:mode==='endless'?32:9,elapsed:0,quantum:0,rings:0,requiredRings:mode==='endless'?0:checkpointCount(chapter),bonusTime:0,cursor:0,gemCursor:0,wind:0,boosting:false,end:'',notice:'',noticeUntil:0,alignFinish:false};
}
export function step(s,input,dt,signal=()=>{}){
 if(s.end)return;
 const c=s.chapter,p=s.plane,oldX=s.x,oldY=s.y,oldZ=s.z;
 const approach=(a,b,t)=>a+(b-a)*(1-Math.exp(-t*dt));
 s.boosting=(input.boost&&s.energy>1)||s.wind>0;
 s.energy=clamp(s.energy+dt*(s.boosting&&s.wind<=0?-28:13),0,100);
 s.wind=Math.max(0,s.wind-dt);
// AERODYNAMIC FLIGHT PHYSICS

const gravity = 9.81;
const trimSpeed = cruiseSpeed(p);

// Maximum banking and pitching angles
const maxBank = 0.90 + 0.025 * (p.steering - 4);
const maxPitch = 0.48;

// Pilot input controls aircraft attitude
const rollTarget =
    clamp(input.x, -1, 1) * maxBank;

const pitchTarget =
    clamp(input.y, -1, 1) * maxPitch;

// Smooth aerodynamic response
s.bank = approach(s.bank, rollTarget, 3.25);
s.pitch = approach(s.pitch, pitchTarget, 2.8);

// Lift increases with the square of airspeed
const speedRatio = s.speed / trimSpeed;

const liftRatio = clamp(
    speedRatio * speedRatio *
    (1 + 1.9 * s.pitch * (0.9 + p.lift / 30)),
    0.1,
    1.85
);

// Gravity and reduced lift while banking
const verticalAcceleration =
    gravity * (
        liftRatio * Math.cos(s.bank) - 1
    ) - s.vy * 1.0;

// Banking creates sideways acceleration
const lateralAcceleration =
    gravity *
    liftRatio *
    Math.sin(s.bank) *
    2.5 -
    s.vx * 1.45;

// Integrate acceleration into velocity
s.vx = clamp(
    s.vx + lateralAcceleration * dt,
    -23,
    23
);

s.vy = clamp(
    s.vy + verticalAcceleration * dt,
    -14,
    14
);

// Direction of flight relative to the horizon
const flightAngle = Math.atan2(
    s.vy,
    Math.max(s.speed, 1)
);

// Aerodynamic drag
const drag =
    0.8 * (s.speed - trimSpeed) +
    1.2 * Math.abs(s.bank) +
    0.7 * Math.abs(s.pitch);

// Wind boost and gravitational acceleration
const thrust = s.boosting ? 10 : 0;

s.speed = clamp(
    s.speed + (
        thrust -
        gravity * Math.sin(flightAngle) -
        drag
    ) * dt,
    9,
    36
);

// Integrate velocity into position
s.x += s.vx * dt;
s.y = Math.min(63, s.y + s.vy * dt);

if (s.y === 63 && s.vy > 0) {
    s.vy = 0;
}
 const timed=s.requiredRings>0,finish=timed?finishGate(c):null;
 const nextZ=oldZ+s.speed*dt;
 const distanceAt=(pointX,pointY,z)=>{
  const fraction=clamp((z-oldZ)/(nextZ-oldZ),0,1);
  return Math.hypot(oldX+(s.x-oldX)*fraction-pointX,oldY+(s.y-oldY)*fraction-pointY);
 };
 const aligned=finish&&distanceAt(finish.x,finish.y,finish.z)<=finish.radius;
 s.alignFinish=!!finish&&!aligned&&finish.z-oldZ<30;
 if(s.alignFinish){
  // Keep the finish ahead so a missed approach can be corrected with normal steering.
  const distance=Math.max(0,finish.z-.65-oldZ);
  s.z=oldZ+Math.min(distance,Math.min(s.speed,distance*2.7)*dt);
 }else{
  s.z=nextZ;
 }
 s.forwardSpeed=(s.z-oldZ)/dt;
 const crossedFinish=finish&&aligned&&oldZ<finish.z&&s.z>=finish.z;
 const fraction=crossedFinish?(finish.z-oldZ)/(s.z-oldZ):1;
 if(crossedFinish){
  s.x=oldX+(s.x-oldX)*fraction;
  s.y=oldY+(s.y-oldY)*fraction;
  s.z=finish.z;
 }
 s.elapsed+=dt*fraction; s.time-=dt*fraction;
 const event=(name,msg)=>{s.notice=msg;s.noticeUntil=s.elapsed+1.5;signal(name)};
 const g=gate(c,s.cursor,timed);
 if((!timed||s.cursor<s.requiredRings)&&oldZ<g.z&&s.z>=g.z){
  if(distanceAt(g.x,g.y,g.z)<(g.radius??7.3)){
   s.rings++;
   if(timed){
    const next=s.cursor+1===s.requiredRings?finish:gate(c,s.cursor+1,true);
    const seconds=Math.min(Math.ceil((next.z-g.z)/17),Math.ceil(12-s.time));
    s.time+=seconds;
    s.bonusTime+=seconds;
    event('time','Checkpoint  '+s.rings+'/'+s.requiredRings+'  ·  +'+seconds+'s');
   }
   else if(g.type==='time'){s.time+=11;s.bonusTime+=11;event('time','+11 seconds')}
   else if(g.type==='wind'){s.wind=3;s.energy=100;event('wind','Wind boost')}
   else {s.time+=5;s.bonusTime+=5;event('ring','Ring cleared  +5s')}
  }else if(timed){
   event('fail','Checkpoint missed');
  }
  s.cursor++;
 }
 const a=gate(c,s.gemCursor,timed),gemZ=a.z-24;
 if((!timed||s.gemCursor<s.requiredRings)&&oldZ<gemZ&&s.z>=gemZ){if(distanceAt(a.x,a.y,gemZ)<6){s.quantum+=5;event('gem','+5 Quantum')} s.gemCursor++}
 if(s.y<=groundY(c,s.x,s.z)+1.15)s.end='Ground contact';
 const row=Math.floor((s.z-7)/34);
 for(let i=Math.max(0,row-1);i<=row+1;i++)for(const o of obstacles(c,i,timed)){
  const base=groundY(c,o.x,o.z),fraction=clamp((s.y-base)/o.h,0,1);
  if(Math.abs(s.z-o.z)<o.w*.65+1&&Math.abs(s.x-o.x)<o.w*(1-.7*fraction)+.8&&s.y<base+o.h+.4)s.end='Obstacle contact';
 }
 if(c.prop==='ice'&&s.z>220&&Math.abs(((s.z-240+90)%180+180)%180-90)<4&&s.y>27)s.end='Ice ceiling';
 if(!s.end){
  const missed=timed&&s.rings<s.cursor;
  if(s.time<=0)s.end=missed?'Time ran out after a missed checkpoint':'Out of time';
  else if(crossedFinish)s.end=s.rings<s.requiredRings?'Checkpoint missed':'complete';
 }
}
