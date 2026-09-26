import React, { useState } from 'react';
import { Camera, Image as ImageIcon, Upload, Check, X, Sparkles, RefreshCw } from 'lucide-react';
import { updateUserPhotoURL, UserProfileData } from '../firebase';
import { RankTier, RANK_CONFIGS } from '../utils/rankUtils';

// 8 Stylized Cyberpunk / Battle Royale Vector Avatars encoded as clean data URIs
const PRESET_AVATARS = [
  {
    id: 'assault',
    name: '近接兵 (Assault)',
    color: '#3b82f6',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#0284c7"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g1)"/><path d="M50 20 L75 35 L75 65 L50 80 L25 65 L25 35 Z" fill="#1e293b" stroke="#38bdf8" stroke-width="4"/><circle cx="50" cy="50" r="14" fill="#38bdf8"/><path d="M42 48 L58 48" stroke="#ffffff" stroke-width="3"/></svg>`,
  },
  {
    id: 'blade',
    name: '剣豪 (Blade)',
    color: '#ef4444',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#b91c1c"/><stop offset="100%" stop-color="#f97316"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g2)"/><path d="M30 75 L70 25 M35 75 L75 35" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="50" r="12" fill="#ef4444" stroke="#ffffff" stroke-width="3"/></svg>`,
  },
  {
    id: 'tank',
    name: '重装兵 (Titan)',
    color: '#eab308',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ca8a04"/><stop offset="100%" stop-color="#eab308"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g3)"/><polygon points="50,18 80,30 80,65 50,82 20,65 20,30" fill="#0f172a" stroke="#facc15" stroke-width="4"/><rect x="38" y="42" width="24" height="16" rx="4" fill="#facc15"/></svg>`,
  },
  {
    id: 'scout',
    name: '奇襲兵 (Scout)',
    color: '#10b981',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#047857"/><stop offset="100%" stop-color="#10b981"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g4)"/><polygon points="50,15 85,55 50,45 15,55" fill="#ffffff"/><circle cx="50" cy="65" r="10" fill="#064e3b" stroke="#a7f3d0" stroke-width="3"/></svg>`,
  },
  {
    id: 'cyber',
    name: '電脳 (Hacker)',
    color: '#06b6d4',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0891b2"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g5)"/><rect x="25" y="35" width="50" height="30" rx="6" fill="#0f172a" stroke="#22d3ee" stroke-width="3"/><circle cx="40" cy="50" r="5" fill="#22d3ee"/><circle cx="60" cy="50" r="5" fill="#22d3ee"/></svg>`,
  },
  {
    id: 'valkyrie',
    name: '神格 (Valkyrie)',
    color: '#f59e0b',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g6)"/><path d="M50 20 L62 45 L90 50 L68 70 L75 98 L50 82 L25 98 L32 70 L10 50 L38 45 Z" fill="#ffffff" opacity="0.9"/></svg>`,
  },
  {
    id: 'mecha',
    name: '機動 (Mecha)',
    color: '#8b5cf6',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g7" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6d28d9"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g7)"/><polygon points="30,30 70,30 80,70 20,70" fill="#18181b" stroke="#c084fc" stroke-width="4"/><line x1="30" y1="48" x2="70" y2="48" stroke="#38bdf8" stroke-width="4"/></svg>`,
  },
  {
    id: 'ninja',
    name: '影忍 (Ninja)',
    color: '#64748b',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g8" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#475569"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g8)"/><circle cx="50" cy="50" r="30" fill="#0f172a"/><rect x="25" y="44" width="50" height="12" fill="#ef4444"/><circle cx="40" cy="50" r="3" fill="#ffffff"/><circle cx="60" cy="50" r="3" fill="#ffffff"/></svg>`,
  },
];

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface PhotoAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhotoURL?: string;
  userRankTier: RankTier;
  userId?: string;
  onPhotoSaved: (newPhotoUrl: string) => void;
}

export function PhotoAvatarModal({
  isOpen,
  onClose,
  currentPhotoURL,
  userRankTier,
  userId,
  onPhotoSaved,
}: PhotoAvatarModalProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string>(currentPhotoURL || '');
  const [customUrl, setCustomUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const config = RANK_CONFIGS[userRankTier] || RANK_CONFIGS.Beginner;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Optimize to 128x128 JPEG to keep size lightweight (< 20KB)
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 128, 128);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setSelectedPhoto(compressedDataUrl);
        }
        setIsProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!selectedPhoto) return;
    setIsProcessing(true);
    try {
      if (userId) {
        await updateUserPhotoURL(userId, selectedPhoto);
      }
      // Save locally
      const local = JSON.parse(localStorage.getItem('poly_profile') || '{}');
      local.photoURL = selectedPhoto;
      localStorage.setItem('poly_profile', JSON.stringify(local));

      onPhotoSaved(selectedPhoto);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Failed to update photo:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-purple-500/50 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.3)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Camera size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>写真・アバター設定</span>
                <span className="text-xs text-purple-400 font-bold bg-purple-950/80 px-2 py-0.5 rounded-full border border-purple-500/30">
                  Photo Studio
                </span>
              </h2>
              <p className="text-xs text-slate-400">プロファイルやリーダーボード、試合写真に表示されるアイコン</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 allow-scroll">
          
          {/* Active Avatar Preview with Glow */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
            <div className="relative mb-3">
              <div
                className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-slate-800 transition-all duration-300 shadow-2xl"
                style={{
                  border: `3px solid ${config.primaryColor}`,
                  boxShadow: `0 0 25px ${config.primaryColor}88`,
                }}
              >
                {selectedPhoto ? (
                  <img
                    src={selectedPhoto}
                    alt="Selected Avatar"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-4xl font-black text-white">?</span>
                )}
              </div>
              <div
                className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-full bg-slate-900 border text-xs shadow-md"
                style={{ borderColor: config.primaryColor, color: config.primaryColor }}
                title={config.tier}
              >
                {config.badgeEmoji}
              </div>
            </div>
            <div className="text-xs text-slate-300 font-bold">現在の選択中アバター</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              ランクオーラ: <strong style={{ color: config.primaryColor }}>{config.tier} ({config.labelJa})</strong>
            </div>
          </div>

          {/* Section 1: Preset Battle Avatars */}
          <div>
            <div className="text-xs font-black text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" />
              <span>公式プリセット写真 (8種)</span>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              {PRESET_AVATARS.map((preset) => {
                const dataUrl = svgToDataUrl(preset.svg);
                const isSelected = selectedPhoto === dataUrl;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPhoto(dataUrl)}
                    className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-purple-500/20 border-purple-400 ring-2 ring-purple-400/50 scale-105'
                        : 'bg-slate-800/80 border-slate-700/80 hover:bg-slate-700/80'
                    }`}
                  >
                    <img
                      src={dataUrl}
                      alt={preset.name}
                      className="w-12 h-12 rounded-full mb-1 object-cover"
                    />
                    <span className="text-[10px] font-bold text-slate-300 truncate w-full text-center">
                      {preset.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Upload from Device / Camera */}
          <div>
            <div className="text-xs font-black text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Upload size={14} className="text-sky-400" />
              <span>お好きな写真・画像をアップロード</span>
            </div>
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-700 hover:border-sky-400/70 rounded-2xl cursor-pointer bg-slate-950/40 hover:bg-slate-900/60 transition-all p-3 text-center">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                <Camera size={18} />
                <span>写真を選択 / カメラで撮影</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                端末の写真フォルダまたはカメラから画像をアップロード（自動最適化）
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Section 3: Image URL input */}
          <div>
            <div className="text-xs font-black text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ImageIcon size={14} className="text-emerald-400" />
              <span>画像URLを指定</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://... (画像のURLを入力)"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (customUrl.trim()) {
                    setSelectedPhoto(customUrl.trim());
                  }
                }}
                disabled={!customUrl.trim()}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all"
              >
                適用
              </button>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
          >
            キャンセル
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing || !selectedPhoto}
            className={`flex-1 py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
              saveSuccess
                ? 'bg-emerald-500 text-white'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white active:scale-98 disabled:opacity-50'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>保存中...</span>
              </>
            ) : saveSuccess ? (
              <>
                <Check size={16} />
                <span>写真を保存しました！</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>この写真で決定・保存する</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
