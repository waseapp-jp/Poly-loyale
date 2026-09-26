import React from 'react';
import { Zap, Wifi, Activity, Gauge } from 'lucide-react';
import { useGameStore } from '../store';

interface NetworkStatusBadgeProps {
  onOpenLagModal?: () => void;
}

export const P2PStatusBadge: React.FC<NetworkStatusBadgeProps> = ({ onOpenLagModal }) => {
  const { p2pState, p2pPing, latencyMs, fps, gameState } = useGameStore();

  if (!gameState) return null;

  const isP2P = gameState.mode === 'p2p_duel';
  const activePing = isP2P && p2pPing > 0 ? p2pPing : latencyMs;

  let pingColor = 'text-emerald-400';
  let pingDot = 'bg-emerald-400';
  if (activePing > 120) {
    pingColor = 'text-rose-400';
    pingDot = 'bg-rose-500 animate-pulse';
  } else if (activePing > 55) {
    pingColor = 'text-amber-400';
    pingDot = 'bg-amber-400';
  }

  return (
    <button
      onClick={onOpenLagModal}
      className="flex items-center space-x-2 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800/90 border border-amber-500/40 backdrop-blur-md rounded-xl text-xs font-bold text-white shadow-lg transition-all active:scale-95 cursor-pointer animate-fadeIn group"
      title="クリックしてラグ詳細・通信診断を開く"
    >
      <div className="flex items-center space-x-1.5">
        {isP2P ? (
          <>
            <Zap className={`w-3.5 h-3.5 ${p2pState === 'connected' ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
            <span className="text-amber-400 font-black">P2P 1v1</span>
          </>
        ) : (
          <>
            <Activity className="w-3.5 h-3.5 text-amber-400 group-hover:animate-spin" />
            <span className="text-slate-200 font-bold">通信速度</span>
          </>
        )}
      </div>

      <div className="h-3 w-px bg-slate-700" />

      <div className={`flex items-center space-x-1.5 ${pingColor}`}>
        <span className={`w-2 h-2 rounded-full ${pingDot}`} />
        <Wifi className="w-3.5 h-3.5" />
        <span className="font-mono text-xs">{activePing > 0 ? `${activePing}ms` : '測定中...'}</span>
      </div>

      <div className="hidden sm:flex items-center space-x-1 text-slate-400 text-[11px] font-mono border-l border-slate-800 pl-1.5">
        <Gauge className="w-3 h-3 text-slate-400" />
        <span>{fps} FPS</span>
      </div>
    </button>
  );
};
