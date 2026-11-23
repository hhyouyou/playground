import {
  DIFFICULTIES,
  HOOK,
  HOOK_POSITIONS,
  ITEM_DEFS,
  SHOP_CATALOG,
  createLevel,
  getDifficulty,
  getLevelGoal,
  getLevelTime,
  isPositionReachable,
} from './game-core.js';
import {
  CHARACTERS,
  MISSIONS,
  getCharacter,
  getInitialDynamites,
  getMission,
  getPullMultiplier,
  getSwingMultiplier,
} from './character-core.js';

export const DESIGN_SCHEMA = 'gold-rush-numerical-lab';
export const DESIGN_VERSION = 1;
export const DESIGN_STORAGE_KEY = 'gold-rush-numerical-lab-v1';
export const SIMULATION = Object.freeze({
  extendSpeed: 560,
  emptyRetractSpeed: 680,
  baseSwingSpeed: 1.25,
  hourglassSeconds: 12,
  maxLevel: 60,
});

const BUFF_KEYS = ['strength', 'clover', 'diamond', 'rock'];
const ITEM_NAMES = Object.freeze({
  goldSmall: '小黄金', goldMedium: '中黄金', goldLarge: '大黄金', goldHuge: '巨型黄金',
  diamond: '钻石', rockSmall: '小岩石', rockLarge: '大岩石', bag: '神秘福袋',
  bone: '古老骨骸', tnt: 'TNT 炸药桶', pig: '钻石金猪',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const DEFAULT_DESIGN_CONFIG = deepFreeze({
  level: 1,
  curveLevels: 12,
  playerCount: 1,
  difficultyId: 'classic',
  missionId: 'gold',
  characterIds: ['joe', 'lily'],
  hourglasses: [0, 0],
  buffs: [
    { strength: false, clover: false, diamond: false, rock: false },
    { strength: false, clover: false, diamond: false, rock: false },
  ],
  tuning: { goalFactor: 1, timeFactor: 1, pullFactor: 1, aimSeconds: 0.55 },
});

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function validKey(collection, value, fallback) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(collection, value) ? value : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function normalizeDesignConfig(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const tuning = source.tuning && typeof source.tuning === 'object' ? source.tuning : {};
  const characters = Array.isArray(source.characterIds) ? source.characterIds : [];
  const hourglasses = Array.isArray(source.hourglasses) ? source.hourglasses : [];
  const buffs = Array.isArray(source.buffs) ? source.buffs : [];
  return {
    level: Math.round(clamp(source.level, 1, SIMULATION.maxLevel, DEFAULT_DESIGN_CONFIG.level)),
    curveLevels: Math.round(clamp(source.curveLevels, 6, 20, DEFAULT_DESIGN_CONFIG.curveLevels)),
    playerCount: Number(source.playerCount) === 2 ? 2 : 1,
    difficultyId: validKey(DIFFICULTIES, source.difficultyId, 'classic'),
    missionId: validKey(MISSIONS, source.missionId, 'gold'),
    characterIds: [0, 1].map((index) => validKey(CHARACTERS, characters[index], DEFAULT_DESIGN_CONFIG.characterIds[index])),
    hourglasses: [0, 1].map((index) => Math.round(clamp(hourglasses[index], 0, 3, 0))),
    buffs: [0, 1].map((playerIndex) => Object.fromEntries(BUFF_KEYS.map((key) => [key, buffs[playerIndex]?.[key] === true]))),
    tuning: {
      goalFactor: round(clamp(tuning.goalFactor, 0.5, 1.5, 1)),
      timeFactor: round(clamp(tuning.timeFactor, 0.5, 1.5, 1)),
      pullFactor: round(clamp(tuning.pullFactor, 0.5, 1.5, 1)),
      aimSeconds: round(clamp(tuning.aimSeconds, 0, 2, DEFAULT_DESIGN_CONFIG.tuning.aimSeconds)),
    },
  };
}

export function getDesignGoal(level, config = DEFAULT_DESIGN_CONFIG) {
  const normalized = normalizeDesignConfig(config);
  const mission = getMission(normalized.missionId);
  const base = getLevelGoal(level, normalized.difficultyId);
  return Math.round((base * mission.goalFactor * normalized.tuning.goalFactor) / 50) * 50;
}

export function getDesignTime(level, config = DEFAULT_DESIGN_CONFIG) {
  const normalized = normalizeDesignConfig(config);
  return Math.max(1, Math.round(getLevelTime(level, normalized.difficultyId) * normalized.tuning.timeFactor));
}

export function getBagProfile(lucky = false) {
  const dynamiteChance = lucky ? 0.08 : 0.14;
  const timeThreshold = lucky ? 0.18 : 0.25;
  const values = lucky ? [175, 250, 400, 500, 700] : [75, 125, 175, 250, 400];
  const averageCash = values.reduce((sum, value) => sum + value, 0) / values.length;
  const moneyChance = 1 - timeThreshold;
  const timeChance = timeThreshold - dynamiteChance;
  return {
    lucky,
    dynamiteChance,
    timeChance: round(timeChance),
    moneyChance: round(moneyChance),
    expectedCash: round(averageCash * moneyChance),
    maximumCash: Math.max(...values),
    minimumCash: 0,
    expectedTime: round((lucky ? 12 : 8) * timeChance),
  };
}

export function getItemName(itemOrType) {
  const type = typeof itemOrType === 'string' ? itemOrType : itemOrType?.type;
  return ITEM_NAMES[type] || type || '未知矿物';
}

export function getItemEconomy(item, config = DEFAULT_DESIGN_CONFIG, playerIndex = 0) {
  const normalized = normalizeDesignConfig(config);
  const mission = getMission(normalized.missionId);
  const activeBuffs = normalized.buffs[playerIndex] || normalized.buffs[0];
  let value = item.value;
  const steps = [{ label: '基础价值', formula: `$${item.value}`, value }];
  if (item.kind === 'diamond' || item.kind === 'pig') {
    value = Math.round(value * mission.gemFactor);
    steps.push({ label: '任务宝石系数', formula: `× ${mission.gemFactor}`, value });
  }
  if (item.kind === 'rock') {
    value += mission.rockBonus;
    steps.push({ label: '任务岩石加价', formula: `+ $${mission.rockBonus}`, value });
  }
  if (item.kind === 'diamond' && activeBuffs.diamond) {
    value = Math.round(value * 1.5);
    steps.push({ label: '钻石鉴定书', formula: '× 1.5', value });
  }
  if (item.kind === 'rock' && activeBuffs.rock) {
    value = 100 + mission.rockBonus;
    steps.push({ label: '岩石收购书', formula: `改为 $100 + 任务 $${mission.rockBonus}`, value });
  }
  const bag = item.kind === 'bag' ? getBagProfile(activeBuffs.clover) : null;
  return {
    fixedValue: value,
    expectedValue: bag ? bag.expectedCash : value,
    maximumValue: bag ? bag.maximumCash : value,
    minimumValue: bag ? bag.minimumCash : value,
    expectedTimeBonus: bag ? bag.expectedTime : 0,
    bag,
    valueSteps: steps,
  };
}

export function getRetrievalStats(item, config = DEFAULT_DESIGN_CONFIG, playerIndex = 0) {
  const normalized = normalizeDesignConfig(config);
  const difficulty = getDifficulty(normalized.difficultyId);
  const origins = normalized.playerCount === 2 ? HOOK_POSITIONS.double : HOOK_POSITIONS.single;
  const origin = origins[playerIndex] || origins[0];
  const activeBuffs = normalized.buffs[playerIndex] || normalized.buffs[0];
  const characterId = normalized.characterIds[playerIndex] || normalized.characterIds[0];
  const economy = getItemEconomy(item, normalized, playerIndex);
  const centerDistance = Math.hypot(item.x - origin.x, item.y - origin.y);
  const travelDistance = Math.max(0, centerDistance - HOOK.minLength);
  const requiredAngle = Math.abs(Math.atan2(item.x - origin.x, item.y - origin.y));
  const reachable = isPositionReachable(item.x, item.y, item.radius, [origin]);
  const isTnt = item.kind === 'tnt';
  const characterPull = isTnt ? 1 : getPullMultiplier(characterId, item);
  const strengthFactor = !isTnt && activeBuffs.strength ? 1.55 : 1;
  const difficultyPull = isTnt ? 1 : difficulty.pullFactor;
  const basePullSpeed = isTnt ? SIMULATION.emptyRetractSpeed : item.pullSpeed;
  const pullSpeed = basePullSpeed * difficultyPull * strengthFactor * characterPull * normalized.tuning.pullFactor;
  const swingSpeed = SIMULATION.baseSwingSpeed * difficulty.swingFactor * getSwingMultiplier(characterId);
  const aimTime = normalized.tuning.aimSeconds * (SIMULATION.baseSwingSpeed / swingSpeed);
  const extensionTime = travelDistance / SIMULATION.extendSpeed;
  const retractionTime = travelDistance / pullSpeed;
  const totalTime = aimTime + extensionTime + retractionTime;
  return {
    itemId: item.id,
    type: item.type,
    kind: item.kind,
    name: getItemName(item),
    x: item.x,
    y: item.y,
    playerIndex,
    characterId,
    origin,
    reachable,
    requiredAngle: round(requiredAngle, 4),
    centerDistance: round(centerDistance),
    travelDistance: round(travelDistance),
    aimTime: round(aimTime, 3),
    extensionTime: round(extensionTime, 3),
    retractionTime: round(retractionTime, 3),
    totalTime: round(totalTime, 3),
    pullSpeed: round(pullSpeed),
    swingSpeed: round(swingSpeed, 3),
    characterPull,
    strengthFactor,
    difficultyPull,
    labPull: normalized.tuning.pullFactor,
    expectedValue: economy.expectedValue,
    maximumValue: economy.maximumValue,
    minimumValue: economy.minimumValue,
    expectedTimeBonus: economy.expectedTimeBonus,
    incomePerMinute: totalTime > 0 ? round((economy.expectedValue / totalTime) * 60) : 0,
    economy,
    pullSteps: [
      { label: isTnt ? 'TNT 引爆后空钩' : '矿物基础速度', formula: `${basePullSpeed}`, value: basePullSpeed },
      { label: isTnt ? '难度不影响空钩' : '难度回收系数', formula: `× ${difficultyPull}`, value: round(basePullSpeed * difficultyPull) },
      { label: isTnt ? '饮料不影响空钩' : '大力饮料', formula: `× ${strengthFactor}`, value: round(basePullSpeed * difficultyPull * strengthFactor) },
      { label: isTnt ? '角色不改变空钩' : getCharacter(characterId).name, formula: `× ${characterPull}`, value: round(basePullSpeed * difficultyPull * strengthFactor * characterPull) },
      { label: '实验室回收系数', formula: `× ${normalized.tuning.pullFactor}`, value: round(pullSpeed) },
    ],
  };
}

export function getLevelResources(level, config = DEFAULT_DESIGN_CONFIG) {
  const normalized = normalizeDesignConfig(config);
  const items = createLevel(level, normalized.difficultyId, normalized.playerCount, normalized.missionId);
  const activePlayers = Array.from({ length: normalized.playerCount }, (_, index) => index);
  const origins = normalized.playerCount === 2 ? HOOK_POSITIONS.double : HOOK_POSITIONS.single;
  const economies = items.map((item) => {
    const reachablePlayers = activePlayers.filter((playerIndex) => isPositionReachable(item.x, item.y, item.radius, [origins[playerIndex]]));
    const choices = reachablePlayers.map((playerIndex) => getItemEconomy(item, normalized, playerIndex));
    return {
      expectedValue: choices.length ? Math.max(...choices.map((choice) => choice.expectedValue)) : 0,
      maximumValue: choices.length ? Math.max(...choices.map((choice) => choice.maximumValue)) : 0,
      minimumValue: choices.length ? Math.min(...choices.map((choice) => choice.minimumValue)) : 0,
    };
  });
  const valuables = items.filter((item) => !['rock', 'bone', 'tnt'].includes(item.kind));
  const obstacles = items.filter((item) => ['rock', 'bone', 'tnt'].includes(item.kind));
  return {
    items,
    itemCount: items.length,
    valuableCount: valuables.length,
    obstacleCount: obstacles.length,
    obstacleRatio: items.length ? round(obstacles.length / items.length, 3) : 0,
    tntCount: items.filter((item) => item.kind === 'tnt').length,
    bagCount: items.filter((item) => item.kind === 'bag').length,
    guaranteedValue: items.reduce((sum, item, index) => sum + (item.kind === 'bag' ? 0 : economies[index].expectedValue), 0),
    expectedValue: round(economies.reduce((sum, economy) => sum + economy.expectedValue, 0)),
    maximumValue: economies.reduce((sum, economy) => sum + economy.maximumValue, 0),
  };
}

export function getLevelCurve(config = DEFAULT_DESIGN_CONFIG) {
  const normalized = normalizeDesignConfig(config);
  let previousGoal = 0;
  return Array.from({ length: normalized.curveLevels }, (_, index) => {
    const level = index + 1;
    const goal = getDesignGoal(level, normalized);
    const requiredIncome = Math.max(0, goal - previousGoal);
    const resources = getLevelResources(level, normalized);
    previousGoal = goal;
    return {
      level,
      goal,
      requiredIncome,
      time: getDesignTime(level, normalized),
      itemCount: resources.itemCount,
      obstacleRatio: resources.obstacleRatio,
      expectedValue: resources.expectedValue,
      maximumValue: resources.maximumValue,
      guaranteedValue: resources.guaranteedValue,
      theoreticalPossible: resources.maximumValue >= requiredIncome,
    };
  });
}

function getTntRisk(items, config) {
  const valuableAtRisk = new Map();
  const origins = config.playerCount === 2 ? HOOK_POSITIONS.double : HOOK_POSITIONS.single;
  for (const barrel of items.filter((item) => item.kind === 'tnt')) {
    for (const item of items) {
      if (item === barrel || item.kind === 'tnt') continue;
      if (Math.hypot(item.x - barrel.x, item.y - barrel.y) >= 120 + item.radius * 0.35) continue;
      const values = Array.from({ length: config.playerCount }, (_, playerIndex) => playerIndex)
        .filter((playerIndex) => isPositionReachable(item.x, item.y, item.radius, [origins[playerIndex]]))
        .map((playerIndex) => getItemEconomy(item, config, playerIndex).maximumValue);
      const maximumValue = values.length ? Math.max(...values) : 0;
      valuableAtRisk.set(item.id, { item, value: maximumValue });
    }
  }
  return {
    count: valuableAtRisk.size,
    maximumValue: [...valuableAtRisk.values()].reduce((sum, entry) => sum + entry.value, 0),
    itemIds: [...valuableAtRisk.keys()],
  };
}

function createWarnings({ config, requiredIncome, resources, expectedEarned, expectedScore, goal, route, players, tntRisk }) {
  const warnings = [];
  if (resources.maximumValue < requiredIncome) {
    warnings.push({ id: 'impossible', severity: 'danger', title: '理论上无法完成', detail: `即使福袋均开出最高金币，本关新增上限仍比目标差额少 $${requiredIncome - resources.maximumValue}。` });
  }
  if (requiredIncome > 0 && resources.maximumValue > requiredIncome * 5 && resources.expectedValue > requiredIncome * 3) {
    warnings.push({ id: 'resource-excess', severity: 'info', title: '资源投放偏宽松', detail: `理论新增上限是目标差额的 ${round(resources.maximumValue / requiredIncome, 1)} 倍，可检查后期资源是否过量。` });
  }
  if (expectedScore < goal && resources.maximumValue >= requiredIncome) {
    warnings.push({ id: 'time-shortfall', severity: 'warning', title: '当前路线预计无法达标', detail: `资源总量足够，但效率优先路线预计还差 $${goal - expectedScore}；可调整回收、时间或瞄准参数。` });
  }
  if (config.difficultyId === 'hard' && expectedEarned < requiredIncome * 1.15) {
    warnings.push({ id: 'hard-margin', severity: 'warning', title: '困难难度收益余量不足', detail: '预计收入低于目标差额的 115%，一次失误或低额福袋都可能导致失败。' });
  }
  if (tntRisk.count > 0) {
    warnings.push({ id: 'tnt-risk', severity: 'warning', title: 'TNT 波及高价值资源', detail: `${tntRisk.count} 件矿物位于爆炸范围，涉及理论价值 $${tntRisk.maximumValue}；路线已避开 TNT，实战仍需注意误触。` });
  }
  if (route.length === 0 && requiredIncome > 0) {
    warnings.push({ id: 'no-route', severity: 'danger', title: '时间内没有完整回收路线', detail: '当前参数下没有一件非 TNT 矿物能完成完整出钩与回收。' });
  }
  if (config.playerCount === 2 && players[1].expectedEarned < players[0].expectedEarned * 0.25 && expectedEarned > 0) {
    warnings.push({ id: 'team-imbalance', severity: 'info', title: '双人分工不均', detail: 'P2 预计收入不足 P1 的 25%，可调整双方角色、增益或出生侧资源。' });
  }
  return warnings;
}

function applyEarlySettlement(fullRoute, candidates, startingScore, goal) {
  const valuableKinds = ['gold', 'diamond', 'bag', 'pig'];
  const scheduledIds = new Set(fullRoute.map((step) => step.itemId));
  const unscheduledValuables = candidates.filter((candidate) => valuableKinds.includes(candidate.item.kind) && !scheduledIds.has(candidate.item.id)).length;
  const unscheduledEarnables = candidates.length - fullRoute.length;
  if (startingScore >= goal && !candidates.some((candidate) => valuableKinds.includes(candidate.item.kind))) {
    return { route: [], triggered: true, time: 0, reason: 'goal' };
  }
  const events = [...fullRoute].sort((a, b) => a.end - b.end);
  let score = startingScore;
  let index = 0;
  while (index < events.length) {
    const time = events[index].end;
    while (index < events.length && Math.abs(events[index].end - time) < 0.0001) {
      score += events[index].expectedValue;
      index += 1;
    }
    const valuablesRemain = unscheduledValuables > 0 || fullRoute.some((step) => valuableKinds.includes(step.kind) && step.end > time + 0.0001);
    const earnablesRemain = unscheduledEarnables > 0 || fullRoute.some((step) => step.end > time + 0.0001);
    const anyHookBusy = fullRoute.some((step) => step.start < time - 0.0001 && step.end > time + 0.0001);
    if (!anyHookBusy && ((!valuablesRemain && score >= goal) || !earnablesRemain)) {
      return {
        route: fullRoute.filter((step) => step.end <= time + 0.0001),
        triggered: true,
        time: round(time, 3),
        reason: !earnablesRemain && score < goal ? 'depleted' : 'goal',
      };
    }
  }
  return { route: fullRoute, triggered: false, time: null, reason: null };
}

export function analyzeLevel(config = DEFAULT_DESIGN_CONFIG, targetLevel = config.level, startingScore) {
  const normalized = normalizeDesignConfig({ ...config, level: targetLevel });
  const level = normalized.level;
  const resources = getLevelResources(level, normalized);
  const goal = getDesignGoal(level, normalized);
  const assumedStartingScore = startingScore === undefined
    ? (level === 1 ? 0 : getDesignGoal(level - 1, normalized))
    : Math.max(0, Number(startingScore) || 0);
  const requiredIncome = Math.max(0, goal - assumedStartingScore);
  const baseTime = getDesignTime(level, normalized);
  const ownedTimeBonus = normalized.hourglasses.slice(0, normalized.playerCount).reduce((sum, count) => sum + count * SIMULATION.hourglassSeconds, 0);
  let deadline = baseTime + ownedTimeBonus;
  const availableAt = [0, 0];
  const scheduled = new Map();
  let route = [];
  const candidates = resources.items.filter((item) => item.kind !== 'tnt').map((item) => {
    const choices = Array.from({ length: normalized.playerCount }, (_, playerIndex) => getRetrievalStats(item, normalized, playerIndex)).filter((choice) => choice.reachable);
    return { item, choices, priority: Math.max(...choices.map((choice) => choice.incomePerMinute)) };
  }).filter((candidate) => candidate.choices.length > 0).sort((a, b) => b.priority - a.priority || a.item.id.localeCompare(b.item.id, undefined, { numeric: true }));

  for (const candidate of candidates) {
    const choices = candidate.choices.map((choice) => ({ choice, finish: availableAt[choice.playerIndex] + choice.totalTime }));
    choices.sort((a, b) => a.finish - b.finish || b.choice.incomePerMinute - a.choice.incomePerMinute);
    const selected = choices[0];
    if (selected.finish > deadline) continue;
    const playerIndex = selected.choice.playerIndex;
    const start = availableAt[playerIndex];
    availableAt[playerIndex] = selected.finish;
    if (selected.choice.expectedTimeBonus) deadline += selected.choice.expectedTimeBonus;
    const entry = {
      ...selected.choice,
      start: round(start, 3),
      end: round(selected.finish, 3),
      deadlineAfter: round(deadline, 3),
      playerRank: route.filter((step) => step.playerIndex === playerIndex).length + 1,
    };
    scheduled.set(candidate.item.id, entry);
    route.push(entry);
  }
  route.sort((a, b) => a.start - b.start || a.playerIndex - b.playerIndex || a.end - b.end);
  const earlySettlement = applyEarlySettlement(route, candidates, assumedStartingScore, goal);
  route = earlySettlement.route;
  const retainedIds = new Set(route.map((step) => step.itemId));
  for (const itemId of scheduled.keys()) {
    if (!retainedIds.has(itemId)) scheduled.delete(itemId);
  }
  const expectedEarned = round(route.reduce((sum, step) => sum + step.expectedValue, 0));
  const maximumScheduledValue = route.reduce((sum, step) => sum + step.maximumValue, 0);
  const expectedScore = round(assumedStartingScore + expectedEarned);
  const players = Array.from({ length: normalized.playerCount }, (_, playerIndex) => {
    const steps = route.filter((step) => step.playerIndex === playerIndex);
    return {
      playerIndex,
      characterId: normalized.characterIds[playerIndex],
      expectedEarned: round(steps.reduce((sum, step) => sum + step.expectedValue, 0)),
      maximumEarned: steps.reduce((sum, step) => sum + step.maximumValue, 0),
      coins: round(steps.reduce((sum, step) => sum + step.expectedValue, 0)),
      itemCount: steps.length,
      busyTime: round(steps.reduce((sum, step) => sum + step.totalTime, 0)),
      lastFinish: steps.length ? Math.max(...steps.map((step) => step.end)) : 0,
      hourglasses: normalized.hourglasses[playerIndex],
      buffs: { ...normalized.buffs[playerIndex] },
    };
  });
  const tntRisk = getTntRisk(resources.items, normalized);
  const unscheduled = candidates.filter((candidate) => !scheduled.has(candidate.item.id)).map((candidate) => ({
    item: candidate.item,
    best: [...candidate.choices].sort((a, b) => b.incomePerMinute - a.incomePerMinute)[0],
  }));
  const result = {
    level,
    config: normalized,
    goal,
    startingScore: assumedStartingScore,
    requiredIncome,
    baseTime,
    ownedTimeBonus,
    expectedBagTimeBonus: round(deadline - baseTime - ownedTimeBonus),
    totalTime: round(deadline),
    resources,
    route,
    unscheduled,
    players,
    expectedEarned,
    maximumScheduledValue,
    expectedScore,
    maximumPossibleScore: assumedStartingScore + resources.maximumValue,
    expectedGoalMet: expectedScore >= goal,
    theoreticalPossible: resources.maximumValue >= requiredIncome,
    expectedIncomePerMinute: round((expectedEarned / Math.max(1, deadline)) * 60),
    resourceRatio: requiredIncome > 0 ? round(resources.expectedValue / requiredIncome, 2) : null,
    earlySettlement: { triggered: earlySettlement.triggered, time: earlySettlement.time, reason: earlySettlement.reason },
    tntRisk,
  };
  result.warnings = createWarnings({ config: normalized, requiredIncome, resources, expectedEarned, expectedScore, goal, route, players, tntRisk });
  return result;
}

export function comparePlayerCounts(config = DEFAULT_DESIGN_CONFIG) {
  const normalized = normalizeDesignConfig(config);
  return [1, 2].map((playerCount) => analyzeLevel({ ...normalized, playerCount }, normalized.level));
}

export function compareMissions(config = DEFAULT_DESIGN_CONFIG) {
  const normalized = normalizeDesignConfig(config);
  return Object.keys(MISSIONS).map((missionId) => {
    const analysis = analyzeLevel({ ...normalized, missionId }, normalized.level);
    return {
      missionId,
      goal: analysis.goal,
      requiredIncome: analysis.requiredIncome,
      expectedEarned: analysis.expectedEarned,
      expectedGoalMet: analysis.expectedGoalMet,
      expectedValue: analysis.resources.expectedValue,
      maximumValue: analysis.resources.maximumValue,
      itemCount: analysis.resources.itemCount,
      obstacleRatio: analysis.resources.obstacleRatio,
      tntCount: analysis.resources.tntCount,
    };
  });
}

export function compareCharacters(config = DEFAULT_DESIGN_CONFIG, item) {
  const normalized = normalizeDesignConfig(config);
  const resources = getLevelResources(normalized.level, normalized);
  const target = item || resources.items.find((entry) => entry.type === 'goldHuge') || resources.items.find((entry) => entry.kind !== 'tnt');
  if (!target) return [];
  const originPlayerIndex = normalized.playerCount === 2 && !getRetrievalStats(target, normalized, 0).reachable ? 1 : 0;
  return Object.keys(CHARACTERS).map((characterId) => {
    const characterIds = [...normalized.characterIds];
    characterIds[originPlayerIndex] = characterId;
    const characterConfig = normalizeDesignConfig({ ...normalized, characterIds });
    const stats = getRetrievalStats(target, characterConfig, originPlayerIndex);
    return {
      ...stats,
      originPlayerIndex,
      characterId,
      name: getCharacter(characterId).name,
      color: getCharacter(characterId).color,
      passive: getCharacter(characterId).passive,
      initialDynamites: getInitialDynamites(characterId),
    };
  });
}

export function getShopInsights(config = DEFAULT_DESIGN_CONFIG, analysis = analyzeLevel(config)) {
  const normalized = normalizeDesignConfig(config);
  const items = analysis.resources.items;
  const heaviest = [...items].filter((item) => item.kind !== 'tnt').sort((a, b) => a.pullSpeed - b.pullSpeed)[0] || { ...ITEM_DEFS.goldHuge, type: 'goldHuge', x: 500, y: 500 };
  const withP1Buff = (key, enabled) => normalizeDesignConfig({ ...normalized, buffs: normalized.buffs.map((buffs, index) => index === 0 ? { ...buffs, [key]: enabled } : buffs) });
  const baseHeavy = getRetrievalStats(heaviest, withP1Buff('strength', false), 0);
  const strongHeavy = getRetrievalStats(heaviest, withP1Buff('strength', true), 0);
  const diamond = items.find((item) => item.kind === 'diamond') || { ...ITEM_DEFS.diamond, type: 'diamond', x: 500, y: 400 };
  const rock = items.find((item) => item.kind === 'rock') || { ...ITEM_DEFS.rockSmall, type: 'rockSmall', x: 500, y: 400 };
  const withBuff = (key, item, enabled) => getItemEconomy(item, withP1Buff(key, enabled), 0);
  const baseDiamond = withBuff('diamond', diamond, false);
  const buffDiamond = withBuff('diamond', diamond, true);
  const baseRock = withBuff('rock', rock, false);
  const buffRock = withBuff('rock', rock, true);
  const normalBag = getBagProfile(false);
  const luckyBag = getBagProfile(true);
  const bestIncome = Math.max(0, ...items.filter((item) => item.kind !== 'tnt').map((item) => getRetrievalStats(item, normalized, 0).incomePerMinute));
  const emptyRetractTime = baseHeavy.travelDistance / SIMULATION.emptyRetractSpeed;
  return SHOP_CATALOG.map((offer) => {
    let headline = '';
    let detail = '';
    if (offer.id === 'dynamite') {
      headline = `本次约省 ${round(Math.max(0, baseHeavy.retractionTime - emptyRetractTime), 1)} 秒`;
      detail = `放弃${getItemName(heaviest)}后按 ${SIMULATION.emptyRetractSpeed}/秒空钩返回，不获得矿物价值。`;
    } else if (offer.id === 'hourglass') {
      headline = `共享时间 +${SIMULATION.hourglassSeconds} 秒`;
      detail = `按当前最高效率矿物估算，额外时间约对应 $${round((bestIncome * SIMULATION.hourglassSeconds) / 60)} 收入机会。`;
    } else if (offer.id === 'strength') {
      headline = `${baseHeavy.pullSpeed} → ${strongHeavy.pullSpeed}/秒`;
      detail = `${getItemName(heaviest)}回收 ${baseHeavy.retractionTime} → ${strongHeavy.retractionTime} 秒；实战倍率作用于所有已抓取矿物。`;
    } else if (offer.id === 'clover') {
      headline = `福袋期望 $${normalBag.expectedCash} → $${luckyBag.expectedCash}`;
      detail = `最高金币 $${normalBag.maximumCash} → $${luckyBag.maximumCash}；期望额外时间 ${normalBag.expectedTime} → ${luckyBag.expectedTime} 秒。`;
    } else if (offer.id === 'diamond') {
      headline = `钻石 $${baseDiamond.fixedValue} → $${buffDiamond.fixedValue}`;
      detail = '先应用任务宝石系数并四舍五入，再乘鉴定书 1.5；金猪不受鉴定书影响。';
    } else if (offer.id === 'rock') {
      headline = `岩石 $${baseRock.fixedValue} → $${buffRock.fixedValue}`;
      detail = `收购价覆盖岩石原价为 $100，再加任务加价 $${getMission(normalized.missionId).rockBonus}。`;
    }
    return { ...offer, active: normalized.buffs[0][offer.buff] === true, headline, detail };
  });
}

export function createDesignExport(config, timestamp = new Date().toISOString()) {
  return {
    schema: DESIGN_SCHEMA,
    version: DESIGN_VERSION,
    exportedAt: timestamp,
    readOnly: true,
    note: '数值设计台模拟配置；不会修改正式游戏规则。',
    config: normalizeDesignConfig(config),
  };
}

export function parseDesignImport(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('配置文件不是有效的 JSON');
  }
  if (!payload || typeof payload !== 'object') throw new Error('配置文件内容为空');
  if (payload.schema && payload.schema !== DESIGN_SCHEMA) throw new Error('这不是黄金矿工数值设计台配置');
  if (payload.version && payload.version > DESIGN_VERSION) throw new Error('配置文件版本高于当前设计台');
  return normalizeDesignConfig(payload.config || payload);
}
