import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
const dist = resolve(process.argv[2] ?? 'dist');
let html = await readFile(resolve(dist, 'index.html'), 'utf8');
async function asset(url) {
  const path = resolve(dist, url.replace(/^\.\//, ''));
  if (relative(dist, path).startsWith('..')) throw new Error('Asset path escapes dist.');
  return readFile(path, 'utf8');
}
for (const match of [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)]) {
  const js = await asset(match[1]);
  html = html.replace(match[0], () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
}
for (const match of [...html.matchAll(/<link\b[^>]*href="([^"]+)"[^>]*>/g)]) {
  if (!match[0].includes('stylesheet')) throw new Error('Unexpected external build link.');
  const css = await asset(match[1]); html = html.replace(match[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
}
const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
if (/<(?:script|link)\b[^>]*(?:src|href)=/i.test(markup)) throw new Error('Portable build contains remote assets.');
await writeFile(resolve(dist, 'index.html'), html);
console.log('Portable dist/index.html generated: all code and styles inline.');
