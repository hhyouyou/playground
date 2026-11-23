import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const DEBUG_URL = 'http://127.0.0.1:9225';
const GAME_URL = 'http://127.0.0.1:4173';
const artifacts = new URL('../artifacts/', import.meta.url);
await mkdir(artifacts, { recursive: true });

const pages = await (await fetch(`${DEBUG_URL}/json/list`)).json();
const page = pages.find((entry) => entry.type === 'page');
assert.ok(page, '找不到 Chrome 调试页面');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const eventWaiters = new Map();
const exceptions = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
  const waiter = eventWaiters.get(message.method);
  if (waiter) {
    eventWaiters.delete(message.method);
    waiter(message.params);
  }
});

function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

function waitForEvent(method) {
  return new Promise((resolve) => eventWaiters.set(method, resolve));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(new URL(name, artifacts), Buffer.from(result.data, 'base64'));
}

async function waitFor(expression, timeout = 6500) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await wait(60);
  }
  throw new Error(`等待条件超时：${expression}`);
}

async function setupStep(step) {
  await evaluate(`document.querySelector('[data-setup-step="${step}"]').click()`);
  await wait(100);
  assert.equal(await evaluate("document.querySelector('.setup-step.active').dataset.setupStep"), String(step));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1120, height: 900, deviceScaleFactor: 1, mobile: false });
const loaded = waitForEvent('Page.loadEventFired');
await send('Page.navigate', { url: GAME_URL });
await loaded;
await wait(1200);

assert.equal(await evaluate('document.title'), '黄金矿工 · Gold Rush');
assert.equal(await evaluate("document.querySelector('#setupScreen').hidden"), false);
assert.equal(await evaluate("document.querySelector('#playShell').hidden"), true);
assert.equal(await evaluate("document.querySelector('#gameOverlay').classList.contains('visible')"), false);
assert.equal(await evaluate("document.querySelector('#canvasWrap').parentElement.id"), 'setupStage');
assert.equal(await evaluate("document.querySelector('#startGameButton').hidden"), true);
assert.equal(await evaluate("document.querySelector('#gameCanvas').getContext('2d').getImageData(500,300,1,1).data[3]"), 255);
await screenshot('gold-miner-setup-team.png');

await evaluate("document.querySelector('#setupNextButton').click()");
await wait(80);
assert.equal(await evaluate("document.querySelectorAll('.mission-choice').length"), 3);
await evaluate("document.querySelector('[data-mission=gems]').click()");
assert.equal(await evaluate("document.querySelector('#goal').textContent"), '$700');
await evaluate("document.querySelector('[data-mission=gold]').click()");
assert.equal(await evaluate("document.querySelector('#goal').textContent"), '$650');
await screenshot('gold-miner-setup-mission.png');

await setupStep(2);
assert.equal(await evaluate("document.querySelectorAll('.character-choice').length"), 4);
await evaluate("document.querySelector('[data-character-choice=rocky]').click()");
assert.ok(await evaluate("document.querySelector('.selection-summary').textContent.includes('阿岩')"));
assert.ok(await evaluate("document.querySelector('[data-character-choice=rocky]').classList.contains('selected')"));
await screenshot('gold-miner-setup-character.png');
await evaluate(`(() => {
  const canvas = document.querySelector('#gameCanvas');
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left + rect.width * 0.5, clientY: rect.top + rect.height * 0.55 }));
})()`);
assert.equal(await evaluate("document.querySelector('.character-choice.selected').dataset.characterChoice"), 'lily', '点击场景角色应能直接换装');
await evaluate("document.querySelector('[data-character-choice=joe]').click()");

await setupStep(3);
assert.equal(await evaluate("document.querySelectorAll('.difficulty-scene').length"), 3);
assert.equal(await evaluate("document.querySelector('#startGameButton').hidden"), false);
await evaluate("document.querySelector('[data-difficulty=hard]').click()");
assert.equal(await evaluate("document.querySelector('#goal').textContent"), '$800');
assert.equal(await evaluate("document.querySelector('#time').textContent"), '51');
await evaluate("document.querySelector('[data-difficulty=easy]').click()");
assert.equal(await evaluate("document.querySelector('#goal').textContent"), '$500');
assert.equal(await evaluate("document.querySelector('#time').textContent"), '75');
await evaluate("document.querySelector('[data-difficulty=classic]').click()");
assert.equal(await evaluate("document.querySelector('#goal').textContent"), '$650');
await wait(180);
await screenshot('gold-miner-start.png');

await evaluate("document.querySelector('#startGameButton').click()");
await wait(250);
assert.equal(await evaluate("document.querySelector('#setupScreen').hidden"), true);
assert.equal(await evaluate("document.querySelector('#playShell').hidden"), false);
assert.equal(await evaluate("document.querySelector('#playControls').hidden"), false);
assert.equal(await evaluate("document.querySelector('#canvasWrap').parentElement.id"), 'playShell');
assert.equal(await evaluate("document.querySelector('#dropButton').disabled"), false);
await screenshot('gold-miner-playing.png');

let scoreAfterHook = '$0';
let hookAttempts = 0;
for (; hookAttempts < 6; hookAttempts += 1) {
  await waitFor("!document.querySelector('#dropButton').disabled");
  await evaluate("document.querySelector('#dropButton').click()");
  await waitFor("document.querySelector('#dropButton').disabled");
  await waitFor("!document.querySelector('#dropButton').disabled");
  await wait(100);
  scoreAfterHook = await evaluate("document.querySelector('#score').textContent");
  if (scoreAfterHook !== '$0') break;
}
assert.notEqual(scoreAfterHook, '$0', '多次瞄准放钩后应能抓到矿物并得分');

await evaluate("document.querySelector('#pauseButton').focus(); document.querySelector('#pauseButton').click()");
assert.equal(await evaluate("document.querySelector('#resumeGameButton') !== null"), true);
await evaluate("document.querySelector('#pauseButton').dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', bubbles: true }))");
assert.equal(await evaluate("document.querySelector('#gameOverlay').classList.contains('visible')"), false);

await evaluate("document.querySelector('#helpButton').click()");
assert.equal(await evaluate("document.querySelector('#helpDialog').open"), true);
await evaluate("document.querySelector('#reduceMotion').click()");
assert.equal(await evaluate("document.querySelector('#reduceMotion').checked"), true);
await evaluate("document.querySelector('#reduceMotion').click()");
assert.equal(await evaluate("document.querySelector('#reduceMotion').checked"), false);
await evaluate("document.querySelector('#gotItButton').click()");
await wait(50);
assert.equal(await evaluate("document.querySelector('#helpDialog').open"), false);

const soundLabel = await evaluate("document.querySelector('#soundButton').getAttribute('aria-label')");
await evaluate("document.querySelector('#soundButton').click()");
assert.notEqual(await evaluate("document.querySelector('#soundButton').getAttribute('aria-label')"), soundLabel);

await evaluate("document.querySelector('#restartButton').click()");
await wait(80);
await evaluate("document.querySelector('[data-mode=\"2\"]').click()");
assert.ok(await evaluate("document.querySelector('[data-mode=\"2\"]').classList.contains('selected')"));
await screenshot('gold-miner-setup-double.png');
await setupStep(2);
await evaluate("document.querySelector('[data-setup-player=\"1\"]').click()");
await evaluate("document.querySelector('[data-character-choice=max]').click()");
assert.equal(await evaluate("document.querySelector('#dynamiteCount2').textContent"), '3');
await wait(180);
await screenshot('gold-miner-setup-characters-double.png');
await setupStep(3);
await evaluate("document.querySelector('#startGameButton').click()");
await wait(100);
assert.equal(await evaluate("document.querySelector('#player2Controls').hidden"), false);
assert.equal(await evaluate("document.querySelector('#dropButton').disabled"), false);
assert.equal(await evaluate("document.querySelector('#dropButton2').disabled"), false);
await evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', bubbles: true }));
document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true }));`);
assert.equal(await evaluate("document.querySelector('#dropButton').disabled"), true, 'P1 应独立出钩');
assert.equal(await evaluate("document.querySelector('#dropButton2').disabled"), true, 'P2 应能同时出钩');
await evaluate("document.querySelector('#p1Emotes [data-emote=\"like\"]').click(); document.querySelector('#p2Emotes [data-emote=\"point\"]').click()");
await wait(120);
await screenshot('gold-miner-double.png');
await waitFor("!document.querySelector('#dropButton').disabled && !document.querySelector('#dropButton2').disabled", 9000);
for (let attempt = 0; attempt < 10; attempt += 1) {
  const progress = await evaluate("parseFloat(document.querySelector('#goalProgress').style.width) || 0");
  if (progress >= 100) break;
  await evaluate("document.querySelector('#dropButton').click(); document.querySelector('#dropButton2').click()");
  await wait(120);
  await waitFor("!document.querySelector('#dropButton').disabled && !document.querySelector('#dropButton2').disabled", 9000);
}
assert.ok(await evaluate("parseFloat(document.querySelector('#goalProgress').style.width) >= 100"), '双人合作应能达到团队目标');
await waitFor("document.querySelector('#nextLevelButton') !== null", 70000);
assert.equal(await evaluate("document.querySelectorAll('.shop-player-tabs button').length"), 2, '双人商店应有双方独立货架');
assert.equal(await evaluate("document.querySelectorAll('.shop-offer').length"), 3, '每位玩家应有三件随机商品');
await evaluate("document.querySelector('[data-shop-player=\"1\"]').click()");
assert.ok(await evaluate("document.querySelector('.shop-header h2').textContent.includes('P2')"));
await wait(400);
await screenshot('gold-miner-double-shop.png');
await evaluate("document.querySelector('#nextLevelButton').click()");
await wait(150);
assert.equal(await evaluate("document.querySelector('#level').textContent"), '2');
assert.equal(await evaluate("document.querySelector('#player2Controls').hidden"), false);

await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await wait(350);
assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, '窄屏不应横向溢出');
assert.equal(await evaluate(`(() => {
  const rect = document.querySelector('#gameCanvas').getBoundingClientRect();
  return Math.abs(rect.width / rect.height - 1000 / 620) < 0.02;
})()`), true, '手机画布必须等比缩放');
assert.equal(await evaluate(`(() => {
  const badge = document.querySelector('.level-badge').getBoundingClientRect();
  const canvas = document.querySelector('.canvas-wrap').getBoundingClientRect();
  return badge.top >= canvas.top && badge.bottom <= canvas.bottom;
})()`), true, '手机端关卡徽章应位于矿区内');
await screenshot('gold-miner-mobile.png');
assert.ok(await evaluate("document.querySelector('#gameCanvas').width < 1000"), '手机 Canvas 缓冲区应按实际显示尺寸分配');
await evaluate("document.querySelector('#restartButton').click()");
await wait(100);
assert.equal(await evaluate("document.querySelector('#statusToast').classList.contains('show')"), false, '重开时不得残留上一关提示');
await setupStep(2);
assert.equal(await evaluate(`(() => {
  const panel = document.querySelector('#setupOptions').getBoundingClientRect();
  return [...document.querySelectorAll('.character-choice')].every((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= panel.left && rect.right <= panel.right + 1;
  });
})()`), true, '角色卡片不得溢出准备页');
await screenshot('gold-miner-mobile-characters.png');
await setupStep(3);
await evaluate("document.querySelector('#startGameButton').scrollIntoView({ block: 'center' })");
await wait(60);
assert.equal(await evaluate(`(() => {
  const button = document.querySelector('#startGameButton').getBoundingClientRect();
  return button.top >= 0 && button.bottom <= window.innerHeight;
})()`), true, '手机端开始按钮应可滚动到并完整可见');
assert.equal(await evaluate(`(() => {
  const card = document.querySelector('#setupScreen').getBoundingClientRect();
  return card.left >= 0 && card.right <= window.innerWidth;
})()`), true, '手机端准备页不得超出屏幕');
await screenshot('gold-miner-mobile-ready.png');

await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 900, deviceScaleFactor: 1, mobile: false });
await wait(250);
await evaluate("document.querySelector('#startGameButton').scrollIntoView({ block: 'center' })");
await wait(60);
assert.equal(await evaluate(`(() => {
  const card = document.querySelector('#setupScreen').getBoundingClientRect();
  const button = document.querySelector('#startGameButton').getBoundingClientRect();
  return card.left >= 0 && card.right <= window.innerWidth && button.top >= 0 && button.bottom <= window.innerHeight;
})()`), true, '中等宽度下准备页与开始按钮必须可用');
await evaluate('window.scrollTo(0, 0)');
await wait(60);
await screenshot('gold-miner-tablet-ready.png');

await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: false });
await evaluate('window.scrollTo(0, 0)');
await wait(250);
assert.ok(await evaluate("document.querySelector('#setupScreen').getBoundingClientRect().top >= 0"), '横屏短高度下准备页顶部不得被裁切');
await evaluate("document.querySelector('#startGameButton').scrollIntoView({ block: 'center' })");
await wait(60);
assert.equal(await evaluate(`(() => {
  const button = document.querySelector('#startGameButton').getBoundingClientRect();
  return button.top >= 0 && button.bottom <= window.innerHeight;
})()`), true, '横屏短高度下应能滚动到开始按钮');
assert.deepEqual(exceptions, [], '浏览器不应出现 JavaScript 异常');

const report = {
  url: GAME_URL,
  title: '黄金矿工 · Gold Rush',
  scoreAfterHook,
  hookAttempts: hookAttempts + 1,
  visualSetupFourSteps: 'passed',
  missionsAffectGoals: 'passed',
  integratedSetupAndCanvasCharacter: 'passed',
  difficultySelection: 'passed',
  dropAndCollect: 'passed',
  pauseAndResume: 'passed',
  helpDialog: 'passed',
  soundToggle: 'passed',
  characterSelectionAndPassives: 'passed',
  emotesAndReducedMotion: 'passed',
  doubleModeSimultaneousHooks: 'passed',
  doubleModeShopAndNextLevel: 'passed',
  mobileTabletLandscapeLayout: 'passed',
  javascriptExceptions: exceptions.length,
};
await writeFile(new URL('browser-report.json', artifacts), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
socket.close();
