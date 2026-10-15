#!/usr/bin/env python3
"""Build a static hosted release from an already validated importable script.
python3 scripts/pack-hosted.py --artifact dist/dnd-panel-latest.json --out /path/to/dnd-panel-updates --write
Only public program files are emitted. No character cards, chats, game variables, or credentials.
"""
from pathlib import Path
import argparse,json,re,hashlib,gzip,subprocess
p=argparse.ArgumentParser();p.add_argument('--artifact',required=True);p.add_argument('--out',required=True);p.add_argument('--repository',default='didhogg/dnd-panel-updates');p.add_argument('--write',action='store_true');a=p.parse_args()
if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',a.repository):raise SystemExit('Invalid repository')
root=Path(__file__).resolve().parents[1];out=Path(a.out).resolve();package=json.loads(Path(a.artifact).read_text());source=package['content']
pattern=r'(const __DND_BUILD__=/\*DND_BUILD_META\*/)[^\n]+;';match=re.search(pattern,source)
if not match:raise SystemExit('Missing source build identity')
build=json.loads(match[0][match[0].index('*/')+2:-1]);normalized=re.sub(pattern,lambda m:m[1]+'"__DND_BUILD_PLACEHOLDER__";',source)
if hashlib.sha256(normalized.encode()).hexdigest()!=build['sourceSha256']:raise SystemExit('Source hash mismatch')
if package['type']!='script' or build['family']!='dnd-floating-panel-v4':raise SystemExit('Wrong component')
raw=source.encode();blob=gzip.compress(raw,compresslevel=9,mtime=0);digest=hashlib.sha256(blob).hexdigest();filename=build['version']+'-'+digest[:16]+'.js.gz'
manifest={'schemaVersion':1,'family':build['family'],'version':build['version'],'sequence':build['sequence'],'sourceSha256':build['sourceSha256'],'payloadSha256':digest,'bytes':len(blob),'encoding':'gzip','loaderMinVersion':1,'payloadUrl':f'https://raw.githubusercontent.com/{a.repository}/main/releases/{filename}'}
config={'family':build['family'],'repository':a.repository,'manifestUrl':f'https://raw.githubusercontent.com/{a.repository}/main/channel/stable.json','intervalMs':60000,'loaderVersion':1}
loader=(root/'src/hosted-loader.js').read_text();loader=re.sub(r'(const __DND_LOADER_CONFIG__=/\*DND_LOADER_CONFIG\*/)[^\n]+;',lambda m:m[1]+json.dumps(config,separators=(',',':'))+';',loader)
subprocess.run(['node','--check','--input-type=module'],input=loader,text=True,check=True)
bootstrap={k:v for k,v in package.items() if k!='content'};bootstrap.update(name='D&D面板_在线自动更新加载器（只需导入一次）',content=loader,info='固定GitHub更新源：'+config['manifestUrl']+'。启动及每分钟检查；校验成功且无未保存草稿/结算时自动切换。页头显示实际运行版，失败显示更新异常。首次启用后停用旧D&D脚本，保存草稿并重新载入一次。')
bootstrap['data']={k:v for k,v in bootstrap.get('data',{}).items() if k!='dnd_panel_release'};bootstrap['data']['dnd_panel_loader']=config
if not a.write:print(json.dumps({'plan':manifest,'output':str(out),'write':False},ensure_ascii=False,indent=2));raise SystemExit()
oldpath=out/'channel/stable.json'
if oldpath.exists():
 old=json.loads(oldpath.read_text())
 if old['sequence']>manifest['sequence'] or (old['sequence']==manifest['sequence'] and old!=manifest):raise SystemExit('Refusing same-sequence mutation or downgrade')
(out/'releases').mkdir(parents=True,exist_ok=True);(out/'channel').mkdir(exist_ok=True);(out/'src').mkdir(exist_ok=True);(out/'scripts').mkdir(exist_ok=True)
(out/'releases'/filename).write_bytes(blob);(out/'channel/stable.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(out/'loader.json').write_text(json.dumps(bootstrap,ensure_ascii=False)+'\n');(out/'src/hosted-loader.js').write_text(loader);(out/'scripts/pack-hosted.py').write_text(Path(__file__).read_text())
print(json.dumps({'manifest':manifest,'runtime_compressed_bytes':len(blob),'runtime_source_bytes':len(raw),'loader_bytes':len((out/'loader.json').read_bytes()),'files':[str(f.relative_to(out)) for f in out.rglob('*') if f.is_file()]},ensure_ascii=False,indent=2))
