import { ProjectRepository } from '../repositories/ProjectRepository';
import { VariantRepository } from '../repositories/VariantRepository';
import { EcuRepository } from '../repositories/EcuRepository';
import { BusRepository } from '../repositories/BusRepository';
import { FrameRepository } from '../repositories/FrameRepository';
import { SignalRepository } from '../repositories/SignalRepository';
import { VersionHistoryRepository } from '../repositories/VersionHistoryRepository';
import { ApplicationRepository } from '../repositories/ApplicationRepository';
import { ApprovalRepository } from '../repositories/ApprovalRepository';
import { GwRouteRepository } from '../repositories/GwRouteRepository';
import { SnapshotRepository } from '../repositories/SnapshotRepository';
import { ChangelogRepository } from '../repositories/ChangelogRepository';
import { SubsetHistoryRepository } from '../repositories/SubsetHistoryRepository';
import { AccessControlRepository } from '../repositories/AccessControlRepository';
import { newId } from '../utils/uuid';
import { nowIso } from '../utils/dateUtils';
import type { Project } from '../types/schema';

const projectRepo = new ProjectRepository();
const variantRepo = new VariantRepository();
const ecuRepo = new EcuRepository();
const busRepo = new BusRepository();
const frameRepo = new FrameRepository();
const signalRepo = new SignalRepository();
const versionHistoryRepo = new VersionHistoryRepository();
const applicationRepo = new ApplicationRepository();
const approvalRepo = new ApprovalRepository();
const gwRouteRepo = new GwRouteRepository();
const snapshotRepo = new SnapshotRepository();
const changelogRepo = new ChangelogRepository();
const subsetHistoryRepo = new SubsetHistoryRepository();
const accessControlRepo = new AccessControlRepository();

export async function createProject(name: string, themeColor: string, actorId: string): Promise<Project> {
  const now = nowIso();
  const project: Project = {
    _id: newId('projects'),
    name,
    description: '',
    status: 'active',
    themeColor,
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
    deleted: false,
  };
  return projectRepo.create(project);
}

/**
 * プロジェクトに紐づく全コレクションのレコードを物理削除する（projectsレコード自体は残す）。
 * approvalsはprojectIdを持たないため、applications経由で辿って削除する。
 */
async function cascadeDeleteProjectData(projectId: string): Promise<void> {
  const applications = await applicationRepo.findAllIncludingDeleted(projectId);
  await Promise.all(applications.map((a) => approvalRepo.hardDeleteByApplicationId(a._id)));

  await Promise.all([
    variantRepo.deleteAllByProjectId(projectId),
    ecuRepo.deleteAllByProjectId(projectId),
    busRepo.deleteAllByProjectId(projectId),
    frameRepo.deleteAllByProjectId(projectId),
    signalRepo.deleteAllByProjectId(projectId),
    versionHistoryRepo.deleteAllByProjectId(projectId),
    applicationRepo.deleteAllByProjectId(projectId),
    gwRouteRepo.deleteAllByProjectId(projectId),
    snapshotRepo.deleteAllByProjectId(projectId),
    changelogRepo.deleteAllByProjectId(projectId),
    subsetHistoryRepo.deleteAllByProjectId(projectId),
    accessControlRepo.deleteAllByProjectId(projectId),
  ]);
}

/** プロジェクトのデータを全て消去する（projectsレコード自体は保持） */
export async function resetProject(projectId: string): Promise<void> {
  await cascadeDeleteProjectData(projectId);
}

/** プロジェクトとその配下データを全て削除する（projectsレコード自体も削除） */
export async function deleteProject(projectId: string): Promise<void> {
  await cascadeDeleteProjectData(projectId);
  await projectRepo.hardDelete(projectId);
}
