import puppeteer from 'puppeteer-core';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1280,height:900});
 await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__SUMO_IS_A_BOXER__?.report,{timeout:120000});
 await page.screenshot({path:'artifacts/char-face-003/game-start.png'});
 await page.focus('button.prompt');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__SUMO_IS_A_BOXER__.report().phase==='playing',{timeout:15000});
 await new Promise(r=>setTimeout(r,4000));
 await page.keyboard.down('KeyW');await new Promise(r=>setTimeout(r,900));await page.keyboard.up('KeyW');
 await page.mouse.down({button:'left'});await page.mouse.up({button:'left'});await new Promise(r=>setTimeout(r,700));
 await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});await new Promise(r=>setTimeout(r,1000));
 await page.screenshot({path:'artifacts/char-face-003/game-playing.png'});
 const report=await page.evaluate(()=>window.__SUMO_IS_A_BOXER__.report());
 assert.equal(report.phase,'playing');assert.equal(report.skinTriangles,112042);assert.deepEqual(errors,[]);
 writeFileSync('artifacts/char-face-003/game-smoke.json',JSON.stringify({actions:['start','advance','jab','cross'],report,errors},null,2));console.log(JSON.stringify({phase:report.phase,skinTriangles:report.skinTriangles,errors}));
}finally{await browser.close();}
