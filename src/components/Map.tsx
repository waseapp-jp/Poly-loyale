import React, { memo } from 'react';
import { useGameStore } from '../store';
import { Obstacle } from '../types';
import { BoxGeometry, SphereGeometry, RingGeometry, CylinderGeometry, MeshStandardMaterial, MeshBasicMaterial } from 'three';

// Shared singletons for items & bombs
const sharedItemGeo = new BoxGeometry(1.4, 1.4, 1.4);
const sharedItemRingGeo = new RingGeometry(0.8, 1.3, 16);
const sharedItemRingMat = new MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.5, side: 2 });

const sharedHealMat = new MeshStandardMaterial({
  color: '#10b981',
  emissive: '#059669',
  emissiveIntensity: 0.6,
  roughness: 0.3,
  metalness: 0.2,
});
const sharedWeaponMat = new MeshStandardMaterial({
  color: '#f59e0b',
  emissive: '#d97706',
  emissiveIntensity: 0.6,
  roughness: 0.3,
  metalness: 0.2,
});

const sharedBombExplodeGeo = new SphereGeometry(4.2, 12, 12);
const sharedBombExplodeMat = new MeshBasicMaterial({ color: '#f97316', transparent: true, opacity: 0.85 });
const sharedBombCoreGeo = new SphereGeometry(2.5, 8, 8);
const sharedBombCoreMat = new MeshBasicMaterial({ color: '#ffffff' });
const sharedShockwaveGeo = new RingGeometry(1, 7.5, 16);
const sharedShockwaveMat = new MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.6, side: 2 });

const sharedBombBodyGeo = new SphereGeometry(0.55, 10, 10);
const sharedBombBodyMat = new MeshStandardMaterial({ color: '#1e293b', roughness: 0.3, metalness: 0.5 });
const sharedBombCapGeo = new BoxGeometry(0.25, 0.2, 0.25);
const sharedBombCapMat = new MeshStandardMaterial({ color: '#475569', metalness: 0.7 });
const sharedBombRingGeo = new RingGeometry(0.3, 1.8, 16);
const sharedBombRingMat = new MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.5, side: 2 });

// Memoized static obstacles component: clean low-poly stylized styling
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
              <mesh rotation={[rx, 0, rz]} castShadow receiveShadow>
                <boxGeometry args={[obs.rampDir === 'px' || obs.rampDir === 'nx' ? rampLength : rampWidth, 0.4, obs.rampDir === 'pz' || obs.rampDir === 'nz' ? rampLength : rampWidth]} />
                <meshStandardMaterial color={baseColor} roughness={0.4} metalness={0.2} />
              </mesh>
            </group>
          );
        }

        return (
          <group key={obs.id} position={[obs.x, obs.height / 2, obs.z]}>
            {/* Clean low-poly structure */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[obs.width, obs.height, obs.depth]} />
              <meshStandardMaterial 
                color={baseColor} 
                roughness={0.4} 
                metalness={0.25} 
              />
            </mesh>

            {/* Clean Accent Roof Trim for Buildings and Bunkers */}
            {(isBuilding || isBunker) && (
              <mesh position={[0, obs.height / 2 + 0.15, 0]} castShadow receiveShadow>
                <boxGeometry args={[obs.width * 1.02, 0.3, obs.depth * 1.02]} />
                <meshStandardMaterial color="#0ea5e9" emissive="#0284c7" emissiveIntensity={0.4} roughness={0.3} metalness={0.3} />
              </mesh>
            )}

            {/* Clean stylized crate trim */}
            {isCrate && (
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[obs.width * 1.01, obs.height * 0.12, obs.depth * 1.01]} />
                <meshStandardMaterial color="#78350f" roughness={0.7} />
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
        <group key={item.id} position={[item.x, item.y + 0.2, item.z]}>
          <mesh
            geometry={sharedItemGeo}
            material={item.type === 'heal' ? sharedHealMat : sharedWeaponMat}
            castShadow
          />
          <mesh
            geometry={sharedItemRingGeo}
            material={sharedItemRingMat}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.6, 0]}
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

        if (bomb.isMine) {
          return (
            <group key={bomb.id} position={[bomb.x, Math.max(0.05, bomb.y), bomb.z]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.5, 0.6, 0.2, 16]} />
                <meshStandardMaterial color="#b91c1c" roughness={0.5} metalness={0.2} />
              </mesh>
              <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 0.1, 8]} />
                <meshStandardMaterial color="#f87171" emissive="#ef4444" emissiveIntensity={0.8} />
              </mesh>
              <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.6, 0.8, 16]} />
                <meshBasicMaterial color="#ef4444" transparent opacity={0.3} />
              </mesh>
            </group>
          );
        }

        return (
          <group 
            key={bomb.id} 
            position={[bomb.x, Math.max(0.35, bomb.y), bomb.z]} 
            rotation={[bomb.rx || 0, bomb.ry || 0, bomb.rz || 0]}
          >
            <mesh geometry={sharedBombBodyGeo} material={sharedBombBodyMat} castShadow />
            <mesh geometry={sharedBombCapGeo} material={sharedBombCapMat} position={[0, 0.55, 0]} castShadow />
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
      {/* Clean Stylized Low-Poly Ground Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.2} />
      </mesh>

      {/* Clean Poly Arena Grid Lines */}
      <gridHelper args={[240, 60, '#0284c7', '#334155']} position={[0, 0.01, 0]} />

      {/* Memoized Static Obstacles */}
      <StaticObstacles obstacles={obstacles} />

      {/* Ground items and bombs */}
      <GroundItems />
      <ActiveBombs />
    </group>
  );
}
