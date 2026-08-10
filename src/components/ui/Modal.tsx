import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-maroon-950/70 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full rounded-3xl border border-gold-500/20 animate-scale-in',
          'max-h-[85vh] flex flex-col',
          'backdrop-blur-2xl',
          sizeMap[size]
        )}
        style={{
          background: 'linear-gradient(145deg, rgba(77, 16, 32, 0.95), rgba(88, 18, 37, 0.92))',
          boxShadow: '0 25px 50px -12px rgba(120, 20, 40, 0.6), 0 0 0 1px rgba(212, 175, 55, 0.1), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px rounded-t-3xl"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.4), transparent)' }}
        />
        {(title || description) && (
          <div className="px-6 py-5 border-b border-gold-500/10 shrink-0">
            {title && <h2 className="text-lg font-semibold text-ink-50 tracking-tight">{title}</h2>}
            {description && <p className="text-sm text-ink-400 mt-1">{description}</p>}
          </div>
        )}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-ink-500 hover:text-gold-400 hover:bg-gold-500/10 rounded-xl p-1.5 transition-all duration-200"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="px-6 py-5 overflow-y-auto scrollbar-thin flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gold-500/10 flex items-center justify-end gap-3 shrink-0 rounded-b-3xl"
            style={{ background: 'rgba(35, 0, 6, 0.4)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
