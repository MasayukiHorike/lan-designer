import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in LAN Designer:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
          <h1 className="text-xl font-bold text-slate-800">予期しないエラーが発生しました</h1>
          <p className="max-w-md text-sm text-slate-600">
            画面の表示中にエラーが発生しました。再読み込みしても解消しない場合は、操作内容を管理者にご連絡ください。
          </p>
          <pre className="max-w-lg overflow-x-auto rounded bg-slate-100 p-3 text-left text-xs text-slate-500">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-900"
          >
            再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
