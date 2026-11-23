import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DESIGN_CONFIG,
  DESIGN_SCHEMA,
  DESIGN_VERSION,
  SIMULATION,
  analyzeLevel,
  compareCharacters,
  compareMissions,
  comparePlayerCounts,
  createDesignExport,
  getBagProfile,
  getDesignGoal,
  getDesignTime,
  getItemEconomy,
  getLevelCurve,
  getLevelResources,
  getRetrievalStats,
  getShopInsights,
  normalizeDesignConfig,
  parseDesignImport,
} from '../design-core.js';
import { DIFFICULTIES, HOOK_POSITIONS, ITEM_DEFS, createLevel, getLevelGoal, getLevelTime, isPositionReachable } from '../game-core.js';
import { MISSIONS } from '../character-core.js';

const configWith = (changes = {}) => normalizeDesignConfig({
  ...DEFAULT_DESIGN_CONFIG,
  ...changes,
  tuning: { ...DEFAULT_DESIGN_CONFIG.tuning, ...changes.tuning },
});

test('设计台默认配置与实战首关目标、时间和矿物生成一致', () => {
  const config = normalizeDesignConfig();
  assert.deepEqual(config, DEFAULT_DESIGN_CONFIG);
  assert.equal(getDesignGoal(1, config), getLevelGoal(1));
  assert.equal(getDesignTime(1, config), getLevelTime(1));
  assert.deepEqual(getLevelResources(1, config).items, createLevel(1, 'classic', 1, 'gold'));
});

test('配置归一化会回退非法标识、限制数值范围并保留双方独立背包', () => {
  const config = normalizeDesignConfig({
    level: 999,
    curveLevels: 2,
    playerCount: 7,
    difficultyId: 'toString',
    missionId: 'unknown',
    characterIds: ['unknown', 'max'],
    hourglasses: [-2, 99],
    buffs: [{ strength: true, clover: 'yes' }, { rock: true }],
    tuning: { goalFactor: 99, timeFactor: -2, pullFactor: '1.25', aimSeconds: 99 },
  });
  assert.equal(config.level, SIMULATION.maxLevel);
  assert.equal(config.curveLevels, 6);
  assert.equal(config.playerCount, 1);
  assert.equal(config.difficultyId, 'classic');
  assert.equal(config.missionId, 'gold');
  assert.deepEqual(config.characterIds, ['joe', 'max']);
  assert.deepEqual(config.hourglasses, [0, 3]);
  assert.deepEqual(config.buffs[0], { strength: true, clover: false, diamond: false, rock: false });
  assert.equal(config.buffs[1].rock, true);
  assert.deepEqual(config.tuning, { goalFactor: 1.5, timeFactor: 0.5, pullFactor: 1.25, aimSeconds: 2 });
});

test('任务目标采用与实战相同的 50 金币取整规则', () => {
  assert.equal(getDesignGoal(1, configWith()), 650);
  assert.equal(getDesignGoal(1, configWith({ missionId: 'gems' })), 700);
  assert.equal(getDesignGoal(1, configWith({ missionId: 'demolition' })), 600);
  assert.equal(getDesignGoal(1, configWith({ difficultyId: 'hard' })), 800);
  assert.equal(getDesignGoal(1, configWith({ difficultyId: 'easy' })), 500);
  assert.equal(getDesignGoal(1, configWith({ difficultyId: 'hard', missionId: 'gems' })), 850);
  assert.equal(getDesignTime(1, configWith({ tuning: { timeFactor: 1.2 } })), 72);
});

test('福袋期望严格对应实战概率分支，幸运四叶草提高现金与时间期望', () => {
  const normal = getBagProfile(false);
  const lucky = getBagProfile(true);
  assert.equal(normal.dynamiteChance, 0.14);
  assert.equal(normal.timeChance, 0.11);
  assert.equal(normal.moneyChance, 0.75);
  assert.equal(normal.expectedCash, 153.75);
  assert.equal(normal.maximumCash, 400);
  assert.equal(normal.expectedTime, 0.88);
  assert.equal(lucky.dynamiteChance, 0.08);
  assert.equal(lucky.timeChance, 0.1);
  assert.equal(lucky.moneyChance, 0.82);
  assert.equal(lucky.expectedCash, 332.1);
  assert.equal(lucky.maximumCash, 700);
  assert.equal(lucky.expectedTime, 1.2);
  assert.ok(lucky.expectedCash > normal.expectedCash);
});

test('钻石先乘任务系数再乘鉴定书，岩石书覆盖原价后保留任务加价', () => {
  const gemConfig = configWith({ missionId: 'gems' });
  const diamond = createLevel(1, 'classic', 1, 'gems').find((item) => item.kind === 'diamond');
  assert.equal(getItemEconomy(diamond, gemConfig).fixedValue, 660);
  gemConfig.buffs[0].diamond = true;
  const appraised = getItemEconomy(diamond, gemConfig);
  assert.equal(appraised.fixedValue, 990);
  assert.deepEqual(appraised.valueSteps.map((step) => step.value), [600, 660, 990]);

  const rockConfig = configWith({ missionId: 'demolition' });
  const rock = createLevel(1, 'classic', 1, 'demolition').find((item) => item.kind === 'rock');
  assert.equal(getItemEconomy(rock, rockConfig).fixedValue, 45);
  rockConfig.buffs[0].rock = true;
  assert.equal(getItemEconomy(rock, rockConfig).fixedValue, 125);
});

test('回收耗时使用真实出钩速度、原点距离与倍率叠乘顺序', () => {
  const item = { ...ITEM_DEFS.goldLarge, id: 'test', type: 'goldLarge', x: 500, y: 400 };
  const stats = getRetrievalStats(item, configWith());
  assert.equal(stats.centerDistance, 256);
  assert.equal(stats.travelDistance, 228);
  assert.equal(stats.aimTime, 0.55);
  assert.equal(stats.extensionTime, 0.407);
  assert.equal(stats.retractionTime, 1.303);
  assert.equal(stats.totalTime, 2.26);
  assert.equal(stats.pullSpeed, 175);
  assert.equal(stats.incomePerMinute, 6637.17);

  const strongConfig = configWith({ characterIds: ['rocky', 'lily'] });
  strongConfig.buffs[0].strength = true;
  const strong = getRetrievalStats(item, strongConfig);
  assert.equal(strong.characterPull, 1.08);
  assert.equal(strong.strengthFactor, 1.55);
  assert.equal(strong.pullSpeed, 292.95);
  assert.ok(strong.totalTime < stats.totalTime);
  assert.ok(strong.aimTime > stats.aimTime, '阿岩摆钩较慢，瞄准等待略长');
});

test('莉莉只缩短钻石与金猪回收，不改变其价值', () => {
  const diamond = { ...ITEM_DEFS.diamond, id: 'gem', type: 'diamond', x: 500, y: 400 };
  const joe = getRetrievalStats(diamond, configWith());
  const lily = getRetrievalStats(diamond, configWith({ characterIds: ['lily', 'joe'] }));
  assert.equal(lily.characterPull, 1.06);
  assert.equal(lily.pullSpeed, 466.4);
  assert.equal(lily.expectedValue, joe.expectedValue);
  assert.ok(lily.retractionTime < joe.retractionTime);
});

test('目标曲线包含时间、资源上限、障碍率和逐关目标差额', () => {
  const curve = getLevelCurve(configWith({ curveLevels: 12 }));
  assert.equal(curve.length, 12);
  assert.deepEqual(curve.slice(0, 3).map((entry) => entry.goal), [650, 1500, 2350]);
  assert.deepEqual(curve.slice(0, 3).map((entry) => entry.requiredIncome), [650, 850, 850]);
  assert.equal(curve[9].time, 45);
  assert.equal(curve[11].time, 45);
  for (const entry of curve) {
    assert.ok(entry.maximumValue >= entry.expectedValue);
    assert.ok(entry.expectedValue >= entry.guaranteedValue);
    assert.ok(entry.obstacleRatio >= 0 && entry.obstacleRatio <= 1);
  }
});

test('路线模拟遵守共享截止时间且同一矿物最多分配一次', () => {
  for (const playerCount of [1, 2]) {
    const analysis = analyzeLevel(configWith({ playerCount, level: 5, missionId: 'demolition' }));
    assert.ok(analysis.route.length > 0);
    assert.equal(new Set(analysis.route.map((step) => step.itemId)).size, analysis.route.length);
    assert.ok(analysis.route.every((step) => step.kind !== 'tnt'));
    assert.ok(analysis.route.every((step) => step.end <= analysis.totalTime + 0.001));
    assert.equal(analysis.players.reduce((sum, player) => sum + player.expectedEarned, 0), analysis.expectedEarned);
    assert.equal(analysis.players.reduce((sum, player) => sum + player.coins, 0), analysis.expectedEarned);
    assert.equal(analysis.expectedScore, analysis.startingScore + analysis.expectedEarned);
  }
});

test('双人共享目标和时间但角色、沙漏、商店增益与个人收入保持独立', () => {
  const config = configWith({ playerCount: 2, characterIds: ['rocky', 'lily'], hourglasses: [1, 2] });
  config.buffs[0].strength = true;
  config.buffs[1].diamond = true;
  const analysis = analyzeLevel(config);
  assert.equal(analysis.players.length, 2);
  assert.equal(analysis.ownedTimeBonus, 36);
  assert.equal(analysis.baseTime, 60);
  assert.equal(analysis.players[0].hourglasses, 1);
  assert.equal(analysis.players[1].hourglasses, 2);
  assert.equal(analysis.players[0].buffs.strength, true);
  assert.equal(analysis.players[1].buffs.strength, false);
  assert.equal(analysis.players[1].buffs.diamond, true);
  assert.equal(analysis.players[0].buffs.diamond, false);
  assert.equal(analysis.players[0].coins + analysis.players[1].coins, analysis.expectedEarned);
  assert.ok(analysis.route.some((step) => step.playerIndex === 0));
  assert.ok(analysis.route.some((step) => step.playerIndex === 1));
});

test('单人双人对比使用同一团队目标并生成完整个人经济数据', () => {
  const [solo, duo] = comparePlayerCounts(configWith({ level: 3 }));
  assert.equal(solo.config.playerCount, 1);
  assert.equal(duo.config.playerCount, 2);
  assert.equal(solo.goal, duo.goal);
  assert.equal(solo.baseTime, duo.baseTime);
  assert.equal(solo.players.length, 1);
  assert.equal(duo.players.length, 2);
  assert.ok(duo.expectedEarned >= solo.expectedEarned);
  assert.notDeepEqual(solo.resources.items, duo.resources.items, '双原点会改变实际生成布局');
});

test('任务对照直接反映目标、额外矿物与障碍变化', () => {
  const comparisons = compareMissions(configWith({ level: 3 }));
  assert.equal(comparisons.length, Object.keys(MISSIONS).length);
  const gold = comparisons.find((entry) => entry.missionId === 'gold');
  const gems = comparisons.find((entry) => entry.missionId === 'gems');
  const demolition = comparisons.find((entry) => entry.missionId === 'demolition');
  assert.equal(gems.itemCount, gold.itemCount + 1);
  assert.equal(demolition.itemCount, gold.itemCount + 1);
  assert.ok(gems.goal > gold.goal);
  assert.ok(demolition.goal < gold.goal);
  assert.ok(demolition.tntCount > gold.tntCount);
});

test('角色对比使用同一件实物并展示最终回收、收益与摆钩数据', () => {
  const comparison = compareCharacters(configWith({ difficultyId: 'hard' }));
  assert.equal(comparison.length, 4);
  assert.equal(new Set(comparison.map((entry) => entry.itemId)).size, 1);
  const joe = comparison.find((entry) => entry.characterId === 'joe');
  const rocky = comparison.find((entry) => entry.characterId === 'rocky');
  assert.equal(joe.name, '老乔');
  assert.equal(rocky.name, '阿岩');
  assert.equal(comparison.find((entry) => entry.characterId === 'lily').name, '莉莉');
  assert.equal(comparison.find((entry) => entry.characterId === 'max').name, '洛克');
  assert.equal(rocky.initialDynamites, 2);
  assert.ok(rocky.retractionTime < joe.retractionTime);
  assert.ok(rocky.swingSpeed < joe.swingSpeed);
  assert.equal(comparison.find((entry) => entry.characterId === 'max').initialDynamites, 3);
});

test('商店洞察展示最终数值而不是只重复商品文案', () => {
  const analysis = analyzeLevel(configWith({ missionId: 'gems' }));
  const insights = getShopInsights(analysis.config, analysis);
  assert.equal(insights.length, 6);
  assert.match(insights.find((entry) => entry.id === 'diamond').headline, /\$660 → \$990/);
  assert.match(insights.find((entry) => entry.id === 'clover').headline, /\$153\.75 → \$332\.1/);
  assert.match(insights.find((entry) => entry.id === 'hourglass').headline, /\+12 秒/);
  assert.match(insights.find((entry) => entry.id === 'strength').headline, /→/);

  analysis.config.buffs[0].diamond = true;
  analysis.config.buffs[0].strength = true;
  const activeInsights = getShopInsights(analysis.config, analysis);
  assert.equal(activeInsights.find((entry) => entry.id === 'diamond').active, true);
  assert.equal(activeInsights.find((entry) => entry.id === 'strength').active, true);
  assert.match(activeInsights.find((entry) => entry.id === 'diamond').headline, /\$660 → \$990/, '已装配时仍显示未装配到已装配的对照');
  assert.equal(activeInsights.find((entry) => entry.id === 'strength').headline, insights.find((entry) => entry.id === 'strength').headline);
});

test('理论资源不足与后期资源过量会分别给出不同预警', () => {
  const impossible = analyzeLevel(configWith({ level: 20 }), 20, 0);
  assert.equal(impossible.theoreticalPossible, false);
  assert.ok(impossible.warnings.some((warning) => warning.id === 'impossible'));
  const late = analyzeLevel(configWith({ level: 12 }));
  assert.ok(late.warnings.some((warning) => warning.id === 'resource-excess'));
});

test('配置导出可完整往返，且不会引用或修改正式规则对象', () => {
  const config = configWith({ playerCount: 2, missionId: 'gems', difficultyId: 'hard', characterIds: ['rocky', 'lily'] });
  config.buffs[1].diamond = true;
  const before = JSON.stringify(config);
  const difficultyBefore = JSON.stringify(DIFFICULTIES);
  const payload = createDesignExport(config, '2026-01-02T03:04:05.000Z');
  assert.equal(payload.schema, DESIGN_SCHEMA);
  assert.equal(payload.version, DESIGN_VERSION);
  assert.equal(payload.exportedAt, '2026-01-02T03:04:05.000Z');
  assert.equal(payload.readOnly, true);
  const restored = parseDesignImport(JSON.stringify(payload));
  assert.deepEqual(restored, config);
  restored.tuning.goalFactor = 1.4;
  assert.equal(config.tuning.goalFactor, 1);
  analyzeLevel(config);
  assert.equal(JSON.stringify(config), before);
  assert.equal(JSON.stringify(DIFFICULTIES), difficultyBefore);
  assert.throws(() => parseDesignImport('{bad json'), /有效的 JSON/);
  assert.throws(() => parseDesignImport(JSON.stringify({ schema: 'other-game' })), /不是黄金矿工/);
  assert.throws(() => parseDesignImport(JSON.stringify({ schema: DESIGN_SCHEMA, version: 99 })), /版本高于/);
});

test('双原点距离确实来自实战钩爪位置，而不是视觉偏移', () => {
  const config = configWith({ playerCount: 2 });
  const item = { ...ITEM_DEFS.goldSmall, id: 'distance', type: 'goldSmall', x: 325, y: 300 };
  const p1 = getRetrievalStats(item, config, 0);
  const p2 = getRetrievalStats(item, config, 1);
  assert.equal(p1.origin, HOOK_POSITIONS.double[0]);
  assert.equal(p2.origin, HOOK_POSITIONS.double[1]);
  assert.equal(p1.centerDistance, 156);
  assert.equal(p2.centerDistance, Math.round(Math.hypot(350, 156) * 100) / 100);
  assert.ok(p1.totalTime < p2.totalTime);
});

test('双人路线只把矿物分给自己安全摆角内的玩家', () => {
  const config = configWith({ playerCount: 2, difficultyId: 'easy', level: 5 });
  const analysis = analyzeLevel(config);
  const item = analysis.resources.items.find((entry) => entry.id === '5-27');
  assert.ok(item, '保留独立复核使用的边界矿物');
  const p1 = getRetrievalStats(item, config, 0);
  const p2 = getRetrievalStats(item, config, 1);
  assert.equal(p1.reachable, false);
  assert.ok(p1.requiredAngle > 1.34);
  assert.equal(p2.reachable, true);
  const assigned = analysis.route.find((step) => step.itemId === item.id);
  assert.equal(assigned.playerIndex, 1, 'P1 不可达时必须交给 P2');
  for (const step of analysis.route) {
    const routedItem = analysis.resources.items.find((entry) => entry.id === step.itemId);
    assert.equal(step.reachable, true);
    assert.equal(isPositionReachable(step.x, step.y, routedItem.radius, [step.origin]), true, `${step.itemId} 不得分给不可达玩家`);
  }
  const characters = compareCharacters(config, item);
  assert.ok(characters.every((entry) => entry.originPlayerIndex === 1 && entry.playerIndex === 1 && entry.reachable));
});

test('理论资源只采用真正可达玩家的商店增益，不使用不可达高价', () => {
  const config = configWith({ playerCount: 2, difficultyId: 'easy', level: 3, missionId: 'gems' });
  config.buffs[1].diamond = true;
  const resources = getLevelResources(3, config);
  const diamond = resources.items.find((entry) => entry.id === '3-4');
  assert.equal(getRetrievalStats(diamond, config, 0).reachable, true);
  assert.equal(getRetrievalStats(diamond, config, 1).reachable, false);
  assert.equal(getItemEconomy(diamond, config, 0).fixedValue, 660);
  assert.equal(getItemEconomy(diamond, config, 1).fixedValue, 990);
  assert.equal(resources.maximumValue, 6830, '不可达的 P2 鉴定价格 $990 不得替代 P1 的 $660');
  assert.equal(resources.expectedValue, 6337.5);
  const curve = getLevelCurve(config);
  assert.equal(curve[2].maximumValue, 6830, '曲线必须消费同一份可达资源结果');
});

test('达标且贵重物清空后遵守双方钩爪回位的提前收工规则', () => {
  const analysis = analyzeLevel(configWith());
  assert.equal(analysis.earlySettlement.triggered, true);
  assert.equal(analysis.earlySettlement.reason, 'goal');
  assert.equal(analysis.earlySettlement.time, 23.462);
  assert.equal(analysis.route.length, 10);
  assert.equal(analysis.route.at(-1).itemId, '1-11');
  assert.equal(analysis.expectedEarned, 1953.75);
  assert.ok(analysis.route.every((step) => !['rock', 'bone'].includes(step.kind)), '最后一件贵重物后不得继续排入岩石');
  assert.ok(analysis.route.every((step) => step.end <= analysis.earlySettlement.time));
  assert.ok(analysis.unscheduled.some((entry) => entry.item.kind === 'rock'));
  const expectedPerMinute = Math.round((analysis.expectedEarned / analysis.totalTime) * 60 * 100) / 100;
  assert.equal(analysis.expectedIncomePerMinute, expectedPerMinute, '收益分母必须与展示的可用时间一致');
});

test('双人提前收工会等待仍在回收的另一只钩爪，而不是误删其后段收益', () => {
  const analysis = analyzeLevel(configWith({ playerCount: 2 }));
  const valuableKinds = ['gold', 'diamond', 'bag', 'pig'];
  const lastValuableEnd = Math.max(...analysis.route.filter((step) => valuableKinds.includes(step.kind)).map((step) => step.end));
  assert.equal(lastValuableEnd, 11.389);
  assert.ok(analysis.route.some((step) => step.start < lastValuableEnd && step.end > lastValuableEnd), '最后贵重物回位时另一方仍在回收');
  assert.ok(analysis.route.some((step) => step.kind === 'rock' && step.start > lastValuableEnd), '另一方忙碌时允许继续出钩');
  assert.equal(analysis.earlySettlement.triggered, true);
  assert.equal(analysis.earlySettlement.time, 16.324);
  assert.ok(analysis.route.every((step) => step.end <= analysis.earlySettlement.time));
  assert.equal(analysis.expectedEarned, 2013.75);
});

test('TNT 使用引爆后的空钩回收，不吃矿物重量、难度、角色或饮料倍率', () => {
  const config = configWith({ difficultyId: 'hard', missionId: 'demolition', characterIds: ['rocky', 'lily'] });
  config.buffs[0].strength = true;
  const item = createLevel(1, 'hard', 1, 'demolition').find((entry) => entry.kind === 'tnt');
  const stats = getRetrievalStats(item, config, 0);
  assert.equal(stats.pullSpeed, SIMULATION.emptyRetractSpeed);
  assert.equal(stats.difficultyPull, 1);
  assert.equal(stats.characterPull, 1);
  assert.equal(stats.strengthFactor, 1);
  assert.equal(stats.retractionTime, Math.round((stats.travelDistance / SIMULATION.emptyRetractSpeed) * 1000) / 1000);
  assert.match(stats.pullSteps[0].label, /空钩/);
  assert.match(stats.pullSteps[1].label, /不影响/);
});

test('导入的自定义曲线关数保留原值，供界面生成匹配选项', () => {
  const restored = parseDesignImport(JSON.stringify({ curveLevels: 7 }));
  assert.equal(restored.curveLevels, 7);
  assert.equal(getLevelCurve(restored).length, 7);
});
