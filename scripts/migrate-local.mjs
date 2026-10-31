import './sites-env.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=process.cwd();
let built;
try { built=JSON.parse(await readFile(resolve(root,'dist/server/wrangler.json'),'utf8')); }
catch { throw new Error('Execute npm run build antes de aplicar as migrações locais.'); }
const config={name:'agenda-local-migrations',compatibility_date:'2026-05-15',d1_databases:built.d1_databases.map(db=>({...db,migrations_dir:resolve(root,'drizzle')}))};
await mkdir(resolve(root,'.sites-runtime'),{recursive:true});
await writeFile(resolve(root,'.sites-runtime/local-d1.json'),JSON.stringify(config,null,2));
const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config','.sites-runtime/local-d1.json','--persist-to','.wrangler/state'],{cwd:root,stdio:'inherit',env:process.env});
if(result.error)throw result.error;process.exitCode=result.status??1;
