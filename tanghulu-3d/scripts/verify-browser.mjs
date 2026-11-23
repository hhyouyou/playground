import fs from 'node:fs';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findPage() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json());
      const page = targets.find((target) => target.type === 'page' && target.url.startsWith('http://127.0.0.1:4173'));
      if (page) return page;
    } catch {
      // Chrome may still be starting.
    }
    await delay(250);
  }
  throw new Error('No debuggable preview page found');
}

const page = await findPage();
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const exceptions = [];
const consoleErrors = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  } else if (message.method === 'Runtime.exceptionThrown') {
    exceptions.push(message.params.exceptionDetails);
  } else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    consoleErrors.push(message.params.entry.text);
  }
});
socket.addEventListener('close', () => {
  pending.forEach(({ reject }) => reject(new Error('Chrome debugging socket closed')));
  pending.clear();
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function waitForModel() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = await evaluate('Boolean(window.__TANGLU__?.ready && document.querySelector("#loading-screen")?.classList.contains("loaded"))');
    if (ready) return;
    await delay(250);
  }
  throw new Error('Model did not become ready');
}

const checks = {};
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.reload', { ignoreCache: true });
  await waitForModel();

  const initial = await evaluate('({orientation: window.__TANGLU__.strawberryOrientation, meshes: window.__TANGLU__.meshes, canvas: [document.querySelector("canvas").width, document.querySelector("canvas").height]})');
  checks.strawberryTipsUp = initial.orientation === 'tips-up';
  checks.modelHasMeshes = initial.meshes > 20;
  checks.canvasHasSize = initial.canvas[0] >= 1440 && initial.canvas[1] >= 1000;

  await evaluate('document.querySelector("#auto-rotate").click()');
  checks.autoRotateToggle = await evaluate('window.__TANGLU__.autoRotate === false');

  await evaluate('document.querySelector("#explode-view").click()');
  await delay(1700);
  checks.explodeView = await evaluate('window.__TANGLU__.exploded === true');
  const explodedShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync('preview-exploded.png', Buffer.from(explodedShot.data, 'base64'));

  await evaluate('document.querySelector(".ingredient[data-part=milk]").click()');
  await delay(1300);
  checks.ingredientFocus = await evaluate('window.__TANGLU__.activePart === "milk"');

  await evaluate('document.querySelector("#toggle-labels").click()');
  checks.labelToggle = await evaluate('document.querySelector("#hotspots").classList.contains("hidden")');
  await evaluate('document.querySelector("#toggle-labels").click()');

  await evaluate('document.querySelector("#about-open").click()');
  checks.referenceDialog = await evaluate('document.querySelector("#about-dialog").open && document.querySelector(".reference-wrap img").naturalWidth > 0');
  await evaluate('document.querySelector("#about-close").click()');

  await evaluate('document.querySelector("#reset-view").click()');
  await delay(1300);
  checks.resetView = await evaluate('window.__TANGLU__.exploded === false && window.__TANGLU__.activePart === "all"');
  checks.noRuntimeExceptions = exceptions.length === 0;
  checks.noConsoleErrors = consoleErrors.length === 0;

  const report = { checks, initial, exceptions, consoleErrors };
  fs.writeFileSync('browser-verification.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(checks).some((value) => value !== true)) process.exitCode = 1;
} finally {
  send('Browser.close').catch(() => {});
  await delay(400);
  socket.close();
}
