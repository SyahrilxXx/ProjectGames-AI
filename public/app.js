const $=id=>document.getElementById(id);
let mode="login",token=localStorage.getItem("nexora_token"),user=null,socket=null;
function showToast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function setMode(next){mode=next;$("loginTab").classList.toggle("active",mode==="login");$("registerTab").classList.toggle("active",mode==="register");$("authTitle").textContent=mode==="login"?"Welcome back.":"Create your account."; $("authSubtitle").textContent=mode==="login"?"Login untuk melanjutkan petualanganmu.":"Buat akun untuk bergabung ke dunia NEXORA."; $("authSubmit").innerHTML=(mode==="login"?"ENTER WORLD":"CREATE ACCOUNT")+' <span>→</span>';$("confirmWrap").classList.toggle("hidden",mode!=="register");$("authError").textContent="";$("password").autocomplete=mode==="login"?"current-password":"new-password"}
$("loginTab").onclick=()=>setMode("login");$("registerTab").onclick=()=>setMode("register");
$("togglePassword").onclick=()=>{$("password").type=$("password").type==="password"?"text":"password";$("togglePassword").textContent=$("password").type==="password"?"SHOW":"HIDE"};
$("authForm").onsubmit=async e=>{e.preventDefault();$("authError").textContent="";const username=$("username").value.trim(),password=$("password").value;if(mode==="register"&&password!==$("confirmPassword").value){$("authError").textContent="Konfirmasi password belum cocok.";return}
  const btn=$("authSubmit");btn.disabled=true;btn.textContent="PLEASE WAIT...";
  try{const r=await fetch("/api/"+mode,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});const data=await r.json();if(!r.ok)throw Error(data.error||"Terjadi kesalahan.");token=data.token;user=data.user;localStorage.setItem("nexora_token",token);enterGame()}
  catch(err){$("authError").textContent=err.message}finally{btn.disabled=false;$("authSubmit").innerHTML=(mode==="login"?"ENTER WORLD":"CREATE ACCOUNT")+' <span>→</span>'}};
async function enterGame(){if(!token)return;try{const r=await fetch("/api/me",{headers:{Authorization:"Bearer "+token}});if(!r.ok)throw Error();const d=await r.json();user=d.user}catch{logout(false);return}
  $("authScreen").classList.add("hidden");$("gameScreen").classList.remove("hidden");$("welcomeName").textContent=user.username;$("userLabel").textContent=user.username.toUpperCase();connectSocket()}
function logout(notify=true){if(socket){socket.disconnect();socket=null}localStorage.removeItem("nexora_token");token=null;user=null;$("gameScreen").classList.add("hidden");$("authScreen").classList.remove("hidden");if(notify)showToast("Kamu sudah keluar dari dunia.")}
$("logoutBtn").onclick=()=>logout();$("leaveWorld").onclick=()=>logout();
let players=new Map(),selfSocketId=null,world={width:1800,height:1100},me={x:900,y:550},keys={},lastSent=0,emoteTimers={};
const canvas=$("world"),ctx=canvas.getContext("2d");
function connectSocket(){socket=io({auth:{token}});socket.on("connect",()=>showToast("Terhubung ke Nebula Frontier"));socket.on("connect_error",err=>{showToast(err.message==="AUTH_REQUIRED"?"Sesi tidak valid. Login kembali.":"Koneksi server gagal.");if(err.message==="AUTH_REQUIRED")logout(false)});
 socket.on("world:init",d=>{selfSocketId=d.selfId;world=d.world;players.clear();d.players.forEach(p=>players.set(p.id,p));let self=d.players.find(p=>p.id===user.id);if(self)me={x:self.x,y:self.y};renderPlayers()});
 socket.on("player:joined",p=>{players.set(p.id,p);renderPlayers();if(p.id!==user.id)addSystem(`${p.username} joined the world`)});
 socket.on("player:moved",p=>{for(const v of players.values())if(v.id===p.id){v.x=p.x;v.y=p.y;break}});
 socket.on("player:left",p=>{let found=[...players.values()].find(v=>v.id===p.id);players.delete(p.id);renderPlayers();if(found)addSystem(`${found.username} left the world`)});
 socket.on("world:chat",m=>addChat(m));socket.on("player:emote",d=>{emoteTimers[d.id]=Date.now()+1600});
}
function renderPlayers(){$("onlineCount").textContent=players.size+" PLAYER"+(players.size===1?"":"S");$("playerList").innerHTML=[...players.values()].map(p=>`<div class="player-row"><i class="player-dot" style="color:${p.color};background:${p.color}"></i><b>${escapeHtml(p.username)}${p.id===user?.id?" (YOU)":""}</b><small>ONLINE</small></div>`).join("")}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function addSystem(text){const el=document.createElement("div");el.className="system-msg";el.textContent=text;$("chatMessages").appendChild(el);scrollChat()}
function addChat(m){const el=document.createElement("div");el.className="chat-message";const tm=new Date(m.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});el.innerHTML=`<b>${escapeHtml(m.username)}</b>${escapeHtml(m.message)}<time>${tm}</time>`;$("chatMessages").appendChild(el);scrollChat()}
function scrollChat(){$("chatMessages").scrollTop=$("chatMessages").scrollHeight}
$("chatForm").onsubmit=e=>{e.preventDefault();let v=$("chatInput").value.trim();if(v&&socket?.connected)socket.emit("world:chat",v);$("chatInput").value=""};
document.querySelectorAll("[data-emote]").forEach(b=>b.onclick=()=>socket?.emit("world:emote",b.dataset.emote));
document.addEventListener("keydown",e=>{if(e.target.matches("input,textarea"))return;const k=e.key.toLowerCase();if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k)){keys[k]=true;e.preventDefault()}});
document.addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false});
// Touch controls: pointer events support Android phones and tablets.
const touchMap={up:"w",down:"s",left:"a",right:"d"};
function releaseTouch(){Object.values(touchMap).forEach(k=>keys[k]=false)}
document.querySelectorAll("[data-dir]").forEach(btn=>{
  const dir=btn.dataset.dir,key=touchMap[dir];
  btn.addEventListener("pointerdown",e=>{e.preventDefault();btn.setPointerCapture?.(e.pointerId);keys[key]=true;btn.classList.add("pressed")});
  const release=e=>{e.preventDefault();keys[key]=false;btn.classList.remove("pressed")};
  ["pointerup","pointercancel","lostpointercapture"].forEach(ev=>btn.addEventListener(ev,release));
});
window.addEventListener("blur",releaseTouch);document.addEventListener("visibilitychange",()=>{if(document.hidden)releaseTouch()});
canvas.addEventListener("contextmenu",e=>e.preventDefault());
function draw(t){let w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);let camX=me.x-w/2,camY=me.y-h/2;camX=Math.max(0,Math.min(world.width-w,camX));camY=Math.max(0,Math.min(world.height-h,camY));
 let g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,"#0b2b43");g.addColorStop(1,"#101d38");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 ctx.strokeStyle="rgba(103,190,219,.09)";ctx.lineWidth=1;for(let x=-camX%50;x<w;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=-camY%50;y<h;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
 // floating islands / ruins
 for(let i=0;i<13;i++){let wx=(i*283+150)%world.width,wy=(i*191+100)%world.height,x=wx-camX,y=wy-camY;if(x<-100||y<-100||x>w+100||y>h+100)continue;ctx.fillStyle="#12334a";ctx.strokeStyle="#2b6680";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,45+(i%3)*12,22+(i%2)*10,-.3,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#2c7185";ctx.fillRect(x-4,y-28,8,18)}
 // landmarks
 const places=[["NOVA HUB",900,550],["CRYSTAL GARDEN",380,250],["ANCIENT ARCHIVE",1430,270],["SKY DOCK",430,870],["MYSTIC FALLS",1450,850]];
 places.forEach((p,i)=>{let x=p[1]-camX,y=p[2]-camY;if(x<-120||y<-80||x>w+120||y>h+80)return;let pulse=Math.sin(t/600+i)*.5+.5;ctx.fillStyle="#143b52";ctx.strokeStyle="#4dc9df";ctx.shadowBlur=18;ctx.shadowColor="#36c6e8";ctx.beginPath();ctx.arc(x,y,25+pulse*3,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle="#c7f5ff";ctx.font="bold 13px Manrope";ctx.textAlign="center";ctx.fillText("✧",x,y+5);ctx.font="11px Manrope";ctx.fillStyle="#b5d5e7";ctx.fillText(p[0],x,y+43)});
 // players
 for(const p of players.values()){let isMe=p.id===user?.id,x=(isMe?me.x:p.x)-camX,y=(isMe?me.y:p.y)-camY;if(x<-30||y<-30||x>w+30||y>h+30)continue;ctx.save();ctx.shadowBlur=18;ctx.shadowColor=p.color;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(x,y,isMe?12:10,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle="#e5fbff";ctx.lineWidth=2;ctx.stroke();ctx.fillStyle="#effaff";ctx.font="bold 12px Manrope";ctx.textAlign="center";ctx.fillText(p.username+(emoteTimers[p.id]>Date.now()?" ✦":""),x,y-19);ctx.restore()}
 $("coords").textContent=`X ${Math.round(me.x)} · Y ${Math.round(me.y)}`;
}
let prev=0;function loop(t){let dt=Math.min((t-prev)/16||1,2);prev=t;let speed=3.1*dt,dx=0,dy=0;if(keys.w||keys.arrowup)dy-=speed;if(keys.s||keys.arrowdown)dy+=speed;if(keys.a||keys.arrowleft)dx-=speed;if(keys.d||keys.arrowright)dx+=speed;if(dx&&dy){dx*=.707;dy*=.707}me.x=Math.max(20,Math.min(world.width-20,me.x+dx));me.y=Math.max(20,Math.min(world.height-20,me.y+dy));if(socket?.connected&&(dx||dy)&&t-lastSent>45){socket.emit("player:move",me);lastSent=t}draw(t);requestAnimationFrame(loop)}requestAnimationFrame(loop);
if(token)enterGame();
