import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  linkGoogleAccount,
  logoutUser,
  loadOrCreateUserProfile,
  fetchTopLeaderboard,
  UserProfileData,
  LeaderboardEntryData,
} from '../firebase';
import { Trophy, LogIn, LogOut, Shield, Award, UserCheck, X, Activity, BarChart2, History, Sparkles, RotateCcw, Settings, Mail, MessageSquare, ExternalLink, Share2 } from 'lucide-react';
import { fetchUserHistory, MatchHistoryData } from '../firebase';
import { MatchHistory } from './MatchHistory';
import { getRankTier, RANK_CONFIGS, ALL_RANKS, RankTier } from '../utils/rankUtils';
import { RankAuraEffect, RankTierPill } from './RankAuraEffect';

function RatingHistoryChart({ history }: { history: MatchHistoryData[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const data = [...history].reverse();
  if (data.length === 0) return null;

  const width = 560;
  const height = 180;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 25;

  const ratings = data.map(d => d.newRating);
  const minRating = Math.max(0, Math.min(...ratings) - 40);
  const maxRating = Math.max(...ratings) + 40;
  const range = maxRating - minRating || 1;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const points = data.map((d, i) => {
    const x = padLeft + (data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2);
    const y = padTop + chartHeight - ((d.newRating - minRating) / range) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + chartHeight).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padTop + chartHeight).toFixed(1)} Z`;

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[points.length - 1];

  const gridSteps = [
    { rating: maxRating, y: padTop },
    { rating: Math.round((minRating + maxRating) / 2), y: padTop + chartHeight / 2 },
    { rating: minRating, y: padTop + chartHeight },
  ];

  return (
    <div className="relative w-full select-none">
      {activePoint && (
        <div className="flex items-center justify-between text-xs mb-1 px-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Match #{points.indexOf(activePoint) + 1}</span>
            <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${activePoint.placement === 1 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-700 text-slate-300'}`}>
              {activePoint.placement === 1 ? '👑 Victory' : `#${activePoint.placement} Place`}
            </span>
            <span className="text-slate-400">⚔️ {activePoint.kills} kills</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Rating:</span>
            <span className="font-black text-purple-400 text-sm">{activePoint.newRating.toFixed(0)}</span>
            <span className={`text-[11px] font-bold ${activePoint.ratingChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ({activePoint.ratingChange >= 0 ? `+${activePoint.ratingChange.toFixed(0)}` : activePoint.ratingChange.toFixed(0)})
            </span>
          </div>
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-44 overflow-visible"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {gridSteps.map((step, idx) => (
          <g key={idx}>
            <line
              x1={padLeft}
              y1={step.y}
              x2={width - padRight}
              y2={step.y}
              stroke="#334155"
              strokeDasharray={idx === 1 ? '4 4' : undefined}
              strokeWidth="1"
            />
            <text
              x={padLeft - 8}
              y={step.y + 4}
              textAnchor="end"
              fill="#94a3b8"
              fontSize="11"
              fontFamily="sans-serif"
            >
              {step.rating.toFixed(0)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#ratingGrad)" />

        <path
          d={linePath}
          fill="none"
          stroke="#a855f7"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {activePoint && (
          <line
            x1={activePoint.x}
            y1={padTop}
            x2={activePoint.x}
            y2={padTop + chartHeight}
            stroke="#c084fc"
            strokeDasharray="3 3"
            strokeWidth="1.5"
          />
        )}

        {points.map((p, i) => (
          <g
            key={i}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIdx(i)}
          >
            <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIdx === i ? 6 : (points.length <= 15 ? 4 : 2.5)}
              fill={hoveredIdx === i ? '#ffffff' : '#a855f7'}
              stroke="#9333ea"
              strokeWidth={hoveredIdx === i ? 3 : 1.5}
              className="transition-all duration-150"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

interface Props {
  onUserLoaded?: (profile: UserProfileData | null) => void;
}

export function FirebaseAccount({ onUserLoaded }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntryData[]>([]);
  const [isLoadingLb, setIsLoadingLb] = useState(false);
  
  const [showProfile, setShowProfile] = useState(false);
  const [history, setHistory] = useState<MatchHistoryData[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileTab, setProfileTab] = useState<'history' | 'chart'>('history');
  const [previewTier, setPreviewTier] = useState<RankTier | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const userRankTier = getRankTier(profile?.rankPoints ?? 0, profile?.rating ?? null);
  const currentRankConfig = RANK_CONFIGS[userRankTier];
  const activeModalTier = previewTier || userRankTier;
  const activeModalConfig = RANK_CONFIGS[activeModalTier];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userProfile = await loadOrCreateUserProfile(currentUser);
          setProfile(userProfile);
          onUserLoaded?.(userProfile);
        } catch (err) {
          console.error('Failed to load user profile:', err);
        }
      } else {
        setProfile(null);
        onUserLoaded?.(null);
      }
      setIsLoading(false);
    });

    return () => unsub();
  }, [onUserLoaded]);

  const handleEmailAuth = async (isRegister: boolean) => {
    setAuthError("");
    setIsLoading(true);
    try {
      if (isRegister) {
        await registerWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
      setShowAuthModal(false);
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkGoogle = async () => {
    setAuthError("");
    try {
      await linkGoogleAccount();
      alert("Google Account successfully linked!");
    } catch (err: any) {
      setAuthError(err.message || "Failed to link Google account");
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    await loginWithGoogle();
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await logoutUser();
  };

  const openProfile = async () => {
    setShowProfile(true);
    setIsLoadingProfile(true);
    try {
      if (user) {
        const h = await fetchUserHistory(user.uid);
        setHistory(h || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const openLeaderboard = async () => {
    setShowLeaderboard(true);
    setIsLoadingLb(true);
    try {
      const entries = await fetchTopLeaderboard();
      setLeaderboard(entries);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setIsLoadingLb(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto mb-6 px-4">
      {/* Top Banner Bar */}
      <RankAuraEffect tier={user ? userRankTier : 'Beginner'} className="w-full">
        <div className="bg-slate-800/90 backdrop-blur-md p-3.5 flex flex-wrap items-center justify-between gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Player'}
                  className="w-10 h-10 rounded-full object-cover shrink-0 transition-transform hover:scale-105"
                  style={{
                    border: `2px solid ${currentRankConfig.primaryColor}`,
                    boxShadow: `0 0 10px ${currentRankConfig.primaryColor}88`,
                  }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white shrink-0"
                  style={{
                    border: `2px solid ${currentRankConfig.primaryColor}`,
                    boxShadow: `0 0 10px ${currentRankConfig.primaryColor}88`,
                  }}
                >
                  {(user.displayName || 'P')[0].toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-white text-sm">
                    {profile?.displayName || user.displayName || 'Player'}
                  </span>
                  {/* Rank Badge with glowing aura */}
                  <span
                    className="text-[10px] font-black px-1.5 py-0.5 rounded-md border flex items-center gap-1 shadow-sm"
                    style={{
                      backgroundColor: `${currentRankConfig.primaryColor}22`,
                      borderColor: `${currentRankConfig.primaryColor}77`,
                      color: currentRankConfig.primaryColor,
                    }}
                    title={`${currentRankConfig.tier} (${currentRankConfig.labelJa}): ${currentRankConfig.title}`}
                  >
                    <span>{currentRankConfig.badgeEmoji}</span>
                    <span>{currentRankConfig.tier}</span>
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-0.5">
                    <UserCheck size={10} /> Cloud Synced
                  </span>
                </div>
                <div className="text-xs text-slate-300 flex items-center gap-2 mt-0.5 flex-wrap">
                  <span>
                    👑 Rank:{' '}
                    <strong style={{ color: currentRankConfig.primaryColor }}>
                      {currentRankConfig.tier}
                    </strong>
                  </span>
                  <span>🏆 Wins: <strong className="text-yellow-400">{profile?.totalWins ?? 0}</strong></span>
                  <span>⚔️ Kills: <strong className="text-red-400">{profile?.totalKills ?? 0}</strong></span>
                  <span>🎮 Matches: <strong className="text-blue-400">{profile?.totalMatches ?? 0}</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 text-slate-300 text-xs">
              <div className="p-2 bg-slate-700/50 rounded-xl">
                <Shield size={18} className="text-blue-400" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-slate-200">Firebase Cloud Profile</div>
                <div className="text-[11px] text-slate-400">Sign in to save wins & climb the leaderboard</div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            {user && (
              <button
                onClick={openProfile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all active:scale-95"
              >
                <BarChart2 size={14} />
                Profile
              </button>
            )}
            <button
              onClick={openLeaderboard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all active:scale-95"
            >
              <Trophy size={14} />
              Leaderboard
            </button>

            {user ? (
              <div className="flex gap-2">
                <button onClick={() => setShowSettings(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600/50 text-xs font-bold transition-all active:scale-95" title="Settings">
                  <Settings size={14} />
                  Settings
                </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all active:scale-95"
                title="Sign Out"
              >
                <LogOut size={14} />
                Logout
              </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                <LogIn size={14} />
                {isLoading ? 'Loading...' : 'Sign In / Register'}
              </button>
            )}
          </div>
        </div>
      </RankAuraEffect>


      {/* Profile & Detailed Statistics Modal */}
      {showProfile && user && profile && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative text-left max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowProfile(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex items-center justify-between mb-3 pr-8">
              <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Sparkles size={14} className="text-yellow-400" />
                <span>プレイヤープロファイル & ランクオーラ</span>
              </div>
              {previewTier && (
                <button
                  type="button"
                  onClick={() => setPreviewTier(null)}
                  className="text-[11px] text-purple-300 hover:text-white flex items-center gap-1 bg-purple-500/20 px-2 py-0.5 rounded-lg border border-purple-500/30 transition-colors"
                >
                  <RotateCcw size={11} />
                  <span>現在のランクに戻す ({userRankTier})</span>
                </button>
              )}
            </div>

            {/* Rank Aura Tier Selector (Beginner to God) */}
            <div className="mb-4 bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/60">
              <div className="text-[11px] text-slate-400 font-semibold mb-1.5 flex items-center justify-between">
                <span>ランクオーラプレビュー (全9ランクの輝き・アニメーションを確認):</span>
                <span className="text-slate-300 font-bold">
                  選択中: <strong style={{ color: activeModalConfig.primaryColor }}>{activeModalConfig.tier}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 allow-scroll scrollbar-thin">
                {ALL_RANKS.map((tier) => (
                  <RankTierPill
                    key={tier}
                    tier={tier}
                    isActive={activeModalTier === tier}
                    onClick={() => setPreviewTier(tier === userRankTier ? null : tier)}
                  />
                ))}
              </div>
            </div>

            {/* Profile Hero Card with Rank Aura & Particle Effects */}
            <RankAuraEffect tier={activeModalTier} showBadge className="mb-6">
              <div className="bg-slate-800/95 backdrop-blur-md p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Profile"
                      className="w-16 h-16 rounded-full object-cover shrink-0 transition-transform hover:scale-105"
                      style={{
                        border: `3px solid ${activeModalConfig.primaryColor}`,
                        boxShadow: `0 0 16px ${activeModalConfig.primaryColor}aa`,
                      }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white text-2xl shrink-0"
                      style={{
                        border: `3px solid ${activeModalConfig.primaryColor}`,
                        boxShadow: `0 0 16px ${activeModalConfig.primaryColor}aa`,
                      }}
                    >
                      {profile.displayName[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-2xl font-black text-white">{profile.displayName}</h3>
                      <span
                        className="text-xs font-black px-2 py-0.5 rounded-full border shadow-sm flex items-center gap-1"
                        style={{
                          backgroundColor: `${activeModalConfig.primaryColor}25`,
                          borderColor: `${activeModalConfig.primaryColor}77`,
                          color: activeModalConfig.primaryColor,
                        }}
                      >
                        <span>{activeModalConfig.badgeEmoji}</span>
                        <span>{activeModalConfig.tier}</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                      <span>称号: <strong style={{ color: activeModalConfig.primaryColor }}>{activeModalConfig.title}</strong></span>
                      <span className="text-slate-500">•</span>
                      <span>Rating: <strong className="text-purple-400">{(profile.rating ?? profile.rankPoints ?? 0).toFixed(0)}</strong></span>
                      <span className="text-slate-500">•</span>
                      <span>Rank Points: <strong className="text-yellow-400">{profile.rankPoints ?? 0}</strong></span>
                    </p>
                  </div>
                </div>

                <div className="text-right ml-auto">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Aura Power</div>
                  <div
                    className="text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border mt-0.5 inline-block"
                    style={{
                      color: activeModalConfig.primaryColor,
                      borderColor: `${activeModalConfig.primaryColor}55`,
                      backgroundColor: `${activeModalConfig.primaryColor}15`,
                    }}
                  >
                    {activeModalConfig.auraIntensity}
                  </div>
                </div>
              </div>
            </RankAuraEffect>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
                <div className="text-xs text-slate-400 font-bold mb-1">Win Rate</div>
                <div className="text-lg font-black text-white">
                  {profile.totalMatches > 0 ? ((profile.totalWins / profile.totalMatches) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
                <div className="text-xs text-slate-400 font-bold mb-1">K/D Ratio</div>
                <div className="text-lg font-black text-red-400">
                  {profile.totalDeaths ? (profile.totalKills / profile.totalDeaths).toFixed(2) : profile.totalKills.toFixed(2)}
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
                <div className="text-xs text-slate-400 font-bold mb-1">Favorite Class</div>
                <div className="text-lg font-black text-blue-400 capitalize">
                  {profile.favoriteClass || 'N/A'}
                </div>
              </div>
            </div>

            {/* Tabs: Match History / Rating Graph */}
            <div id="profile-subtabs" className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <button
                  id="tab-btn-match-history"
                  type="button"
                  onClick={() => setProfileTab('history')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    profileTab === 'history'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <History size={14} />
                  <span>対戦履歴 (Match History)</span>
                  {history.length > 0 && (
                    <span className="bg-purple-900/80 text-purple-200 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {history.length}
                    </span>
                  )}
                </button>

                <button
                  id="tab-btn-rating-chart"
                  type="button"
                  onClick={() => setProfileTab('chart')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    profileTab === 'chart'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <Activity size={14} />
                  <span>レート推移 (Rating Graph)</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-500 font-semibold hidden sm:block">
                Firestore Data
              </div>
            </div>

            {/* Tab content */}
            {profileTab === 'history' ? (
              <div id="profile-history-view" className="flex-1 min-h-0 flex flex-col">
                <MatchHistory history={history} isLoading={isLoadingProfile} />
              </div>
            ) : (
              <div id="profile-chart-view" className="flex-1 min-h-0 flex flex-col">
                <div className="text-xs text-slate-400 mb-2">直近のマッチによるレーティング推移</div>
                {isLoadingProfile ? (
                  <div className="py-12 text-center text-slate-400 font-bold animate-pulse">Loading history...</div>
                ) : history.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-sm">ランク戦の記録がありません。ランク戦をプレイしてみましょう！</div>
                ) : (
                  <div className="flex-1 min-h-[190px] py-1">
                    <RatingHistoryChart history={history} />
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                  ID: {profile.userId || user.uid}
                </span>
                <a
                  href="https://everychat-waseda.web.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    const uid = profile.userId || user.uid;
                    if (uid) {
                      try {
                        navigator.clipboard.writeText(uid);
                      } catch (e) {
                        console.error(e);
                      }
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold flex items-center gap-1 transition-all active:scale-95 shadow-md"
                  title="ユーザーIDをコピーして everychat-waseda.web.app を開く"
                >
                  <MessageSquare size={12} />
                  <span>everychatで共有</span>
                  <ExternalLink size={10} />
                </a>
              </div>
              <div className="text-slate-500">Joined: {new Date(profile.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Global Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-left">
            <button
              onClick={() => setShowLeaderboard(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-yellow-500/20 text-yellow-400 rounded-xl border border-yellow-500/30">
                <Trophy size={22} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Global Leaderboard</h3>
                <p className="text-xs text-slate-400">Powered by Firebase Firestore</p>
              </div>
            </div>

            {isLoadingLb ? (
              <div className="py-12 text-center text-slate-400 font-bold animate-pulse">
                Loading Top Champions...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No leaderboard entries yet. Win a match to claim #1 rank!
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {leaderboard.map((entry, idx) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      idx === 0
                        ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300'
                        : idx === 1
                        ? 'bg-slate-300/10 border-slate-400/40 text-slate-200'
                        : idx === 2
                        ? 'bg-amber-700/10 border-amber-600/40 text-amber-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm w-6 text-center">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </span>
                      <span className="font-bold text-sm truncate max-w-[160px]">
                        {entry.displayName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-semibold">
                      <span className="flex items-center gap-1 text-yellow-400">
                        <Award size={13} /> {entry.totalWins} Wins
                      </span>
                      <span className="text-red-400">
                        ⚔️ {entry.totalKills}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/50 p-6 rounded-2xl w-full max-w-sm relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-full"
            >
              <X size={16} />
            </button>
            <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
              <Shield className="text-blue-400" /> Account Access
            </h2>
            
            {authError && <div className="text-red-400 text-xs bg-red-500/10 p-2 rounded mb-4">{authError}</div>}
            
            <div className="flex flex-col gap-4">
              <input 
                type="email" 
                placeholder="Email Address" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-xl text-sm"
              />
              <input 
                type="password" 
                placeholder="Password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-xl text-sm"
              />
              <div className="flex gap-2">
                <button 
                  onClick={() => handleEmailAuth(false)}
                  disabled={isLoading || !email || !password}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => handleEmailAuth(true)}
                  disabled={isLoading || !email || !password}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                >
                  Register
                </button>
              </div>

              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 border-t border-slate-700"></div>
                <span className="text-xs text-slate-500">OR</span>
                <div className="flex-1 border-t border-slate-700"></div>
              </div>

              <button 
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-slate-900 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              >
                <LogIn size={16} />
                Continue with Google
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && user && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/50 p-6 rounded-2xl w-full max-w-sm relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-full"
            >
              <X size={16} />
            </button>
            <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
              <Settings className="text-blue-400" /> Settings
            </h2>
            
            {authError && <div className="text-red-400 text-xs bg-red-500/10 p-2 rounded mb-4">{authError}</div>}
            
            <div className="space-y-4">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h3 className="text-sm font-bold text-white mb-1">Account Info</h3>
                <p className="text-xs text-slate-400 mb-4">{user.email}</p>
                <button 
                  onClick={handleLinkGoogle}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/40 py-2 rounded-lg text-sm font-bold transition-all"
                >
                  <LogIn size={14} />
                  Link Google Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
