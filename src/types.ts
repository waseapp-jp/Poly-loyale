export type CharacterClass = 'melee' | 'tank' | 'scout' | 'sword';

export interface ClassStats {
  maxHp: number;
  speed: number;
  damage: number;
  cooldown: number;
  color: string;
}

export const CLASS_STATS: Record<CharacterClass, ClassStats> = {
  melee: { maxHp: 100, speed: 0.15, damage: 12, cooldown: 450, color: '#3b82f6' }, // blue, bomb blaster
  tank: { maxHp: 150, speed: 0.11, damage: 22, cooldown: 750, color: '#eab308' }, // yellow, heavy cannon
  scout: { maxHp: 35, speed: 0.28, damage: 5, cooldown: 250, color: '#10b981' }, // green, rapid SMG (balanced DPS)
  sword: { maxHp: 90, speed: 0.18, damage: 24, cooldown: 550, color: '#ef4444' }, // red, melee blade
};

export interface ClassAbilityInfo {
  name: string;
  jpName: string;
  icon: string;
  description: string;
  durationMs: number; // 0 for instant bombs, or active duration
  cooldownMs: number;
}

export const CLASS_ABILITIES: Record<CharacterClass, ClassAbilityInfo> = {
  melee: {
    name: 'Mega Bomb',
    jpName: '高爆裂ボム',
    icon: '💣',
    description: '前方へ大ダメージの時限爆弾を投擲',
    durationMs: 0,
    cooldownMs: 5000, // 5s cooldown (faster bomb rotation)
  },
  sword: {
    name: 'Blade Barrier',
    jpName: '無敵ブレード結界',
    icon: '⚔️',
    description: '弾丸完全無効化＆超高速ダッシュ',
    durationMs: 3000, // Reduced to 3 seconds for balance
    cooldownMs: 10000, // 10s cooldown
  },
  tank: {
    name: 'Fortress Shield',
    jpName: '要塞シールド',
    icon: '🛡️',
    description: '被ダメージを50%軽減する防壁を展開',
    durationMs: 6000, // reduced to 6s
    cooldownMs: 12000, // 12s cooldown
  },
  scout: {
    name: 'Jetpack',
    jpName: 'ジェットパック',
    icon: '🚀',
    description: 'ジャンプボタンで高度調整可能な飛行パック',
    durationMs: 8000,
    cooldownMs: 10000,
  },
};

export const CLASS_ABILITY2: Partial<Record<CharacterClass, ClassAbilityInfo>> = {
  scout: {
    name: 'Proximity Mine',
    jpName: 'センサー地雷',
    icon: '🧨',
    description: '100ダメージを与える地雷を設置',
    durationMs: 0,
    cooldownMs: 6000,
  },
};

export interface Obstacle {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  type?: 'building' | 'bunker' | 'crate' | 'pillar' | 'wall' | 'monolith' | 'ramp';
  rampDir?: 'nx' | 'px' | 'nz' | 'pz';
  color?: string;
}

export interface ItemState {
  id: string;
  type: 'heal' | 'weapon';
  x: number;
  y: number;
  z: number;
}

export interface BombState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  createdAt: number;
  exploded: boolean;
  isMine?: boolean;
}

export interface PlayerState {
  id: string;
  name?: string;
  isBot?: boolean;
  characterClass: CharacterClass;
  x: number;
  y: number;
  z: number;
  ry: number; // Rotation Y
  health: number;
  maxHealth: number;
  isDead: boolean;
  score: number;
  color: string;
  team?: 'red' | 'blue';
  
  // Shooting & Healing
  lastShootTime: number;
  heals: number;
  isHealing: boolean;
  healProgress: number; // 0 to 1
  weaponLevel: number;
  
  // Abilities
  lastAbilityTime: number;
  lastAbility2Time?: number;
  isFlying: boolean;
  isInvulnerable: boolean;
  hasShield: boolean;
  
  // Rolling / Dodge
  isRolling?: boolean;
  lastRollTime?: number;
  lastDamagedTime?: number;
  
  // Ranked
  rating: number;
  rankName: string;

  // Battle Bus Drop & Gliding
  inBus?: boolean;
  isSkydiving?: boolean;
  isGliding?: boolean;
}

export interface BattleBusState {
  active: boolean;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  currentX: number;
  currentY: number;
  currentZ: number;
  progress: number; // 0.0 to 1.0
  duration: number; // in seconds
  timeLeft: number;
}

export interface GameState {
  roomId: string;
  mode: 'casual' | 'ranked' | 'password' | 'team' | 'bot' | 'p2p_duel';
  password?: string;
  players: Record<string, PlayerState>;
  items: Record<string, ItemState>;
  bombs: Record<string, BombState>;
  obstacles: Record<string, Obstacle>;
  status: 'waiting' | 'playing' | 'ended';
  matchTimer: number;
  winner: string | null;
  battleBus?: BattleBusState;
  totalOnlineCount?: number;
  teamScores?: { red: number; blue: number };
}

export interface ClientInput {
  x: number;
  y: number;
  z: number;
  ry: number;
  pitch?: number;
  aimTarget?: { x: number; y: number; z: number };
  moveX: number;
  moveY: number;
  isShooting: boolean;
  isHealing: boolean; // Held down
  useAbility: boolean; // Trigger ability
  useAbility2?: boolean; // Trigger second ability (e.g., Scout Mine)
  isRolling?: boolean; // Trigger dodge roll
  isZoomed?: boolean; // Aim zoom / ADS
  jumpFromBus?: boolean; // Jump out of Battle Bus
  toggleGlider?: boolean; // Toggle glider while skydiving
}

export interface AttackEvent {
  id: string;
  attackerId: string;
  characterClass: CharacterClass;
  x: number;
  y: number;
  z: number;
  ry: number;
  dirX?: number;
  dirY?: number;
  dirZ?: number;
  range?: number;
  targetPos?: { x: number; y: number; z: number } | null;
  weaponLevel: number;
  isSword: boolean;
  hitTargetId?: string | null;
  hitPosition?: { x: number; y: number; z: number } | null;
}

export interface DamagePopupEvent {
  id: string;
  targetId: string;
  attackerId?: string;
  x: number;
  y: number;
  z: number;
  amount: number;
  isSword: boolean;
}

const CELL_SIZE = 20;
const spatialGridWeakMap = new WeakMap<Record<string, Obstacle>, Map<string, Obstacle[]>>();

function getGridMap(obstacles: Record<string, Obstacle>): Map<string, Obstacle[]> {
  let grid = spatialGridWeakMap.get(obstacles);
  if (!grid) {
    grid = new Map<string, Obstacle[]>();
    for (const id in obstacles) {
      const obs = obstacles[id];
      const margin = obs.type === 'ramp' ? 1.5 : 0.5;
      const minCX = Math.floor((obs.x - obs.width / 2 - margin) / CELL_SIZE);
      const maxCX = Math.floor((obs.x + obs.width / 2 + margin) / CELL_SIZE);
      const minCZ = Math.floor((obs.z - obs.depth / 2 - margin) / CELL_SIZE);
      const maxCZ = Math.floor((obs.z + obs.depth / 2 + margin) / CELL_SIZE);

      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
          const key = `${cx},${cz}`;
          let list = grid.get(key);
          if (!list) {
            list = [];
            grid.set(key, list);
          }
          list.push(obs);
        }
      }
    }
    spatialGridWeakMap.set(obstacles, grid);
  }
  return grid;
}

export function getGroundHeight(x: number, z: number, obstacles: Record<string, Obstacle>, currentY?: number): number {
  let maxH = 0;
  if (!obstacles) return maxH;

  const grid = getGridMap(obstacles);
  const cx = Math.floor(x / CELL_SIZE);
  const cz = Math.floor(z / CELL_SIZE);

  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const list = grid.get(`${cx + dx},${cz + dz}`);
      if (!list) continue;

      for (let i = 0; i < list.length; i++) {
        const obs = list[i];
        if (obs.type === 'ramp' && obs.rampDir) {
          const margin = 0.8;
          const minX = obs.x - obs.width / 2 - margin;
          const maxX = obs.x + obs.width / 2 + margin;
          const minZ = obs.z - obs.depth / 2 - margin;
          const maxZ = obs.z + obs.depth / 2 + margin;

          if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
            const localX = x - (obs.x - obs.width / 2);
            const localZ = z - (obs.z - obs.depth / 2);
            let p = 0;
            if (obs.rampDir === 'px') p = localX / obs.width;
            else if (obs.rampDir === 'nx') p = 1 - (localX / obs.width);
            else if (obs.rampDir === 'pz') p = localZ / obs.depth;
            else if (obs.rampDir === 'nz') p = 1 - (localZ / obs.depth);
            p = Math.max(0, Math.min(1, p));
            const h = p * obs.height;
            if (currentY === undefined || h <= currentY + 1.2) {
              if (h > maxH) maxH = h;
            }
          }
        } else {
          if (x >= obs.x - obs.width / 2 && x <= obs.x + obs.width / 2 && z >= obs.z - obs.depth / 2 && z <= obs.z + obs.depth / 2) {
            // When currentY is provided (airborne / skydiving / gliding check),
            // only count the building top as ground surface if the player is AT or ABOVE its roof level!
            if (currentY === undefined || obs.height <= currentY + 1.0) {
              if (obs.height > maxH) maxH = obs.height;
            }
          }
        }
      }
    }
  }
  return maxH;
}

export function getNearbyObstaclesClient(
  x: number,
  z: number,
  radius: number,
  obstacles: Record<string, Obstacle>
): Obstacle[] {
  if (!obstacles) return [];
  const grid = getGridMap(obstacles);
  const minCx = Math.floor((x - radius) / CELL_SIZE);
  const maxCx = Math.floor((x + radius) / CELL_SIZE);
  const minCz = Math.floor((z - radius) / CELL_SIZE);
  const maxCz = Math.floor((z + radius) / CELL_SIZE);

  const result: Obstacle[] = [];
  const visited = new Set<string>();

  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      const list = grid.get(`${cx},${cz}`);
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const obs = list[i];
        if (!visited.has(obs.id)) {
          visited.add(obs.id);
          result.push(obs);
        }
      }
    }
  }
  return result;
}
