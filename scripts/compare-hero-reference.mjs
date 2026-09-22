import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
let puppeteer;try{puppeteer=(await import('puppeteer-core')).default;}catch{puppeteer=(await import('../engine/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).default;}
const output='artifacts/voxel-hero-003';
const cases=[
 ['front-structure','12-voxel-conversion.png',[194,35,320,457],'guide-front','clay-front',[450,145,380,520],'Approved smooth reference'],
 ['face-structure','10-face.png',[18,43,151,182],'guide-close-face','close-face',[355,45,570,660],'Approved face reference'],
 ['shoulder-structure','08-wireframe.png',[632,346,119,82],'guide-close-shoulder','close-shoulder',null,'Approved topology crop'],
 ['hand-structure','08-wireframe.png',[904,346,108,82],'guide-close-hand','close-hand',null,'Approved topology crop'],
 ['foot-structure','08-wireframe.png',[904,437,108,81],'guide-close-foot','close-foot',null,'Approved topology crop']
];
function data(path){const b=readFileSync(path);return 'data:'+(b[0]===255?'image/jpeg':'image/png')+';base64,'+b.toString('base64');}
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();await page.setViewport({width:1200,height:620,deviceScaleFactor:1});
 await page.setContent('<body style="margin:0"><canvas width="1200" height="620"></canvas></body>');
 const records=[];
 for(const [name,ref,crop,guide,hero,liveCrop,label] of cases){
  const sources=[data('references/visual/'+ref),data(join(output,guide+'.png')),data(join(output,hero+'.png'))];
  const sizes=await page.evaluate(async({sources,crop,liveCrop,label})=>{
   const images=await Promise.all(sources.map(src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;})));
   const ctx=document.querySelector('canvas').getContext('2d');ctx.fillStyle='#30353d';ctx.fillRect(0,0,1200,620);ctx.font='bold 20px Arial';ctx.textAlign='center';
   for(let j=0;j<3;j++){
    const img=images[j],scale=j===0?img.naturalWidth/1024:1;
    const r=j===0?crop.map(v=>v*scale):(liveCrop??[0,0,img.naturalWidth,img.naturalHeight]);
    const fit=Math.min(380/r[2],540/r[3]),w=r[2]*fit,h=r[3]*fit;
    ctx.drawImage(img,...r,j*400+(400-w)/2,55+(540-h)/2,w,h);
    ctx.fillStyle='#eeeeee';ctx.fillText([label,'Live smooth guide','Live HERO surface'][j],j*400+200,32);
   }
   return images.map(i=>[i.naturalWidth,i.naturalHeight]);
  },{sources,crop,liveCrop,label});
  const file='comparison-'+name+'.png';await page.screenshot({path:join(output,file)});records.push({file,reference:ref,referenceCropAt1024Width:crop,guide:guide+'.png',hero:hero+'.png',liveCrop,sizes});console.log(file);
 }
 writeFileSync(join(output,'structure-comparisons.json'),JSON.stringify(records,null,2));
}finally{await browser.close();}
