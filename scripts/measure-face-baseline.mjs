import {createServer} from 'vite';
import puppeteer from 'puppeteer-core';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

// Read-only source substitution reproduces the required checkpoint without a
// checkout, another branch, or overwriting any worktree file.
const checkpoint='30b1ecd99f69c5d862cbfe37ae5e3e694b9eee93';
const paths=['src/game/assets/fighter-face.js','src/game/character/anatomy-fields.js',
  'src/game/character/hero-guide-body.js','src/game/character/continuous-body.js',
  'src/game/character/opponent-sumo.js','src/game/validation/models.js'];
const sources=new Map(paths.map(path=>[resolve(path).replaceAll('\\','/'),
  execFileSync('git',['show',checkpoint+':'+path],{encoding:'utf8'})]));
const server=await createServer({plugins:[{name:'checkpoint-face-baseline',enforce:'pre',
  load(id){return sources.get(id.split('?')[0].replaceAll('\\','/'))??null;}}],
  server:{host:'127.0.0.1',port:5184,strictPort:true}});
await server.listen();
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1000,height:1000});
  await page.goto('http://127.0.0.1:5184/?validation=models');
  await page.waitForFunction(()=>window.__SUMO_IS_A_BOXER__?.validation?.models,{timeout:120000});
  const samples={};
  for(const mode of ['shaded','production']){
    await page.evaluate(mode=>{const m=window.__SUMO_IS_A_BOXER__.validation.models;m.show('front_neutral');m.body.mode(mode);m.focus('face');},mode);
    await page.evaluate(()=>window.__SUMO_IS_A_BOXER__.validation.models.sample(1500));
    samples[mode]=await page.evaluate(()=>window.__SUMO_IS_A_BOXER__.validation.models.sample(5000));
  }
  const certification=await page.evaluate(()=>window.__SUMO_IS_A_BOXER__.validation.models.body.certification());
  if(!certification.valid||certification.vertexCount!==23354||errors.length)throw new Error('Baseline reproduction mismatch: '+JSON.stringify({certification,errors}));
  writeFileSync('artifacts/char-face-003/baseline-steady.json',JSON.stringify({checkpoint,
    sourceHashes:Object.fromEntries([...sources].map(([path,code])=>[path,createHash('sha256').update(code).digest('hex')])),
    certification,samples,errors},null,2));
  console.log(JSON.stringify({checkpoint,vertices:certification.vertexCount,clayFPS:samples.shaded.fps,productionFPS:samples.production.fps}));
}finally{await browser.close();await server.close();}
