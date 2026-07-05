import { useEffect, useState } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { SnapshotRepository } from '../../repositories/SnapshotRepository';
import { VariantRepository } from '../../repositories/VariantRepository';
import { ApplicationRepository } from '../../repositories/ApplicationRepository';
import { EcuRepository } from '../../repositories/EcuRepository';
import { FrameRepository } from '../../repositories/FrameRepository';
import { exportCommunicationMatrix } from '../../services/export/CommunicationMatrixExportService';
import { exportChangelog } from '../../services/export/ChangelogExportService';
import { exportCheckReport } from '../../services/export/CheckReportExportService';
import { exportImportTemplate } from '../../services/export/ImportTemplateExportService';
import type { Application, Ecu, Frame, Snapshot, Variant } from '../../types/schema';

const snapshotRepo = new SnapshotRepository();
const variantRepo = new VariantRepository();
const applicationRepo = new ApplicationRepository();
const ecuRepo = new EcuRepository();
const frameRepo = new FrameRepository();

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function toggleInArray(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function P60_Export() {
  const { project } = useProject();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [ecus, setEcus] = useState<Ecu[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);

  useEffect(() => {
    if (!project) return;
    snapshotRepo.findByProjectId(project._id).then(setSnapshots);
    variantRepo.findByProjectId(project._id).then(setVariants);
    applicationRepo.findByProjectId(project._id).then(setApplications);
    ecuRepo.findByProjectId(project._id).then(setEcus);
    frameRepo.findByProjectId(project._id).then((list) => setFrames(list.filter((f) => f.nextVersionId === null)));
  }, [project]);

  // ① 全体通信マトリクスExcel出力
  const [matrixSnapshotId, setMatrixSnapshotId] = useState('');
  const [matrixVariantIds, setMatrixVariantIds] = useState<string[]>([]);
  useEffect(() => {
    if (snapshots.length > 0 && !matrixSnapshotId) setMatrixSnapshotId(snapshots[0]._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshots]);

  const handleExportMatrix = async () => {
    if (!project || !matrixSnapshotId || matrixVariantIds.length === 0) return;
    await exportCommunicationMatrix(project._id, matrixSnapshotId, matrixVariantIds);
  };

  // ② 変更履歴Excel出力
  const [changelogFromId, setChangelogFromId] = useState('');
  const [changelogToId, setChangelogToId] = useState('');
  const [changelogEcuNames, setChangelogEcuNames] = useState<string[]>([]);
  useEffect(() => {
    if (snapshots.length > 0 && !changelogToId) {
      setChangelogToId(snapshots[0]._id);
      const prev = snapshots.find((s) => s.sequenceNo === snapshots[0].sequenceNo - 1);
      setChangelogFromId(prev?._id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshots]);

  const handleExportChangelog = async () => {
    if (!changelogToId) return;
    await exportChangelog(changelogFromId || null, changelogToId, changelogEcuNames.length > 0 ? changelogEcuNames : undefined);
  };

  // ③ エラーチェック結果レポート出力
  const [reportApplicationId, setReportApplicationId] = useState('');
  const [reportLevels, setReportLevels] = useState<'level1' | 'level2' | 'both'>('both');

  const handleExportReport = () => {
    const app = applications.find((a) => a._id === reportApplicationId);
    if (!app) return;
    exportCheckReport(app, reportLevels === 'level1' || reportLevels === 'both', reportLevels === 'level2' || reportLevels === 'both');
  };

  // ④ インポート雛形Excel出力
  const [templateEcuIds, setTemplateEcuIds] = useState<string[]>([]);
  const [templateFrameId, setTemplateFrameId] = useState('');
  const [templateVariantIds, setTemplateVariantIds] = useState<string[]>([]);

  const handleExportTemplate = async () => {
    if (!project || templateEcuIds.length === 0) return;
    await exportImportTemplate(project._id, templateEcuIds, templateFrameId || undefined, templateVariantIds);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">出力</h1>
        <p className="text-sm text-slate-500">各種Excelファイルをダウンロードします。</p>
      </div>

      <Section title="全体通信マトリクスExcel出力">
        <label className="flex items-center gap-2 text-sm">
          断面選択：
          <select value={matrixSnapshotId} onChange={(e) => setMatrixSnapshotId(e.target.value)} className="rounded border border-slate-300 px-2 py-1">
            {snapshots.map((s) => (
              <option key={s._id} value={s._id}>
                {s.snapshotName}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm">
          <p className="mb-1 text-slate-600">サブセット選択（複数可・選択サブセット毎にシート生成）：</p>
          <div className="flex flex-wrap gap-3">
            {variants.map((v) => (
              <label key={v._id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={matrixVariantIds.includes(v._id)}
                  onChange={() => setMatrixVariantIds(toggleInArray(matrixVariantIds, v._id))}
                />
                {v.name}
              </label>
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={!matrixSnapshotId || matrixVariantIds.length === 0}
          onClick={handleExportMatrix}
          className="w-fit rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-40"
        >
          出力
        </button>
      </Section>

      <Section title="変更履歴Excel出力">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            比較元：
            <select value={changelogFromId} onChange={(e) => setChangelogFromId(e.target.value)} className="rounded border border-slate-300 px-2 py-1">
              <option value="">（なし・初回として比較）</option>
              {snapshots.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.snapshotName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            比較先：
            <select value={changelogToId} onChange={(e) => setChangelogToId(e.target.value)} className="rounded border border-slate-300 px-2 py-1">
              {snapshots.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.snapshotName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="text-sm">
          <p className="mb-1 text-slate-600">ECU選択（複数可・任意）：</p>
          <div className="flex flex-wrap gap-3">
            {[...new Set(ecus.map((e) => e.name))].map((name) => (
              <label key={name} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={changelogEcuNames.includes(name)}
                  onChange={() => setChangelogEcuNames(toggleInArray(changelogEcuNames, name))}
                />
                {name}
              </label>
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={!changelogToId}
          onClick={handleExportChangelog}
          className="w-fit rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-40"
        >
          出力
        </button>
      </Section>

      <Section title="エラーチェック結果レポート出力">
        <label className="flex items-center gap-2 text-sm">
          申請書選択：
          <select value={reportApplicationId} onChange={(e) => setReportApplicationId(e.target.value)} className="rounded border border-slate-300 px-2 py-1">
            <option value="">選択してください</option>
            {applications.map((a) => (
              <option key={a._id} value={a._id}>
                {a.applicationNo}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1 text-sm">
          {(['level1', 'level2', 'both'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setReportLevels(v)}
              className={`rounded border px-2 py-1 ${
                reportLevels === v ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 text-slate-600'
              }`}
            >
              {v === 'level1' ? 'Level1' : v === 'level2' ? 'Level2' : '両方'}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!reportApplicationId}
          onClick={handleExportReport}
          className="w-fit rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-40"
        >
          出力
        </button>
      </Section>

      <Section title="インポート雛形Excel出力">
        <div className="text-sm">
          <p className="mb-1 text-slate-600">ECU選択（複数可・必須）：</p>
          <div className="flex flex-wrap gap-3">
            {ecus.map((e) => (
              <label key={e._id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={templateEcuIds.includes(e._id)}
                  onChange={() => setTemplateEcuIds(toggleInArray(templateEcuIds, e._id))}
                />
                {e.name}_{e.variantNo}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          フレーム選択（任意・既存データをひな型として書き出す）：
          <select value={templateFrameId} onChange={(e) => setTemplateFrameId(e.target.value)} className="rounded border border-slate-300 px-2 py-1">
            <option value="">（指定なし・空のひな型）</option>
            {frames.map((f) => (
              <option key={f._id} value={f._id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm">
          <p className="mb-1 text-slate-600">サブセット選択（複数可・任意・有効なコネクターのみに絞り込む）：</p>
          <div className="flex flex-wrap gap-3">
            {variants.map((v) => (
              <label key={v._id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={templateVariantIds.includes(v._id)}
                  onChange={() => setTemplateVariantIds(toggleInArray(templateVariantIds, v._id))}
                />
                {v.name}
              </label>
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={templateEcuIds.length === 0}
          onClick={handleExportTemplate}
          className="w-fit rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-40"
        >
          出力
        </button>
      </Section>
    </div>
  );
}
