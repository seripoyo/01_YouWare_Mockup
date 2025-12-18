import React from 'react';

type Props = { children: React.ReactNode };

type State = {
  error: Error | null;
  info: { componentStack: string } | null;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, info: null };
  }

  override componentDidCatch(error: Error, info: { componentStack: string }) {
  
    // Save error to state for rendering
    this.setState({ error, info });
    
    // Also log to console for platform console capture
    console.error('[ErrorBoundary] Caught error', { error, info });
  }

  render() {
    if (this.state.error) {
      const log = {
        type: 'ErrorBoundary',
        name: this.state.error.name,
        message: this.state.error.message,
        stack: this.state.error.stack,
        componentStack: this.state.info?.componentStack,
        time: new Date().toISOString(),
      };
      const text = JSON.stringify(log, null, 2);
      return (
        <div className="max-w-3xl mx-auto p-4">
          <h2 className="text-xl font-semibold mb-2">エラーが発生しました</h2>
          <p className="text-sm text-gray-700 mb-3">以下のログをコピーして共有できます。</p>
          <textarea
            className="w-full h-56 border rounded p-2 text-sm"
            defaultValue={text}
          />
          <div className="mt-2 flex gap-2">
            <button
              className="px-3 py-1 border rounded bg-black text-white text-sm"
              onClick={() => navigator.clipboard.writeText(text)}
            >
              ログをコピー
            </button>
            <button
              className="px-3 py-1 border rounded text-sm"
              onClick={() => this.setState({ error: null, info: null })}
            >
              続行（UIへ戻る）
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
