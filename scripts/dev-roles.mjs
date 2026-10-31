import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['scripts/run-framework.mjs','dev',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,STUDIO_TEST_IDENTITIES:'1'}});
child.on('exit',code=>{process.exitCode=code??1});
