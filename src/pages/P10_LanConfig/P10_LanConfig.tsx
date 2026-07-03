import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useRole } from '../../contexts/RoleContext';
import { usePermission } from '../../hooks/usePermission';
import { EcuRepository } from '../../repositories/EcuRepository';
import { BusRepository } from '../../repositories/BusRepository';
import { parsePhysicalConfigWorkbook } from '../../services/excel/PhysicalConfigImportService';
import { checkPhysicalConfig } from '../../services/check/Level1CheckService';
import {
  deleteBus,
  deleteEcu,
  getBusReferences,
  getEcuReferences,
  importPhysicalConfig,
} from '../../services/LanConfigService';
import { ErrorList } from '../../components/ErrorList/ErrorList';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { CheckResult } from '../../types/check';
import type { Bus, Ecu } from '../../types/schema';
import { EcuListTab } from './EcuListTab';
import { BusListTab } from './BusListTab';
import { TopologyTab } from './TopologyTab';
import { GwListTab } from './GwListTab';

const TABS = [
  { key: 'ecu', label: 'ECUリスト' },
  { key: 'bus', label: 'バスリスト' },
  { key: 'topology', label: 'トポロジー' },
  { key: 'gw', label: 'GWリスト' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const ecuRepo = new EcuRepository();
const busRepo = new BusRepository();

export function P10_LanConfig() {
  const { project } = useProject();
  const { role } = useRole();
  const permission = usePermission('P10');
  const canEdit = permission === 'full';

  const [activeTab, setActiveTab] = useState<TabKey>('ecu');
  const [ecus, setEcus] = useState<Ecu[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<{ type: 'ecu' | 'bus'; id: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ references: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (!project) return;
    const [ecuList, busList] = await Promise.all([
      ecuRepo.findByProjectId(project._id),
      busRepo.findByProjectId(project._id),
    ]);
    setEcus(ecuList);
    setBuses(busList);
  }, [project]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !project || !role) return;

    setImporting(true);
    setCheckResult(null);
    try {
      const parsed = await parsePhysicalConfigWorkbook(file);
      const result = checkPhysicalConfig(parsed);
      setCheckResult(result);
      if (result.status !== 'error') {
        await importPhysicalConfig(project._id, parsed, role);
        await reload();
      }
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!selected || !project) return;
    const references =
      selected.type === 'ecu'
        ? await getEcuReferences(project._id, selected.id)
        : await getBusReferences(project._id, selected.id);
    setDeleteConfirm({ references });
  };

  const handleDeleteConfirm = async () => {
    if (!selected || !role) return;
    if (selected.type === 'ecu') {
      await deleteEcu(selected.id, role);
    } else {
      await deleteBus(selected.id, role);
    }
    setSelected(null);
    setDeleteConfirm(null);
    await reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">LAN構成管理</h1>
        <p className="text-sm text-slate-500">物理構成（ECU・バス・トポロジー・GW）の一元管理。登録は即時公開されます。</p>
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-50"
          >
            <Upload size={16} />
            {importing ? 'インポート中...' : '物理構成Excelインポート'}
          </button>
        </div>
      )}

      <ErrorList result={checkResult} />
      {checkResult && checkResult.status !== 'error' && (
        <p className="text-sm text-emerald-600">インポートが完了しました。</p>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key);
              setSelected(null);
            }}
            className={`px-4 py-2 text-sm ${
              activeTab === tab.key
                ? 'border-b-2 border-slate-800 font-medium text-slate-800'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {activeTab === 'ecu' && (
          <EcuListTab
            ecus={ecus}
            selectedId={selected?.type === 'ecu' ? selected.id : null}
            onSelect={(id) => setSelected({ type: 'ecu', id })}
          />
        )}
        {activeTab === 'bus' && (
          <BusListTab
            buses={buses}
            selectedId={selected?.type === 'bus' ? selected.id : null}
            onSelect={(id) => setSelected({ type: 'bus', id })}
          />
        )}
        {activeTab === 'topology' && <TopologyTab ecus={ecus} buses={buses} />}
        {activeTab === 'gw' && <GwListTab ecus={ecus} buses={buses} />}
      </div>

      {canEdit && (activeTab === 'ecu' || activeTab === 'bus') && (
        <div>
          <button
            type="button"
            disabled={!selected}
            onClick={handleDeleteClick}
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-40"
          >
            削除
          </button>
        </div>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="削除確認"
          message={
            deleteConfirm.references.length > 0
              ? 'このデータは他のデータから参照されています。削除してもよろしいですか？'
              : '削除してもよろしいですか？'
          }
          references={deleteConfirm.references}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
