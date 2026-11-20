import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingDisplayProps {
  rating: number;
  size?: 'xs' | 'sm' | 'md';
  showNumeric?: boolean;
  reviewCount?: number;
}

export const StarRatingDisplay: React.FC<StarRatingDisplayProps> = ({
  rating,
  size = 'sm',
  showNumeric = true,
  reviewCount,
}) => {
  const clamped = Math.max(0, Math.min(5, Number(rating) || 0));
  const iconClass =
    size === 'xs' ? 'w-3 h-3' : size === 'md' ? 'w-4.5 h-4.5' : 'w-3.5 h-3.5';

  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="inline-flex items-center gap-0.5" aria-label={`${clamped.toFixed(1)} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = clamped >= star - 0.25;
          return (
            <Star
              key={star}
              className={`${iconClass} ${
                filled
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-slate-300 dark:text-slate-700'
              }`}
            />
          );
        })}
      </div>
      {showNumeric && (
        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100 tabular-nums">
          {clamped > 0 ? clamped.toFixed(1) : 'New'}
        </span>
      )}
      {typeof reviewCount === 'number' && (
        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
          ({reviewCount})
        </span>
      )}
    </div>
  );
};

interface StarRatingInputProps {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}

export const StarRatingInput: React.FC<StarRatingInputProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [hovered, setHovered] = useState<number>(0);
  const active = hovered || value;
  const labels = ['', 'Needs Improvement', 'Fair', 'Good', 'Very Good', 'Exceptional'];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = active >= star;
          return (
            <button
              key={star}
              type="button"
              disabled={disabled}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => onChange(star)}
              aria-label={`Rate ${star} out of 5 stars`}
              className="p-1 rounded-lg hover:scale-110 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F2FE] disabled:opacity-50"
            >
              <Star
                className={`w-6 h-6 transition-colors ${
                  filled
                    ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]'
                    : 'text-slate-300 dark:text-slate-700 hover:text-amber-300'
                }`}
              />
            </button>
          );
        })}
      </div>
      {active > 0 && (
        <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-300">
          {active}/5 · {labels[active]}
        </span>
      )}
    </div>
  );
};
