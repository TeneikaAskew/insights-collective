// ABOUTME: Simple placeholder view for builder sections that aren't fully implemented yet.
// ABOUTME: Used for Design templates, Certificates, Pricing, Sales pages, Students, Reports.

interface PlaceholderViewProps {
  courseTitle: string;
  title: string;
  description: string;
}

export function PlaceholderView({ courseTitle, title, description }: PlaceholderViewProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1200px] mx-auto">
      <div className="text-xs uppercase tracking-widest text-gray-500 mb-3">
        <span className="underline underline-offset-4 cursor-pointer">Courses</span>
        <span className="mx-2 opacity-50">|</span>
        <span>{courseTitle}</span>
      </div>
      <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl mb-4">{title}</h2>
      <div
        className="rounded-xl bg-white p-12 text-center"
        style={{ border: '1px dashed hsl(var(--tw-border))' }}
      >
        <h3 className="text-xl font-semibold text-gray-900 mb-3">
          This feature is not available yet
        </h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">{description}</p>
        <p className="text-xs text-gray-400 mt-3">Coming soon in this workspace.</p>
      </div>
    </div>
  );
}

export default PlaceholderView;
