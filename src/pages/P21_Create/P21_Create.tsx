import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { useRole } from '../../contexts/RoleContext';
import { EcuRepository } from '../../repositories/EcuRepository';
import { BusRepository } from '../../repositories/BusRepository';
import { ApplicationRepository } from '../../repositories/ApplicationRepository';
import {
  createDraftApplication,
  getSubmitBlockers,
  registerCommunicationDataFile,
  registerGwExceptionFile,
  removeFile,
  setFirstStageApprovers,
  setSecondStageApprovers,
  submitApplication,
  updateBasicInfo,
} from '../../services/ApplicationService';
import { EmailListInput } from '../../components/EmailListInput';
import { ErrorList } from '../../components/ErrorList/ErrorList';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Level2Results } from '../../components/Level2Results';
import type { Application, Ecu } from '../../types/schema';
import type { CommunicationDataCheckContext } from '../../services/check/Level1CheckService';

const ecuRepo = new EcuRepository();
const busRepo = new BusRepository();
const applicationRepo = new ApplicationRepository();

function activeEcuNamesOf(application: Application): string[] {
  return [
    ...new Set([
      ...application.importFiles.map((f) => f.ecuName),
      ...application.approvers.firstStage.map((s) => s.ecuName),
    ]),
  ];
}

export function P21_Create() {
  const { id } = useParams<{ id: string }>();
  const { project } = useProject();
  const { role } = useRole();
  const navigate = useNavigate();

  const [ecus, setEcus] = useState<Ecu[]>([]);
  const [applicantEcuName, setApplicantEcuName] = useState('');
  const [application, setApplication] = useState<Application | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(!!id);
  const [activeEcuNames, setActiveEcuNames] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    ecuRepo.findPublished(project._id).then((list) => {
      setEcus(list);
      if (list.length > 0) setApplicantEcuName(list[0].name);
    });
  }, [project]);

  useEffect(() => {
    if (!id) return;
    applicationRepo.findById(`applications/${id}`).then((app) => {
      if (app) {
        setApplication(app);
        setActiveEcuNames(activeEcuNamesOf(app));
      }
      setLoadingExisting(false);
    });
  }, [id]);

  const ecuNames = useMemo(() => [...new Set(ecus.map((e) => e.name))], [ecus]);

  const buildContext = async (): Promise<CommunicationDataCheckContext> => {
    if (!project) throw new Error('project not ready');
    const [allEcus, allBuses] = await Promise.all([
      ecuRepo.findPublished(project._id),
      busRepo.findPublished(project._id),
    ]);
    return { existingFrames: [], existingSignals: [], ecus: allEcus, buses: allBuses };
  };

  const handleStart = async () => {
    if (!project || !role || !applicantEcuName) return;
    const app = await createDraftApplication(project._id, applicantEcuName, role);
    setApplication(app);
  };

  const handleBasicInfoBlur = async (field: 'title' | 'description' | 'comment', value: string) => {
    if (!application || !role) return;
    const updated = await updateBasicInfo(application._id, { [field]: value }, role);
    setApplication(updated);
  };

  const handleAddEcuSection = (ecuName: string) => {
    if (!activeEcuNames.includes(ecuName)) {
      setActiveEcuNames([...activeEcuNames, ecuName]);
    }
  };

  const handleFileChange = async (
    ecuName: string,
    fileType: 'communicationData' | 'gwException',
    file: File | undefined,
  ) => {
    if (!application || !role || !file) return;
    setError(null);
    try {
      const context = await buildContext();
      const updated =
        fileType === 'communicationData'
          ? await registerCommunicationDataFile(application, ecuName, file, context, role)
          : await registerGwExceptionFile(application, ecuName, file, context, role);
      setApplication(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ファイルの登録に失敗しました');
    }
  };

  const handleRemoveFile = async (ecuName: string, fileType: 'communicationData' | 'gwException') => {
    if (!application || !role) return;
    setError(null);
    try {
      const context = await buildContext();
      const updated = await removeFile(application, ecuName, fileType, context, role);
      setApplication(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ファイルの削除に失敗しました');
    }
  };

  const handleFirstStageChange = async (ecuName: string, emails: string[]) => {
    if (!application || !role) return;
    const updated = await setFirstStageApprovers(application, ecuName, emails, role);
    setApplication(updated);
  };

  const handleSecondStageChange = async (emails: string[]) => {
    if (!application || !role) return;
    const updated = await setSecondStageApprovers(application, emails, role);
    setApplication(updated);
  };

  const handleSubmit = async () => {
    if (!application || !role) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitApplication(application, role);
      navigate(`/applications/${application._id.split('/')[1]}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '申請提出に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingExisting) {
    return <p className="text-slate-400">読み込み中...</p>;
  }

  if (id && application && application.status !== 'draft') {
    navigate(`/applications/${id}`, { replace: true });
    return null;
  }

  if (!application) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <h1 className="text-2xl font-bold text-slate-800">申請書作成</h1>
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          申請ECU
          <select
            value={applicantEcuName}
            onChange={(e) => setApplicantEcuName(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {ecuNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!applicantEcuName}
          onClick={handleStart}
          className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-40"
        >
          作成開始
        </button>
      </div>
    );
  }

  const submitBlockers = getSubmitBlockers(application);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">申請書作成</h1>
        <p className="text-sm text-slate-500">申請書番号：{application.applicationNo}</p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        件名
        <input
          type="text"
          defaultValue={application.title}
          onBlur={(e) => handleBasicInfoBlur('title', e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-600">
        変更概要
        <textarea
          defaultValue={application.description}
          onBlur={(e) => handleBasicInfoBlur('description', e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          rows={2}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-600">
        コメント
        <textarea
          defaultValue={application.comment}
          onBlur={(e) => handleBasicInfoBlur('comment', e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          rows={2}
        />
      </label>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">ファイル登録</h2>
          <select
            value=""
            onChange={(e) => e.target.value && handleAddEcuSection(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">ECUを追加 ▼</option>
            {ecuNames
              .filter((name) => !activeEcuNames.includes(name))
              .map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
          </select>
        </div>

        {activeEcuNames.map((ecuName) => {
          const fileEntry = application.importFiles.find((f) => f.ecuName === ecuName);
          const firstStage = application.approvers.firstStage.find((s) => s.ecuName === ecuName);
          return (
            <div key={ecuName} className="flex flex-col gap-2 rounded border border-slate-100 p-3">
              <h3 className="text-sm font-semibold text-slate-800">{ecuName}</h3>

              <div className="flex items-center gap-2 text-sm">
                <span className="w-40 text-slate-500">通信データExcel（任意）</span>
                {fileEntry?.communicationDataFileRef ? (
                  <span className="flex items-center gap-2">
                    登録済み
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(ecuName, 'communicationData')}
                      className="text-xs text-red-600 hover:underline"
                    >
                      削除
                    </button>
                  </span>
                ) : (
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileChange(ecuName, 'communicationData', e.target.files?.[0])}
                    className="text-sm"
                  />
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="w-40 text-slate-500">GW例外指定Excel（任意）</span>
                {fileEntry?.gwExceptionFileRef ? (
                  <span className="flex items-center gap-2">
                    登録済み
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(ecuName, 'gwException')}
                      className="text-xs text-red-600 hover:underline"
                    >
                      削除
                    </button>
                  </span>
                ) : (
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileChange(ecuName, 'gwException', e.target.files?.[0])}
                    className="text-sm"
                  />
                )}
              </div>

              <div className="text-sm text-slate-600">
                一次承認者（ECU承認者）
                <EmailListInput
                  emails={firstStage?.approvers.map((a) => a.email) ?? []}
                  onChange={(emails) => handleFirstStageChange(ecuName, emails)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">二次承認者（LAN承認者）※申請書単位</h2>
        <EmailListInput
          emails={application.approvers.secondStage.map((a) => a.email)}
          onChange={handleSecondStageChange}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">チェック結果</h2>
        <p className="text-sm">
          Level1：{application.checkResults.level1.status === 'ok' ? '○ エラーなし' : '✗ エラーあり'}
        </p>
        <ErrorList result={application.checkResults.level1} />
        <div className="mt-2">
          <Level2Results level2={application.checkResults.level2} />
        </div>
      </div>

      {submitBlockers.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <p className="font-medium">申請提出にはあと以下が必要です：</p>
          <ul className="ml-4 list-disc">
            {submitBlockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => navigate(`/applications/${application._id.split('/')[1]}`)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          一時保存
        </button>
        <button
          type="button"
          disabled={submitBlockers.length > 0 || submitting}
          onClick={handleSubmit}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          申請提出
        </button>
      </div>
    </div>
  );
}
