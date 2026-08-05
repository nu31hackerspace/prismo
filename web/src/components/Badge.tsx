interface Props {
  label?: string;
  variant?: 'info' | 'success' | 'error';
  children?: React.ReactNode;
}

export default function Badge({ label = '', variant = 'info', children }: Props) {
  const variantClasses: Record<string, string> = {
    info: 'bg-accent-primary text-background-primary',
    success: '',
    error: '',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    info: {},
    success: { backgroundColor: '#16a34a', color: '#ffffff' },
    error: { backgroundColor: '#dc2626', color: '#ffffff' },
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg px-3 py-1 text-sm font-semibold ${variantClasses[variant]}`}
      style={variantStyles[variant]}
    >
      {label}
      {children}
    </span>
  );
}
