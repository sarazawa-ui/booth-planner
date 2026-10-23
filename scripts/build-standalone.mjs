/**
 * `vite build` の出力を1枚のHTMLにまとめる。
 * 生成物: 配布用/ブースプランナー.html(ダブルクリックで開ける・共有ドライブやメールで配布する用)
 */
import fs from 'node:fs';
import path from 'node:path';

const dist = 'dist';
const outDir = '配布用';
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

/** インラインに埋め込むとき、終了タグと誤認される並びを無害化する */
const safe = (code) => code.replace(/<\/script/gi, '<\/script');
const readAsset = (href) => fs.readFileSync(path.join(dist, href.replace(/^\.?\//, '')), 'utf8');

let out = html;
out = out.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_m, src) => `<script type="module">\n${safe(readAsset(src))}\n</script>`);
out = out.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_m, href) => `<style>\n${readAsset(href)}\n</style>`);
// 分割された JS が残っていたら配布物として不完全なので止める
const left = /<(script|link)[^>]+(src|href)="\.?\/?assets\//.exec(out);
if (left) throw new Error('埋め込めなかった参照があります: ' + left[0]);

fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, 'ブースプランナー.html');
fs.writeFileSync(file, out);
console.log(`${file} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
