const routes = [
  ['Icy Dunes','Glide through a quiet valley of snow-dusted pines and violet peaks.','Alpine','pine',850,0xc5a6ca,0x584269,0xf2d1e0,12,0.8],
  ['Ociano','Skim a turquoise sea between islands and sunlit sails.','Ocean','sail',1100,0x65c5c4,0x326c80,0xb8eded,18,0.65],
  ['Candy Land','Follow the sugar trail past peppermint spires and candy-coloured hills.','Candy','candy',1160,0xf1adc9,0xaf5ba4,0xffe4e9,20,1.2],
  ['Islanders','Thread the palms along a chain of tropical islets.','Tropical','palm',1250,0x75b69c,0x377b78,0xc2e0a0,25,1],
  ['Stoneage','Bank between stone pillars in an ancient sandstone pass.','Canyon','rock',1320,0xc49484,0x74596a,0xf7c99e,35,1.5],
  ['Night','Follow the glowing hoops through a moonlit forest.','Nocturnal','pine',1390,0x68638a,0x302f54,0xa6a8cf,22,1.3],
  ['Desertious','Ride warm currents over ochre dunes and scattered cacti.','Desert','cactus',1450,0xe2ad76,0xaa695b,0xffdfa4,31,1.5],
  ['Villageous','Trace the winding route between pitched roofs and village spires.','Village','house',1510,0x9cba86,0x577c73,0xe9d99a,32,1.3],
  ['Frost','Weave through jagged ice and the arches of a frozen passage.','Ice caves','ice',1580,0x9cd2df,0x5b8ca4,0xe0f4ee,34,1.45],
  ['Spring','Catch the breeze through a valley of pink blossoms.','Meadow','blossom',1620,0xa9c78f,0x688e7a,0xe9ddad,30,1.4],
  ['Forestry','Steer between towering firs along the forest floor.','Woodland','pine',1660,0x81a387,0x446f70,0xc9d5a2,42,1.5],
  ['Snowy','Cross the snowfields beneath a pale blue winter sky.','Snowfield','pine',1720,0xb9d7de,0x7294af,0xefefe6,45,1.45],
  ['Heatish','Clear the basalt needles above a glowing volcanic valley.','Volcanic','basalt',1780,0x9b7777,0x533f5b,0xf2a374,45,1.7],
  ['Return','Find the way home through the familiar hills at sunset.','Highlands','house',1850,0xbd9daa,0x76637f,0xeec4ac,39,1.5],
  ['Cloudy','Soar above a cloud sea and pass the last high-altitude gates.','Cloud sea','cloud',1920,0xc3b9d9,0x8886aa,0xf9e2de,46,1.65]
];
export const chapters = routes.map(([name,description,biome,prop,length,ground,shade,light,bend,frequency],i)=>({name,description,biome,prop,length,ground,shade,light,bend,frequency,id:i,slug:name.toLowerCase().replaceAll(' ','-')}));
export const planes = [
 ['Aero',0,3,3,4],['Glider',35,3,5,4],['Comet',60,5,3,4],['Phoenix',90,5,5,4],['Galactic',120,6,4,5],['Celestial',145,5,6,5],['Stellar',170,6,4,6],['Bat',195,5,5,7],['Flyer',220,7,5,5],['Swan',250,6,7,6],['Astral',290,7,7,7]
].map(([name,cost,speed,lift,steering],i)=>({name,cost,speed,lift,steering,id:i}));
export const skins=[['Paper',0xf8f3f5,0],['Sunlit',0xffdc88,15],['Blush',0xf5a8c4,25],['Seafoam',0x9aead5,35],['Lilac',0xbba9f4,45],['Glacier',0xa2d9ff,55],['Ember',0xffa28a,70]];
export const pad=n=>String(n).padStart(2,'0');
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const courseX=(c,z)=>c.bend*(Math.sin(z*.0052*c.frequency)+.45*Math.sin(z*.0122*c.frequency));
export const groundY=(c,x,z)=>{
 const d=Math.abs(x-courseX(c,z));
 if(['sail','palm','cloud'].includes(c.prop)) return -1+Math.max(0,d-36)*.07+1.2*Math.sin(z*.013+x*.04);
 return 1.5*Math.sin(z*.021+c.id)+1.8*Math.cos(x*.037+z*.011)+Math.max(0,d-24)*(.26+.15*Math.sin(z*.016+c.id));
};
const turns=[-12,17,-15,-19,16,19,-18,13];
const heights=[18,22,16,20,15,23,19,15];
const checkpointStart=70,checkpointSpacing=92;
export const checkpointCount=c=>Math.floor((c.length-checkpointStart-62)/checkpointSpacing)+1;
export function gate(c,i,timed=false){
 if(timed){
  const z=checkpointStart+i*checkpointSpacing;
  const direction=c.id%2===0?1:-1;
  const phase=(i+Math.floor(c.id/2))%turns.length;
  return {
   z,x:courseX(c,z)+turns[phase]*direction,y:heights[phase],radius:7.0,type:'checkpoint'
  };
 }
 const z=80+i*99;
 return {z,x:i===0?0:courseX(c,z),y:i===0?17:17+4*Math.sin(i*.91+c.id*.5),type:i%5===3?'wind':i%4===2?'time':'ring'};
}
export function finishGate(chapter){
 const z=chapter.length;
 return {x:courseX(chapter,z)+(chapter.id%2===0?12:-12),y:18,z,radius:7.0,type:'finish'};
}
function checkpointLane(c,z){
 const index=Math.floor((z-checkpointStart)/checkpointSpacing),count=checkpointCount(c);
 if(index>=count-1){
  const last=gate(c,count-1,true),finish=finishGate(c);
  return last.x+(finish.x-last.x)*clamp((z-last.z)/(finish.z-last.z),0,1);
 }
 const a=index<0?{x:0,z:0}:gate(c,index,true);
 const b=gate(c,index+1,true);
 return a.x+(b.x-a.x)*clamp((z-a.z)/(b.z-a.z),0,1);
}
export function obstacles(c,row,timed=false){
 const z=row*34+7;
 const hash=n=>{let v=Math.sin(n*123.72+c.id*5.8)*15634.3;return v-Math.floor(v)};
 const scenery=[-1,1].flatMap((sign,k)=>{
  const n=row*4+k, x=courseX(c,z)+sign*(21+hash(n)*64);
  const main={x,z:z+hash(n+22)*12,h:9+16*hash(n+12),w:4+4*hash(n+52),prop:c.prop};
  if(row%6===3&&k===0&&row>3)return [main,{...main,x:courseX(c,z)+sign*(7+4*hash(n+1)),h:9+6*hash(n+6),w:3.8}];
  return [main];
 });
 if(!timed)return scenery;
 for(const obstacle of scenery){
  if(obstacle.z>c.length+10)continue;
  const center=checkpointLane(c,obstacle.z),offset=obstacle.x-center;
  // The direct line between rings stays flyable even where it cuts across a bend.
  if (Math.abs(offset) < 23) {
    obstacle.x = center + (offset < 0 ? -23 : 23);
}
 }
 if(row<2||z>c.length-30)return scenery;
 const center=checkpointLane(c,z);
 const side=row%2===0?1:-1;
 const near={x:center+side*(22+hash(row+41)*4),z,h:15+hash(row+63)*8,w:4+hash(row+33)*3,prop:c.prop};
 scenery.push(near);
 // Tall obstacles at the opposite side of every other gap make the turns visible.
 if(row%2===0)scenery.push({...near,x:center-side*(23+hash(row+7)*5),z:z+3,h:near.h+3});
 return scenery;
}
