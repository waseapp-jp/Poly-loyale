import React, { useState, useEffect } from 'react';
import {
  Activity,
  Wifi,
  Zap,
  Gauge,
  RotateCw,
  X,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Server,
  Signal
} from 'lucide-react';
import { useGameStore } from '../store';

interface LagMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LagMonitorModal: React.FC<LagMonitorModalProps> = ({ isOpen, onClose }) => {
  const {
    latencyMs,
    jitterMs,
    fps,
    pingHistory,
    p2pState,
    p2pPing,
    socket,
    measurePing,
    runFullLagDiagnostic,
    isMeasuringLag
  } = useGameStore();

  const [diagnosticResult, setDiagnosticResult] = useState<{
    avgPing: number;
    minPing: number;
    maxPing: number;
    jitter: number;
  } | null>(null);

  // Auto measure ping periodically when modal is open
  useEffect(() => {
    if (!isOpen) return;
    measurePing();
    const interval = setInterval(() => {
      measurePing();
    }, 1500);
    return () => clearInterval(interval);
  }, [isOpen, measurePing]);

  if (!isOpen) return null;

  const activePing = p2pState === 'connected' && p2pPing > 0 ? p2pPing : latencyMs;
  const isP2P = p2pState === 'connected';
  const isConnected = isP2P || (socket && socket.connected);

  const handleTestRun = async () => {
    const res = await runFullLagDiagnostic();
    setDiagnosticResult(res);
  };

  // Determine status color & label
  let statusColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
  let statusBadge = '🟢 極低遅延 (快適)';
  let statusDesc = '通信応答速度が非常に良好です。対戦や照準操作が即座に反映されます。';

  if (!isConnected) {
    statusColor = 'text-slate-400 border-slate-700 bg-slate-800/50';
    statusBadge = '⚪ 未接続';
    statusDesc = 'サーバーまたは対戦相手に接続されていません。';
  } else if (activePing > 120) {
    statusColor = 'text-rose-400 border-rose-500/40 bg-rose-500/10';
    statusBadge = '🔴 高遅延・ラグ注意';
    statusDesc = '通信遅延が発生しています。Wi-Fiの電波状態や他のダウンロード通信をご確認ください。';
  } else if (activePing > 55) {
    statusColor = 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    statusBadge = '🟡 標準・ややラグあり';
    statusDesc = 'プレイ可能ですが、わずかな通信遅延が生じる場合があります。';
  }

  // Draw smooth SVG path for ping history graph
  const graphWidth = 320;
  const graphHeight = 80;
  const maxPingScale = Math.max(100, ...pingHistory, 1);
  const minPingScale = 0;

  const points = pingHistory.map((val, idx) => {
    const x = (idx / Math.max(1, pingHistory.length - 1)) * graphWidth;
    const y = graphHeight - ((val - minPingScale) / (maxPingScale - minPingScale)) * (graphHeight - 10) - 5;
    return `${x},${y}`;
  }).join(' ');

  const areaPath = pingHistory.length > 0
    ? `M 0,${graphHeight} L ${points} L ${graphWidth},${graphHeight} Z`
    : '';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-b border-amber-500/20">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                ラグ測定 & 通信診断
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  REALTIME
                </span>
              </h2>
              <p className="text-xs text-slate-400">通信応答速度（Ping）・ジッター・FPSの即時計測</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          
          {/* Status Alert Banner */}
          <div className={`p-4 rounded-xl border flex items-start space-x-3 ${statusColor}`}>
            {activePing > 120 ? (
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-extrabold text-sm mb-1">{statusBadge}</div>
              <p className="text-xs opacity-90 leading-relaxed">{statusDesc}</p>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* Ping */}
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>PING (応答時間)</span>
                <Wifi className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-xl font-black font-mono text-white">
                {activePing > 0 ? `${activePing}` : '--'} <span className="text-xs font-normal text-slate-400">ms</span>
              </div>
            </div>

            {/* Jitter */}
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>JITTER (揺らぎ)</span>
                <Signal className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-xl font-black font-mono text-white">
                ±{jitterMs} <span className="text-xs font-normal text-slate-400">ms</span>
              </div>
            </div>

            {/* FPS */}
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>FPS (フレーム)</span>
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-xl font-black font-mono text-white">
                {fps} <span className="text-xs font-normal text-slate-400">FPS</span>
              </div>
            </div>

            {/* Connection Mode */}
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>通信方式</span>
                {isP2P ? <Zap className="w-3.5 h-3.5 text-amber-400" /> : <Server className="w-3.5 h-3.5 text-indigo-400" />}
              </div>
              <div className="text-xs font-bold text-amber-300 truncate">
                {isP2P ? 'P2P WebRTC' : 'WebSocket'}
              </div>
            </div>

          </div>

          {/* Live Ping Wave Graph */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-amber-400" />
                リアルタイムレイテンシ変動グラフ
              </span>
              <span className="text-slate-500 font-mono">直近 {pingHistory.length} サンプル</span>
            </div>

            <div className="relative w-full h-20 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800/80">
              {pingHistory.length > 0 ? (
                <svg className="w-full h-full" viewBox={`0 0 ${graphWidth} ${graphHeight}`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="pingGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {areaPath && <path d={areaPath} fill="url(#pingGrad)" />}
                  {points && (
                    <polyline
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={points}
                    />
                  )}
                </svg>
              ) : (
                <span className="text-xs text-slate-600">データ測定中...</span>
              )}
            </div>
          </div>

          {/* Full Speed / Diagnostic Test */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-amber-400" />
                  ベンチマーク精密診断
                </h4>
                <p className="text-[11px] text-slate-400">連続パケット測定を行い平均遅延とブレを算出します</p>
              </div>
              <button
                onClick={handleTestRun}
                disabled={isMeasuringLag}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center space-x-1.5"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isMeasuringLag ? 'animate-spin' : ''}`} />
                <span>{isMeasuringLag ? '測定中...' : '精密再測定'}</span>
              </button>
            </div>

            {diagnosticResult && (
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-center text-xs">
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">平均遅延</div>
                  <div className="font-extrabold text-amber-400 font-mono text-sm">{diagnosticResult.avgPing} ms</div>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">最小遅延</div>
                  <div className="font-extrabold text-emerald-400 font-mono text-sm">{diagnosticResult.minPing} ms</div>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">最大遅延</div>
                  <div className="font-extrabold text-rose-400 font-mono text-sm">{diagnosticResult.maxPing} ms</div>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">ジッター</div>
                  <div className="font-extrabold text-blue-400 font-mono text-sm">±{diagnosticResult.jitter} ms</div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>POLY ROYALE Network Diagnostics System</span>
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
