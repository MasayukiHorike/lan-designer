import { SnapshotRepository } from '../repositories/SnapshotRepository';
import { ChangelogRepository } from '../repositories/ChangelogRepository';
import { FrameRepository } from '../repositories/FrameRepository';
import { SignalRepository } from '../repositories/SignalRepository';
import { EcuRepository } from '../repositories/EcuRepository';
import { BusRepository } from '../repositories/BusRepository';
import { GwRouteRepository } from '../repositories/GwRouteRepository';
import { ApplicationRepository } from '../repositories/ApplicationRepository';
import { newId } from '../utils/uuid';
import { nowIso } from '../utils/dateUtils';
import type { ChangelogEntry, Ecu, Frame, Signal, Snapshot } from '../types/schema';

const snapshotRepo = new SnapshotRepository();
const changelogRepo = new ChangelogRepository();
const frameRepo = new FrameRepository();
const signalRepo = new SignalRepository();
const ecuRepo = new EcuRepository();
const busRepo = new BusRepository();
const gwRouteRepo = new GwRouteRepository();
const applicationRepo = new ApplicationRepository();

export async function hasApprovedData(projectId: string): Promise<boolean> {
  const [frames, signals, gwRoutes] = await Promise.all([
    frameRepo.findByProjectId(projectId),
    signalRepo.findByProjectId(projectId),
    gwRouteRepo.findByProjectId(projectId),
  ]);
  return [...frames, ...signals, ...gwRoutes].some((d) => d.status === 'approved');
}

function keyOf(doc: { name: string; variantNo: string }): string {
  return `${doc.name}_${doc.variantNo}`;
}

async function resolveEcuName(applicationId: string | undefined): Promise<string> {
  if (!applicationId) return '';
  const app = await applicationRepo.findById(applicationId);
  return app?.applicantEcuName ?? '';
}

async function resolveEcuId(applicationId: string | undefined, ecus: Ecu[]): Promise<string> {
  const ecuName = await resolveEcuName(applicationId);
  if (!ecuName) return '';
  return ecus.find((e) => e.name === ecuName)?._id ?? '';
}

interface DiffTarget {
  _id: string;
  name: string;
  variantNo: string;
  versionNo: string;
  applicationId: string;
}

async function diffByKey<T extends DiffTarget>(
  currentDocs: T[],
  previousDocs: T[],
  targetType: 'frame' | 'signal',
  ecus: Ecu[],
): Promise<ChangelogEntry[]> {
  const currentByKey = new Map(currentDocs.map((d) => [keyOf(d), d]));
  const previousByKey = new Map(previousDocs.map((d) => [keyOf(d), d]));
  const changes: ChangelogEntry[] = [];

  for (const [key, doc] of currentByKey) {
    const prev = previousByKey.get(key);
    if (!prev) {
      changes.push({
        type: 'added',
        targetType,
        targetId: doc._id,
        ecuId: await resolveEcuId(doc.applicationId, ecus),
        before: {},
        after: doc as unknown as Record<string, unknown>,
      });
    } else if (prev._id !== doc._id) {
      changes.push({
        type: 'modified',
        targetType,
        targetId: doc._id,
        ecuId: await resolveEcuId(doc.applicationId, ecus),
        before: prev as unknown as Record<string, unknown>,
        after: doc as unknown as Record<string, unknown>,
      });
    }
  }
  for (const [key, doc] of previousByKey) {
    if (!currentByKey.has(key)) {
      changes.push({
        type: 'deleted',
        targetType,
        targetId: doc._id,
        ecuId: await resolveEcuId(doc.applicationId, ecus),
        before: doc as unknown as Record<string, unknown>,
        after: {},
      });
    }
  }
  return changes;
}

/**
 * 断面確定：approved状態のframes/signals/gwRoutes/applicationsをpublishedへ遷移し、
 * その時点の全publishedデータをスナップショットとして永続化する（Part3 §7 Step7 / §12）。
 */
export async function confirmSnapshot(projectId: string, snapshotName: string, actorId: string): Promise<Snapshot> {
  const now = nowIso();

  const [frames, signals, gwRoutes, applications] = await Promise.all([
    frameRepo.findByProjectId(projectId),
    signalRepo.findByProjectId(projectId),
    gwRouteRepo.findByProjectId(projectId),
    applicationRepo.findByProjectId(projectId),
  ]);

  const approvedFrames = frames.filter((f) => f.status === 'approved');
  const approvedSignals = signals.filter((s) => s.status === 'approved');
  const approvedGwRoutes = gwRoutes.filter((r) => r.status === 'approved');

  await Promise.all([
    ...approvedFrames.map((f) => frameRepo.update(f._id, { status: 'published' }, actorId)),
    ...approvedSignals.map((s) => signalRepo.update(s._id, { status: 'published' }, actorId)),
    ...approvedGwRoutes.map((r) => gwRouteRepo.update(r._id, { status: 'published' }, actorId)),
  ]);

  const publishedApplicationIds = new Set(
    [...approvedFrames, ...approvedSignals, ...approvedGwRoutes].map((d) => d.applicationId),
  );
  await Promise.all(
    applications
      .filter((a) => a.status === 'approved' && publishedApplicationIds.has(a._id))
      .map((a) => applicationRepo.update(a._id, { status: 'published' }, actorId)),
  );

  const [ecus, buses, allFrames, allSignals, allGwRoutes] = await Promise.all([
    ecuRepo.findPublished(projectId),
    busRepo.findPublished(projectId),
    frameRepo.findByProjectId(projectId),
    signalRepo.findByProjectId(projectId),
    gwRouteRepo.findByProjectId(projectId),
  ]);

  const publishedFrames = allFrames.filter((f) => f.status === 'published' && !f.deleted);
  const publishedSignals = allSignals.filter((s) => s.status === 'published' && !s.deleted);
  const publishedGwRoutes = allGwRoutes.filter((r) => r.status === 'published' && !r.deleted);

  const previousSnapshot = await snapshotRepo.findLatest(projectId);
  const previousFrames = previousSnapshot
    ? (await Promise.all(previousSnapshot.frameIds.map((id) => frameRepo.findById(id)))).filter(
        (f): f is Frame => !!f,
      )
    : [];
  const previousSignals = previousSnapshot
    ? (await Promise.all(previousSnapshot.signalIds.map((id) => signalRepo.findById(id)))).filter(
        (s): s is Signal => !!s,
      )
    : [];

  const changes = [
    ...(await diffByKey(publishedFrames, previousFrames, 'frame', ecus)),
    ...(await diffByKey(publishedSignals, previousSignals, 'signal', ecus)),
  ];

  const sequenceNo = (previousSnapshot?.sequenceNo ?? 0) + 1;
  const snapshot: Snapshot = {
    _id: newId('snapshots'),
    projectId,
    sequenceNo,
    snapshotName,
    confirmedAt: now,
    confirmedBy: actorId,
    ecuIds: ecus.map((e) => e._id),
    busIds: buses.map((b) => b._id),
    frameIds: publishedFrames.map((f) => f._id),
    signalIds: publishedSignals.map((s) => s._id),
    gwRouteIds: publishedGwRoutes.map((r) => r._id),
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
    deleted: false,
  };
  await snapshotRepo.create(snapshot);

  await changelogRepo.create({
    _id: newId('changelogs'),
    projectId,
    snapshotId: snapshot._id,
    previousSnapshotId: previousSnapshot?._id ?? null,
    changes,
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
    deleted: false,
  });

  return snapshot;
}

export interface DiffViewEntry {
  type: 'added' | 'modified' | 'deleted';
  targetType: 'frame' | 'signal';
  targetId: string;
  name: string;
  ecuName: string;
  beforeVersion: string | null;
  afterVersion: string | null;
}

/** 2つの断面間の差分を、変更履歴画面（P51）表示用に計算する（保存済みchangelogsに依存せず都度計算する） */
export async function computeSnapshotDiff(fromSnapshot: Snapshot | null, toSnapshot: Snapshot): Promise<DiffViewEntry[]> {
  const [toFrames, toSignals, fromFrames, fromSignals] = await Promise.all([
    Promise.all(toSnapshot.frameIds.map((id) => frameRepo.findById(id))).then((r) => r.filter((f): f is Frame => !!f)),
    Promise.all(toSnapshot.signalIds.map((id) => signalRepo.findById(id))).then((r) => r.filter((s): s is Signal => !!s)),
    fromSnapshot
      ? Promise.all(fromSnapshot.frameIds.map((id) => frameRepo.findById(id))).then((r) => r.filter((f): f is Frame => !!f))
      : Promise.resolve([]),
    fromSnapshot
      ? Promise.all(fromSnapshot.signalIds.map((id) => signalRepo.findById(id))).then((r) => r.filter((s): s is Signal => !!s))
      : Promise.resolve([]),
  ]);

  async function diffEntries<T extends DiffTarget>(
    currentDocs: T[],
    previousDocs: T[],
    targetType: 'frame' | 'signal',
  ): Promise<DiffViewEntry[]> {
    const currentByKey = new Map(currentDocs.map((d) => [keyOf(d), d]));
    const previousByKey = new Map(previousDocs.map((d) => [keyOf(d), d]));
    const entries: DiffViewEntry[] = [];

    for (const [key, doc] of currentByKey) {
      const prev = previousByKey.get(key);
      if (!prev) {
        entries.push({
          type: 'added',
          targetType,
          targetId: doc._id,
          name: doc.name,
          ecuName: await resolveEcuName(doc.applicationId),
          beforeVersion: null,
          afterVersion: doc.versionNo,
        });
      } else if (prev._id !== doc._id) {
        entries.push({
          type: 'modified',
          targetType,
          targetId: doc._id,
          name: doc.name,
          ecuName: await resolveEcuName(doc.applicationId),
          beforeVersion: prev.versionNo,
          afterVersion: doc.versionNo,
        });
      }
    }
    for (const [key, doc] of previousByKey) {
      if (!currentByKey.has(key)) {
        entries.push({
          type: 'deleted',
          targetType,
          targetId: doc._id,
          name: doc.name,
          ecuName: await resolveEcuName(doc.applicationId),
          beforeVersion: doc.versionNo,
          afterVersion: null,
        });
      }
    }
    return entries;
  }

  return [...(await diffEntries(toFrames, fromFrames, 'frame')), ...(await diffEntries(toSignals, fromSignals, 'signal'))];
}
