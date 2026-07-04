import { cn } from '@/lib/utils';

// Wraps a chart with an insight title above it. Titles should state the
// takeaway ("Submissions are climbing"), not the data type ("Submissions").
export function ChartFrame({
  title,
  className,
  children,
}: {
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('w-full', className)}>
      {title && (
        <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
      )}
      {children}
    </div>
  );
}
