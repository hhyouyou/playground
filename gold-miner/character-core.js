export const CHARACTERS = Object.freeze({
  joe: Object.freeze({
    id: 'joe',
    name: '老乔',
    title: 'Veteran Prospector',
    description: '经验丰富的老矿工，依靠稳定判断与娴熟技巧寻找金矿。',
    color: '#D99A2B',
    palette: Object.freeze({
      primary: '#D99A2B',
      secondary: '#5B4636',
      accent: '#F4D35E',
      skin: '#E8B98A',
    }),
    appearance: 'prospector',
    passive: '无被动加成',
  }),
  rocky: Object.freeze({
    id: 'rocky',
    name: '阿岩',
    title: 'Heavy Hauler',
    description: '力大无穷的搬运好手，擅长拉回沉重矿物，但摆钩稍慢。',
    color: '#B65C3A',
    palette: Object.freeze({
      primary: '#B65C3A',
      secondary: '#3F4A4F',
      accent: '#E2A66E',
      skin: '#C98D62',
    }),
    appearance: 'strongman',
    passive: '重物回收速度 +8%，摆钩速度为 95%',
  }),
  lily: Object.freeze({
    id: 'lily',
    name: '莉莉',
    title: 'Gem Hunter',
    description: '眼光敏锐的宝石猎人，能迅速收好钻石与金猪。',
    color: '#B56BD4',
    palette: Object.freeze({
      primary: '#B56BD4',
      secondary: '#563A68',
      accent: '#7DE2E8',
      skin: '#F0C7A5',
    }),
    appearance: 'gem-hunter',
    passive: '钻石与金猪回收速度 +6%',
  }),
  max: Object.freeze({
    id: 'max',
    name: '洛克',
    title: 'Blast Expert',
    description: '钟爱爆破的冒险家，每次下矿都会多带一根炸药，但摆钩稍慢。',
    color: '#D84A4A',
    palette: Object.freeze({
      primary: '#D84A4A',
      secondary: '#343A40',
      accent: '#FFB703',
      skin: '#D8A076',
    }),
    appearance: 'demolitionist',
    passive: '初始炸药 +1，摆钩速度为 95%',
  }),
});

export function getCharacter(id = 'joe') {
  return Object.prototype.hasOwnProperty.call(CHARACTERS, id)
    ? CHARACTERS[id]
    : CHARACTERS.joe;
}

export function getWeightClass(item) {
  const pullSpeed = item?.pullSpeed ?? 0;
  if (pullSpeed >= 330) return 'light';
  if (pullSpeed >= 220) return 'medium';
  if (pullSpeed >= 150) return 'heavy';
  return 'extreme';
}

export function getPullMultiplier(characterId, item) {
  if (characterId === 'rocky' && item?.pullSpeed < 220) return 1.08;
  if (characterId === 'lily' && (item?.kind === 'diamond' || item?.kind === 'pig')) return 1.06;
  return 1;
}

export function getSwingMultiplier(characterId) {
  return characterId === 'rocky' || characterId === 'max' ? 0.95 : 1;
}

export function getInitialDynamites(characterId) {
  return characterId === 'max' ? 3 : 2;
}

export const MISSIONS = Object.freeze({
  gold: Object.freeze({ id: 'gold', icon: '⛏️', name: '黄金勘探', subtitle: '经典矿脉', description: '沿矿脉寻找天然金块，规则均衡，适合熟悉团队配合。', goalFactor: 1, gemFactor: 1, rockBonus: 0, extraItem: null, risk: 2, reward: 2, focus: '黄金与福袋' }),
  gems: Object.freeze({ id: 'gems', icon: '💎', name: '宝石追踪', subtitle: '高价值狩猎', description: '追踪钻石与金猪，价值提高 10%，但团队目标提高 5%。', goalFactor: 1.05, gemFactor: 1.1, rockBonus: 0, extraItem: 'diamond', risk: 3, reward: 4, focus: '钻石与金猪' }),
  demolition: Object.freeze({ id: 'demolition', icon: '🧨', name: '爆破开采', subtitle: '危险矿区', description: '矿区出现额外 TNT；岩石更有收购价值，目标降低 5%。', goalFactor: 0.95, gemFactor: 1, rockBonus: 25, extraItem: 'tnt', risk: 4, reward: 3, focus: '岩石与炸药' }),
});

export function getMission(id = 'gold') {
  return Object.prototype.hasOwnProperty.call(MISSIONS, id) ? MISSIONS[id] : MISSIONS.gold;
}

export function createVisualState(seed = 0) {
  return {
    seed,
    action: 'idle',
    expression: 'neutral',
    tension: 0,
    time: 0,
  };
}
