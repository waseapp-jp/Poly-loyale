import React, { useRef, useEffect } from 'react';
import { useGameStore, liveInput } from '../store';

const RADAR_RANGE = 75; // Visible radius in game meters

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

      // Obstacles
      if (gameState.obstacles) {
        ctx.fillStyle = 'rgba(100, 116, 139, 0.7)';
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
        for (const id in gameState.obstacles) {
          const obs = gameState.obstacles[id];
          const dist = Math.hypot(obs.x - px, obs.z - pz);
          if (dist > RADAR_RANGE + Math.max(obs.width, obs.depth)) continue;

          const rx = toRadarX(obs.x);
          const ry = toRadarY(obs.z);
          const rw = (obs.width / RADAR_RANGE) * radius;
          const rh = (obs.depth / RADAR_RANGE) * radius;

          if (obs.type === 'crate') {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
          } else if (obs.type === 'building' || obs.type === 'bunker') {
            ctx.fillStyle = 'rgba(203, 213, 225, 0.85)';
          } else {
            ctx.fillStyle = 'rgba(100, 116, 139, 0.7)';
          }

          ctx.fillRect(rx - rw / 2, ry - rh / 2, Math.max(2, rw), Math.max(2, rh));
          ctx.strokeRect(rx - rw / 2, ry - rh / 2, Math.max(2, rw), Math.max(2, rh));
        }
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
