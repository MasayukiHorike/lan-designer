interface BitMatrixSignal {
  id: string;
  name: string;
  bitPosition: number;
  bitLength: number;
}

interface BitMatrixProps {
  dlc: number;
  e2eEnabled: boolean;
  e2eReservedBits: number;
  e2eReservedStartBit: number;
  secocEnabled: boolean;
  secocReservedBits: number;
  secocReservedStartBit: number;
  signals: BitMatrixSignal[];
  selectedSignalId?: string | null;
  onSelectSignal?: (id: string) => void;
}

type Segment =
  | { kind: 'e2e'; from: number; to: number }
  | { kind: 'secoc'; from: number; to: number }
  | { kind: 'signal'; from: number; to: number; signal: BitMatrixSignal }
  | { kind: 'unused'; from: number; to: number };

function buildSegments(props: BitMatrixProps): Segment[] {
  const total = props.dlc * 8;
  const owner: (Segment['kind'] | 'signal')[] = new Array(total).fill('unused');
  const signalOf: (BitMatrixSignal | null)[] = new Array(total).fill(null);

  if (props.e2eEnabled) {
    for (let b = props.e2eReservedStartBit; b < props.e2eReservedStartBit + props.e2eReservedBits && b < total; b++) {
      owner[b] = 'e2e';
    }
  }
  if (props.secocEnabled) {
    for (let b = props.secocReservedStartBit; b < props.secocReservedStartBit + props.secocReservedBits && b < total; b++) {
      if (b >= 0) owner[b] = 'secoc';
    }
  }
  for (const s of props.signals) {
    for (let b = s.bitPosition; b < s.bitPosition + s.bitLength && b < total; b++) {
      if (b >= 0) {
        owner[b] = 'signal';
        signalOf[b] = s;
      }
    }
  }

  const segments: Segment[] = [];
  let i = 0;
  while (i < total) {
    const kind = owner[i];
    const sig = signalOf[i];
    let j = i + 1;
    while (j < total && owner[j] === kind && signalOf[j]?.id === sig?.id) j++;
    if (kind === 'signal' && sig) {
      segments.push({ kind: 'signal', from: i, to: j, signal: sig });
    } else if (kind === 'e2e') {
      segments.push({ kind: 'e2e', from: i, to: j });
    } else if (kind === 'secoc') {
      segments.push({ kind: 'secoc', from: i, to: j });
    } else {
      segments.push({ kind: 'unused', from: i, to: j });
    }
    i = j;
  }
  return segments;
}

const SIGNAL_COLORS = [
  'bg-sky-300',
  'bg-violet-300',
  'bg-amber-300',
  'bg-rose-300',
  'bg-teal-300',
  'bg-fuchsia-300',
  'bg-lime-300',
  'bg-orange-300',
];

export function BitMatrix(props: BitMatrixProps) {
  const total = props.dlc * 8;
  if (total <= 0) return null;
  const segments = buildSegments(props);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-8 w-full overflow-hidden rounded border border-slate-300">
        {segments.map((seg, idx) => {
          const width = `${((seg.to - seg.from) / total) * 100}%`;
          if (seg.kind === 'e2e') {
            return (
              <div
                key={idx}
                title={`E2E予約領域 bit${seg.from}-${seg.to - 1}`}
                style={{ width }}
                className="flex items-center justify-center border-r border-white bg-slate-500 text-[10px] text-white"
              >
                E2E
              </div>
            );
          }
          if (seg.kind === 'secoc') {
            return (
              <div
                key={idx}
                title={`SecOC予約領域 bit${seg.from}-${seg.to - 1}`}
                style={{ width }}
                className="flex items-center justify-center border-r border-white bg-slate-700 text-[10px] text-white"
              >
                SecOC
              </div>
            );
          }
          if (seg.kind === 'signal') {
            const colorIdx =
              props.signals.findIndex((s) => s.id === seg.signal.id) % SIGNAL_COLORS.length;
            const isSelected = props.selectedSignalId === seg.signal.id;
            return (
              <button
                key={idx}
                type="button"
                title={`${seg.signal.name}：bit${seg.signal.bitPosition}, 長さ${seg.signal.bitLength}bit`}
                style={{ width }}
                onClick={() => props.onSelectSignal?.(seg.signal.id)}
                className={`flex items-center justify-center overflow-hidden truncate border-r border-white text-[10px] text-slate-800 ${SIGNAL_COLORS[colorIdx]} ${
                  isSelected ? 'ring-2 ring-inset ring-slate-900' : ''
                }`}
              >
                {seg.to - seg.from >= 4 ? seg.signal.name : ''}
              </button>
            );
          }
          return (
            <div
              key={idx}
              title={`未使用 bit${seg.from}-${seg.to - 1}`}
              style={{ width }}
              className="border-r border-slate-100 bg-white"
            />
          );
        })}
      </div>
      <div className="flex gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-slate-500" />
          E2E予約領域
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-slate-700" />
          SecOC予約領域
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-slate-300 bg-white" />
          未使用
        </span>
      </div>
    </div>
  );
}
