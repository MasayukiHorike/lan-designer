import type { Ecu } from '../../types/schema';

interface Props {
  ecus: Ecu[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function EcuListTab({ ecus, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-xs text-slate-500">
          <th className="py-2">ECU名</th>
          <th className="py-2">バリナンバー</th>
          <th className="py-2">ShortName</th>
          <th className="py-2">担当部署</th>
          <th className="py-2">GW</th>
          <th className="py-2">備考</th>
        </tr>
      </thead>
      <tbody>
        {ecus.map((ecu) => (
          <tr
            key={ecu._id}
            onClick={() => onSelect(ecu._id)}
            className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
              selectedId === ecu._id ? 'bg-slate-100' : ''
            }`}
          >
            <td className="py-2">{ecu.name}</td>
            <td className="py-2">{ecu.variantNo}</td>
            <td className="py-2">{ecu.shortName}</td>
            <td className="py-2">{ecu.department}</td>
            <td className="py-2">{ecu.gwBusIds.length > 0 ? 'GW' : ''}</td>
            <td className="py-2 text-slate-500">{ecu.remarks}</td>
          </tr>
        ))}
        {ecus.length === 0 && (
          <tr>
            <td colSpan={6} className="py-6 text-center text-slate-400">
              データがありません
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
