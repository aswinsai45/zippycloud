import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Cloud, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ZippyCloud error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
              <Cloud className="w-7 h-7 text-red-400" />
            </div>
            <h1 className="text-white text-xl font-bold mb-2">
              Something went wrong
            </h1>
            <p className="text-zinc-400 text-sm mb-1">
              An unexpected error occurred in ZippyCloud.
            </p>
            {this.state.message && (
              <p className="text-zinc-600 text-xs font-mono bg-zinc-900 rounded-lg px-4 py-2 mt-3 mb-5 text-left break-all">
                {this.state.message}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-colors mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
