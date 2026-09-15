import {createServer} from 'vite';
import puppeteer from 'puppeteer-core';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const label=process.argv[2]??'final',full=label==='final'||label.includes('full');
const directory='artifacts/char-face-003';mkdirSync(directory,{recursive:true});
const sourcePaths=['engine/src/geometry/sculpt-fields.js','engine/src/geometry/topology-ops.js',
  'src/game/character/hero-face.js','src/game/character/head-profile.js','src/game/character/orbital-pockets.js',
  'src/game/character/hero-eyes.js','src/game/character/athletic-body.js','src/game/character/continuous-body.js',
  'src/game/character/opponent-boxer.js','src/game/assets/fighter-face.js','src/game/validation/models.js'];
const hashes=()=>Object.fromEntries(sourcePaths.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const sourceHashes=hashes();
const server=await createServer({server:{host:'127.0.0.1',port:5183,strictPort:true}});
await server.listen();
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
try{
  const page=await browser.newPage(),errors=[],captures=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewport({width:1000,height:1000});
  await page.goto('http://127.0.0.1:5183/?validation=models');
  await page.waitForFunction(()=>window.__SUMO_IS_A_BOXER__?.validation?.models,{timeout:120000});
  async function capture(name){
    const data=await page.evaluate(()=>window.__SUMO_IS_A_BOXER__.validation.models.capture());
    const file=label+'-'+name+'.png';writeFileSync(directory+'/'+file,Buffer.from(data.split(',')[1],'base64'));captures.push(file);
  }
  const views=full?await page.evaluate(()=>window.__SUMO_IS_A_BOXER__.validation.models.head.views):['front','left_profile','front_left_three_quarter'];
  for(const view of views){
    await page.evaluate(view=>{const m=window.__SUMO_IS_A_BOXER__.validation.models;m.show('front_neutral');m.head.hair(false);m.head.mode('clay');m.head.view(view);},view);
    await capture(view);
  }
  if(full){
    for(const mode of ['normals','wireframe','silhouette','production']){
      await page.evaluate(mode=>{const m=window.__SUMO_IS_A_BOXER__.validation.models;m.show('front_neutral');m.head.mode(mode);m.head.view(mode==='normals'?'left_ear':'front_left_three_quarter');},mode);
      await capture(mode);
    }
    await page.evaluate(()=>{const m=window.__SUMO_IS_A_BOXER__.validation.models;m.head.mode('production');m.head.hair(true);m.head.view('front_left_three_quarter');});
    await capture('hair');
  }
  const motion={},samples={};
  if(label==='final'){
    for(const state of ['jab_extension','cross_extension','head_reaction','body_reaction']){
      motion[state]=[];
      for(const progress of [0,.25,.5,.75,1]){
        await page.evaluate(({state,progress})=>{const m=window.__SUMO_IS_A_BOXER__.validation.models;m.show(state);m.scrub(progress);m.head.hair(false);m.head.mode('clay');m.head.view('front_left_three_quarter');},{state,progress});
        await capture(state+'-'+progress);motion[state].push(progress);
      }
      await page.evaluate(state=>window.__SUMO_IS_A_BOXER__.validation.models.play(state),state);
      await page.evaluate(()=>window.__SUMO_IS_A_BOXER__.validation.models.sample(2000));
    }
    for(const mode of ['shaded','production']){
      await page.evaluate(mode=>{const m=window.__SUMO_IS_A_BOXER__.validation.models;m.show('front_neutral');m.head.hair(mode==='production');m.head.mode(mode==='production'?'production':'clay');m.focus('face');},mode);
      await page.evaluate(()=>window.__SUMO_IS_A_BOXER__.validation.models.sample(1500));
      samples[mode]=await page.evaluate(()=>window.__SUMO_IS_A_BOXER__.validation.models.sample(5000));
    }
    await page.evaluate(()=>{const m=window.__SUMO_IS_A_BOXER__.validation.models;m.play('jab_extension');});
    samples.motion=await page.evaluate(()=>window.__SUMO_IS_A_BOXER__.validation.models.sample(5000));
  }
  const report=await page.evaluate(()=>{const m=window.__SUMO_IS_A_BOXER__.validation.models;return {certification:m.body.certification(),metrics:m.metrics()};});
  assert.deepEqual(hashes(),sourceHashes,'capture source changed during browser run');
  writeFileSync(directory+'/'+label+'.json',JSON.stringify({...report,sourceHashes,views,captures,motion,samples,errors},null,2));
  assert.deepEqual(errors,[]);assert.equal(report.certification.valid,true);
  console.log(JSON.stringify({captures:captures.length,certification:report.certification}));
}finally{await browser.close();await server.close();}
