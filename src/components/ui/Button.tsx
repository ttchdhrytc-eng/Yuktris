import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'glow' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'xl' | 'icon';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-gold-400 via-gold-500 to-gold-300 text-maroon-950 font-semibold hover:from-gold-300 hover:via-gold-400 hover:to-neon-400 btn-gold-glow hover:shadow-gold-lg active:from-gold-500 active:to-gold-500',
  glow:
    'bg-gradient-to-r from-gold-300 via-gold-400 to-neon-400 text-maroon-950 font-semibold btn-gold-glow hover:shadow-gold-lg',
  success:
    'bg-success-600 text-ink-50 hover:bg-success-500 active:bg-success-700 shadow-sm hover:shadow-md',
  secondary:
    'bg-gradient-to-r from-wine-900/80 to-wine-800/80 text-ink-200 hover:from-wine-800 hover:to-wine-750 border border-gold-500/15 hover:border-gold-500/30 hover:text-ink-50 backdrop-blur-md',
  ghost: 'text-ink-400 hover:bg-gold-500/8 hover:text-gold-300 hover:border-gold-500/20 border border-transparent',
  danger: 'bg-gradient-to-r from-maroon-800 to-wine-850 text-ink-50 hover:from-maroon-750 hover:to-wine-800 shadow-red active:scale-[0.97] border border-red-700/30',
  outline:
    'border border-gold-500/30 text-gold-400 hover:bg-gold-500/10 hover:border-gold-500/50 hover:text-gold-300 backdrop-blur-sm',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-2xl',
  xl: 'h-14 px-8 text-base gap-2.5 rounded-2xl',
  icon: 'h-10 w-10 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-maroon-950',
          'disabled:opacity-50 disabled:pointer-events-none',
          'active:scale-[0.97] transition-all duration-300 ease-premium',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
