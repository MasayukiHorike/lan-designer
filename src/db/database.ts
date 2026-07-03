import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AccessControl,
  Application,
  Approval,
  Bus,
  Changelog,
  Ecu,
  Frame,
  GwRoute,
  Project,
  Signal,
  Snapshot,
  SubsetHistory,
  Variant,
  VersionHistory,
} from '../types/schema';

export const DB_NAME = 'lan-designer';
export const DB_VERSION = 1;

interface LanDesignerDB extends DBSchema {
  projects: { key: string; value: Project };
  variants: { key: string; value: Variant; indexes: { projectId: string } };
  ecus: { key: string; value: Ecu; indexes: { projectId: string } };
  buses: { key: string; value: Bus; indexes: { projectId: string } };
  frames: {
    key: string;
    value: Frame;
    indexes: { projectId: string; applicationId: string };
  };
  signals: {
    key: string;
    value: Signal;
    indexes: { projectId: string; frameId: string; applicationId: string };
  };
  versionHistories: {
    key: string;
    value: VersionHistory;
    indexes: { projectId: string; targetId: string };
  };
  applications: { key: string; value: Application; indexes: { projectId: string } };
  approvals: { key: string; value: Approval; indexes: { applicationId: string } };
  gwRoutes: {
    key: string;
    value: GwRoute;
    indexes: { projectId: string; frameId: string };
  };
  snapshots: { key: string; value: Snapshot; indexes: { projectId: string } };
  changelogs: { key: string; value: Changelog; indexes: { projectId: string } };
  subsetHistories: {
    key: string;
    value: SubsetHistory;
    indexes: { projectId: string; variantId: string };
  };
  accessControls: { key: string; value: AccessControl; indexes: { projectId: string } };
}

export type CollectionName = keyof LanDesignerDB;

let dbPromise: Promise<IDBPDatabase<LanDesignerDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<LanDesignerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LanDesignerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('projects', { keyPath: '_id' });

        const variants = db.createObjectStore('variants', { keyPath: '_id' });
        variants.createIndex('projectId', 'projectId');

        const ecus = db.createObjectStore('ecus', { keyPath: '_id' });
        ecus.createIndex('projectId', 'projectId');

        const buses = db.createObjectStore('buses', { keyPath: '_id' });
        buses.createIndex('projectId', 'projectId');

        const frames = db.createObjectStore('frames', { keyPath: '_id' });
        frames.createIndex('projectId', 'projectId');
        frames.createIndex('applicationId', 'applicationId');

        const signals = db.createObjectStore('signals', { keyPath: '_id' });
        signals.createIndex('projectId', 'projectId');
        signals.createIndex('frameId', 'frameId');
        signals.createIndex('applicationId', 'applicationId');

        const versionHistories = db.createObjectStore('versionHistories', { keyPath: '_id' });
        versionHistories.createIndex('projectId', 'projectId');
        versionHistories.createIndex('targetId', 'targetId');

        const applications = db.createObjectStore('applications', { keyPath: '_id' });
        applications.createIndex('projectId', 'projectId');

        const approvals = db.createObjectStore('approvals', { keyPath: '_id' });
        approvals.createIndex('applicationId', 'applicationId');

        const gwRoutes = db.createObjectStore('gwRoutes', { keyPath: '_id' });
        gwRoutes.createIndex('projectId', 'projectId');
        gwRoutes.createIndex('frameId', 'frameId');

        const snapshots = db.createObjectStore('snapshots', { keyPath: '_id' });
        snapshots.createIndex('projectId', 'projectId');

        const changelogs = db.createObjectStore('changelogs', { keyPath: '_id' });
        changelogs.createIndex('projectId', 'projectId');

        const subsetHistories = db.createObjectStore('subsetHistories', { keyPath: '_id' });
        subsetHistories.createIndex('projectId', 'projectId');
        subsetHistories.createIndex('variantId', 'variantId');

        const accessControls = db.createObjectStore('accessControls', { keyPath: '_id' });
        accessControls.createIndex('projectId', 'projectId');
      },
    });
  }
  return dbPromise;
}

export type { LanDesignerDB };
