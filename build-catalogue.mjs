import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
await build({entryPoints:['src/catalogue-api.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:process.argv[2]||'dist/server/index.js',loader:{'.svg':'text','.html':'text','.css':'text','.js':'text'},minify:true,plugins:[{name:'raw-source',setup(b){b.onResolve({filter:/\?raw$/},a=>({path:resolve(dirname(a.importer),a.path.slice(0,-4)),namespace:'raw'}));b.onLoad({filter:/.*/,namespace:'raw'},async a=>({contents:await readFile(a.path,'utf8'),loader:'text'}));}}]});
