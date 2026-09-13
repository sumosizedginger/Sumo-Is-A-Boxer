import {createServer} from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const output='artifacts/char-topology-002';fs.mkdirSync(output,{recursive:true});
const executablePath=[process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p));
const server=await createServer({server:{host:'127.0.0.1',port:5182}});await server.listen();
const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.setViewport({width:1100,height:1000});
 await page.goto('http://127.0.0.1:5182/?validation=models');await page.waitForFunction(()=>window.__SUMO_IS_A_BOXER__?.validation?.models,{timeout:90000});
 const inspect=fn=>page.evaluate(fn);
 const capture=async name=>{const data=await inspect(()=>window.__SUMO_IS_A_BOXER__.validation.models.capture());fs.writeFileSync(output+'/'+name+'.png',Buffer.from(data.split(',')[1],'base64'));};
 await inspect(()=>{const m=window.__SUMO_IS_A_BOXER__.validation.models;m.show('front_neutral');m.body.mode('shaded');});
 const visiblePixels=await inspect(async()=>{
   const image=new Image();image.src=window.__SUMO_IS_A_BOXER__.validation.models.capture();await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,c.width,c.height).data;let count=0;for(let i=0;i<rgba.length;i+=4)if(rgba[i]>85&&rgba[i+1]>85&&rgba[i+2]>85)count++;return count;
 });
 if(visiblePixels<15000)throw new Error('Rendered naked skin is missing or unexpectedly small: '+visiblePixels);
 const views=await inspect(()=>window.__SUMO_IS_A_BOXER__.validation.models.body.views);
 for(const v of views){await page.evaluate(v=>window.__SUMO_IS_A_BOXER__.validation.models.body.view(v),v);await capture('body-'+v);}
 for(const v of ['front','rear_three_quarter','left_shoulder','neck','pelvis_hip']){await page.evaluate(v=>{const m=window.__SUMO_IS_A_BOXER__.validation.models;m.body.mode('wireframe');m.body.view(v);},v);await capture('wire-'+v);}
 for(const state of ['front_neutral','high_guard','arm_raised','deep_elbow_flex','punch_extension','torso_twist','wide_stance','deep_knee_flex']){
   await page.evaluate(state=>{const m=window.__SUMO_IS_A_BOXER__.validation.models;m.show(state);m.body.mode('shaded');m.body.view('front_three_quarter');},state);await capture('pose-'+state);
 }
 await inspect(()=>{const m=window.__SUMO_IS_A_BOXER__.validation.models;m.show('front_neutral');m.body.mode('diagnostic');m.controls(false);});await page.screenshot({path:output+'/diagnostic-overlay.png'});
 await inspect(()=>{const m=window.__SUMO_IS_A_BOXER__.validation.models;m.show('front_neutral');m.body.mode('production');});await capture('after-production-front');
 const certification=await inspect(()=>window.__SUMO_IS_A_BOXER__.validation.models.body.certification());
 fs.writeFileSync(output+'/certification.json',JSON.stringify(certification,null,2));fs.writeFileSync(output+'/browser.json',JSON.stringify({views,visiblePixels,errors,url:page.url()},null,2));
 if(errors.length||!certification.valid||certification.skinWeightViolationCount)throw new Error(JSON.stringify({errors,certification}));
 console.log(JSON.stringify({views:views.length,certification},null,2));
}finally{await browser.close();await server.close();}
