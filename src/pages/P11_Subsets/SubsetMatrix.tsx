import type { Variant } from '../../types/schema';
import type { BusRow, EcuConnectorRow } from '../../services/SubsetService';

interface Props {
  variants: Variant[];
  ecuConnRows: EcuConnectorRow[];
  busRows: BusRow[];
  checkedEcuConn: Map<string, Set<string>>;
  checkedBuses: Map<string, Set<string>>;
  canEdit: boolean;
  selectedVariantId: string | null;
  onToggleEcuConn: (variantId: string, key: string) => void;
  onToggleBus: (variantId: string, busId: string) => void;
  onSelectVariant: (variantId: string) => void;
}

export function SubsetMatrix({
  variants,
  ecuConnRows,
  busRows,
  checkedEcuConn,
  checkedBuses,
  canEdit,
  selectedVariantId,
  onToggleEcuConn,
  onToggleBus,
  onSelectVariant,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            <th className="py-2 pr-4"></th>
            {variants.map((v) => (
              <th key={v._id} className="whitespace-nowrap px-3 py-2 text-center">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onSelectVariant(v._id)}
                  className={`rounded px-2 py-1 ${
                    selectedVariantId === v._id ? 'bg-slate-800 text-white' : 'hover:bg-slate-100'
                  }`}
                >
                  {v.name}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={variants.length + 1} className="pt-3 pb-1 text-xs font-semibold text-slate-500">
              【ECU/コネクター】
            </td>
          </tr>
          {ecuConnRows.map((row) => {
            const key = `${row.ecuId}:${row.connectorId}`;
            return (
              <tr key={key} className="border-b border-slate-100">
                <td className="whitespace-nowrap py-1.5 pr-4">{row.label}</td>
                {variants.map((v) => (
                  <td key={v._id} className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={checkedEcuConn.get(v._id)?.has(key) ?? false}
                      onChange={() => onToggleEcuConn(v._id, key)}
                    />
                  </td>
                ))}
              </tr>
            );
          })}

          <tr>
            <td colSpan={variants.length + 1} className="pt-3 pb-1 text-xs font-semibold text-slate-500">
              【バスバリ】
            </td>
          </tr>
          {busRows.map((row) => (
            <tr key={row.busId} className="border-b border-slate-100">
              <td className="whitespace-nowrap py-1.5 pr-4">{row.label}</td>
              {variants.map((v) => (
                <td key={v._id} className="px-3 py-1.5 text-center">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={checkedBuses.get(v._id)?.has(row.busId) ?? false}
                    onChange={() => onToggleBus(v._id, row.busId)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
