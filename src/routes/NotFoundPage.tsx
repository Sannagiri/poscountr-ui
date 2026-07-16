import { Link } from 'react-router-dom';

import { Button, EmptyState } from '@/components';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <EmptyState
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Link to="/">
            <Button variant="secondary">Back to home</Button>
          </Link>
        }
      />
    </div>
  );
}
