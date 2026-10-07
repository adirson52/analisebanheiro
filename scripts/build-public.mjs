import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
const inject='<script defer src="/access-config.js"></script><script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.min.js"></script><script defer src="/access-runtime.js"></script>';
const html=await readFile('index.html','utf8');
await writeFile('dist/index.html',html.replace(/<\/head>/i,inject+'</head>'));
for(const file of ['acesso.html','access.js','access.css','access-config.js','access-runtime.js','telemetry.js','dashboard_clusters_payload.json']){
 try{await copyFile(file,'dist/'+file);}catch(e){if(e.code!=='ENOENT'||!['telemetry.js','dashboard_clusters_payload.json'].includes(file))throw e;}
}
console.log('Original dashboard retained; shared access layer added; server source excluded.');

