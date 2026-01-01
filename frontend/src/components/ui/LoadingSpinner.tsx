function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-12 h-12 border-4',
    lg: 'w-16 h-16 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`${sizes[size]} border-dark-border border-t-primary-blue rounded-full animate-spin`}></div>
      <p className="text-gray-400">Loading...</p>
    </div>
  );
}

export default LoadingSpinner;