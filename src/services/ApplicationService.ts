import { ApplicationRepository } from '../repositories/ApplicationRepository';
import { ApprovalRepository } from '../repositories/ApprovalRepository';
import { newId } from '../utils/uuid';
import { nowIso } from '../utils/dateUtils';
import { generateApplicationNo } from '../utils/applicationNo';
import { parseCommunicationDataWorkbook } from './excel/CommunicationDataImportService';
import {
  checkCommunicationData,
  type CommunicationDataCheckContext,
} from './check/Level1CheckService';
import { okResult, type CheckIssue, type CheckResult } from '../types/check';
import type { Application, ApplicationApprovers, ApproverEntry, ImportFile } from '../types/schema';

const applicationRepo = new ApplicationRepository();
const approvalRepo = new ApprovalRepository();

export async function issueApplicationNo(projectId: string, ecuName: string): Promise<string> {
  const dateStr = nowIso().slice(0, 10).replace(/-/g, '');
  const count = await applicationRepo.countByEcuAndDate(projectId, ecuName, dateStr);
  return generateApplicationNo(ecuName, new Date(), count + 1);
}

export async function createDraftApplication(
  projectId: string,
  applicantEcuName: string,
  actorId: string,
): Promise<Application> {
  const now = nowIso();
  const application: Application = {
    _id: newId('applications'),
    projectId,
    applicationNo: await issueApplicationNo(projectId, applicantEcuName),
    applicantEcuName,
    title: '',
    description: '',
    comment: '',
    status: 'draft',
    applicantId: actorId,
    approvers: { firstStage: [], secondStage: [] },
    firstStageTurn: 0,
    secondStageTurn: 0,
    importFiles: [],
    editHistories: [],
    checkResults: { level1: okResult(), level2: {} },
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
    deleted: false,
  };
  await applicationRepo.create(application);
  return application;
}

export async function updateBasicInfo(
  applicationId: string,
  patch: { title?: string; description?: string; comment?: string },
  actorId: string,
): Promise<Application> {
  return applicationRepo.update(applicationId, patch, actorId);
}

function pendingApprovers(emails: string[]): ApproverEntry[] {
  return emails.map((email) => ({ email, status: 'pending' }));
}

export async function setFirstStageApprovers(
  application: Application,
  ecuName: string,
  emails: string[],
  actorId: string,
): Promise<Application> {
  const firstStage = application.approvers.firstStage.filter((s) => s.ecuName !== ecuName);
  firstStage.push({ ecuName, approvers: pendingApprovers(emails) });
  return applicationRepo.update(
    application._id,
    { approvers: { ...application.approvers, firstStage } },
    actorId,
  );
}

export async function setSecondStageApprovers(
  application: Application,
  emails: string[],
  actorId: string,
): Promise<Application> {
  return applicationRepo.update(
    application._id,
    { approvers: { ...application.approvers, secondStage: pendingApprovers(emails) } },
    actorId,
  );
}

function upsertImportFile(
  importFiles: ImportFile[],
  ecuName: string,
  patch: Partial<ImportFile>,
): ImportFile[] {
  const next = [...importFiles];
  const idx = next.findIndex((f) => f.ecuName === ecuName);
  if (idx >= 0) {
    next[idx] = { ...next[idx], ...patch };
  } else {
    next.push({ ecuName, ...patch });
  }
  return next;
}

function mergeCheckResults(results: { ecuName: string; result: CheckResult }[]): CheckResult {
  const errors: CheckIssue[] = [];
  const warnings: CheckIssue[] = [];
  for (const { ecuName, result } of results) {
    for (const e of result.errors) errors.push({ ...e, message: `[${ecuName}] ${e.message}` });
    for (const w of result.warnings) warnings.push({ ...w, message: `[${ecuName}] ${w.message}` });
  }
  return {
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok',
    errors,
    warnings,
  };
}

/** 登録済み全ECUの通信データExcelを再パース・再チェックし、Level1結果を再計算する */
async function recomputeLevel1(
  application: Application,
  context: CommunicationDataCheckContext,
): Promise<CheckResult> {
  const perEcuResults: { ecuName: string; result: CheckResult }[] = [];
  for (const file of application.importFiles) {
    if (!file.communicationDataFileBlob) continue;
    const parsed = await parseCommunicationDataWorkbook(file.communicationDataFileBlob, context.ecus);
    perEcuResults.push({ ecuName: file.ecuName, result: checkCommunicationData(parsed, context) });
  }
  return mergeCheckResults(perEcuResults);
}

export async function registerCommunicationDataFile(
  application: Application,
  ecuName: string,
  file: File,
  context: CommunicationDataCheckContext,
  actorId: string,
): Promise<Application> {
  const importFiles = upsertImportFile(application.importFiles, ecuName, {
    communicationDataFileRef: newId('files'),
    communicationDataFileBlob: file,
  });
  const updated = { ...application, importFiles };
  const level1 = await recomputeLevel1(updated, context);
  return applicationRepo.update(
    application._id,
    { importFiles, checkResults: { ...application.checkResults, level1 } },
    actorId,
  );
}

export async function registerGwExceptionFile(
  application: Application,
  ecuName: string,
  file: File,
  actorId: string,
): Promise<Application> {
  const importFiles = upsertImportFile(application.importFiles, ecuName, {
    gwExceptionFileRef: newId('files'),
    gwExceptionFileBlob: file,
  });
  return applicationRepo.update(application._id, { importFiles }, actorId);
}

export async function removeFile(
  application: Application,
  ecuName: string,
  fileType: 'communicationData' | 'gwException',
  context: CommunicationDataCheckContext,
  actorId: string,
): Promise<Application> {
  const patch: Partial<ImportFile> =
    fileType === 'communicationData'
      ? { communicationDataFileRef: undefined, communicationDataFileBlob: undefined }
      : { gwExceptionFileRef: undefined, gwExceptionFileBlob: undefined };
  let importFiles = upsertImportFile(application.importFiles, ecuName, patch);
  importFiles = importFiles.filter(
    (f) => f.communicationDataFileBlob || f.gwExceptionFileBlob,
  );
  const updated = { ...application, importFiles };
  const level1 = await recomputeLevel1(updated, context);
  return applicationRepo.update(
    application._id,
    { importFiles, checkResults: { ...application.checkResults, level1 } },
    actorId,
  );
}

/** 申請提出をブロックしている理由を人が読める形で返す（空配列なら提出可能） */
export function getSubmitBlockers(application: Application): string[] {
  const blockers: string[] = [];

  const filedEcuNames = application.importFiles
    .filter((f) => f.communicationDataFileBlob || f.gwExceptionFileBlob)
    .map((f) => f.ecuName);

  if (filedEcuNames.length === 0) {
    blockers.push('通信データExcelまたはGW例外指定Excelを1件以上登録してください');
  }

  if (application.checkResults.level1.status === 'error') {
    blockers.push('Level1チェックのエラーを解消してください');
  }

  const ecusWithoutApprovers = filedEcuNames.filter((ecuName) => {
    const stage = application.approvers.firstStage.find((s) => s.ecuName === ecuName);
    return !stage || stage.approvers.length === 0;
  });
  if (ecusWithoutApprovers.length > 0) {
    blockers.push(`一次承認者（ECU承認者）が未設定です: ${ecusWithoutApprovers.join(', ')}`);
  }

  if (application.approvers.secondStage.length === 0) {
    blockers.push('二次承認者（LAN承認者）が未設定です');
  }

  return blockers;
}

export function canSubmit(application: Application): boolean {
  return getSubmitBlockers(application).length === 0;
}

export async function submitApplication(application: Application, actorId: string): Promise<Application> {
  const blockers = getSubmitBlockers(application);
  if (blockers.length > 0) {
    throw new Error(`申請提出の条件を満たしていません: ${blockers.join(' / ')}`);
  }
  return applicationRepo.update(application._id, { status: 'in_review_1st' }, actorId);
}

function resetApprovers(approvers: ApplicationApprovers): ApplicationApprovers {
  return {
    firstStage: approvers.firstStage.map((s) => ({
      ecuName: s.ecuName,
      approvers: s.approvers.map((a) => ({ email: a.email, status: 'pending' as const })),
    })),
    secondStage: approvers.secondStage.map((a) => ({ email: a.email, status: 'pending' as const })),
  };
}

export async function withdrawApplication(application: Application, actorId: string): Promise<Application> {
  if (application.applicantId !== actorId) {
    throw new Error('申請者のみ引き戻し可能です');
  }
  if (application.status !== 'in_review_1st' && application.status !== 'in_review_2nd') {
    throw new Error('回覧中の申請書のみ引き戻し可能です');
  }
  const now = nowIso();
  await approvalRepo.create({
    _id: newId('approvals'),
    applicationId: application._id,
    stage: application.status === 'in_review_1st' ? '1st' : '2nd',
    ecuName: application.applicantEcuName,
    approverId: actorId,
    action: 'withdrawn',
    comment: '',
    actionAt: now,
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
    deleted: false,
  });
  return applicationRepo.update(
    application._id,
    {
      status: 'draft',
      approvers: resetApprovers(application.approvers),
      firstStageTurn: 0,
      secondStageTurn: 0,
    },
    actorId,
  );
}

export interface ApprovalSlot {
  stage: '1st' | '2nd';
  ecuName: string;
  email: string;
}

/** 一次承認者を「ECU登録順→各ECU内の登録順」でフラットに並べた順番制回覧リスト */
export function flattenFirstStage(application: Application): ApprovalSlot[] {
  return application.approvers.firstStage.flatMap((s) =>
    s.approvers.map((a) => ({ stage: '1st' as const, ecuName: s.ecuName, email: a.email })),
  );
}

export function flattenSecondStage(application: Application): ApprovalSlot[] {
  return application.approvers.secondStage.map((a) => ({
    stage: '2nd' as const,
    ecuName: application.applicantEcuName,
    email: a.email,
  }));
}

/** 現在対応順が回ってきている承認者（順番待ちの先頭）。既に全員対応済みならnull */
export function getCurrentApprovalSlot(application: Application): ApprovalSlot | null {
  if (application.status === 'in_review_1st') {
    return flattenFirstStage(application)[application.firstStageTurn] ?? null;
  }
  if (application.status === 'in_review_2nd') {
    return flattenSecondStage(application)[application.secondStageTurn] ?? null;
  }
  return null;
}

function findApproverEntry(
  application: Application,
  slot: ApprovalSlot,
): ApproverEntry | undefined {
  if (slot.stage === '1st') {
    return application.approvers.firstStage
      .find((s) => s.ecuName === slot.ecuName)
      ?.approvers.find((a) => a.email === slot.email);
  }
  return application.approvers.secondStage.find((a) => a.email === slot.email);
}

/** 現在の対応順の承認者が既に判定済み（＝[次の承認者へ回覧]待ち）かどうか */
export function isCurrentSlotDecided(application: Application): boolean {
  const slot = getCurrentApprovalSlot(application);
  if (!slot) return false;
  const entry = findApproverEntry(application, slot);
  return entry?.status === 'approved';
}

/**
 * 現在の対応順の承認者が判定（承認・差し戻し）を行う。
 * 承認の場合はその承認者の判定を記録するのみで、次への回覧はadvanceFirstStage/advanceSecondStageで明示的に行う。
 * 差し戻しの場合は即座にdraftへ戻る（回覧不要）。
 */
export async function decideCurrentApproval(
  application: Application,
  decision: 'approved' | 'rejected',
  comment: string,
  actorId: string,
): Promise<Application> {
  const slot = getCurrentApprovalSlot(application);
  if (!slot) {
    throw new Error('現在対応可能な承認者がいません');
  }
  if (decision === 'rejected' && !comment.trim()) {
    throw new Error('差し戻し・却下時はコメントが必須です');
  }

  const now = nowIso();
  await approvalRepo.create({
    _id: newId('approvals'),
    applicationId: application._id,
    stage: slot.stage,
    ecuName: slot.ecuName,
    approverId: slot.email,
    action: decision,
    comment,
    actionAt: now,
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
    deleted: false,
  });

  if (decision === 'rejected') {
    return applicationRepo.update(
      application._id,
      {
        status: 'draft',
        approvers: resetApprovers(application.approvers),
        firstStageTurn: 0,
        secondStageTurn: 0,
      },
      actorId,
    );
  }

  const markApproved = (entry: ApproverEntry): ApproverEntry =>
    entry.email === slot.email ? { ...entry, status: 'approved' as const, actionAt: now } : entry;

  const approvers =
    slot.stage === '1st'
      ? {
          ...application.approvers,
          firstStage: application.approvers.firstStage.map((s) =>
            s.ecuName === slot.ecuName ? { ...s, approvers: s.approvers.map(markApproved) } : s,
          ),
        }
      : {
          ...application.approvers,
          secondStage: application.approvers.secondStage.map(markApproved),
        };

  return applicationRepo.update(application._id, { approvers }, actorId);
}

/**
 * [次の承認者へ回覧]ボタンの操作。現在の対応順の承認者が承認済みであることが前提。
 * 次の承認者がいればその人の順番に進み、いなければ次のステージ（または承認完了）へ遷移する。
 */
export async function advanceToNextApprover(application: Application, actorId: string): Promise<Application> {
  if (!isCurrentSlotDecided(application)) {
    throw new Error('現在の承認者がまだ判定していません');
  }

  if (application.status === 'in_review_1st') {
    const nextTurn = application.firstStageTurn + 1;
    const total = flattenFirstStage(application).length;
    return applicationRepo.update(
      application._id,
      nextTurn >= total
        ? { status: 'in_review_2nd', firstStageTurn: nextTurn, secondStageTurn: 0 }
        : { firstStageTurn: nextTurn },
      actorId,
    );
  }

  if (application.status === 'in_review_2nd') {
    const nextTurn = application.secondStageTurn + 1;
    const total = flattenSecondStage(application).length;
    return applicationRepo.update(
      application._id,
      nextTurn >= total ? { status: 'approved', secondStageTurn: nextTurn } : { secondStageTurn: nextTurn },
      actorId,
    );
  }

  throw new Error('現在回覧可能な状態ではありません');
}
