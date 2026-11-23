export const WORLD = Object.freeze({ width: 1000, height: 620, surfaceY: 154 });
export const HOOK = Object.freeze({ x: 500, y: 144, minLength: 28, maxAngle: 1.34, safeAngle: 1.27 });
export const HOOK_POSITIONS = Object.freeze({
  single: Object.freeze([HOOK]),
  double: Object.freeze([Object.freeze({ ...HOOK, x: 325 }), Object.freeze({ ...HOOK, x: 675 })]),
});

export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ id: 'easy', name: '轻松', icon: '☀️', stars: 1, goalFactor: 0.8, timeFactor: 1.25, swingFactor: 0.88, pullFactor: 1.15, description: '时间充裕 · 重物回收更快' }),
  classic: Object.freeze({ id: 'classic', name: '经典', icon: '⛏️', stars: 2, goalFactor: 1, timeFactor: 1, swingFactor: 1, pullFactor: 1, description: '熟悉节奏 · 原汁原味的挑战' }),
  hard: Object.freeze({ id: 'hard', name: '困难', icon: '🔥', stars: 3, goalFactor: 1.2, timeFactor: 0.85, swingFactor: 1.22, pullFactor: 0.9, description: '障碍更多 · 目标高、时间紧' }),
});

export const ITEM_DEFS = Object.freeze({
  goldSmall: { kind: 'gold', value: 50, radius: 20, pullSpeed: 350 },
  goldMedium: { kind: 'gold', value: 100, radius: 31, pullSpeed: 270 },
  goldLarge: { kind: 'gold', value: 250, radius: 45, pullSpeed: 175 },
  goldHuge: { kind: 'gold', value: 500, radius: 57, pullSpeed: 125 },
  diamond: { kind: 'diamond', value: 600, radius: 20, pullSpeed: 440 },
  rockSmall: { kind: 'rock', value: 20, radius: 27, pullSpeed: 155 },
  rockLarge: { kind: 'rock', value: 20, radius: 38, pullSpeed: 105 },
  bag: { kind: 'bag', value: 0, radius: 25, pullSpeed: 280 },
  bone: { kind: 'bone', value: 15, radius: 24, pullSpeed: 185 },
  tnt: { kind: 'tnt', value: 0, radius: 26, pullSpeed: 220 },
  pig: { kind: 'pig', value: 700, radius: 29, pullSpeed: 335 },
});

export const SHOP_CATALOG = Object.freeze([
  Object.freeze({ id: 'dynamite', icon: '🧨', name: '高爆炸药', price: 110, description: '回收途中炸掉不想要的矿物，库存上限 5。' }),
  Object.freeze({ id: 'hourglass', icon: '⏳', name: '时光沙漏', price: 100, description: '关卡中按 T 使用，立即增加 12 秒，库存上限 3。' }),
  Object.freeze({ id: 'strength', icon: '🥤', name: '大力饮料', price: 180, buff: 'strength', description: '下一关所有重物的回收速度提高 55%。' }),
  Object.freeze({ id: 'clover', icon: '🍀', name: '幸运四叶草', price: 160, buff: 'clover', description: '下一关福袋更容易开出高额金币。' }),
  Object.freeze({ id: 'diamond', icon: '💎', name: '钻石鉴定书', price: 220, buff: 'diamond', description: '下一关钻石价值提高 50%，每颗价值 $900。' }),
  Object.freeze({ id: 'rock', icon: '📕', name: '岩石收购书', price: 140, buff: 'rock', description: '下一关岩石收购价从 $20 提高到 $100。' }),
]);

export function getDifficulty(id = 'classic') {
  return DIFFICULTIES[id] || DIFFICULTIES.classic;
}

export function getLevelGoal(level, difficulty = 'classic') {
  const base = 650 + (Math.max(1, level) - 1) * 850;
  return Math.round((base * getDifficulty(difficulty).goalFactor) / 50) * 50;
}

export function getLevelTime(level, difficulty = 'classic') {
  const base = Math.max(45, 60 - (Math.max(1, level) - 1) * 2);
  return Math.round(base * getDifficulty(difficulty).timeFactor);
}

export function createRandom(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function isPositionReachable(x, y, radius = 0, origins = HOOK_POSITIONS.single) {
  if (x - radius < 38 || x + radius > WORLD.width - 38) return false;
  if (y - radius < WORLD.surfaceY + 5 || y + radius > WORLD.height - 10) return false;
  return origins.some((origin) => {
    if (y <= origin.y) return false;
    const angle = Math.abs(Math.atan2(x - origin.x, y - origin.y));
    return angle <= HOOK.safeAngle && Math.hypot(x - origin.x, y - origin.y) < 1200;
  });
}

export function shouldFinishEarly(items, score, goal) {
  const active = items.filter((item) => item.state === 'active');
  const canStillEarn = active.some((item) => item.kind !== 'tnt');
  if (!canStillEarn) return true;
  const valuablesRemain = active.some((item) => ['gold', 'diamond', 'bag', 'pig'].includes(item.kind));
  return score >= goal && !valuablesRemain;
}

export function getBagReward(random = Math.random, lucky = false) {
  const roll = random();
  const dynamiteChance = lucky ? 0.08 : 0.14;
  const timeChance = lucky ? 0.18 : 0.25;
  if (roll < dynamiteChance) return { kind: 'dynamite', amount: 1, label: '炸药 +1' };
  if (roll < timeChance) return { kind: 'time', amount: lucky ? 12 : 8, label: `时间 +${lucky ? 12 : 8}秒` };
  const values = lucky ? [175, 250, 400, 500, 700] : [75, 125, 175, 250, 400];
  const value = values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  return { kind: 'money', amount: value, label: `${lucky ? '幸运福袋' : '福袋'} +$${value}` };
}

export function createLevel(level = 1, difficulty = 'classic', playerCount = 1, missionId = 'gold') {
  const origins = playerCount === 2 ? HOOK_POSITIONS.double : HOOK_POSITIONS.single;
  const difficultyIndex = ['easy', 'classic', 'hard'].indexOf(getDifficulty(difficulty).id);
  const random = createRandom(1896 + level * 997 + difficultyIndex * 7919);
  let id = 0;
  const items = [];
  const add = (type, x, y) => {
    const definition = ITEM_DEFS[type];
    if (!definition) throw new Error(`Unknown item type: ${type}`);
    const item = {
      id: `${level}-${id++}`,
      type,
      ...definition,
      x,
      y,
      rotation: type === 'pig' ? 0 : (random() - 0.5) * 0.65,
      seed: Math.floor(random() * 100000),
      state: 'active',
    };
    items.push(item);
    return item;
  };

  if (level === 1) {
    add('goldLarge', 218, 394);
    add('goldMedium', 742, 300);
    add('goldSmall', 520, 267);
    add('goldSmall', 855, 490);
    add('goldMedium', 410, 500);
    add('goldHuge', 665, 514);
    add('diamond', 825, 285);
    add('bag', 350, 236);
    add('rockSmall', 123, 274);
    if (difficulty !== 'easy') add('rockLarge', 584, 384);
    add('rockSmall', 920, 354);
    add('goldSmall', 104, 518);
    add('goldMedium', 314, 314);
    if (difficulty === 'hard') {
      add('bone', 790, 410);
      add('rockSmall', 455, 345);
    }
    if (missionId === 'gems') add('diamond', 455, 410);
    if (missionId === 'demolition') add('tnt', 445, 420);
    return items;
  }

  const placed = [];
  const hasClearance = (candidate, other, gap) => {
    const candidateMin = candidate.minX ?? candidate.x;
    const candidateMax = candidate.maxX ?? candidate.x;
    const otherMin = other.minX ?? other.x;
    const otherMax = other.maxX ?? other.x;
    const horizontalGap = Math.max(candidateMin - otherMax, otherMin - candidateMax, 0);
    return Math.hypot(horizontalGap, candidate.y - other.y) > candidate.radius + other.radius + gap;
  };
  const place = (type) => {
    const { radius } = ITEM_DEFS[type];
    const minX = radius + 42;
    const maxX = WORLD.width - radius - 42;
    const minY = WORLD.surfaceY + radius + 57;
    const maxY = WORLD.height - radius - 21;
    const commit = (x, y, gap) => {
      x = Math.round(x);
      y = Math.round(y);
      if (!isPositionReachable(x, y, radius, origins)) return null;
      const corridor = { x, y, radius, minX: type === 'pig' ? x - 85 : x, maxX: type === 'pig' ? x + 85 : x };
      if (type === 'pig' && (!isPositionReachable(corridor.minX, y, radius, origins) || !isPositionReachable(corridor.maxX, y, radius, origins))) return null;
      if (!placed.every((item) => hasClearance(corridor, item, gap))) return null;
      const item = add(type, x, y);
      if (type === 'pig') {
        item.minX = corridor.minX;
        item.maxX = corridor.maxX;
        item.vx = (random() > 0.5 ? 1 : -1) * (48 + random() * 24);
      }
      placed.push(corridor);
      return item;
    };

    for (let attempt = 0; attempt < 260; attempt += 1) {
      const item = commit(minX + random() * (maxX - minX), minY + random() * (maxY - minY), 24);
      if (item) return item;
    }
    // Dense late levels use deterministic fallback grids with gradually smaller,
    // still visible gaps instead of silently dropping planned content.
    for (const gap of [14, 7, 1]) {
      const step = gap >= 14 ? 16 : 10;
      for (let y = minY; y <= maxY; y += step) {
        for (let x = minX; x <= maxX; x += step) {
          const item = commit(x, y, gap);
          if (item) return item;
        }
      }
    }
    throw new Error(`Unable to place ${type} on level ${level} (${difficulty})`);
  };

  const types = [
    'goldHuge', 'goldLarge', 'goldLarge', 'goldLarge',
    'goldMedium', 'goldMedium', 'goldMedium', 'goldMedium', 'goldMedium',
    'goldSmall', 'goldSmall', 'goldSmall', 'goldSmall', 'goldSmall', 'goldSmall',
    'diamond', 'bag', 'bag', 'rockLarge', 'rockLarge', 'rockSmall', 'rockSmall',
  ];
  if (level >= 2) types.push('pig');
  if (level >= 3) types.push('diamond', 'goldHuge', 'bone', 'bone');
  if (level >= 3 && difficulty !== 'easy') types.push('tnt');
  if (level >= 4) types.push('pig', 'bag', 'tnt');
  if (level >= 5) types.push('diamond', 'bag');
  if (difficulty === 'hard') types.push('rockLarge');
  if (missionId === 'gems') types.push('diamond');
  if (missionId === 'demolition') types.push('tnt');
  if (difficulty === 'easy') {
    let removed = 0;
    for (let index = types.length - 1; index >= 0 && removed < 2; index -= 1) {
      if (types[index].startsWith('rock')) {
        types.splice(index, 1);
        removed += 1;
      }
    }
  }
  const placementPriority = { pig: 0, goldHuge: 1, diamond: 2, tnt: 3, bag: 4, bone: 5, goldLarge: 6, goldMedium: 7, goldSmall: 8, rockLarge: 9, rockSmall: 10 };
  types.sort((a, b) => placementPriority[a] - placementPriority[b]);
  types.forEach(place);
  return items;
}

export function getShopStock(random = Math.random) {
  const catalog = [...SHOP_CATALOG];
  for (let index = catalog.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [catalog[index], catalog[target]] = [catalog[target], catalog[index]];
  }
  return catalog.slice(0, 3).map((item) => ({ id: item.id, price: item.price, sold: false }));
}

export function purchaseShopOffer(offer, state) {
  if (!offer || offer.sold || !SHOP_CATALOG.some((item) => item.id === offer.id)) return { ok: false, reason: 'sold' };
  if (state.coins < offer.price) return { ok: false, reason: 'coins' };
  if (offer.id === 'dynamite' && state.dynamites >= 5) return { ok: false, reason: 'limit' };
  if (offer.id === 'hourglass' && state.hourglasses >= 3) return { ok: false, reason: 'limit' };
  const definition = SHOP_CATALOG.find((item) => item.id === offer.id);
  if (definition.buff && state.pendingBuffs[definition.buff]) return { ok: false, reason: 'limit' };

  const nextState = {
    ...state,
    coins: state.coins - offer.price,
    pendingBuffs: { ...state.pendingBuffs },
  };
  if (offer.id === 'dynamite') nextState.dynamites += 1;
  else if (offer.id === 'hourglass') nextState.hourglasses += 1;
  else nextState.pendingBuffs[definition.buff] = true;
  return { ok: true, state: nextState, offer: { ...offer, sold: true } };
}
