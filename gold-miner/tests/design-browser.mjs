import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const DEBUG_URL = 'http://127.0.0.1:9225';
const GAME_URL = 'http://127.0.0.1:4173';
const DESIGN_URL = `${GAME_URL}/design.html`;
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
async function waitFor(expression, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await wait(70);
  }
  throw new Error(`等待条件超时：${expression}`);
}
async function screenshot(name, beyond = false) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: beyond });
  await writeFile(new URL(name, artifacts), Buffer.from(result.data, 'base64'));
}
async function navigate(url) {
  const loaded = waitForEvent('Page.loadEventFired');
  await send('Page.navigate', { url });
  await loaded;
  await wait(500);
}
async function setRange(id, value) {
  await evaluate(`(() => { const input = document.querySelector('#${id}'); input.value = '${value}'; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await wait(180);
}
async function importJson(text, name = 'design-import.json') {
  await evaluate(`(() => {
    const input = document.querySelector('#importFileInput');
    const transfer = new DataTransfer();
    transfer.items.add(new File([${JSON.stringify(text)}], '${name}', { type: 'application/json' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await wait(350);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await navigate(DESIGN_URL);
await waitFor("document.querySelector('#analysisIncome').textContent !== '$0'");

assert.equal(await evaluate('document.title'), '矿区数值测绘所 · Gold Rush Lab');
assert.equal(await evaluate("document.querySelectorAll('[data-design-difficulty]').length"), 3);
assert.equal(await evaluate("document.querySelectorAll('[data-design-mission]').length"), 3);
assert.equal(await evaluate("document.querySelectorAll('[data-design-character][data-player-index=\"0\"]').length"), 4);
assert.equal(await evaluate("document.querySelectorAll('.shop-insight').length"), 6);
assert.deepEqual(await evaluate("[...document.querySelectorAll('.character-stat-name')].map((element) => element.firstChild.textContent.trim())"), ['老乔', '阿岩', '莉莉', '洛克']);
assert.equal(await evaluate("document.querySelectorAll('#curveTableBody tr').length"), 12);
assert.ok(await evaluate("document.querySelectorAll('#routeTableBody tr[data-route-item]').length > 0"));
assert.equal(await evaluate("document.querySelector('#analysisGoal').textContent"), '$650');
assert.equal(await evaluate("document.querySelectorAll('#routeTableBody tr[data-route-item]').length"), 10, '默认路线应在贵重物清空后提前收工');
assert.ok(await evaluate("document.querySelector('#timeBreakdown').textContent.includes('23.5s 达标收工')"));
assert.equal(await evaluate("document.querySelector('#designCanvas').getContext('2d').getImageData(500,300,1,1).data[3]"), 255);
assert.equal(await evaluate("document.querySelector('#itemInspector').textContent.includes('价值结算顺序')"), true);
await screenshot('design-lab-desktop.png');

await evaluate("document.querySelector('[data-player-count=\"2\"]').click(); document.querySelector('[data-design-difficulty=easy]').click()");
await setRange('levelInput', 5);
assert.ok(await evaluate("document.querySelector('[data-route-item=\"5-27\"] .route-order').textContent.startsWith('P2')"), '双人边界矿物必须交给可达的 P2');
assert.equal(await evaluate(`(() => {
  const row = document.querySelector('[data-route-item="5-27"]');
  row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return document.querySelector('#modifierSubtitle').textContent.includes('P2 可达原点');
})()`), true, 'P2 专属矿物的角色对照也应使用 P2 原点');
await evaluate("document.querySelector('[data-player-count=\"1\"]').click(); document.querySelector('[data-design-difficulty=classic]').click()");
await setRange('levelInput', 1);

await evaluate("document.querySelector('[data-design-mission=gems]').click()");
await wait(180);
assert.equal(await evaluate("document.querySelector('#analysisGoal').textContent"), '$700');
assert.ok(await evaluate("document.querySelector('#ruleSnapshot').textContent.includes('14 件实物')"));
await evaluate("document.querySelector('[data-design-difficulty=hard]').click()");
await wait(180);
assert.equal(await evaluate("document.querySelector('#analysisGoal').textContent"), '$850');
await setRange('levelInput', 3);
assert.equal(await evaluate("document.querySelector('#levelOutput').textContent"), '第 3 关');
assert.equal(await evaluate("document.querySelector('#analysisGoal').textContent"), '$2,950');

await evaluate("document.querySelector('[data-player-count=\"2\"]').click()");
await wait(220);
assert.equal(await evaluate("document.querySelectorAll('.loadout-card').length"), 2);
assert.ok(await evaluate("document.querySelectorAll('.route-order.p2').length > 0"));
assert.equal(await evaluate("document.querySelectorAll('#playerModeComparison .mode-wallet span').length"), 3, '单人对照一个钱包，双人对照两个钱包');
await evaluate("document.querySelector('[data-design-character=max][data-player-index=\"1\"]').click()");
await wait(180);
assert.ok(await evaluate("document.querySelector('[data-loadout-player=\"1\"] .loadout-header').textContent.includes('洛克')"));
assert.ok(await evaluate("document.querySelector('[data-loadout-player=\"1\"] .loadout-header').textContent.includes('初始 3')"));
await evaluate("document.querySelector('[data-hourglass-delta=\"1\"][data-player-index=\"1\"]').click()");
await wait(180);
assert.ok(await evaluate("document.querySelector('#timeBreakdown').textContent.includes('沙漏 +12s')"));
await evaluate("document.querySelector('[data-design-buff=strength][data-player-index=\"0\"]').click()");
await wait(180);
assert.equal(await evaluate("document.querySelector('[data-design-buff=strength][data-player-index=\"0\"]').checked"), true);
assert.equal(await evaluate("document.querySelector('[data-design-buff=strength][data-player-index=\"1\"]').checked"), false);
assert.ok(await evaluate("document.querySelector('.shop-insight.active .shop-active-badge').textContent.includes('P1')"));

await setRange('goalFactorInput', 1.2);
assert.equal(await evaluate("document.querySelector('#analysisGoal').textContent"), '$3,550');
await setRange('timeFactorInput', 1.1);
assert.ok(await evaluate("document.querySelector('#timeBreakdown').textContent.includes('基础 53s')"));
await evaluate("(() => { const select = document.querySelector('#curveLevelsInput'); select.value = '20'; select.dispatchEvent(new Event('change', { bubbles: true })); })()");
await wait(250);
assert.equal(await evaluate("document.querySelectorAll('#curveTableBody tr').length"), 20);
await evaluate("document.querySelector('[data-chart-level=\"5\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))");
await wait(220);
assert.equal(await evaluate("document.querySelector('#levelOutput').textContent"), '第 5 关');
await evaluate("document.querySelector('#saveConfigButton').click()");
assert.ok(await evaluate("document.querySelector('#saveStatus').textContent.includes('已保存')"));
assert.equal(await evaluate("JSON.parse(localStorage.getItem('gold-rush-numerical-lab-v1')).config.level"), 5);
assert.equal(await evaluate("JSON.parse(localStorage.getItem('gold-rush-numerical-lab-v1')).config.playerCount"), 2);
assert.equal(await evaluate("JSON.parse(localStorage.getItem('gold-rush-numerical-lab-v1')).config.characterIds[1]"), 'max');
await evaluate('window.scrollTo(0, 0)');
await screenshot('design-lab-double.png');

await navigate(DESIGN_URL);
await waitFor("document.querySelector('#levelOutput').textContent === '第 5 关'");
assert.ok(await evaluate("document.querySelector('#saveStatus').textContent.includes('已载入')"));
assert.equal(await evaluate("document.querySelectorAll('.loadout-card').length"), 2);
assert.equal(await evaluate("document.querySelector('[data-design-character=max][data-player-index=\"1\"]').classList.contains('selected')"), true);
assert.equal(await evaluate("document.querySelector('#goalFactorInput').value"), '1.2');

const exportPayload = await evaluate(`(async () => {
  let captured = null;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = (blob) => { captured = blob; return originalCreate.call(URL, blob); };
  URL.revokeObjectURL = (url) => originalRevoke.call(URL, url);
  document.querySelector('#exportConfigButton').click();
  const text = await captured.text();
  URL.createObjectURL = originalCreate;
  return text;
})()`);
const exported = JSON.parse(exportPayload);
assert.equal(exported.schema, 'gold-rush-numerical-lab');
assert.equal(exported.readOnly, true);
assert.equal(exported.config.level, 5);
assert.equal(exported.config.playerCount, 2);
await writeFile(new URL('design-export-test.json', artifacts), JSON.stringify(exported, null, 2));

exported.config.level = 7;
exported.config.playerCount = 1;
exported.config.missionId = 'gold';
exported.config.difficultyId = 'classic';
exported.config.tuning.goalFactor = 1;
exported.config.tuning.timeFactor = 1;
exported.config.curveLevels = 7;
await importJson(JSON.stringify(exported));
assert.equal(await evaluate("document.querySelector('#levelOutput').textContent"), '第 7 关');
assert.equal(await evaluate("document.querySelectorAll('.loadout-card').length"), 1);
assert.equal(await evaluate("document.querySelector('[data-design-mission=gold]').classList.contains('selected')"), true);
assert.equal(await evaluate("document.querySelector('#curveLevelsInput').value"), '7', '导入的曲线关数必须有匹配选项');
assert.equal(await evaluate("document.querySelectorAll('#curveTableBody tr').length"), 7);
assert.ok(await evaluate("document.querySelector('#saveStatus').textContent.includes('已导入')"));
await evaluate("(() => { const select = document.querySelector('#curveLevelsInput'); select.value = '12'; select.dispatchEvent(new Event('change', { bubbles: true })); })()");
await setRange('levelInput', 60);
assert.equal(await evaluate("document.querySelectorAll('#goalChart .current-level-line').length"), 0, '超出曲线范围时不得把选择线画在最后一关');
assert.ok(await evaluate("document.querySelector('#goalChart').getAttribute('aria-label').includes('超出曲线范围')"));
await importJson('{bad json', 'broken.json');
assert.ok(await evaluate("document.querySelector('#saveStatus').textContent.includes('导入失败')"));

await evaluate("document.querySelector('#resetConfigButton').click()");
await wait(220);
assert.equal(await evaluate("document.querySelector('#analysisGoal').textContent"), '$650');
assert.equal(await evaluate("document.querySelector('#levelOutput').textContent"), '第 1 关');
assert.equal(await evaluate("localStorage.getItem('gold-rush-numerical-lab-v1')"), null);
await evaluate(`(() => {
  const canvas = document.querySelector('#designCanvas');
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left + rect.width * 0.218, clientY: rect.top + rect.height * (394 / 620) }));
})()`);
assert.ok(await evaluate("document.querySelector('.inspector-item-title').textContent.includes('大黄金')"));
await evaluate("document.querySelector('#designCanvas').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))");
assert.equal(await evaluate("document.querySelectorAll('#routeTableBody tr[data-route-item]').length > 0"), true);
await evaluate("document.querySelector('.route-card').scrollIntoView({ block: 'start' })");
await wait(100);
await screenshot('design-lab-route.png');
await evaluate("document.querySelector('.modifiers-card').scrollIntoView({ block: 'start' })");
await wait(100);
await screenshot('design-lab-modifiers.png');

await evaluate("document.querySelector('[data-design-mission=demolition]').click(); document.querySelector('[data-design-difficulty=hard]').click()");
await wait(220);
await evaluate(`(() => {
  const canvas = document.querySelector('#designCanvas');
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left + rect.width * 0.445, clientY: rect.top + rect.height * (420 / 620) }));
})()`);
assert.ok(await evaluate("document.querySelector('#itemInspector').textContent.includes('680/s')"), 'TNT 必须按 680/秒空钩回收');
assert.ok(await evaluate("document.querySelector('#itemInspector').textContent.includes('TNT 引爆后空钩')"));
await evaluate("document.querySelector('#resetConfigButton').click()");
await wait(200);

await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await evaluate('window.scrollTo(0, 0)');
await wait(300);
assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, '设计台手机端不得横向溢出');
await screenshot('design-lab-mobile-controls.png');
await evaluate("document.querySelector('.scene-card').scrollIntoView({ block: 'start' })");
await wait(120);
assert.equal(await evaluate(`(() => { const rect = document.querySelector('#designCanvas').getBoundingClientRect(); return Math.abs(rect.width / rect.height - 1000 / 620) < 0.02; })()`), true);
assert.equal(await evaluate(`(() => { const rect = document.querySelector('.scene-card').getBoundingClientRect(); return rect.left >= 0 && rect.right <= window.innerWidth; })()`), true);
await screenshot('design-lab-mobile-scene.png');
await evaluate("document.querySelector('.modifiers-card').scrollIntoView({ block: 'start' })");
await wait(100);
assert.equal(await evaluate(`(() => [...document.querySelectorAll('.character-stat-card')].every((element) => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= window.innerWidth; }))()`), true);
await screenshot('design-lab-mobile-modifiers.png');

await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 900, deviceScaleFactor: 1, mobile: false });
await evaluate('window.scrollTo(0, 0)');
await wait(250);
assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
await screenshot('design-lab-tablet.png');
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: false });
await evaluate("document.querySelector('.scene-card').scrollIntoView({ block: 'start' })");
await wait(180);
assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
assert.equal(await evaluate(`(() => { const rect = document.querySelector('.scene-card').getBoundingClientRect(); return rect.left >= 0 && rect.right <= window.innerWidth; })()`), true);

await navigate(GAME_URL);
assert.equal(await evaluate("document.querySelector('#designLabLink').hidden"), true, '普通玩家默认看不到设计台入口');
await navigate(`${GAME_URL}/?design=1`);
assert.equal(await evaluate("document.querySelector('#designLabLink').hidden"), false, '显式 design=1 时显示设计台入口');
await evaluate("document.querySelector('#designLabLink').click()");
await wait(500);
assert.equal(await evaluate('document.title'), '矿区数值测绘所 · Gold Rush Lab');
assert.deepEqual(exceptions, [], '设计台浏览器不应出现 JavaScript 异常');

const report = {
  url: DESIGN_URL,
  realLevelPreview: 'passed',
  goalTimeAndResourceCurves: 'passed',
  clickableRouteAndItemInspector: 'passed',
  characterAndShopStacking: 'passed',
  duoSharedGoalIndependentEconomy: 'passed',
  perPlayerReachabilityAndEarlySettlement: 'passed',
  tntEmptyHookRetrieval: 'passed',
  tuningUpdatesAllPanels: 'passed',
  localSaveAndReload: 'passed',
  jsonExportImportAndInvalidFallback: 'passed',
  hiddenEntryForNormalPlayers: 'passed',
  mobileTabletLandscapeLayout: 'passed',
  javascriptExceptions: exceptions.length,
};
await writeFile(new URL('design-browser-report.json', artifacts), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
socket.close();
