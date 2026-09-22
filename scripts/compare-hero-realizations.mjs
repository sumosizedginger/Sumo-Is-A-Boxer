import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
let puppeteer;try{puppeteer=(await import('puppeteer-core')).default;}catch{puppeteer=(await import('../engine/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).default;}
const directory='artifacts/voxel-hero-003-precision';
const retained=process.argv.includes('--retained');
const modes=retained?['surface','coherentSurface']:['surface','coherent-projected','coherent-smooth','coherent-5','coherent-7.5','coherent-10','coherent-15','coherentSurface'];
const labels=retained?['Retained surface presentation','Experimental constrained surface']:['A: independent surface samples','B: bounded projection only','C: smoothed surface orientation','D: 5 degree orientation','D: 7.5 degree orientation','D: 10 degree orientation','D: 15 degree orientation','E: 10 degrees + 4% isotropic overlap'];
const captureDirectory=mode=>retained?(mode==='surface'?'artifacts/voxel-hero-003':join(directory,'retained-coherentSurface')):join(directory,'comparison-'+mode);
const metrics=modes.map(mode=>({mode,...JSON.parse(readFileSync(join(captureDirectory(mode),'metrics.json'),'utf8')).metrics}));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:1,deviceScaleFactor:1});
 for(const view of ['clay-front','close-belly','close-face']){
  const panels=modes.map((mode,i)=>'<section><header>'+labels[i]+'</header><img src="data:image/png;base64,'+readFileSync(join(captureDirectory(mode),view+'.png')).toString('base64')+'"><footer>'+metrics[i].instances.toLocaleString('en-US')+' cubes / '+metrics[i].surface.toLocaleString('en-US')+' cells</footer></section>').join('');
  await page.setContent('<html><style>*{box-sizing:border-box}body{margin:0;background:#24282e;color:#eee;font:18px Arial}main{display:grid;grid-template-columns:1fr 1fr;gap:2px}section{background:#363c44}header{height:30px;padding:5px 12px;font-weight:bold}img{display:block;width:639px;height:359.4375px}footer{height:24px;padding:3px 12px;font-size:14px;color:#cbd0d8}</style><main>'+panels+'</main></html>');
  await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode()));});
  const path=join(directory,(retained?'retained-realization-':'realization-')+view+'-board.png');await page.screenshot({path,fullPage:true});console.log(path);
 }
 writeFileSync(join(directory,retained?'retained-realization-comparison.json':'realization-comparison.json'),JSON.stringify({modes,labels,metrics},null,2));
}finally{await browser.close();}
