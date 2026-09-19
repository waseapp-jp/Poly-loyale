import React from 'react';
import { Zap, Wifi, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../store';

export const P2PStatusBadge: React.FC = () => {
  const { p2pState, p2pPing, gameState } = useGameStore();

  if (!gameState || gameState.mode !== 'p2p_duel') return null;

  return (
    <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-900/90 border border-amber-500/40 backdrop-blur-md rounded-xl text-xs font-bold text-white shadow-lg animate-fadeIn">
      <div className="flex items-center space-x-1.5">
        <Zap className={`w-4 h-4 ${p2pState === 'connected' ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
        <span className="text-amber-400 font-black">P2P 1v1</span>
      </div>

      <div className="h-3 w-px bg-slate-700" />

      {p2pState === 'connected' ? (
        <div className="flex items-center space-x-1 text-emerald-400">
          <Wifi className="w-3.5 h-3.5" />
          <span className="font-mono">{p2pPing > 0 ? `${p2pPing}ms` : '超低遅延'}</span>
        </div>
      ) : p2pState === 'connecting' ? (
        <div className="text-amber-300 animate-pulse flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>ピア接続中...</span>
        </div>
      ) : (
        <div className="flex items-center space-x-1 text-slate-400">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span>サーバー同期</span>
        </div>
      )}
    </div>
  );
};
