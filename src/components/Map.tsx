import React, { memo } from 'react';
import { useGameStore } from '../store';
import { Obstacle } from '../types';
import { BoxGeometry, SphereGeometry, RingGeometry, CylinderGeometry, MeshStandardMaterial, MeshBasicMaterial } from 'three';

// Shared singletons for items & bombs
const sharedItemGeo = new BoxGeometry(1.4, 1.4, 1.4);
const sharedItemRingGeo = new RingGeometry(0.8, 1.3, 16);
const sharedItemRingMat = new MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.5, side: 2 });

// Shared materials for all pickup item types
const sharedHealMat = new MeshStandardMaterial({ color: '#10b981', emissive: '#059669', emissiveIntensity: 0.8, roughness: 0.2 });
const sharedWeaponMat = new MeshStandardMaterial({ color: '#f59e0b', emissive: '#d97706', emissiveIntensity: 0.8, roughness: 0.2 });
const sharedSpeedMat = new MeshStandardMaterial({ color: '#06b6d4', emissive: '#0891b2', emissiveIntensity: 0.9, roughness: 0.2 });
const sharedPowerMat = new MeshStandardMaterial({ color: '#dc2626', emissive: '#b91c1c', emissiveIntensity: 0.9, roughness: 0.2 });
const sharedSmokeMat = new MeshStandardMaterial({ color: '#64748b', emissive: '#475569', emissiveIntensity: 0.6, roughness: 0.4 });
const sharedStunMat = new MeshStandardMaterial({ color: '#fde047', emissive: '#eab308', emissiveIntensity: 0.95, roughness: 0.1 });
const sharedShadowMat = new MeshStandardMaterial({ color: '#8b5cf6', emissive: '#6d28d9', emissiveIntensity: 0.85, roughness: 0.2 });

const sharedCrateWoodMat = new MeshStandardMaterial({ color: '#b45309', roughness: 0.75, metalness: 0.1 });
const sharedCrateIronMat = new MeshStandardMaterial({ color: '#334155', roughness: 0.4, metalness: 0.6 });
const sharedCrateDecalMat = new MeshStandardMaterial({ color: '#f59e0b', roughness: 0.5 });

// Memoized static obstacles component: clean low-poly stylized styling with destructible wooden crates
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
        const baseColor = obs.color || (isCrate ? '#b45309' : isWall ? '#64748b' : isPillar ? '#0f172a' : isBuilding ? '#334155' : isBunker ? '#1e293b' : '#475569');

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

        if (isCrate) {
          const hpPercent = obs.hp !== undefined ? Math.max(0, obs.hp / (obs.maxHp || 40)) : 1;
          const isDamaged = hpPercent < 1;

          return (
            <group key={obs.id} position={[obs.x, obs.height / 2, obs.z]}>
              {/* Main Wooden Crate Body */}
              <mesh castShadow receiveShadow material={sharedCrateWoodMat}>
                <boxGeometry args={[obs.width, obs.height, obs.depth]} />
              </mesh>

              {/* Steel Corner Edges & Cross Braces */}
              <mesh material={sharedCrateIronMat}>
                <boxGeometry args={[obs.width * 1.02, obs.height * 0.15, obs.depth * 1.02]} />
              </mesh>
              <mesh position={[0, obs.height * 0.38, 0]} material={sharedCrateIronMat}>
                <boxGeometry args={[obs.width * 1.02, obs.height * 0.12, obs.depth * 1.02]} />
              </mesh>
              <mesh position={[0, -obs.height * 0.38, 0]} material={sharedCrateIronMat}>
                <boxGeometry args={[obs.width * 1.02, obs.height * 0.12, obs.depth * 1.02]} />
              </mesh>

              {/* Crate Center Stencil Cross */}
              <mesh position={[0, 0, obs.depth / 2 + 0.02]} rotation={[0, 0, Math.PI / 4]} material={sharedCrateDecalMat}>
                <boxGeometry args={[obs.width * 0.45, 0.25, 0.02]} />
              </mesh>
              <mesh position={[0, 0, -obs.depth / 2 - 0.02]} rotation={[0, 0, Math.PI / 4]} material={sharedCrateDecalMat}>
                <boxGeometry args={[obs.width * 0.45, 0.25, 0.02]} />
              </mesh>

              {/* Destructible HP Bar when damaged */}
              {isDamaged && (
                <group position={[0, obs.height / 2 + 0.6, 0]}>
                  {/* Background Bar */}
                  <mesh>
                    <boxGeometry args={[2.0, 0.22, 0.06]} />
                    <meshBasicMaterial color="#1e293b" />
                  </mesh>
                  {/* Health Fill Bar */}
                  <mesh position={[(hpPercent - 1) * 0.95, 0, 0.02]}>
                    <boxGeometry args={[Math.max(0.01, 1.9 * hpPercent), 0.18, 0.06]} />
                    <meshBasicMaterial color={hpPercent > 0.5 ? '#eab308' : '#ef4444'} />
                  </mesh>
                </group>
              )}
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
      {Object.values(items).map((item) => {
        let mat = sharedWeaponMat;
        let ringColor = '#f59e0b';
        let isPotion = false;
        let isGrenade = false;

        if (item.type === 'heal') {
          mat = sharedHealMat;
          ringColor = '#10b981';
        } else if (item.type === 'speed') {
          mat = sharedSpeedMat;
          ringColor = '#06b6d4';
          isPotion = true;
        } else if (item.type === 'power') {
          mat = sharedPowerMat;
          ringColor = '#dc2626';
          isPotion = true;
        } else if (item.type === 'smoke') {
          mat = sharedSmokeMat;
          ringColor = '#94a3b8';
          isGrenade = true;
        } else if (item.type === 'stun') {
          mat = sharedStunMat;
          ringColor = '#fde047';
          isGrenade = true;
        } else if (item.type === 'shadow') {
          mat = sharedShadowMat;
          ringColor = '#8b5cf6';
        }

        return (
          <group key={item.id} position={[item.x, item.y + 0.35, item.z]}>
            {/* 3D Model depending on Item Type */}
            {isPotion ? (
              // Potion Flask Model
              <group position={[0, 0.2, 0]}>
                <mesh material={mat} castShadow>
                  <cylinderGeometry args={[0.35, 0.45, 0.8, 12]} />
                </mesh>
                <mesh position={[0, 0.5, 0]} material={mat}>
                  <cylinderGeometry args={[0.18, 0.18, 0.3, 10]} />
                </mesh>
                <mesh position={[0, 0.7, 0]} material={sharedCrateIronMat}>
                  <cylinderGeometry args={[0.22, 0.22, 0.12, 10]} />
                </mesh>
              </group>
            ) : isGrenade ? (
              // Grenade Canister Model
              <group position={[0, 0.2, 0]}>
                <mesh material={mat} castShadow>
                  <cylinderGeometry args={[0.3, 0.3, 0.75, 12]} />
                </mesh>
                <mesh position={[0, 0.45, 0]} material={sharedCrateIronMat}>
                  <boxGeometry args={[0.2, 0.2, 0.35]} />
                </mesh>
              </group>
            ) : item.type === 'shadow' ? (
              // Shadow Cloak Orb Model
              <group position={[0, 0.3, 0]}>
                <mesh material={mat} castShadow>
                  <sphereGeometry args={[0.55, 16, 16]} />
                </mesh>
                <mesh rotation={[Math.PI / 3, 0, 0]}>
                  <torusGeometry args={[0.75, 0.05, 8, 24]} />
                  <meshBasicMaterial color="#a78bfa" />
                </mesh>
              </group>
            ) : item.type === 'heal' ? (
              // Medkit Chest Model with Green Cross
              <group position={[0, 0.2, 0]}>
                <mesh material={mat} castShadow>
                  <boxGeometry args={[1.1, 0.75, 0.6]} />
                </mesh>
                {/* White Cross */}
                <mesh position={[0, 0, 0.32]}>
                  <boxGeometry args={[0.45, 0.14, 0.02]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                <mesh position={[0, 0, 0.32]}>
                  <boxGeometry args={[0.14, 0.45, 0.02]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              </group>
            ) : (
              // Golden Weapon Crate with Star
              <group position={[0, 0.2, 0]}>
                <mesh material={mat} castShadow>
                  <boxGeometry args={[1.2, 0.8, 0.7]} />
                </mesh>
                <mesh position={[0, 0.42, 0]} material={sharedCrateIronMat}>
                  <boxGeometry args={[1.25, 0.1, 0.75]} />
                </mesh>
              </group>
            )}

            {/* Glowing Ground Aura Ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
              <ringGeometry args={[0.6, 1.2, 16]} />
              <meshBasicMaterial color={ringColor} transparent opacity={0.65} side={2} />
            </mesh>
          </group>
        );
      })}
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
