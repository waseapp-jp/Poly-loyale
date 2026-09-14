import React, { memo } from 'react';
import { useGameStore } from '../store';
import { Obstacle } from '../types';
import { BoxGeometry, SphereGeometry, RingGeometry, MeshStandardMaterial, MeshBasicMaterial } from 'three';

// Shared singletons for items & bombs
const sharedItemGeo = new BoxGeometry(1.6, 1.6, 1.6);
const sharedHealMat = new MeshStandardMaterial({
  color: '#10b981',
  emissive: '#059669',
  emissiveIntensity: 0.8,
  roughness: 0.2,
  metalness: 0.5,
});
const sharedWeaponMat = new MeshStandardMaterial({
  color: '#f59e0b',
  emissive: '#d97706',
  emissiveIntensity: 0.8,
  roughness: 0.2,
  metalness: 0.5,
});

const sharedBombExplodeGeo = new SphereGeometry(4.2, 12, 12);
const sharedBombExplodeMat = new MeshBasicMaterial({ color: '#f97316', transparent: true, opacity: 0.85 });
const sharedBombCoreGeo = new SphereGeometry(2.5, 8, 8);
const sharedBombCoreMat = new MeshBasicMaterial({ color: '#ffffff' });
const sharedShockwaveGeo = new RingGeometry(1, 7.5, 16);
const sharedShockwaveMat = new MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.6, side: 2 });

const sharedBombBodyGeo = new SphereGeometry(0.55, 10, 10);
const sharedBombBodyMat = new MeshStandardMaterial({ color: '#1e293b', roughness: 0.3, metalness: 0.7 });
const sharedBombCapGeo = new BoxGeometry(0.25, 0.2, 0.25);
const sharedBombCapMat = new MeshStandardMaterial({ color: '#475569', metalness: 0.9 });
const sharedBombRingGeo = new RingGeometry(0.3, 1.8, 16);
const sharedBombRingMat = new MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.5, side: 2 });

// Memoized static obstacles component: only re-renders if obstacles dictionary reference changes
const StaticObstacles = memo(function StaticObstacles({ obstacles }: { obstacles?: Record<string, Obstacle> }) {
  if (!obstacles) return null;

  return (
    <>
      {Object.values(obstacles).map((obs) => {
        const isCrate = obs.type === 'crate';
        const isWall = obs.type === 'wall';
        const isPillar = obs.type === 'pillar';
        const isBuilding = obs.type === 'building';
        const isBunker = obs.type === 'bunker';
        const baseColor = obs.color || (isCrate ? '#d97706' : isWall ? '#64748b' : isPillar ? '#0f172a' : isBuilding ? '#334155' : isBunker ? '#1e293b' : '#475569');

        if (obs.type === 'ramp') {
          const lenX = obs.width;
          const lenZ = obs.depth;
          const h = obs.height;
          let rx = 0;
          let rz = 0;
          let rampLength = lenZ;
          let rampWidth = lenX;

          if (obs.rampDir === 'px') {
            rampLength = Math.hypot(lenX, h);
            rampWidth = lenZ;
            rz = Math.atan2(h, lenX);
          } else if (obs.rampDir === 'nx') {
            rampLength = Math.hypot(lenX, h);
            rampWidth = lenZ;
            rz = -Math.atan2(h, lenX);
          } else if (obs.rampDir === 'pz') {
            rampLength = Math.hypot(lenZ, h);
            rampWidth = lenX;
            rx = -Math.atan2(h, lenZ);
          } else if (obs.rampDir === 'nz') {
            rampLength = Math.hypot(lenZ, h);
            rampWidth = lenX;
            rx = Math.atan2(h, lenZ);
          }

          return (
            <group key={obs.id} position={[obs.x, h / 2, obs.z]}>
              <mesh rotation={[rx, 0, rz]}>
                <boxGeometry args={[obs.rampDir === 'px' || obs.rampDir === 'nx' ? rampLength : rampWidth, 0.4, obs.rampDir === 'pz' || obs.rampDir === 'nz' ? rampLength : rampWidth]} />
                <meshStandardMaterial color={baseColor} roughness={0.7} metalness={0.2} />
              </mesh>
            </group>
          );
        }

        return (
          <group key={obs.id} position={[obs.x, obs.height / 2, obs.z]}>
            <mesh>
              <boxGeometry args={[obs.width, obs.height, obs.depth]} />
              <meshStandardMaterial 
                color={baseColor} 
                roughness={isCrate ? 0.8 : 0.5} 
                metalness={isBuilding || isPillar ? 0.35 : 0.15} 
              />
            </mesh>

            {/* Accent Roof Trim for Buildings and Bunkers */}
            {(isBuilding || isBunker) && (
              <mesh position={[0, obs.height / 2 + 0.15, 0]}>
                <boxGeometry args={[obs.width * 1.02, 0.3, obs.depth * 1.02]} />
                <meshStandardMaterial color="#0ea5e9" emissive="#0284c7" emissiveIntensity={0.2} roughness={0.4} metalness={0.8} />
              </mesh>
            )}

            {/* Industrial cross-brace or rim for crates */}
            {isCrate && (
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[obs.width * 1.01, obs.height * 0.1, obs.depth * 1.01]} />
                <meshStandardMaterial color="#78350f" roughness={0.9} />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}, (prev, next) => prev.obstacles === next.obstacles);

const GroundItems = memo(function GroundItems() {
  const items = useGameStore((s) => s.gameState?.items);
  if (!items) return null;

  return (
    <>
      {Object.values(items).map((item) => (
        <group key={item.id} position={[item.x, item.y, item.z]}>
          <mesh
            geometry={sharedItemGeo}
            material={item.type === 'heal' ? sharedHealMat : sharedWeaponMat}
          />
        </group>
      ))}
    </>
  );
});

const ActiveBombs = memo(function ActiveBombs() {
  const bombs = useGameStore((s) => s.gameState?.bombs);
  if (!bombs) return null;

  return (
    <>
      {Object.values(bombs).map((bomb) => {
        if (bomb.exploded) {
          return (
            <group key={bomb.id} position={[bomb.x, Math.max(0.5, bomb.y), bomb.z]}>
              <mesh geometry={sharedBombExplodeGeo} material={sharedBombExplodeMat} />
              <mesh geometry={sharedBombCoreGeo} material={sharedBombCoreMat} />
              <mesh geometry={sharedShockwaveGeo} material={sharedShockwaveMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]} />
            </group>
          );
        }

        return (
          <group 
            key={bomb.id} 
            position={[bomb.x, Math.max(0.35, bomb.y), bomb.z]} 
            rotation={[bomb.rx || 0, bomb.ry || 0, bomb.rz || 0]}
          >
            <mesh geometry={sharedBombBodyGeo} material={sharedBombBodyMat} />
            <mesh geometry={sharedBombCapGeo} material={sharedBombCapMat} position={[0, 0.55, 0]} />
            <mesh geometry={sharedBombRingGeo} material={sharedBombRingMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} />
          </group>
        );
      })}
    </>
  );
});

export function Map() {
  const obstacles = useGameStore((s) => s.gameState?.obstacles);

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#334155" roughness={0.85} metalness={0.15} />
      </mesh>

      {/* Grid Floor Overlay for Arena Vibe */}
      <gridHelper args={[200, 20, '#64748b', '#475569']} position={[0, 0.05, 0]} />

      {/* Memoized Static Obstacles */}
      <StaticObstacles obstacles={obstacles} />

      {/* Ground items and bombs */}
      <GroundItems />
      <ActiveBombs />
    </group>
  );
}
