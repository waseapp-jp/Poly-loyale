import React, { useState } from 'react';
import { MatchHistoryData } from '../firebase';
import { Trophy, Swords, Star, Calendar, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface MatchHistoryProps {
  history: MatchHistoryData[];
  isLoading: boolean;
}

const MODE_LABELS: Record<string, { label: string; color: string }> = {
  ranked: { label: 'ランク戦', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  casual: { label: 'カジュアル', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  bot: { label: 'AI Solo (Bot戦)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  team: { label: 'チーム戦', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  password: { label: 'カスタム', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
};

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${month}/${day} ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

export function MatchHistory({ history, isLoading }: MatchHistoryProps) {
  const [filterMode, setFilterMode] = useState<string>('all');

  const filtered = history.filter((item) => {
    if (filterMode === 'all') return true;
    return item.mode === filterMode;
  });

  const availableModes = Array.from(new Set(history.map((h) => h.mode).filter(Boolean)));

  if (isLoading) {
    return (
      <div id="match-history-loading" className="py-12 text-center text-slate-400 font-bold animate-pulse">
        対戦履歴を読み込み中...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div id="match-history-empty" className="py-10 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
        <Clock size={32} className="text-slate-600 mb-1" />
        <p className="font-semibold text-slate-300">対戦履歴がありません</p>
        <p className="text-xs text-slate-500">ゲームをプレイしてマッチ結果をFirestoreに記録しましょう！</p>
      </div>
    );
  }

  return (
    <div id="match-history-section" className="flex flex-col flex-1 min-h-0">
      {/* Mode Filters */}
      {availableModes.length > 1 && (
        <div id="match-history-filters" className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 text-xs select-none">
          <button
            id="match-filter-all"
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
              filterMode === 'all'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            すべて ({history.length})
          </button>
          {availableModes.map((m) => {
            const count = history.filter((h) => h.mode === m).length;
            const modeMeta = MODE_LABELS[m] || { label: m };
            return (
              <button
                key={m}
                id={`match-filter-${m}`}
                type="button"
                onClick={() => setFilterMode(m)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  filterMode === m
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                {modeMeta.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Match List */}
      <div id="match-history-scroll-list" className="space-y-2.5 max-h-72 overflow-y-auto pr-1 select-none">
        {filtered.map((item, idx) => {
          const isVictory = item.placement === 1;
          const isTopThree = item.placement <= 3;
          const modeMeta = MODE_LABELS[item.mode] || {
            label: item.mode || 'Casual',
            color: 'bg-slate-700 text-slate-300 border-slate-600',
          };

          // Fallback calculation for score if not recorded in legacy entries
          const computedScore =
            typeof item.score === 'number'
              ? item.score
              : item.kills * 100 + (isVictory ? 500 : Math.max(0, 150 - item.placement * 15));

          return (
            <div
              key={item.id || idx}
              id={`match-item-${item.id || idx}`}
              className={`p-3 rounded-xl border transition-all ${
                isVictory
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.12)]'
                  : item.placement === 2
                  ? 'bg-slate-800/80 border-slate-400/40'
                  : item.placement === 3
                  ? 'bg-slate-800/80 border-amber-700/40'
                  : 'bg-slate-800/60 border-slate-700/70 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                {/* Left: Placement and Mode */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Placement Badge */}
                  <div
                    className={`flex items-center justify-center font-black text-xs px-2.5 py-1 rounded-lg border shrink-0 ${
                      isVictory
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-sm'
                        : isTopThree
                        ? 'bg-slate-700 text-white border-slate-500'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {isVictory ? (
                      <span className="flex items-center gap-1">
                        <Trophy size={13} className="text-slate-950 fill-slate-950" />
                        <span>1位 勝利</span>
                      </span>
                    ) : (
                      <span>#{item.placement}位</span>
                    )}
                  </div>

                  {/* Game Mode Badge */}
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${modeMeta.color}`}
                  >
                    {modeMeta.label}
                  </span>

                  {/* Date */}
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 hidden sm:flex truncate">
                    <Calendar size={11} className="text-slate-500" />
                    <span>{formatDate(item.createdAt)}</span>
                  </span>
                </div>

                {/* Right: Score, Kills, and Rating */}
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  {/* Score */}
                  <div
                    id={`match-score-${item.id || idx}`}
                    className="flex items-center gap-1 font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20"
                    title="獲得スコア"
                  >
                    <Star size={12} className="text-amber-400 fill-amber-400" />
                    <span>{computedScore.toLocaleString()} pts</span>
                  </div>

                  {/* Kills */}
                  <div
                    id={`match-kills-${item.id || idx}`}
                    className="flex items-center gap-1 font-bold text-red-300"
                    title="撃破数"
                  >
                    <Swords size={12} className="text-red-400" />
                    <span>{item.kills}</span>
                  </div>

                  {/* Rating Change (if ranked or changed) */}
                  {item.mode === 'ranked' && (
                    <div
                      id={`match-rating-${item.id || idx}`}
                      className={`flex items-center gap-0.5 font-bold text-[11px] px-1.5 py-0.5 rounded ${
                        item.ratingChange >= 0
                          ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/30'
                          : 'text-rose-300 bg-rose-500/10 border border-rose-500/30'
                      }`}
                      title={`試合後レート: ${item.newRating?.toFixed(0) || '-'}`}
                    >
                      {item.ratingChange >= 0 ? (
                        <TrendingUp size={11} className="text-emerald-400" />
                      ) : (
                        <TrendingDown size={11} className="text-rose-400" />
                      )}
                      <span>
                        {item.ratingChange >= 0 ? `+${item.ratingChange.toFixed(0)}` : item.ratingChange.toFixed(0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
