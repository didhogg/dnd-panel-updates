/* DND_HOSTED_LOADER_V1: fixed bootstrap, downloaded UI owns its lifecycle. */
(()=>{
const __DND_LOADER_CONFIG__=/*DND_LOADER_CONFIG*/{"family":"dnd-floating-panel-v4","repository":"didhogg/dnd-panel-updates","manifestUrl":"https://raw.githubusercontent.com/didhogg/dnd-panel-updates/main/channel/stable.json","intervalMs":60000,"loaderVersion":1};
const cfg=__DND_LOADER_CONFIG__,host=window.parent,doc=host.document,key="__DND_HOSTED_LOADER_V1__";
const prior=host[key];if(prior?.active&&(!prior.frame||prior.frame.isConnected)){prior.check();return}
prior?.dispose();
let busy=false,applying=false,pending=null,lastGood=null,dead=false,attempt=0,notice=null,cachePromise=null,checkTimer=null,applyTimer=null;
const timers=new Set(),aborters=new Set();
const api={active:true,frame:window.frameElement,state:{status:"checking",message:"正在检查托管版本",running:null,available:null,lastCheck:null},check:()=>check(),apply:()=>apply(),dispose};
host[key]=api;
function later(fn,ms){const id=window.setTimeout(()=>{timers.delete(id);if(!dead)fn()},ms);timers.add(id);return id}
function publish(status,message){
 if(dead)return;api.state={...api.state,status,message,running:host.__DND_PANEL_RUNTIME_V1__?.build?.version||null};
 const runtime=host.__DND_PANEL_RUNTIME_V1__;
 if(runtime?.setUpdateState)runtime.setUpdateState(api.state);
 if(runtime?.active){notice?.remove();notice=null;return}
 if(!notice){notice=doc.createElement("div");notice.id="dnd-panel-load-status";notice.style.cssText="position:fixed;right:12px;top:18vh;z-index:100001;max-width:300px;padding:12px;background:#fff;color:#243b32;border:1px solid #526b60;border-radius:8px;font:14px/1.5 system-ui";const text=doc.createElement("span"),retry=doc.createElement("button");text.dataset.loaderMessage="1";retry.textContent="重试加载";retry.addEventListener("click",()=>check());notice.append(text,retry);doc.body.append(notice)}
 notice.querySelector('[data-loader-message]').textContent=message+" ";
}
function dispose(){if(dead)return;dead=true;const live=host.__DND_PANEL_RUNTIME_V1__;if(live?.ownerFrame===api.frame)live.dispose("loader-unload");cachePromise?.then(db=>db.close()).catch(()=>{});api.active=false;for(const id of timers)window.clearTimeout(id);for(const ctl of aborters)ctl.abort();watch.disconnect();notice?.remove();window.removeEventListener("pagehide",dispose);window.removeEventListener("unload",dispose);host.removeEventListener("focus",focus);doc.removeEventListener("visibilitychange",visible);if(host[key]===api)delete host[key]}
const watch=new host.MutationObserver(()=>{if(api.frame&&!api.frame.isConnected)dispose()});watch.observe(doc.body,{childList:true});
window.addEventListener("pagehide",dispose);window.addEventListener("unload",dispose);
function focus(){if(Date.now()-(api.state.lastCheck||0)>30000)check()}
function visible(){if(doc.visibilityState==="visible")focus()}
host.addEventListener("focus",focus);doc.addEventListener("visibilitychange",visible);
function database(){
 if(!cachePromise)cachePromise=new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(Error("本环境无离线缓存接口"));const req=window.indexedDB.open("dnd-panel-release-cache-v1",1);req.onupgradeneeded=()=>req.result.createObjectStore("releases");req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
 return cachePromise;
}
async function cache(mode,value){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction("releases",mode),store=tx.objectStore("releases");const req=mode==="readwrite"?store.put(value,cfg.repository):store.get(cfg.repository);tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error("离线缓存未提交"))})}
async function fetchFile(url,timeout){
 const ctl=new AbortController();aborters.add(ctl);const timer=window.setTimeout(()=>ctl.abort(),timeout);
 try{const response=await fetch(url,{cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer",redirect:"error",signal:ctl.signal});if(!response.ok)throw Error("HTTP "+response.status);return await response.arrayBuffer()}finally{window.clearTimeout(timer);aborters.delete(ctl)}
}
async function sha(bytes){if(!window.crypto?.subtle)throw Error("缺少安全校验接口，未执行下载代码");return Array.from(new Uint8Array(await window.crypto.subtle.digest("SHA-256",bytes)),n=>n.toString(16).padStart(2,"0")).join("")}
function manifest(value){
 if(value?.schemaVersion!==1||value.family!==cfg.family||typeof value.version!=="string"||!Number.isSafeInteger(value.sequence)||value.sequence<1||!Number.isSafeInteger(value.loaderMinVersion)||value.loaderMinVersion<1||value.loaderMinVersion>cfg.loaderVersion)throw Error("托管清单格式或加载器版本不兼容");
 if(!/^[a-f0-9]{64}$/.test(value.payloadSha256)||!/^[a-f0-9]{64}$/.test(value.sourceSha256)||!Number.isSafeInteger(value.bytes)||value.bytes<1||value.bytes>50*1024*1024)throw Error("托管清单的大小或指纹无效");
 const u=new URL(value.payloadUrl);const prefix="/"+cfg.repository+"/";
 if(u.origin!=="https://raw.githubusercontent.com"||!u.pathname.startsWith(prefix)||u.username||u.password||u.search||u.hash||!/^\/(?:[^/]+\/){2}(?:main|[a-f0-9]{40})\/releases\/[A-Za-z0-9._/-]+\.js(?:\.gz)?$/.test(u.pathname)||u.pathname.includes(".."))throw Error("运行包地址不属于已授权仓库");
 if(!["gzip","identity"].includes(value.encoding))throw Error("未知运行包编码");return value;
}
async function verified(m,bytes){
 if(bytes.byteLength!==m.bytes||await sha(bytes)!==m.payloadSha256)throw Error("运行包校验失败，未替换当前版本");
 let source;
 if(m.encoding==="gzip"){
  if(typeof DecompressionStream!=="function")throw Error("当前浏览器缺少gzip解压能力，请更新客户端；当前版本保持运行");
  source=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
 }else source=new TextDecoder().decode(bytes);
 if(source.length>50*1024*1024)throw Error("解压后运行包超出大小限制");
 const match=source.match(/const __DND_BUILD__=\/\*DND_BUILD_META\*\/([^\n]+);/);if(!match)throw Error("运行包缺少版本凭证");
 const build=JSON.parse(match[1]);
 if(build.family!==m.family||build.version!==m.version||build.sequence!==m.sequence||build.sourceSha256!==m.sourceSha256)throw Error("运行包版本与清单不一致");
 const normalized=source.replace(/(const __DND_BUILD__=\/\*DND_BUILD_META\*\/)[^\n]+;/,'$1"__DND_BUILD_PLACEHOLDER__";');
 if(await sha(new TextEncoder().encode(normalized))!==m.sourceSha256)throw Error("代码指纹与清单不一致");return source;
}
async function apply(){
 if(applyTimer){window.clearTimeout(applyTimer);timers.delete(applyTimer);applyTimer=null}
 if(!pending||dead||applying)return;const runtime=host.__DND_PANEL_RUNTIME_V1__;
 if(runtime?.active&&runtime.canHotUpdate&&!runtime.canHotUpdate()){publish("pending","新版 "+pending.manifest.version+" 已下载，等待保存草稿或完成当前结算");applyTimer=later(()=>apply(),2000);return}
 applying=true;const target=pending,previous=runtime?.build,view=runtime?.captureView?.();
 const url=URL.createObjectURL(new Blob([target.source],{type:"text/javascript"}));
 try{
  publish("applying","正在切换到 "+target.manifest.version);await import(url);
  if(dead)return;
  const live=host.__DND_PANEL_RUNTIME_V1__;
  if(!live?.active||live.build.sequence!==target.manifest.sequence||live.build.sourceSha256!==target.manifest.sourceSha256){
   if(live?.active&&live.canHotUpdate&&!live.canHotUpdate()){publish("pending","等待保存草稿或完成当前结算");applyTimer=later(()=>apply(),2000);return}
   throw Error("下载完成但目标版本未启动；实际运行 "+(live?.build?.version||"无"));
  }
  live.restoreView?.(view);lastGood=target;pending=null;publish(target.offline?"offline":"current",target.offline?"离线使用已校验缓存 "+live.build.version:"已核对托管版本 "+live.build.version);
  if(!target.offline){try{await cache("readwrite",{manifest:target.manifest,bytes:target.bytes})}catch(err){publish("current","运行 "+live.build.version+"；离线缓存不可用："+err.message)}}
 }catch(err){
  const originalError=err.message;
  if(lastGood&&previous?.sourceSha256===lastGood.manifest.sourceSha256){
   const live=host.__DND_PANEL_RUNTIME_V1__;if(live?.build.sourceSha256!==previous.sourceSha256)live?.dispose("failed-update");
   if(!host.__DND_PANEL_RUNTIME_V1__?.active){const restoreUrl=URL.createObjectURL(new Blob([lastGood.source],{type:"text/javascript"}));try{await import(restoreUrl);host.__DND_PANEL_RUNTIME_V1__?.restoreView?.(view)}catch(restoreError){console.error("[D&D更新恢复]",restoreError.message)}finally{URL.revokeObjectURL(restoreUrl)}}
  }
  publish("error","更新未完成："+originalError+"；实际运行 "+(host.__DND_PANEL_RUNTIME_V1__?.build?.version||"无"));
 }finally{applying=false;URL.revokeObjectURL(url)}
}
async function check(){
 if(dead||busy)return;if(checkTimer){window.clearTimeout(checkTimer);timers.delete(checkTimer);checkTimer=null}busy=true;attempt++;
 try{
  publish("checking","正在检查GitHub托管版本");
  const u=new URL(cfg.manifestUrl);u.searchParams.set("_check",Date.now()+"-"+attempt);
  const m=manifest(JSON.parse(new TextDecoder().decode(await fetchFile(u.href,15000))));
  api.state.available=m.version;api.state.lastCheck=Date.now();
  const current=host.__DND_PANEL_RUNTIME_V1__;
  if(current?.active&&current.build.sequence>=m.sequence){
   if(current.build.sequence===m.sequence&&current.build.sourceSha256!==m.sourceSha256)throw Error("托管同一版本包含不同代码，请发布新版本号");
   pending=null;publish(current.build.sequence===m.sequence?"current":"ahead",current.build.sequence===m.sequence?"已核对托管版本 "+m.version:"本机运行 "+current.build.version+"；托管版本较旧，未降级");return;
  }
  if(!pending||pending.manifest.payloadSha256!==m.payloadSha256){
   publish("downloading","发现 "+m.version+"，正在下载并校验");const bytes=await fetchFile(m.payloadUrl,120000);const source=await verified(m,bytes);if(dead)return;pending={manifest:m,bytes,source};
  }
  await apply();
 }catch(err){
  publish("error","检查更新失败："+err.message);
  if(!host.__DND_PANEL_RUNTIME_V1__?.active){
   try{const saved=await cache("readonly");if(saved){const m=manifest(saved.manifest),source=await verified(m,saved.bytes);pending={manifest:m,source,bytes:saved.bytes,offline:true};await apply()}}
   catch(cacheError){publish("error","在线加载与离线缓存均不可用："+err.message+"；"+cacheError.message)}
  }
 }finally{busy=false;if(!dead)checkTimer=later(()=>check(),cfg.intervalMs)}
}
publish("checking","正在加载D&D面板");check();
})();
