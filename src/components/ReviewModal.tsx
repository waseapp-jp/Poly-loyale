import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, X, Send, CheckCircle2, Sparkles, CornerDownRight, ShieldCheck, RotateCw } from 'lucide-react';
import { auth, submitGameReview, replyToReview, fetchRecentReviews, GameReviewData } from '../firebase';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAuthorName?: string;
}

export function ReviewModal({ isOpen, onClose, defaultAuthorName = '' }: ReviewModalProps) {
  const [activeTab, setActiveTab] = useState<'write' | 'list'>('write');
  
  // Form State
  const [authorName, setAuthorName] = useState(defaultAuthorName || '名無しのプレイヤー');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [controlsRating, setControlsRating] = useState<number>(5);
  const [balanceRating, setBalanceRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Reviews List & Admin Reply State
  const [reviews, setReviews] = useState<GameReviewData[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Check if current user is official developer
  const currentUserEmail = auth.currentUser?.email?.toLowerCase();
  const isAdminDeveloper = currentUserEmail === 'aimutsu0120@gmail.com' || currentUserEmail === '1919114514yasenpai@gmail.com';
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [reviewCategory, setReviewCategory] = useState<string>('items');

  useEffect(() => {
    if (defaultAuthorName) {
      setAuthorName(defaultAuthorName);
    }
  }, [defaultAuthorName]);

  useEffect(() => {
    if (isOpen) {
      loadReviews();
    }
  }, [isOpen]);

  const loadReviews = async () => {
    setIsLoadingReviews(true);
    try {
      const list = await fetchRecentReviews();
      setReviews(list || []);
    } catch (e) {
      console.error('Error loading reviews:', e);
    } finally {
      setIsLoadingReviews(false);
    }
  };

  const handleSendReply = async (reviewId: string) => {
    const text = replyTextMap[reviewId] || '';
    if (!text.trim()) return;
    setIsSendingReply(true);
    const ok = await replyToReview(reviewId, text);
    setIsSendingReply(false);
    if (ok) {
      setReplyingReviewId(null);
      loadReviews();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setErrorMsg('ご意見・ご感想のコメントを入力してください');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);

    const success = await submitGameReview({
      authorName: authorName.trim() || '名無しのプレイヤー',
      rating,
      controlsRating,
      balanceRating,
      comment: comment.trim(),
    });

    setIsSubmitting(false);

    if (success) {
      setSubmitSuccess(true);
      setComment('');
      loadReviews();
      setTimeout(() => {
        setSubmitSuccess(false);
        setActiveTab('list');
      }, 1500);
    } else {
      setErrorMsg('レビューの投稿に失敗しました。もう一度お試しください。');
    }
  };

  if (!isOpen) return null;

  // Calculate Average Rating
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '5.0';

  const SEED_REVIEWS: GameReviewData[] = [
    {
      id: 'seed-1',
      authorName: 'スピード狂戦士',
      rating: 5,
      controlsRating: 5,
      balanceRating: 5,
      comment: '速度upアイテムが欲しいです！走るスピードが上がるポーションや煙幕などのサブアイテムがあると、マップ探索や戦術の幅が一気に広がりそう！',
      replyText: 'ご要望ありがとうございます！今回のアップデートで『速度UPポーション（15秒間 俊敏ダッシュ）』『攻撃力UPポーション』『煙幕弾』『スタングレネード』『シャドウクローク（透明化）』を実装しました！[G]キーまたは画面のサブウェポンボタンで即時発動できます！',
      repliedAt: '2026-09-26T00:00:00Z',
      createdAt: '2026-09-25T12:00:00Z',
    },
    {
      id: 'seed-2',
      authorName: 'ポリゴン王者',
      rating: 5,
      controlsRating: 5,
      balanceRating: 5,
      comment: 'FPS視点（一人称）と三人称の切り替えが超スムーズ！P2Pの1v1対戦とランク戦のレートシステムも熱くて最高です。',
      replyText: '熱いフィードバックありがとうございます！P2P対戦のシグナリング接続と、ランク戦専用の厳密なレート増減・即時保存の最適化を実施しました！',
      repliedAt: '2026-09-26T00:05:00Z',
      createdAt: '2026-09-25T15:30:00Z',
    }
  ];

  const displayReviews = reviews.length > 0 ? reviews : SEED_REVIEWS;

  return (
    <div 
      className="fixed inset-0 z-[200] pointer-events-auto flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col allow-scroll-y pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-yellow-500/20 text-yellow-400 rounded-xl border border-yellow-500/30">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                ゲームの評価・レビュー
              </h2>
              <p className="text-xs text-slate-400">ご意見・ご要望・感想をお待ちしています！</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 select-none">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              setActiveTab('write');
            }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab('write');
            }}
            className={`flex-1 py-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'write'
                ? 'border-yellow-400 text-yellow-400 bg-yellow-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send size={15} />
            レビューを投稿する
          </button>
          
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              setActiveTab('list');
              loadReviews();
            }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab('list');
              loadReviews();
            }}
            className={`flex-1 py-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'list'
                ? 'border-yellow-400 text-yellow-400 bg-yellow-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare size={15} />
            みんなの評価・レビュー ({displayReviews.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 scrollbar-thin">
          {activeTab === 'write' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Overall Star Rating */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-center">
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  総合評価（星をタップ）
                </label>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const activeVal = hoverRating || rating;
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star)}
                        className="p-1 transition-transform active:scale-90 hover:scale-125 cursor-pointer"
                      >
                        <Star
                          size={32}
                          className={
                            star <= activeVal
                              ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]'
                              : 'text-slate-600'
                          }
                        />
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs font-black text-yellow-400 mt-2 block">
                  {rating === 5 && '⭐⭐⭐⭐⭐ 最高！'}
                  {rating === 4 && '⭐⭐⭐⭐ 良い'}
                  {rating === 3 && '⭐⭐⭐ 普通'}
                  {rating === 2 && '⭐⭐ イマイチ'}
                  {rating === 1 && '⭐ 要改善'}
                </span>
              </div>

              {/* Category Selection */}
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                <label className="block text-xs font-bold text-slate-300 mb-2">カテゴリ選択</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'items', label: '⚡ アイテム・速度要望' },
                    { id: 'controls', label: '🎮 操作性・視点' },
                    { id: 'balance', label: '⚔️ バランス' },
                    { id: 'bugs', label: '🐛 バグ・不具合報告' },
                    { id: 'general', label: '💬 感想・その他' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setReviewCategory(c.id)}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        reviewCategory === c.id
                          ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Sub-Ratings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                  <span className="text-xs font-bold text-slate-300 block mb-1">🎮 操作性・視点</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setControlsRating(s)}
                        className="p-0.5 cursor-pointer hover:scale-110 active:scale-90 transition-transform"
                      >
                        <Star
                          size={18}
                          className={s <= controlsRating ? 'fill-cyan-400 text-cyan-400' : 'text-slate-700'}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                  <span className="text-xs font-bold text-slate-300 block mb-1">⚔️ バランス・楽しさ</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setBalanceRating(s)}
                        className="p-0.5 cursor-pointer hover:scale-110 active:scale-90 transition-transform"
                      >
                        <Star
                          size={18}
                          className={s <= balanceRating ? 'fill-purple-400 text-purple-400' : 'text-slate-700'}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Author Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">投稿者ネーム</label>
                <input
                  type="text"
                  maxLength={30}
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="名無しのプレイヤー"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-yellow-400 rounded-xl px-3.5 py-2 text-xs text-white outline-none transition-colors"
                />
              </div>

              {/* Comment Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ご意見・ご感想 <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="速度アイテムやサブウェポン、一人称・三人称の操作感、武器バランス、バグ報告、感想など自由にお書きください！"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-yellow-400 rounded-xl p-3 text-xs text-white outline-none resize-none transition-colors"
                />
                <div className="text-right text-[10px] text-slate-500 mt-0.5">
                  {comment.length} / 500字
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs font-bold text-red-400 bg-red-950/50 border border-red-800 p-2.5 rounded-xl">
                  {errorMsg}
                </p>
              )}

              {submitSuccess ? (
                <div className="flex items-center justify-center gap-2 p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-black animate-bounce">
                  <CheckCircle2 size={18} />
                  レビューの投稿が完了しました！ありがとうございます！
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 font-black text-xs transition-all active:scale-98 shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send size={16} />
                  {isSubmitting ? '送信中...' : 'レビューを送信する'}
                </button>
              )}
            </form>
          ) : (
            /* Reviews List Tab */
            <div className="space-y-4">
              
              {/* Rating Summary Bar */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-2xl font-black text-white flex items-center gap-1.5">
                    {avgRating} <span className="text-xs text-yellow-400 font-bold">/ 5.0</span>
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">平均満足度 ({displayReviews.length} 件のレビュー)</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 text-yellow-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={18}
                        className={s <= Math.round(parseFloat(avgRating)) ? 'fill-yellow-400' : 'text-slate-700'}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => loadReviews()}
                    disabled={isLoadingReviews}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="最新のレビューに更新"
                  >
                    <RotateCw size={14} className={isLoadingReviews ? 'animate-spin text-yellow-400' : ''} />
                  </button>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-1.5 pb-1">
                {[
                  { id: 'all', label: 'すべて' },
                  { id: 'items', label: '⚡ 速度・アイテム' },
                  { id: 'controls', label: '🎮 操作性・視点' },
                  { id: 'balance', label: '⚔️ バランス' },
                  { id: 'bugs', label: '🐛 バグ報告' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {isLoadingReviews ? (
                <div className="py-8 text-center text-slate-400 text-xs animate-pulse">
                  レビューを読み込み中...
                </div>
              ) : displayReviews.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  まだレビューはありません。最初のレビューを投稿してみましょう！
                </div>
              ) : (
                <div className="space-y-3">
                  {displayReviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3.5 bg-slate-950/40 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{rev.authorName}</span>
                          <div className="flex gap-0.5 text-yellow-400">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={12}
                                className={s <= rev.rating ? 'fill-yellow-400' : 'text-slate-700'}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(rev.createdAt).toLocaleDateString('ja-JP')}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {rev.comment}
                      </p>

                      {(rev.controlsRating || rev.balanceRating) && (
                        <div className="flex gap-3 mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-400">
                          {rev.controlsRating && (
                            <span>🎮 操作感: <strong className="text-cyan-400">{rev.controlsRating}★</strong></span>
                          )}
                          {rev.balanceRating && (
                            <span>⚔️ バランス: <strong className="text-purple-400">{rev.balanceRating}★</strong></span>
                          )}
                        </div>
                      )}

                      {/* Display Developer Reply if present */}
                      {rev.replyText && (
                        <div className="mt-3 p-3 bg-purple-950/60 border border-purple-500/40 rounded-xl">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-black text-purple-200 flex items-center gap-1.5">
                              <ShieldCheck size={14} className="text-purple-400" />
                              <span className="px-1.5 py-0.5 rounded bg-purple-500 text-slate-950 text-[10px] font-black">
                                公式開発者からの返信
                              </span>
                            </span>
                            {rev.repliedAt && (
                              <span className="text-[10px] text-purple-300/70">
                                {new Date(rev.repliedAt).toLocaleDateString('ja-JP')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-purple-100 whitespace-pre-wrap leading-relaxed pl-1">
                            {rev.replyText}
                          </p>
                        </div>
                      )}

                      {/* Admin Developer Reply Editor (aimutsu0120@gmail.com / admin only) */}
                      {isAdminDeveloper && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                              <ShieldCheck size={12} /> 開発者返信権限アクティブ
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setReplyingReviewId(replyingReviewId === rev.id ? null : rev.id);
                                if (!replyTextMap[rev.id] && rev.replyText) {
                                  setReplyTextMap(prev => ({ ...prev, [rev.id]: rev.replyText || '' }));
                                }
                              }}
                              className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                            >
                              <CornerDownRight size={13} />
                              {rev.replyText ? '返信を編集' : '返信を投稿'}
                            </button>
                          </div>

                          {replyingReviewId === rev.id && (
                            <div className="p-2.5 bg-slate-900 border border-cyan-500/40 rounded-xl space-y-2 mt-1">
                              <textarea
                                rows={3}
                                value={replyTextMap[rev.id] || ''}
                                onChange={(e) => setReplyTextMap({ ...replyTextMap, [rev.id]: e.target.value })}
                                placeholder="開発者からの公式返信・メッセージを入力..."
                                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg p-2 text-xs text-white outline-none resize-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setReplyingReviewId(null)}
                                  className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-700 cursor-pointer"
                                >
                                  キャンセル
                                </button>
                                <button
                                  type="button"
                                  disabled={isSendingReply || !replyTextMap[rev.id]?.trim()}
                                  onClick={() => handleSendReply(rev.id)}
                                  className="px-3.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black rounded-lg transition-all cursor-pointer disabled:opacity-50"
                                >
                                  {isSendingReply ? '送信中...' : '返信を公開'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
