import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useRole } from '../../contexts/RoleContext';
import { usePermission } from '../../hooks/usePermission';
import { EcuRepository } from '../../repositories/EcuRepository';
import { BusRepository } from '../../repositories/BusRepository';
import { VariantRepository } from '../../repositories/VariantRepository';
import {
  buildEcuConnectorRows,
  buildBusRows,
  buildVariantAssignment,
  createSubset,
  deleteSubset,
  getCheckedBuses,
  getCheckedEcuConnectors,
  getSubsetAssignmentSummary,
  saveSubsetAssignment,
} from '../../services/SubsetService';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PromptDialog } from '../../components/PromptDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import type { Bus, Ecu, Variant } from '../../types/schema';
import { SubsetMatrix } from './SubsetMatrix';

const ecuRepo = new EcuRepository();
const busRepo = new BusRepository();
const variantRepo = new VariantRepository();

export function P11_Subsets() {
  const { project } = useProject();
  const { role } = useRole();
  const permission = usePermission('P11');
  const canEdit = permission === 'full';

  const [variants, setVariants] = useState<Variant[]>([]);
  const [ecus, setEcus] = useState<Ecu[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [checkedEcuConn, setCheckedEcuConn] = useState<Map<string, Set<string>>>(new Map());
  const [checkedBuses, setCheckedBuses] = useState<Map<string, Set<string>>>(new Map());
  const [dirty, setDirty] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ variant: Variant; references: string[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!project) return;
    const [variantList, ecuList, busList] = await Promise.all([
      variantRepo.findByProjectId(project._id),
      ecuRepo.findPublished(project._id),
      busRepo.findPublished(project._id),
    ]);
    setVariants(variantList);
    setEcus(ecuList);
    setBuses(busList);
    setCheckedEcuConn(new Map(variantList.map((v) => [v._id, getCheckedEcuConnectors(v)])));
    setCheckedBuses(new Map(variantList.map((v) => [v._id, getCheckedBuses(v)])));
    setDirty(false);
  }, [project]);

  useEffect(() => {
    reload();
  }, [reload]);

  const ecuConnRows = useMemo(() => buildEcuConnectorRows(ecus), [ecus]);
  const busRows = useMemo(() => buildBusRows(buses), [buses]);

  const toggleEcuConn = (variantId: string, key: string) => {
    setCheckedEcuConn((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(variantId));
      if (set.has(key)) set.delete(key);
      else set.add(key);
      next.set(variantId, set);
      return next;
    });
    setDirty(true);
  };

  const toggleBus = (variantId: string, busId: string) => {
    setCheckedBuses((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(variantId));
      if (set.has(busId)) set.delete(busId);
      else set.add(busId);
      next.set(variantId, set);
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!role) return;
    setError(null);
    try {
      for (const variant of variants) {
        const { ecuConnectors, busVariantIds } = buildVariantAssignment(
          ecuConnRows,
          checkedEcuConn.get(variant._id) ?? new Set(),
          checkedBuses.get(variant._id) ?? new Set(),
        );
        await saveSubsetAssignment(variant, ecuConnectors, busVariantIds, role);
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'サブセットの保存に失敗しました');
    }
  };

  const handleAddSubset = async (values: Record<string, string>) => {
    if (!project || !role) return;
    setError(null);
    try {
      await createSubset(project._id, values.generation, values.powerTrain, role);
      setShowAddDialog(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'サブセットの追加に失敗しました');
    }
  };

  const handleDeleteClick = () => {
    const variant = variants.find((v) => v._id === selectedVariantId);
    if (!variant) return;
    setDeleteConfirm({ variant, references: getSubsetAssignmentSummary(variant) });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm || !role) return;
    setError(null);
    try {
      await deleteSubset(deleteConfirm.variant, role);
      setSelectedVariantId(null);
      setDeleteConfirm(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'サブセットの削除に失敗しました');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">サブセット管理</h1>
        <p className="text-sm text-slate-500">
          世代・パワトレ単位のサブセット定義。ECU/コネクター・バスバリの有効接続を割り当てます。登録は即時公開されます。
        </p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {canEdit && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddDialog(true)}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
          >
            サブセット追加
          </button>
          <button
            type="button"
            disabled={!selectedVariantId}
            onClick={handleDeleteClick}
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-40"
          >
            削除
          </button>
          <button
            type="button"
            disabled={!dirty}
            onClick={handleSave}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            保存
          </button>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <SubsetMatrix
          variants={variants}
          ecuConnRows={ecuConnRows}
          busRows={busRows}
          checkedEcuConn={checkedEcuConn}
          checkedBuses={checkedBuses}
          canEdit={canEdit}
          selectedVariantId={selectedVariantId}
          onToggleEcuConn={toggleEcuConn}
          onToggleBus={toggleBus}
          onSelectVariant={setSelectedVariantId}
        />
      </div>

      {showAddDialog && (
        <PromptDialog
          title="サブセット追加"
          fields={[
            { key: 'generation', label: '世代（例：Gen1）' },
            { key: 'powerTrain', label: 'パワトレ（例：HEV）' },
          ]}
          onSubmit={handleAddSubset}
          onCancel={() => setShowAddDialog(false)}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="サブセット削除確認"
          message={`サブセット「${deleteConfirm.variant.name}」を削除してもよろしいですか？`}
          references={deleteConfirm.references}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
