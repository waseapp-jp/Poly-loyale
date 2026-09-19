import React from 'react';
import { Zap, Check, X, ShieldAlert } from 'lucide-react';
import { useGameStore, P2PInviteNotification } from '../store';
import { CharacterClass, CLASS_STATS } from '../types';

interface P2PInviteModalProps {
  invite: P2PInviteNotification | null;
  selectedClass: CharacterClass;
}

export const P2PInviteModal: React.FC<P2PInviteModalProps> = ({ invite, selectedClass }) => {
  const { acceptP2PInvite, declineP2PInvite } = useGameStore();

  if (!invite) return null;

  const declinerName = localStorage.getItem('poly_player_name') || 'Player';

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.3)] overflow-hidden p-6 space-y-5 text-center">
        
        {/* Animated Glow Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 animate-pulse shadow-lg">
          <Zap className="w-9 h-9 text-amber-400" />
        </div>

        {/* Header Title */}
        <div className="space-y-1">
          <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">
            ⚡ P2P 1v1 VERSUS INVITATION ⚡
          </span>
          <h3 className="text-2xl font-black text-white tracking-wide">
            1v1 タイマン対戦の招待！
          </h3>
        </div>

        {/* Content Details */}
        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
          <p className="text-sm text-slate-300">
            フレンドの <span className="text-amber-400 font-extrabold text-base">{invite.inviterName}</span> さんから
          </p>
          <p className="text-xs text-slate-400">
            超低遅延 WebRTC P2P 二人きりバトルへの招待が届いています！
          </p>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>使用クラス: <strong className="text-white">{CLASS_STATS[selectedClass]?.color ? selectedClass.toUpperCase() : 'MELEE'}</strong></span>
            <span className="text-amber-400 font-mono">P2P Peer Direct</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => declineP2PInvite(invite, declinerName)}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl border border-slate-700 transition-all flex items-center justify-center space-x-1.5"
          >
            <X className="w-4 h-4" />
            <span>辞退する</span>
          </button>

          <button
            onClick={() => acceptP2PInvite(invite, selectedClass)}
            className="w-full py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>参戦する！</span>
          </button>
        </div>

      </div>
    </div>
  );
};
