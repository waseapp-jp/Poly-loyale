import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Check,
  X,
  Copy,
  Zap,
  Trash2,
  Clock,
  Sparkles,
  ShieldCheck,
  UserCheck,
  MessageSquare,
  ExternalLink,
  Share2
} from 'lucide-react';
import {
  auth,
  UserProfileData,
  FriendData,
  FriendRequestData,
  searchUserByIdOrName,
  fetchFriends,
  fetchFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend
} from '../firebase';
import { useGameStore } from '../store';

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: UserProfileData | null;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  isOpen,
  onClose,
  currentUserProfile
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'requests'>('list');
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [requests, setRequests] = useState<FriendRequestData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<UserProfileData | null>(null);
  const [searchError, setSearchError] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  const { sendP2PInvite } = useGameStore();

  const loadData = async () => {
    if (!currentUserProfile?.userId) return;
    setLoading(true);
    try {
      const [fList, rList] = await Promise.all([
        fetchFriends(currentUserProfile.userId),
        fetchFriendRequests(currentUserProfile.userId)
      ]);
      setFriends(fList);
      setRequests(rList);
    } catch (err) {
      console.error('Failed loading friend data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, currentUserProfile]);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearchError('');
    setSearchResult(null);
    try {
      const res = await searchUserByIdOrName(searchQuery);
      if (res) {
        setSearchResult(res);
      } else {
        setSearchError('該当するプレイヤーが見つかりませんでした');
      }
    } catch (err) {
      setSearchError('検索中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (targetUid: string) => {
    if (!currentUserProfile) return;
    setLoading(true);
    try {
      const res = await sendFriendRequest(currentUserProfile, targetUid);
      setActionMessage(res.message);
      setTimeout(() => setActionMessage(null), 3000);
      if (res.success) {
        setSearchResult(null);
        setSearchQuery('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (req: FriendRequestData) => {
    if (!currentUserProfile) return;
    setLoading(true);
    try {
      const ok = await acceptFriendRequest(req, currentUserProfile);
      if (ok) {
        setActionMessage(`✅ ${req.fromName} さんとフレンドになりました！`);
        await loadData();
      }
    } finally {
      setLoading(false);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleRejectRequest = async (req: FriendRequestData) => {
    if (!currentUserProfile) return;
    try {
      await rejectFriendRequest(currentUserProfile.userId, req.id);
      setRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveFriend = async (friendUid: string, name: string) => {
    if (!currentUserProfile || !confirm(`${name} さんをフレンド一覧から削除しますか？`)) return;
    try {
      await removeFriend(currentUserProfile.userId, friendUid);
      setFriends(prev => prev.filter(f => f.friendUid !== friendUid));
      setActionMessage(`${name} さんを削除しました`);
      setTimeout(() => setActionMessage(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInviteP2PDuel = (friend: FriendData) => {
    if (!currentUserProfile) return;
    sendP2PInvite(friend.friendUid, currentUserProfile.displayName, currentUserProfile.userId);
    setActionMessage(`⚡ ${friend.displayName} さんへP2P 1v1対戦招待を送信しました！`);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const copyOwnUid = () => {
    if (currentUserProfile?.userId) {
      navigator.clipboard.writeText(currentUserProfile.userId);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const shareOnEverychat = () => {
    if (currentUserProfile?.userId) {
      navigator.clipboard.writeText(currentUserProfile.userId);
      setCopiedUid(true);
      setActionMessage('📋 ユーザーIDをコピーし、everychat (everychat-Waseda.web.app) を開きました！');
      setTimeout(() => {
        setCopiedUid(false);
        setActionMessage(null);
      }, 5000);
      window.open('https://everychat-Waseda.web.app', '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900/95 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-b border-amber-500/20">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                フレンド & P2P 1v1
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-normal border border-amber-500/30">
                  超低遅延通信
                </span>
              </h2>
              <p className="text-xs text-slate-400">フレンドの管理とP2P 1v1対戦ルームへの即時招待</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {currentUserProfile && (
              <button
                onClick={shareOnEverychat}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border border-indigo-400/40 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
                title="IDをコピーして everychat-Waseda.web.app を開く"
              >
                <Share2 className="w-3.5 h-3.5 text-blue-200" />
                <span className="hidden sm:inline">everychatでID共有</span>
                <span className="sm:hidden">everychat</span>
                <ExternalLink className="w-3 h-3 text-indigo-200" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'list'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>フレンド一覧 ({friends.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('add')}
            className={`flex items-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'add'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>フレンド追加</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-all relative ${
              activeTab === 'requests'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>届いた申請</span>
            {requests.length > 0 && (
              <span className="ml-1.5 px-2 py-0.2 text-xs font-bold bg-amber-500 text-slate-950 rounded-full animate-pulse">
                {requests.length}
              </span>
            )}
          </button>
        </div>

        {/* Action / Alert Message Toast */}
        {actionMessage && (
          <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs font-medium flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {!currentUserProfile ? (
            <div className="text-center py-12 text-slate-400 space-y-3">
              <ShieldCheck className="w-12 h-12 mx-auto text-amber-500/40" />
              <p className="text-sm">フレンド機能を利用するにはログインが必要です</p>
            </div>
          ) : activeTab === 'list' ? (
            /* TAB 1: FRIENDS LIST */
            <div className="space-y-3">
              {friends.length === 0 ? (
                <div className="text-center py-10 space-y-3 border border-dashed border-slate-800 rounded-xl p-6">
                  <Users className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-sm text-slate-400">まだフレンドが登録されていません</p>
                  <p className="text-xs text-slate-500">「フレンド追加」タブからIDやコールサインで検索して申請しましょう</p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold hover:bg-amber-500/30 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>フレンドを探す</span>
                  </button>
                </div>
              ) : (
                friends.map((friend) => (
                  <div
                    key={friend.friendUid}
                    className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800/80 hover:border-amber-500/30 rounded-xl transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-lg">
                          {friend.displayName.charAt(0).toUpperCase()}
                        </div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" title="オンライン" />
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm flex items-center space-x-1.5">
                          <span>{friend.displayName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          ID: {friend.friendUid.slice(0, 12)}...
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleInviteP2PDuel(friend)}
                        className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs rounded-lg shadow-md hover:shadow-amber-500/20 flex items-center space-x-1.5 transition-all"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>P2P 1v1招待</span>
                      </button>

                      <button
                        onClick={() => handleRemoveFriend(friend.friendUid, friend.displayName)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'add' ? (
            /* TAB 2: ADD FRIEND & OWN CODE */
            <div className="space-y-6">
              {/* Own User ID Display Card */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-amber-400 flex items-center space-x-1">
                    <UserCheck className="w-4 h-4" />
                    <span>あなたのフレンドコード / User ID</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyOwnUid}
                      className="flex items-center space-x-1 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-xs font-bold text-amber-300 transition-all active:scale-95"
                    >
                      {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedUid ? 'コピー完了!' : 'IDをコピー'}</span>
                    </button>

                    <button
                      onClick={shareOnEverychat}
                      className="flex items-center space-x-1 px-2.5 py-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border border-indigo-400/50 rounded-lg text-xs font-extrabold shadow-md hover:shadow-indigo-500/20 transition-all active:scale-95"
                      title="IDをコピーして everychat-Waseda.web.app を開く"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-blue-200" />
                      <span>everychatで共有</span>
                      <ExternalLink className="w-3 h-3 text-indigo-200" />
                    </button>
                  </div>
                </div>

                <div className="font-mono text-xs text-slate-200 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 select-all break-all flex items-center justify-between">
                  <span>{currentUserProfile.userId}</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 gap-2 flex-wrap pt-1 border-t border-amber-500/20">
                  <span>友達にこのIDを共有すると、直接フレンド申請を送ってもらえます。</span>
                  <button
                    type="button"
                    onClick={shareOnEverychat}
                    className="text-xs text-indigo-300 hover:text-indigo-200 font-bold underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>💬 everychatでコミュニティへ共有</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Search Form */}
              <form onSubmit={handleSearch} className="space-y-3">
                <label className="block text-xs font-bold text-slate-300">
                  コールサイン（名前）またはUser IDで検索
                </label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="例: PlayerName または Auth UID..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !searchQuery.trim()}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5"
                  >
                    <span>検索</span>
                  </button>
                </div>
              </form>

              {/* Search Error */}
              {searchError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                  {searchError}
                </div>
              )}

              {/* Search Result Display */}
              {searchResult && (
                <div className="p-4 bg-slate-950 border border-amber-500/40 rounded-xl flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-amber-500/40 flex items-center justify-center font-bold text-amber-400 text-lg">
                      {searchResult.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{searchResult.displayName}</div>
                      <div className="text-xs text-slate-400">
                        勝利: {searchResult.totalWins}勝 | 撃破: {searchResult.totalKills}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSendRequest(searchResult.userId)}
                    disabled={loading}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all flex items-center space-x-1"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>申請を送信</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* TAB 3: PENDING REQUESTS */
            <div className="space-y-3">
              {requests.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl p-6 text-slate-500">
                  <Clock className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                  <p className="text-sm">現在、届いているフレンド申請はありません</p>
                </div>
              ) : (
                requests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3.5 bg-slate-950 border border-amber-500/30 rounded-xl"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-lg">
                        {req.fromName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{req.fromName}</div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(req.createdAt).toLocaleDateString('ja-JP')} に送信
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleAcceptRequest(req)}
                        disabled={loading}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-lg flex items-center space-x-1 transition-all"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>承認</span>
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req)}
                        disabled={loading}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>P2P 1v1モード: ピアツーピア超低遅延ダイレクト通信</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold transition-all"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
};
