import React from 'react';
import { AlertTriangle, ExternalLink, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  parseFirestoreError,
  QUOTA_PRICING_URL,
  QUOTA_UPGRADE_URL,
} from '../services/firebaseService';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    const parsed = parseFirestoreError(this.state.error);

    return (
      <div className="min-h-screen bg-[#071120] text-slate-100 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl rounded-3xl bg-[#0A192F] border border-rose-500/40 shadow-2xl p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
              {parsed.isQuotaExceeded ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400">
                {parsed.isQuotaExceeded
                  ? 'Cloud Firestore Quota Limit'
                  : parsed.firestoreInfo
                  ? 'Firestore Security or Data Notice'
                  : 'Unexpected Interface Error'}
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                {parsed.isQuotaExceeded
                  ? 'Daily Free-Tier Quota Reached'
                  : 'Unable to Complete Academy View'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {parsed.userMessage}
              </p>
            </div>
          </div>

          {parsed.firestoreInfo && (
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-400 space-y-1">
              <div>
                Operation:{' '}
                <span className="text-[#00F2FE]">{parsed.firestoreInfo.operationType}</span>
              </div>
              {parsed.firestoreInfo.path && (
                <div className="truncate">
                  Path: <span className="text-slate-200">{parsed.firestoreInfo.path}</span>
                </div>
              )}
            </div>
          )}

          {parsed.isQuotaExceeded && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2.5">
              <p className="leading-relaxed">
                Free-tier Firestore quotas reset automatically the next day. Full Spark plan quotas under the Enterprise edition are documented on Firebase Pricing.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <a
                  href={QUOTA_UPGRADE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold hover:brightness-110 transition-all"
                >
                  <span>Upgrade Database in Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={QUOTA_PRICING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-semibold hover:border-amber-400/50 transition-colors"
                >
                  <span>Spark / Enterprise Quotas</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700 hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Page</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
