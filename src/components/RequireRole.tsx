import { Navigate, Outlet } from 'react-router-dom';
import { useRole } from '../contexts/RoleContext';

export function RequireRole() {
  const { role } = useRole();

  if (!role) {
    return <Navigate to="/role" replace />;
  }

  return <Outlet />;
}
