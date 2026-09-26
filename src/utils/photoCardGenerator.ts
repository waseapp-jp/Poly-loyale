// High-resolution Match Result & Player Battle Pass Photo Card Generator
import { RankTier, RANK_CONFIGS } from './rankUtils';

export interface PhotoCardData {
  displayName: string;
  avatarUrl?: string;
  tier: RankTier;
  ratingOrPoints: number;
  isGod: boolean;
  score?: number;
  kills?: number;
  placement?: number;
  isVictory?: boolean;
  gameMode?: string;
  totalWins?: number;
  dateStr?: string;
}

export function generatePhotoCard(data: PhotoCardData): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve('');

    const config = RANK_CONFIGS[data.tier] || RANK_CONFIGS.Beginner;

    // 1. Dark Futuristic Background
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(0.5, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1080);

    // 2. Cyberpunk Decorative Grid & Hexagonal Glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 40; x < 1080; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1080);
      ctx.stroke();
    }
    for (let y = 40; y < 1080; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1080, y);
      ctx.stroke();
    }

    // Glowing border frame matching rank tier
    ctx.save();
    ctx.strokeStyle = config.primaryColor;
    ctx.lineWidth = 6;
    ctx.shadowColor = config.primaryColor;
    ctx.shadowBlur = 35;
    ctx.strokeRect(30, 30, 1020, 1020);
    ctx.restore();

    // Inner subtle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(45, 45, 990, 990);

    // 3. Top Header: POLY ROYALE Logo
    ctx.textAlign = 'center';
    ctx.font = '900 48px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
    ctx.shadowBlur = 20;
    ctx.fillText('⚡ POLY ROYALE ⚡', 540, 115);
    ctx.shadowBlur = 0;

    ctx.font = '700 20px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('OFFICIAL BATTLE PASS & RESULT SNAPSHOT', 540, 150);

    // 4. Centerpiece: Avatar Photo with Rank Aura
    const renderCardContent = (avatarImg?: HTMLImageElement) => {
      ctx.save();
      const centerX = 540;
      const centerY = 340;
      const radius = 110;

      // Glow halo
      ctx.shadowColor = config.primaryColor;
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = config.primaryColor;
      ctx.fill();

      // Avatar circle mask
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      if (avatarImg) {
        ctx.drawImage(avatarImg, centerX - radius, centerY - radius, radius * 2, radius * 2);
      } else {
        // Fallback Initial
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 90px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((data.displayName || 'P')[0].toUpperCase(), centerX, centerY);
      }
      ctx.restore();

      // 5. Player Name & Rank Badge
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '900 52px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 10;
      ctx.fillText(data.displayName || 'Player', 540, 520);

      // Rank Pill Badge
      ctx.font = '900 28px sans-serif';
      ctx.fillStyle = config.primaryColor;
      ctx.shadowColor = config.primaryColor;
      ctx.shadowBlur = 15;
      ctx.fillText(
        `${config.badgeEmoji} RANK: ${config.tier.toUpperCase()} (${config.labelJa}) - ${config.title}`,
        540,
        565
      );
      ctx.shadowBlur = 0;

      // 6. Match Outcome / Victory Banner
      const isVictory = data.isVictory || data.placement === 1;
      const outcomeText = isVictory ? '👑 VICTORY ROYALE #1 👑' : (data.placement ? `PLACED #${data.placement}` : '⚔️ COMBAT RECORD ⚔️');
      const outcomeColor = isVictory ? '#facc15' : '#38bdf8';

      ctx.font = '900 38px sans-serif';
      ctx.fillStyle = outcomeColor;
      ctx.fillText(outcomeText, 540, 630);

      // 7. Stats Grid Box
      const boxY = 670;
      const boxH = 240;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(100, boxY, 880, boxH, 24);
      ctx.fill();
      ctx.stroke();

      // Column 1: Rating / RP
      ctx.textAlign = 'center';
      ctx.font = '700 20px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(data.isGod ? 'GOD RATING' : 'RANK POINTS (RP)', 240, boxY + 70);

      ctx.font = '900 54px sans-serif';
      ctx.fillStyle = config.primaryColor;
      ctx.fillText(`${data.ratingOrPoints}`, 240, boxY + 145);

      // Column 2: Kills / Score
      ctx.font = '700 20px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('ELIMINATIONS (KILLS)', 540, boxY + 70);

      ctx.font = '900 54px sans-serif';
      ctx.fillStyle = '#f87171';
      ctx.fillText(`${data.kills ?? data.score ?? 0}`, 540, boxY + 145);

      // Column 3: Total Wins / Mode
      ctx.font = '700 20px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(data.gameMode ? 'MODE' : 'TOTAL WINS', 840, boxY + 70);

      ctx.font = '900 50px sans-serif';
      ctx.fillStyle = '#34d399';
      ctx.fillText(data.gameMode ? data.gameMode.toUpperCase() : `${data.totalWins ?? 0} 勝`, 840, boxY + 145);

      // 8. Footer & Timestamp
      ctx.textAlign = 'center';
      ctx.font = '600 18px sans-serif';
      ctx.fillStyle = '#64748b';
      const timeStr = data.dateStr || new Date().toLocaleString('ja-JP');
      ctx.fillText(`POLY ROYALE COMBAT SNAPSHOT • ${timeStr}`, 540, 970);
      ctx.fillText('https://ais-pre-26lckcvht5rkxvj2a7rym3-554926909913.asia-northeast1.run.app', 540, 998);

      resolve(canvas.toDataURL('image/png'));
    };

    if (data.avatarUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => renderCardContent(img);
      img.onerror = () => renderCardContent(undefined);
      img.src = data.avatarUrl;
    } else {
      renderCardContent(undefined);
    }
  });
}

export function downloadPhotoCard(dataUrl: string, filename = 'poly_royale_card.png') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
