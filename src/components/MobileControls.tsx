import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useGameStore, liveInput } from '../store';
import { Target, PlusCircle, Zap, Wind, ZoomIn, LogOut, X, AlertTriangle, Users } from 'lucide-react';
import { CLASS_ABILITIES, CLASS_ABILITY2, getGroundHeight } from '../types';
import { Minimap } from './Minimap';
import { ReviewModal } from './ReviewModal';
import { playHitSound, playAbilitySound, playJetpackSound } from '../utils/audio';

const EMPTY_ARRAY: any[] = [];

export function MobileControls({ onReturnToLobby }: { onReturnToLobby?: () => void }) {
  const setInput = useGameStore((s) => s.setInput);
  const leaveGame = useGameStore((s) => s.leaveGame);
  const myId = useGameStore((s) => s.myId);
  const gameStatus = useGameStore((s) => s.gameState?.status);
  const myPlayer = useGameStore((s) => (s.myId && s.gameState?.players ? s.gameState.players[s.myId] : null));
  const obstacles = useGameStore((s) => s.gameState?.obstacles);

  const aliveCount = useGameStore((s) => (s.gameState?.players ? Object.values(s.gameState.players).filter((p) => !p.isDead).length : 0));
  const totalOnlineCount = useGameStore((s) => s.gameState?.totalOnlineCount || 1);
  const gameMode = useGameStore((s) => s.gameState?.mode);
  const redAliveCount = useGameStore((s) => (s.gameState?.players ? Object.values(s.gameState.players).filter((p) => !p.isDead && p.team === 'red').length : 0));
  const blueAliveCount = useGameStore((s) => (s.gameState?.players ? Object.values(s.gameState.players).filter((p) => !p.isDead && p.team === 'blue').length : 0));
  const teamScores = useGameStore((s) => s.gameState?.teamScores);
  const humanCountInRoom = useGameStore((s) => (s.gameState?.players ? Object.values(s.gameState.players).filter((p) => !p.isBot).length : 1));
  const busTimeLeft = useGameStore((s) => s.gameState?.battleBus?.timeLeft);

  const showHitMarker = useGameStore((s) => s.showHitMarker);
  const showDamageFlash = useGameStore((s) => s.showDamageFlash);
  const damageIndicators = useGameStore((s) => s.damageIndicators || EMPTY_ARRAY);
  const localLastRollTime = useGameStore((s) => s.localLastRollTime);
  const localLastAbilityTime = useGameStore((s) => s.localLastAbilityTime);
  const localLastHealTime = useGameStore((s) => s.localLastHealTime);
  const isFirstPerson = useGameStore((s) => s.isFirstPerson);
  const toggleFirstPerson = useGameStore((s) => s.toggleFirstPerson);

  // Play audio chime when a hit lands
  useEffect(() => {
    if (showHitMarker) {
      playHitSound();
    }
  }, [showHitMarker]);

  // Floating joystick state
  const leftZoneRef = useRef<HTMLDivElement>(null);
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const restingBaseRef = useRef<HTMLDivElement>(null);
  const joystickPointerId = useRef<number | null>(null);
  const joystickOrigin = useRef<{ x: number; y: number } | null>(null);

  // Look state
  const rightZoneRef = useRef<HTMLDivElement>(null);
  const lookPointerId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Button active visual states
  const [isShootingActive, setIsShootingActive] = useState(false);
  const [isHealingActive, setIsHealingActive] = useState(false);
  const [isAbilityActive, setIsAbilityActive] = useState(false);
  const [isRollingActive, setIsRollingActive] = useState(false);
  const [isZoomedLocal, setIsZoomedLocal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [mouseSensitivity, setMouseSensitivity] = useState(() => {
    const saved = localStorage.getItem('poly_mouse_sens');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [touchSensitivity, setTouchSensitivity] = useState(() => {
    const saved = localStorage.getItem('poly_touch_sens');
    return saved ? parseFloat(saved) : 1.2;
  });
  const [isTouchDevice, setIsTouchDevice] = useState(() => {
    if (typeof window === 'undefined') return false;
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;
  });
  const pressedKeysRef = useRef(new Set<string>());

  // Dedicated touch IDs for multi-touch tracking on iPad / mobile
  const joystickTouchId = useRef<number | null>(null);
  const lookTouchId = useRef<number | null>(null);
  const prevMousePos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseSensitivityChange = (newSens: number) => {
    setMouseSensitivity(newSens);
    localStorage.setItem('poly_mouse_sens', newSens.toString());
  };

  const handleTouchSensitivityChange = (newSens: number) => {
    setTouchSensitivity(newSens);
    localStorage.setItem('poly_touch_sens', newSens.toString());
  };

  // Sync zoom state
  const toggleZoom = useCallback(() => {
    setIsZoomedLocal(prev => {
      const next = !prev;
      liveInput.isZoomed = next;
      setInput({ isZoomed: next });
      return next;
    });
  }, [setInput]);

  // Guaranteed single-trigger for touch and click (prevents dual firing from touchstart/touchend + click)
  const lastViewToggleTime = useRef(0);
  const handleToggleViewMode = useCallback((e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    }
    const now = Date.now();
    if (now - lastViewToggleTime.current < 250) return;
    lastViewToggleTime.current = now;
    toggleFirstPerson();
  }, [toggleFirstPerson]);

  const lastZoomToggleTime = useRef(0);
  const handleToggleZoomAction = useCallback((e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    }
    const now = Date.now();
    if (now - lastZoomToggleTime.current < 250) return;
    lastZoomToggleTime.current = now;
    toggleZoom();
  }, [toggleZoom]);

  // Request Pointer Lock with full Safari/iPadOS WebKit compatibility
  const requestPointerLock = useCallback(() => {
    try {
      const canvas = document.querySelector('canvas') || document.getElementById('root') || document.body;
      const req = canvas?.requestPointerLock || (canvas as any)?.webkitRequestPointerLock || (canvas as any)?.mozRequestPointerLock || document.body.requestPointerLock;
      if (req && canvas) {
        const promise = req.call(canvas);
        if (promise && typeof promise.catch === 'function') {
          promise.catch((err: any) => console.warn('Pointer lock error:', err));
        }
      }
    } catch (err) {
      console.warn('Pointer lock request error:', err);
    }
  }, []);

  const exitPointerLock = useCallback(() => {
    try {
      const exitReq = document.exitPointerLock || (document as any).webkitExitPointerLock || (document as any).mozExitPointerLock;
      if (exitReq) {
        exitReq.call(document);
      }
    } catch (err) {
      console.warn('Pointer lock exit error:', err);
    }
  }, []);

  // Real-time clock for smooth ability cooldown / duration meters
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Ability state calculations
  const charClass = myPlayer?.characterClass || 'melee';
  const abilityInfo = CLASS_ABILITIES[charClass] || CLASS_ABILITIES.melee;
  const ability2Info = charClass === 'scout' ? CLASS_ABILITY2.scout : null;

  const elapsedSinceAbility = currentTime - localLastAbilityTime;
  const elapsedSinceAbility2 = currentTime - (myPlayer?.lastAbility2Time || 0);
  const cooldownMs = abilityInfo.cooldownMs;
  const durationMs = abilityInfo.durationMs;

  const cooldown2Ms = ability2Info ? ability2Info.cooldownMs : 0;
  const duration2Ms = ability2Info ? ability2Info.durationMs : 0;

  const isBuffActive = durationMs > 0 && elapsedSinceAbility < durationMs && !myPlayer?.isDead;
  const remainingBuffSec = durationMs > 0 ? Math.max(0, (durationMs - elapsedSinceAbility) / 1000) : 0;
  const buffRatio = durationMs > 0 ? Math.max(0, 1 - (elapsedSinceAbility / durationMs)) : 0;

  // Ability 2 calculations
  const isBuff2Active = duration2Ms > 0 && elapsedSinceAbility2 < duration2Ms && !myPlayer?.isDead;
  const remainingBuff2Sec = duration2Ms > 0 ? Math.max(0, (duration2Ms - elapsedSinceAbility2) / 1000) : 0;
  
  let chargeRatio = 0;
  let remainingCdSec = 0;
  
  if (isBuffActive) {
    chargeRatio = 0;
    remainingCdSec = cooldownMs / 1000;
  } else {
    const elapsedSinceFinish = Math.max(0, elapsedSinceAbility - durationMs);
    chargeRatio = Math.min(1, Math.max(0, elapsedSinceFinish / cooldownMs));
    remainingCdSec = Math.max(0, (cooldownMs - elapsedSinceFinish) / 1000);
  }

  const isAbilityReady = chargeRatio >= 1;
  const chargePercent = Math.floor(chargeRatio * 100);

  let charge2Ratio = 0;
  let remainingCd2Sec = 0;
  if (ability2Info) {
    if (isBuff2Active) {
      charge2Ratio = 0;
      remainingCd2Sec = cooldown2Ms / 1000;
    } else {
      const elapsedSinceFinish = Math.max(0, elapsedSinceAbility2 - duration2Ms);
      charge2Ratio = Math.min(1, Math.max(0, elapsedSinceFinish / cooldown2Ms));
      remainingCd2Sec = Math.max(0, (cooldown2Ms - elapsedSinceFinish) / 1000);
    }
  }
  const isAbility2Ready = charge2Ratio >= 1;
  const charge2Percent = Math.floor(charge2Ratio * 100);

  // Dodge Roll state calculations (1.8s cooldown)
  const rollCooldownMs = 1800;
  const elapsedSinceRoll = currentTime - localLastRollTime;
  const isRollReady = elapsedSinceRoll >= rollCooldownMs;
  const remainingRollCdSec = Math.max(0, (rollCooldownMs - elapsedSinceRoll) / 1000);
  const rollChargeRatio = Math.min(1, Math.max(0, elapsedSinceRoll / rollCooldownMs));

  // Unified Joystick Reset Function
  const resetJoystick = useCallback(() => {
    joystickTouchId.current = null;
    joystickPointerId.current = null;
    joystickOrigin.current = null;

    // Recalculate movement from pressed keyboard keys
    let x = 0;
    let y = 0;
    const keys = pressedKeysRef.current;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;

    liveInput.moveX = x;
    liveInput.moveY = y;

    if (joyBaseRef.current) {
      joyBaseRef.current.style.display = 'none';
    }
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
    }
    if (restingBaseRef.current) {
      restingBaseRef.current.style.opacity = '1';
    }
  }, []);

  // Reset look pointer
  const resetLook = useCallback(() => {
    lookTouchId.current = null;
    lookPointerId.current = null;
  }, []);

  // Mobile Jump / Drop / Roll Handler
  const handleMobileJumpAction = useCallback(() => {
    const { myId: curId, gameState: curState } = useGameStore.getState();
    const p = curId && curState ? curState.players[curId] : null;
    const groundH = p && curState?.obstacles ? getGroundHeight(p.x, p.z, curState.obstacles) : 0;
    const isAirborne = p ? (!p.inBus && (p.isSkydiving || p.isGliding || p.y > groundH + 1.2)) : false;

    if (p?.inBus) {
      liveInput.jumpFromBus = true;
      setInput({ jumpFromBus: true });
    } else if (isAirborne) {
      liveInput.toggleGlider = true;
      setInput({ toggleGlider: true });
    } else {
      liveInput.isRolling = true;
      setInput({ isRolling: true });
      setIsRollingActive(true);
      setTimeout(() => {
        liveInput.isRolling = false;
        setInput({ isRolling: false });
        setIsRollingActive(false);
      }, 250);
    }
  }, [setInput]);

  // Global window listeners & Pointer Lock tracking
  useEffect(() => {
    const handlePointerLockChange = () => {
      const isLocked = !!(
        document.pointerLockElement ||
        (document as any).webkitPointerLockElement ||
        (document as any).mozPointerLockElement
      );
      setIsPointerLocked(isLocked);
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Ignore if cursor is interacting with menu or dialog elements
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[role="dialog"], #settings-modal, #minimap, select, input, textarea')) {
        prevMousePos.current = { x: e.clientX, y: e.clientY };
        return;
      }

      const isLocked = !!(
        document.pointerLockElement ||
        (document as any).webkitPointerLockElement ||
        (document as any).mozPointerLockElement
      );

      let dx = 0;
      let dy = 0;

      if (isLocked) {
        dx = e.movementX ?? (e as any).webkitMovementX ?? (e as any).mozMovementX ?? 0;
        dy = e.movementY ?? (e as any).webkitMovementY ?? (e as any).mozMovementY ?? 0;
      } else {
        // Unlocked mode (iPad trackpad/mouse or desktop cursor before pointer lock)
        if (prevMousePos.current) {
          const rawDx = e.clientX - prevMousePos.current.x;
          const rawDy = e.clientY - prevMousePos.current.y;
          if (Math.abs(rawDx) < 250 && Math.abs(rawDy) < 250) {
            dx = rawDx;
            dy = rawDy;
          }
        }
      }
      prevMousePos.current = { x: e.clientX, y: e.clientY };

      if (dx !== 0 || dy !== 0) {
        const sensX = 0.0032 * mouseSensitivity;
        const sensY = 0.0028 * mouseSensitivity;

        liveInput.ry -= dx * sensX;
        const currentPitch = liveInput.pitch ?? 0.0;
        liveInput.pitch = Math.max(-1.28, Math.min(1.15, currentPitch + dy * sensY));
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      handleMouseMove(e as unknown as MouseEvent);
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Ignore clicks on actual interactive UI elements (buttons, inputs, modal dialogs, minimap)
      const target = e.target as HTMLElement;
      if (target && target.closest('button, input, textarea, select, [role="dialog"], #settings-modal, #minimap')) {
        return;
      }

      // If clicked with mouse and not in pointer lock, request pointer lock
      const isLocked = !!(
        document.pointerLockElement ||
        (document as any).webkitPointerLockElement ||
        (document as any).mozPointerLockElement
      );
      if (!isLocked && e.button === 0) {
        requestPointerLock();
      }

      if (e.button === 0) {
        // Left Click = Shoot
        liveInput.isShooting = true;
        setInput({ isShooting: true });
        setIsShootingActive(true);
      } else if (e.button === 2) {
        // Right Click = ADS Zoom
        e.preventDefault();
        liveInput.isZoomed = true;
        setInput({ isZoomed: true });
        setIsZoomedLocal(true);
      } else if (e.button === 1) {
        // Middle Click = Jump / Roll / Drop
        e.preventDefault();
        handleMobileJumpAction();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        liveInput.isShooting = false;
        setInput({ isShooting: false });
        setIsShootingActive(false);
      } else if (e.button === 2) {
        liveInput.isZoomed = false;
        setInput({ isZoomed: false });
        setIsZoomedLocal(false);
      } else if (e.button === 1) {
        liveInput.isRolling = false;
        setInput({ isRolling: false });
        setIsRollingActive(false);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const isLocked = !!(
        document.pointerLockElement ||
        (document as any).webkitPointerLockElement ||
        (document as any).mozPointerLockElement
      );
      if (isLocked) {
        e.preventDefault();
        if (e.deltaY < 0) {
          // Wheel Up = Zoom In
          liveInput.isZoomed = true;
          setInput({ isZoomed: true });
          setIsZoomedLocal(true);
        } else if (e.deltaY > 0) {
          // Wheel Down = Zoom Out
          liveInput.isZoomed = false;
          setInput({ isZoomed: false });
          setIsZoomedLocal(false);
        }
      }
    };

    const handleGlobalBlur = () => {
      pressedKeysRef.current.clear();
      resetJoystick();
      resetLook();
      liveInput.isShooting = false;
      liveInput.isHealing = false;
      liveInput.useAbility = false;
      liveInput.isRolling = false;
      setIsShootingActive(false);
      setIsHealingActive(false);
      setIsAbilityActive(false);
      setIsRollingActive(false);
      setInput({ isShooting: false, isHealing: false, useAbility: false, isRolling: false });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleGlobalBlur();
      }
    };

    // iOS Gesture prevention (prevent Safari pinch-to-zoom and gesture cancellation)
    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    document.addEventListener('gestureend', preventGesture, { passive: false });
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('webkitpointerlockchange', handlePointerLockChange);
    document.addEventListener('mozpointerlockchange', handlePointerLockChange);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('blur', handleGlobalBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('webkitpointerlockchange', handlePointerLockChange);
      document.removeEventListener('mozpointerlockchange', handlePointerLockChange);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('blur', handleGlobalBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [resetJoystick, resetLook, setInput, mouseSensitivity, requestPointerLock, handleMobileJumpAction]);

  // Reset controls when dead or game not active
  useEffect(() => {
    if (!myPlayer || myPlayer.isDead || gameStatus !== 'playing') {
      pressedKeysRef.current.clear();
      resetJoystick();
      resetLook();
      setIsZoomedLocal(false);
      liveInput.isZoomed = false;
      setInput({ isZoomed: false });
      if (document.pointerLockElement) {
        exitPointerLock();
      }
    }
  }, [myPlayer?.isDead, gameStatus, resetJoystick, resetLook, setInput, exitPointerLock]);

  // Keyboard controls support (Smooth continuous key state without watchdog reset)
  useEffect(() => {
    const updateMovementFromKeys = () => {
      if (joystickPointerId.current !== null) return;
      let x = 0;
      let y = 0;
      const keys = pressedKeysRef.current;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;

      liveInput.moveX = x;
      liveInput.moveY = y;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape') {
        if (document.pointerLockElement) {
          exitPointerLock();
        } else {
          setShowLeaveModal(prev => !prev);
        }
        return;
      }

      pressedKeysRef.current.add(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        updateMovementFromKeys();
      }
      if (e.code === 'Space' || e.code === 'KeyQ' || e.code === 'KeyC') {
        const { myId: currentMyId, gameState: currentGameState } = useGameStore.getState();
        const curPlayer = currentMyId && currentGameState ? currentGameState.players[currentMyId] : null;
        const groundH = curPlayer && currentGameState?.obstacles ? getGroundHeight(curPlayer.x, curPlayer.z, currentGameState.obstacles) : 0;
        const isAirborne = curPlayer ? (curPlayer.y > groundH + 1.2) : false;

        if (curPlayer?.inBus) {
          liveInput.jumpFromBus = true;
          setInput({ jumpFromBus: true });
        } else if (curPlayer?.isSkydiving || curPlayer?.isGliding || isAirborne) {
          liveInput.toggleGlider = true;
          setInput({ toggleGlider: true });
        } else {
          liveInput.isRolling = true;
          setInput({ isRolling: true });
          setIsRollingActive(true);
        }
      }
      if (e.code === 'KeyZ') {
        toggleZoom();
      }
      if (e.code === 'KeyV') {
        toggleFirstPerson();
      }
      if (e.code === 'KeyJ' || e.code === 'KeyX' || e.code === 'Enter') {
        liveInput.isShooting = true;
        setInput({ isShooting: true });
        setIsShootingActive(true);
      }
      if (e.code === 'KeyE' || e.code === 'KeyF') {
        liveInput.isHealing = true;
        setInput({ isHealing: true });
        setIsHealingActive(true);
      }
      if (e.code === 'KeyG' || e.code === 'KeyT') {
        liveInput.useAbility2 = true;
        setInput({ useAbility2: true });
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyR') {
        liveInput.useAbility = true;
        setInput({ useAbility: true });
        setIsAbilityActive(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeysRef.current.delete(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        updateMovementFromKeys();
      }
      if (e.code === 'Space' || e.code === 'KeyQ' || e.code === 'KeyC') {
        liveInput.isRolling = false;
        setInput({ isRolling: false });
        setIsRollingActive(false);
      }
      if (e.code === 'KeyJ' || e.code === 'KeyX' || e.code === 'Enter') {
        liveInput.isShooting = false;
        setInput({ isShooting: false });
        setIsShootingActive(false);
      }
      if (e.code === 'KeyE' || e.code === 'KeyF') {
        liveInput.isHealing = false;
        setInput({ isHealing: false });
        setIsHealingActive(false);
      }
      if (e.code === 'KeyG' || e.code === 'KeyT') {
        liveInput.useAbility2 = false;
        setInput({ useAbility2: false });
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyR') {
        liveInput.useAbility = false;
        setInput({ useAbility: false });
        setIsAbilityActive(false);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [setInput, toggleZoom, exitPointerLock]);

  // Native Multi-Touch Handlers for iPad and Mobile (Zero-lag, 1v1.lol responsive)
  const handleJoyTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (joystickTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;

    joystickTouchId.current = touch.identifier;
    const rect = e.currentTarget.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    joystickOrigin.current = { x: touchX, y: touchY };
    liveInput.moveX = 0;
    liveInput.moveY = 0;

    if (joyBaseRef.current) {
      joyBaseRef.current.style.display = 'block';
      joyBaseRef.current.style.left = `${touchX}px`;
      joyBaseRef.current.style.top = `${touchY}px`;
    }
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
    }
    if (restingBaseRef.current) {
      restingBaseRef.current.style.opacity = '0.2';
    }
  }, []);

  const handleJoyTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (joystickTouchId.current === null || !joystickOrigin.current) return;

    let targetTouch: React.Touch | null = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId.current) {
        targetTouch = e.changedTouches[i];
        break;
      }
    }
    if (!targetTouch) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = targetTouch.clientX - rect.left;
    const currentY = targetTouch.clientY - rect.top;

    const dx = currentX - joystickOrigin.current.x;
    const dy = currentY - joystickOrigin.current.y;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 55;

    let clampedX = dx;
    let clampedY = dy;
    if (dist > maxRadius) {
      clampedX = (dx / dist) * maxRadius;
      clampedY = (dy / dist) * maxRadius;
    }

    if (knobRef.current) {
      knobRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0px)`;
    }

    const deadzone = 4;
    if (dist < deadzone) {
      liveInput.moveX = 0;
      liveInput.moveY = 0;
    } else {
      const normalizedDist = Math.min(1, (dist - deadzone) / (maxRadius - deadzone));
      const angle = Math.atan2(dy, dx);
      liveInput.moveX = Math.cos(angle) * normalizedDist;
      liveInput.moveY = Math.sin(angle) * normalizedDist;
    }
  }, []);

  const handleJoyTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId.current) {
        resetJoystick();
        break;
      }
    }
  }, [resetJoystick]);

  // Native Multi-Touch Aim & Camera Look Handlers (Zero-lag, iPad compatible)
  const handleLookTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (lookTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    lookTouchId.current = touch.identifier;
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleLookTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (lookTouchId.current === null) return;

    let targetTouch: React.Touch | null = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        targetTouch = e.changedTouches[i];
        break;
      }
    }
    if (!targetTouch) return;

    const dx = targetTouch.clientX - lastLookPos.current.x;
    const dy = targetTouch.clientY - lastLookPos.current.y;

    const SENS_X = 0.0055 * touchSensitivity;
    const SENS_Y = 0.0045 * touchSensitivity;

    liveInput.ry -= dx * SENS_X;
    const currentPitch = liveInput.pitch ?? 0.0;
    liveInput.pitch = Math.max(-1.28, Math.min(1.15, currentPitch + dy * SENS_Y));

    lastLookPos.current = { x: targetTouch.clientX, y: targetTouch.clientY };
  }, [touchSensitivity]);

  const handleLookTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        resetLook();
        break;
      }
    }
  }, [resetLook]);

  if (!myPlayer || myPlayer.isDead || gameStatus !== 'playing') return null;

  return (
    <div className="absolute inset-0 z-10 touch-none select-none pointer-events-none overflow-hidden font-sans">
      
      {/* Damage Flash Overlay */}
      {showDamageFlash && (
        <div className="absolute inset-0 bg-red-600/35 pointer-events-none transition-opacity duration-100 z-50 mix-blend-multiply" />
      )}

      {/* Directional Damage Indicators */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 overflow-hidden">
        {damageIndicators.filter(d => Date.now() - d.timestamp < 2000).map(d => {
          const relAngle = d.angle + (liveInput.ry || myPlayer.ry);
          return (
            <div key={d.id} className="absolute w-[280px] h-[280px] pointer-events-none" style={{ transform: `rotate(${relAngle}rad)` }}>
               <div className="absolute top-0 left-1/2 w-32 h-6 -ml-16 bg-gradient-to-b from-red-500 to-transparent rounded-full opacity-90 shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
            </div>
          );
        })}
      </div>

      {/* ADS Zoom Sniper Overlay (Tactical Scope & Distance Reticles) */}
      {isZoomedLocal && (
        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
          {/* Peripheral Scope Vignette */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at center, transparent 35%, rgba(10, 15, 30, 0.45) 75%, rgba(5, 8, 18, 0.85) 100%)'
            }}
          />
          
          {/* Precision Scope Reticle Crosshairs */}
          <div className="relative w-[340px] h-[340px] rounded-full border border-cyan-400/40 flex items-center justify-center">
            {/* Compass / Range Ticks */}
            <div className="absolute inset-0 rounded-full border border-cyan-400/20 scale-90" />
            <div className="absolute top-4 text-[9px] font-mono font-bold text-cyan-300 tracking-widest bg-slate-950/60 px-1.5 py-0.5 rounded">
              ADS ZOOM 2.5X
            </div>
            
            {/* Horizontal Subdivisions */}
            <div className="absolute w-full h-[1px] bg-cyan-400/30">
              <div className="absolute left-12 top-[-3px] h-2 w-[1px] bg-cyan-300/60" />
              <div className="absolute left-24 top-[-2px] h-1.5 w-[1px] bg-cyan-300/60" />
              <div className="absolute right-24 top-[-2px] h-1.5 w-[1px] bg-cyan-300/60" />
              <div className="absolute right-12 top-[-3px] h-2 w-[1px] bg-cyan-300/60" />
            </div>

            {/* Vertical Elevation Ticks */}
            <div className="absolute h-full w-[1px] bg-cyan-400/30">
              <div className="absolute top-14 left-[-4px] w-2.5 h-[1px] bg-cyan-300/60" />
              <div className="absolute top-24 left-[-3px] w-2 h-[1px] bg-cyan-300/60" />
              <div className="absolute bottom-24 left-[-3px] w-2 h-[1px] bg-cyan-300/60" />
              <div className="absolute bottom-14 left-[-4px] w-2.5 h-[1px] bg-cyan-300/60" />
            </div>

            {/* Tactical Corner Brackets */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-cyan-400" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-cyan-400" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-cyan-400" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-cyan-400" />
          </div>
        </div>
      )}

      {/* Precision Crosshair & Hit Marker */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
        <div className="relative flex items-center justify-center">
          {/* Precise Center Dot */}
          <div className={`w-2 h-2 rounded-full transition-all duration-75 shadow-[0_0_6px_rgba(0,0,0,0.9)] border ${
            liveInput.isTargetLocked 
              ? 'bg-red-500 ring-4 ring-red-500/50 scale-125 border-red-200 shadow-[0_0_10px_rgba(239,68,68,0.9)]'
              : isZoomedLocal 
                ? 'bg-cyan-300 ring-2 ring-cyan-400/60 border-cyan-100' 
                : 'bg-white border-slate-900/60'
          }`} />

          {/* Tactical Crosshair Cross-hairs (4 Cardinal Ticks with Center Gap) */}
          <div className={`absolute w-8 h-8 pointer-events-none flex items-center justify-center transition-transform duration-75 ${
            liveInput.isTargetLocked ? 'scale-110' : ''
          }`}>
            {/* Top */}
            <div className={`absolute -top-3 w-0.5 h-2.5 shadow-[0_0_3px_rgba(0,0,0,0.8)] rounded-full transition-colors duration-75 ${
              liveInput.isTargetLocked ? 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]' : isZoomedLocal ? 'bg-cyan-300' : 'bg-white/90'
            }`} />
            {/* Bottom */}
            <div className={`absolute -bottom-3 w-0.5 h-2.5 shadow-[0_0_3px_rgba(0,0,0,0.8)] rounded-full transition-colors duration-75 ${
              liveInput.isTargetLocked ? 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]' : isZoomedLocal ? 'bg-cyan-300' : 'bg-white/90'
            }`} />
            {/* Left */}
            <div className={`absolute -left-3 h-0.5 w-2.5 shadow-[0_0_3px_rgba(0,0,0,0.8)] rounded-full transition-colors duration-75 ${
              liveInput.isTargetLocked ? 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]' : isZoomedLocal ? 'bg-cyan-300' : 'bg-white/90'
            }`} />
            {/* Right */}
            <div className={`absolute -right-3 h-0.5 w-2.5 shadow-[0_0_3px_rgba(0,0,0,0.8)] rounded-full transition-colors duration-75 ${
              liveInput.isTargetLocked ? 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]' : isZoomedLocal ? 'bg-cyan-300' : 'bg-white/90'
            }`} />
            {/* Outer Subtle Ring */}
            <div className={`w-6 h-6 rounded-full border transition-all duration-75 ${
              liveInput.isTargetLocked 
                ? 'border-red-500/80 scale-125 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                : isZoomedLocal 
                  ? 'border-cyan-400/50' 
                  : 'border-white/20'
            }`} />
          </div>

          {/* High-Impact Hit Marker (X shape + burst ring) */}
          {showHitMarker && (
            <div className="absolute inset-0 flex items-center justify-center animate-in zoom-in-75 duration-75">
              <div className="absolute w-8 h-1 bg-red-500 -rotate-45 shadow-[0_0_10px_rgba(239,68,68,1)] rounded-full border border-white" />
              <div className="absolute w-8 h-1 bg-red-500 rotate-45 shadow-[0_0_10px_rgba(239,68,68,1)] rounded-full border border-white" />
              <div className="absolute w-12 h-12 rounded-full border-2 border-red-400 animate-ping" />
            </div>
          )}
        </div>
      </div>

      {/* Top HUD - Optimized for mobile & notch displays */}
      <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 flex justify-between items-start text-white pointer-events-auto z-40">
        
        {/* Left Side: HP + Leave Match Button */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="bg-slate-900/85 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400">HP</span>
              <span className="text-sm sm:text-xl font-black">{Math.ceil(myPlayer.health)} / {myPlayer.maxHealth || 100}</span>
            </div>
            <div className="w-24 sm:w-36 h-2 sm:h-2.5 bg-slate-800 rounded-full mt-1 overflow-hidden border border-white/10">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-150" 
                style={{ width: `${Math.max(0, Math.min(100, (myPlayer.health / (myPlayer.maxHealth || 100)) * 100))}%` }} 
              />
            </div>
          </div>

          {/* Leave Match Mid-Game Button (途中でマッチを抜ける) */}
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="bg-slate-900/85 hover:bg-red-950/80 active:scale-95 text-slate-300 hover:text-red-300 px-2.5 sm:px-3 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl backdrop-blur-md border border-white/10 hover:border-red-500/40 shadow-lg transition-all flex items-center gap-1 cursor-pointer"
            title="マッチから退出 (Leave Match)"
          >
            <LogOut size={14} className="text-red-400 sm:w-4 sm:h-4" />
            <span className="text-[10px] sm:text-xs font-bold tracking-tight">退出</span>
          </button>
        </div>

        {/* Center: Team Battle Scoreboard */}
        {gameMode === 'team' && (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/90 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl backdrop-blur-md border border-white/10 shadow-xl">
            <div className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg font-black text-[11px] sm:text-xs ${myPlayer?.team === 'red' ? 'bg-red-500/30 text-red-300 ring-1 ring-red-400' : 'bg-red-950/40 text-red-400'}`}>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>RED: {teamScores ? teamScores.red : redAliveCount}</span>
            </div>
            <span className="text-slate-500 font-black text-[10px] sm:text-xs">VS</span>
            <div className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg font-black text-[11px] sm:text-xs ${myPlayer?.team === 'blue' ? 'bg-blue-500/30 text-blue-300 ring-1 ring-blue-400' : 'bg-blue-950/40 text-blue-400'}`}>
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>BLUE: {teamScores ? teamScores.blue : blueAliveCount}</span>
            </div>
            {myPlayer?.team && (
              <span className={`text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded ${myPlayer.team === 'red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                {myPlayer.team === 'red' ? '赤軍' : '青軍'}
              </span>
            )}
            {humanCountInRoom > 1 ? (
              <span className="text-[9px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30 hidden sm:inline">
                PvP対人 ({humanCountInRoom}人)
              </span>
            ) : (
              <span className="text-[9px] font-bold text-slate-400 bg-white/5 px-1.5 py-0.5 rounded hidden sm:inline">
                Bot共闘
              </span>
            )}
          </div>
        )}

        {/* Right Side: Weapon Lv, Online Players & Score */}
        <div className="bg-slate-900/85 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl backdrop-blur-md border border-white/10 shadow-lg flex gap-2.5 sm:gap-4 items-center">
          <div className="flex items-center gap-1 text-emerald-400 border-r border-white/15 pr-2 sm:pr-3.5" title="現在のサーバー内オンライン人数">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <Users size={13} className="sm:w-3.5 sm:h-3.5" />
            <span className="font-black text-xs sm:text-sm text-white">{totalOnlineCount}</span>
          </div>
          <div className="text-center border-r border-white/15 pr-2.5 sm:pr-4">
            <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Weapon</div>
            <div className="font-black text-sm sm:text-lg text-amber-400">Lv {myPlayer.weaponLevel}</div>
          </div>
          <div className="text-right">
            <div className="font-black text-amber-300 text-xs sm:text-base">Score: {myPlayer.score}</div>
            <div className="text-[10px] sm:text-xs text-slate-300 font-semibold">
              Alive: {aliveCount}
            </div>
          </div>
        </div>
      </div>

      {/* Leave Match Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 pointer-events-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-400 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} className="text-amber-400" />
              </div>
              <h3 className="text-lg font-black text-white">マッチから退出しますか？</h3>
            </div>
            
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              途中で退出するとロビーに戻ります。現在の試合スコアと生存状態はリセットされます。
            </p>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold transition-all active:scale-95 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLeaveModal(false);
                  leaveGame();
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-black transition-all active:scale-95 shadow-lg shadow-red-600/30 flex items-center gap-2 cursor-pointer"
              >
                <LogOut size={16} />
                退出してロビーに戻る
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimap */}
      <div className="absolute top-24 right-4 z-20 pointer-events-auto shadow-2xl">
        <Minimap />
      </div>

      {/* Sensitivity & Mouse Lock Selector (Responsive on PC, iPad, and Touch Devices) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-2 flex-wrap justify-center">
        {/* Camera View Mode Toggle (1人称/3人称) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFirstPerson();
          }}
          className={`px-3.5 py-2 rounded-full backdrop-blur-md shadow-xl border flex items-center gap-2 text-xs font-black cursor-pointer transition-all active:scale-90 ${
            isFirstPerson
              ? 'bg-purple-900/90 border-purple-400 text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.5)]'
              : 'bg-slate-900/90 border-slate-600 text-slate-200 hover:text-white'
          }`}
          title="1人称/3人称 視点切り替え (Vキー)"
        >
          <span className="text-base">{isFirstPerson ? '👁️' : '👤'}</span>
          <span>{isFirstPerson ? '視点: 1人称 (FPS)' : '視点: 3人称 (TPS)'}</span>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded border border-white/30 font-bold">
            Vキー
          </span>
        </button>

        {/* Review & Feedback Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowReviewModal(true);
          }}
          className="bg-amber-500/20 hover:bg-amber-500/30 text-yellow-300 border border-amber-400/40 px-3 py-2 rounded-full shadow-lg flex items-center gap-1.5 text-xs font-bold cursor-pointer active:scale-95 transition-all"
          title="評価・レビュー・ご意見"
        >
          <span className="text-sm">⭐</span>
          <span>レビュー</span>
        </button>

        {isPointerLocked ? (
          <div className="bg-slate-950/85 backdrop-blur-md border border-emerald-400/40 px-3.5 py-1.5 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-3 text-xs text-slate-200">
            <span className="flex items-center gap-1.5 font-bold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              マウス操作中 (ESC: 解除)
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400 font-medium">感度:</span>
            <div className="flex items-center gap-1">
              {[0.75, 1.0, 1.5, 2.0].map((sens) => (
                <button
                  key={sens}
                  type="button"
                  onClick={() => handleMouseSensitivityChange(sens)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    mouseSensitivity === sens
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'bg-white/10 hover:bg-white/20 text-slate-300'
                  }`}
                >
                  {sens}x
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              type="button"
              onClick={requestPointerLock}
              className="bg-slate-950/90 hover:bg-slate-900 border border-cyan-400/50 px-3.5 py-1.5 rounded-full shadow-[0_0_18px_rgba(6,182,212,0.35)] flex items-center gap-2 text-xs text-cyan-200 cursor-pointer hover:scale-105 active:scale-95 transition-all"
            >
              <span className="text-sm">🖱️</span>
              <span className="font-bold">マウス/トラックパッド操作を有効化</span>
              <span className="text-[10px] text-cyan-400/80 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/30">
                ポインターロック
              </span>
            </button>

            {isTouchDevice && (
              <div className="bg-slate-950/85 backdrop-blur-md border border-cyan-400/30 px-2.5 py-1 rounded-full shadow-md flex items-center gap-1.5 text-xs text-slate-300">
                <span className="font-bold text-cyan-400 text-[10px]">
                  📱 タッチ感度:
                </span>
                <div className="flex items-center gap-0.5">
                  {[0.8, 1.0, 1.3, 1.7].map((sens) => (
                    <button
                      key={sens}
                      type="button"
                      onClick={() => handleTouchSensitivityChange(sens)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
                        touchSensitivity === sens
                          ? 'bg-cyan-500 text-slate-950 shadow-sm'
                          : 'bg-white/10 hover:bg-white/20 text-slate-300'
                      }`}
                    >
                      {sens}x
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LEFT HALF SCREEN: Dynamic Floating Movement Joystick */}
      <div 
        ref={leftZoneRef}
        className="absolute top-0 left-0 bottom-0 w-1/2 pointer-events-auto touch-none select-none"
        style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
        onTouchStart={handleJoyTouchStart}
        onTouchMove={handleJoyTouchMove}
        onTouchEnd={handleJoyTouchEnd}
        onTouchCancel={handleJoyTouchEnd}
      >
        {/* Floating Active Joystick (positioned and transformed via refs) */}
        <div 
          ref={joyBaseRef}
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none will-change-transform z-30"
          style={{ display: 'none' }}
        >
          {/* Base Ring */}
          <div className="w-32 h-32 rounded-full bg-slate-900/40 border-2 border-white/50 backdrop-blur-sm flex items-center justify-center shadow-2xl">
            {/* Inner Active Knob */}
            <div 
              ref={knobRef}
              className="w-14 h-14 rounded-full bg-white/90 border-2 border-white shadow-[0_0_20px_rgba(255,255,255,0.8)] will-change-transform"
            />
          </div>
        </div>

        {/* Subtle resting guide base at bottom-left */}
        <div 
          ref={restingBaseRef} 
          className="absolute bottom-10 left-10 pointer-events-none transition-opacity duration-150"
        >
          <div className="w-28 h-28 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
            <div className="w-10 h-10 rounded-full bg-white/30 border border-white/40" />
          </div>
          <div className="text-[11px] text-white/50 text-center mt-1 font-bold tracking-wider">TOUCH TO MOVE</div>
        </div>
      </div>

      {/* RIGHT HALF SCREEN: Smooth Camera Drag & Aiming */}
      <div 
        ref={rightZoneRef}
        className="absolute top-0 right-0 bottom-0 w-1/2 pointer-events-auto touch-none select-none"
        style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
        onTouchStart={handleLookTouchStart}
        onTouchMove={handleLookTouchMove}
        onTouchEnd={handleLookTouchEnd}
        onTouchCancel={handleLookTouchEnd}
      />

      {/* ACTION BUTTONS (Bottom Right) */}
      <div className="absolute bottom-4 sm:bottom-8 right-3 sm:right-8 flex flex-col items-end gap-2 sm:gap-3 pointer-events-auto z-30">
        
        {/* Battle Bus Jump Overlay */}
        {myPlayer?.inBus && (
          <div className="flex flex-col items-center gap-2 mb-2 pointer-events-auto">
            <div className="bg-sky-950/90 border border-sky-400/50 backdrop-blur-md px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(56,189,248,0.5)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              <span className="text-xs font-black text-sky-200 tracking-wider">BATTLE BUS IN FLIGHT</span>
              {busTimeLeft !== undefined && (
                <span className="text-xs font-mono text-amber-300 font-bold">
                  {busTimeLeft.toFixed(1)}s
                </span>
              )}
            </div>
            <button
              type="button"
              className="bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 text-slate-950 font-black text-sm sm:text-base px-6 py-2.5 rounded-2xl shadow-[0_0_25px_rgba(250,204,21,0.8)] border-2 border-white/60 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2 animate-bounce"
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                liveInput.jumpFromBus = true;
                setInput({ jumpFromBus: true });
              }}
              onClick={(e) => {
                e.stopPropagation();
                liveInput.jumpFromBus = true;
                setInput({ jumpFromBus: true });
              }}
            >
              <span>🪂 JUMP / DROP (SPACE)</span>
            </button>
          </div>
        )}

        {/* Airborne Flight / Glider Status */}
        {(() => {
          const groundH = myPlayer && obstacles ? getGroundHeight(myPlayer.x, myPlayer.z, obstacles) : 0;
          const isHighAirborne = myPlayer ? (!myPlayer.inBus && myPlayer.y > groundH + 3.0) : false;
          const showAirborneUI = myPlayer?.isSkydiving || myPlayer?.isGliding || isHighAirborne;

          if (!showAirborneUI) return null;

          return (
            <div className="flex flex-col items-center gap-2 mb-2 pointer-events-auto">
              <div className="bg-slate-900/90 border border-cyan-400/50 backdrop-blur-md px-3.5 py-1 rounded-full shadow-lg flex items-center gap-2">
                <span className="text-xs font-black text-cyan-300">
                  ALTITUDE: {Math.max(0, Math.round(myPlayer.y))}m
                </span>
                <span className="text-[10px] text-slate-300 uppercase font-bold">
                  {myPlayer.isGliding ? 'GLIDING' : (myPlayer.isSkydiving ? 'SKYDIVING' : 'AIRBORNE')}
                </span>
              </div>
              <button
                type="button"
                className={`font-black text-xs sm:text-sm px-5 py-2 rounded-xl shadow-xl border border-white/40 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2 ${
                  myPlayer.isGliding
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-cyan-500/50'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/50'
                }`}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  liveInput.toggleGlider = true;
                  setInput({ toggleGlider: true });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  liveInput.toggleGlider = true;
                  setInput({ toggleGlider: true });
                }}
              >
                <span>{myPlayer.isGliding ? '⚡ DIVE / CLOSE GLIDER (SPACE)' : '🪂 DEPLOY GLIDER (SPACE)'}</span>
              </button>
            </div>
          );
        })()}

        {/* Real-time Ability Charge & Status Tactical HUD */}
        {!myPlayer?.inBus && !myPlayer?.isSkydiving && !myPlayer?.isGliding && (
          <div className="bg-slate-900/90 backdrop-blur-md px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl border border-white/15 shadow-2xl flex flex-col gap-1 min-w-[150px] sm:min-w-[190px] pointer-events-none select-none">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm">{abilityInfo.icon}</span>
              <span className="text-[10px] sm:text-xs font-black text-white tracking-tight">{abilityInfo.jpName}</span>
            </div>
            <span className={`text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
              isBuffActive
                ? 'bg-amber-500/90 text-slate-950 font-black animate-pulse'
                : isAbilityReady
                ? 'bg-emerald-500 text-slate-950 font-black'
                : 'bg-purple-950/80 text-purple-300 border border-purple-500/40'
            }`}>
              {isBuffActive
                ? `発動中 ${remainingBuffSec.toFixed(1)}s`
                : isAbilityReady
                ? 'READY 100%'
                : `${chargePercent}%`}
            </span>
          </div>

          {/* Real-time Charge Gauge Bar */}
          <div className="w-full h-1.5 sm:h-2 bg-slate-950/90 rounded-full overflow-hidden border border-white/10 relative">
            {isBuffActive ? (
              // Active buff remaining meter (depleting)
              <div 
                className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-300 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(245,158,11,0.9)]"
                style={{ width: `${Math.max(0, Math.min(100, buffRatio * 100))}%` }}
              />
            ) : (
              // Cooldown charge meter (filling)
              <div 
                className={`h-full rounded-full transition-all duration-75 ${
                  isAbilityReady 
                    ? 'bg-gradient-to-r from-purple-400 via-pink-400 to-emerald-400 shadow-[0_0_10px_rgba(168,85,247,0.9)]'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-500'
                }`}
                style={{ width: `${chargePercent}%` }}
              />
            )}
          </div>
          <div className="flex justify-between items-center text-[8px] sm:text-[9px] text-slate-400 font-semibold px-0.5">
            <span>{isBuffActive ? '効果時間' : 'チャージ'}</span>
            <span className="font-mono text-slate-200">
              {isBuffActive
                ? `${remainingBuffSec.toFixed(1)}s`
                : isAbilityReady
                ? 'READY [E]'
                : `${remainingCdSec.toFixed(1)}s`}
            </span>
          </div>
        </div>
        )}

        {/* Action Controls - Two-tier Ergonomic Layout */}
        {/* Tier 1: Abilities, Tactical Skills, Heal & ADS Zoom */}
        <div className="flex gap-2 sm:gap-3 items-center justify-end pr-1 sm:pr-2">
          {/* Ability 1 Button with Radial Progress Ring */}
          <div className="relative w-13 h-13 sm:w-16 sm:h-16 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none drop-shadow-md" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" className="stroke-slate-950/80" strokeWidth="4" fill="none" />
              <circle
                cx="32"
                cy="32"
                r="26"
                className={`transition-all duration-75 ${
                  isBuffActive
                    ? 'stroke-amber-400 shadow-[0_0_12px_rgba(251,191,36,1)]'
                    : isAbilityReady
                    ? 'stroke-purple-400'
                    : 'stroke-indigo-500'
                }`}
                strokeWidth="4"
                strokeDasharray={163.36}
                strokeDashoffset={
                  isBuffActive
                    ? 163.36 * (1 - buffRatio)
                    : 163.36 * (1 - chargeRatio)
                }
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            <button 
              type="button"
              disabled={!isAbilityReady && !isBuffActive}
              className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all active:scale-95 select-none ${
                isBuffActive
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600 ring-2 sm:ring-4 ring-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.9)] animate-pulse'
                  : isAbilityReady
                  ? isAbilityActive
                    ? 'bg-purple-600 scale-95 ring-2 sm:ring-4 ring-purple-400/80 shadow-[0_0_18px_rgba(168,85,247,0.9)]'
                    : 'bg-gradient-to-br from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 shadow-[0_0_15px_rgba(168,85,247,0.6)] cursor-pointer'
                  : 'bg-slate-800/90 text-slate-400 cursor-not-allowed opacity-80'
              }`}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isAbilityReady) {
                  liveInput.useAbility = true;
                  setInput({ useAbility: true });
                  setIsAbilityActive(true);
                  if (myPlayer?.characterClass === 'scout') {
                    playJetpackSound();
                  } else {
                    playAbilitySound(myPlayer?.characterClass || 'default');
                  }
                }
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                liveInput.useAbility = false;
                setInput({ useAbility: false });
                setIsAbilityActive(false);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (isAbilityReady) {
                  liveInput.useAbility = true;
                  setInput({ useAbility: true });
                  setIsAbilityActive(true);
                  if (myPlayer?.characterClass === 'scout') {
                    playJetpackSound();
                  } else {
                    playAbilitySound(myPlayer?.characterClass || 'default');
                  }
                }
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                liveInput.useAbility = false;
                setInput({ useAbility: false });
                setIsAbilityActive(false);
              }}
              onPointerCancel={(e) => {
                e.stopPropagation();
                liveInput.useAbility = false;
                setInput({ useAbility: false });
                setIsAbilityActive(false);
              }}
            >
              {isBuffActive ? (
                <div className="flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base sm:text-lg animate-bounce">{abilityInfo.icon}</span>
                  <span className="text-[7px] sm:text-[8px] font-black text-slate-950 bg-amber-300 px-1 rounded tracking-tighter">
                    {remainingBuffSec.toFixed(1)}s
                  </span>
                </div>
              ) : isAbilityReady ? (
                <div className="flex flex-col items-center justify-center pointer-events-none">
                  <Zap size={16} className="text-purple-100 drop-shadow sm:w-4 sm:h-4" />
                  <span className="text-[7px] sm:text-[8px] font-black tracking-wider uppercase text-purple-100">READY</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs sm:text-sm opacity-75">{abilityInfo.icon}</span>
                  <span className="text-[8px] sm:text-[9px] font-mono font-black text-purple-300">
                    {remainingCdSec.toFixed(1)}s
                  </span>
                </div>
              )}
            </button>

            {/* Charge percentage floating mini-badge */}
            <div className={`absolute -top-1 -right-1 text-[7px] sm:text-[8px] font-black px-1 py-0.5 rounded-full border shadow-md pointer-events-none ${
              isBuffActive
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : isAbilityReady
                ? 'bg-emerald-500 text-slate-950 border-emerald-300 animate-bounce'
                : 'bg-slate-900 text-purple-300 border-purple-400/50'
            }`}>
              {isBuffActive ? 'ACTIVE' : isAbilityReady ? '100%' : `${chargePercent}%`}
            </div>
          </div>

          {/* Ability 2 Button (Scout Proximity Mine etc) */}
          {ability2Info && (
            <div className="relative w-13 h-13 sm:w-16 sm:h-16 flex items-center justify-center animate-in fade-in zoom-in duration-300">
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none drop-shadow-md" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="26" className="stroke-slate-950/80" strokeWidth="4" fill="none" />
                <circle 
                  cx="32" cy="32" r="26"
                  className={`transition-all duration-100 ease-linear ${
                    isBuff2Active
                      ? 'stroke-amber-400'
                      : isAbility2Ready
                      ? 'stroke-emerald-400'
                      : 'stroke-teal-500'
                  }`}
                  strokeWidth="4"
                  strokeDasharray={163.36}
                  strokeDashoffset={
                    isBuff2Active
                      ? 163.36 * (1 - buffRatio)
                      : 163.36 * (1 - charge2Ratio)
                  }
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>

              <button 
                type="button"
                disabled={!isAbility2Ready && !isBuff2Active}
                className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all active:scale-95 select-none touch-manipulation ${
                  isBuff2Active
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 ring-2 ring-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.9)] animate-pulse'
                    : isAbility2Ready
                    ? 'bg-gradient-to-br from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)] cursor-pointer'
                    : 'bg-slate-800/90 text-slate-400 cursor-not-allowed opacity-80'
                }`}
                onTouchStart={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  if (isAbility2Ready) {
                    liveInput.useAbility2 = true;
                    setInput({ useAbility2: true });
                    playAbilitySound('mine');
                  }
                }}
                onTouchEnd={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  liveInput.useAbility2 = false; setInput({ useAbility2: false });
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (isAbility2Ready) {
                    liveInput.useAbility2 = true;
                    setInput({ useAbility2: true });
                    playAbilitySound('mine');
                  }
                }}
                onPointerUp={(e) => { e.stopPropagation(); liveInput.useAbility2 = false; setInput({ useAbility2: false }); }}
                onPointerCancel={(e) => { e.stopPropagation(); liveInput.useAbility2 = false; setInput({ useAbility2: false }); }}
              >
                {isAbility2Ready ? (
                  <div className="flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-base sm:text-lg drop-shadow">{ability2Info.icon}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs opacity-75">{ability2Info.icon}</span>
                    <span className="text-[7px] sm:text-[8px] font-mono font-black text-teal-300">
                      {remainingCd2Sec.toFixed(1)}s
                    </span>
                  </div>
                )}
              </button>

              <div className={`absolute -top-1 -right-1 text-[7px] sm:text-[8px] font-black px-1 py-0.5 rounded-full border shadow-md pointer-events-none ${
                isAbility2Ready
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300 animate-bounce'
                  : 'bg-slate-900 text-teal-300 border-teal-400/50'
              }`}>
                {isAbility2Ready ? '100%' : `${charge2Percent}%`}
              </div>
            </div>
          )}

          {/* Heal Button */}
          <div className="relative">
            <button 
              type="button"
              className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all border-2 border-emerald-300/40 active:scale-95 cursor-pointer select-none ${
                myPlayer.heals > 0 
                  ? isHealingActive 
                    ? 'bg-emerald-600 scale-95 ring-4 ring-emerald-400/50' 
                    : 'bg-emerald-500/85 hover:bg-emerald-600'
                  : 'bg-slate-700/60 opacity-40 cursor-not-allowed'
              }`}
              disabled={myPlayer.heals <= 0}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (myPlayer.heals > 0) {
                  liveInput.isHealing = true;
                  setInput({ isHealing: true });
                  setIsHealingActive(true);
                  playAbilitySound('heal');
                }
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                liveInput.isHealing = false;
                setInput({ isHealing: false });
                setIsHealingActive(false);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (myPlayer.heals > 0) {
                  liveInput.isHealing = true;
                  setInput({ isHealing: true });
                  setIsHealingActive(true);
                  playAbilitySound('heal');
                }
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                liveInput.isHealing = false;
                setInput({ isHealing: false });
                setIsHealingActive(false);
              }}
              onPointerCancel={(e) => {
                e.stopPropagation();
                liveInput.isHealing = false;
                setInput({ isHealing: false });
                setIsHealingActive(false);
              }}
            >
              <PlusCircle size={16} className="text-emerald-100 sm:w-4 sm:h-4" />
              <span className="text-[7px] sm:text-[8px] font-black tracking-tighter uppercase">Heal</span>
            </button>
            {myPlayer.heals > 0 && (
              <div className="absolute -top-1 -right-1 bg-slate-900 text-emerald-400 text-[9px] sm:text-[10px] font-black w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border-2 border-emerald-400 shadow-md pointer-events-none">
                {myPlayer.heals}
              </div>
            )}
          </div>

          {/* Aim Zoom Button (ADS) */}
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all border-2 active:scale-95 cursor-pointer select-none ${
                isZoomedLocal
                  ? 'bg-cyan-500 border-cyan-200 ring-4 ring-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.9)] scale-95'
                  : 'bg-slate-800/90 hover:bg-slate-700/90 border-cyan-400/50 text-cyan-100'
              }`}
              onPointerDown={handleToggleZoomAction}
              onClick={handleToggleZoomAction}
            >
              <ZoomIn size={16} className={isZoomedLocal ? 'text-slate-950 font-black sm:w-4 sm:h-4' : 'text-cyan-300 sm:w-4 sm:h-4'} />
              <span className={`text-[7px] sm:text-[8px] font-black tracking-tighter uppercase mt-0.5 ${
                isZoomedLocal ? 'text-slate-950' : 'text-cyan-200'
              }`}>
                {isZoomedLocal ? 'ZOOM' : 'ADS'}
              </span>
            </button>
            <div className="absolute -bottom-2 text-[6px] sm:text-[7px] font-black bg-slate-900/90 text-cyan-300 px-1 rounded border border-cyan-500/40 pointer-events-none">
              Zoom
            </div>
          </div>
        </div>

        {/* Tier 2: Primary Actions - Glider, Jump / Roll & High-Impact Fire Button */}
        <div className="flex gap-2 sm:gap-3.5 items-end justify-end">
          {/* Airborne Glider Action Button (空中時のみ表示) */}
          {(() => {
            const groundH = myPlayer && obstacles ? getGroundHeight(myPlayer.x, myPlayer.z, obstacles) : 0;
            const isAirborne = myPlayer ? (!myPlayer.inBus && (myPlayer.isSkydiving || myPlayer.isGliding || myPlayer.y > groundH + 1.2)) : false;

            if (!isAirborne) return null;

            return (
              <div className="relative flex items-center justify-center animate-in fade-in zoom-in duration-200">
                <button
                  type="button"
                  className="w-13 h-13 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all border-2 active:scale-95 cursor-pointer bg-gradient-to-br from-blue-500 to-cyan-500 border-cyan-200 ring-4 ring-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.9)] animate-pulse"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    liveInput.toggleGlider = true;
                    setInput({ toggleGlider: true });
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    liveInput.toggleGlider = true;
                    setInput({ toggleGlider: true });
                  }}
                >
                  <span className="text-lg sm:text-xl">🪂</span>
                  <span className="text-[7px] sm:text-[8px] font-black tracking-tight uppercase">
                    {myPlayer?.isGliding ? 'DIVE' : 'GLIDE'}
                  </span>
                </button>
                <div className="absolute -bottom-2 text-[7px] sm:text-[8px] font-black bg-slate-900/90 text-cyan-300 px-1 rounded border border-cyan-500/40 pointer-events-none">
                  Space
                </div>
              </div>
            );
          })()}

          {/* Dedicated Jump / Roll Button for Mobile/iPad */}
          <div className="relative w-14 h-14 sm:w-18 sm:h-18 flex items-center justify-center">
            {/* SVG Circular Progress Ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none drop-shadow-md" viewBox="0 0 68 68">
              <circle cx="34" cy="34" r="28" className="stroke-slate-950/80" strokeWidth="4" fill="none" />
              <circle
                cx="34"
                cy="34"
                r="28"
                className={`transition-all duration-75 ${
                  isRollReady ? 'stroke-cyan-400' : 'stroke-slate-600'
                }`}
                strokeWidth="4"
                strokeDasharray={175.93}
                strokeDashoffset={175.93 * (1 - rollChargeRatio)}
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            <button
              type="button"
              disabled={!isRollReady}
              className={`w-12 h-12 sm:w-15 sm:h-15 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all border-2 border-cyan-400/50 active:scale-95 select-none ${
                isRollReady
                  ? isRollingActive
                    ? 'bg-cyan-600 scale-95 ring-4 ring-cyan-400/80 shadow-[0_0_18px_rgba(6,182,212,0.9)]'
                    : 'bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-[0_0_12px_rgba(6,182,212,0.6)] cursor-pointer'
                  : 'bg-slate-800/85 text-slate-500 cursor-not-allowed opacity-75'
              }`}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isRollReady) {
                  handleMobileJumpAction();
                }
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (isRollReady) {
                  handleMobileJumpAction();
                }
              }}
            >
              <Wind size={18} className="text-cyan-100 sm:w-5 sm:h-5" />
              <span className="text-[8px] sm:text-[9px] font-black tracking-tight uppercase mt-0.5">
                {isRollReady ? 'JUMP' : `${remainingRollCdSec.toFixed(1)}s`}
              </span>
            </button>
            <div className="absolute -bottom-2 text-[7px] sm:text-[8px] font-black bg-slate-900/90 text-cyan-300 px-1 rounded border border-cyan-500/40 pointer-events-none">
              Space / Q
            </div>
          </div>

          {/* Shoot Button (Enlarged High-Impact Fire Button / 射撃ボタン) */}
          <button 
            type="button"
            className={`w-19 h-19 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all border-3 border-red-300/60 active:scale-95 cursor-pointer select-none ${
              isShootingActive 
                ? 'bg-red-600 scale-95 ring-6 ring-red-400/80 shadow-[0_0_35px_rgba(239,68,68,0.95)]' 
                : 'bg-gradient-to-br from-red-500 to-rose-700 hover:from-red-400 hover:to-rose-600 shadow-[0_0_20px_rgba(239,68,68,0.7)]'
            }`}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              liveInput.isShooting = true;
              setInput({ isShooting: true });
              setIsShootingActive(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              liveInput.isShooting = false;
              setInput({ isShooting: false });
              setIsShootingActive(false);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              liveInput.isShooting = true;
              setInput({ isShooting: true });
              setIsShootingActive(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              liveInput.isShooting = false;
              setInput({ isShooting: false });
              setIsShootingActive(false);
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              liveInput.isShooting = false;
              setInput({ isShooting: false });
              setIsShootingActive(false);
            }}
          >
            <Target size={30} className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] sm:w-11 sm:h-11" />
            <span className="text-[10px] sm:text-[12px] font-black tracking-widest uppercase mt-0.5 drop-shadow">FIRE</span>
          </button>
        </div>

      </div>

      {/* Mid-Match Leave Confirmation Dialog */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 pointer-events-auto select-none">
          <div className="bg-slate-900 border-2 border-red-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mb-4 shadow-lg shadow-red-500/20">
              <AlertTriangle size={30} />
            </div>
            
            <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
              マッチから退出しますか？
            </h3>
            
            <p className="text-xs sm:text-sm text-slate-300 mb-6 font-medium leading-relaxed">
              現在進行中のマッチを抜けてロビー画面に戻ります。
            </p>

            <div className="flex flex-col gap-2.5 w-full">
              <button
                type="button"
                onClick={() => {
                  setShowLeaveModal(false);
                  if (onReturnToLobby) {
                    onReturnToLobby();
                  } else {
                    leaveGame();
                  }
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-500 active:scale-98 text-white font-black text-sm sm:text-base rounded-xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut size={18} />
                <span>退出してロビーに戻る</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-300 font-bold text-sm rounded-xl border border-white/10 transition-all cursor-pointer"
              >
                試合を続ける
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        defaultAuthorName={myPlayer?.name}
      />

    </div>
  );
}
