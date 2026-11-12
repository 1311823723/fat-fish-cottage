import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ROOT} from '../src/config.mjs';
const adapters=['game-core-adapter.mjs','game-public-adapter.mjs','game-bridge-hooks.mjs'];
const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const json=value=>JSON.stringify(value,null,2)+'\n';
function loopback(value){const url=new URL(value);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('连接地址必须是本机 HTTP 地址');return url.origin;}
export function linkBridge({gameRoot=ROOT,bridgeRoot,apply=false}){
  gameRoot=fs.realpathSync(gameRoot);bridgeRoot=fs.realpathSync(bridgeRoot);
  const lower=p=>path.resolve(p).toLowerCase();
  if(lower(gameRoot)===lower(bridgeRoot)||lower(gameRoot).startsWith(lower(bridgeRoot)+path.sep)||lower(bridgeRoot).startsWith(lower(gameRoot)+path.sep))throw Error('小屋和桥接须放在两个独立目录');
  const configFile=path.join(gameRoot,'config.local.json');
  if(!fs.existsSync(configFile))throw Error('先在小屋运行 npm run setup -- --defaults');
  const config=readJSON(configFile);
  if(String(config.adapterSecret||'').length<32||String(config.relaySecret||'').length<32)throw Error('本机连接凭据缺失，不自动替换已有密钥');
  const port=Number(config.port||3103);if(!Number.isInteger(port)||port<1||port>65535)throw Error('核心端口无效');
  const bridgeFile=path.join(bridgeRoot,'src/bridge.js'),gatewayFile=path.join(bridgeRoot,'src/room-public-server.mjs');
  const source=fs.readFileSync(bridgeFile,'utf8'),gateway=fs.readFileSync(gatewayFile,'utf8');
  const installed=source.includes('installGameCore');
  if(installed&&(!source.includes('startGameBridge')||!gateway.includes('routeGame')||!gateway.includes('installGameEvents')))throw Error('检测到部分接入；请先恢复备份或按迁移说明检查，未写入');
  const linkFile=path.join(bridgeRoot,'state/game-core-link.json');
  const previous=fs.existsSync(linkFile)?readJSON(linkFile):{};
  if(previous.secret&&previous.secret!==config.adapterSecret)throw Error('两端已有连接凭据不同；请人工核对，未覆盖');
  if(previous.relaySecret&&previous.relaySecret!==config.relaySecret)throw Error('两端已有转发凭据不同；请人工核对，未覆盖');
  const url='http://127.0.0.1:'+port;
  const gatewayUrl=loopback(config.bridge?.gatewayUrl||'http://127.0.0.1:3102');
  const bridgeUrl=loopback(config.bridge?.url||'http://127.0.0.1:3100');
  const origins=[...new Set([...(config.allowedOrigins||[]),...(previous.publicOrigins||[]),gatewayUrl])];
  for(const origin of origins){const u=new URL(origin);if(!['http:','https:'].includes(u.protocol)||u.origin!==origin)throw Error('来源地址无效');}
  const writes=[];
  let stage;
  try{
    if(!installed){
      stage=fs.mkdtempSync(path.join(os.tmpdir(),'fatfish-link-'));
      execFileSync(process.execPath,[path.join(gameRoot,'scripts/stage-bridge.mjs'),bridgeRoot,stage],{cwd:gameRoot,stdio:'pipe',windowsHide:true});
      for(const name of ['bridge.js','room-public-server.mjs'])writes.push({file:path.join(bridgeRoot,'src',name),data:fs.readFileSync(path.join(stage,'src',name))});
    }
    for(const name of adapters)writes.push({file:path.join(bridgeRoot,'src',name),data:fs.readFileSync(path.join(gameRoot,'adapters',name))});
  }finally{if(stage&&path.dirname(stage)===os.tmpdir()&&path.basename(stage).startsWith('fatfish-link-'))fs.rmSync(stage,{recursive:true,force:true});}
  const link={...previous,enabled:true,protocolVersion:1,url,secret:config.adapterSecret,relaySecret:config.relaySecret,publicOrigins:origins};
  // v1 reads photos over the authenticated API; preserve an older configured
  // directory for rollback, but do not create a new filesystem dependency.
  writes.push({file:linkFile,data:Buffer.from(json(link))});
  const next={...config,allowedOrigins:origins,bridge:{...config.bridge,enabled:true,url:bridgeUrl,gatewayUrl}};
  delete next.bridge.root;
  writes.push({file:configFile,data:Buffer.from(json(next))});
  const changes=writes.filter(item=>!fs.existsSync(item.file)||!fs.readFileSync(item.file).equals(item.data));
  const summary={applied:false,mode:installed?'upgrade':'first-link',changedFiles:changes.length,protocolVersion:1,restartRequired:changes.length>0,credentialsPrinted:false};
  if(!apply||!changes.length)return {...summary,applied:apply};
  const backup=path.join(gameRoot,'state/backups/bridge-link-'+Date.now());fs.mkdirSync(backup,{recursive:true});
  const originals=changes.map((item,index)=>({...item,original:fs.existsSync(item.file)?fs.readFileSync(item.file):null,index}));
  for(const item of originals)if(item.original)fs.writeFileSync(path.join(backup,String(item.index)+'.bak'),item.original,{mode:0o600});
  fs.writeFileSync(path.join(backup,'restore.json'),json(originals.map(item=>({file:item.file,backup:item.original?String(item.index)+'.bak':null}))),{mode:0o600});
  const done=[];
  try{
    for(const item of originals){fs.mkdirSync(path.dirname(item.file),{recursive:true});const temp=item.file+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(temp,item.data,{mode:0o600});fs.renameSync(temp,item.file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}done.push(item);}
  }catch(error){for(const item of done.reverse()){if(item.original)fs.writeFileSync(item.file,item.original,{mode:0o600});else fs.unlinkSync(item.file);}throw error;}
  return {...summary,applied:true,backup:'state/backups/'+path.basename(backup)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.join(ROOT,'scripts/link-bridge.mjs')){
 const index=process.argv.indexOf('--bridge');
 if(index<0||!process.argv[index+1])throw Error('用法：npm run bridge:link -- --bridge <聊天仓库目录> [--apply]');
 console.log(JSON.stringify(linkBridge({bridgeRoot:process.argv[index+1],apply:process.argv.includes('--apply')})));
}
