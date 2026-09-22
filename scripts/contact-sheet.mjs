import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
let puppeteer;try{puppeteer=(await import('puppeteer-core')).default;}catch{puppeteer=(await import('../engine/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).default;}
const directory=process.argv[2];if(!directory)throw Error('Usage: node scripts/contact-sheet.mjs <capture-directory> [filename-regex]');
const pattern=new RegExp(process.argv[3]??'^(guide-|clay-|close-|silhouette-|hero-production)');
const files=readdirSync(directory).filter(f=>f.endsWith('.png')&&pattern.test(f)&&!f.startsWith('contact-')).sort();
const prefix=process.argv[4]??'contact';if(!/^[a-z0-9-]+$/.test(prefix))throw Error('Invalid contact sheet prefix');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
try{const page=await browser.newPage();await page.setViewport({width:1600,height:1000});
 for(let start=0;start<files.length;start+=8){const panels=files.slice(start,start+8).map(file=>'<section><header>'+file+'</header><img src="data:image/png;base64,'+readFileSync(join(directory,file)).toString('base64')+'"></section>').join('');
 await page.setContent('<style>body{margin:0;background:#30363d;color:white;font:18px Arial}main{display:grid;grid-template-columns:800px 800px}header{height:28px;padding-left:10px}img{display:block;width:800px;height:450px;object-fit:contain}</style><main>'+panels+'</main>');
 await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode()));});
 const path=join(directory,prefix+'-'+String(start/8+1).padStart(2,'0')+'.png');await page.screenshot({path,fullPage:true});console.log(path);
 }writeFileSync(join(directory,prefix+'-index.json'),JSON.stringify({files},null,2));
}finally{await browser.close();}
