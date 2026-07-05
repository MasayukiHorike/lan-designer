import physicalConfigUrl from '../../samples/物理構成Excel_サンプル.xlsx?url';
import communicationDataUrl from '../../samples/通信データExcel_サンプル.xlsx?url';
import gwExceptionUrl from '../../samples/GW例外指定Excel_サンプル.xlsx?url';
import { parsePhysicalConfigWorkbook } from './excel/PhysicalConfigImportService';
import { checkPhysicalConfig } from './check/Level1CheckService';
import { importPhysicalConfig } from './LanConfigService';
import {
  advanceToNextApprover,
  buildCommunicationDataCheckContext,
  createDraftApplication,
  decideCurrentApproval,
  registerCommunicationDataFile,
  registerGwExceptionFile,
  setFirstStageApprovers,
  setSecondStageApprovers,
  submitApplication,
} from './ApplicationService';
import { confirmSnapshot } from './SnapshotService';

const SAMPLE_ECU_NAME = 'Engine';
const SAMPLE_1ST_APPROVER = 'sample-ecu-approver@example.com';
const SAMPLE_2ND_APPROVER = 'sample-lan-approver@example.com';

async function loadSampleFile(url: string, filename: string): Promise<File> {
  const blob = await fetch(url).then((r) => r.blob());
  return new File([blob], filename);
}

/**
 * samples/配下の3ファイル（物理構成・通信データ・GW例外指定）を新規プロジェクトへ
 * 一括投入し、申請書作成〜断面確定までを自動実行してpublished状態にする。
 */
export async function seedSampleData(projectId: string, actorId: string): Promise<void> {
  const physicalConfigFile = await loadSampleFile(physicalConfigUrl, '物理構成Excel_サンプル.xlsx');
  const parsedPhysicalConfig = await parsePhysicalConfigWorkbook(physicalConfigFile);
  const physicalConfigResult = checkPhysicalConfig(parsedPhysicalConfig);
  if (physicalConfigResult.status === 'error') {
    throw new Error('サンプルデータ（物理構成）のチェックでエラーが発生しました');
  }
  await importPhysicalConfig(projectId, parsedPhysicalConfig, actorId);

  let application = await createDraftApplication(projectId, SAMPLE_ECU_NAME, actorId);

  const context = await buildCommunicationDataCheckContext(projectId);

  const communicationDataFile = await loadSampleFile(communicationDataUrl, '通信データExcel_サンプル.xlsx');
  application = await registerCommunicationDataFile(application, SAMPLE_ECU_NAME, communicationDataFile, context, actorId);
  if (application.checkResults.level1.status === 'error') {
    throw new Error('サンプルデータ（通信データ）のチェックでエラーが発生しました');
  }

  const gwExceptionFile = await loadSampleFile(gwExceptionUrl, 'GW例外指定Excel_サンプル.xlsx');
  application = await registerGwExceptionFile(application, SAMPLE_ECU_NAME, gwExceptionFile, context, actorId);
  if (application.checkResults.level1.status === 'error') {
    throw new Error('サンプルデータ（GW例外指定）のチェックでエラーが発生しました');
  }

  application = await setFirstStageApprovers(application, SAMPLE_ECU_NAME, [SAMPLE_1ST_APPROVER], actorId);
  application = await setSecondStageApprovers(application, [SAMPLE_2ND_APPROVER], actorId);

  application = await submitApplication(application, actorId);

  application = await decideCurrentApproval(application, 'approved', '', actorId);
  application = await advanceToNextApprover(application, actorId);

  application = await decideCurrentApproval(application, 'approved', '', actorId);
  await advanceToNextApprover(application, actorId);

  await confirmSnapshot(projectId, 'サンプル初期断面', actorId);
}
