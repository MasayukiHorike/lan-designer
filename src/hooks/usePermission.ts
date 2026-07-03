import { useEffect, useState } from 'react';
import { useRole } from '../contexts/RoleContext';
import { useProject } from '../contexts/ProjectContext';
import { AccessControlRepository } from '../repositories/AccessControlRepository';
import { DEFAULT_PERMISSIONS } from '../constants/accessControl';
import type { Permission } from '../types/schema';

const accessControlRepo = new AccessControlRepository();

export function usePermission(screenId: string): Permission {
  const { role } = useRole();
  const { project } = useProject();
  const [permission, setPermission] = useState<Permission>(
    role ? (DEFAULT_PERMISSIONS[screenId]?.[role] ?? 'full') : 'none',
  );

  useEffect(() => {
    if (!role || !project) {
      return;
    }
    let cancelled = false;
    accessControlRepo.getPermission(project._id, screenId, role).then((p) => {
      if (!cancelled) {
        setPermission(p);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [screenId, role, project]);

  return permission;
}
