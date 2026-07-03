import type { Bus } from '../../types/schema';

interface Props {
  buses: Bus[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function BusListTab({ buses, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-xs text-slate-500">
          <th className="py-2">バス名</th>
          <th className="py-2">バリナンバー</th>
          <th className="py-2">プロトコル</th>
          <th className="py-2">baudRate</th>
          <th className="py-2">dataBaudRate</th>
          <th className="py-2">備考</th>
        </tr>
      </thead>
      <tbody>
        {buses.map((bus) => (
          <tr
            key={bus._id}
            onClick={() => onSelect(bus._id)}
            className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
              selectedId === bus._id ? 'bg-slate-100' : ''
            }`}
          >
            <td className="py-2">{bus.name}</td>
            <td className="py-2">{bus.variantNo}</td>
            <td className="py-2">{bus.protocol}</td>
            <td className="py-2">{bus.baudRate.toLocaleString()}</td>
            <td className="py-2">{bus.dataBaudRate ? bus.dataBaudRate.toLocaleString() : '-'}</td>
            <td className="py-2 text-slate-500">{bus.remarks}</td>
          </tr>
        ))}
        {buses.length === 0 && (
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
