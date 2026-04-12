import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  widgetTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  mountKey: number;
}

export default class WidgetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, mountKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      mountKey: prev.mountKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border bg-slate-900 border-slate-800">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span className="text-sm font-semibold text-slate-200 tracking-wide">
              {this.props.widgetTitle ?? 'Widget'}
            </span>
          </div>
          <div className="p-4 flex flex-col items-center justify-center py-6 gap-3 text-center">
            <AlertCircle size={20} className="text-amber-500" />
            <p className="text-xs text-slate-400">Widget encountered an error</p>
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
            >
              <RefreshCw size={11} />
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={this.state.mountKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
