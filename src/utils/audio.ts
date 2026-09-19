// Robust Web Audio synthesis sound system with singleton AudioContext
// Automatically resumes context on user gestures to avoid browser autoplay policy drops

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();

      // Master Compressor to prevent distortion/clipping
      compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, audioCtx.currentTime);
      compressor.knee.setValueAtTime(12, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.5, audioCtx.currentTime);

      compressor.connect(masterGain);
      masterGain.connect(audioCtx.destination);
    } catch {
      return null;
    }
  }

  // Ensure AudioContext is resumed if suspended
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

// Global user interaction listener to un-suspend Web Audio immediately
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('click', unlockAudio, { passive: true });
}

let lastHitSoundTime = 0;
let lastShootSoundTime = 0;

/**
 * Crisp, punchy hit confirmation chime (metallic ding)
 * Plays reliably on every confirmed damage hit
 */
export function playHitSound(pitchOffset = 0) {
  try {
    const ctx = getAudioContext();
    if (!ctx || !compressor) return;

    const now = performance.now();
    // Allow rapid hits up to 25 hits/sec without dropping
    if (now - lastHitSoundTime < 35) return;
    lastHitSoundTime = now;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const baseFreq = 920 + Math.min(200, Math.max(-100, pitchOffset));
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, t + 0.08);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(compressor);

    osc.start(t);
    osc.stop(t + 0.09);
  } catch {
    // Fail silently without breaking game loop
  }
}

/**
 * Class-specific weapon firing sound effects
 */
export function playShootSound(characterClass: string, isLocal = true, distance = 0) {
  try {
    const ctx = getAudioContext();
    if (!ctx || !compressor) return;

    const now = performance.now();
    if (isLocal && now - lastShootSoundTime < 40) return;
    if (isLocal) lastShootSoundTime = now;

    const t = ctx.currentTime;
    const gain = ctx.createGain();
    
    // Attenuation based on distance if from remote player
    let volume = isLocal ? 0.3 : Math.max(0.02, 0.25 * (1 - distance / 50));

    if (characterClass === 'scout') {
      // Rapid, punchy SMG snap
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(480, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.06);

      gain.gain.setValueAtTime(volume * 0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(gain);
      gain.connect(compressor);
      osc.start(t);
      osc.stop(t + 0.06);
    } else if (characterClass === 'sword') {
      // Crisp blade slash swoosh
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);

      gain.gain.setValueAtTime(volume * 0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(compressor);
      osc.start(t);
      osc.stop(t + 0.12);
    } else if (characterClass === 'tank') {
      // Heavy concussive cannon blast
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);

      gain.gain.setValueAtTime(volume * 1.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      osc.connect(gain);
      gain.connect(compressor);
      osc.start(t);
      osc.stop(t + 0.2);
    } else {
      // Default / Blaster: Sci-fi laser burst
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(640, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);

      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(gain);
      gain.connect(compressor);
      osc.start(t);
      osc.stop(t + 0.08);
    }
  } catch {
    // Fail silently
  }
}

/**
 * Aerodynamic jump sound
 */
export function playJumpSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx || !compressor) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.1);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(compressor);
    osc.start(t);
    osc.stop(t + 0.1);
  } catch {}
}

/**
 * Combat dodge roll whoosh
 */
export function playRollSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx || !compressor) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.15);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(compressor);
    osc.start(t);
    osc.stop(t + 0.15);
  } catch {}
}

/**
 * Jetpack ignition and thrust sound
 */
export function playJetpackSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx || !compressor) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.linearRampToValueAtTime(320, t + 0.15);
    osc.frequency.linearRampToValueAtTime(240, t + 0.35);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(compressor);
    osc.start(t);
    osc.stop(t + 0.35);
  } catch {}
}

/**
 * Tactical skill activation sounds (Shield, Mine, Radar, Heal)
 */
export function playAbilitySound(abilityType: string) {
  try {
    const ctx = getAudioContext();
    if (!ctx || !compressor) return;
    const t = ctx.currentTime;

    if (abilityType === 'shield' || abilityType === 'invulnerable') {
      // Forcefield charge hum
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(700, t + 0.25);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(compressor);
      osc.start(t);
      osc.stop(t + 0.28);
    } else if (abilityType === 'heal') {
      // Ascending pleasant healing chime
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.08);

        gain.gain.setValueAtTime(0.18, t + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.18);

        osc.connect(gain);
        gain.connect(compressor);
        osc.start(t + idx * 0.08);
        osc.stop(t + idx * 0.08 + 0.18);
      });
    } else {
      // Tech beep / deployment chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(720, t);
      osc.frequency.setValueAtTime(1080, t + 0.06);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      osc.connect(gain);
      gain.connect(compressor);
      osc.start(t);
      osc.stop(t + 0.16);
    }
  } catch {}
}

/**
 * Enemy elimination sound effect (satisfying kill notification)
 */
export function playEliminationSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx || !compressor) return;
    const t = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, t); // D5
    osc1.frequency.setValueAtTime(880, t + 0.08); // A5

    gain1.gain.setValueAtTime(0.3, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc1.connect(gain1);
    gain1.connect(compressor);
    osc1.start(t);
    osc1.stop(t + 0.22);
  } catch {}
}
