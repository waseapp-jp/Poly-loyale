export type RankTier =
  | 'Beginner'
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Diamond'
  | 'Master'
  | 'GrandMaster'
  | 'God';

export interface RankInfo {
  tier: RankTier;
  labelJa: string;
  minPoints: number;
  badgeEmoji: string;
  primaryColor: string;
  accentColor: string;
  borderColor: string;
  auraGlow: string;
  auraIntensity: 'subtle' | 'medium' | 'high' | 'ultra' | 'celestial';
  title: string;
}

export const RANK_CONFIGS: Record<RankTier, RankInfo> = {
  Beginner: {
    tier: 'Beginner',
    labelJa: 'ビギナー',
    minPoints: 0,
    badgeEmoji: '🛡️',
    primaryColor: '#94a3b8', // slate-400
    accentColor: '#64748b', // slate-500
    borderColor: 'border-slate-600/60',
    auraGlow: 'shadow-[0_0_20px_rgba(148,163,184,0.15)]',
    auraIntensity: 'subtle',
    title: '駆け出しの戦士',
  },
  Bronze: {
    tier: 'Bronze',
    labelJa: 'ブロンズ',
    minPoints: 150,
    badgeEmoji: '🥉',
    primaryColor: '#d97706', // amber-600
    accentColor: '#b45309', // amber-700
    borderColor: 'border-amber-700/60',
    auraGlow: 'shadow-[0_0_25px_rgba(217,119,6,0.3)]',
    auraIntensity: 'subtle',
    title: '歴戦のブロンズ',
  },
  Silver: {
    tier: 'Silver',
    labelJa: 'シルバー',
    minPoints: 300,
    badgeEmoji: '🥈',
    primaryColor: '#e2e8f0', // slate-200
    accentColor: '#cbd5e1', // slate-300
    borderColor: 'border-slate-400/80',
    auraGlow: 'shadow-[0_0_30px_rgba(226,232,240,0.35)]',
    auraIntensity: 'medium',
    title: '白銀の精鋭',
  },
  Gold: {
    tier: 'Gold',
    labelJa: 'ゴールド',
    minPoints: 500,
    badgeEmoji: '🏆',
    primaryColor: '#facc15', // yellow-400
    accentColor: '#eab308', // yellow-500
    borderColor: 'border-yellow-400/90',
    auraGlow: 'shadow-[0_0_40px_rgba(250,204,21,0.45)]',
    auraIntensity: 'medium',
    title: '黄金の英雄',
  },
  Platinum: {
    tier: 'Platinum',
    labelJa: 'プラチナ',
    minPoints: 750,
    badgeEmoji: '💠',
    primaryColor: '#22d3ee', // cyan-400
    accentColor: '#06b6d4', // cyan-500
    borderColor: 'border-cyan-400/90',
    auraGlow: 'shadow-[0_0_45px_rgba(34,211,238,0.55)]',
    auraIntensity: 'high',
    title: '蒼穹の守護者',
  },
  Diamond: {
    tier: 'Diamond',
    labelJa: 'ダイヤモンド',
    minPoints: 1000,
    badgeEmoji: '💎',
    primaryColor: '#38bdf8', // sky-400
    accentColor: '#60a5fa', // blue-400
    borderColor: 'border-sky-300',
    auraGlow: 'shadow-[0_0_50px_rgba(56,189,248,0.65)]',
    auraIntensity: 'high',
    title: '金剛石の覇者',
  },
  Master: {
    tier: 'Master',
    labelJa: 'マスター',
    minPoints: 1300,
    badgeEmoji: '🔮',
    primaryColor: '#c084fc', // purple-400
    accentColor: '#a855f7', // purple-500
    borderColor: 'border-purple-400',
    auraGlow: 'shadow-[0_0_55px_rgba(192,132,252,0.7)]',
    auraIntensity: 'ultra',
    title: '紫電の導師',
  },
  GrandMaster: {
    tier: 'GrandMaster',
    labelJa: 'グランドマスター',
    minPoints: 1650,
    badgeEmoji: '🔥',
    primaryColor: '#f87171', // red-400
    accentColor: '#ef4444', // red-500
    borderColor: 'border-red-400',
    auraGlow: 'shadow-[0_0_60px_rgba(239,68,68,0.8)]',
    auraIntensity: 'ultra',
    title: '業火の闘神',
  },
  God: {
    tier: 'God',
    labelJa: 'ゴッド',
    minPoints: 2000,
    badgeEmoji: '👑',
    primaryColor: '#f59e0b', // amber-500 & rainbow
    accentColor: '#ec4899', // pink-500
    borderColor: 'border-amber-300',
    auraGlow: 'shadow-[0_0_75px_rgba(245,158,11,0.85),0_0_120px_rgba(168,85,247,0.5)]',
    auraIntensity: 'celestial',
    title: '超越の神格',
  },
};

export const ALL_RANKS: RankTier[] = [
  'Beginner',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Master',
  'GrandMaster',
  'God',
];

export function getRankTier(points: number = 0, rating: number | null = null): RankTier {
  if (rating !== null && rating >= 2000) return 'God';
  if (points >= 2000) return 'God';
  if (points >= 1650) return 'GrandMaster';
  if (points >= 1300) return 'Master';
  if (points >= 1000) return 'Diamond';
  if (points >= 750) return 'Platinum';
  if (points >= 500) return 'Gold';
  if (points >= 300) return 'Silver';
  if (points >= 150) return 'Bronze';
  return 'Beginner';
}
