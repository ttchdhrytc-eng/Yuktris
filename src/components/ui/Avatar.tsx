import { getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';

type AvatarProps = {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizes = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-semibold border border-gold-500/20',
        sizes[size],
        className
      )}
      style={{
        background: 'linear-gradient(145deg, rgba(100, 16, 30, 0.6), rgba(77, 16, 32, 0.6))',
        color: 'rgb(242 201 76)',
      }}
    >
      {getInitials(name) || '?'}
    </div>
  );
}
