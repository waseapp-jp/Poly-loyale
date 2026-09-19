import React from 'react';
import { RankTier, RANK_CONFIGS } from '../utils/rankUtils';
import { Sparkles, Crown, Flame, Shield, Award, Gem, Zap } from 'lucide-react';

interface RankAuraEffectProps {
  tier: RankTier;
  children: React.ReactNode;
  className?: string;
  showBadge?: boolean;
}

export function RankAuraEffect({
  tier,
  children,
  className = '',
  showBadge = false,
}: RankAuraEffectProps) {
  const config = RANK_CONFIGS[tier];

  // Specific particle configurations based on rank
  const particleCount =
    tier === 'God'
      ? 12
      : tier === 'GrandMaster'
      ? 10
      : tier === 'Master'
      ? 8
      : tier === 'Diamond'
      ? 6
      : tier === 'Platinum'
      ? 5
      : tier === 'Gold'
      ? 4
      : 2;

  return (
    <div
      id={`rank-aura-wrapper-${tier.toLowerCase()}`}
      className={`relative group rounded-2xl transition-all duration-500 ${className}`}
    >
      {/* 1. Ambient Background Glow (Outer Halo) */}
      <div
        className={`absolute -inset-1.5 rounded-3xl opacity-75 blur-md pointer-events-none transition-all duration-500 animate-rank-pulse ${config.auraGlow}`}
        style={{
          background:
            tier === 'God'
              ? 'conic-gradient(from 0deg, #f59e0b, #ec4899, #8b5cf6, #3b82f6, #10b981, #f59e0b)'
              : tier === 'GrandMaster'
              ? 'radial-gradient(circle, rgba(239,68,68,0.4) 0%, rgba(185,28,28,0.1) 70%)'
              : tier === 'Master'
              ? 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, rgba(126,34,206,0.1) 70%)'
              : tier === 'Diamond'
              ? 'radial-gradient(circle, rgba(56,189,248,0.4) 0%, rgba(2,132,199,0.1) 70%)'
              : tier === 'Platinum'
              ? 'radial-gradient(circle, rgba(34,211,238,0.35) 0%, rgba(8,145,178,0.1) 70%)'
              : tier === 'Gold'
              ? 'radial-gradient(circle, rgba(250,204,21,0.35) 0%, rgba(202,138,4,0.1) 70%)'
              : tier === 'Silver'
              ? 'radial-gradient(circle, rgba(226,232,240,0.2) 0%, rgba(148,163,184,0.05) 70%)'
              : tier === 'Bronze'
              ? 'radial-gradient(circle, rgba(217,119,6,0.2) 0%, rgba(146,64,14,0.05) 70%)'
              : 'transparent',
        }}
      />

      {/* 2. Rotating Conic Aura Ring (for Master, GrandMaster, God) */}
      {(tier === 'Master' || tier === 'GrandMaster' || tier === 'God') && (
        <div className="absolute -inset-1 rounded-2xl overflow-hidden pointer-events-none opacity-40">
          <div
            className={`w-[200%] h-[200%] -top-[50%] -left-[50%] absolute animate-rank-rotate ${
              tier === 'God' ? 'animate-god-cosmic' : ''
            }`}
            style={{
              background:
                tier === 'God'
                  ? 'conic-gradient(from 0deg, #f59e0b, #ec4899, #8b5cf6, #3b82f6, #10b981, #f59e0b)'
                  : tier === 'GrandMaster'
                  ? 'conic-gradient(from 0deg, transparent, #ef4444, transparent, #b91c1c, transparent)'
                  : 'conic-gradient(from 0deg, transparent, #a855f7, transparent, #6b21a8, transparent)',
            }}
          />
        </div>
      )}

      {/* 3. Floating Sparkle / Ember Particles */}
      {particleCount > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-visible z-10">
          {Array.from({ length: particleCount }).map((_, i) => {
            const left = 8 + (i * 84) / Math.max(1, particleCount - 1);
            const delay = (i * 0.45) % 2.4;
            const duration = 2.2 + (i % 3) * 0.5;
            const size = tier === 'God' || tier === 'GrandMaster' ? 6 : 4;

            return (
              <span
                key={i}
                className="absolute bottom-1 rounded-full pointer-events-none"
                style={{
                  left: `${left}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: config.primaryColor,
                  boxShadow: `0 0 10px ${config.primaryColor}`,
                  animation: `rankParticleDrift ${duration}s ease-in-out infinite`,
                  animationDelay: `${delay}s`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* 4. Actual Card Frame with Border Highlight & Shimmer */}
      <div
        className={`relative z-10 rounded-2xl overflow-hidden border-2 transition-colors duration-300 ${
          config.borderColor
        } ${tier === 'God' ? 'animate-god-cosmic' : ''}`}
      >
        {/* Light Sweep Shimmer Effect */}
        {(tier === 'Gold' ||
          tier === 'Platinum' ||
          tier === 'Diamond' ||
          tier === 'Master' ||
          tier === 'GrandMaster' ||
          tier === 'God') && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
            <div
              className="w-1/2 h-[200%] absolute -top-1/2 left-0 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-rank-shimmer pointer-events-none"
              style={{
                filter: tier === 'God' ? 'blur(1px)' : 'none',
              }}
            />
          </div>
        )}

        {/* Optional Rank Badge Header */}
        {showBadge && (
          <div
            id={`rank-crest-header-${tier.toLowerCase()}`}
            className="flex items-center justify-between px-3.5 py-1.5 border-b border-white/10 text-xs font-bold"
            style={{
              backgroundColor:
                tier === 'God'
                  ? 'rgba(245, 158, 11, 0.15)'
                  : tier === 'GrandMaster'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : tier === 'Master'
                  ? 'rgba(168, 85, 247, 0.15)'
                  : tier === 'Diamond'
                  ? 'rgba(56, 189, 248, 0.12)'
                  : tier === 'Platinum'
                  ? 'rgba(34, 211, 238, 0.12)'
                  : tier === 'Gold'
                  ? 'rgba(250, 204, 21, 0.12)'
                  : 'rgba(30, 41, 59, 0.5)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base leading-none">{config.badgeEmoji}</span>
              <span
                className="font-black uppercase tracking-wider text-xs"
                style={{ color: config.primaryColor }}
              >
                {config.tier}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                ({config.labelJa})
              </span>
            </div>

            <div className="flex items-center gap-1 text-[11px]">
              <Sparkles size={12} style={{ color: config.primaryColor }} />
              <span className="font-semibold text-slate-300">{config.title}</span>
            </div>
          </div>
        )}

        {/* Card Content Children */}
        {children}
      </div>
    </div>
  );
}

export function RankTierPill({
  tier,
  isActive = false,
  onClick,
}: {
  tier: RankTier;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const config = RANK_CONFIGS[tier];

  return (
    <button
      id={`rank-tier-pill-${tier.toLowerCase()}`}
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
        isActive
          ? 'scale-105 shadow-md ring-2 ring-white/50 text-white'
          : 'opacity-70 hover:opacity-100 bg-slate-800 text-slate-300 hover:bg-slate-700'
      }`}
      style={{
        backgroundColor: isActive ? config.primaryColor : undefined,
        color: isActive && tier === 'Gold' ? '#0f172a' : undefined,
      }}
    >
      <span>{config.badgeEmoji}</span>
      <span>{config.tier}</span>
    </button>
  );
}
