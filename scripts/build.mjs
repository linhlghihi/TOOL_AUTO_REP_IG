import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist/extension', { recursive: true });
await build({ entryPoints: ['src/bridge/main.ts'], outdir: 'dist/bridge', bundle: true, platform: 'node', format: 'esm', packages: 'external', sourcemap: true });
for (const name of ['content', 'background', 'observer']) {
 await build({ entryPoints: [`src/extension/${name}.${name === 'content' ? 'tsx' : 'ts'}`], outfile: `dist/extension/${name}.js`, bundle: true, platform: 'browser', format: 'iife', target: 'chrome120', define: { 'process.env.NODE_ENV': '"production"' } });
}
await copyFile('src/extension/manifest.json', 'dist/extension/manifest.json');
console.log('Built dist/bridge and dist/extension');
