import React from 'react';
import { X } from 'lucide-react';
import type { User } from '../types';
import { AuthView } from './AuthView';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAuthenticated: (user: User) => void;
  initialMode?: 'signup' | 'login' | 'signin';
  customLogoUrl?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onUserAuthenticated,
  initialMode = 'signin',
  customLogoUrl,
}) => {
  if (!isOpen) return null;

  const resolvedMode: 'signin' | 'signup' =
    initialMode === 'signup' ? 'signup' : 'signin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl my-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 transition-colors"
          aria-label="Close authentication modal"
        >
          <X className="w-5 h-5" />
        </button>

        <AuthView
          initialMode={resolvedMode}
          isModal={true}
          customLogoUrl={customLogoUrl}
          onClose={onClose}
          onAuthenticated={onUserAuthenticated}
        />
      </div>
    </div>
  );
};
