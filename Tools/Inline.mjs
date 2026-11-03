// Inline the built JS and CSS into one HTML file that runs by double-clicking.
// No dependencies. Usage: node Tools/Inline.mjs (after `vite build`).
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve('dist');
let html = readFileSync(resolve(dist, 'index.html'), 'utf8');
const used = [];

const localPath = (href) => resolve(dist, href.replace(/^\.?\//, ''));

// Stylesheet -> <style>
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi, (tag) => {
  const href = /href="([^"]+)"/i.exec(tag)?.[1];
  if (!href) return tag;
  const css = readFileSync(localPath(href), 'utf8');
  used.push(href);
  return `<style>\n${css}\n</style>`;
});

// External script -> inline script. Escape any closing tag inside the bundle.
html = html.replace(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)><\/script>/gi, (_tag, pre, src, post) => {
  const js = readFileSync(localPath(src), 'utf8').replace(/<\/script/gi, '<\\/script');
  used.push(src);
  const attrs = `${pre}${post}`.replace(/\s*crossorigin(="[^"]*")?/gi, '').trim();
  return `<script${attrs ? ` ${attrs}` : ''}>\n${js}\n</script>`;
});

// Preload hints are pointless once everything is inline.
html = html.replace(/<link\b[^>]*rel="modulepreload"[^>]*>/gi, '');

const out = resolve(dist, 'VibecoderSimulator.html');
writeFileSync(out, html);
const kb = (p) => (statSync(p).size / 1024).toFixed(0);
console.log(`inlined ${used.length} file(s): ${used.join(', ')}`);
console.log(`wrote ${out} (${kb(out)} KB)`);

const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
const leftovers = [...markup.matchAll(/(?:src|href)="([^"]+)"/gi)]
  .map((m) => m[1])
  .filter((v) => !v.startsWith('data:') && !v.startsWith('#'));
if (leftovers.length) {
  console.error(`WARNING: ${leftovers.length} external reference(s) remain: ${leftovers.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('no external references: the file is self-contained');
}
