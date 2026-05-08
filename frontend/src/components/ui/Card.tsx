import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'blue' | 'red' | 'green' | null;
}

function Card({ children, className = '', hover = false, glow = null }: CardProps) {
  const glowStyles = {
    blue: 'shadow-glow-sm border-blue-500/20',
    red: 'shadow-glow-red border-red-500/20',
    green: 'shadow-glow-green border-emerald-500/20',
  };

  return (
    <div className={`
      bg-dark-card/80 backdrop-blur-sm border border-dark-border rounded-xl p-6
      ${hover ? 'hover:bg-dark-card-hover hover:border-dark-border-hover hover:shadow-card-hover transition-all duration-200' : ''}
      ${glow ? glowStyles[glow] : ''}
      ${className}
    `}>
      {children}
    </div>
  );
}

export default Card;
