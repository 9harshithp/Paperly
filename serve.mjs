import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('dist/',import.meta.url)),port=Number(process.env.PORT||8080);
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.webp':'image/webp','.ttf':'font/ttf'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!path.startsWith(resolve(root)+sep)){res.writeHead(403).end();return}
  const data=await readFile(path);res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'}).end(data);
 }catch{res.writeHead(404).end()}
}).listen(port,()=>console.log('Paperly running at http://localhost:'+port));
