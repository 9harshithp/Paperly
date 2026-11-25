// Invite and answer signalling for two-pilot races. Same-browser pilots can
// communicate locally even when a network prohibits WebRTC candidates.
export class Race {
 constructor(status,receive){this.status=status;this.receive=receive;this.remote=null}
 close(){
  if(this.channel){this.channel.onclose=null;this.channel.close()}
  if(this.pc){this.pc.onconnectionstatechange=null;this.pc.close()}
  this.bus?.close();this.bus=null;this.pc=null;this.channel=null;this.remote=null;this.host=false;this.localReady=false;this.accepted=false;
 }
 newPeer(host,room,proof){
  this.close();this.host=host;this.room=room;this.proof=proof;
  if(typeof BroadcastChannel!=='undefined'){
   this.bus=new BroadcastChannel('paperly-race-'+room);
   this.bus.onmessage=({data})=>{
    if(!data||data.proof!==this.proof)return;
    if(data.kind==='accepted'&&!this.host){
     this.localReady=true;this.bus.postMessage({kind:'ready',proof:this.proof});this.status('Connected');
    }else if(data.kind==='ready'&&this.host&&this.accepted){this.localReady=true;this.status('Connected')}
    else if(data.kind==='message'&&this.localReady)this.message(data.body);
   };
  }
  if(typeof RTCPeerConnection==='undefined')return;
  this.pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  this.pc.ondatachannel=e=>this.bind(e.channel);
  this.pc.onconnectionstatechange=()=>{if(!this.localReady&&this.pc?.connectionState==='failed')this.status('The networks could not connect directly. Try another network or use two tabs in one browser.')};
  if(host)this.bind(this.pc.createDataChannel('paperly'));
 }
 message(m){if(!m||typeof m!=='object')return;if(m.type==='pos'&&[m.x,m.y,m.z].every(Number.isFinite))this.remote=m;else this.receive(m)}
 bind(ch){this.channel=ch;ch.onopen=()=>this.status('Connected');ch.onclose=()=>{if(!this.localReady){this.remote=null;this.status('Opponent disconnected')}};ch.onmessage=e=>{try{this.message(JSON.parse(e.data))}catch{}}}
 get connected(){return this.localReady||this.channel?.readyState==='open'}
 send(data){if(this.localReady)this.bus.postMessage({kind:'message',body:data,proof:this.proof});else if(this.channel?.readyState==='open')this.channel.send(JSON.stringify(data))}
 async localCode(type){
  const pc=this.pc;let sdp='';
  if(pc){
   await pc.setLocalDescription(type==='offer'?await pc.createOffer():await pc.createAnswer());
   if(pc.iceGatheringState!=='complete')await new Promise(resolve=>{
    const done=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',change);resolve()};
    const change=()=>{if(pc.iceGatheringState==='complete')done()};
    const timer=setTimeout(done,5000);pc.addEventListener('icegatheringstatechange',change);
   });
   sdp=pc.localDescription.sdp;
  }
  return btoa(JSON.stringify({type,sdp,room:this.room,proof:this.proof}));
 }
 read(code,type){
  const d=JSON.parse(atob(code.trim()));
  if(d.type!==type||typeof d.sdp!=='string'||!/^[-a-z0-9]{36}$/.test(d.room)||!/^[-a-z0-9]{36}$/.test(d.proof))throw Error('Wrong code type');return d;
 }
 async invite(){this.newPeer(true,crypto.randomUUID(),crypto.randomUUID());return this.localCode('offer')}
 async join(code){const d=this.read(code,'offer');this.newPeer(false,d.room,d.proof);if(this.pc&&d.sdp)await this.pc.setRemoteDescription({type:'offer',sdp:d.sdp});else if(this.pc){this.pc.close();this.pc=null}return this.localCode('answer')}
 async accept(code){
  if(!this.host)throw Error('Create an invitation first');
  const d=this.read(code,'answer');if(d.room!==this.room||d.proof!==this.proof)throw Error('Different room');
  if(this.pc&&d.sdp)await this.pc.setRemoteDescription({type:'answer',sdp:d.sdp});
  this.accepted=true;this.bus?.postMessage({kind:'accepted',proof:this.proof});
 }
}
