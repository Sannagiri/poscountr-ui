import { Navigate } from 'react-router-dom';

import { useAuthStore } from '@/modules/auth';

/** Sends `/` to the correct home for the signed-in role. */
export function HomeRedirect() {
  const role = useAuthStore((state) => state.user?.role);
  return <Navigate to={role === 'ultra_admin' ? '/platform' : '/dashboard'} replace />;
}
