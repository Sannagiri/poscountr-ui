import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';

export interface ComingSoonPageProps {
  title: string;
  phase: string;
}

/**
 * Placeholder for a module page whose real build is scheduled for a later
 * roadmap phase (see POSCountr-UI-Planning/poscountr-ui-execution-roadmap.md).
 * Keeps routing and navigation fully wired end-to-end in F0 without
 * front-running the module's own confirm-first discussion.
 */
export function ComingSoonPage({ title, phase }: ComingSoonPageProps) {
  return (
    <div>
      <PageHeader title={title} />
      <EmptyState
        title={`${title} is scheduled for ${phase}`}
        description="This route is wired up; the screen itself is built when that phase starts."
      />
    </div>
  );
}
