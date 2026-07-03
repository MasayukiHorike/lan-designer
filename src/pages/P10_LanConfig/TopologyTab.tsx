import type { Bus, Ecu } from '../../types/schema';

interface Props {
  ecus: Ecu[];
  buses: Bus[];
}

export function TopologyTab({ ecus, buses }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            <th className="py-2 pr-4">ECU</th>
            {buses.map((bus) => (
              <th key={bus._id} className="whitespace-nowrap px-3 py-2">
                {bus.name}_{bus.variantNo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ecus.map((ecu) => (
            <tr key={ecu._id} className="border-b border-slate-100">
              <td className="whitespace-nowrap py-2 pr-4 font-medium">
                {ecu.name}_{ecu.variantNo}
              </td>
              {buses.map((bus) => {
                const connectorIds = ecu.connectors
                  .filter((c) => c.busConnections.some((bc) => bc.busId === bus._id))
                  .map((c) => c.connectorId);
                return (
                  <td key={bus._id} className="whitespace-nowrap px-3 py-2 text-center">
                    {connectorIds.join(', ')}
                  </td>
                );
              })}
            </tr>
          ))}
          {ecus.length === 0 && (
            <tr>
              <td colSpan={buses.length + 1} className="py-6 text-center text-slate-400">
                データがありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
