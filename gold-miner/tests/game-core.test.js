import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIFFICULTIES,
  HOOK_POSITIONS,
  SHOP_CATALOG,
  WORLD,
  createLevel,
  createRandom,
  getBagReward,
  getLevelGoal,
  getLevelTime,
  getShopStock,
  isPositionReachable,
  pointToSegmentDistance,
  purchaseShopOffer,
  shouldFinishEarly,
} from '../game-core.js';

const emptyBuffs = () => ({ strength: false, clover: false, diamond: false, rock: false });

test('经典难度保留原有关卡目标与时间', () => {
  assert.equal(getLevelGoal(1), 650);
  assert.equal(getLevelGoal(2), 1500);
  assert.equal(getLevelGoal(3), 2350);
  assert.equal(getLevelTime(1), 60);
  assert.equal(getLevelTime(10), 45);
  assert.equal(getLevelTime(100), 45);
});

test('三档难度在目标、时间和摆钩速度上形成明确差异', () => {
  assert.equal(Object.keys(DIFFICULTIES).length, 3);
  assert.ok(getLevelGoal(1, 'easy') < getLevelGoal(1, 'classic'));
  assert.ok(getLevelGoal(1, 'hard') > getLevelGoal(1, 'classic'));
  assert.equal(getLevelTime(1, 'easy'), 75);
  assert.equal(getLevelTime(1, 'hard'), 51);
  assert.ok(DIFFICULTIES.easy.swingFactor < DIFFICULTIES.classic.swingFactor);
  assert.ok(DIFFICULTIES.hard.swingFactor > DIFFICULTIES.classic.swingFactor);
});

test('提前结算不会剥夺岩石或骨骸达标的机会', () => {
  const rock = [{ kind: 'rock', state: 'active' }];
  const bone = [{ kind: 'bone', state: 'active' }];
  const tnt = [{ kind: 'tnt', state: 'active' }];
  assert.equal(shouldFinishEarly(rock, 630, 650), false);
  assert.equal(shouldFinishEarly(bone, 640, 650), false);
  assert.equal(shouldFinishEarly(rock, 650, 650), true);
  assert.equal(shouldFinishEarly([], 0, 650), true);
  assert.equal(shouldFinishEarly(tnt, 0, 650), true);
  assert.equal(shouldFinishEarly([{ kind: 'gold', state: 'active' }], 650, 650), false);
});

test('钩爪碰撞检测覆盖线段上、线段外与零长度线段', () => {
  assert.equal(pointToSegmentDistance(5, 2, 0, 0, 10, 0), 2);
  assert.equal(pointToSegmentDistance(12, 4, 0, 0, 10, 0), Math.hypot(2, 4));
  assert.equal(pointToSegmentDistance(3, 4, 0, 0, 0, 0), 5);
});

test('不可达的浅层边角被留空，所有难度与关卡的矿物均可达', () => {
  assert.equal(isPositionReachable(80, 210, 20), false);
  assert.equal(isPositionReachable(920, 220, 20), false);
  assert.equal(isPositionReachable(825, 285, 20), true);
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    for (let level = 1; level <= 12; level += 1) {
      const items = createLevel(level, difficulty);
      for (const item of items) {
        assert.ok(isPositionReachable(item.x, item.y, item.radius), `${difficulty} 第 ${level} 关的 ${item.type} 必须可达`);
        if (item.kind === 'pig') {
          assert.ok(isPositionReachable(item.minX, item.y, item.radius), '金猪左端点必须可达');
          assert.ok(isPositionReachable(item.maxX, item.y, item.radius), '金猪右端点必须可达');
        }
      }
    }
  }
});

test('双人矿区的每件物品和金猪轨迹至少能被一个钩爪到达', () => {
  const origins = HOOK_POSITIONS.double;
  assert.equal(origins.length, 2);
  assert.ok(origins[0].x < origins[1].x);
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    for (let level = 1; level <= 60; level += 1) {
      const items = createLevel(level, difficulty, 2);
      assert.equal(items.length, createLevel(level, difficulty).length);
      for (const item of items) {
        assert.ok(isPositionReachable(item.x, item.y, item.radius, origins), `双人 ${difficulty} 第 ${level} 关 ${item.type}`);
        if (item.kind === 'pig') {
          assert.ok(isPositionReachable(item.minX, item.y, item.radius, origins));
          assert.ok(isPositionReachable(item.maxX, item.y, item.radius, origins));
        }
      }
    }
  }
});

test('首关包含完整基础矿物组合与足够的可达目标金额', () => {
  const items = createLevel(1);
  assert.ok(items.some((item) => item.kind === 'gold'));
  assert.ok(items.some((item) => item.kind === 'diamond'));
  assert.ok(items.some((item) => item.kind === 'bag'));
  assert.ok(items.some((item) => item.kind === 'rock'));
  const available = items.reduce((sum, item) => sum + item.value, 0);
  assert.ok(available > getLevelGoal(1) * 2);
});

test('随机关卡可复现，矿物位于矿区边界内且互不重叠', () => {
  for (let level = 2; level <= 10; level += 1) {
    const first = createLevel(level);
    const second = createLevel(level);
    assert.deepEqual(first, second, `第 ${level} 关应由种子确定`);
    assert.ok(first.length >= 20);
    for (let index = 0; index < first.length; index += 1) {
      const item = first[index];
      assert.ok(item.x - item.radius >= 0 && item.x + item.radius <= WORLD.width);
      assert.ok(item.y - item.radius >= WORLD.surfaceY && item.y + item.radius <= WORLD.height);
      for (let otherIndex = index + 1; otherIndex < first.length; otherIndex += 1) {
        const other = first[otherIndex];
        assert.ok(Math.hypot(item.x - other.x, item.y - other.y) > item.radius + other.radius);
      }
    }
  }
});

test('经典元素按关卡解锁，金猪具有受限移动轨迹', () => {
  const level2 = createLevel(2);
  const pig = level2.find((item) => item.kind === 'pig');
  assert.ok(pig);
  assert.ok(pig.minX < pig.x && pig.maxX > pig.x);
  assert.notEqual(pig.vx, 0);
  const level3 = createLevel(3);
  assert.ok(level3.some((item) => item.kind === 'bone'));
  assert.ok(level3.some((item) => item.kind === 'tnt'));
});

test('金猪移动通道与所有静态矿物、其他金猪保持间距', () => {
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    for (let level = 2; level <= 12; level += 1) {
      const items = createLevel(level, difficulty);
      const pigs = items.filter((item) => item.kind === 'pig');
      for (const pig of pigs) {
        for (const other of items) {
          if (other === pig || other.kind === 'pig') continue;
          const distance = pointToSegmentDistance(other.x, other.y, pig.minX, pig.y, pig.maxX, pig.y);
          assert.ok(distance > pig.radius + other.radius, `${difficulty} 第 ${level} 关金猪通道必须避开 ${other.type}`);
        }
      }
      for (let first = 0; first < pigs.length; first += 1) {
        for (let second = first + 1; second < pigs.length; second += 1) {
          const a = pigs[first];
          const b = pigs[second];
          const gapX = Math.max(a.minX - b.maxX, b.minX - a.maxX, 0);
          assert.ok(Math.hypot(gapX, a.y - b.y) > a.radius + b.radius);
        }
      }
    }
  }
});

test('后期高密度关卡不会静默丢失计划物品', () => {
  const expected = {
    easy: [[2, 21], [3, 25], [5, 30], [20, 30], [34, 30], [60, 30]],
    classic: [[2, 23], [3, 28], [5, 33], [20, 33], [34, 33], [60, 33]],
    hard: [[2, 24], [3, 29], [5, 34], [20, 34], [34, 34], [60, 34]],
  };
  for (const [difficulty, cases] of Object.entries(expected)) {
    for (const [level, count] of cases) assert.equal(createLevel(level, difficulty).length, count, `${difficulty} 第 ${level} 关`);
  }
});

test('任务会向实际矿区加入对应特色矿物，并保持双原点可达', () => {
  for (const mission of ['gold', 'gems', 'demolition']) {
    for (const difficulty of Object.keys(DIFFICULTIES)) {
      const baseline = createLevel(3, difficulty, 2);
      const items = createLevel(3, difficulty, 2, mission);
      assert.equal(items.length, baseline.length + (mission === 'gold' ? 0 : 1));
      if (mission === 'gems') assert.equal(items.filter((item) => item.kind === 'diamond').length, baseline.filter((item) => item.kind === 'diamond').length + 1);
      if (mission === 'demolition') assert.equal(items.filter((item) => item.kind === 'tnt').length, baseline.filter((item) => item.kind === 'tnt').length + 1);
      for (const item of items) assert.ok(isPositionReachable(item.x, item.y, item.radius, HOOK_POSITIONS.double));
    }
  }
});

test('普通与幸运福袋均包含多类奖励，幸运奖励价值更高', () => {
  assert.deepEqual(getBagReward(() => 0), { kind: 'dynamite', amount: 1, label: '炸药 +1' });
  assert.deepEqual(getBagReward(() => 0.2), { kind: 'time', amount: 8, label: '时间 +8秒' });
  const rolls = [0.5, 0];
  assert.deepEqual(getBagReward(() => rolls.shift()), { kind: 'money', amount: 75, label: '福袋 +$75' });
  const highRolls = [0.99, 0.99];
  assert.deepEqual(getBagReward(() => highRolls.shift()), { kind: 'money', amount: 400, label: '福袋 +$400' });
  assert.deepEqual(getBagReward(() => 0.1, true), { kind: 'time', amount: 12, label: '时间 +12秒' });
  const luckyRolls = [0.99, 0.99];
  assert.deepEqual(getBagReward(() => luckyRolls.shift(), true), { kind: 'money', amount: 700, label: '幸运福袋 +$700' });
});

test('商店每次提供三件不重复的有效随机商品', () => {
  const stock = getShopStock(createRandom(42));
  assert.equal(stock.length, 3);
  assert.equal(new Set(stock.map((offer) => offer.id)).size, 3);
  for (const offer of stock) {
    assert.ok(SHOP_CATALOG.some((item) => item.id === offer.id && item.price === offer.price));
    assert.equal(offer.sold, false);
  }
});

test('商店购买会扣金币、增加库存且不会修改原状态', () => {
  const state = { coins: 500, dynamites: 2, hourglasses: 0, pendingBuffs: emptyBuffs() };
  const result = purchaseShopOffer({ id: 'dynamite', price: 110, sold: false }, state);
  assert.equal(result.ok, true);
  assert.equal(result.state.coins, 390);
  assert.equal(result.state.dynamites, 3);
  assert.equal(result.offer.sold, true);
  assert.equal(state.coins, 500);
  assert.equal(state.dynamites, 2);
});

test('商店正确处理余额不足、重复购买与一次性增益', () => {
  const state = { coins: 500, dynamites: 2, hourglasses: 0, pendingBuffs: emptyBuffs() };
  assert.equal(purchaseShopOffer({ id: 'dynamite', price: 110, sold: false }, { ...state, coins: 20 }).reason, 'coins');
  assert.equal(purchaseShopOffer({ id: 'dynamite', price: 110, sold: true }, state).reason, 'sold');
  assert.equal(purchaseShopOffer({ id: 'hourglass', price: 100, sold: false }, { ...state, hourglasses: 3 }).reason, 'limit');
  const strength = purchaseShopOffer({ id: 'strength', price: 180, sold: false }, state);
  assert.equal(strength.ok, true);
  assert.equal(strength.state.pendingBuffs.strength, true);
  assert.equal(strength.state.coins, 320);
  const duplicate = purchaseShopOffer({ id: 'strength', price: 180, sold: false }, strength.state);
  assert.equal(duplicate.reason, 'limit');
});

test('双人购买同一商品时，库存与售出状态互不影响', () => {
  const p1 = { coins: 500, dynamites: 2, hourglasses: 0, pendingBuffs: emptyBuffs() };
  const p2 = { coins: 500, dynamites: 2, hourglasses: 0, pendingBuffs: emptyBuffs() };
  const p1Offer = { id: 'dynamite', price: 110, sold: false };
  const p2Offer = { id: 'dynamite', price: 110, sold: false };
  const first = purchaseShopOffer(p1Offer, p1);
  const second = purchaseShopOffer(p2Offer, p2);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.state.coins, 390);
  assert.equal(second.state.coins, 390);
  assert.notEqual(first.offer, second.offer);
  assert.equal(p1Offer.sold, false);
  assert.equal(p2Offer.sold, false);
});
