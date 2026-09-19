import React, { useRef, useEffect } from 'react';
import { useGameStore, liveInput } from '../store';
import { Obstacle } from '../types';

const RADAR_RANGE = 75; // Visible radius in game meters
const MAP_WORLD_SIZE = 200; // Total world width/depth

// Pre-render static obstacles map onto an offscreen canvas once
let cachedObstaclesCanvas: HTMLCanvasElement | null = null;
let lastObstaclesRef: Record<string, Obstacle> | null = null;

function getCachedObstaclesCanvas(obstacles: Record<string, Obstacle>): HTMLCanvasElement {
  if (cachedObstaclesCanvas && lastObstaclesRef === obstacles) {
    return cachedObstaclesCanvas;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const toMapCoord = (v: number) => ((v + MAP_WORLD_SIZE / 2) / MAP_WORLD_SIZE) * 400;
  const toMapSize = (s: number) => (s / MAP_WORLD_SIZE) * 400;

  for (const id in obstacles) {
    const obs = obstacles[id];
    const mx = toMapCoord(obs.x);
    const my = toMapCoord(obs.z);
    const mw = toMapSize(obs.width);
    const mh = toMapSize(obs.depth);

    if (obs.type === 'crate') {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
    } else if (obs.type === 'building' || obs.type === 'bunker') {
      ctx.fillStyle = 'rgba(203, 213, 225, 0.9)';
    } else {
      ctx.fillStyle = 'rgba(100, 116, 139, 0.75)';
    }

    ctx.fillRect(mx - mw / 2, my - mh / 2, Math.max(2, mw), Math.max(2, mh));
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - mw / 2, my - mh / 2, Math.max(2, mw), Math.max(2, mh));
  }

  cachedObstaclesCanvas = canvas;
  lastObstaclesRef = obstacles;
  return canvas;
}

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const { gameState, myId } = useGameStore.getState();
      if (!gameState || !myId) {
        animId = requestAnimationFrame(render);
        return;
      }

      const myPlayer = gameState.players[myId];
      if (!myPlayer) {
        animId = requestAnimationFrame(render);
        return;
      }

      const size = canvas.width;
      const center = size / 2;
      const radius = center - 2;

      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      // Clip to circular radar
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.clip();

      // Background
      const bgGrad = ctx.createRadialGradient(center, center, 0, center, center, radius);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, size, size);

      // Radar rings
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.arc(center, center, radius * 0.33, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(center, center, radius * 0.66, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshairs
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.beginPath();
      ctx.moveTo(center, 0);
      ctx.lineTo(center, size);
      ctx.moveTo(0, center);
      ctx.lineTo(size, center);
      ctx.stroke();

      const px = liveInput.x !== undefined && liveInput.x !== 0 ? liveInput.x : myPlayer.x;
      const pz = liveInput.z !== undefined && liveInput.z !== 0 ? liveInput.z : myPlayer.z;
      const pry = liveInput.ry !== undefined ? liveInput.ry : myPlayer.ry;

      const toRadarX = (wx: number) => center + ((wx - px) / RADAR_RANGE) * radius;
      const toRadarY = (wz: number) => center + ((wz - pz) / RADAR_RANGE) * radius;

      // Ultra-fast Obstacles rendering via offscreen cached map (0ms CPU)
      if (gameState.obstacles) {
        const offscreen = getCachedObstaclesCanvas(gameState.obstacles);
        const mapScale = 400 / MAP_WORLD_SIZE; // 2 px per game meter
        const srcW = (RADAR_RANGE * 2) * mapScale;
        const srcH = (RADAR_RANGE * 2) * mapScale;
        const srcX = (px + MAP_WORLD_SIZE / 2 - RADAR_RANGE) * mapScale;
        const srcY = (pz + MAP_WORLD_SIZE / 2 - RADAR_RANGE) * mapScale;

        ctx.drawImage(offscreen, srcX, srcY, srcW, srcH, 0, 0, size, size);
      }

      // Ground Items
      if (gameState.items) {
        for (const itemId in gameState.items) {
          const it = gameState.items[itemId];
          const dist = Math.hypot(it.x - px, it.z - pz);
          if (dist > RADAR_RANGE) continue;

          const rx = toRadarX(it.x);
          const ry = toRadarY(it.z);

          ctx.fillStyle = it.type === 'heal' ? '#34d399' : '#fbbf24';
          ctx.beginPath();
          ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Battle Bus
      if (gameState.battleBus && gameState.battleBus.active) {
        const bx = toRadarX(gameState.battleBus.currentX);
        const by = toRadarY(gameState.battleBus.currentZ);
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Enemies / Opponents
      if (gameState.players) {
        for (const pid in gameState.players) {
          const p = gameState.players[pid];
          if (p.id === myId || p.isDead) continue;

          const isTeam = gameState.mode === 'team' && p.team === myPlayer.team;
          const dist = Math.hypot(p.x - px, p.z - pz);

          if (dist <= RADAR_RANGE) {
            const rx = toRadarX(p.x);
            const ry = toRadarY(p.z);

            // Soft enemy dot
            ctx.fillStyle = isTeam ? '#22d3ee' : '#ef4444';
            ctx.beginPath();
            ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Outline
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
          } else if (dist <= 110) {
            // Peripheral edge indicator
            const angle = Math.atan2(p.z - pz, p.x - px);
            const edgeX = center + Math.cos(angle) * (radius - 5);
            const edgeY = center + Math.sin(angle) * (radius - 5);

            ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
            ctx.beginPath();
            ctx.arc(edgeX, edgeY, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Local Player (Center)
      ctx.save();
      ctx.translate(center, center);

      // Vision cone
      ctx.rotate(-pry);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 32, -Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35);
      ctx.closePath();
      ctx.fill();

      // Player Arrow / Dot
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Heading needle
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -9);
      ctx.stroke();

      ctx.restore();

      ctx.restore(); // Restore unclipped

      // Outer radar border
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Cardinal direction letters
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('N', center, 3);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="w-36 h-36 sm:w-40 sm:h-40 relative pointer-events-none select-none rounded-full overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.25)] border-2 border-cyan-500/40">
      <canvas
        ref={canvasRef}
        width={160}
        height={160}
        className="w-full h-full block"
      />
      <div className="absolute bottom-1 right-2 text-[8px] font-mono font-bold text-cyan-400/80 tracking-tighter pointer-events-none">
        75m
      </div>
    </div>
  );
}
