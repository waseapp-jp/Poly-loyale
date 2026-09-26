import React, { useState, useEffect, useRef } from 'react';
import { onDamageDealt, useGameStore } from '../store';
import { DamagePopupEvent } from '../types';
import { Vector3 } from 'three';

interface DisplayPopup {
  id: string;
  worldX: number;
  worldY: number;
  worldZ: number;
  amount: number;
  isSword: boolean;
  isMine: boolean;
  isTaken: boolean;
  scatterX: number;
  scatterY: number;
  timestamp: number;
}

// Global hook to store active Three.js camera for accurate 3D->2D screen projection
let globalThreeCamera: any = null;
let globalCanvasRect: DOMRect | null = null;

export function setThreeCameraForProjection(camera: any) {
  globalThreeCamera = camera;
}

export const DamagePopupsOverlay = React.memo(function DamagePopupsOverlay() {
  const [popups, setPopups] = useState<DisplayPopup[]>([]);
  const screenPosMap = useRef<Record<string, { x: number; y: number; visible: boolean }>>({});
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsub = onDamageDealt((evt: DamagePopupEvent) => {
      const state = useGameStore.getState();
      const myId = state.myId;
      const myPlayer = myId && state.gameState ? state.gameState.players[myId] : null;

      // 1. If local player is inside the Battle Bus or not yet spawned, suppress all damage popups
      if (!myPlayer || myPlayer.inBus) {
        return;
      }

      const isMine = !!(myId && evt.attackerId === myId);
      const isTaken = !!(myId && evt.targetId === myId);

      // 2. Only show damage popups that are directly relevant:
      // - Damage dealt by local player (isMine)
      // - Damage taken by local player (isTaken)
      // - Nearby combat within 25m if neither
      if (!isMine && !isTaken) {
        const dx = evt.x - myPlayer.x;
        const dz = evt.z - myPlayer.z;
        if (dx * dx + dz * dz > 25 * 25) return;
      }

      // Generate slight randomized scatter offset so rapid/burst hits don't stack on exact same pixel
      const scatterAngle = Math.random() * Math.PI * 2;
      const scatterDist = 12 + Math.random() * 28;
      const scatterX = Math.cos(scatterAngle) * scatterDist;
      const scatterY = Math.sin(scatterAngle) * scatterDist * 0.7;

      setPopups((prev) => {
        const now = Date.now();
        const fresh = prev.filter((p) => now - p.timestamp < 1100);
        return [
          ...fresh.slice(-8), // Keep max 8 simultaneous numbers
          {
            id: evt.id + '_' + Math.random().toString(36).substring(2, 6),
            worldX: evt.x,
            worldY: evt.y + (isTaken ? 1.4 : 1.6),
            worldZ: evt.z,
            amount: evt.amount,
            isSword: evt.isSword,
            isMine,
            isTaken,
            scatterX,
            scatterY,
            timestamp: now,
          },
        ];
      });
    });

    return () => {
      unsub();
    };
  }, []);

  // Update screen coordinates using Three.js Camera Projection at 60 FPS
  useEffect(() => {
    if (popups.length === 0) return;

    let animId: number;
    const tempVec = new Vector3();

    const updateProjections = () => {
      if (globalThreeCamera && typeof window !== 'undefined') {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const newMap: Record<string, { x: number; y: number; visible: boolean }> = {};

        for (const p of popups) {
          tempVec.set(p.worldX, p.worldY, p.worldZ);
          tempVec.project(globalThreeCamera);

          // Check if point is in front of camera
          const isFront = tempVec.z < 1.0;
          const screenX = (tempVec.x * 0.5 + 0.5) * width;
          const screenY = (-(tempVec.y * 0.5) + 0.5) * height;

          const inBounds = screenX >= -100 && screenX <= width + 100 && screenY >= -100 && screenY <= height + 100;

          newMap[p.id] = {
            x: screenX,
            y: screenY,
            visible: isFront && inBounds,
          };
        }

        screenPosMap.current = newMap;
        forceUpdate((n) => (n + 1) % 10000);
      }

      animId = requestAnimationFrame(updateProjections);
    };

    animId = requestAnimationFrame(updateProjections);
    return () => cancelAnimationFrame(animId);
  }, [popups]);

  if (popups.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden select-none">
      {popups.map((p) => {
        const pos = screenPosMap.current[p.id];
        const age = Date.now() - p.timestamp;
        const progress = Math.min(1, age / 950);

        // Pop & float upward animation with elastic bounce
        const easeOutBack = (t: number) => {
          const c1 = 1.70158;
          const c3 = c1 + 1;
          return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        };

        const popScale = progress < 0.25 ? Math.max(0.6, easeOutBack(progress / 0.25) * 1.3) : Math.max(0.8, 1.3 - (progress - 0.25) * 0.5);
        const floatUp = -progress * 55;
        const opacity = progress > 0.65 ? Math.max(0, 1 - (progress - 0.65) / 0.35) : 1;

        // Base screen coords with scatter offset and floatUp
        const left = pos ? pos.x + p.scatterX : window.innerWidth / 2 + p.scatterX;
        const top = pos ? pos.y + p.scatterY + floatUp : window.innerHeight / 2 + p.scatterY + floatUp;
        const isVisible = pos ? pos.visible : true;

        if (!isVisible || opacity <= 0.01) return null;

        let badgeStyle = 'bg-amber-400 text-slate-950 border-amber-200 shadow-amber-500/60';
        let icon = '💥';
        let label = `-${p.amount}`;

        if (p.isTaken) {
          badgeStyle = 'bg-red-600 text-white border-red-300 shadow-red-600/70 animate-pulse';
          icon = '🛡️';
          label = `HIT -${p.amount}`;
        } else if (p.isMine) {
          if (p.isSword) {
            badgeStyle = 'bg-rose-500 text-white border-rose-200 shadow-rose-500/70 font-black';
            icon = '⚔️';
          } else if (p.amount >= 30) {
            badgeStyle = 'bg-yellow-300 text-black border-yellow-100 shadow-yellow-400/80 scale-110';
            icon = '⚡';
            label = `CRIT -${p.amount}`;
          }
        } else {
          badgeStyle = 'bg-slate-800/90 text-slate-200 border-slate-600 shadow-black/40 text-xs';
        }

        return (
          <div
            key={p.id}
            className="absolute pointer-events-none transition-opacity duration-75 will-change-transform"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              transform: `translate(-50%, -50%) scale(${popScale})`,
              opacity,
            }}
          >
            <div
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-black text-sm sm:text-base tracking-tight shadow-xl border backdrop-blur-xs whitespace-nowrap ${badgeStyle}`}
            >
              <span className="text-xs sm:text-sm drop-shadow-sm">{icon}</span>
              <span className="drop-shadow-md font-mono">{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
});
