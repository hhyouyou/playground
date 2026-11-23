import {
  DIFFICULTIES,
  HOOK,
  HOOK_POSITIONS,
  SHOP_CATALOG,
  WORLD,
  createLevel,
  createRandom,
  getBagReward,
  getDifficulty,
  getLevelGoal,
  getLevelTime,
  getShopStock,
  pointToSegmentDistance,
  purchaseShopOffer,
  shouldFinishEarly,
} from './game-core.js';
import {
  CHARACTERS,
  MISSIONS,
  createVisualState,
  getCharacter,
  getInitialDynamites,
  getMission,
  getPullMultiplier,
  getSwingMultiplier,
  getWeightClass,
} from './character-core.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#gameCanvas');
const ctx = canvas.getContext('2d');
const gameOverlay = $('#gameOverlay');
const helpDialog = $('#helpDialog');
const MIN_HOOK_LENGTH = HOOK.minLength;
const MAX_SWING_ANGLE = HOOK.maxAngle;
const HIGH_SCORE_KEY = 'gold-rush-high-score';
const SOUND_KEY = 'gold-rush-sound';
const LEVEL_THEMES = Object.freeze([
  { id: 'desert', name: '荒漠矿区', skyTop: '#efd39a', skyBottom: '#e8b872', mountain: '#c99058', mountainDark: '#b77b4c', soilTop: '#8b5839', soilMid: '#70432f', soilBottom: '#4c3027', strata: '#a46943', surface: '#b67b48' },
  { id: 'crystal', name: '水晶洞窟', skyTop: '#9fc8c2', skyBottom: '#789d99', mountain: '#688c87', mountainDark: '#53736f', soilTop: '#4d6563', soilMid: '#394d50', soilBottom: '#29383f', strata: '#70a9a0', surface: '#66867a' },
  { id: 'ruins', name: '古老遗迹', skyTop: '#d4c89d', skyBottom: '#b5a77b', mountain: '#9b9270', mountainDark: '#7e785c', soilTop: '#756b47', soilMid: '#574f39', soilBottom: '#39352c', strata: '#a69b62', surface: '#8a8055' },
  { id: 'magma', name: '熔岩矿脉', skyTop: '#c58c6b', skyBottom: '#9d6252', mountain: '#865247', mountainDark: '#643e39', soilTop: '#68443b', soilMid: '#493230', soilBottom: '#292329', strata: '#a95839', surface: '#80513c' },
]);

let phase = 'ready';
let level = 1;
let playerCount = 1;
let players = createPlayers(1);
let setupStep = 0;
let setupCharacterPlayer = 0;
let missionId = 'gold';
let mission = getMission(missionId);
let difficultyId = 'classic';
let difficulty = getDifficulty(difficultyId);
let theme = LEVEL_THEMES[0];
let levelStartScore = 0;
let goal = getLevelGoal(1, difficultyId);
let timeLeft = getLevelTime(1, difficultyId);
let timeUp = false;
let items = [];
let effects = [];
let particles = [];
let emotes = [];
let visualClock = 0;
let cartBounce = 0;
let goalAnnounced = false;
let shopStockByPlayer = [];
let shopPlayerIndex = 0;
let shopMessage = '';
let highScore = readHighScore(difficultyId);
let phaseBeforeHelp = null;
let toastTimer = null;
let shake = 0;
let lastTimestamp = performance.now();
let lastRenderTimestamp = 0;
let pixelRatio = 1;
let reducedMotion = readNumber('gold-rush-reduced-motion') === 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function createEmptyBuffs() {
  return { strength: false, clover: false, diamond: false, rock: false };
}

function createPlayers(count) {
  const origins = count === 2 ? HOOK_POSITIONS.double : HOOK_POSITIONS.single;
  return origins.map((origin, index) => {
    const characterId = index === 0 ? 'joe' : 'lily';
    return {
      id: index,
      name: index === 0 ? 'P1' : 'P2',
      characterId,
      color: getCharacter(characterId).color,
      origin,
      score: 0,
      coins: 0,
      dynamites: getInitialDynamites(characterId),
      hourglasses: 0,
      pendingBuffs: createEmptyBuffs(),
      activeBuffs: createEmptyBuffs(),
      visual: createVisualState(index * 1.7),
      hook: { mode: 'swing', angle: index === 0 ? -0.5 : 0.5, direction: index === 0 ? 1 : -1, length: MIN_HOOK_LENGTH, caught: null, hadCatch: false, justReturned: false },
    };
  });
}

function teamScore() {
  return players.reduce((total, player) => total + player.score, 0);
}

function getMissionGoal(targetLevel) {
  return Math.round((getLevelGoal(targetLevel, difficultyId) * mission.goalFactor) / 50) * 50;
}

function resetHooks() {
  players.forEach((player, index) => {
    Object.assign(player.hook, { mode: 'swing', angle: index === 0 ? -0.5 : 0.5, direction: index === 0 ? 1 : -1, length: MIN_HOOK_LENGTH, caught: null, hadCatch: false, justReturned: false });
  });
}

function allHooksHome() {
  return players.every((player) => player.hook.mode === 'swing');
}

function setReaction(player, reaction, duration = 1) {
  if (!player) return;
  player.visual.reaction = reaction;
  player.visual.reactionTime = Math.max(player.visual.reactionTime || 0, duration);
}

function sendEmote(playerIndex, type) {
  const player = players[playerIndex];
  if (phase !== 'playing' || !player || !['wave', 'point', 'like'].includes(type)) return;
  setReaction(player, type, 1.35);
  emotes.push({ playerId: player.id, type, x: player.origin.x, y: player.origin.y - 112, life: 1.35, maxLife: 1.35 });
  if (type === 'point') {
    const target = items.filter((item) => item.state === 'active' && item.kind !== 'tnt').sort((a, b) => b.value - a.value)[0];
    if (target) {
      target.ping = 1.6;
      showToast(`${player.name} 指向了${target.kind === 'diamond' ? '钻石' : target.kind === 'pig' ? '钻石金猪' : target.kind === 'bag' ? '神秘福袋' : '高价值矿物'}`);
    }
  } else if (type === 'like') {
    const teammate = players[1 - playerIndex];
    if (teammate) setReaction(teammate, 'happy', 0.9);
  }
  sound.play('click');
}

function updateVisuals(dt) {
  visualClock += dt;
  cartBounce = Math.max(0, cartBounce - dt);
  for (const player of players) {
    const visual = player.visual;
    const hook = player.hook;
    visual.time = (visual.time || 0) + dt;
    visual.reactionTime = Math.max(0, (visual.reactionTime || 0) - dt);
    if (visual.reactionTime <= 0) visual.reaction = '';

    if (hook.justReturned) {
      if (!hook.hadCatch && phase === 'playing') setReaction(player, 'shrug', 0.8);
      hook.justReturned = false;
    }

    let action = 'idle';
    let expression = 'normal';
    let tension = 0;
    if (visual.reaction) {
      action = visual.reaction;
      expression = ['happy', 'delight', 'like', 'celebrate', 'wave', 'point'].includes(action) ? 'happy' : action === 'shrug' ? 'disappointed' : action === 'scared' ? 'surprised' : 'normal';
    } else if (phase === 'shop') {
      action = 'celebrate';
      expression = 'happy';
    } else if (phase === 'gameOver') {
      action = 'shrug';
      expression = 'disappointed';
    } else if (hook.mode === 'extending') {
      action = 'drop';
    } else if (hook.mode === 'retract' && hook.caught) {
      const item = hook.caught;
      const weight = getWeightClass(item);
      action = `${weight}Pull`;
      tension = weight === 'extreme' ? 1 : weight === 'heavy' ? 0.72 : weight === 'medium' ? 0.35 : 0.12;
      expression = item.kind === 'diamond' ? 'happy' : item.kind === 'pig' ? 'surprised' : tension >= 0.7 ? 'strain' : 'normal';
      if (['rock', 'bone'].includes(item.kind)) {
        visual.debrisTimer = (visual.debrisTimer || 0) - dt;
        if (visual.debrisTimer <= 0) {
          spawnDust(item.x, item.y, '#b7a58b', 2);
          visual.debrisTimer = 0.14;
        }
      }
    } else if (hook.mode === 'retract') {
      action = 'retract';
    } else if (phase === 'playing') {
      action = 'aim';
    }
    visual.action = action;
    visual.expression = expression;
    visual.tension += (tension - (visual.tension || 0)) * Math.min(1, dt * 7);
    visual.crank = reducedMotion ? (visual.crank || 0) : (visual.crank || 0) + dt * (hook.mode === 'retract' ? 7 - visual.tension * 3.5 : 1.4);
    visual.lookAngle = hook.angle;
  }

  for (const emote of emotes) emote.life -= dt;
  emotes = emotes.filter((emote) => emote.life > 0);
  for (const item of items) if (item.ping) item.ping = Math.max(0, item.ping - dt);
}

function readNumber(key) {
  try {
    return Number.parseInt(localStorage.getItem(key) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function readSoundPreference() {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

function getHighScoreKey(id = difficultyId) {
  return `${HIGH_SCORE_KEY}-${id}-${playerCount}-${missionId}`;
}

function readHighScore(id) {
  const saved = readNumber(getHighScoreKey(id));
  if (playerCount !== 1) return saved;
  return id === 'classic' ? Math.max(saved, readNumber(`${HIGH_SCORE_KEY}-${id}`), readNumber(HIGH_SCORE_KEY)) : Math.max(saved, readNumber(`${HIGH_SCORE_KEY}-${id}`));
}

function saveHighScore() {
  storeValue(getHighScoreKey(), highScore);
}

function storeValue(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // The game remains fully playable when storage is unavailable.
  }
}

function money(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function setText(selector, value) {
  const element = typeof selector === 'string' ? $(selector) : selector;
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}

class SoundEffects {
  constructor() {
    this.enabled = readSoundPreference();
    this.context = null;
  }

  ensureContext() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.context = new AudioContext();
    }
    if (this.context?.state === 'suspended') this.context.resume().catch(() => {});
    return this.context;
  }

  tone(frequency, duration = 0.1, type = 'sine', volume = 0.035, delay = 0, endFrequency = null) {
    if (!this.enabled) return;
    const audioContext = this.ensureContext();
    if (!audioContext) return;
    const start = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  play(name) {
    if (!this.enabled) return;
    switch (name) {
      case 'click':
        this.tone(420, 0.055, 'sine', 0.025);
        break;
      case 'drop':
        this.tone(250, 0.16, 'triangle', 0.035, 0, 95);
        break;
      case 'catch':
        this.tone(150, 0.07, 'square', 0.025);
        this.tone(110, 0.1, 'square', 0.018, 0.055);
        break;
      case 'collect':
        this.tone(660, 0.12, 'sine', 0.045);
        this.tone(880, 0.18, 'sine', 0.04, 0.09);
        break;
      case 'diamond':
        this.tone(880, 0.15, 'sine', 0.04);
        this.tone(1174, 0.18, 'sine', 0.035, 0.08);
        this.tone(1568, 0.25, 'sine', 0.03, 0.16);
        break;
      case 'success':
        [523, 659, 784, 1047].forEach((note, index) => this.tone(note, 0.25, 'triangle', 0.04, index * 0.1));
        break;
      case 'fail':
        this.tone(280, 0.25, 'triangle', 0.035);
        this.tone(210, 0.35, 'triangle', 0.03, 0.2);
        break;
      case 'explode':
        this.noise(0.35, 0.09);
        this.tone(90, 0.35, 'sawtooth', 0.05, 0, 35);
        break;
      default:
        break;
    }
  }

  noise(duration, volume) {
    const audioContext = this.ensureContext();
    if (!audioContext) return;
    const length = Math.floor(audioContext.sampleRate * duration);
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(audioContext.destination);
    source.start();
  }
}

const sound = new SoundEffects();

function syncCanvasResolution() {
  const deviceRatio = window.devicePixelRatio || 1;
  const displayWidth = canvas.getBoundingClientRect().width || WORLD.width;
  pixelRatio = Math.max(0.5, Math.min(2, (displayWidth / WORLD.width) * deviceRatio));
  const targetWidth = Math.round(WORLD.width * pixelRatio);
  const targetHeight = Math.round(WORLD.height * pixelRatio);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingEnabled = true;
}

function makeShape(seed, points = 9) {
  const random = createRandom(seed);
  return Array.from({ length: points }, (_, index) => ({
    angle: (Math.PI * 2 * index) / points,
    radius: 0.8 + random() * 0.25,
  }));
}

function setupLevel() {
  theme = LEVEL_THEMES[(level - 1) % LEVEL_THEMES.length];
  items = createLevel(level, difficultyId, playerCount, missionId);
  items.forEach((item) => { item.shape = makeShape(item.seed, item.kind === 'rock' || item.kind === 'bone' ? 8 : 10); });
  goal = getMissionGoal(level);
  timeLeft = getLevelTime(level, difficultyId);
  timeUp = false;
  goalAnnounced = teamScore() >= goal;
  levelStartScore = teamScore();
  effects = [];
  particles = [];
  emotes = [];
  resetHooks();
  players.forEach((player) => {
    player.visual.reaction = '';
    player.visual.reactionTime = 0;
    player.visual.tension = 0;
  });
  updateUI();
}

function newGame(autoStart = false) {
  level = 1;
  window.clearTimeout(toastTimer);
  $('#statusToast').classList.remove('show');
  setText('#statusToast', '');
  const previousCharacters = players.map((player) => player.characterId);
  players = createPlayers(playerCount);
  players.forEach((player, index) => {
    const characterId = previousCharacters[index] || player.characterId;
    player.characterId = characterId;
    player.color = getCharacter(characterId).color;
    player.dynamites = getInitialDynamites(characterId);
  });
  setupStep = 0;
  setupCharacterPlayer = 0;
  shopStockByPlayer = [];
  shopPlayerIndex = 0;
  shopMessage = '';
  highScore = readHighScore(difficultyId);
  setupLevel();
  if (autoStart) startPlaying();
  else {
    phase = 'ready';
    showOverlay('ready');
  }
}

function selectDifficulty(id) {
  if (phase !== 'ready' || !DIFFICULTIES[id]) return;
  difficultyId = id;
  difficulty = getDifficulty(id);
  highScore = readHighScore(id);
  sound.play('click');
  setupLevel();
  showOverlay('ready');
}

function selectMission(id) {
  if (phase !== 'ready' || !MISSIONS[id]) return;
  missionId = id;
  mission = getMission(id);
  highScore = readHighScore(difficultyId);
  sound.play('click');
  setupLevel();
  showOverlay('ready');
}

function setSetupStep(step) {
  if (phase !== 'ready') return;
  setupStep = Math.max(0, Math.min(3, step));
  sound.play('click');
  showOverlay('ready');
}

function selectSetupCharacterPlayer(index) {
  if (phase !== 'ready' || !players[index]) return;
  setupCharacterPlayer = index;
  sound.play('click');
  showOverlay('ready');
}

function selectMode(count) {
  if (phase !== 'ready' || ![1, 2].includes(count)) return;
  const previousCharacters = players.map((player) => player.characterId);
  playerCount = count;
  players = createPlayers(count);
  players.forEach((player, index) => {
    const characterId = previousCharacters[index] || player.characterId;
    player.characterId = characterId;
    player.color = getCharacter(characterId).color;
    player.dynamites = getInitialDynamites(characterId);
  });
  setupCharacterPlayer = Math.min(setupCharacterPlayer, count - 1);
  highScore = readHighScore(difficultyId);
  sound.play('click');
  setupLevel();
  showOverlay('ready');
}

function selectCharacter(playerIndex, characterId) {
  if (phase !== 'ready' || !players[playerIndex] || !CHARACTERS[characterId]) return;
  const player = players[playerIndex];
  player.characterId = characterId;
  player.color = getCharacter(characterId).color;
  player.dynamites = getInitialDynamites(characterId);
  player.visual = createVisualState(playerIndex * 1.7);
  sound.play('click');
  showOverlay('ready');
  updateUI();
}

function cycleCharacter(playerIndex) {
  const ids = Object.keys(CHARACTERS);
  const player = players[playerIndex];
  if (!player) return;
  const next = ids[(ids.indexOf(player.characterId) + 1) % ids.length];
  selectCharacter(playerIndex, next);
  setReaction(players[playerIndex], 'wave', 0.8);
}

function placeCanvasForSetup() {
  $('#setupStage').appendChild($('#canvasWrap'));
  $('#setupScreen').hidden = false;
  $('#playShell').hidden = true;
  syncCanvasResolution();
}

function placeCanvasForPlay() {
  $('#playShell').insertBefore($('#canvasWrap'), $('.game-controls'));
  $('#setupScreen').hidden = true;
  $('#playShell').hidden = false;
  syncCanvasResolution();
}

function startPlaying() {
  sound.ensureContext();
  sound.play('click');
  phase = 'playing';
  placeCanvasForPlay();
  lastTimestamp = performance.now();
  hideOverlay();
  announce(`${playerCount === 2 ? '双人协作' : '单人'}模式，${mission.name}，第 ${level} 关开始，团队目标 ${money(goal)}`);
  updateUI();
}

function dropHook(player = players[0]) {
  if (!player || phase !== 'playing' || player.hook.mode !== 'swing' || timeUp) return;
  player.hook.mode = 'extending';
  player.hook.hadCatch = false;
  player.hook.justReturned = false;
  player.visual.reaction = '';
  player.visual.reactionTime = 0;
  sound.play('drop');
  updateUI();
}

function useDynamite(player = players[0]) {
  if (!player || phase !== 'playing' || player.hook.mode !== 'retract' || !player.hook.caught || player.dynamites <= 0) return;
  const target = player.hook.caught;
  player.dynamites -= 1;
  target.state = 'collected';
  createExplosion(target.x, target.y);
  addFloatingText(target.x, target.y - 20, `${player.name} · 砰！`, '#ffe1a0');
  player.hook.caught = null;
  shake = 0.35;
  players.forEach((player) => setReaction(player, 'scared', 1.15));
  sound.play('explode');
  announce(`${player.name} 使用炸药，剩余 ${player.dynamites} 个`);
  showToast(`${player.name} 炸药 -1 · 钩爪加速回收`);
  updateUI();
}

function useHourglass(player = players[0]) {
  if (!player || phase !== 'playing' || player.hourglasses <= 0 || timeUp) return;
  player.hourglasses -= 1;
  timeLeft += 12;
  addFloatingText(player.origin.x + 45, player.origin.y - 50, `${player.name} · 时间 +12秒`, '#d5f2bd');
  setReaction(player, 'happy', 1);
  sound.play('collect');
  showToast(`${player.name} 使用时光沙漏 · 团队时间 +12 秒`);
  announce(`${player.name} 使用时光沙漏，剩余 ${player.hourglasses} 个`);
  updateUI();
}

function pauseGame() {
  if (phase !== 'playing') return;
  phase = 'paused';
  showOverlay('paused');
  updateUI();
}

function resumeGame() {
  if (phase !== 'paused') return;
  phase = 'playing';
  lastTimestamp = performance.now();
  hideOverlay();
  sound.play('click');
  updateUI();
}

function finishLevel() {
  if (phase !== 'playing' || !allHooksHome()) return;
  const total = teamScore();
  const succeeded = total >= goal;
  highScore = Math.max(highScore, total);
  saveHighScore();
  if (succeeded) {
    phase = 'shop';
    shopStockByPlayer = players.map(() => getShopStock());
    shopPlayerIndex = 0;
    shopMessage = `团队本关收获 ${money(total - levelStartScore)} · 每位玩家各有三件随机商品`;
    sound.play('success');
    spawnConfetti();
    showOverlay('shop');
    announce(`目标达成，团队成绩 ${money(total)}，矿工商店已开门`);
  } else {
    phase = 'gameOver';
    sound.play('fail');
    showOverlay('gameOver');
    announce(`本关结束，团队还差 ${money(goal - total)}`);
  }
  updateUI();
}

function buyShopItem(offerId) {
  if (phase !== 'shop') return;
  const player = players[shopPlayerIndex];
  const offers = shopStockByPlayer[shopPlayerIndex];
  const offer = offers.find((entry) => entry.id === offerId);
  const definition = SHOP_CATALOG.find((entry) => entry.id === offerId);
  const result = purchaseShopOffer(offer, player);
  if (!result.ok) {
    shopMessage = result.reason === 'coins' ? `${player.name} 金币不够，留着下一关再来买吧。` : result.reason === 'limit' ? '这件道具已经备妥或达到库存上限。' : '这件商品已经售出。';
    sound.play('catch');
  } else {
    player.coins = result.state.coins;
    player.dynamites = result.state.dynamites;
    player.hourglasses = result.state.hourglasses;
    player.pendingBuffs = result.state.pendingBuffs;
    shopStockByPlayer[shopPlayerIndex] = offers.map((entry) => entry.id === offerId ? result.offer : entry);
    shopMessage = `${player.name} 已购买「${definition.name}」${definition.buff ? '，将在下一关生效。' : '，已放入背包。'}`;
    sound.play('collect');
  }
  announce(shopMessage);
  showOverlay('shop');
  updateUI();
}

function nextLevel() {
  if (phase !== 'shop') return;
  level += 1;
  players.forEach((player) => {
    if (level % 2 === 0) player.dynamites = Math.min(5, player.dynamites + 1);
    player.activeBuffs = { ...player.pendingBuffs };
    player.pendingBuffs = createEmptyBuffs();
  });
  setupLevel();
  startPlaying();
  showToast(`第 ${level} 关 · ${theme.name} · ${difficulty.name}难度`);
}

function getHookTip(player, length = player.hook.length) {
  return {
    x: player.origin.x + Math.sin(player.hook.angle) * length,
    y: player.origin.y + Math.cos(player.hook.angle) * length,
  };
}

function updateGame(dt) {
  updateMovingItems(dt);
  timeLeft = Math.max(0, timeLeft - dt);
  if (timeLeft <= 0 && !timeUp) {
    timeUp = true;
    showToast('时间到！等双方钩爪收回就收工');
    players.forEach((player) => {
      if (player.hook.mode === 'extending') player.hook.mode = 'retract';
    });
  }

  players.forEach((player) => updateHook(player, dt));
  if (allHooksHome() && (timeUp || shouldFinishEarly(items, teamScore(), goal))) finishLevel();
  updateEffects(dt);
  if (shake > 0) shake = Math.max(0, shake - dt);
}

function updateMovingItems(dt) {
  for (const item of items) {
    if (item.kind !== 'pig' || item.state !== 'active') continue;
    item.x += item.vx * dt;
    if (item.x <= item.minX) {
      item.x = item.minX;
      item.vx = Math.abs(item.vx);
    } else if (item.x >= item.maxX) {
      item.x = item.maxX;
      item.vx = -Math.abs(item.vx);
    }
  }
}

function triggerTnt(player, barrel) {
  barrel.state = 'collected';
  player.hook.mode = 'retract';
  player.hook.caught = null;
  let destroyed = 0;
  for (const item of items) {
    if (item.state !== 'active' || item.id === barrel.id) continue;
    if (Math.hypot(item.x - barrel.x, item.y - barrel.y) < 120 + item.radius * 0.35) {
      item.state = 'collected';
      destroyed += 1;
    }
  }
  createExplosion(barrel.x, barrel.y);
  addFloatingText(barrel.x, barrel.y - 25, `${player.name} · 轰！`, '#ffb25d');
  shake = 0.35;
  players.forEach((player) => setReaction(player, 'scared', 1.15));
  sound.play('explode');
  showToast(destroyed ? `${player.name} 触发 TNT · 摧毁附近 ${destroyed} 件矿物` : `${player.name} 触发 TNT · 小心红色炸药桶`);
  announce(`${player.name} 触发 TNT，附近 ${destroyed} 件矿物被摧毁`);
}

function updateHook(player, dt) {
  const hook = player.hook;
  if (hook.mode === 'swing') {
    hook.angle += hook.direction * 1.25 * difficulty.swingFactor * getSwingMultiplier(player.characterId) * dt;
    if (hook.angle >= MAX_SWING_ANGLE) {
      hook.angle = MAX_SWING_ANGLE;
      hook.direction = -1;
    } else if (hook.angle <= -MAX_SWING_ANGLE) {
      hook.angle = -MAX_SWING_ANGLE;
      hook.direction = 1;
    }
    return;
  }

  if (hook.mode === 'extending') {
    const previous = getHookTip(player);
    hook.length += 560 * dt;
    const tip = getHookTip(player);
    let hit = null;
    let hitDistance = Infinity;
    for (const item of items) {
      if (item.state !== 'active') continue;
      const distance = pointToSegmentDistance(item.x, item.y, previous.x, previous.y, tip.x, tip.y);
      if (distance <= item.radius * 0.8 + 9) {
        const fromOrigin = Math.hypot(item.x - player.origin.x, item.y - player.origin.y);
        if (fromOrigin < hitDistance) {
          hit = item;
          hitDistance = fromOrigin;
        }
      }
    }
    if (hit) {
      hook.length = Math.max(MIN_HOOK_LENGTH, hitDistance);
      hook.hadCatch = true;
      if (hit.kind === 'tnt') {
        triggerTnt(player, hit);
      } else {
        hit.state = 'caught';
        hit.caughtBy = player.id;
        if (hit.kind === 'diamond') setReaction(player, 'delight', 0.8);
        else if (hit.kind === 'pig') setReaction(player, 'surprised', 1);
        else if (hit.kind === 'bag') setReaction(player, 'curious', 0.8);
        hook.caught = hit;
        hook.mode = 'retract';
        hit.x = player.origin.x + Math.sin(hook.angle) * hook.length;
        hit.y = player.origin.y + Math.cos(hook.angle) * hook.length;
        sound.play('catch');
        spawnDust(hit.x, hit.y, hit.kind === 'gold' || hit.kind === 'pig' ? '#f5c34f' : '#c7b28e', 8);
      }
    } else if (tip.x < 10 || tip.x > WORLD.width - 10 || tip.y > WORLD.height - 10 || hook.length > 1250) {
      hook.mode = 'retract';
    }
    return;
  }

  if (hook.mode === 'retract') {
    const strengthFactor = player.activeBuffs.strength ? 1.55 : 1;
    const characterPull = hook.caught ? getPullMultiplier(player.characterId, hook.caught) : 1;
    const speed = hook.caught ? hook.caught.pullSpeed * difficulty.pullFactor * strengthFactor * characterPull : 680;
    hook.length -= speed * dt;
    const tip = getHookTip(player);
    if (hook.caught) {
      hook.caught.x = tip.x;
      hook.caught.y = tip.y;
      hook.caught.rotation += dt * 0.3 * hook.direction;
    }
    if (hook.length <= MIN_HOOK_LENGTH) {
      hook.length = MIN_HOOK_LENGTH;
      if (hook.caught) collectCaughtItem(player);
      hook.justReturned = true;
      hook.mode = 'swing';
    }
  }
}

function collectCaughtItem(player) {
  const item = player.hook.caught;
  if (!item || item.caughtBy !== player.id) return;
  item.state = 'collected';
  player.hook.caught = null;
  cartBounce = 0.35;
  let itemValue = item.value;
  if (item.kind === 'diamond' || item.kind === 'pig') itemValue = Math.round(itemValue * mission.gemFactor);
  if (item.kind === 'rock') itemValue += mission.rockBonus;
  if (item.kind === 'diamond' && player.activeBuffs.diamond) itemValue = Math.round(itemValue * 1.5);
  if (item.kind === 'rock' && player.activeBuffs.rock) itemValue = 100 + mission.rockBonus;
  let label = `+${money(itemValue)}`;
  let color = item.kind === 'diamond' ? '#b8ffff' : '#ffe083';

  if (item.kind === 'bag') {
    const reward = getBagReward(Math.random, player.activeBuffs.clover);
    label = reward.label;
    if (reward.kind === 'money') {
      player.score += reward.amount;
      player.coins += reward.amount;
    }
    if (reward.kind === 'dynamite') player.dynamites = Math.min(5, player.dynamites + reward.amount);
    if (reward.kind === 'time') {
      timeLeft += reward.amount;
      timeUp = false;
      color = '#d5f2bd';
    }
  } else {
    player.score += itemValue;
    player.coins += itemValue;
  }

  const total = teamScore();
  if (total > highScore) {
    highScore = total;
    saveHighScore();
  }
  const prefix = playerCount === 2 ? `${player.name} · ` : '';
  addFloatingText(player.origin.x + 45, player.origin.y - 50, prefix + label, color);
  spawnDust(player.origin.x, player.origin.y - 6, item.kind === 'diamond' || item.kind === 'pig' ? '#91eeeb' : '#f6c44d', 16);
  if (item.kind === 'rock' && !player.activeBuffs.rock) setReaction(player, 'disappointed', 0.8);
  else if (item.kind === 'bag') setReaction(player, 'curious', 1);
  else if (item.kind === 'diamond' || item.kind === 'pig' || itemValue >= 250) setReaction(player, 'delight', 1.1);
  else setReaction(player, 'happy', 0.7);
  sound.play(item.kind === 'diamond' || item.kind === 'pig' ? 'diamond' : 'collect');
  announce(item.kind === 'bag' ? `${player.name} ${label}` : `${player.name} 获得 ${money(itemValue)}，团队成绩 ${money(total)}`);

  if (total >= goal && !goalAnnounced) {
    goalAnnounced = true;
    players.forEach((player) => setReaction(player, 'celebrate', 1.6));
    if (playerCount === 2) emotes.push({ playerId: -1, type: 'highfive', x: WORLD.width / 2, y: 62, life: 1.6, maxLife: 1.6 });
    showToast('团队目标达成！继续挖，冲击更高纪录 ✦');
  }
  updateUI();
}

function updateEffects(dt) {
  for (const effect of effects) {
    effect.life -= dt;
    effect.y -= 34 * dt;
  }
  effects = effects.filter((effect) => effect.life > 0);
  for (const particle of particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += particle.gravity * dt;
    particle.vx *= 0.992;
  }
  particles = particles.filter((particle) => particle.life > 0);
}

function addFloatingText(x, y, text, color) {
  effects.push({ x, y, text, color, life: 1.25, maxLife: 1.25 });
}

function spawnDust(x, y, color, count) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 100;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 35,
      gravity: 150,
      size: 2 + Math.random() * 4,
      color,
      life: 0.55 + Math.random() * 0.45,
      maxLife: 1,
    });
  }
}

function createExplosion(x, y) {
  const colors = ['#ffcf54', '#ef7b35', '#734c37', '#d8c1a0'];
  for (let index = 0; index < 34; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 210;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 190,
      size: 3 + Math.random() * 8,
      color: colors[index % colors.length],
      life: 0.65 + Math.random() * 0.5,
      maxLife: 1.15,
    });
  }
}

function spawnConfetti() {
  const colors = ['#f8c94c', '#f6e3a1', '#6fc4ae', '#e78b4b'];
  for (let index = 0; index < 60; index += 1) {
    particles.push({
      x: WORLD.width * (0.2 + Math.random() * 0.6),
      y: 80 + Math.random() * 100,
      vx: (Math.random() - 0.5) * 150,
      vy: -40 - Math.random() * 150,
      gravity: 180,
      size: 3 + Math.random() * 5,
      color: colors[index % colors.length],
      life: 1.5 + Math.random(),
      maxLife: 2.5,
    });
  }
}

function announce(message) {
  setText('#liveRegion', message);
}

function showToast(message) {
  const toast = $('#statusToast');
  setText(toast, message);
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function renderShopOffer(offer, player) {
  const definition = SHOP_CATALOG.find((entry) => entry.id === offer.id);
  const atLimit = (offer.id === 'dynamite' && player.dynamites >= 5)
    || (offer.id === 'hourglass' && player.hourglasses >= 3)
    || (definition.buff && player.pendingBuffs[definition.buff]);
  const disabled = offer.sold || atLimit || player.coins < offer.price;
  const buttonText = offer.sold ? '已购买' : atLimit ? '已备妥' : player.coins < offer.price ? `${money(offer.price)} · 余额不足` : `${money(offer.price)} · 购买`;
  return `<article class="shop-offer ${offer.sold ? 'sold' : ''}">
    <div class="shop-item-icon" aria-hidden="true">${definition.icon}</div>
    <div class="shop-item-copy"><h3>${definition.name}</h3><p>${offer.id === 'hourglass' ? `关卡中按 ${player.id === 1 ? 'Enter' : 'T'} 使用，立即增加 12 秒，库存上限 3。` : definition.description}</p></div>
    <button class="shop-buy" data-shop-item="${offer.id}" type="button" ${disabled ? 'disabled' : ''}>${buttonText}</button>
  </article>`;
}

function selectShopPlayer(index) {
  if (phase !== 'shop' || !players[index]) return;
  shopPlayerIndex = index;
  shopMessage = `正在查看 ${players[index].name} 的专属货架，购买不会影响另一位玩家。`;
  sound.play('click');
  showOverlay('shop');
}

function riskMeter(value, max = 5) {
  return `<span class="risk-meter" aria-label="${value}/${max}">${Array.from({ length: max }, (_, index) => `<i class="${index < value ? 'filled' : ''}"></i>`).join('')}</span>`;
}

function renderSetupOptions() {
  if (setupStep === 0) {
    const names = players.map((player) => `${player.name} · ${getCharacter(player.characterId).name}`).join(' ＋ ');
    return `<div class="option-heading"><span>STEP 01 · EXPEDITION TEAM</span><h3>组建你的矿工小队</h3><p>人数会立即出现在出征场景中。</p></div><div class="visual-choice-list">
      <button class="visual-choice ${playerCount === 1 ? 'selected' : ''}" data-mode="1" type="button"><span class="choice-icon">⛏️</span><span class="choice-copy"><b>单人勘探队</b><small>1 名矿工 · 独立掌握节奏</small><em>独自决策 / 完整资源</em></span><span class="choice-check">✓</span></button>
      <button class="visual-choice ${playerCount === 2 ? 'selected' : ''}" data-mode="2" type="button"><span class="choice-icon">👥</span><span class="choice-copy"><b>双人协作队</b><small>2 名矿工 · 双钩同时作业</small><em>共享目标 / 独立经济</em></span><span class="choice-check">✓</span></button></div>
      <div class="selection-summary"><span>当前出场</span><b>${names}</b><small>团队首关目标 ${money(goal)} · ${getLevelTime(1, difficultyId)} 秒</small></div>`;
  }
  if (setupStep === 1) {
    return `<div class="option-heading"><span>STEP 02 · EXPEDITION CONTRACT</span><h3>选择出征任务</h3><p>任务会改变矿区内容与真实计分规则。</p></div><div class="mission-list">${Object.values(MISSIONS).map((entry) => `<button class="mission-choice ${entry.id === missionId ? 'selected' : ''}" data-mission="${entry.id}" type="button"><span class="mission-icon">${entry.icon}</span><span class="mission-copy"><b>${entry.name}<small>${entry.subtitle}</small></b><span>${entry.description}</span><em>关注：${entry.focus}</em><span class="mission-risk">风险 ${riskMeter(entry.risk)} 收益 ${riskMeter(entry.reward)}</span></span></button>`).join('')}</div><div class="selection-summary"><span>当前合同</span><b>${mission.name}</b><small>目标系数 ×${mission.goalFactor} · 宝石系数 ×${mission.gemFactor} · 岩石加价 +${money(mission.rockBonus)}</small></div>`;
  }
  if (setupStep === 2) {
    const active = players[setupCharacterPlayer];
    const stats = { joe: [3, 4, 3], rocky: [5, 2, 2], lily: [2, 5, 4], max: [4, 3, 3] };
    return `<div class="option-heading"><span>STEP 03 · MINER ROSTER</span><h3>选择出场矿工</h3><p>查看模型、特长和数值倾向。</p></div>${playerCount === 2 ? `<div class="setup-player-tabs">${players.map((player, index) => `<button class="${index === setupCharacterPlayer ? 'selected' : ''}" data-setup-player="${index}" type="button">${player.name} · ${getCharacter(player.characterId).name}</button>`).join('')}</div>` : ''}<div class="character-choice-grid">${Object.values(CHARACTERS).map((character) => `<button class="character-choice ${character.id === active.characterId ? 'selected' : ''}" data-character-choice="${character.id}" type="button" style="--character-color:${character.color}"><span class="character-avatar">${character.id === 'rocky' ? '💪' : character.id === 'lily' ? '💎' : character.id === 'max' ? '🧨' : '⛏️'}</span><b>${character.name}</b><small>${character.title}</small><span class="character-passive">${character.passive}</span><span class="stat-line">力量 ${riskMeter(stats[character.id][0])}</span><span class="stat-line">技巧 ${riskMeter(stats[character.id][1])}</span><span class="stat-line">幸运 ${riskMeter(stats[character.id][2])}</span></button>`).join('')}</div><div class="selection-summary"><span>${active.name} 当前角色</span><b>${getCharacter(active.characterId).name}</b><small>${getCharacter(active.characterId).description}</small></div>`;
  }
  return `<div class="option-heading"><span>STEP 04 · MINE DIFFICULTY</span><h3>选择目标矿区</h3><p>难度会改变目标、时间、摆钩与障碍密度。</p></div><div class="difficulty-scene-list">${Object.values(DIFFICULTIES).map((entry) => `<button class="difficulty-scene ${entry.id} ${entry.id === difficultyId ? 'selected' : ''}" data-difficulty="${entry.id}" type="button"><span class="difficulty-landscape"><i>${entry.icon}</i></span><span class="difficulty-copy"><b>${entry.name}矿区 <small>${'★'.repeat(entry.stars)}${'☆'.repeat(3 - entry.stars)}</small></b><span>${entry.description}</span><em>${getLevelTime(1, entry.id)} 秒 · 基础目标 ${money(getLevelGoal(1, entry.id))}</em><span class="difficulty-bars">压力 ${riskMeter(entry.stars + 1)} 奖励 ${riskMeter(entry.stars + 1)}</span></span></button>`).join('')}</div><div class="selection-summary"><span>最终出征配置</span><b>${playerCount === 2 ? '双人' : '单人'} · ${mission.name} · ${difficulty.name}</b><small>实际首关目标 ${money(goal)} · ${getLevelTime(1, difficultyId)} 秒 · ${players.map((player) => getCharacter(player.characterId).name).join('＋')}</small></div>`;
}

function showOverlay(type) {
  let content = '';
  if (type === 'ready') {
    const stepNames = ['组建队伍', '出征任务', '出场矿工', '目标矿区'];
    $('#setupStepper').innerHTML = stepNames.map((name, index) => `<button class="setup-step ${index === setupStep ? 'active' : ''} ${index < setupStep ? 'complete' : ''}" data-setup-step="${index}" type="button"><span>${index < setupStep ? '✓' : index + 1}</span><b>${name}</b></button>`).join('');
    $('#setupOptions').innerHTML = renderSetupOptions();
    $('#setupBackButton').disabled = setupStep === 0;
    $('#setupNextButton').hidden = setupStep === 3;
    $('#startGameButton').hidden = setupStep !== 3;
    $('#startGameButton').innerHTML = `${playerCount === 2 ? '双人' : '单人'} · ${difficulty.name}难度出发 <span>→</span>`;
    placeCanvasForSetup();
  } else if (type === 'paused') {
    content = `
      <div class="overlay-card">
        <div class="overlay-emblem" aria-hidden="true">☕</div><span class="eyebrow">TAKE A BREATHER</span><h2>歇一会儿，矿工</h2>
        <p>倒计时、金猪和双方钩爪都已暂停。准备好再回来。</p>
        <button class="primary-button" id="resumeGameButton" type="button">继续淘金 <span>→</span></button><small class="overlay-shortcut">也可以按 P 键继续</small>
      </div>`;
  } else if (type === 'shop') {
    const shopper = players[shopPlayerIndex];
    const offers = shopStockByPlayer[shopPlayerIndex] || [];
    const pendingNames = SHOP_CATALOG.filter((entry) => entry.buff && shopper.pendingBuffs[entry.buff]).map((entry) => `${entry.icon} ${entry.name}`);
    const playerTabs = playerCount === 2 ? `<div class="shop-player-tabs">${players.map((player, index) => `<button class="${index === shopPlayerIndex ? 'selected' : ''}" data-shop-player="${index}" type="button"><b>${player.name}</b><span>${money(player.coins)}</span></button>`).join('')}</div>` : '';
    content = `
      <div class="shop-card">
        <div class="shop-header"><div><span class="eyebrow">PROVISIONS & CURIOSITIES</span><h2>矿工商店 ${playerCount === 2 ? `· ${shopper.name}` : ''}</h2><p>第 ${level} 关完成 · ${playerCount === 2 ? '每位玩家拥有独立货架与背包' : '为下一座矿区置办装备'}</p></div><div class="shop-wallet"><span>${shopper.name} 可用金币</span><strong>${money(shopper.coins)}</strong></div></div>
        ${playerTabs}
        <div class="shop-progress"><span>团队本关收获 <b>+${money(teamScore() - levelStartScore)}</b></span><span>团队累计成绩 <b>${money(teamScore())}</b></span><span>下一关目标 <b>${money(getMissionGoal(level + 1))}</b></span></div>
        <div class="shop-offers">${offers.map((offer) => renderShopOffer(offer, shopper)).join('')}</div>
        <div class="shop-backpack"><span>${shopper.name} 背包：🧨 炸药 × ${shopper.dynamites}　⏳ 沙漏 × ${shopper.hourglasses}</span><span>下一关增益：${pendingNames.length ? pendingNames.join(' · ') : '暂无，可直接出发'}</span></div>
        <p class="shop-message" role="status">${shopMessage}</p>
        <button class="primary-button" id="nextLevelButton" type="button">双方准备好，前往第 ${level + 1} 关 <span>→</span></button>
        <small class="overlay-shortcut">每人三件随机商品 · 金币与售出状态独立 · 消费不影响团队成绩</small>
      </div>`;
  } else if (type === 'gameOver') {
    const total = teamScore();
    content = `
      <div class="overlay-card">
        <div class="overlay-emblem" aria-hidden="true">🌙</div><span class="eyebrow">THE MINE IS CLOSED</span><h2>日落了，矿工</h2>
        <p>${difficulty.name}难度团队目标 ${money(goal)}，还差 <b>${money(Math.max(0, goal - total))}</b>。${playerCount === 2 ? '两人分头瞄准高价值矿物，效率会更高！' : '优先抓高价值矿物，或用炸药节省时间吧！'}</p>
        <div class="result-row"><div><span>本次团队成绩</span><strong>${money(total)}</strong></div><div><span>该模式纪录</span><strong>${money(highScore)}</strong></div></div>
        ${playerCount === 2 ? `<p class="gameover-players">${players.map((player) => `${player.name} ${money(player.score)}`).join(' · ')}</p>` : ''}
        <button class="primary-button" id="retryGameButton" type="button">再挖一次 <span>↻</span></button><br />
        <button class="secondary-button" id="chooseDifficultyButton" type="button">重新选择模式与难度</button>
      </div>`;
  }
  if (type === 'ready') {
    hideOverlay();
  } else {
    gameOverlay.innerHTML = content;
    gameOverlay.classList.add('visible');
    gameOverlay.classList.toggle('shop-mode', type === 'shop');
  }
  $('#resumeGameButton')?.addEventListener('click', resumeGame);
  $('#nextLevelButton')?.addEventListener('click', nextLevel);
  $('#retryGameButton')?.addEventListener('click', () => newGame(true));
  $('#chooseDifficultyButton')?.addEventListener('click', () => newGame(false));
  document.querySelectorAll('[data-difficulty]').forEach((button) => button.addEventListener('click', () => selectDifficulty(button.dataset.difficulty)));
  document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => selectMode(Number(button.dataset.mode))));
  document.querySelectorAll('[data-shop-item]').forEach((button) => button.addEventListener('click', () => buyShopItem(button.dataset.shopItem)));
  document.querySelectorAll('[data-shop-player]').forEach((button) => button.addEventListener('click', () => selectShopPlayer(Number(button.dataset.shopPlayer))));
  document.querySelectorAll('[data-character-player]').forEach((select) => select.addEventListener('change', () => selectCharacter(Number(select.dataset.characterPlayer), select.value)));
  document.querySelectorAll('[data-setup-step]').forEach((button) => button.addEventListener('click', () => setSetupStep(Number(button.dataset.setupStep))));
  document.querySelectorAll('[data-mission]').forEach((button) => button.addEventListener('click', () => selectMission(button.dataset.mission)));
  document.querySelectorAll('[data-setup-player]').forEach((button) => button.addEventListener('click', () => selectSetupCharacterPlayer(Number(button.dataset.setupPlayer))));
  document.querySelectorAll('[data-character-choice]').forEach((button) => button.addEventListener('click', () => selectCharacter(setupCharacterPlayer, button.dataset.characterChoice)));
}

function hideOverlay() {
  gameOverlay.classList.remove('visible', 'shop-mode');
  gameOverlay.innerHTML = '';
}

function updateUI() {
  const total = teamScore();
  setText('#score', playerCount === 2 ? players.map((player) => money(player.coins)).join(' / ') : money(players[0].coins));
  setText('#scoreLabel', playerCount === 2 ? 'P1 / P2 金币' : '可用金币');
  setText('#goal', money(goal));
  setText('#bestScore', money(highScore));
  setText('#level', level);
  setText('#regionName', `${mission.name} · ${difficulty.name}`);
  setText('#mineSignText', phase === 'ready' ? '点击矿工换装 · 查看角色特色' : 'GOLD CREEK · 1896');
  setText('#time', Math.ceil(timeLeft));
  $('#goalProgress').style.width = `${Math.min(100, (total / goal) * 100)}%`;
  $('#timerBlock').classList.toggle('danger', timeLeft <= 10 && phase === 'playing');
  $('.game-card').classList.toggle('double-mode', playerCount === 2);
  $('#setupScreen').hidden = phase !== 'ready';
  $('#playShell').hidden = phase === 'ready';
  $('#playControls').hidden = phase === 'ready';
  $('#player2Controls').hidden = playerCount !== 2;
  $('#p1Emotes').hidden = phase === 'ready';
  $('#p2Emotes').hidden = phase === 'ready' || playerCount !== 2;
  canvas.style.cursor = phase === 'ready' ? 'pointer' : 'crosshair';
  document.querySelectorAll('[data-emote-player]').forEach((button) => { button.disabled = phase !== 'playing'; });

  players.forEach((player, index) => {
    const suffix = index === 0 ? '' : '2';
    const hook = player.hook;
    setText(`#playerCoins${suffix}`, money(player.coins));
    setText(`#dynamiteCount${suffix}`, player.dynamites);
    setText(`#hourglassCount${suffix}`, player.hourglasses);
    const canDrop = phase === 'playing' && hook.mode === 'swing' && !timeUp;
    $(`#dropButton${suffix}`).disabled = !canDrop;
    const buttonText = timeUp ? '本关收工' : hook.mode === 'swing' ? '放下钩爪' : hook.mode === 'extending' ? '钩爪出动…' : '正在回收…';
    setText(`#dropButtonText${suffix}`, phase === 'paused' ? '游戏已暂停' : buttonText);
    $(`#dynamiteButton${suffix}`).disabled = phase !== 'playing' || hook.mode !== 'retract' || !hook.caught || player.dynamites <= 0;
    $(`#hourglassButton${suffix}`).disabled = phase !== 'playing' || player.hourglasses <= 0 || timeUp;
  });

  const activeBuffHtml = players.flatMap((player) => SHOP_CATALOG.filter((entry) => entry.buff && player.activeBuffs[entry.buff])
    .map((entry) => `<span title="${player.name}：${entry.description}">${playerCount === 2 ? `${player.name} ` : ''}${entry.icon} ${entry.name}</span>`)).join('');
  if ($('#buffDisplay').innerHTML !== activeBuffHtml) $('#buffDisplay').innerHTML = activeBuffHtml;

  $('#pauseButton').disabled = !['playing', 'paused'].includes(phase);
  setText('#pauseText', phase === 'paused' ? '继续游戏' : '暂停游戏');
  setText('#pauseIcon', phase === 'paused' ? '▶' : 'Ⅱ');
  $('#soundOnIcon').hidden = !sound.enabled;
  $('#soundOffIcon').hidden = sound.enabled;
  $('#soundButton').setAttribute('aria-label', sound.enabled ? '关闭音效' : '开启音效');
}

function toggleSound() {
  sound.enabled = !sound.enabled;
  storeValue(SOUND_KEY, sound.enabled ? 'on' : 'off');
  if (sound.enabled) sound.play('click');
  updateUI();
}

function openHelp() {
  sound.play('click');
  if (phase === 'playing') {
    phaseBeforeHelp = 'playing';
    phase = 'paused';
  }
  if (!helpDialog.open) helpDialog.showModal();
  updateUI();
}

function closeHelp() {
  if (helpDialog.open) helpDialog.close();
}

function pathFromPoints(points, close = true) {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  if (close) ctx.closePath();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.surfaceY);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.surfaceY);

  ctx.fillStyle = 'rgba(255,235,174,.32)';
  ctx.beginPath(); ctx.arc(865, 48, 42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = theme.id === 'magma' ? '#efb073' : '#f7e3ad';
  ctx.beginPath(); ctx.arc(865, 48, 26, 0, Math.PI * 2); ctx.fill();

  drawCloud(170, 45, 0.8);
  drawCloud(700, 82, 0.55);

  ctx.fillStyle = theme.mountain;
  pathFromPoints([
    { x: 0, y: 123 }, { x: 75, y: 92 }, { x: 126, y: 105 }, { x: 198, y: 63 },
    { x: 260, y: 111 }, { x: 344, y: 91 }, { x: 415, y: 126 }, { x: 520, y: 102 },
    { x: 610, y: 129 }, { x: 724, y: 92 }, { x: 790, y: 111 }, { x: 910, y: 82 },
    { x: 1000, y: 119 }, { x: 1000, y: 154 }, { x: 0, y: 154 },
  ]);
  ctx.fill();
  ctx.fillStyle = theme.mountainDark;
  pathFromPoints([
    { x: 0, y: 139 }, { x: 116, y: 117 }, { x: 205, y: 137 }, { x: 315, y: 111 },
    { x: 405, y: 141 }, { x: 560, y: 125 }, { x: 670, y: 143 }, { x: 814, y: 119 },
    { x: 900, y: 140 }, { x: 1000, y: 124 }, { x: 1000, y: 154 }, { x: 0, y: 154 },
  ]);
  ctx.fill();

  const soil = ctx.createLinearGradient(0, WORLD.surfaceY, 0, WORLD.height);
  soil.addColorStop(0, theme.soilTop);
  soil.addColorStop(0.45, theme.soilMid);
  soil.addColorStop(1, theme.soilBottom);
  ctx.fillStyle = soil;
  ctx.fillRect(0, WORLD.surfaceY, WORLD.width, WORLD.height - WORLD.surfaceY);

  drawStratum(264, theme.strata, 0.23, 0);
  drawStratum(420, '#2c2526', 0.2, 1.3);
  drawStratum(548, theme.strata, 0.13, 2.6);
  drawSoilDecor();
  drawThemeDecor();
  drawMineSupports();
  if (theme.id === 'desert' || theme.id === 'ruins') {
    drawCactus(83, 128, 0.75);
    drawCactus(936, 132, 0.52);
  }

  ctx.fillStyle = theme.surface;
  ctx.fillRect(0, WORLD.surfaceY - 7, WORLD.width, 9);
  ctx.fillStyle = theme.strata;
  ctx.fillRect(0, WORLD.surfaceY - 7, WORLD.width, 3);
  ctx.fillStyle = 'rgba(63,39,26,.25)';
  for (let x = 12; x < WORLD.width; x += 37) ctx.fillRect(x, WORLD.surfaceY - 4, 18, 2);
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255,240,205,.4)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 47, 9, 0, 0, Math.PI * 2);
  ctx.ellipse(-23, -5, 24, 10, 0, 0, Math.PI * 2);
  ctx.ellipse(15, -8, 31, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStratum(y, color, alpha, phaseOffset) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, y);
  for (let x = 0; x <= WORLD.width; x += 50) {
    ctx.lineTo(x, y + Math.sin(x / 115 + phaseOffset) * 14 + Math.sin(x / 47) * 4);
  }
  ctx.lineTo(WORLD.width, y + 30);
  for (let x = WORLD.width; x >= 0; x -= 50) {
    ctx.lineTo(x, y + 30 + Math.sin(x / 120 + phaseOffset) * 12);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const soilRandom = createRandom(1896);
const pebbles = Array.from({ length: 100 }, () => ({
  x: soilRandom() * WORLD.width,
  y: WORLD.surfaceY + 18 + soilRandom() * (WORLD.height - WORLD.surfaceY - 28),
  r: 1 + soilRandom() * 3,
  color: soilRandom() > 0.5 ? '#c28b5b' : '#3d2924',
  alpha: 0.12 + soilRandom() * 0.18,
}));

function drawSoilDecor() {
  for (const pebble of pebbles) {
    ctx.globalAlpha = pebble.alpha;
    ctx.fillStyle = pebble.color;
    ctx.beginPath();
    ctx.ellipse(pebble.x, pebble.y, pebble.r * 1.8, pebble.r, pebble.x, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#d1a373';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(90, 420, 19, 0.2, Math.PI * 1.8);
  ctx.arc(90, 420, 12, 0.2, Math.PI * 1.8);
  ctx.arc(90, 420, 5, 0.2, Math.PI * 1.8);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawThemeDecor() {
  ctx.save();
  if (theme.id === 'crystal') {
    const clusters = [[82, 548, 1], [910, 565, 1.25], [105, 225, 0.65]];
    for (const [x, y, scale] of clusters) {
      ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
      ctx.globalAlpha = 0.28; ctx.fillStyle = '#8fe5dc'; ctx.strokeStyle = '#b9fff5'; ctx.lineWidth = 1.5;
      pathFromPoints([{ x: -24, y: 18 }, { x: -18, y: -12 }, { x: -8, y: -25 }, { x: -5, y: 18 }]); ctx.fill(); ctx.stroke();
      pathFromPoints([{ x: -7, y: 18 }, { x: 2, y: -32 }, { x: 13, y: -45 }, { x: 17, y: 18 }]); ctx.fill(); ctx.stroke();
      pathFromPoints([{ x: 12, y: 18 }, { x: 24, y: -15 }, { x: 32, y: -24 }, { x: 34, y: 18 }]); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  } else if (theme.id === 'ruins') {
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#c6b982'; ctx.strokeStyle = '#3f3c2d'; ctx.lineWidth = 3;
    for (const x of [82, 905]) {
      ctx.fillRect(x - 17, 440, 34, 105); ctx.strokeRect(x - 17, 440, 34, 105);
      ctx.fillRect(x - 27, 430, 54, 13); ctx.fillRect(x - 25, 545, 50, 12);
      ctx.beginPath(); ctx.moveTo(x - 8, 452); ctx.lineTo(x + 7, 480); ctx.lineTo(x - 4, 510); ctx.stroke();
    }
  } else if (theme.id === 'magma') {
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ef7940'; ctx.lineWidth = 3; ctx.shadowColor = '#ff9b45'; ctx.shadowBlur = 10;
    for (const x of [75, 915]) {
      ctx.beginPath(); ctx.moveTo(x, 610); ctx.lineTo(x + 9, 580); ctx.lineTo(x - 5, 552); ctx.lineTo(x + 14, 520); ctx.lineTo(x + 4, 490); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawMineSupports() {
  ctx.fillStyle = '#493329';
  ctx.fillRect(22, WORLD.surfaceY + 3, 13, WORLD.height - WORLD.surfaceY);
  ctx.fillRect(WORLD.width - 35, WORLD.surfaceY + 3, 13, WORLD.height - WORLD.surfaceY);
  ctx.fillStyle = '#74503a';
  ctx.fillRect(25, WORLD.surfaceY + 3, 5, WORLD.height - WORLD.surfaceY);
  ctx.fillRect(WORLD.width - 32, WORLD.surfaceY + 3, 5, WORLD.height - WORLD.surfaceY);
  for (let y = 210; y < WORLD.height; y += 115) {
    ctx.fillStyle = '#3e2d26';
    ctx.fillRect(15, y, 28, 8);
    ctx.fillRect(WORLD.width - 43, y, 28, 8);
  }
}

function drawCactus(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#657053';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 22);
  ctx.lineTo(0, -32);
  ctx.moveTo(0, -6);
  ctx.lineTo(-15, -6);
  ctx.lineTo(-15, -20);
  ctx.moveTo(0, -15);
  ctx.lineTo(14, -15);
  ctx.lineTo(14, -26);
  ctx.stroke();
  ctx.strokeStyle = '#89906a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, 18);
  ctx.lineTo(-2, -30);
  ctx.stroke();
  ctx.restore();
}

function drawItems() {
  for (const item of items) {
    if (!['active', 'caught'].includes(item.state)) continue;
    if (item.ping) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, item.ping * 1.5);
      ctx.strokeStyle = '#fff2a8';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius + 13 + Math.sin(visualClock * 8) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    let drawX = item.x;
    let drawY = item.y;
    let drawRotation = item.rotation;
    if (item.state === 'caught') {
      const weight = getWeightClass(item);
      const amplitude = weight === 'extreme' ? 7 : weight === 'heavy' ? 5 : 2.5;
      const sway = reducedMotion ? 0 : Math.sin(visualClock * (weight === 'light' ? 10 : 5) + item.seed) * amplitude;
      drawX += sway * 0.55;
      drawY += Math.abs(sway) * 0.18;
      drawRotation += sway * 0.018;
      if (!reducedMotion && item.kind === 'pig') drawRotation += Math.sin(visualClock * 18) * 0.12;
      if (!reducedMotion && item.kind === 'bag') drawRotation += Math.sin(visualClock * 9 + item.seed) * 0.1;
    }
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.rotate(drawRotation);
    if (item.kind === 'gold') drawGold(item);
    else if (item.kind === 'diamond') drawDiamond(item);
    else if (item.kind === 'rock') drawRock(item);
    else if (item.kind === 'bag') drawBag(item);
    else if (item.kind === 'bone') drawBone(item);
    else if (item.kind === 'tnt') drawTnt(item);
    else if (item.kind === 'pig') drawPig(item);
    ctx.restore();
    if (!reducedMotion && (item.kind === 'diamond' || item.kind === 'gold') && Math.sin(visualClock * 2.4 + item.seed) > 0.82) {
      drawSparkle(drawX + item.radius * 0.45, drawY - item.radius * 0.55, item.kind === 'diamond' ? '#d4ffff' : '#fff0a8', item.kind === 'diamond' ? 6 : 4);
    }
  }
}

function drawSparkle(x, y, color, size) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
  ctx.stroke();
  ctx.restore();
}

function traceShape(shape, radius) {
  ctx.beginPath();
  shape.forEach((point, index) => {
    const x = Math.cos(point.angle) * radius * point.radius;
    const y = Math.sin(point.angle) * radius * point.radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function drawGold(item) {
  const r = item.radius;
  ctx.save();
  ctx.shadowColor = 'rgba(29,18,8,.28)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 5;
  const gradient = ctx.createRadialGradient(-r * 0.35, -r * 0.42, r * 0.08, 0, 0, r * 1.25);
  gradient.addColorStop(0, '#ffe795');
  gradient.addColorStop(0.35, '#f7c344');
  gradient.addColorStop(0.75, '#dfa02c');
  gradient.addColorStop(1, '#b76e1d');
  traceShape(item.shape, r);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#9f601d';
  ctx.lineWidth = Math.max(1.5, r * 0.055);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,244,180,.63)';
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.25);
  ctx.lineTo(-r * 0.16, -r * 0.65);
  ctx.lineTo(r * 0.13, -r * 0.43);
  ctx.lineTo(-r * 0.1, -r * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(167,100,25,.42)';
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.12);
  ctx.lineTo(r * 0.35, r * 0.15);
  ctx.lineTo(r * 0.16, r * 0.58);
  ctx.moveTo(-r * 0.1, -r * 0.12);
  ctx.lineTo(-r * 0.45, r * 0.34);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,232,137,.55)';
  ctx.beginPath();
  ctx.arc(r * 0.43, -r * 0.24, Math.max(1.5, r * 0.07), 0, Math.PI * 2);
  ctx.arc(-r * 0.22, r * 0.5, Math.max(1, r * 0.05), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDiamond(item) {
  const r = item.radius;
  ctx.save();
  ctx.shadowColor = 'rgba(85,239,226,.35)';
  ctx.shadowBlur = 15;
  const gradient = ctx.createLinearGradient(-r, -r, r, r);
  gradient.addColorStop(0, '#d5ffff');
  gradient.addColorStop(0.45, '#70ddd5');
  gradient.addColorStop(1, '#258b96');
  pathFromPoints([
    { x: 0, y: -r }, { x: r * 0.8, y: -r * 0.35 }, { x: r * 0.62, y: r * 0.45 },
    { x: 0, y: r }, { x: -r * 0.65, y: r * 0.42 }, { x: -r * 0.82, y: -r * 0.35 },
  ]);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#236f7b';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(235,255,255,.72)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(-r * 0.2, -r * 0.25); ctx.lineTo(0, r);
  ctx.moveTo(-r * 0.82, -r * 0.35); ctx.lineTo(-r * 0.2, -r * 0.25); ctx.lineTo(r * 0.8, -r * 0.35);
  ctx.moveTo(-r * 0.2, -r * 0.25); ctx.lineTo(r * 0.62, r * 0.45);
  ctx.moveTo(-r * 0.2, -r * 0.25); ctx.lineTo(-r * 0.65, r * 0.42);
  ctx.stroke();
  ctx.restore();
}

function drawRock(item) {
  const r = item.radius;
  ctx.save();
  ctx.shadowColor = 'rgba(23,18,16,.25)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 4;
  const gradient = ctx.createLinearGradient(-r, -r, r, r);
  gradient.addColorStop(0, '#aaa899');
  gradient.addColorStop(0.5, '#7e8077');
  gradient.addColorStop(1, '#555c56');
  traceShape(item.shape, r);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#484e48';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(220,215,191,.25)';
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, -r * 0.25);
  ctx.lineTo(-r * 0.15, -r * 0.65);
  ctx.lineTo(r * 0.22, -r * 0.36);
  ctx.lineTo(-r * 0.06, -r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(52,58,52,.6)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(r * 0.18, -r * 0.35);
  ctx.lineTo(r * 0.05, -r * 0.05);
  ctx.lineTo(r * 0.28, r * 0.12);
  ctx.lineTo(r * 0.13, r * 0.48);
  ctx.moveTo(r * 0.05, -r * 0.05);
  ctx.lineTo(-r * 0.22, r * 0.13);
  ctx.stroke();
  ctx.restore();
}

function drawBag(item) {
  const r = item.radius;
  ctx.save();
  ctx.shadowColor = 'rgba(24,16,10,.25)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 4;
  const gradient = ctx.createLinearGradient(-r, -r, r, r);
  gradient.addColorStop(0, '#d69b62');
  gradient.addColorStop(1, '#8a5438');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -r * 0.55);
  ctx.quadraticCurveTo(-r * 0.85, -r * 0.05, -r * 0.85, r * 0.45);
  ctx.quadraticCurveTo(-r * 0.65, r, 0, r);
  ctx.quadraticCurveTo(r * 0.7, r, r * 0.85, r * 0.42);
  ctx.quadraticCurveTo(r * 0.8, -r * 0.05, r * 0.34, -r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#71432f';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#b8794b';
  ctx.beginPath();
  ctx.moveTo(-r * 0.38, -r * 0.58); ctx.lineTo(-r * 0.48, -r * 0.95);
  ctx.lineTo(0, -r * 0.77); ctx.lineTo(r * 0.47, -r * 0.96); ctx.lineTo(r * 0.35, -r * 0.55);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#efd08b';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-r * 0.48, -r * 0.48); ctx.quadraticCurveTo(0, -r * 0.33, r * 0.48, -r * 0.48); ctx.stroke();
  ctx.fillStyle = '#fff0c5';
  ctx.font = `900 ${r * 1.05}px 'DM Sans', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, r * 0.25);
  ctx.restore();
}

function drawBone(item) {
  const r = item.radius;
  ctx.save();
  ctx.shadowColor = 'rgba(20,15,10,.3)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
  ctx.strokeStyle = '#d8ceb0'; ctx.lineWidth = r * 0.45; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.55, r * 0.45); ctx.lineTo(r * 0.55, -r * 0.45); ctx.stroke();
  ctx.shadowColor = 'transparent'; ctx.fillStyle = '#e7dec2'; ctx.strokeStyle = '#938b74'; ctx.lineWidth = 1.3;
  for (const [x, y] of [[-r * 0.66, r * 0.32], [-r * 0.42, r * 0.65], [r * 0.66, -r * 0.32], [r * 0.42, -r * 0.65]]) {
    ctx.beginPath(); ctx.arc(x, y, r * 0.27, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawTnt(item) {
  const r = item.radius;
  ctx.save();
  ctx.shadowColor = 'rgba(20,12,8,.35)'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 4;
  const gradient = ctx.createLinearGradient(-r, 0, r, 0);
  gradient.addColorStop(0, '#76392e'); gradient.addColorStop(0.45, '#bd5540'); gradient.addColorStop(1, '#6d312c');
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.roundRect(-r * 0.75, -r * 0.85, r * 1.5, r * 1.7, 5); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#452b26'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#393431'; ctx.fillRect(-r * 0.85, -r * 0.82, r * 1.7, r * 0.22); ctx.fillRect(-r * 0.85, r * 0.58, r * 1.7, r * 0.22);
  ctx.fillStyle = '#ead8ac'; ctx.fillRect(-r * 0.72, -r * 0.25, r * 1.44, r * 0.65);
  ctx.fillStyle = '#773529'; ctx.font = `900 ${r * 0.55}px 'DM Sans', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TNT', 0, r * 0.08);
  ctx.strokeStyle = '#332c26'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r * 0.85); ctx.quadraticCurveTo(r * 0.1, -r * 1.25, r * 0.45, -r * 1.25); ctx.stroke();
  ctx.fillStyle = '#ffc54d'; ctx.shadowColor = '#ffb13b'; ctx.shadowBlur = 7 + Math.sin(visualClock * 18) * 3;
  ctx.beginPath(); ctx.arc(r * 0.47, -r * 1.25, 3 + Math.sin(visualClock * 20) * 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.restore();
}

function drawPig(item) {
  const r = item.radius;
  const direction = item.vx >= 0 ? 1 : -1;
  const struggle = !reducedMotion && item.state === 'caught' ? Math.sin(visualClock * 20 + item.seed) * 5 : 0;
  ctx.save();
  ctx.scale(direction, 1);
  ctx.shadowColor = 'rgba(24,16,10,.28)'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#dca072'; ctx.beginPath(); ctx.ellipse(-3, 1, r * 1.05, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#85583f'; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.fillStyle = '#e6ad7d'; ctx.beginPath(); ctx.arc(r * 0.72, -r * 0.15, r * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#efb88c'; ctx.beginPath(); ctx.ellipse(r * 1.12, -r * 0.04, r * 0.32, r * 0.23, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#835440'; ctx.beginPath(); ctx.arc(r * 1.2, -r * 0.09, 1.6, 0, Math.PI * 2); ctx.arc(r * 1.02, -r * 0.09, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2d302b'; ctx.beginPath(); ctx.arc(r * 0.83, -r * 0.36, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c98562'; pathFromPoints([{ x: r * 0.43, y: -r * 0.55 }, { x: r * 0.48, y: -r * 1.02 }, { x: r * 0.82, y: -r * 0.64 }]); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#85583f'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 0.55, r * 0.5); ctx.lineTo(-r * 0.55 + struggle, r * 0.83); ctx.moveTo(r * 0.25, r * 0.5); ctx.lineTo(r * 0.25 - struggle, r * 0.83); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * 1.05, -r * 0.1); ctx.quadraticCurveTo(-r * 1.45, -r * 0.55, -r * 1.35, r * 0.1); ctx.quadraticCurveTo(-r * 1.25, r * 0.35, -r * 1.45, r * 0.25); ctx.stroke();
  ctx.save(); ctx.translate(-r * 0.25, -r * 0.72); drawDiamond({ radius: 12 }); ctx.restore();
  ctx.restore();
}

function drawRopeAndHook(player) {
  const hook = player.hook;
  const tip = getHookTip(player);
  const tension = player.visual.tension || 0;
  const ropePath = () => {
    ctx.beginPath();
    for (let index = 0; index <= 14; index += 1) {
      const progress = index / 14;
      const baseX = player.origin.x + (tip.x - player.origin.x) * progress;
      const baseY = player.origin.y + (tip.y - player.origin.y) * progress;
      const vibration = reducedMotion ? 0 : Math.sin(visualClock * (18 + tension * 15) - index * 0.85) * tension * 2.2 * Math.sin(progress * Math.PI);
      const x = baseX + Math.cos(hook.angle) * vibration;
      const y = baseY - Math.sin(hook.angle) * vibration;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  ctx.strokeStyle = '#302d28';
  ctx.lineWidth = 3.4 + tension * 0.7;
  ropePath();
  ctx.stroke();
  ctx.strokeStyle = player.id === 0 ? '#c4a26b' : '#89b3c5';
  ctx.lineWidth = 1.2;
  ropePath();
  ctx.stroke();

  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(-hook.angle);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const clawPath = new Path2D();
  const spread = hook.caught ? 10 : 18;
  const elbow = hook.caught ? 9 : 13;
  clawPath.moveTo(0, -8);
  clawPath.lineTo(0, 2);
  clawPath.moveTo(-2, 0);
  clawPath.quadraticCurveTo(-elbow, 4, -elbow, 13);
  clawPath.lineTo(-spread, 8);
  clawPath.moveTo(2, 0);
  clawPath.quadraticCurveTo(elbow, 4, elbow, 13);
  clawPath.lineTo(spread, 8);
  ctx.strokeStyle = '#292e2c';
  ctx.lineWidth = 5.5;
  ctx.stroke(clawPath);
  ctx.strokeStyle = player.id === 0 ? '#d5d3bd' : '#a5d6e5';
  ctx.lineWidth = 2.4;
  ctx.stroke(clawPath);
  ctx.fillStyle = '#d5d3bd';
  ctx.beginPath(); ctx.arc(0, -6, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawMinerArm(points, palette) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 11;
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); ctx.lineTo(points[1][0], points[1][1]); ctx.stroke();
  ctx.strokeStyle = palette.skin;
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(points[1][0], points[1][1]); ctx.lineTo(points[2][0], points[2][1]); ctx.stroke();
  ctx.fillStyle = palette.skin;
  ctx.beginPath(); ctx.arc(points[2][0], points[2][1], 5, 0, Math.PI * 2); ctx.fill();
}

function drawMinerHead(player, action) {
  const character = getCharacter(player.characterId);
  const visual = player.visual;
  const expression = ['disappointed', 'shrug'].includes(action) ? 'disappointed' : visual.expression;
  const time = reducedMotion ? 0 : visual.time || 0;
  const hx = -15;
  const hy = character.id === 'rocky' ? -96 : -94;
  const radius = character.id === 'rocky' ? 21 : character.id === 'lily' ? 18 : 19;

  if (character.id === 'lily') {
    ctx.fillStyle = '#5b3a2d';
    ctx.beginPath(); ctx.ellipse(hx - 17, hy + 4, 8, 16, -0.35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx - 22, hy + 17, 5, 10, -0.4, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = character.palette.skin;
  ctx.beginPath(); ctx.arc(hx - radius + 2, hy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx, hy, radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(216,122,91,.24)';
  ctx.beginPath(); ctx.arc(hx + 8, hy + 4, 4, 0, Math.PI * 2); ctx.fill();

  if (character.id === 'joe') {
    ctx.fillStyle = '#f1e5c8';
    ctx.beginPath();
    ctx.moveTo(hx - radius + 2, hy + 1);
    ctx.quadraticCurveTo(hx - 19, hy + 29, hx + 2, hy + 25);
    ctx.quadraticCurveTo(hx + 19, hy + 18, hx + 15, hy - 1);
    ctx.quadraticCurveTo(hx + 3, hy + 7, hx - radius + 2, hy + 1);
    ctx.fill();
    ctx.strokeStyle = '#d2c5a7'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx - 9, hy + 12); ctx.lineTo(hx - 6, hy + 22); ctx.moveTo(hx, hy + 12); ctx.lineTo(hx + 2, hy + 22); ctx.stroke();
  } else if (character.id === 'rocky') {
    ctx.fillStyle = '#513c31';
    ctx.beginPath(); ctx.arc(hx, hy + 9, radius * 0.78, 0.05, Math.PI - 0.05); ctx.lineTo(hx + 9, hy + 17); ctx.quadraticCurveTo(hx, hy + 24, hx - 9, hy + 17); ctx.fill();
  }

  const blink = Math.sin(time * 1.25 + visual.seed * 2.1) > 0.975;
  const look = Math.max(-2, Math.min(2, (visual.lookAngle || 0) * 2));
  const eyeY = hy - 5;
  const drawEye = (eyeX) => {
    if (expression === 'happy' || action === 'delight' || action === 'celebrate') {
      ctx.strokeStyle = '#3c332b'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(eyeX, eyeY + 1, 3, Math.PI + 0.2, Math.PI * 2 - 0.2); ctx.stroke();
    } else if (expression === 'strain' || blink) {
      ctx.strokeStyle = '#3c332b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(eyeX - 3, eyeY); ctx.lineTo(eyeX + 3, eyeY); ctx.stroke();
    } else {
      ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.ellipse(eyeX, eyeY, expression === 'surprised' ? 4 : 3.2, expression === 'surprised' ? 5 : 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#30352f'; ctx.beginPath(); ctx.arc(eyeX + look, eyeY + 0.5, expression === 'surprised' ? 1.5 : 1.8, 0, Math.PI * 2); ctx.fill();
    }
  };
  drawEye(hx - 6);
  drawEye(hx + 7);

  ctx.strokeStyle = character.id === 'lily' ? '#5b3a2d' : '#6a4a35';
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  const browTilt = expression === 'strain' ? 2 : expression === 'surprised' ? -2 : 0;
  ctx.moveTo(hx - 10, eyeY - 7 + browTilt); ctx.lineTo(hx - 3, eyeY - 8 - browTilt);
  ctx.moveTo(hx + 4, eyeY - 8 - browTilt); ctx.lineTo(hx + 11, eyeY - 7 + browTilt);
  ctx.stroke();

  ctx.fillStyle = character.palette.skin;
  ctx.strokeStyle = '#a76e50'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(hx + 10, hy - 2); ctx.lineTo(hx + 17, hy + 1); ctx.lineTo(hx + 10, hy + 4); ctx.stroke();

  if (character.id === 'max') {
    ctx.fillStyle = '#4c362c';
    ctx.beginPath(); ctx.moveTo(hx - 2, hy + 7); ctx.quadraticCurveTo(hx + 6, hy + 2, hx + 14, hy + 7); ctx.quadraticCurveTo(hx + 5, hy + 12, hx - 2, hy + 7); ctx.fill();
  }

  ctx.strokeStyle = '#824b3d'; ctx.fillStyle = '#824b3d'; ctx.lineWidth = 1.8;
  if (expression === 'surprised' || action === 'curious') {
    ctx.beginPath(); ctx.ellipse(hx + 5, hy + 11, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  } else if (expression === 'happy' || action === 'delight' || action === 'celebrate') {
    ctx.beginPath(); ctx.arc(hx + 5, hy + 6, 7, 0.15, Math.PI - 0.15); ctx.stroke();
    ctx.fillStyle = '#fff4df'; ctx.beginPath(); ctx.arc(hx + 5, hy + 7, 5, 0.1, Math.PI - 0.1); ctx.fill();
  } else if (expression === 'disappointed') {
    ctx.beginPath(); ctx.arc(hx + 5, hy + 15, 6, Math.PI + 0.2, Math.PI * 2 - 0.2); ctx.stroke();
  } else if (expression === 'strain') {
    ctx.fillStyle = '#704237'; ctx.beginPath(); ctx.roundRect(hx - 2, hy + 8, 13, 5, 2); ctx.fill();
    ctx.fillStyle = '#f2dfc7'; ctx.fillRect(hx, hy + 8, 9, 2);
  } else {
    ctx.beginPath(); ctx.moveTo(hx + 1, hy + 10); ctx.quadraticCurveTo(hx + 5, hy + 12, hx + 10, hy + 9); ctx.stroke();
  }

  ctx.save();
  ctx.translate(hx, hy - radius + 3);
  ctx.rotate(-(visual.tension || 0) * 0.08 + (action === 'shrug' ? -0.08 : 0));
  if (character.id === 'max') {
    ctx.fillStyle = '#b94b3e';
    ctx.beginPath(); ctx.arc(0, 2, radius + 1, Math.PI, 0); ctx.lineTo(radius + 2, 3); ctx.lineTo(-radius - 1, 3); ctx.fill();
    ctx.fillRect(-radius - 3, -1, radius * 2 + 7, 7);
    ctx.beginPath(); ctx.moveTo(-radius, 2); ctx.lineTo(-radius - 11, -4); ctx.lineTo(-radius - 7, 7); ctx.fill();
  } else {
    const hatColor = character.id === 'lily' ? '#6f5c89' : character.id === 'rocky' ? '#4d4b43' : '#d6a23a';
    ctx.fillStyle = hatColor;
    ctx.beginPath(); ctx.ellipse(0, 1, character.id === 'rocky' ? 25 : 30, 6, -0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, character.id === 'rocky' ? 18 : 19, Math.PI, 0); ctx.lineTo(19, 2); ctx.lineTo(-19, 2); ctx.fill();
    ctx.fillStyle = character.palette.accent; ctx.fillRect(-19, -3, 38, 5);
    ctx.fillStyle = '#f6e5aa'; ctx.beginPath(); ctx.arc(0, -8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff4bc'; ctx.beginPath(); ctx.arc(-1, -9, 2, 0, Math.PI * 2); ctx.fill();
    if (character.id === 'lily') {
      ctx.fillStyle = '#354c52'; ctx.beginPath(); ctx.roundRect(-16, -9, 12, 8, 3); ctx.roundRect(4, -9, 12, 8, 3); ctx.fill();
      ctx.fillStyle = '#8ee5e4'; ctx.beginPath(); ctx.roundRect(-14, -8, 8, 5, 2); ctx.roundRect(6, -8, 8, 5, 2); ctx.fill();
      ctx.strokeStyle = '#354c52'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(4, -5); ctx.stroke();
    }
  }
  ctx.restore();

  if ((visual.tension || 0) > 0.58) {
    const sweatY = hy - 12 + ((time * 24) % 18);
    ctx.fillStyle = '#a8e3e5';
    ctx.beginPath(); ctx.moveTo(hx + 20, sweatY); ctx.quadraticCurveTo(hx + 16, sweatY + 7, hx + 20, sweatY + 8); ctx.quadraticCurveTo(hx + 24, sweatY + 7, hx + 20, sweatY); ctx.fill();
  }
}

function drawWinch(player) {
  const visual = player.visual;
  ctx.fillStyle = '#49372a'; ctx.beginPath(); ctx.roundRect(-10, -25, 51, 23, 5); ctx.fill();
  ctx.fillStyle = '#aa7542'; ctx.beginPath(); ctx.roundRect(-6, -29, 44, 20, 4); ctx.fill();
  ctx.fillStyle = '#d1a35c'; ctx.beginPath(); ctx.ellipse(16, -19, 17, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#68492f'; ctx.lineWidth = 2;
  for (let offset = -9; offset <= 9; offset += 6) {
    ctx.beginPath(); ctx.moveTo(16 + offset, -27); ctx.lineTo(16 + offset, -11); ctx.stroke();
  }
  ctx.save(); ctx.translate(16, -19); ctx.rotate(reducedMotion ? 0 : visual.crank || 0);
  ctx.strokeStyle = '#30352f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 0); ctx.stroke();
  ctx.fillStyle = '#30352f'; ctx.beginPath(); ctx.arc(12, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#e6c178'; ctx.beginPath(); ctx.arc(16, -19, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d9d0b5';
  for (const [x, y] of [[-5, -23], [33, -23]]) { ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill(); }
}

function drawMiner(player) {
  const character = getCharacter(player.characterId);
  const visual = player.visual;
  const action = visual.action || 'idle';
  const time = reducedMotion ? 0 : visual.time || 0;
  const tension = visual.tension || 0;
  const ground = WORLD.surfaceY;
  const breathing = reducedMotion ? 0 : Math.sin(time * 2.2 + visual.seed) * 1.2;
  const celebrateBounce = !reducedMotion && action === 'celebrate' ? -Math.abs(Math.sin(time * 8)) * 5 : 0;
  const skid = action === 'extremePull' ? tension * 7 : action === 'heavyPull' ? tension * 3 : 0;
  const lean = action === 'extremePull' ? -0.1 : action === 'heavyPull' ? -0.055 : action === 'scared' ? -0.09 : 0;
  ctx.save();
  ctx.translate(player.origin.x, ground + celebrateBounce);

  if (skid > 2) {
    ctx.fillStyle = 'rgba(218,180,120,.25)';
    ctx.beginPath(); ctx.ellipse(-34, -3, 14 + skid, 3, 0, 0, Math.PI * 2); ctx.fill();
  }

  const kneeBend = tension * 5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = character.palette.secondary; ctx.lineWidth = character.id === 'rocky' ? 13 : 11;
  ctx.beginPath(); ctx.moveTo(-23, -38); ctx.lineTo(-29 - kneeBend, -19); ctx.lineTo(-37 - skid, -5);
  ctx.moveTo(-7, -38); ctx.lineTo(-3 + kneeBend, -18); ctx.lineTo(4 + skid, -5); ctx.stroke();
  ctx.strokeStyle = '#35332d'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(-37 - skid, -5); ctx.lineTo(-44 - skid, -3); ctx.moveTo(4 + skid, -5); ctx.lineTo(12 + skid, -3); ctx.stroke();

  ctx.save();
  ctx.translate(0, breathing);
  ctx.rotate(lean);

  let leftArm;
  let rightArm;
  const crank = reducedMotion ? 0 : Math.sin(visual.crank || 0) * (4 - tension * 2);
  if (action === 'wave') {
    leftArm = [[-30, -66], [-38, -48], [-19, -37]];
    rightArm = [[0, -65], [13, -88], [16 + Math.sin(time * 13) * 6, -111]];
  } else if (action === 'like') {
    leftArm = [[-30, -66], [-38, -48], [-19, -37]];
    rightArm = [[0, -65], [14, -72], [18, -96]];
  } else if (action === 'point') {
    leftArm = [[-30, -66], [-38, -48], [-19, -37]];
    rightArm = [[0, -65], [20, -67], [42, -75]];
  } else if (action === 'celebrate' || action === 'scared') {
    leftArm = [[-30, -66], [-43, -86], [-43 - Math.sin(time * 9) * 3, -108]];
    rightArm = [[0, -65], [14, -85], [18 + Math.sin(time * 9) * 3, -108]];
  } else if (action === 'drop') {
    leftArm = [[-30, -66], [-36, -48], [-17, -37]];
    rightArm = [[0, -65], [18, -58], [34, -48]];
  } else {
    leftArm = [[-30, -66], [-39, -48], [-10 + crank, -35]];
    rightArm = [[0, -65], [12, -48], [25, -35 - crank]];
  }
  drawMinerArm(leftArm, character.palette);
  drawMinerArm(rightArm, character.palette);

  if (action === 'like') {
    ctx.strokeStyle = character.palette.skin; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(18, -96); ctx.lineTo(19, -104); ctx.stroke();
  }
  if (action === 'point') {
    ctx.strokeStyle = character.palette.skin; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(41, -75); ctx.lineTo(50, -77); ctx.stroke();
  }

  const torsoWidth = character.id === 'rocky' ? 47 : character.id === 'lily' ? 35 : 40;
  ctx.fillStyle = character.palette.primary;
  ctx.beginPath(); ctx.roundRect(-15 - torsoWidth / 2, -79, torsoWidth, 49, 10); ctx.fill();
  ctx.fillStyle = character.palette.secondary;
  ctx.beginPath(); ctx.roundRect(-15 - torsoWidth / 2 + 4, -56, torsoWidth - 8, 27, 5); ctx.fill();
  ctx.strokeStyle = character.palette.accent; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-27, -73); ctx.lineTo(-23, -53); ctx.moveTo(-4, -73); ctx.lineTo(-8, -53); ctx.stroke();
  ctx.fillStyle = '#d4a43c'; ctx.fillRect(-29, -57, 29, 5);
  ctx.fillStyle = '#f1cf70';
  for (const buttonX of [-23, -8]) { ctx.beginPath(); ctx.arc(buttonX, -53, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-29, -75); ctx.quadraticCurveTo(-17, -81, -6, -76); ctx.stroke();

  if (character.id === 'max') {
    ctx.fillStyle = '#9b3831'; ctx.fillRect(-27, -47, 4, 13); ctx.fillRect(-19, -47, 4, 13);
    ctx.fillStyle = '#e4c064'; ctx.fillRect(-27, -47, 4, 2); ctx.fillRect(-19, -47, 4, 2);
  }

  drawMinerHead(player, action);
  ctx.restore();
  drawWinch(player);

  ctx.fillStyle = player.id === 0 ? '#476052' : '#47708a';
  ctx.beginPath(); ctx.roundRect(-18, -ground + 15, 42, 19, 8); ctx.fill();
  ctx.fillStyle = '#fff9e9'; ctx.font = "800 11px 'DM Sans', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(playerCount === 2 ? player.name : character.name, 3, -ground + 25);
  ctx.restore();
}

function drawMineCart() {
  ctx.save();
  ctx.translate(playerCount === 2 ? 500 : 704, 127 - (!reducedMotion && cartBounce > 0 ? Math.sin((cartBounce / 0.35) * Math.PI) * 5 : 0));
  ctx.fillStyle = '#5c4936';
  pathFromPoints([{ x: -40, y: -16 }, { x: 35, y: -16 }, { x: 26, y: 12 }, { x: -29, y: 12 }]);
  ctx.fill();
  ctx.strokeStyle = '#332f28'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#c28d35';
  ctx.beginPath(); ctx.arc(-12, -17, 13, Math.PI, 0); ctx.arc(9, -16, 11, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#34352f';
  ctx.beginPath(); ctx.arc(-22, 17, 7, 0, Math.PI * 2); ctx.arc(19, 17, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawEmotes() {
  const symbols = { wave: '👋', point: '💎', like: '👍', highfive: '🤝' };
  for (const emote of emotes) {
    const progress = 1 - emote.life / emote.maxLife;
    const alpha = Math.min(1, emote.life * 2.5, progress * 5 + 0.15);
    const width = emote.type === 'highfive' ? 92 : 48;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(emote.x, emote.y - progress * 12);
    ctx.shadowColor = 'rgba(30,24,16,.22)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#fff8e7'; ctx.beginPath(); ctx.roundRect(-width / 2, -20, width, 36, 13); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.beginPath(); ctx.moveTo(-5, 15); ctx.lineTo(3, 15); ctx.lineTo(-2, 23); ctx.fill();
    ctx.font = `${emote.type === 'highfive' ? 17 : 20}px 'Noto Sans SC', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5b4c37';
    ctx.fillText(emote.type === 'highfive' ? `${symbols[emote.type]} 默契！` : symbols[emote.type], 0, -2);
    ctx.restore();
  }
}

function drawEffects() {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const effect of effects) {
    ctx.globalAlpha = Math.min(1, effect.life * 2);
    ctx.font = "800 23px 'DM Sans', 'Noto Sans SC', sans-serif";
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(52,37,25,.6)';
    ctx.strokeText(effect.text, effect.x, effect.y);
    ctx.fillStyle = effect.color;
    ctx.fillText(effect.text, effect.x, effect.y);
  }
  ctx.globalAlpha = 1;
}

function drawSetupPlayerAt(player, x, y, scale = 1.7) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-player.origin.x, -WORLD.surfaceY);
  drawMiner(player);
  ctx.restore();
}

function drawSetupItem(item, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (item.kind === 'gold') drawGold(item);
  else if (item.kind === 'diamond') drawDiamond(item);
  else if (item.kind === 'rock') drawRock(item);
  else if (item.kind === 'bag') drawBag(item);
  else if (item.kind === 'tnt') drawTnt(item);
  else if (item.kind === 'pig') drawPig(item);
  ctx.restore();
}

function drawSetupPlaque(title, subtitle) {
  ctx.save();
  ctx.fillStyle = 'rgba(38,47,37,.82)';
  ctx.beginPath(); ctx.roundRect(250, 24, 500, 65, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(244,210,126,.4)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff0c7'; ctx.font = "900 27px 'Noto Sans SC', sans-serif"; ctx.fillText(title, 500, 53);
  ctx.fillStyle = '#d5c8a5'; ctx.font = "600 12px 'Noto Sans SC', sans-serif"; ctx.fillText(subtitle, 500, 75);
  ctx.restore();
}

function drawSetupScene() {
  drawBackground();
  const floor = ctx.createLinearGradient(0, 405, 0, 620);
  floor.addColorStop(0, 'rgba(46,31,24,0)'); floor.addColorStop(1, 'rgba(28,24,20,.72)');
  ctx.fillStyle = floor; ctx.fillRect(0, 390, 1000, 230);
  ctx.fillStyle = '#6f4a2f'; ctx.beginPath(); ctx.roundRect(190, 456, 620, 70, 12); ctx.fill();
  ctx.fillStyle = '#9b6b3e'; ctx.fillRect(205, 456, 590, 9);
  ctx.strokeStyle = 'rgba(47,29,20,.5)'; ctx.lineWidth = 3;
  for (let x = 225; x < 790; x += 55) { ctx.beginPath(); ctx.moveTo(x, 466); ctx.lineTo(x, 521); ctx.stroke(); }

  const positions = playerCount === 2 ? [350, 650] : [500];
  if (setupStep === 0) {
    drawSetupPlaque(playerCount === 2 ? '双人协作队，准备出征' : '单人勘探队，准备出征', '选择队伍人数，出场模型会立即变化');
    players.forEach((player, index) => drawSetupPlayerAt(player, positions[index], 462, 1.8));
  } else if (setupStep === 1) {
    drawSetupPlaque(mission.name, `${mission.subtitle} · ${mission.focus} · 目标系数 ×${mission.goalFactor}`);
    players.forEach((player, index) => drawSetupPlayerAt(player, playerCount === 2 ? 245 + index * 510 : 280, 462, 1.25));
    if (missionId === 'gold') {
      drawSetupItem({ kind: 'gold', radius: 76, seed: 8, shape: makeShape(8, 10) }, 565, 325, 1.35);
      drawSetupItem({ kind: 'bag', radius: 48, seed: 4 }, 700, 375, 1.1);
      drawSetupItem({ kind: 'gold', radius: 30, seed: 12, shape: makeShape(12, 10) }, 455, 390, 1.1);
    } else if (missionId === 'gems') {
      drawSetupItem({ kind: 'diamond', radius: 65 }, 560, 305, 1.5);
      drawSetupItem({ kind: 'pig', radius: 48, seed: 3, state: 'active', vx: 1 }, 660, 405, 1.15);
    } else {
      drawSetupItem({ kind: 'tnt', radius: 62 }, 560, 330, 1.45);
      drawSetupItem({ kind: 'rock', radius: 56, seed: 18, shape: makeShape(18, 8) }, 690, 400, 1.15);
      drawSetupItem({ kind: 'rock', radius: 34, seed: 9, shape: makeShape(9, 8) }, 455, 405, 1.1);
    }
  } else if (setupStep === 2) {
    const active = players[setupCharacterPlayer];
    drawSetupPlaque(`${active.name} · ${getCharacter(active.characterId).name}`, getCharacter(active.characterId).passive);
    players.forEach((player, index) => {
      ctx.save();
      if (index !== setupCharacterPlayer) ctx.globalAlpha = 0.48;
      drawSetupPlayerAt(player, positions[index], 462, index === setupCharacterPlayer ? 1.85 : 1.45);
      ctx.restore();
    });
    ctx.fillStyle = '#f5d67d'; ctx.font = "800 14px 'Noto Sans SC', sans-serif"; ctx.textAlign = 'center';
    ctx.fillText('点击场景中的矿工也可以换装', 500, 565);
  } else {
    const colors = { easy: '#72a77b', classic: '#d6a13d', hard: '#b95a44' };
    drawSetupPlaque(`${difficulty.name}矿区`, `${getLevelTime(1, difficultyId)} 秒 · 实际首关目标 ${money(goal)} · ${mission.name}`);
    ctx.fillStyle = '#332b27'; ctx.beginPath(); ctx.roundRect(350, 165, 300, 280, 135); ctx.fill();
    ctx.fillStyle = colors[difficultyId]; ctx.beginPath(); ctx.roundRect(372, 186, 256, 259, 120); ctx.fill();
    ctx.fillStyle = '#1e2421'; ctx.beginPath(); ctx.roundRect(400, 215, 200, 230, 95); ctx.fill();
    ctx.fillStyle = '#765036'; ctx.fillRect(338, 432, 324, 22);
    players.forEach((player, index) => drawSetupPlayerAt(player, playerCount === 2 ? 275 + index * 450 : 275, 462, 1.2));
    const itemKind = missionId === 'gems' ? 'diamond' : missionId === 'demolition' ? 'tnt' : 'gold';
    drawSetupItem({ kind: itemKind, radius: 44, seed: 8, shape: makeShape(8, 10) }, 500, 340, 1.25);
  }
}

function draw() {
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  ctx.save();
  if (shake > 0 && !reducedMotion && phase !== 'paused') ctx.translate((Math.random() - 0.5) * 9 * shake / 0.35, (Math.random() - 0.5) * 7 * shake / 0.35);
  if (phase === 'ready') {
    drawSetupScene();
  } else {
    drawBackground();
    drawItems();
    drawMineCart();
    players.forEach((player) => {
      drawRopeAndHook(player);
      drawMiner(player);
    });
    drawEmotes();
    drawEffects();
  }
  ctx.restore();
}

function frame(timestamp) {
  const dt = Math.min(0.035, Math.max(0, (timestamp - lastTimestamp) / 1000));
  lastTimestamp = timestamp;
  if (phase === 'playing') updateGame(dt);
  else if (phase === 'shop' || phase === 'gameOver') updateEffects(dt);
  if (phase !== 'paused') updateVisuals(dt);
  const renderInterval = phase === 'playing' ? 0 : phase === 'paused' ? 200 : 1000 / 30;
  if (timestamp - lastRenderTimestamp >= renderInterval) {
    draw();
    updateUI();
    lastRenderTimestamp = timestamp;
  }
  requestAnimationFrame(frame);
}

$('#startGameButton').addEventListener('click', startPlaying);
$('#setupBackButton').addEventListener('click', () => setSetupStep(setupStep - 1));
$('#setupNextButton').addEventListener('click', () => setSetupStep(setupStep + 1));
$('#dropButton').addEventListener('click', () => dropHook(players[0]));
$('#dynamiteButton').addEventListener('click', () => useDynamite(players[0]));
$('#hourglassButton').addEventListener('click', () => useHourglass(players[0]));
$('#dropButton2').addEventListener('click', () => dropHook(players[1]));
$('#dynamiteButton2').addEventListener('click', () => useDynamite(players[1]));
$('#hourglassButton2').addEventListener('click', () => useHourglass(players[1]));
document.querySelectorAll('[data-emote-player]').forEach((button) => button.addEventListener('click', () => sendEmote(Number(button.dataset.emotePlayer), button.dataset.emote)));
$('#pauseButton').addEventListener('click', () => {
  if (phase === 'playing') pauseGame();
  else if (phase === 'paused') resumeGame();
});
$('#soundButton').addEventListener('click', toggleSound);
$('#helpButton').addEventListener('click', openHelp);
$('#closeHelpButton').addEventListener('click', closeHelp);
$('#gotItButton').addEventListener('click', closeHelp);
$('#reduceMotion').checked = reducedMotion;
$('#reduceMotion').addEventListener('change', (event) => {
  reducedMotion = event.target.checked;
  storeValue('gold-rush-reduced-motion', reducedMotion ? 1 : 0);
});
$('#restartButton').addEventListener('click', () => {
  sound.play('click');
  newGame(false);
});

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const logicalX = (event.clientX - rect.left) / rect.width * WORLD.width;
  const logicalY = (event.clientY - rect.top) / rect.height * WORLD.height;
  if (phase === 'ready') {
    if (setupStep === 2) {
      const positions = playerCount === 2 ? [350, 650] : [500];
      const player = players.find((entry, index) => Math.abs(logicalX - positions[index]) < 115 && logicalY > 170 && logicalY < 490);
      if (player) {
        setupCharacterPlayer = player.id;
        cycleCharacter(player.id);
      }
    }
    return;
  }
  if (playerCount === 2) {
    dropHook(players[logicalX < WORLD.width / 2 ? 0 : 1]);
  } else {
    dropHook(players[0]);
  }
});

helpDialog.addEventListener('close', () => {
  if (phaseBeforeHelp === 'playing' && phase === 'paused') {
    phase = 'playing';
    lastTimestamp = performance.now();
  }
  phaseBeforeHelp = null;
  updateUI();
});

helpDialog.addEventListener('click', (event) => {
  if (event.target !== helpDialog) return;
  const rect = helpDialog.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  if (!inside) closeHelp();
});

window.addEventListener('keydown', (event) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  if (event.target.tagName === 'BUTTON' && (event.code === 'Space' || (event.code === 'Enter' && playerCount === 1))) return;
  if (helpDialog.open) return;
  const gameplayKeys = ['Space', 'KeyS', 'ArrowDown', 'KeyX', 'ArrowUp', 'KeyT', 'Enter', 'Digit1', 'Digit2', 'Digit3', 'Digit7', 'Digit8', 'Digit9'];
  if (event.repeat && gameplayKeys.includes(event.code)) {
    event.preventDefault();
    return;
  }
  if (event.code === 'Space' || event.code === 'KeyS') {
    event.preventDefault();
    dropHook(players[0]);
  } else if (event.code === 'ArrowDown') {
    event.preventDefault();
    dropHook(players[playerCount === 2 ? 1 : 0]);
  } else if (event.code === 'KeyX') {
    event.preventDefault();
    useDynamite(players[0]);
  } else if (event.code === 'ArrowUp') {
    event.preventDefault();
    useDynamite(players[playerCount === 2 ? 1 : 0]);
  } else if (event.code === 'KeyT') {
    event.preventDefault();
    useHourglass(players[0]);
  } else if (event.code === 'Enter' && playerCount === 2) {
    event.preventDefault();
    useHourglass(players[1]);
  } else if (['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
    event.preventDefault();
    sendEmote(0, { Digit1: 'wave', Digit2: 'point', Digit3: 'like' }[event.code]);
  } else if (playerCount === 2 && ['Digit7', 'Digit8', 'Digit9'].includes(event.code)) {
    event.preventDefault();
    sendEmote(1, { Digit7: 'wave', Digit8: 'point', Digit9: 'like' }[event.code]);
  } else if (event.code === 'KeyP' || event.code === 'Escape') {
    event.preventDefault();
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  } else if (event.code === 'KeyM') {
    toggleSound();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && phase === 'playing') pauseGame();
});
window.addEventListener('resize', syncCanvasResolution);

syncCanvasResolution();
setupLevel();
showOverlay('ready');
updateUI();
requestAnimationFrame(frame);
