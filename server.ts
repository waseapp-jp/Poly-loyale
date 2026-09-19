import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GameState, ClientInput, CharacterClass, CLASS_STATS, CLASS_ABILITIES, PlayerState, Obstacle, ItemState, getGroundHeight, BattleBusState } from './src/types.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const MAP_SIZE = 200;
const SHOOT_RANGE = 80;
const BOMB_RADIUS = 12;
const BOMB_DAMAGE = 40;
const BUS_DURATION = 14; // 14 seconds for battle bus to cross the island
const BUS_HEIGHT = 80; // Altitude of the battle bus

const rooms: Record<string, GameState> = {};
const socketRoom: Record<string, string> = {};
const userSockets: Record<string, string> = {}; // userId -> socket.id

function getRankName(rating: number): string {
  if (rating < 150) return 'Beginner';
  if (rating < 300) return 'Bronze';
  if (rating < 500) return 'Silver';
  if (rating < 750) return 'Gold';
  if (rating < 1000) return 'Platinum';
  if (rating < 1300) return 'Diamond';
  if (rating < 1650) return 'Master';
  if (rating < 2000) return 'GrandMaster';
  return `God (${rating})`;
}

function generateObstacles(): Record<string, Obstacle> {
  const obs: Record<string, Obstacle> = {};
  let counter = 0;

  const addObs = (x: number, z: number, width: number, depth: number, height: number, type: Obstacle['type'], color?: string) => {
    const id = `obs_${++counter}_${Math.random().toString(36).substring(2, 6)}`;
    obs[id] = { id, x, z, width, depth, height, type, color };
  };

  const addRamp = (x: number, z: number, width: number, depth: number, height: number, rampDir: Obstacle['rampDir'], color?: string) => {
    const id = `obs_${++counter}_${Math.random().toString(36).substring(2, 6)}`;
    obs[id] = { id, x, z, width, depth, height, type: 'ramp', rampDir, color };
  };

  // 1. CENTRAL CITADEL & FORTRESS ARENA (x: 0, z: 0)
  // 4 Grand Corner Bastions
  addObs(-16, -16, 9, 9, 18, 'building', '#334155');
  addObs(16, -16, 9, 9, 18, 'building', '#334155');
  addObs(-16, 16, 9, 9, 18, 'building', '#334155');
  addObs(16, 16, 9, 9, 18, 'building', '#334155');

  // Central Fortress Command Bunker & Rampart Walls
  addObs(0, 0, 8, 8, 14, 'bunker', '#1e293b');
  addObs(0, -12, 12, 3.5, 6, 'wall', '#475569');
  addObs(0, 12, 12, 3.5, 6, 'wall', '#475569');
  addObs(-12, 0, 3.5, 12, 6, 'wall', '#475569');
  addObs(12, 0, 3.5, 12, 6, 'wall', '#475569');

  // Outer ramps leading up to the ramparts
  addRamp(0, -18, 6, 10, 6, 'pz', '#475569');
  addRamp(0, 18, 6, 10, 6, 'nz', '#475569');
  addRamp(-18, 0, 10, 6, 6, 'px', '#475569');
  addRamp(18, 0, 10, 6, 6, 'nx', '#475569');

  // Inner ramps
  addRamp(0, -7.5, 6, 8, 6, 'nz', '#475569');
  addRamp(0, 7.5, 6, 8, 6, 'pz', '#475569');
  addRamp(-7.5, 0, 8, 6, 6, 'nx', '#475569');
  addRamp(7.5, 0, 8, 6, 6, 'px', '#475569');

  // 2. 4 QUADRANT STRATEGIC HIGHGROUND PLATFORMS
  const platforms = [
    { px: -40, pz: -40, rampDirs: ['px', 'pz'] as const }, // NW
    { px: 40, pz: -40, rampDirs: ['nx', 'pz'] as const },  // NE
    { px: -40, pz: 40, rampDirs: ['px', 'nz'] as const },  // SW
    { px: 40, pz: 40, rampDirs: ['nx', 'nz'] as const },   // SE
  ];
  platforms.forEach(({ px, pz, rampDirs }) => {
    addObs(px, pz, 16, 16, 7, 'building', '#334155');
    rampDirs.forEach(dir => {
      if (dir === 'px') addRamp(px - 11, pz, 9, 8, 7, 'px', '#64748b');
      if (dir === 'nx') addRamp(px + 11, pz, 9, 8, 7, 'nx', '#64748b');
      if (dir === 'pz') addRamp(px, pz - 11, 8, 9, 7, 'pz', '#64748b');
      if (dir === 'nz') addRamp(px, pz + 11, 8, 9, 7, 'nz', '#64748b');
    });
  });

  // 3. INNER RING PILLARS & SUPPLY STACKS (Radius: 26m)
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const px = Math.cos(angle) * 26;
    const pz = Math.sin(angle) * 26;
    addObs(px, pz, 4, 4, 14, 'pillar', '#0f172a');
    addObs(px + Math.sin(angle) * 4, pz - Math.cos(angle) * 4, 3.5, 3.5, 3.5, 'crate', '#d97706');
  }

  // 4. 4 QUADRANT URBAN CITY BLOCKS
  const quadrantCenters = [
    { qx: -65, qz: -65, theme: '#3b4252' }, // NW
    { qx: 65, qz: -65, theme: '#434c5e' },  // NE
    { qx: -65, qz: 65, theme: '#4c566a' },  // SW
    { qx: 65, qz: 65, theme: '#2e3440' },   // SE
  ];

  quadrantCenters.forEach(({ qx, qz, theme }) => {
    addObs(qx - 5, qz - 5, 11, 11, 18, 'building', theme);
    addObs(qx + 8, qz + 8, 10, 11, 15, 'building', theme);

    addObs(qx - 15, qz - 10, 7, 6, 6, 'bunker', '#1e293b');
    addObs(qx + 15, qz + 10, 6, 7, 6, 'bunker', '#1e293b');

    addObs(qx - 18, qz + 8, 9, 2.5, 4, 'wall', '#64748b');
    addObs(qx + 18, qz - 8, 9, 2.5, 4, 'wall', '#64748b');

    addObs(qx - 10, qz + 8, 3.5, 4, 3.5, 'crate', '#b45309');
    addObs(qx + 8, qz - 10, 4, 3.5, 3.5, 'crate', '#0284c7');

    addObs(qx - 20, qz - 20, 4, 4, 16, 'pillar', '#0f172a');
    addObs(qx + 20, qz + 20, 4, 4, 16, 'pillar', '#0f172a');
  });

  // 5. COMBAT HIGHWAY CHECKPOINTS
  const checkpoints = [
    { x: 0, z: -32 }, { x: 0, z: 32 }, { x: -32, z: 0 }, { x: 32, z: 0 },
  ];
  checkpoints.forEach(cp => {
    addObs(cp.x - 4.5, cp.z, 3.5, 4, 6, 'bunker', '#334155');
    addObs(cp.x + 4.5, cp.z, 3.5, 4, 6, 'bunker', '#334155');
    addObs(cp.x - 8, cp.z, 2.5, 5, 4, 'wall', '#64748b');
    addObs(cp.x + 8, cp.z, 2.5, 5, 4, 'wall', '#64748b');
  });

  // 6. INDUSTRIAL WAREHOUSES & HANGAR COMPLEXES
  const warehouseDistricts = [
    { wx: 0, wz: -55 },
    { wx: 0, wz: 55 },
    { wx: -55, wz: 0 },
    { wx: 55, wz: 0 },
  ];
  warehouseDistricts.forEach(({ wx, wz }) => {
    addObs(wx - 8, wz, 9, 12, 9, 'building', '#334155');
    addObs(wx + 8, wz, 9, 12, 9, 'building', '#334155');
    addObs(wx - 3.5, wz - 7, 3, 3, 3, 'crate', '#d97706');
    addObs(wx + 3.5, wz + 7, 3, 3, 3, 'crate', '#0284c7');
  });

  // 7. CONTAINER YARDS
  const containerYards = [
    { cx: -28, cz: 28 },
    { cx: 28, cz: -28 },
  ];
  containerYards.forEach(({ cx, cz }) => {
    const offsets = [-7, 7];
    offsets.forEach((ox) => {
      offsets.forEach((oz) => {
        addObs(cx + ox, cz + oz, 3.5, 6, 3.5, 'crate', '#d97706');
      });
    });
  });

  // 8. TACTICAL SCATTERED COVER
  const colors = ['#b45309', '#d97706', '#0284c7', '#059669', '#7c3aed', '#64748b'];
  let placedCount = 0;
  for (let attempt = 0; attempt < 600 && placedCount < 80; attempt++) {
    const rx = (Math.random() - 0.5) * 160;
    const rz = (Math.random() - 0.5) * 160;
    if (Math.hypot(rx, rz) < 20) continue; // Keep central citadel clear

    const typeRoll = Math.random();
    let width = 3, depth = 3, height = 3, type: 'monolith' | 'wall' | 'crate' | 'bunker' = 'crate';
    let col = colors[Math.floor(Math.random() * colors.length)];

    if (typeRoll < 0.4) {
      type = 'crate';
      width = 3; depth = 3; height = 3;
    } else if (typeRoll < 0.7) {
      type = 'wall';
      const horiz = Math.random() > 0.5;
      width = horiz ? 6 : 2.5;
      depth = horiz ? 2.5 : 6;
      height = 3.5;
      col = '#64748b';
    } else if (typeRoll < 0.88) {
      type = 'monolith';
      width = 3; depth = 3; height = 8;
      col = '#0f172a';
    } else {
      type = 'bunker';
      width = 5; depth = 5; height = 4.5;
      col = '#1e293b';
    }

    // Clearance check against all already placed obstacles (minimum 3.5m clearance)
    const CLEARANCE = 3.5;
    let safe = true;
    for (const existing of Object.values(obs)) {
      const minX = existing.x - existing.width / 2 - width / 2 - CLEARANCE;
      const maxX = existing.x + existing.width / 2 + width / 2 + CLEARANCE;
      const minZ = existing.z - existing.depth / 2 - depth / 2 - CLEARANCE;
      const maxZ = existing.z + existing.depth / 2 + depth / 2 + CLEARANCE;
      if (rx >= minX && rx <= maxX && rz >= minZ && rz <= maxZ) {
        safe = false;
        break;
      }
    }

    if (safe) {
      addObs(rx, rz, width, depth, height, type, col);
      placedCount++;
    }
  }

  // 9. PERIMETER BOUNDARY BASTIONS (Outer Arena Defensive Ring with 16 Bastions)
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    const px = Math.cos(angle) * 92;
    const pz = Math.sin(angle) * 92;
    addObs(px, pz, 6, 6, 18, 'pillar', '#0f172a');
    addObs(px * 0.94, pz * 0.94, 3.5, 3.5, 3.5, 'crate', '#d97706');
  }

  // Map Boundary Walls
  addObs(0, -198, 400, 4, 40, 'wall', '#1e293b'); // North boundary
  addObs(0, 198, 400, 4, 40, 'wall', '#1e293b');  // South boundary
  addObs(198, 0, 4, 400, 40, 'wall', '#1e293b');  // East boundary
  addObs(-198, 0, 4, 400, 40, 'wall', '#1e293b'); // West boundary

  return obs;
}

const BOT_NAMES = [
  'Alpha', 'Shadow', 'Phoenix', 'Titan', 'Viper', 'CyberBlade', 'Striker', 'Nova', 'Vortex', 'Zero',
  'Ghost', 'Reaper', 'Valkyrie', 'Apex', 'Blitz', 'Ronin', 'Phantom', 'Bullet', 'Goliath', 'Razor',
  'Falcon', 'Spectre', 'Havoc', 'Rogue', 'Venom', 'Eclipse', 'Thunder', 'Storm', 'Aero', 'Saber',
  'Nyx', 'Kage'
];

function findSafeSpawnPosition(obstacles: Record<string, Obstacle>, mapSize: number, margin = 4.0, roomId?: string): { x: number, z: number } {
  const range = mapSize * 0.70;
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidateX = (Math.random() - 0.5) * range;
    const candidateZ = (Math.random() - 0.5) * range;

    // Never spawn inside central citadel
    if (Math.hypot(candidateX, candidateZ) < 32) continue;

    let collides = false;
    if (obstacles) {
      // Check ground height
      if (getGroundHeight(candidateX, candidateZ, obstacles) > 0.1) {
        continue;
      }

      // Check nearby obstacles in 12m box
      const nearby = getNearbyObstacles(roomId, candidateX - margin - 2, candidateX + margin + 2, candidateZ - margin - 2, candidateZ + margin + 2, obstacles);
      for (let i = 0; i < nearby.length; i++) {
        const obs = nearby[i];
        if (candidateX >= obs.minX - margin && candidateX <= obs.maxX + margin &&
            candidateZ >= obs.minZ - margin && candidateZ <= obs.maxZ + margin) {
          collides = true;
          break;
        }
      }
    }
    if (!collides) {
      return { x: Math.round(candidateX * 10) / 10, z: Math.round(candidateZ * 10) / 10 };
    }
  }

  // Safe fallback to open perimeter
  const angle = Math.random() * Math.PI * 2;
  const dist = 70 + Math.random() * 40;
  return { x: Math.round(Math.cos(angle) * dist * 10) / 10, z: Math.round(Math.sin(angle) * dist * 10) / 10 };
}

interface SpatialObstacle extends Obstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  halfW: number;
  halfD: number;
}

interface RoomSpatialData {
  list: SpatialObstacle[];
  grid: Map<string, SpatialObstacle[]>;
}

const roomSpatialMap = new Map<string, RoomSpatialData>();
const SPATIAL_CELL = 40;

function buildRoomSpatialData(roomId: string, obstacles: Record<string, Obstacle>): RoomSpatialData {
  const list: SpatialObstacle[] = [];
  const grid = new Map<string, SpatialObstacle[]>();

  for (const obs of Object.values(obstacles)) {
    const halfW = obs.width / 2;
    const halfD = obs.depth / 2;
    const sObs: SpatialObstacle = {
      ...obs,
      halfW,
      halfD,
      minX: obs.x - halfW,
      maxX: obs.x + halfW,
      minZ: obs.z - halfD,
      maxZ: obs.z + halfD,
    };
    list.push(sObs);

    const startX = Math.floor((sObs.minX + MAP_SIZE / 2) / SPATIAL_CELL);
    const endX = Math.floor((sObs.maxX + MAP_SIZE / 2) / SPATIAL_CELL);
    const startZ = Math.floor((sObs.minZ + MAP_SIZE / 2) / SPATIAL_CELL);
    const endZ = Math.floor((sObs.maxZ + MAP_SIZE / 2) / SPATIAL_CELL);

    for (let cx = startX; cx <= endX; cx++) {
      for (let cz = startZ; cz <= endZ; cz++) {
        const key = `${cx},${cz}`;
        let cell = grid.get(key);
        if (!cell) {
          cell = [];
          grid.set(key, cell);
        }
        cell.push(sObs);
      }
    }
  }

  const data: RoomSpatialData = { list, grid };
  roomSpatialMap.set(roomId, data);
  return data;
}

function clearRoomSpatialData(roomId: string) {
  roomSpatialMap.delete(roomId);
  delete lastSentPlayerSnapshots[roomId];
}

function getNearbyObstacles(roomId: string | undefined, minX: number, maxX: number, minZ: number, maxZ: number, fallbackObstacles?: Record<string, Obstacle>): SpatialObstacle[] {
  if (!roomId || !roomSpatialMap.has(roomId)) {
    if (!fallbackObstacles) return [];
    return Object.values(fallbackObstacles).map(obs => ({
      ...obs,
      halfW: obs.width / 2,
      halfD: obs.depth / 2,
      minX: obs.x - obs.width / 2,
      maxX: obs.x + obs.width / 2,
      minZ: obs.z - obs.depth / 2,
      maxZ: obs.z + obs.depth / 2,
    }));
  }

  const data = roomSpatialMap.get(roomId)!;
  const startX = Math.floor((minX + MAP_SIZE / 2) / SPATIAL_CELL);
  const endX = Math.floor((maxX + MAP_SIZE / 2) / SPATIAL_CELL);
  const startZ = Math.floor((minZ + MAP_SIZE / 2) / SPATIAL_CELL);
  const endZ = Math.floor((maxZ + MAP_SIZE / 2) / SPATIAL_CELL);

  if (startX === endX && startZ === endZ) {
    return data.grid.get(`${startX},${startZ}`) || [];
  }

  const result: SpatialObstacle[] = [];
  const visited = new Set<string>();

  for (let cx = startX; cx <= endX; cx++) {
    for (let cz = startZ; cz <= endZ; cz++) {
      const cell = data.grid.get(`${cx},${cz}`);
      if (cell) {
        for (let i = 0; i < cell.length; i++) {
          const obs = cell[i];
          if (!visited.has(obs.id)) {
            visited.add(obs.id);
            result.push(obs);
          }
        }
      }
    }
  }

  return result;
}

const lastSentPlayerSnapshots: Record<string, Record<string, { x: number; y: number; z: number; ry: number; health: number; score: number; weaponLevel: number; heals: number; isDead: boolean; flags: string; team?: string; t: number }>> = {};

const roomItemsDirty: Record<string, boolean> = {};
const roomHadBombs: Record<string, boolean> = {};

function markItemsDirty(roomId: string) {
  roomItemsDirty[roomId] = true;
}

function createDynamicState(room: GameState, isDeltaTick = false) {
  const roomId = room.roomId;
  if (!lastSentPlayerSnapshots[roomId]) {
    lastSentPlayerSnapshots[roomId] = {};
  }
  const roomSnaps = lastSentPlayerSnapshots[roomId];
  const activePlayerIds = Object.keys(room.players);
  const now = Date.now();

  // Ultra-compressed player payload with per-player position & state delta filtering (saves 85-90% downstream bandwidth)
  const compressedPlayers: Record<string, any> = {};
  for (const pid of activePlayerIds) {
    const p = room.players[pid];
    const roundedX = Math.round(p.x * 10) / 10;
    const roundedY = Math.round(p.y * 10) / 10;
    const roundedZ = Math.round(p.z * 10) / 10;
    const roundedRy = Math.round(p.ry * 100) / 100;
    const roundedHp = Math.round(p.health);

    const flagsStr = `${p.isRolling ? 1 : 0}${p.isFlying ? 1 : 0}${p.hasShield ? 1 : 0}${p.isInvulnerable ? 1 : 0}${p.inBus ? 1 : 0}${p.isSkydiving ? 1 : 0}${p.isGliding ? 1 : 0}${p.isHealing ? 1 : 0}`;

    const prev = roomSnaps[pid];
    const moved = !prev || Math.abs(roundedX - prev.x) >= 0.15 || Math.abs(roundedY - prev.y) >= 0.15 || Math.abs(roundedZ - prev.z) >= 0.15 || Math.abs(roundedRy - prev.ry) >= 0.08;
    const statusChanged = !prev || prev.health !== roundedHp || prev.score !== p.score || prev.weaponLevel !== p.weaponLevel || prev.heals !== p.heals || prev.isDead !== p.isDead || prev.flags !== flagsStr || prev.team !== p.team;
    const heartbeatNeeded = prev && (now - prev.t > 2500);

    if (!isDeltaTick || moved || statusChanged || heartbeatNeeded) {
      roomSnaps[pid] = {
        x: roundedX,
        y: roundedY,
        z: roundedZ,
        ry: roundedRy,
        health: roundedHp,
        score: p.score,
        weaponLevel: p.weaponLevel,
        heals: p.heals,
        isDead: p.isDead,
        flags: flagsStr,
        team: p.team,
        t: now,
      };

      const baseP: any = {
        id: p.id,
        x: roundedX,
        y: roundedY,
        z: roundedZ,
        ry: roundedRy,
        health: roundedHp,
        isDead: p.isDead,
        score: p.score,
        weaponLevel: p.weaponLevel,
        heals: p.heals,
      };

      if (p.isRolling) baseP.isRolling = true;
      if (p.isFlying) baseP.isFlying = true;
      if (p.hasShield) baseP.hasShield = true;
      if (p.isInvulnerable) baseP.isInvulnerable = true;
      if (p.inBus) baseP.inBus = true;
      if (p.isSkydiving) baseP.isSkydiving = true;
      if (p.isGliding) baseP.isGliding = true;
      if (p.isHealing) {
        baseP.isHealing = true;
        baseP.healProgress = p.healProgress ? Math.round(p.healProgress * 10) / 10 : 0;
      }

      if (!isDeltaTick || !prev || prev.team !== p.team) {
        baseP.maxHealth = p.maxHealth;
        baseP.name = p.name;
        baseP.team = p.team;
        baseP.color = p.color;
        baseP.characterClass = p.characterClass;
        baseP.isBot = p.isBot;
      }

      compressedPlayers[pid] = baseP;
    }
  }

  // Clean up snapshots for players that left
  for (const pid in roomSnaps) {
    if (!room.players[pid]) {
      delete roomSnaps[pid];
    }
  }

  // Handle bombs: only include payload when bombs exist, or send empty once when just extinguished
  const bombCount = Object.keys(room.bombs).length;
  let bombsPayload: Record<string, any> | undefined = undefined;
  if (bombCount > 0) {
    bombsPayload = {};
    for (const bid in room.bombs) {
      const b = room.bombs[bid];
      bombsPayload[bid] = {
        id: b.id,
        x: Math.round(b.x * 10) / 10,
        y: Math.round(b.y * 10) / 10,
        z: Math.round(b.z * 10) / 10,
        exploded: b.exploded,
        isMine: b.isMine,
      };
    }
    roomHadBombs[roomId] = true;
  } else if (roomHadBombs[roomId]) {
    bombsPayload = {};
    roomHadBombs[roomId] = false;
  }

  // Handle items: on delta ticks, only send items when a change occurred (spawn/pickup)
  let itemsPayload: Record<string, ItemState> | undefined = undefined;
  if (!isDeltaTick || roomItemsDirty[roomId]) {
    itemsPayload = room.items;
    roomItemsDirty[roomId] = false;
  }

  // Total connected human players across all rooms
  let totalOnlineHumanCount = 0;
  for (const r of Object.values(rooms)) {
    for (const p of Object.values(r.players)) {
      if (!p.isBot) totalOnlineHumanCount++;
    }
  }

  return {
    roomId: room.roomId,
    mode: room.mode,
    status: room.status,
    matchTimer: Math.round(room.matchTimer * 10) / 10,
    winner: room.winner,
    totalOnlineCount: Math.max(1, totalOnlineHumanCount),
    activePlayerIds,
    players: compressedPlayers,
    items: itemsPayload,
    bombs: bombsPayload,
    battleBus: room.battleBus ? {
      active: room.battleBus.active,
      startX: Math.round(room.battleBus.startX * 10) / 10,
      startZ: Math.round(room.battleBus.startZ * 10) / 10,
      endX: Math.round(room.battleBus.endX * 10) / 10,
      endZ: Math.round(room.battleBus.endZ * 10) / 10,
      currentX: Math.round(room.battleBus.currentX * 10) / 10,
      currentY: Math.round(room.battleBus.currentY * 10) / 10,
      currentZ: Math.round(room.battleBus.currentZ * 10) / 10,
      progress: Math.round(room.battleBus.progress * 100) / 100,
      duration: room.battleBus.duration,
      timeLeft: Math.round(room.battleBus.timeLeft * 10) / 10,
    } : undefined,
  };
}

function broadcastRoomState(io: Server, room: GameState, isDeltaTick = false) {
  const dynamicState = createDynamicState(room, isDeltaTick);
  const roomId = room.roomId;

  const humanPlayers = Object.values(room.players).filter((p) => !p.isBot);
  if (humanPlayers.length === 0) return;

  // In lobby ('waiting') or match finished ('ended'), send full room dynamic update
  if (room.status !== 'playing') {
    io.to(roomId).emit('stateUpdate', dynamicState);
    return;
  }

  const AOI_RADIUS = 280;

  for (const human of humanPlayers) {
    let fx = human.x;
    let fz = human.z;

    // Only center on battle bus if this player is actually inside the bus
    if (human.inBus && room.battleBus) {
      fx = room.battleBus.currentX;
      fz = room.battleBus.currentZ;
    }

    const filteredPlayers: Record<string, any> = {};
    const effectiveRadius = human.isDead ? 360 : AOI_RADIUS;

    for (const pid in dynamicState.players) {
      if (pid === human.id) {
        filteredPlayers[pid] = dynamicState.players[pid];
        continue;
      }
      const p = dynamicState.players[pid];
      // Always broadcast players who are skydiving, gliding, in bus, or flying with jetpack so they never freeze in mid-air
      const isAerial = p.isSkydiving || p.isGliding || p.inBus || p.isFlying;
      if (isAerial || (Math.abs(p.x - fx) <= effectiveRadius && Math.abs(p.z - fz) <= effectiveRadius)) {
        filteredPlayers[pid] = p;
      }
    }

    io.to(human.id).emit('stateUpdate', {
      ...dynamicState,
      players: filteredPlayers,
    });
  }
}

function dePenetrateObstacles(entity: { x: number, y?: number, z: number }, obstacles: Record<string, Obstacle>, radius = 0.95, roomId?: string) {
  const nearby = getNearbyObstacles(roomId, entity.x - radius - 2, entity.x + radius + 2, entity.z - radius - 2, entity.z + radius + 2, obstacles);
  const footY = entity.y !== undefined ? entity.y - 1.0 : getGroundHeight(entity.x, entity.z, obstacles);
  const currentGroundH = getGroundHeight(entity.x, entity.z, obstacles);

  for (let i = 0; i < nearby.length; i++) {
    const obs = nearby[i];
    if (obs.type === 'ramp') continue;
    // Walkable if player is on ground height atop/near obstacle, or if stepping up onto a climbable ledge (<= 2.2m)
    if (currentGroundH >= obs.height - 0.2 || footY >= obs.height - 2.2) continue;

    const halfW = obs.halfW + radius;
    const halfD = obs.halfD + radius;
    const dx = entity.x - obs.x;
    const dz = entity.z - obs.z;

    if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
      const overlapX = halfW - Math.abs(dx);
      const overlapZ = halfD - Math.abs(dz);

      if (overlapX < overlapZ) {
        entity.x = obs.x + (dx >= 0 ? halfW + 0.05 : -halfW - 0.05);
      } else {
        entity.z = obs.z + (dz >= 0 ? halfD + 0.05 : -halfD - 0.05);
      }
    }
  }
}

function spawnBotsForRoom(room: GameState, count = 12) {
  const classes: CharacterClass[] = ['melee', 'sword', 'tank', 'scout'];
  const isTeamMode = room.mode === 'team';

  for (let i = 0; i < count; i++) {
    const botId = `bot_${i + 1}_${Math.random().toString(36).substring(2, 6)}`;
    const botClass = classes[i % classes.length];
    const stats = CLASS_STATS[botClass];
    const botTeam: 'red' | 'blue' | undefined = isTeamMode ? (i % 2 === 0 ? 'red' : 'blue') : undefined;
    const botColor = isTeamMode ? (botTeam === 'red' ? '#ef4444' : '#3b82f6') : stats.color;
    const tag = isTeamMode ? (botTeam === 'red' ? '[RED]' : '[BLUE]') : '[BOT]';
    const name = `${tag} ${BOT_NAMES[i % BOT_NAMES.length]}`;
    const pos = findSafeSpawnPosition(room.obstacles, MAP_SIZE, 3.5, room.roomId);
    const botRating = 400 + Math.floor(Math.random() * 1200);

    room.players[botId] = {
      id: botId,
      name,
      isBot: true,
      characterClass: botClass,
      team: botTeam,
      x: pos.x,
      y: 1,
      z: pos.z,
      ry: Math.random() * Math.PI * 2,
      health: stats.maxHp,
      maxHealth: stats.maxHp,
      isDead: false,
      score: 0,
      color: botColor,
      lastShootTime: 0,
      heals: Math.floor(Math.random() * 2) + 1,
      isHealing: false,
      healProgress: 0,
      weaponLevel: Math.random() < 0.35 ? 2 : 1,
      lastAbilityTime: 0,
      isFlying: false,
      isInvulnerable: false,
      hasShield: false,
      rating: botRating,
      rankName: getRankName(botRating),
    };
  }
}

function checkObstacleCollision(x: number, z: number, obstacles: Record<string, Obstacle>, roomId?: string, y?: number): boolean {
  const RADIUS = 0.95;
  const nearby = getNearbyObstacles(roomId, x - 2, x + 2, z - 2, z + 2, obstacles);
  const footY = y !== undefined ? y - 1.0 : getGroundHeight(x, z, obstacles);

  for (let i = 0; i < nearby.length; i++) {
    const obs = nearby[i];
    if (obs.type === 'ramp') continue;
    if (footY >= obs.height - 0.25) continue;

    if (x >= obs.minX - RADIUS && x <= obs.maxX + RADIUS && z >= obs.minZ - RADIUS && z <= obs.maxZ + RADIUS) {
      return true;
    }
  }
  return false;
}

// Check if direct 3D line of sight between (x1, y1, z1) and (x2, y2, z2) is blocked by any solid obstacle
function isLineBlockedByObstacles(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  obstacles: Record<string, Obstacle>,
  roomId?: string
): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minZ = Math.min(z1, z2);
  const maxZ = Math.max(z1, z2);

  const nearby = getNearbyObstacles(roomId, minX - 1, maxX + 1, minZ - 1, maxZ + 1, obstacles);
  if (nearby.length === 0) return false;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  const padding = 0.05;

  for (let i = 0; i < nearby.length; i++) {
    const obs = nearby[i];
    if (obs.type === 'ramp') continue; // Ramps don't block shots

    const oMinX = obs.minX - padding;
    const oMaxX = obs.maxX + padding;
    const oMinY = 0;
    const oMaxY = obs.height;
    const oMinZ = obs.minZ - padding;
    const oMaxZ = obs.maxZ + padding;

    // Fast 2D horizontal rejection
    if (maxX < oMinX || minX > oMaxX || maxZ < oMinZ || minZ > oMaxZ) {
      continue;
    }

    // Fast vertical rejection: entire ray is above the obstacle
    const rayMinY = Math.min(y1, y2);
    if (rayMinY >= oMaxY - 0.1) {
      continue;
    }

    // 3D Liang-Barsky / Slab method against 3D AABB
    let tmin = 0;
    let tmax = 1;

    // X Axis
    if (Math.abs(dx) > 1e-6) {
      const t1 = (oMinX - x1) / dx;
      const t2 = (oMaxX - x1) / dx;
      const tNear = Math.min(t1, t2);
      const tFar = Math.max(t1, t2);
      tmin = Math.max(tmin, tNear);
      tmax = Math.min(tmax, tFar);
      if (tmin > tmax) continue;
    } else {
      if (x1 < oMinX || x1 > oMaxX) continue;
    }

    // Y Axis (Height check)
    if (Math.abs(dy) > 1e-6) {
      const t1 = (oMinY - y1) / dy;
      const t2 = (oMaxY - y1) / dy;
      const tNear = Math.min(t1, t2);
      const tFar = Math.max(t1, t2);
      tmin = Math.max(tmin, tNear);
      tmax = Math.min(tmax, tFar);
      if (tmin > tmax) continue;
    } else {
      if (y1 < oMinY || y1 > oMaxY) continue;
    }

    // Z Axis
    if (Math.abs(dz) > 1e-6) {
      const t1 = (oMinZ - z1) / dz;
      const t2 = (oMaxZ - z1) / dz;
      const tNear = Math.min(t1, t2);
      const tFar = Math.max(t1, t2);
      tmin = Math.max(tmin, tNear);
      tmax = Math.min(tmax, tFar);
      if (tmin > tmax) continue;
    } else {
      if (z1 < oMinZ || z1 > oMaxZ) continue;
    }

    // Hit test: does ray penetrate inside the obstacle body between shooter and target?
    if (tmin < tmax && tmin < 0.95 && tmax > 0.05) {
      return true; // Wall blocks bullet/slash trajectory
    }
  }
  return false;
}

// Find a tactical cover point behind an obstacle away from an enemy
function findCoverPosition(botX: number, botZ: number, enemyX: number, enemyZ: number, obstacles: Record<string, Obstacle>, roomId?: string): { x: number, z: number } | null {
  const nearby = getNearbyObstacles(roomId, botX - 25, botX + 25, botZ - 25, botZ + 25, obstacles);
  let bestPos: { x: number, z: number } | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < nearby.length; i++) {
    const obs = nearby[i];
    const edx = obs.x - enemyX;
    const edz = obs.z - enemyZ;
    const elen = Math.hypot(edx, edz) || 1;

    // Position behind the obstacle (away from enemy line of fire)
    const coverMargin = Math.max(obs.halfW, obs.halfD) + 2.0;
    const cx = obs.x + (edx / elen) * coverMargin;
    const cz = obs.z + (edz / elen) * coverMargin;

    if (Math.abs(cx) > MAP_SIZE / 2 - 5 || Math.abs(cz) > MAP_SIZE / 2 - 5) continue;

    // Check if line of sight from enemy to this cover spot is safely blocked
    if (isLineBlockedByObstacles(enemyX, 1.2, enemyZ, cx, 1.2, cz, obstacles, roomId)) {
      const dToCover = Math.hypot(cx - botX, cz - botZ);
      if (dToCover < bestDist) {
        bestDist = dToCover;
        bestPos = { x: cx, z: cz };
      }
    }
  }

  return bestPos;
}

// Find a bypass waypoint around an obstacle that is blocking direct travel
function findSafeBypassPoint(fromX: number, fromZ: number, toX: number, toZ: number, obstacles: Record<string, Obstacle>, roomId?: string): { x: number, z: number } | null {
  const minX = Math.min(fromX, toX);
  const maxX = Math.max(fromX, toX);
  const minZ = Math.min(fromZ, toZ);
  const maxZ = Math.max(fromZ, toZ);
  const nearby = getNearbyObstacles(roomId, minX - 4, maxX + 4, minZ - 4, maxZ + 4, obstacles);
  if (nearby.length === 0) return null;

  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const dist = Math.hypot(dx, dz) || 1;

  for (let i = 0; i < nearby.length; i++) {
    const obs = nearby[i];
    const toObsX = obs.x - fromX;
    const toObsZ = obs.z - fromZ;
    const dot = (toObsX * dx + toObsZ * dz) / dist;
    if (dot > 0 && dot < dist) {
      const projX = fromX + (dx / dist) * dot;
      const projZ = fromZ + (dz / dist) * dot;
      const perpDist = Math.hypot(obs.x - projX, obs.z - projZ);
      const safeRadius = Math.max(obs.halfW, obs.halfD) + 2.2;

      if (perpDist < safeRadius) {
        // Choose corner that yields the shortest bypass distance
        const signX = (fromX < obs.x) ? -1 : 1;
        const signZ = (fromZ < obs.z) ? -1 : 1;
        const corner1 = { x: obs.x + signX * (obs.halfW + 2.5), z: obs.z - signZ * (obs.halfD + 2.5) };
        const corner2 = { x: obs.x - signX * (obs.halfW + 2.5), z: obs.z + signZ * (obs.halfD + 2.5) };

        const d1 = Math.hypot(corner1.x - fromX, corner1.z - fromZ) + Math.hypot(toX - corner1.x, toZ - corner1.z);
        const d2 = Math.hypot(corner2.x - fromX, corner2.z - corner2.z) + Math.hypot(toX - corner2.x, toZ - corner2.z);

        return d1 < d2 ? corner1 : corner2;
      }
    }
  }
  return null;
}

// Intelligent tactical flanking around obstacles when bot has sufficient HP
function findFlankingPoint(
  botX: number, botZ: number,
  enemyX: number, enemyZ: number,
  obstacles: Record<string, Obstacle>,
  roomId?: string
): { x: number, z: number } | null {
  const minX = Math.min(botX, enemyX) - 6;
  const maxX = Math.max(botX, enemyX) + 6;
  const minZ = Math.min(botZ, enemyZ) - 6;
  const maxZ = Math.max(botZ, enemyZ) + 6;
  const nearby = getNearbyObstacles(roomId, minX, maxX, minZ, maxZ, obstacles);
  if (nearby.length === 0) return null;

  const dx = enemyX - botX;
  const dz = enemyZ - botZ;
  const dist = Math.hypot(dx, dz) || 1;
  const nx = dx / dist; // Forward direction towards enemy
  const nz = dz / dist;
  // Perpendicular directions (Left and Right)
  const perpX = -nz;
  const perpZ = nx;

  let blockingObs: SpatialObstacle | null = null;
  let closestObsDist = Infinity;

  for (let i = 0; i < nearby.length; i++) {
    const obs = nearby[i];
    if (obs.type === 'ramp') continue;
    const toObsX = obs.x - botX;
    const toObsZ = obs.z - botZ;
    const dot = toObsX * nx + toObsZ * nz;

    // Obstacle is in between bot and enemy
    if (dot > 0.5 && dot < dist - 0.5) {
      const projX = botX + nx * dot;
      const projZ = botZ + nz * dot;
      const perpDist = Math.hypot(obs.x - projX, obs.z - projZ);
      const safeRadius = Math.max(obs.halfW, obs.halfD) + 1.8;

      if (perpDist < safeRadius && dot < closestObsDist) {
        closestObsDist = dot;
        blockingObs = obs;
      }
    }
  }

  if (!blockingObs) return null;

  // Compute flanking clearance margin: enough distance to step completely clear of the obstacle
  const clearance = Math.max(blockingObs.halfW, blockingObs.halfD) + 3.2;

  // Check left and right flank candidates
  const candLeft = {
    x: blockingObs.x + perpX * clearance,
    z: blockingObs.z + perpZ * clearance,
  };
  const candRight = {
    x: blockingObs.x - perpX * clearance,
    z: blockingObs.z - perpZ * clearance,
  };

  // Additional forward-angled flank points (cutting towards enemy's flank)
  const forwardAngledLeft = {
    x: blockingObs.x + perpX * (clearance * 0.9) + nx * 2.5,
    z: blockingObs.z + perpZ * (clearance * 0.9) + nz * 2.5,
  };
  const forwardAngledRight = {
    x: blockingObs.x - perpX * (clearance * 0.9) + nx * 2.5,
    z: blockingObs.z - perpZ * (clearance * 0.9) + nz * 2.5,
  };

  const candidates = [forwardAngledLeft, forwardAngledRight, candLeft, candRight];
  let bestPoint: { x: number, z: number } | null = null;
  let bestScore = Infinity;

  for (const cand of candidates) {
    if (Math.abs(cand.x) > MAP_SIZE / 2 - 4 || Math.abs(cand.z) > MAP_SIZE / 2 - 4) continue;
    // Don't choose point inside another obstacle
    if (checkObstacleCollision(cand.x, cand.z, obstacles, roomId)) continue;

    const dBot = Math.hypot(cand.x - botX, cand.z - botZ);
    const dEnemy = Math.hypot(enemyX - cand.x, enemyZ - cand.z);

    // Direct line of sight from flank waypoint to enemy
    const hasSight = !isLineBlockedByObstacles(cand.x, 1.2, cand.z, enemyX, 1.2, enemyZ, obstacles, roomId);

    let score = dBot + dEnemy * 0.4;
    if (hasSight) {
      score -= 30; // Strong bonus for opening up a clear firing angle
    }

    if (score < bestScore) {
      bestScore = score;
      bestPoint = cand;
    }
  }

  return bestPoint;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', rooms: Object.keys(rooms).length });
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join', (options: {
      mode: 'casual' | 'ranked' | 'password' | 'team' | 'bot' | 'p2p_duel',
      password?: string,
      characterClass?: CharacterClass,
      rating?: number,
      botCount?: number,
      team?: 'red' | 'blue' | 'auto',
      teamMatchType?: 'pvp' | 'bot',
      playerName?: string,
      p2pRoomId?: string,
    }) => {
      let roomId = null;
      const charClass = options.characterClass || 'melee';
      const stats = CLASS_STATS[charClass];
      const rating = options.rating || 0;
      const teamMatchType = options.teamMatchType || 'pvp';
      const displayName = (options.playerName || '').trim().slice(0, 16) || `Player_${socket.id.substring(0, 4)}`;

      if (options.mode === 'p2p_duel') {
        roomId = options.p2pRoomId || 'p2p_' + socket.id.substring(0, 6);
      } else if (options.mode === 'bot') {
        roomId = 'bot_' + socket.id.substring(0, 6) + '_' + Math.random().toString(36).substring(2, 6);
      } else if (options.mode === 'casual') {
        const available = Object.values(rooms).find(r => r.mode === 'casual' && r.status === 'waiting' && Object.keys(r.players).length < 99);
        if (available) roomId = available.roomId;
      } else if (options.mode === 'team') {
        if (teamMatchType === 'bot') {
          // Dedicated solo bot practice room
          roomId = 'team_bot_' + socket.id.substring(0, 6) + '_' + Math.random().toString(36).substring(2, 6);
        } else {
          // Online PvP matchmaking: prioritize rooms with real human players!
          const availableRooms = Object.values(rooms).filter(r =>
            r.mode === 'team' &&
            !r.roomId.startsWith('team_bot_') &&
            r.status !== 'ended' &&
            Object.keys(r.players).length < 40
          );

          // Find rooms with real human players
          const roomsWithHumans = availableRooms.filter(r =>
            Object.values(r.players).some(p => !p.isBot)
          );

          if (roomsWithHumans.length > 0) {
            // Sort: waiting rooms first, then by human count descending
            roomsWithHumans.sort((a, b) => {
              if (a.status === 'waiting' && b.status !== 'waiting') return -1;
              if (b.status === 'waiting' && a.status !== 'waiting') return 1;
              const humanA = Object.values(a.players).filter(p => !p.isBot).length;
              const humanB = Object.values(b.players).filter(p => !p.isBot).length;
              return humanB - humanA;
            });
            roomId = roomsWithHumans[0].roomId;
          } else if (availableRooms.length > 0) {
            // No humans yet: pick any waiting room first
            const waiting = availableRooms.find(r => r.status === 'waiting');
            roomId = waiting ? waiting.roomId : availableRooms[0].roomId;
          }
        }
      } else if (options.mode === 'ranked') {
        // Find best match ranked room: prioritize waiting rooms within rating bracket, or fallback to any waiting ranked room
        const availableRooms = Object.values(rooms).filter(r => r.mode === 'ranked' && r.status === 'waiting' && Object.keys(r.players).length < 50);
        let bestRoom = null;
        let closestDiff = Infinity;
        for (const r of availableRooms) {
          const players = Object.values(r.players);
          if (players.length === 0) {
            bestRoom = r;
            break;
          }
          const avgRating = players.reduce((sum, p) => sum + (p.rating || 0), 0) / players.length;
          const diff = Math.abs(avgRating - rating);
          if (diff <= 150) {
            bestRoom = r;
            break;
          }
          if (diff < closestDiff) {
            closestDiff = diff;
            bestRoom = r;
          }
        }
        if (bestRoom) {
          roomId = bestRoom.roomId;
        }
      } else if (options.mode === 'password') {
        const pass = (options.password || '').trim();
        const available = Object.values(rooms).find(r => r.mode === 'password' && (r.password || '').trim() === pass && r.status === 'waiting' && Object.keys(r.players).length < 99);
        if (available) {
          roomId = available.roomId;
        } else {
          // If no waiting room with this password exists, create deterministic/shared room ID for this password
          roomId = 'room_pw_' + encodeURIComponent(pass || 'default');
        }
      }

      if (!roomId) {
        roomId = Math.random().toString(36).substring(2, 9);
      }

      if (!rooms[roomId]) {
        const obstacles = generateObstacles();
        const initialTimer = options.mode === 'bot' || options.mode === 'p2p_duel' || (options.mode === 'team' && teamMatchType === 'bot')
          ? 2
          : options.mode === 'team'
            ? 10
            : options.mode === 'ranked'
              ? 30
              : 10;

        rooms[roomId] = {
          roomId,
          mode: options.mode,
          password: options.password,
          players: {},
          items: {},
          bombs: {},
          obstacles,
          status: 'waiting',
          matchTimer: initialTimer,
          winner: null
        };
        buildRoomSpatialData(roomId, obstacles);

        if (options.mode === 'bot' || (options.mode === 'team' && teamMatchType === 'bot')) {
          const count = Math.min(99, Math.max(1, typeof options.botCount === 'number' ? options.botCount : 15));
          spawnBotsForRoom(rooms[roomId], count);
        } else if (options.mode === 'team') {
          // In team battle, populate room with balanced bots (e.g. 14 bots: 7 Red, 7 Blue)
          const requested = typeof options.botCount === 'number' ? options.botCount : 14;
          const count = Math.min(60, Math.max(8, requested));
          const balancedCount = count % 2 === 0 ? count : count + 1;
          spawnBotsForRoom(rooms[roomId], balancedCount);
        }
      }

      const room = rooms[roomId];
      socketRoom[socket.id] = roomId;
      socket.join(roomId);

      const spawnPos = findSafeSpawnPosition(room.obstacles, MAP_SIZE, 3.5, roomId);

      // Determine human team & color in team mode
      let assignedTeam: 'red' | 'blue' | undefined = undefined;
      let assignedColor = stats.color;

      if (room.mode === 'team') {
        const humanRed = Object.values(room.players).filter(p => !p.isBot && p.team === 'red').length;
        const humanBlue = Object.values(room.players).filter(p => !p.isBot && p.team === 'blue').length;
        const totalRed = Object.values(room.players).filter(p => p.team === 'red').length;
        const totalBlue = Object.values(room.players).filter(p => p.team === 'blue').length;

        if (options.team === 'red' || options.team === 'blue') {
          assignedTeam = options.team;
          // Balance the other team if this choice tips the balance
          if (assignedTeam === 'red' && totalRed > totalBlue) {
            const botToSwap = Object.values(room.players).find(p => p.isBot && p.team === 'red');
            if (botToSwap) {
              botToSwap.team = 'blue';
              botToSwap.color = '#3b82f6';
              botToSwap.name = botToSwap.name.replace('[RED]', '[BLUE]');
            }
          } else if (assignedTeam === 'blue' && totalBlue > totalRed) {
            const botToSwap = Object.values(room.players).find(p => p.isBot && p.team === 'blue');
            if (botToSwap) {
              botToSwap.team = 'red';
              botToSwap.color = '#ef4444';
              botToSwap.name = botToSwap.name.replace('[BLUE]', '[RED]');
            }
          }
        } else {
          // Auto-balance prioritizing Human vs Human PvP!
          if (humanRed < humanBlue) {
            assignedTeam = 'red';
          } else if (humanBlue < humanRed) {
            assignedTeam = 'blue';
          } else {
            // Equal humans: assign to team with fewer total members
            assignedTeam = totalRed <= totalBlue ? 'red' : 'blue';
          }
        }
        assignedColor = assignedTeam === 'red' ? '#ef4444' : '#3b82f6';

        // When a real human joins in online PvP, replace a bot on that team to keep total balanced
        if (teamMatchType !== 'bot') {
          const botToReplace = Object.values(room.players).find(p => p.isBot && p.team === assignedTeam);
          if (botToReplace) {
            delete room.players[botToReplace.id];
          } else {
            const anyBot = Object.values(room.players).find(p => p.isBot);
            if (anyBot && Math.abs(totalRed - totalBlue) > 0) {
              delete room.players[anyBot.id];
            }
          }
        }

        // If another human joined a waiting room, accelerate countdown to 3s
        if (room.status === 'waiting') {
          const humanCount = Object.values(room.players).filter(p => !p.isBot).length + 1;
          if (humanCount >= 2 && room.matchTimer > 3) {
            room.matchTimer = 3;
          }
        }
      }

      const isRoomPlaying = room.status === 'playing';
      const isBusActive = isRoomPlaying && !!(room.battleBus && room.battleBus.active);

      room.players[socket.id] = {
        id: socket.id,
        name: displayName,
        isBot: false,
        characterClass: charClass,
        team: assignedTeam,
        x: isBusActive ? (room.battleBus?.currentX || spawnPos.x) : spawnPos.x,
        y: isBusActive ? BUS_HEIGHT : 1,
        z: isBusActive ? (room.battleBus?.currentZ || spawnPos.z) : spawnPos.z,
        ry: 0,
        health: stats.maxHp,
        maxHealth: stats.maxHp,
        isDead: false,
        score: 0,
        color: assignedColor,
        lastShootTime: 0,
        heals: 0,
        isHealing: false,
        healProgress: 0,
        weaponLevel: 1,
        lastAbilityTime: 0,
        isFlying: false,
        isInvulnerable: isRoomPlaying && !isBusActive, // Spawn invulnerability if dropping in mid-battle
        hasShield: false,
        inBus: isBusActive,
        isSkydiving: false,
        isGliding: false,
        lastDamagedTime: isRoomPlaying && !isBusActive ? Date.now() + 3000 : 0,
        rating: rating,
        rankName: getRankName(rating),
      };

      socket.emit('init', { id: socket.id, state: room });
      broadcastRoomState(io, room);
    });

    socket.on('input', (input: ClientInput) => {
      const roomId = socketRoom[socket.id];
      if (!roomId) return;
      const room = rooms[roomId];
      const player = room.players[socket.id];
      
      if (!player || player.isDead || room.status !== 'playing') return;

      // Handle Battle Bus ejection
      if (player.inBus) {
        if (input.jumpFromBus || (room.battleBus && !room.battleBus.active)) {
          player.inBus = false;
          player.isSkydiving = true;
          player.isGliding = false;
        } else {
          return; // Player is waiting inside the bus
        }
      }

      player.x = Math.round(input.x * 10) / 10;
      player.y = Math.round(input.y * 10) / 10;
      player.z = Math.round(input.z * 10) / 10;
      player.ry = Math.round(input.ry * 100) / 100;

      // Handle Skydiving / Glider states and airborne redeployment from cliffs/ledges
      if (!player.inBus && !player.isDead) {
        const groundH = getGroundHeight(player.x, player.z, room.obstacles, player.y);
        const isAirborne = player.y > groundH + 3.2;

        if (input.toggleGlider) {
          const now = Date.now();
          if (!(player as any).lastGliderToggle || now - (player as any).lastGliderToggle > 250) {
            (player as any).lastGliderToggle = now;
            if (player.isSkydiving || player.isGliding) {
              player.isGliding = !player.isGliding;
              player.isSkydiving = !player.isGliding;
            } else if (isAirborne) {
              player.isGliding = true;
              player.isSkydiving = false;
            }
          }
        }

        if (player.isSkydiving || player.isGliding) {
          if (player.y <= groundH + 1.2) {
            player.y = groundH + 1;
            player.isSkydiving = false;
            player.isGliding = false;
          }
        }
      }

      // Keep human player strictly un-stuck from any obstacle
      dePenetrateObstacles(player, room.obstacles, 1.0, roomId);

      const now = Date.now();

      // Handle Item Pickup
      for (const itemId in room.items) {
        const item = room.items[itemId];
        const dx = player.x - item.x;
        const dz = player.z - item.z;
        if (dx * dx + dz * dz < 9) { // 3 units radius
          if (item.type === 'heal') player.heals++;
          if (item.type === 'weapon') player.weaponLevel = Math.min(3, player.weaponLevel + 1);
          delete room.items[itemId];
          markItemsDirty(roomId);
        }
      }

      // Handle Continuous Healing
      if (input.isHealing && player.heals > 0 && player.health < player.maxHealth) {
        if (!player.isHealing) {
          player.isHealing = true;
          (player as any).currentHealAmount = 0; // track amount healed this press
        }
      } else {
        if (player.isHealing) {
          // Stopped healing (either max hp, released button, or no items)
          player.isHealing = false;
          player.heals = Math.max(0, player.heals - 1);
        }
      }

      // Track raw input for jump/roll button (used for Jetpack controls)
      const pExt = player as any;
      pExt.isHoldingJump = input.isRolling;

      // Handle Rolling / Dodge Roll (0.35s duration, 1.8s cooldown)
      if (input.isRolling && !player.isFlying && !player.isHealing) {
        if (!player.lastRollTime || now - player.lastRollTime > 1800) {
          player.lastRollTime = now;
          player.isRolling = true;
        }
      }
      if (player.isRolling && player.lastRollTime && now - player.lastRollTime > 350) {
        player.isRolling = false;
      }

      // Handle Abilities
      if (input.useAbility) {
        const ability = CLASS_ABILITIES[player.characterClass];
        const abilityCd = ability ? ability.cooldownMs : 8000;
        const abilityDuration = ability ? ability.durationMs : 0;
        if (now - player.lastAbilityTime > (abilityCd + abilityDuration)) {
          player.lastAbilityTime = now;
          if (player.characterClass === 'melee') {
            // Throw realistic hand grenade with parabolic arc & velocity
            const bombId = Math.random().toString(36).substring(2);
            const throwSpeed = 36;
            const throwVy = 13;
            const dirX = -Math.sin(player.ry);
            const dirZ = -Math.cos(player.ry);

            room.bombs[bombId] = {
              id: bombId,
              ownerId: player.id,
              x: player.x + dirX * 1.5,
              y: player.y + 0.2,
              z: player.z + dirZ * 1.5,
              vx: dirX * throwSpeed,
              vy: throwVy,
              vz: dirZ * throwSpeed,
              rx: Math.random() * Math.PI,
              rz: Math.random() * Math.PI,
              createdAt: now,
              exploded: false,
            };
          } else if (player.characterClass === 'sword') {
            player.isInvulnerable = true;
          } else if (player.characterClass === 'scout') {
            player.isFlying = true;
          } else if (player.characterClass === 'tank') {
            player.hasShield = true;
          }
        }
      }

      // Handle Ability 2
      if (input.useAbility2 && player.characterClass === 'scout') {
        const ability2 = { durationMs: 0, cooldownMs: 6000 };
        if (now - (player.lastAbility2Time || 0) > ability2.cooldownMs) {
          player.lastAbility2Time = now;
          // Drop proximity mine (using the bomb system with 0 velocity and 100 dmg)
          const bombId = 'mine_' + Math.random().toString(36).substring(2);
          room.bombs[bombId] = {
            id: bombId,
            ownerId: player.id,
            x: player.x,
            y: getGroundHeight(player.x, player.z, room.obstacles) + 0.1,
            z: player.z,
            vx: 0,
            vy: 0,
            vz: 0,
            rx: 0,
            rz: 0,
            createdAt: now + 50000, // Make it never explode automatically
            exploded: false,
            isMine: true, // Custom flag to trigger on proximity
          };
        }
      }

      // Handle Shooting (or Sword hitting)
      const stats = CLASS_STATS[player.characterClass];
      const isSword = player.characterClass === 'sword';
      const range = isSword ? 13 : SHOOT_RANGE;
      const weaponMultiplier = 1 + (player.weaponLevel - 1) * 0.12; // +12% per weapon level for balanced TTK
      const shootCooldown = Math.max(80, stats.cooldown - (player.weaponLevel - 1) * 15);
      
      // Allow shooting while flying (jetpack aerial combat), but stop if healing or actively rolling
      if (input.isShooting && !player.isRolling && !player.isHealing && now - player.lastShootTime > shootCooldown) {
        player.lastShootTime = now;
        
        let hitSomeone = false;
        let hitTargetId: string | null = null;
        let hitPos: { x: number; y: number; z: number } | null = null;

        // Attacker muzzle 3D origin
        const px = player.x;
        const py = player.y + 0.1; // Muzzle is at chest level, matching client
        const pz = player.z;

        // Calculate exact 3D fire vector from crosshair aimTarget or pitch
        let dirX = -Math.sin(player.ry);
        let dirY = 0;
        let dirZ = -Math.cos(player.ry);

        if (input.aimTarget) {
          const atx = input.aimTarget.x - px;
          const aty = input.aimTarget.y - py;
          const atz = input.aimTarget.z - pz;
          const atLen = Math.hypot(atx, aty, atz) || 1;
          dirX = atx / atLen;
          dirY = aty / atLen;
          dirZ = atz / atLen;
        } else if (input.pitch !== undefined) {
          const cosP = Math.cos(input.pitch);
          dirX = -Math.sin(player.ry) * cosP;
          dirY = -Math.sin(input.pitch);
          dirZ = -Math.cos(player.ry) * cosP;
        }

        for (const targetId in room.players) {
          if (targetId === socket.id) continue;
          const target = room.players[targetId];
          if (target.isDead || target.inBus || target.isSkydiving || target.isGliding || player.inBus || player.isSkydiving || player.isGliding) continue;
          
          // Target 3D center (capsule center is exact y)
          const tx = target.x;
          const ty = target.y || 1; // Fixed parallax: Center of capsule
          const tz = target.z;

          const dx = tx - px;
          const dy = ty - py;
          const dz = tz - pz;
          const dist3D = Math.hypot(dx, dy, dz);
          
          if (dist3D < range) {
            let isHit = false;

            if (isSword) {
              // MELEE SWORD:
              // 1. Must be close (<= 13m)
              // 2. Vertical tolerance up to 3.2m
              // 3. Must be in front (horizontal arc >= 0.40)
              if (Math.abs(dy) <= 3.2 && dist3D <= 13) {
                const horizDist = Math.hypot(dx, dz) || 1;
                const fx = -Math.sin(player.ry);
                const fz = -Math.cos(player.ry);
                const horizDot = fx * (dx / horizDist) + fz * (dz / horizDist);
                if (horizDot >= 0.40) {
                  isHit = true;
                }
              }
            } else {
              // RANGED GUNS (Blaster, Cannon, SMG):
              // Full-body capsule hit detection: checks if bullet intersects anywhere from head to toes!
              let directAimMatch = false;
              if (input.aimTarget) {
                // Check if client aim point aligns with target body capsule (feet ty - 1.2 to head ty + 1.2)
                const clampedAimY = Math.max(ty - 1.2, Math.min(ty + 1.2, input.aimTarget.y));
                const distToAimTarget = Math.hypot(tx - input.aimTarget.x, clampedAimY - input.aimTarget.y, tz - input.aimTarget.z);
                if (distToAimTarget <= 3.2) {
                  directAimMatch = true;
                }
              }

              // Fire ray calculation: use 3D vector derived directly from reticle aimTarget
              const pDirX = dirX;
              const pDirY = dirY;
              const pDirZ = dirZ;

              const dot3D = (pDirX * dx + pDirY * dy + pDirZ * dz) / (dist3D || 1);

              // Closest point on 3D ray to target
              const t = Math.max(0, Math.min(dist3D, pDirX * dx + pDirY * dy + pDirZ * dz));
              const closestX = px + pDirX * t;
              const closestY = py + pDirY * t;
              const closestZ = pz + pDirZ * t;

              // Whole-body capsule test: project onto player's vertical spine
              // Feet are at (ty - 1.2), Head is at (ty + 1.2)
              const clampedSpineY = Math.max(ty - 1.2, Math.min(ty + 1.2, closestY));
              const capsuleDist = Math.hypot(tx - closestX, clampedSpineY - closestY, tz - closestZ);

              // Hitting anywhere on the body (head, arms, torso, legs, feet) registers a confirmed hit!
              if (directAimMatch || (capsuleDist <= 2.2 && dot3D >= 0.60) || (dist3D < 3.5 && capsuleDist <= 2.6)) {
                isHit = true;
              }
            }

            if (isHit) {
              // Check if 3D trajectory is blocked by any obstacle wall
              if (isLineBlockedByObstacles(px, py, pz, tx, ty, tz, room.obstacles, roomId)) {
                continue; // Blocked by wall!
              }

              // Check if target is invulnerable, buffed, or in active dodge roll
              const isTargetDodge = target.isRolling || (target.lastRollTime && now - target.lastRollTime < 350);
              if (target.isInvulnerable || isTargetDodge) {
                continue;
              }

              // Cooldown buffer between damage hits (100ms) to prevent instantaneous melting
              if (target.lastDamagedTime && now - target.lastDamagedTime < 100) {
                continue;
              }

              if (room.mode === 'team' && target.team === player.team) continue;

              target.lastDamagedTime = now;
              const damageMult = target.hasShield ? 0.5 : 1;
              const damageAmount = Math.max(1, Math.round((stats.damage * weaponMultiplier) * damageMult));
              target.health -= damageAmount;
              hitSomeone = true;
              hitTargetId = targetId;
              hitPos = { x: target.x, y: target.y, z: target.z }; // Fix parallax

              // Tactical Bot reaction: register threat and perform reactive roll
              if (target.isBot) {
                const bExt = target as any;
                bExt.threatTargetId = player.id;
                bExt.threatExpireTime = now + 6500;
                if (!target.isRolling && (!target.lastRollTime || now - target.lastRollTime > 2000)) {
                  if (Math.random() < 0.7) {
                    target.isRolling = true;
                    target.lastRollTime = now;
                    bExt.rollEndTime = now + 380;
                  }
                }
              }
              
              io.to(targetId).emit('tookDamage', { attackerX: player.x, attackerZ: player.z });
              
              // Broadcast damage popup to all players in the room for visual clarity
              io.to(roomId).emit('damageDealt', {
                id: Math.random().toString(36).substring(2),
                targetId,
                attackerId: socket.id,
                x: target.x,
                y: target.y + 0.2, // Slightly above center for visual clearance
                z: target.z,
                amount: damageAmount,
                isSword,
              });

              if (target.health <= 0) {
                target.health = 0;
                target.isDead = true;
                player.score += 1;
                io.to(roomId).emit('playerDied', { id: targetId, killer: socket.id });
              }
            }
          }
        }

        // Broadcast attack visual event to all clients in the room
        io.to(roomId).emit('playerAttacked', {
          id: Math.random().toString(36).substring(2),
          attackerId: socket.id,
          characterClass: player.characterClass,
          x: player.x,
          y: player.y + 0.6,
          z: player.z,
          ry: player.ry,
          dirX,
          dirY,
          dirZ,
          targetPos: input.aimTarget,
          weaponLevel: player.weaponLevel,
          isSword,
          hitTargetId,
          hitPosition: hitPos,
        });

        if (hitSomeone) {
          socket.emit('hitConfirmed');
        }
      }
    });

    socket.on('respawn', () => {
      const roomId = socketRoom[socket.id];
      if (!roomId || !rooms[roomId]) return;
      const room = rooms[roomId];
      const player = room.players[socket.id];
      if (!player) return;

      // Allow in-match respawn in 'bot' and 'team' mode
      if (room.mode !== 'bot' && room.mode !== 'team') {
        return;
      }

      const stats = CLASS_STATS[player.characterClass];
      const safePos = findSafeSpawnPosition(room.obstacles, MAP_SIZE, 3.5, roomId);
      player.isDead = false;
      player.health = stats.maxHp;
      player.maxHealth = stats.maxHp;
      player.x = safePos.x;
      player.y = 1;
      player.z = safePos.z;
      player.heals = 0;
      player.weaponLevel = 1;
      player.isHealing = false;
      player.isFlying = false;
      player.isInvulnerable = false;
      player.hasShield = false;
      player.lastAbilityTime = 0;
      if (room.mode === 'team' && player.team) {
        player.color = player.team === 'red' ? '#ef4444' : '#3b82f6';
      }

      broadcastRoomState(io, room);
      socket.emit('respawned', { x: player.x, y: player.y, z: player.z });
    });

    socket.on('leaveRoom', () => {
      const roomId = socketRoom[socket.id];
      if (roomId && rooms[roomId]) {
        delete rooms[roomId].players[socket.id];
        
        const humanCount = Object.values(rooms[roomId].players).filter(p => !p.isBot).length;
        if (humanCount === 0) {
          delete rooms[roomId];
          clearRoomSpatialData(roomId);
        } else {
          broadcastRoomState(io, rooms[roomId]);
        }
      }
      delete socketRoom[socket.id];
    });

    // ==========================================
    // P2P SIGNALING & DIRECT FRIEND MATCH EVENTS
    // ==========================================
    socket.on('p2p_register_user', ({ userId }: { userId: string }) => {
      if (userId) {
        userSockets[userId] = socket.id;
      }
    });

    socket.on('p2p_invite', ({ targetUid, inviterName, inviterUid, p2pRoomId }: { targetUid: string; inviterName: string; inviterUid: string; p2pRoomId: string }) => {
      const targetSocketId = userSockets[targetUid];
      if (targetSocketId && io.sockets.sockets.get(targetSocketId)) {
        io.to(targetSocketId).emit('p2p_invite_received', {
          inviterUid,
          inviterName,
          p2pRoomId,
          inviterSocketId: socket.id,
        });
        socket.emit('p2p_invite_sent', { targetUid, success: true });
      } else {
        socket.emit('p2p_invite_sent', { targetUid, success: false, reason: 'フレンドがオフラインまたは離脱中です' });
      }
    });

    socket.on('p2p_accept', ({ inviterUid, p2pRoomId, acceptorUid, acceptorName }: { inviterUid: string; p2pRoomId: string; acceptorUid: string; acceptorName: string }) => {
      const inviterSocketId = userSockets[inviterUid];
      if (inviterSocketId) {
        io.to(inviterSocketId).emit('p2p_accepted', {
          p2pRoomId,
          acceptorUid,
          acceptorName,
          acceptorSocketId: socket.id,
        });
      }
    });

    socket.on('p2p_decline', ({ inviterUid, p2pRoomId, declinerName }: { inviterUid: string; p2pRoomId: string; declinerName: string }) => {
      const inviterSocketId = userSockets[inviterUid];
      if (inviterSocketId) {
        io.to(inviterSocketId).emit('p2p_declined', {
          p2pRoomId,
          declinerName,
        });
      }
    });

    socket.on('p2p_signal', ({ targetUid, targetSocketId, signal }: { targetUid?: string; targetSocketId?: string; signal: any }) => {
      const destSocketId = targetSocketId || (targetUid ? userSockets[targetUid] : null);
      if (destSocketId) {
        io.to(destSocketId).emit('p2p_signal_received', {
          senderSocketId: socket.id,
          signal,
        });
      }
    });

    socket.on('disconnect', () => {
      for (const uid in userSockets) {
        if (userSockets[uid] === socket.id) {
          delete userSockets[uid];
        }
      }

      const roomId = socketRoom[socket.id];
      if (roomId && rooms[roomId]) {
        delete rooms[roomId].players[socket.id];
        
        const humanCount = Object.values(rooms[roomId].players).filter(p => !p.isBot).length;
        if (humanCount === 0) {
          delete rooms[roomId];
          clearRoomSpatialData(roomId);
        } else {
          broadcastRoomState(io, rooms[roomId]);
        }
      }
      delete socketRoom[socket.id];
    });
  });

  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;

    for (const roomId in rooms) {
      const room = rooms[roomId];
      const humanCount = Object.values(room.players).filter(p => !p.isBot).length;
      if (humanCount === 0) {
        delete rooms[roomId];
        clearRoomSpatialData(roomId);
        continue;
      }

      const totalPlayers = Object.keys(room.players).length;
      if (totalPlayers === 0) continue;

      const alivePlayers = Object.values(room.players).filter(p => !p.isDead);

      if (room.status === 'waiting') {
        if (totalPlayers >= 1) { 
          room.matchTimer -= dt;
          
          if (room.mode === 'ranked' && totalPlayers >= 20) {
            room.matchTimer = Math.min(room.matchTimer, 5);
          }

          if (room.matchTimer <= 0) {
            room.status = 'playing';
            room.items = {};
            room.bombs = {};
            room.winner = null;

            // In casual mode, if room has fewer than 14 players, fill with bots so battle is immediate
            if (room.mode === 'casual' && Object.keys(room.players).length < 14) {
              spawnBotsForRoom(room, 14 - Object.keys(room.players).length);
            }

            for (let i = 0; i < 80; i++) {
              const id = Math.random().toString(36).substring(2);
              room.items[id] = {
                id,
                type: Math.random() > 0.5 ? 'heal' : 'weapon',
                x: (Math.random() - 0.5) * MAP_SIZE,
                y: 1,
                z: (Math.random() - 0.5) * MAP_SIZE,
              };
            }
            markItemsDirty(roomId);

            // Initialize Battle Bus flight trajectory cutting across the map
            const busAngle = Math.random() * Math.PI * 2;
            const busFlightDistance = MAP_SIZE * 1.1; // 440 units
            const startX = -Math.cos(busAngle) * (busFlightDistance / 2);
            const startZ = -Math.sin(busAngle) * (busFlightDistance / 2);
            const endX = Math.cos(busAngle) * (busFlightDistance / 2);
            const endZ = Math.sin(busAngle) * (busFlightDistance / 2);

            room.battleBus = {
              active: true,
              startX,
              startZ,
              endX,
              endZ,
              currentX: startX,
              currentY: BUS_HEIGHT,
              currentZ: startZ,
              progress: 0,
              duration: BUS_DURATION,
              timeLeft: BUS_DURATION,
            };

            Object.values(room.players).forEach((p, index) => {
              p.isDead = false;
              p.health = CLASS_STATS[p.characterClass].maxHp;
              p.heals = 0;
              p.weaponLevel = 1;
              p.x = startX;
              p.y = BUS_HEIGHT;
              p.z = startZ;
              p.inBus = true;
              p.isSkydiving = false;
              p.isGliding = false;
              p.isHealing = false;
              p.isFlying = false;
              p.isInvulnerable = false;
              p.hasShield = false;
              p.lastAbilityTime = 0;

              if (p.isBot) {
                const botExt = p as any;
                botExt.busDropProgress = 0.08 + Math.random() * 0.78; // Random drop time
                botExt.targetDropX = (Math.random() - 0.5) * (MAP_SIZE * 0.7);
                botExt.targetDropZ = (Math.random() - 0.5) * (MAP_SIZE * 0.7);
              }

              if (room.mode === 'team') {
                if (!p.team) {
                  p.team = index % 2 === 0 ? 'red' : 'blue';
                }
                p.color = p.team === 'red' ? '#ef4444' : '#3b82f6';
              } else {
                p.color = CLASS_STATS[p.characterClass].color;
              }
            });
          }
        } else {
          room.matchTimer = room.mode === 'ranked' ? 30 : (room.mode === 'bot' || room.mode === 'team') ? 3 : 10;
        }
      } else if (room.status === 'playing') {
        
        // 1. Handle Battle Bus Flight Simulation
        if (room.battleBus && room.battleBus.active) {
          room.battleBus.timeLeft = Math.max(0, room.battleBus.timeLeft - dt);
          const t = Math.min(1, Math.max(0, 1 - (room.battleBus.timeLeft / room.battleBus.duration)));
          room.battleBus.progress = t;
          room.battleBus.currentX = room.battleBus.startX + (room.battleBus.endX - room.battleBus.startX) * t;
          room.battleBus.currentZ = room.battleBus.startZ + (room.battleBus.endZ - room.battleBus.startZ) * t;
          room.battleBus.currentY = BUS_HEIGHT;

          if (room.battleBus.timeLeft <= 0) {
            room.battleBus.active = false;
          }
        }

        // Handle player passive updates (healing, abilities, battle bus ejection)
        Object.values(room.players).forEach(p => {
          if (p.isDead) return;

          // If still inside the Battle Bus, lock position to the bus or auto-eject when route finishes
          if (p.inBus) {
            if (room.battleBus && room.battleBus.active) {
              p.x = room.battleBus.currentX;
              p.y = room.battleBus.currentY;
              p.z = room.battleBus.currentZ;
            } else {
              // Forced jump at end of flight path
              p.inBus = false;
              p.isSkydiving = true;
              p.isGliding = false;
            }
            return;
          }
          
          if (p.isHealing) {
            const healTick = 18 * dt; // Slowed down from 35 to 18
            const previousHealth = p.health;
            p.health = Math.min(p.maxHealth, p.health + healTick);
            const actualHealed = p.health - previousHealth;
            
            // Track how much we have healed this use
            const pExt = p as any;
            pExt.currentHealAmount = (pExt.currentHealAmount || 0) + actualHealed;
            
            // Stop if reached max HP or if we've healed 100 HP this use
            if (p.health >= p.maxHealth || pExt.currentHealAmount >= 100) {
               p.isHealing = false;
               p.heals = Math.max(0, p.heals - 1);
            }
          }
          
          if (p.isFlying) {
            const groundH = getGroundHeight(p.x, p.z, room.obstacles);
            const pExt = p as any;
            if (pExt.isHoldingJump || p.isRolling) {
              p.y = Math.min(groundH + 45, p.y + 22 * dt); // Fly up much higher!
            } else {
              p.y = Math.max(groundH + 3.5, p.y - 6 * dt); // Gentle descent
            }
          } else if (p.isBot && !p.isSkydiving && !p.isGliding && !p.inBus) {
            const groundH = getGroundHeight(p.x, p.z, room.obstacles);
            p.y = groundH + 1;
          }

          // Reset abilities after duration
          const ability = CLASS_ABILITIES[p.characterClass];
          const duration = ability ? ability.durationMs : 7000;
          if (p.isInvulnerable && now - p.lastAbilityTime > duration) p.isInvulnerable = false;
          if (p.hasShield && now - p.lastAbilityTime > duration) p.hasShield = false;
          if (p.isFlying && now - p.lastAbilityTime > duration) p.isFlying = false;
        });

        // Handle Bombs with realistic Grenade trajectory & bouncing
        for (const bombId in room.bombs) {
          const bomb = room.bombs[bombId];
          if (!bomb.exploded) {
            // Apply grenade flight physics if velocity is defined
            if (bomb.vx !== undefined && bomb.vy !== undefined && bomb.vz !== undefined) {
              bomb.vy -= 28 * dt; // Gravity
              let nextX = bomb.x + bomb.vx * dt;
              let nextY = bomb.y + bomb.vy * dt;
              let nextZ = bomb.z + bomb.vz * dt;

              // Obstacle collision check & bounce
              if (checkObstacleCollision(nextX, bomb.z, room.obstacles, roomId)) {
                bomb.vx = -bomb.vx * 0.5;
                nextX = bomb.x;
              }
              if (checkObstacleCollision(bomb.x, nextZ, room.obstacles, roomId)) {
                bomb.vz = -bomb.vz * 0.5;
                nextZ = bomb.z;
              }

              // Ground bounce & rolling friction
              if (nextY <= 0.45) {
                nextY = 0.45;
                if (bomb.vy < -2) {
                  bomb.vy = -bomb.vy * 0.45; // Bounce off ground
                } else {
                  bomb.vy = 0;
                }
                bomb.vx *= 0.88; // Ground rolling friction
                bomb.vz *= 0.88;
              }

              bomb.x = nextX;
              bomb.y = nextY;
              bomb.z = nextZ;
              if (bomb.rx !== undefined) bomb.rx += Math.hypot(bomb.vx, bomb.vz) * 0.25 * dt;
              if (bomb.rz !== undefined) bomb.rz += Math.hypot(bomb.vx, bomb.vz) * 0.2 * dt;
            }

            let shouldExplode = false;
            
            if (bomb.isMine) {
              // Proximity Mine logic
              // Explode if an enemy gets within 4.5m
              Object.values(room.players).forEach(p => {
                if (p.isDead || p.isInvulnerable || p.inBus || p.isSkydiving || p.isGliding) return;
                if (p.id === bomb.ownerId) return;
                if (room.mode === 'team' && p.team === room.players[bomb.ownerId]?.team) return;
                
                const dist = Math.hypot(p.x - bomb.x, (p.y || 1) - bomb.y, p.z - bomb.z);
                if (dist < 4.5) {
                  shouldExplode = true;
                }
              });
            } else {
              // Normal Grenade: Explodes after 3s fuse
              if (now - bomb.createdAt > 3000) {
                shouldExplode = true;
              }
            }

            if (shouldExplode) {
              bomb.exploded = true;
              Object.values(room.players).forEach(p => {
                if (p.isDead || p.isInvulnerable) return;
                if (p.id === bomb.ownerId && bomb.isMine) return; // Prevent mine suicide. (Normal bombs also prevent suicide, handled below)
                if (p.id === bomb.ownerId && !bomb.isMine) return; // Prevent suicide bomb from own ability
                if (room.mode === 'team' && p.team === room.players[bomb.ownerId]?.team) return;

                const dx = p.x - bomb.x;
                const dy = (p.y || 1) - bomb.y;
                const dz = p.z - bomb.z;
                const dist = Math.hypot(dx, dy, dz);
                const explosionRadius = bomb.isMine ? 6.5 : BOMB_RADIUS;

                if (dist < explosionRadius) {
                  const falloff = bomb.isMine ? 1.0 : Math.max(0.3, 1 - (dist / explosionRadius) * 0.4);
                  const damageMult = p.hasShield ? 0.5 : 1;
                  const baseDamage = bomb.isMine ? 100 : BOMB_DAMAGE;
                  const dmg = Math.max(15, Math.round(baseDamage * falloff * damageMult));
                  p.health -= dmg;
                  io.to(p.id).emit('tookDamage', { attackerX: bomb.x, attackerZ: bomb.z });
                  io.to(roomId).emit('damageDealt', {
                    id: Math.random().toString(36).substring(2),
                    targetId: p.id,
                    attackerId: bomb.ownerId,
                    x: p.x,
                    y: p.y + 0.2,
                    z: p.z,
                    amount: dmg,
                    isSword: false,
                  });

                  if (p.health <= 0) {
                    p.health = 0;
                    p.isDead = true;
                    const killer = room.players[bomb.ownerId];
                    if (killer) killer.score += 1;
                    io.to(roomId).emit('playerDied', { id: p.id, killer: bomb.ownerId });
                  }
                }
              });
              setTimeout(() => { delete room.bombs[bombId]; }, 1000); // Remove bomb after explosion effect
            }
          }
        }

        // --- HIGH-PERFORMANCE TACTICAL BOT AI BEHAVIOR TICK ---
        if (room.mode === 'team') {
          // Check for fallen bots in team mode that can respawn after 6 seconds
          Object.values(room.players).forEach(bot => {
            if (!bot.isBot || !bot.isDead) return;
            const botExt = bot as any;
            if (!botExt.deathTime) botExt.deathTime = now;
            if (now - botExt.deathTime > 6000) {
              const safePos = findSafeSpawnPosition(room.obstacles, MAP_SIZE, 3.5, roomId);
              const botStats = CLASS_STATS[bot.characterClass];
              bot.isDead = false;
              bot.health = botStats.maxHp;
              bot.maxHealth = botStats.maxHp;
              bot.x = safePos.x;
              bot.y = 1;
              bot.z = safePos.z;
              bot.heals = 1;
              bot.isHealing = false;
              bot.isFlying = false;
              bot.isInvulnerable = true;
              botExt.lastDamagedTime = now + 2500;
              botExt.deathTime = 0;
            }
          });
        }

        const humanPlayers = alivePlayers.filter(p => !p.isBot);
        let botIndex = 0;

        alivePlayers.forEach(bot => {
          if (!bot.isBot) return;
          botIndex++;

          const botStats = CLASS_STATS[bot.characterClass];
          const isSword = bot.characterClass === 'sword';
          const botExt = bot as any;

          // Handle Bot In-Bus & Skydiving
          if (bot.inBus) {
            if (!room.battleBus?.active || (room.battleBus && room.battleBus.progress >= (botExt.busDropProgress || 0.3))) {
              bot.inBus = false;
              bot.isSkydiving = true;
              bot.isGliding = false;
              bot.x = room.battleBus ? room.battleBus.currentX : bot.x;
              bot.y = room.battleBus ? room.battleBus.currentY : 80;
              bot.z = room.battleBus ? room.battleBus.currentZ : bot.z;
              if (botExt.targetDropX === undefined) {
                botExt.targetDropX = (Math.random() - 0.5) * (MAP_SIZE * 0.7);
                botExt.targetDropZ = (Math.random() - 0.5) * (MAP_SIZE * 0.7);
              }
            } else {
              return; // Waiting inside bus
            }
          }

          if (bot.isSkydiving || bot.isGliding) {
            // Auto-deploy glider at lower altitudes
            if (bot.isSkydiving && bot.y < 35) {
              bot.isGliding = true;
              bot.isSkydiving = false;
            }

            const fallSpeed = bot.isGliding ? 14 : 36;
            bot.y -= fallSpeed * dt;

            // Glide towards target drop zone
            const targetX = botExt.targetDropX || 0;
            const targetZ = botExt.targetDropZ || 0;
            const dx = targetX - bot.x;
            const dz = targetZ - bot.z;
            const dist = Math.hypot(dx, dz);
            if (dist > 2) {
              const hSpeed = bot.isGliding ? 22 : 14;
              bot.x += (dx / dist) * hSpeed * dt;
              bot.z += (dz / dist) * hSpeed * dt;
              bot.ry = Math.atan2(-dx, -dz);
            }

            const groundH = getGroundHeight(bot.x, bot.z, room.obstacles);
            if (bot.y <= groundH + 1.2) {
              bot.y = groundH + 1;
              bot.isSkydiving = false;
              bot.isGliding = false;
            }
            return; // Skip ground combat while airborne
          }

          // 0. Update Tactical Dodge Roll State
          if (bot.isRolling && now > (botExt.rollEndTime || 0)) {
            bot.isRolling = false;
          }

          // 1. Tactical Target Finding (Staggered Time-Slicing & Distance Gate for 100 Players)
          let closestTarget: PlayerState | null = null;
          let targetDist = Infinity;

          // Only perform heavy target re-scan every ~350ms per bot, or if previous target is dead/missing
          const prevTarget = botExt.cachedTargetId ? room.players[botExt.cachedTargetId] : null;
          const isPrevTargetValid = prevTarget && !prevTarget.isDead && !prevTarget.inBus && !prevTarget.isSkydiving && !prevTarget.isGliding && (room.mode !== 'team' || prevTarget.team !== bot.team);

          if (!botExt.nextTargetScan || now > botExt.nextTargetScan || !isPrevTargetValid) {
            botExt.nextTargetScan = now + 300 + (botIndex % 5) * 50;
            let bestScore = Infinity;

            for (let i = 0; i < alivePlayers.length; i++) {
              const other = alivePlayers[i];
              if (other.id === bot.id) continue;
              if (other.inBus || other.isSkydiving || other.isGliding) continue;
              if (room.mode === 'team' && other.team === bot.team) continue;

              const dx = other.x - bot.x;
              const dz = other.z - bot.z;
              if (Math.abs(dx) > 65 || Math.abs(dz) > 65) continue; // Fast bounding box cull
              const d = Math.hypot(dx, dz);

              let score = d;

              // Priority 1: Revenge / Threat (Focus on attacker who hit this bot)
              if (botExt.threatTargetId === other.id && now < (botExt.threatExpireTime || 0)) {
                score -= 40;
              }

              // Priority 2: Low-HP enemy (Execute kill)
              if (other.health <= other.maxHealth * 0.35) {
                score -= 30;
              }

              // Priority 3: Human player focus (High priority duel)
              if (!other.isBot) {
                score -= 15;
              }

              // Priority 4: Line of sight check (Only check for closer candidates < 45m)
              if (d < 45) {
                const isBlocked = isLineBlockedByObstacles(bot.x, bot.y, bot.z, other.x, (other.y || 0), other.z, room.obstacles, roomId);
                if (!isBlocked) {
                  score -= 15;
                }
              }

              if (score < bestScore) {
                bestScore = score;
                closestTarget = other;
                targetDist = d;
              }
            }

            botExt.cachedTargetId = closestTarget ? closestTarget.id : null;
          } else {
            closestTarget = prevTarget;
            targetDist = closestTarget ? Math.hypot(closestTarget.x - bot.x, closestTarget.z - bot.z) : Infinity;
          }

          // 2. Velocity Tracking & Predictive Lead Aiming
          let aimTargetX = bot.x;
          let aimTargetZ = bot.z;
          let targetVx = 0;
          let targetVz = 0;

          if (closestTarget) {
            const target = closestTarget as PlayerState;
            if (botExt.lastTargetId === target.id && botExt.prevTargetX !== undefined) {
              const sampleDt = Math.max(0.016, (now - (botExt.prevTargetTime || now)) / 1000);
              targetVx = (target.x - botExt.prevTargetX) / sampleDt;
              targetVz = (target.z - botExt.prevTargetZ) / sampleDt;
            }
            botExt.lastTargetId = target.id;
            botExt.prevTargetX = target.x;
            botExt.prevTargetZ = target.z;
            botExt.prevTargetTime = now;

            // Compensate for target movement (Lead Aiming)
            const bulletSpeed = isSword ? 999 : (bot.characterClass === 'scout' ? 125 : 85);
            const leadTime = Math.min(0.35, targetDist / bulletSpeed);
            aimTargetX = target.x + targetVx * leadTime;
            aimTargetZ = target.z + targetVz * leadTime;
          }

          // 3. Danger Detection: Bombs exploding near bot
          let bombDanger = false;
          let bombFleeX = 0;
          let bombFleeZ = 0;
          if (Object.keys(room.bombs).length > 0) {
            for (const bId in room.bombs) {
              const b = room.bombs[bId];
              if (b.ownerId !== bot.id && !b.exploded) {
                const dx = bot.x - b.x;
                const dz = bot.z - b.z;
                if (Math.abs(dx) < 16 && Math.abs(dz) < 16) {
                  const bDist = Math.hypot(dx, dz);
                  if (bDist < 16) {
                    bombDanger = true;
                    bombFleeX = dx / (bDist || 1);
                    bombFleeZ = dz / (bDist || 1);
                    // Emergency Dodge Roll away from blast zone
                    if (!bot.isRolling && (!bot.lastRollTime || now - bot.lastRollTime > 2000)) {
                      bot.isRolling = true;
                      bot.lastRollTime = now;
                      botExt.rollEndTime = now + 400;
                    }
                    break;
                  }
                }
              }
            }
          }

          // 4. Tactical Cover & Healing Decision
          let isSeekingCover = false;
          let navTargetX = aimTargetX;
          let navTargetZ = aimTargetZ;

          // If wounded (<45% HP) and has heals, look for cover behind obstacles
          if (bot.health < bot.maxHealth * 0.45 && bot.heals > 0 && closestTarget && targetDist < 45) {
            if (!botExt.coverPos || now > (botExt.nextCoverEval || 0)) {
              botExt.nextCoverEval = now + 1500;
              botExt.coverPos = findCoverPosition(bot.x, bot.z, (closestTarget as PlayerState).x, (closestTarget as PlayerState).z, room.obstacles, roomId);
            }

            if (botExt.coverPos) {
              navTargetX = botExt.coverPos.x;
              navTargetZ = botExt.coverPos.z;
              isSeekingCover = true;
              const dToCover = Math.hypot(bot.x - botExt.coverPos.x, bot.z - botExt.coverPos.z);
              // Safely inside cover or line of sight broken: begin healing
              const targetP = closestTarget as PlayerState;
              if (dToCover < 3.5 || isLineBlockedByObstacles(bot.x, bot.y, bot.z, targetP.x, (targetP.y || 0), targetP.z, room.obstacles, roomId)) {
                bot.isHealing = true;
              }
            }
          } else {
            botExt.coverPos = null;
          }

          // Heal if safe or retreating
          if (bot.health < bot.maxHealth * 0.55 && bot.heals > 0 && (!closestTarget || targetDist > 16 || isSeekingCover)) {
            bot.isHealing = true;
          } else if (!isSeekingCover && targetDist <= 12) {
            bot.isHealing = false;
          }

          // 5. Item Scavenging (Weapon Upgrades & Health Kits)
          let isMovingToItem = false;
          if (!isSeekingCover && (bot.health < bot.maxHealth * 0.7 || bot.weaponLevel < 3)) {
            if (!botExt.nextItemCheck || now > botExt.nextItemCheck) {
              botExt.nextItemCheck = now + 600 + Math.random() * 300;
              let nearestDist = bot.weaponLevel < 3 ? 35 : 20;
              let nearestItem: ItemState | null = null;
              for (const itemId in room.items) {
                const it = room.items[itemId];
                const dist = Math.hypot(it.x - bot.x, it.z - bot.z);
                const weight = it.type === 'weapon' && bot.weaponLevel < 3 ? 0.7 : 1.0;
                if (dist * weight < nearestDist) {
                  nearestDist = dist * weight;
                  nearestItem = it;
                }
              }
              botExt.targetItem = nearestItem;
            }

            if (botExt.targetItem && room.items[botExt.targetItem.id]) {
              if (!closestTarget || targetDist > 15 || bot.weaponLevel === 1) {
                navTargetX = botExt.targetItem.x;
                navTargetZ = botExt.targetItem.z;
                isMovingToItem = true;
              }
            }
          }

          // 6. Tactical Movement, Obstacle Bypass & Kiting Engine
          let moveX = 0;
          let moveZ = 0;
          const baseSpeed = (botStats.speed * 28) * (bot.isFlying ? 1.35 : 1) * (bot.isRolling ? 2.2 : 1);
          const moveSpeed = baseSpeed * dt;

          if (bombDanger) {
            // Flee away from bomb explosion
            moveX = bombFleeX * moveSpeed * 1.2;
            moveZ = bombFleeZ * moveSpeed * 1.2;
            bot.ry = Math.atan2(-bombFleeX, -bombFleeZ);
          } else if (closestTarget || isMovingToItem || isSeekingCover) {
            let targetMoveX = navTargetX;
            let targetMoveZ = navTargetZ;
            let isFlanking = false;

            // Intelligent Flanking when bot has sufficient HP and enemy is behind cover
            const targetP = closestTarget as PlayerState | null;
            if (targetP && targetDist < 35 && !isSeekingCover && bot.health >= bot.maxHealth * 0.4) {
              const isSightBlocked = isLineBlockedByObstacles(bot.x, bot.y, bot.z, targetP.x, (targetP.y || 0), targetP.z, room.obstacles, roomId);
              if (isSightBlocked) {
                const flankPoint = findFlankingPoint(bot.x, bot.z, targetP.x, targetP.z, room.obstacles, roomId);
                if (flankPoint) {
                  targetMoveX = flankPoint.x;
                  targetMoveZ = flankPoint.z;
                  isFlanking = true;
                }
              }
            }

            if (!isFlanking && targetDist < 40) {
              // Intelligent Obstacle Bypass: Find corner waypoint to navigate around blocking walls
              const bypassPoint = findSafeBypassPoint(bot.x, bot.z, navTargetX, navTargetZ, room.obstacles, roomId);
              if (bypassPoint) {
                targetMoveX = bypassPoint.x;
                targetMoveZ = bypassPoint.z;
              }
            }

            const dx = targetMoveX - bot.x;
            const dz = targetMoveZ - bot.z;
            const dLen = Math.hypot(dx, dz) || 1;

            // Smooth Aiming: Look towards enemy when in direct sight or combat, or along movement path when flanking/bypassing
            if (closestTarget && !isSeekingCover && !isFlanking && targetDist < 45) {
              const aimDx = aimTargetX - bot.x;
              const aimDz = aimTargetZ - bot.z;
              bot.ry = Math.atan2(-aimDx, -aimDz);
            } else {
              bot.ry = Math.atan2(-dx, -dz);
            }

            // Kiting & Spacing Strategy
            if (isSeekingCover || isMovingToItem || isFlanking) {
              // Direct purposeful movement around obstacle or to cover/item
              moveX = (dx / dLen) * moveSpeed;
              moveZ = (dz / dLen) * moveSpeed;

              // Tactical roll when rounding corner to flank enemy
              if (isFlanking && targetDist <= 16 && (!bot.lastRollTime || now - bot.lastRollTime > 2600) && Math.random() < 0.25) {
                bot.isRolling = true;
                bot.lastRollTime = now;
                botExt.rollEndTime = now + 360;
              }
            } else if (isSword) {
              // SWORD CLASS: Aggressive Flank & Rush
              if (targetDist > 3.8) {
                // Zig-zag dash toward target
                const strafeSign = (Math.floor(now / 350) % 2 === 0) ? 1 : -1;
                const forwardAngle = bot.ry;
                const zigAngle = forwardAngle + strafeSign * 0.45;
                moveX = -Math.sin(zigAngle) * moveSpeed;
                moveZ = -Math.cos(zigAngle) * moveSpeed;

                // Close-in roll jump attack
                if (targetDist <= 9 && targetDist >= 4 && (!bot.lastRollTime || now - bot.lastRollTime > 2400)) {
                  bot.isRolling = true;
                  bot.lastRollTime = now;
                  botExt.rollEndTime = now + 350;
                }
              } else {
                // Circle strafe in strike range
                const strafeAngle = bot.ry + Math.PI / 2;
                moveX = -Math.sin(strafeAngle) * moveSpeed * 0.9;
                moveZ = -Math.cos(strafeAngle) * moveSpeed * 0.9;
              }
            } else {
              // RANGED GUN CLASSES (Scout, Tank, Melee):
              const idealMinDist = bot.characterClass === 'scout' ? 18 : 12;
              const idealMaxDist = bot.characterClass === 'scout' ? 28 : 22;

              if (targetDist < idealMinDist) {
                // Backstep / Kiting: enemy is too close! Retreat while firing
                moveX = -(dx / dLen) * moveSpeed * 0.95;
                moveZ = -(dz / dLen) * moveSpeed * 0.95;

                // Emergency back-roll if melee sword rushes close
                const targetIsSword = (closestTarget as PlayerState).characterClass === 'sword';
                if ((targetDist < 6 || targetIsSword) && (!bot.lastRollTime || now - bot.lastRollTime > 2000)) {
                  bot.isRolling = true;
                  bot.lastRollTime = now;
                  botExt.rollEndTime = now + 380;
                }
              } else if (targetDist > idealMaxDist) {
                // Advance toward enemy
                moveX = (dx / dLen) * moveSpeed;
                moveZ = (dz / dLen) * moveSpeed;
              } else {
                // Ideal combat distance: Tactical AD Strafe (Evasive side-stepping)
                if (!botExt.strafeDir || now > (botExt.strafeChangeTime || 0)) {
                  botExt.strafeDir = Math.random() > 0.5 ? 1 : -1;
                  botExt.strafeChangeTime = now + 400 + Math.random() * 500;
                }
                const strafeAngle = bot.ry + (Math.PI / 2) * botExt.strafeDir;
                moveX = -Math.sin(strafeAngle) * moveSpeed * 0.9;
                moveZ = -Math.cos(strafeAngle) * moveSpeed * 0.9;
              }
            }
          } else {
            // PROACTIVE EXPLORATION WANDER W/O TARGET
            if (!botExt.wanderAngle || now > (botExt.wanderChangeTime || 0)) {
              // Pick a new random direction, biased slightly towards the center (0,0) to stay in the action
              const angleToCenter = Math.atan2(-bot.x, -bot.z);
              botExt.wanderAngle = angleToCenter + (Math.random() - 0.5) * Math.PI;
              botExt.wanderChangeTime = now + 2000 + Math.random() * 3000;
              bot.ry = botExt.wanderAngle;
            }
            
            // Periodically dash to move around the map faster
            if (isSword && (!bot.lastRollTime || now - bot.lastRollTime > 3000) && Math.random() < 0.05) {
                bot.isRolling = true;
                bot.lastRollTime = now;
                botExt.rollEndTime = now + 350;
            }

            moveX = -Math.sin(botExt.wanderAngle) * moveSpeed * 0.7; // Wander slightly slower
            moveZ = -Math.cos(botExt.wanderAngle) * moveSpeed * 0.7;
          }

          // Apply movement with spatial grid collision & sliding
          const nextX = Math.max(-MAP_SIZE / 2 + 5, Math.min(MAP_SIZE / 2 - 5, bot.x + moveX));
          const nextZ = Math.max(-MAP_SIZE / 2 + 5, Math.min(MAP_SIZE / 2 - 5, bot.z + moveZ));

          if (!checkObstacleCollision(nextX, nextZ, room.obstacles, roomId, bot.y)) {
            bot.x = nextX;
            bot.z = nextZ;
          } else {
            if (!checkObstacleCollision(nextX, bot.z, room.obstacles, roomId, bot.y)) bot.x = nextX;
            else if (!checkObstacleCollision(bot.x, nextZ, room.obstacles, roomId, bot.y)) bot.z = nextZ;
          }

          // Update Y based on new X,Z so de-penetration knows our true height
          bot.y = getGroundHeight(bot.x, bot.z, room.obstacles) + (bot.isFlying ? 12 : 1);
          // Anti-penetration safety
          dePenetrateObstacles(bot, room.obstacles, 1.2, roomId);

          // 7. Item Pickup
          if (Object.keys(room.items).length > 0 && (!botExt.lastItemPickupCheck || now - botExt.lastItemPickupCheck > 120)) {
            botExt.lastItemPickupCheck = now;
            for (const itemId in room.items) {
              const item = room.items[itemId];
              const dx = bot.x - item.x;
              const dz = bot.z - item.z;
              if (Math.abs(dx) < 3.5 && Math.abs(dz) < 3.5) {
                if (dx * dx + dz * dz < 12.25) {
                  if (item.type === 'heal') bot.heals++;
                  if (item.type === 'weapon') bot.weaponLevel = Math.min(3, bot.weaponLevel + 1);
                  delete room.items[itemId];
                  markItemsDirty(roomId);
                  if (botExt.targetItem?.id === itemId) botExt.targetItem = null;
                  break;
                }
              }
            }
          }

          // 8. Class Special Abilities Triggering
          const ability = CLASS_ABILITIES[bot.characterClass];
          const abilityCd = ability ? ability.cooldownMs : 8000;
          const abilityDuration = ability ? ability.durationMs : 0;
          if (closestTarget && targetDist < 40 && now - bot.lastAbilityTime > (abilityCd + abilityDuration)) {
            const targetPlayer = closestTarget as PlayerState;
            if (bot.characterClass === 'melee') {
              // Throw high-velocity Mega Bomb at predictive lead location
              bot.lastAbilityTime = now;
              const bombId = Math.random().toString(36).substring(2);
              const throwDist = Math.min(targetDist, 28);
              const throwSpeed = 32;
              const dirX = -Math.sin(bot.ry);
              const dirZ = -Math.cos(bot.ry);

              room.bombs[bombId] = {
                id: bombId,
                ownerId: bot.id,
                x: bot.x + dirX * 1.5,
                y: bot.y + 0.2,
                z: bot.z + dirZ * 1.5,
                vx: dirX * throwSpeed * (throwDist / 25),
                vy: 11,
                vz: dirZ * throwSpeed * (throwDist / 25),
                rx: Math.random() * Math.PI,
                rz: Math.random() * Math.PI,
                createdAt: now,
                exploded: false,
              };
            } else if (bot.characterClass === 'sword' && targetDist <= 10) {
              // Blade Barrier: Invulnerability rush
              bot.lastAbilityTime = now;
              bot.isInvulnerable = true;
            } else if (bot.characterClass === 'tank' && (targetDist <= 22 || bot.health < bot.maxHealth * 0.7)) {
              // Fortress Shield: Deploy 50% damage reduction
              bot.lastAbilityTime = now;
              bot.hasShield = true;
            } else if (bot.characterClass === 'scout' && (targetDist <= 9 || targetPlayer.characterClass === 'sword' || bot.health < bot.maxHealth * 0.5)) {
              // Sky Glide: Escape to high altitude (15m)
              bot.lastAbilityTime = now;
              bot.isFlying = true;
            }
          }

          // 9. Combat Shooting & Slashing with Lead Aim & Anti-Air
          const canShoot = closestTarget && targetDist <= (isSword ? 14 : 45) && !bot.isFlying && !bot.isHealing;
          if (canShoot) {
            const targetPlayer = closestTarget as PlayerState;
            const botWeaponMult = 1 + (bot.weaponLevel - 1) * 0.15;
            const shootCooldown = Math.max(70, botStats.cooldown - (bot.weaponLevel - 1) * 20);

            if (now - bot.lastShootTime > shootCooldown) {
              bot.lastShootTime = now;

              const targetDy = targetPlayer.y - bot.y; // Fix parallax
              const dist3D = Math.hypot(targetPlayer.x - bot.x, targetDy, targetPlayer.z - bot.z);
              const canBotAttack = !isSword || (Math.abs(targetDy) <= 2.8 && dist3D <= 13);

              if (canBotAttack) {
                const forwardX = -Math.sin(bot.ry);
                const forwardZ = -Math.cos(bot.ry);
                const targetDx = targetPlayer.x - bot.x;
                const targetDz = targetPlayer.z - bot.z;
                const normDx = targetDx / (targetDist || 1);
                const normDz = targetDz / (targetDist || 1);
                const dot = forwardX * normDx + forwardZ * normDz;

                // Precision aim tolerance
                const reqDot = isSword ? 0.45 : 0.80;
                let hitTargetId: string | null = null;
                let hitPos = null;

                // Wall obstruction check with spatial grid (True 3D ray)
                const isBlocked = isLineBlockedByObstacles(bot.x, bot.y, bot.z, targetPlayer.x, targetPlayer.y, targetPlayer.z, room.obstacles, roomId);
                const isTargetDodge = targetPlayer.isRolling || (targetPlayer.lastRollTime && now - targetPlayer.lastRollTime < 350);

                if (dot > reqDot && !isBlocked && !targetPlayer.isInvulnerable && !isTargetDodge && !targetPlayer.inBus && !targetPlayer.isSkydiving && !targetPlayer.isGliding && !(room.mode === 'team' && targetPlayer.team === bot.team)) {
                  if (!targetPlayer.lastDamagedTime || now - targetPlayer.lastDamagedTime >= 100) {
                    targetPlayer.lastDamagedTime = now;
                    const dmgMult = targetPlayer.hasShield ? 0.5 : 1;
                    const dmg = Math.max(1, Math.round((botStats.damage * botWeaponMult) * dmgMult));
                    targetPlayer.health -= dmg;
                    hitTargetId = targetPlayer.id;
                    hitPos = { x: targetPlayer.x, y: targetPlayer.y, z: targetPlayer.z };

                    // Threat reaction if victim is also a bot
                    if (targetPlayer.isBot) {
                      const victimExt = targetPlayer as any;
                      victimExt.threatTargetId = bot.id;
                      victimExt.threatExpireTime = now + 6500;
                      if (!targetPlayer.isRolling && (!targetPlayer.lastRollTime || now - targetPlayer.lastRollTime > 2000)) {
                        if (Math.random() < 0.6) {
                          targetPlayer.isRolling = true;
                          targetPlayer.lastRollTime = now;
                          victimExt.rollEndTime = now + 380;
                        }
                      }
                    }

                    io.to(targetPlayer.id).emit('tookDamage', { attackerX: bot.x, attackerZ: bot.z });

                    io.to(roomId).emit('damageDealt', {
                      id: Math.random().toString(36).substring(2),
                      targetId: targetPlayer.id,
                      attackerId: bot.id,
                      x: targetPlayer.x,
                      y: targetPlayer.y + 0.2,
                      z: targetPlayer.z,
                      amount: dmg,
                      isSword,
                    });

                    if (targetPlayer.health <= 0) {
                      targetPlayer.health = 0;
                      targetPlayer.isDead = true;
                      bot.score += 1;
                      io.to(roomId).emit('playerDied', { id: targetPlayer.id, killer: bot.id });
                    }
                  }
                }

                // Optimization for 100 players: Only broadcast attack visuals if near human players or hit human player
                const isNearHuman = humanPlayers.some(h => Math.hypot(h.x - bot.x, h.z - bot.z) < 65);
                if (isNearHuman || hitTargetId) {
                  io.to(roomId).emit('playerAttacked', {
                    id: Math.random().toString(36).substring(2),
                    attackerId: bot.id,
                    characterClass: bot.characterClass,
                    x: bot.x,
                    y: bot.y + 0.6,
                    z: bot.z,
                    ry: bot.ry,
                    weaponLevel: bot.weaponLevel,
                    isSword,
                    hitTargetId,
                    hitPosition: hitPos,
                  });
                }
              }
            }
          }
        });

        // Check win condition
        if (room.mode === 'team') {
          const totalRed = Object.values(room.players).filter(p => p.team === 'red').length;
          const totalBlue = Object.values(room.players).filter(p => p.team === 'blue').length;
          if (totalRed > 0 && totalBlue > 0) {
            const redScore = Object.values(room.players).filter(p => p.team === 'red').reduce((s, p) => s + (p.score || 0), 0);
            const blueScore = Object.values(room.players).filter(p => p.team === 'blue').reduce((s, p) => s + (p.score || 0), 0);
            (room as any).teamScores = { red: redScore, blue: blueScore };

            const redAlive = alivePlayers.filter(p => p.team === 'red').length > 0;
            const blueAlive = alivePlayers.filter(p => p.team === 'blue').length > 0;
            const TARGET_SCORE = 30;

            if (redScore >= TARGET_SCORE || blueScore >= TARGET_SCORE || !redAlive || !blueAlive) {
              room.status = 'ended';
              room.winner = (redScore >= TARGET_SCORE || (!blueAlive && redAlive)) ? 'red' : 'blue';
              room.matchTimer = 5;
            }
          }
        } else {
          // If all players are eliminated, or 1 winner remains out of multiple players
          if (alivePlayers.length === 0 || (alivePlayers.length === 1 && totalPlayers > 1)) {
            room.status = 'ended';
            room.winner = alivePlayers.length === 1 ? alivePlayers[0].id : null;
            room.matchTimer = 5;
          }
        }
      } else if (room.status === 'ended') {
        room.matchTimer -= dt;
        if (room.matchTimer <= 0) {
          room.status = 'waiting';
          room.matchTimer = room.mode === 'ranked' ? 30 : (room.mode === 'bot' || room.roomId.startsWith('team_bot_')) ? 3 : 10;
        }
      }

      broadcastRoomState(io, room, true);
    }
  }, 33);

  // API route for live online human count across all rooms
  app.get('/api/online-count', (req, res) => {
    let totalOnline = 0;
    for (const r of Object.values(rooms)) {
      for (const p of Object.values(r.players)) {
        if (!p.isBot) totalOnline++;
      }
    }
    res.json({ count: Math.max(1, totalOnline) });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
