import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6 select-none font-sans">
          <div className="max-w-md w-full bg-slate-900 border border-red-500/40 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 text-3xl mb-4">
              ⚠️
            </div>
            <h2 className="text-2xl font-black text-white mb-2">エラーが発生しました</h2>
            <p className="text-sm text-slate-400 mb-6">
              描画または通信の回復処理を行います。「ゲームを再開」を押してください。
            </p>
            <button
              onClick={this.handleReload}
              className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-950 font-black text-lg rounded-2xl shadow-lg shadow-yellow-400/20 transition-all"
            >
              ゲームを再開
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
