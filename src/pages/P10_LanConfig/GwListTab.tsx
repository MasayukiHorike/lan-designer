import type { Bus, Ecu } from '../../types/schema';

interface Props {
  ecus: Ecu[];
  buses: Bus[];
}

export function GwListTab({ ecus, buses }: Props) {
  const busById = new Map(buses.map((b) => [b._id, b]));
  const gwEcus = ecus.filter((e) => e.gwBusIds.length > 0);

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-xs text-slate-500">
          <th className="py-2">GW-ECU</th>
          <th className="py-2">対応バス</th>
        </tr>
      </thead>
      <tbody>
        {gwEcus.map((ecu) => (
          <tr key={ecu._id} className="border-b border-slate-100">
            <td className="py-2 font-medium">
              {ecu.name}_{ecu.variantNo}
            </td>
            <td className="py-2">
              {ecu.gwBusIds
                .map((busId) => {
                  const bus = busById.get(busId);
                  return bus ? `${bus.name}_${bus.variantNo}` : busId;
                })
                .join(', ')}
            </td>
          </tr>
        ))}
        {gwEcus.length === 0 && (
          <tr>
            <td colSpan={2} className="py-6 text-center text-slate-400">
              データがありません
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
