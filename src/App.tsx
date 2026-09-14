import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { useGameStore } from './store';
import { Map } from './components/Map';
import { Players } from './components/Players';
import { LocalPlayer } from './components/LocalPlayer';
import { BattleBus } from './components/BattleBus';
import { AttackEffects } from './components/AttackEffects';
import { MobileControls } from './components/MobileControls';
import { EliminatedModal, SpectateHUD } from './components/EliminatedModal';
import { FirebaseAccount } from './components/FirebaseAccount';
import { auth, updateUserStats, UserProfileData } from './firebase';
import { CharacterClass } from './types';
import { RotateCcw, LogOut, Trophy, Flame, Sparkles } from 'lucide-react';
import { getRankTier, RANK_CONFIGS } from './utils/rankUtils';

export default function App() {
  const connect = useGameStore((s) => s.connect);
  const leaveGame = useGameStore((s) => s.leaveGame);
  const myId = useGameStore((s) => s.myId);
  const hasGameState = useGameStore((s) => !!s.gameState);
  const status = useGameStore((s) => s.gameState?.status);
  const roomId = useGameStore((s) => s.gameState?.roomId);
  const winner = useGameStore((s) => s.gameState?.winner);
  const gameMode = useGameStore((s) => s.gameState?.mode);
  const playerCount = useGameStore((s) => s.gameState ? Object.keys(s.gameState.players).length : 0);
  const matchTimer = useGameStore((s) => s.gameState ? Math.ceil(s.gameState.matchTimer) : 0);
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

  const isWaiting = status === 'waiting';
  const isEnded = status === 'ended';
  const isPlaying = status === 'playing';

  const socket = useGameStore((s) => s.socket);
  const [hasStarted, setHasStarted] = useState(false);
  const [mode, setMode] = useState<'casual'|'ranked'|'password'|'team'|'bot'>('bot');
  const [password, setPassword] = useState('');
  const [charClass, setCharClass] = useState<CharacterClass>('melee');
  const [botCount, setBotCount] = useState(15);
  const [lastProcessedMatch, setLastProcessedMatch] = useState<string | null>(null);
  const [cloudProfile, setCloudProfile] = useState<UserProfileData | null>(null);

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
      connect(mode, password, charClass, botCount);
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
    connect(mode, password, charClass, botCount);
    setHasStarted(true);
  };

  if (!hasStarted) {
    return (
      <div className="allow-scroll flex flex-col items-center justify-start sm:justify-center w-full h-full min-h-screen overflow-y-auto bg-slate-900 text-white font-sans select-none px-4 py-8 text-center pb-24 absolute inset-0">
        <h1 className="text-4xl sm:text-6xl font-black mb-1 sm:mb-2 text-blue-400 drop-shadow-lg">POLY ROYALE</h1>
        
        {/* Lobby Rank Aura Pill */}
        <div
          className="text-sm sm:text-base font-black mb-4 sm:mb-5 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full border flex items-center justify-center gap-2 shadow-lg backdrop-blur-md transition-all animate-rank-pulse"
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
          {mode === 'team' && '🛡️ 赤チーム vs 青チームの陣営対抗デスマッチ'}
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
      </div>
    );
  }

  if (!myId || !hasGameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white font-sans touch-none select-none">
        <h1 className="text-3xl font-bold animate-pulse text-blue-400">Connecting...</h1>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-sky-200 touch-none select-none">
      <Canvas camera={{ fov: 75 }} gl={{ powerPreference: 'high-performance', antialias: false }}>
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

      <MobileControls />

      {/* Matchmaking Lobby UI - Prominent Countdown & Readiness Banner */}
      {isWaiting && (
        <div className="absolute top-4 sm:top-8 left-0 right-0 flex justify-center pointer-events-none z-30 px-4">
          <div className="bg-slate-900/95 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-3xl font-bold border-2 border-yellow-400/60 shadow-[0_0_35px_rgba(250,204,21,0.4)] backdrop-blur-xl flex flex-col items-center gap-1.5 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-ping" />
              <span className="text-xs sm:text-sm font-black text-yellow-300 uppercase tracking-widest">
                {gameMode?.toUpperCase()} MATCH LOBBY
                {gameMode === 'password' && ` • ROOM: ${roomId}`}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-sm sm:text-base text-slate-300 font-bold">
                👥 待機中: <strong className="text-white font-mono">{playerCount}</strong> 人
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
      )}

      {/* End Match UI */}
      {isEnded && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md text-white pointer-events-auto p-4 select-none touch-none">
          <div className="w-full max-w-md bg-slate-900/95 border-2 border-yellow-500/40 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(234,179,8,0.25)] text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center text-yellow-400 mb-3 shadow-[0_0_20px_rgba(234,179,8,0.4)]">
              <Trophy size={36} className="animate-bounce" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-yellow-400 mb-1 drop-shadow tracking-wider">
              {winner === myId ? 'VICTORY ROYALE!' : 'MATCH OVER'}
            </h1>
            
            <p className="text-slate-400 text-sm font-semibold mb-6">
              {winner === myId ? '見事最後まで生き残りました！' : '試合が終了しました'}
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
                onClick={handlePlayAgain}
                className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 active:scale-98 text-slate-950 font-black text-lg rounded-2xl shadow-lg shadow-yellow-400/30 flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw size={22} className="stroke-[2.5]" />
                <span>次マッチに参戦</span>
              </button>

              <button
                type="button"
                onClick={handleReturnToLobby}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-300 font-bold text-base rounded-2xl border border-white/10 flex items-center justify-center gap-2 transition-all"
              >
                <LogOut size={18} />
                <span>ロビーに戻る</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elimination Modal & Spectate HUD (when eliminated during playing) */}
      {!isEnded && myPlayerIsDead && (
        <>
          <EliminatedModal onReturnToLobby={handleReturnToLobby} onPlayAgain={handlePlayAgain} />
          <SpectateHUD onReturnToLobby={handleReturnToLobby} />
        </>
      )}
    </div>
  );
}
