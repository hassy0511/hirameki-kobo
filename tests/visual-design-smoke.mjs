import assert from 'node:assert/strict';
import fs from 'node:fs';

const rootUrl = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, rootUrl), 'utf8');
const app = read('app.js');
const css = read('styles.css');
const html = read('index.html');
const sw = read('sw.js');

const assets = [
  'assets/workshop-hero-v1.jpg',
  'assets/story-guides-v1.jpg',
  'assets/measure-methods-v1.jpg',
  'assets/workshop-objects-v1.jpg'
];

for (const asset of assets) {
  const url = new URL(asset, rootUrl);
  assert(fs.existsSync(url), asset + ' がありません');
  const size = fs.statSync(url).size;
  assert(size > 100_000, asset + ' が画像として小さすぎます');
  assert(size < 500_000, asset + ' がiPad配信向け上限を超えています');
  assert(sw.includes('./' + asset), asset + ' がオフラインキャッシュ対象ではありません');
}

assert(html.includes('rel="preload" as="image" href="assets/workshop-hero-v1.jpg"'), 'ヒーロー画像を先読みしていません');
assert(sw.includes('hirameki-kobo-v8'), 'ビジュアル改善版のキャッシュ世代が不正です');

assert(app.includes('VISUAL_TOKEN_META'), '絵文字から教材オブジェクトへ変換する層がありません');
assert(app.includes('visualTokenHtml(icon)'), 'タップ部品が教材オブジェクトを使っていません');
assert(app.includes('methodSceneHtml(visual.sceneId, false)'), '長さの場面画像が問題表示に使われていません');
assert(app.includes('methodSceneHtml(String(option.value), true)'), '長さの選択肢が場面画像と対応していません');
assert(!app.includes('class="mascot"'), '物語画面が絵文字マスコットを使っています');
assert(!app.includes('esc(scene.icon)'), '物語の意味を絵文字だけで表示しています');
assert(!app.includes('esc(stage.symbol)'), 'ステージの意味を記号だけで表示しています');
assert(!app.includes("esc(visual.icon || '◆')"), '問題部品が汎用記号のままです');

assert(css.includes('url("assets/workshop-hero-v1.jpg")'), '工房のキービジュアルがCSSにありません');
assert(css.includes('url("assets/story-guides-v1.jpg")'), '物語キャラクター画像がCSSにありません');
assert(css.includes('url("assets/measure-methods-v1.jpg")'), '長さの場面アトラスがCSSにありません');
assert(css.includes('url("assets/workshop-objects-v1.jpg")'), '部品アトラスがCSSにありません');
assert(/\.learning-object\s*\{[\s\S]*background-size:\s*300% 200%/.test(css), '部品アトラスの切り出し指定がありません');
assert(/\.method-scene-image\s*\{[\s\S]*background-size:\s*300% 100%/.test(css), '場面アトラスの切り出し指定がありません');
assert(!/font-size:\s*0\s*;/.test(css), '狭幅ナビゲーションが文字ラベルを隠しています');
assert(/@media \(max-width: 500px\)[\s\S]*\.brand-button\s*\{\s*display:\s*none/.test(css), '狭幅で6個の文字メニューを同時表示する余白がありません');

assert(app.includes('<small>やること</small><strong>'), '操作説明に「やること」ラベルがありません');
assert(app.includes("choice: '一つ えらぶ'") && app.includes("tap: '部品を タップ'"), '操作種別を子ども向けに明示していません');
assert(app.includes('どのトレイに 入るかな？'), '仕分けUIが答え方を説明していません');
assert(app.includes('role="img" aria-label="'), '生成画像または教材図に代替説明がありません');

console.log('visual design smoke: generated art / atlas crops / icon-independent semantics / explicit actions / mobile labels / offline assets OK');
