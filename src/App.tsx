import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { useGameStore } from './store';
import { Map } from './components/Map';
import { Players } from './components/Players';
import { LocalPlayer } from './components/LocalPlayer';
import { BattleBus } from './components/BattleBus';
import { AttackEffects } from './components/AttackEffects';
import { DamagePopupsOverlay } from './components/DamagePopupsOverlay';
import { MobileControls } from './components/MobileControls';
import { EliminatedModal, SpectateHUD } from './components/EliminatedModal';
import { FirebaseAccount } from './components/FirebaseAccount';
import { FriendsModal } from './components/FriendsModal';
import { P2PInviteModal } from './components/P2PInviteModal';
import { P2PStatusBadge } from './components/P2PStatusBadge';
import { auth, updateUserStats, UserProfileData } from './firebase';
import { CharacterClass } from './types';
import { RotateCcw, LogOut, Trophy, Flame, Sparkles, Users, UserPlus, Zap } from 'lucide-react';
import { getRankTier, RANK_CONFIGS } from './utils/rankUtils';

// Isolated Matchmaking Lobby UI - updates its own countdown without re-rendering App/Canvas
const MatchLobbyBanner = React.memo(function MatchLobbyBanner() {
  const isWaiting = useGameStore((s) => s.gameState?.status === 'waiting');
  const gameMode = useGameStore((s) => s.gameState?.mode);
  const roomId = useGameStore((s) => s.gameState?.roomId);
  const playerCount = useGameStore((s) => s.gameState ? Object.keys(s.gameState.players).length : 0);
  const totalOnline = useGameStore((s) => s.gameState?.totalOnlineCount || 1);
  const matchTimer = useGameStore((s) => s.gameState ? Math.ceil(s.gameState.matchTimer) : 0);

  if (!isWaiting) return null;

  return (
    <div className="absolute top-4 sm:top-8 left-0 right-0 flex justify-center pointer-events-none z-30 px-4">
      <div className="bg-slate-900/95 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-3xl font-bold border-2 border-yellow-400/60 shadow-[0_0_35px_rgba(250,204,21,0.4)] backdrop-blur-xl flex flex-col items-center gap-1.5 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 text-[10px] sm:text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>オンライン: {totalOnline}人</span>
          </div>
          <span className="text-xs sm:text-sm font-black text-yellow-300 uppercase tracking-widest">
            {gameMode?.toUpperCase()} MATCH LOBBY
            {gameMode === 'password' && ` • ROOM: ${roomId}`}
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm sm:text-base text-slate-300 font-bold">
            👥 部屋人数: <strong className="text-white font-mono">{playerCount}</strong> 人
          </span>
          <span className="text-slate-500 font-light">|</span>
          <span className="text-base sm:text-xl font-black text-amber-300 flex items-center gap-1">
            ⏳ 開始まで: <span className="font-mono text-xl sm:text-2xl text-yellow-400 underline decoration-yellow-500/50">{matchTimer}秒</span>
          </span>
        </div>
        <div className="text-[10px] sm:text-xs text-sky-300/90 font-medium">
          ⚡ バトルバス発進準備中... まもなく降下開始！
        </div>
      </div>
    </div>
  );
});

// Isolated End Match UI - updates without re-rendering Canvas
const EndMatchModal = React.memo(function EndMatchModal({ 
  onPlayAgain, 
  onReturnToLobby 
}: { 
  onPlayAgain: () => void; 
  onReturnToLobby: () => void; 
}) {
  const isEnded = useGameStore((s) => s.gameState?.status === 'ended');
  const gameMode = useGameStore((s) => s.gameState?.mode);
  const winner = useGameStore((s) => s.gameState?.winner);
  const myId = useGameStore((s) => s.myId);
  const myPlayerTeam = useGameStore((s) => {
    const p = s.myId && s.gameState ? s.gameState.players[s.myId] : null;
    return p ? (p as any).team : null;
  });
  const myPlayerScore = useGameStore((s) => {
    const p = s.myId && s.gameState ? s.gameState.players[s.myId] : null;
    return p ? p.score : 0;
  });
  const matchTimer = useGameStore((s) => s.gameState ? Math.ceil(s.gameState.matchTimer) : 0);

  if (!isEnded) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md text-white pointer-events-auto p-4 select-none touch-none">
      <div className="w-full max-w-md bg-slate-900/95 border-2 border-yellow-500/40 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(234,179,8,0.25)] text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center text-yellow-400 mb-3 shadow-[0_0_20px_rgba(234,179,8,0.4)]">
          <Trophy size={36} className="animate-bounce" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-yellow-400 mb-1 drop-shadow tracking-wider">
          {gameMode === 'team'
            ? winner === myPlayerTeam
              ? 'TEAM VICTORY!'
              : 'DEFEAT'
            : winner === myId
            ? 'VICTORY ROYALE!'
            : 'MATCH OVER'}
        </h1>
        
        <p className="text-slate-400 text-sm font-semibold mb-6">
          {gameMode === 'team'
            ? winner === myPlayerTeam
              ? `自陣（${myPlayerTeam === 'red' ? '赤チーム' : '青チーム'}）が見事勝利しました！`
              : `${winner === 'red' ? '赤チーム' : '青チーム'}の勝利となりました。`
            : winner === myId
            ? '見事最後まで生き残りました！'
            : '試合が終了しました'}
        </p>

        <div className="bg-slate-800/80 w-full rounded-2xl p-4 mb-6 border border-white/5 flex justify-around items-center">
          <div>
            <div className="text-[11px] text-slate-400 font-bold uppercase">スコア</div>
            <div className="text-2xl font-black text-amber-300">{myPlayerScore || 0}</div>
          </div>
          <div className="border-l border-white/10 h-8" />
          <div>
            <div className="text-[11px] text-slate-400 font-bold uppercase">次の試合</div>
            <div className="text-2xl font-black text-blue-400">{matchTimer}秒</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 active:scale-98 text-slate-950 font-black text-lg rounded-2xl shadow-lg shadow-yellow-400/30 flex items-center justify-center gap-2 transition-all"
          >
            <RotateCcw size={22} className="stroke-[2.5]" />
            <span>次マッチに参戦</span>
          </button>

          <button
            type="button"
            onClick={onReturnToLobby}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-300 font-bold text-base rounded-2xl border border-white/10 flex items-center justify-center gap-2 transition-all"
          >
            <LogOut size={18} />
            <span>ロビーに戻る</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default function App() {
  const connect = useGameStore((s) => s.connect);
  const leaveGame = useGameStore((s) => s.leaveGame);
  const myId = useGameStore((s) => s.myId);
  const hasGameState = useGameStore((s) => !!s.gameState);
  const status = useGameStore((s) => s.gameState?.status);
  const roomId = useGameStore((s) => s.gameState?.roomId);
  const winner = useGameStore((s) => s.gameState?.winner);
  const gameMode = useGameStore((s) => s.gameState?.mode);
  const myPlayerIsDead = useGameStore((s) => {
    const p = s.myId && s.gameState ? s.gameState.players[s.myId] : null;
    return p ? p.isDead : false;
  });
  const myPlayerTeam = useGameStore((s) => {
    const p = s.myId && s.gameState ? s.gameState.players[s.myId] : null;
    return p ? (p as any).team : null;
  });
  const myPlayerScore = useGameStore((s) => {
    const p = s.myId && s.gameState ? s.gameState.players[s.myId] : null;
    return p ? p.score : 0;
  });

  const isEnded = status === 'ended';

  const socket = useGameStore((s) => s.socket);
  const registerP2PUser = useGameStore((s) => s.registerP2PUser);
  const incomingP2PInvite = useGameStore((s) => s.incomingP2PInvite);
  const p2pNotice = useGameStore((s) => s.p2pNotice);
  const clearP2PNotice = useGameStore((s) => s.clearP2PNotice);

  const [hasStarted, setHasStarted] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [lobbyOnlineCount, setLobbyOnlineCount] = useState<number>(1);
  const [mode, setMode] = useState<'casual'|'ranked'|'password'|'team'|'bot'|'p2p_duel'>('bot');
  const [password, setPassword] = useState('');
  const [charClass, setCharClass] = useState<CharacterClass>('melee');
  const [botCount, setBotCount] = useState(15);
  const [teamChoice, setTeamChoice] = useState<'auto' | 'red' | 'blue'>('auto');
  const [teamMatchType, setTeamMatchType] = useState<'pvp' | 'bot'>('pvp');
  const [lastProcessedMatch, setLastProcessedMatch] = useState<string | null>(null);
  const [cloudProfile, setCloudProfile] = useState<UserProfileData | null>(null);

  // Register user UID for P2P direct matching upon login
  useEffect(() => {
    if (cloudProfile?.userId) {
      registerP2PUser(cloudProfile.userId);
    }
  }, [cloudProfile, registerP2PUser]);

  // Poll online player count while in lobby
  useEffect(() => {
    if (hasStarted) return;
    const fetchOnlineCount = async () => {
      try {
        const res = await fetch('/api/online-count');
        if (res.ok) {
          const data = await res.json();
          if (typeof data.count === 'number') {
            setLobbyOnlineCount(data.count);
          }
        }
      } catch {
        // ignore network hiccups
      }
    };
    fetchOnlineCount();
    const timer = setInterval(fetchOnlineCount, 3000);
    return () => clearInterval(timer);
  }, [hasStarted]);

  const [profile, setProfile] = useState(() => {
    const p = localStorage.getItem('poly_profile');
    if (p) return JSON.parse(p);
    return { wins: 0, streak: 0, rankPoints: 0, rating: null };
  });

  const handleReturnToLobby = () => {
    // If player died during match and match was not yet recorded, record to Firestore
    if (myPlayerIsDead && roomId && roomId !== lastProcessedMatch && auth.currentUser) {
      setLastProcessedMatch(roomId);
      const otherAliveCount = Object.values(useGameStore.getState().gameState?.players || {}).filter(p => !p.isDead && p.id !== myId).length;
      const finalPlacement = Math.max(2, otherAliveCount + 1);
      const myScore = myPlayerScore || 0;
      const currentRating = profile.rating !== null ? profile.rating : profile.rankPoints;
      updateUserStats(
        auth.currentUser.uid,
        false,
        myScore,
        1,
        charClass,
        0,
        currentRating,
        gameMode || 'casual',
        myScore,
        finalPlacement
      ).catch((err) => console.error('Error syncing match on lobby return:', err));
    }
    leaveGame();
    setHasStarted(false);
  };

  const handlePlayAgain = () => {
    leaveGame();
    setTimeout(() => {
      const resolvedName = cloudProfile?.displayName || (profile as any)?.displayName || '';
      connect(mode, password, charClass, botCount, teamChoice, teamMatchType, resolvedName);
      setHasStarted(true);
    }, 120);
  };

  // Process Match End logic - ONLY Ranked Mode updates Rating & Rank Points
  useEffect(() => {
    if (status === 'ended' && roomId !== lastProcessedMatch) {
      setLastProcessedMatch(roomId!);
      
      const isWin = winner === myId || (myPlayerTeam && winner === myPlayerTeam);
      const myScore = myPlayerScore || 0;
      let newProfile = { ...profile };

      if (isWin) {
        newProfile.wins += 1;
        newProfile.streak += 1;
      } else {
        newProfile.streak = 0;
      }

      
      let ratingChange = 0;
      // STRICT RULE: Only modify rank points and rating in RANKED match mode!
      if (gameMode === 'ranked') {
        if (isWin) {
          // Much harder progression: +12 base + 2 per kill + small streak bonus
          const killBonus = Math.min(6, myScore * 2);
          const streakBonus = Math.min(3, newProfile.streak);
          const pointsEarned = 12 + killBonus + streakBonus;
          
          let ratingBefore = newProfile.rating !== null ? newProfile.rating : newProfile.rankPoints;

          if (newProfile.rating === null) {
            ratingChange = pointsEarned;
            newProfile.rankPoints += pointsEarned;
            if (newProfile.rankPoints >= 2000) {
              newProfile.rating = 2000.000 + (newProfile.streak * 5);
            }
          } else {
            // God tier rate increments slowly
            ratingChange = 5.2 + Math.min(3, myScore) + Math.min(3, newProfile.streak * 0.5);
            newProfile.rating += ratingChange;
          }
        } else {
          // Defeat penalty in Ranked Mode
          
          if (newProfile.rating !== null) {
            ratingChange = Math.max(2000, newProfile.rating - 7.5) - newProfile.rating;
            newProfile.rating = Math.max(2000, newProfile.rating - 7.5);
          } else {
            ratingChange = Math.max(0, newProfile.rankPoints - 8) - newProfile.rankPoints;
            newProfile.rankPoints = Math.max(0, newProfile.rankPoints - 8);
          }
        }
      }

      setProfile(newProfile);
      localStorage.setItem('poly_profile', JSON.stringify(newProfile));

      // Sync stats to Firebase Firestore if logged in
      if (auth.currentUser) {
        const deaths = isWin ? 0 : 1;
        const currentRating = newProfile.rating !== null ? newProfile.rating : newProfile.rankPoints;
        const otherAliveCount = Object.values(useGameStore.getState().gameState?.players || {}).filter(p => !p.isDead && p.id !== myId).length;
        const finalPlacement = isWin ? 1 : Math.max(2, otherAliveCount + 1);

        updateUserStats(
          auth.currentUser.uid,
          isWin,
          myScore,
          deaths,
          charClass,
          typeof ratingChange !== 'undefined' ? ratingChange : 0,
          currentRating,
          gameMode || 'casual',
          myScore,
          finalPlacement
        ).catch((err) => console.error('Error syncing match to Firebase:', err));
      }
    }
  }, [status, roomId, winner, gameMode]);

  const getRankName = (points: number, rating: number | null) => {
    if (rating !== null) return `God`;
    if (points < 150) return 'Beginner';
    if (points < 300) return 'Bronze';
    if (points < 500) return 'Silver';
    if (points < 750) return 'Gold';
    if (points < 1000) return 'Platinum';
    if (points < 1300) return 'Diamond';
    if (points < 1650) return 'Master';
    if (points < 2000) return 'GrandMaster';
    return `God`;
  };

  const activePoints = cloudProfile?.rankPoints ?? profile.rankPoints;
  const activeRating = cloudProfile?.rating ?? profile.rating;
  const currentTier = getRankTier(activePoints, activeRating);
  const tierConfig = RANK_CONFIGS[currentTier];
  const displayRate = activeRating !== null ? activeRating.toFixed(1) : activePoints;

  const handleJoin = () => {
    const resolvedName = cloudProfile?.displayName || (profile as any)?.displayName || '';
    connect(mode, password, charClass, botCount, teamChoice, teamMatchType, resolvedName);
    setHasStarted(true);
  };

  if (!hasStarted) {
    return (
      <div className="allow-scroll flex flex-col items-center justify-start sm:justify-center w-full h-full min-h-screen overflow-y-auto bg-slate-900 text-white font-sans select-none px-4 py-8 text-center pb-24 absolute inset-0">
        <h1 className="text-4xl sm:text-6xl font-black mb-1 sm:mb-2 text-blue-400 drop-shadow-lg">POLY ROYALE</h1>
        
        {/* Lobby Rank & Online Status Header */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-4 sm:mb-5">
          {/* Lobby Rank Aura Pill */}
          <div
            className="text-sm sm:text-base font-black px-4 sm:px-6 py-1.5 sm:py-2 rounded-full border flex items-center justify-center gap-2 shadow-lg backdrop-blur-md transition-all animate-rank-pulse"
            style={{
              backgroundColor: `${tierConfig.primaryColor}18`,
              borderColor: `${tierConfig.primaryColor}88`,
              color: tierConfig.primaryColor,
              boxShadow: `0 0 20px ${tierConfig.primaryColor}44`,
            }}
          >
            <span className="text-base">{tierConfig.badgeEmoji}</span>
            <span>
              Rank: <strong>{tierConfig.tier}</strong> ({tierConfig.labelJa})
            </span>
            <span className="opacity-40">•</span>
            <span className="text-slate-300 font-bold">Rate: {displayRate}</span>
          </div>

          {/* Online Players Indicator */}
          <div className="bg-slate-800/90 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-black px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <Users size={14} className="text-emerald-400" />
            <span>オンライン中: <strong className="text-white font-mono text-xs sm:text-sm font-black">{lobbyOnlineCount}</strong> 人</span>
          </div>

          {/* Friends & P2P 1v1 Modal Trigger Button */}
          <button
            onClick={() => setIsFriendsOpen(true)}
            className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 text-xs sm:text-sm font-extrabold px-4 sm:px-5 py-1.5 sm:py-2 rounded-full flex items-center gap-1.5 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-105 transition-all cursor-pointer"
          >
            <Zap size={15} className="text-slate-950 fill-slate-950" />
            <span>フレンド & P2P 1v1</span>
          </button>
        </div>

        <FirebaseAccount onUserLoaded={setCloudProfile} />
        
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-2 max-w-3xl">
          <button 
            onClick={() => setMode('bot')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-black text-sm sm:text-lg transition-all shadow-lg flex items-center gap-1.5 sm:gap-2 ${
              mode === 'bot' 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white ring-2 ring-purple-300 scale-105' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>🤖</span> Bot戦 (AI Solo)
          </button>
          <button 
            onClick={() => setMode('casual')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg transition-colors ${
              mode === 'casual' ? 'bg-blue-500 text-white ring-2 ring-blue-300' : 'bg-slate-700 text-slate-300'
            }`}
          >
            Casual Match
          </button>
          <button 
            onClick={() => setMode('team')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg transition-colors ${
              mode === 'team' ? 'bg-teal-500 text-white ring-2 ring-teal-300' : 'bg-slate-700 text-slate-300'
            }`}
          >
            Team Battle
          </button>
          <button 
            onClick={() => setMode('ranked')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg transition-colors ${
              mode === 'ranked' ? 'bg-orange-500 text-white ring-2 ring-orange-300' : 'bg-slate-700 text-slate-300'
            }`}
          >
            Ranked Match
          </button>
          <button 
            onClick={() => setMode('password')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg transition-colors ${
              mode === 'password' ? 'bg-purple-500 text-white ring-2 ring-purple-300' : 'bg-slate-700 text-slate-300'
            }`}
          >
            Password Match
          </button>
        </div>

        {/* Mode subtitle explanation */}
        <div className="text-[11px] sm:text-xs text-slate-400 font-medium mb-3 sm:mb-4 min-h-4 flex items-center justify-center">
          {mode === 'bot' && `🤖 待ち時間なし！${botCount}体の自律型AI Botと大乱闘バトルロイヤル`}
          {mode === 'casual' && '⚔️ オンラインの他プレイヤーと通常マッチング'}
          {mode === 'team' && '🛡️ 赤チーム vs 青チームの陣営対抗戦（1ライフ制）'}
          {mode === 'ranked' && '🏆 勝敗でレートが増減する本格ランクバトル'}
          {mode === 'password' && '🔒 合言葉を設定してフレンド同士でプライベート対戦'}
        </div>

        {mode === 'bot' && (
          <div className="mb-4 bg-slate-800/90 border border-purple-500/40 rounded-2xl p-3 sm:p-4 w-full max-w-md flex flex-col items-center gap-2.5 shadow-xl">
            <div className="flex items-center justify-between w-full text-xs sm:text-sm font-bold">
              <span className="text-purple-300">👥 BOT 対戦人数:</span>
              <span className="text-base sm:text-lg font-black text-amber-300 bg-purple-950/80 px-3 py-0.5 rounded-lg border border-purple-400/40">
                {botCount} 体 (計 {botCount + 1}人)
              </span>
            </div>
            
            <input
              type="range"
              min="1"
              max="99"
              value={botCount}
              onChange={(e) => setBotCount(parseInt(e.target.value, 10))}
              className="w-full accent-purple-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
            />

            <div className="flex items-center gap-1.5 sm:gap-2 w-full justify-between">
              {[15, 30, 60, 99].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setBotCount(count)}
                  className={`flex-1 py-1 rounded-lg text-[10px] sm:text-xs font-black transition-all ${
                    botCount === count
                      ? 'bg-purple-600 text-white shadow-md ring-1 ring-purple-300'
                      : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {count === 99 ? '🔥 99体(100人)' : `${count}体`}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'team' && (
          <div className="mb-4 bg-slate-800/90 border border-teal-500/40 rounded-2xl p-3 sm:p-4 w-full max-w-md flex flex-col items-center gap-3 shadow-xl">
            {/* Match Type: Online PvP or Bot Solo */}
            <div className="w-full text-left">
              <div className="text-xs sm:text-sm font-bold text-teal-300 mb-1.5 flex items-center justify-between">
                <span>⚔️ 対戦モード:</span>
                <span className="text-[10px] text-slate-400 font-normal">対人マッチまたはAI練習</span>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setTeamMatchType('pvp')}
                  className={`py-2 px-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 ${
                    teamMatchType === 'pvp'
                      ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white ring-2 ring-emerald-300 shadow-md scale-102'
                      : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>👥</span> オンラインPvP対戦
                </button>
                <button
                  type="button"
                  onClick={() => setTeamMatchType('bot')}
                  className={`py-2 px-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 ${
                    teamMatchType === 'bot'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white ring-2 ring-purple-300 shadow-md scale-102'
                      : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>🤖</span> Bot練習戦 (Solo)
                </button>
              </div>
            </div>

            <div className="w-full text-left pt-2 border-t border-white/10">
              <div className="text-xs sm:text-sm font-bold text-teal-300 mb-1.5 flex items-center justify-between">
                <span>🛡️ 所属チーム選択:</span>
                <span className="text-[10px] text-slate-400 font-normal">自動またはお好みの陣営を選択</span>
              </div>
              <div className="grid grid-cols-3 gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setTeamChoice('auto')}
                  className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-black transition-all ${
                    teamChoice === 'auto'
                      ? 'bg-teal-600 text-white ring-2 ring-teal-300 shadow-md scale-102'
                      : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  🎲 自動均等
                </button>
                <button
                  type="button"
                  onClick={() => setTeamChoice('red')}
                  className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-black transition-all ${
                    teamChoice === 'red'
                      ? 'bg-red-600 text-white ring-2 ring-red-300 shadow-md scale-102'
                      : 'bg-slate-700/80 text-red-300 hover:bg-slate-700'
                  }`}
                >
                  🔴 赤チーム
                </button>
                <button
                  type="button"
                  onClick={() => setTeamChoice('blue')}
                  className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-black transition-all ${
                    teamChoice === 'blue'
                      ? 'bg-blue-600 text-white ring-2 ring-blue-300 shadow-md scale-102'
                      : 'bg-slate-700/80 text-blue-300 hover:bg-slate-700'
                  }`}
                >
                  🔵 青チーム
                </button>
              </div>
            </div>

            <div className="w-full pt-2 border-t border-white/10">
              <div className="flex items-center justify-between w-full text-xs sm:text-sm font-bold mb-1.5">
                <span className="text-teal-300">
                  {teamMatchType === 'pvp' ? '👥 チーム補充Bot数:' : '👥 参戦Bot数 (練習):'}
                </span>
                <span className="text-sm sm:text-base font-black text-amber-300 bg-teal-950/80 px-2.5 py-0.5 rounded-lg border border-teal-400/40">
                  {botCount} 体 ({Math.ceil((botCount + 1) / 2)} vs {Math.floor((botCount + 1) / 2)})
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 w-full justify-between">
                {[10, 20, 40, 60].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setBotCount(count)}
                    className={`flex-1 py-1 rounded-lg text-[10px] sm:text-xs font-black transition-all ${
                      botCount === count
                        ? 'bg-teal-600 text-white shadow-md ring-1 ring-teal-300'
                        : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {count}体
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {mode === 'password' && (
          <input 
            type="text" 
            placeholder="Enter Room Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-black font-bold text-base sm:text-lg text-center w-60 sm:w-64 focus:outline-none focus:ring-4 focus:ring-purple-500"
          />
        )}

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-2 sm:gap-4 mb-4 sm:mb-8 w-full max-w-4xl">
          <button onClick={() => setCharClass('melee')} className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl font-bold transition-colors ${charClass === 'melee' ? 'bg-blue-600 text-white border-2 border-blue-400' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-base sm:text-xl mb-0.5 sm:mb-1">近接兵 (Assault)</div>
            <div className="text-[11px] sm:text-xs opacity-80">Balanced (100 HP)</div>
            <div className="text-[9px] sm:text-[10px] text-blue-200 mt-0.5 sm:mt-1">爆弾投擲 (Bomb)</div>
          </button>
          <button onClick={() => setCharClass('sword')} className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl font-bold transition-colors ${charClass === 'sword' ? 'bg-red-600 text-white border-2 border-red-400' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-base sm:text-xl mb-0.5 sm:mb-1">剣豪 (Blade)</div>
            <div className="text-[11px] sm:text-xs opacity-80">Melee (90 HP)</div>
            <div className="text-[9px] sm:text-[10px] text-red-200 mt-0.5 sm:mt-1">無敵ダッシュ (Invuln)</div>
          </button>
          <button onClick={() => setCharClass('tank')} className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl font-bold transition-colors ${charClass === 'tank' ? 'bg-yellow-600 text-white border-2 border-yellow-400' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-base sm:text-xl mb-0.5 sm:mb-1">Tank</div>
            <div className="text-[11px] sm:text-xs opacity-80">Heavy (150 HP)</div>
            <div className="text-[9px] sm:text-[10px] text-yellow-200 mt-0.5 sm:mt-1">防御シールド (Shield)</div>
          </button>
          <button onClick={() => setCharClass('scout')} className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl font-bold transition-colors ${charClass === 'scout' ? 'bg-green-600 text-white border-2 border-green-400' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-base sm:text-xl mb-0.5 sm:mb-1">奇襲兵 (Scout)</div>
            <div className="text-[11px] sm:text-xs opacity-80">Fast (35 HP)</div>
            <div className="text-[9px] sm:text-[10px] text-green-200 mt-0.5 sm:mt-1">飛行 (Fly)</div>
          </button>
        </div>

        <button 
          onClick={handleJoin}
          className="w-full max-w-xs sm:w-auto px-8 sm:px-12 py-3 sm:py-4 bg-yellow-400 text-black font-black text-2xl sm:text-3xl rounded-xl hover:bg-yellow-300 active:scale-95 transition-all shadow-xl mb-4"
        >
          JOIN GAME
        </button>

        {/* P2P System Notice Toast */}
        {p2pNotice && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-slate-900/95 border-2 border-amber-500 text-amber-300 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.4)] text-sm font-bold flex items-center space-x-3 backdrop-blur-md animate-bounce">
            <span>{p2pNotice}</span>
            <button
              onClick={clearP2PNotice}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {/* Friends & Social Management Modal */}
        <FriendsModal
          isOpen={isFriendsOpen}
          onClose={() => setIsFriendsOpen(false)}
          currentUserProfile={cloudProfile}
        />

        {/* Real-time P2P 1v1 Invitation Popup */}
        <P2PInviteModal
          invite={incomingP2PInvite}
          selectedClass={charClass}
        />
      </div>
    );
  }

  if (!myId || !hasGameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white font-sans touch-none select-none p-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h1 className="text-2xl sm:text-3xl font-bold animate-pulse text-blue-400 mb-2">Connecting to Server...</h1>
        <p className="text-xs sm:text-sm text-slate-400 mb-6">マッチサーバーに接続しています</p>
        <button
          type="button"
          onClick={handleReturnToLobby}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold border border-white/10 transition-all cursor-pointer"
        >
          キャンセルしてロビーへ戻る
        </button>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-sky-200 touch-none select-none">
      <Canvas 
        dpr={[1, 1.5]} 
        camera={{ fov: 75 }} 
        gl={{ powerPreference: 'high-performance', antialias: false, depth: true, stencil: false }}
      >
        <Sky sunPosition={[100, 20, 100]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[50, 80, 50]} intensity={1.2} />
        <hemisphereLight args={['#bae6fd', '#334155', 0.6]} />
        <Map />
        <BattleBus />
        <Players />
        <LocalPlayer />
        <AttackEffects />
      </Canvas>

      <DamagePopupsOverlay />
      <MobileControls onReturnToLobby={handleReturnToLobby} />

      {/* P2P Status Badge in HUD */}
      <div className="absolute top-4 left-4 z-40 pointer-events-auto">
        <P2PStatusBadge />
      </div>

      {/* P2P Realtime System Notice Toast */}
      {p2pNotice && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-slate-900/95 border-2 border-amber-500 text-amber-300 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.4)] text-sm font-bold flex items-center space-x-3 backdrop-blur-md animate-bounce">
          <span>{p2pNotice}</span>
          <button
            onClick={clearP2PNotice}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Matchmaking Lobby UI - Prominent Countdown & Readiness Banner */}
      <MatchLobbyBanner />

      {/* End Match UI */}
      <EndMatchModal onPlayAgain={handlePlayAgain} onReturnToLobby={handleReturnToLobby} />

      {/* Elimination Modal & Spectate HUD (when eliminated during playing) */}
      {!isEnded && myPlayerIsDead && (
        <>
          <EliminatedModal onReturnToLobby={handleReturnToLobby} onPlayAgain={handlePlayAgain} />
          <SpectateHUD onReturnToLobby={handleReturnToLobby} />
        </>
      )}

      {/* Friends & Social Management Modal */}
      <FriendsModal
        isOpen={isFriendsOpen}
        onClose={() => setIsFriendsOpen(false)}
        currentUserProfile={cloudProfile}
      />

      {/* Real-time P2P 1v1 Invitation Popup */}
      <P2PInviteModal
        invite={incomingP2PInvite}
        selectedClass={charClass}
      />
    </div>
  );
}
