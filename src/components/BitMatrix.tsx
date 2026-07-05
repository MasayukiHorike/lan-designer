import { useRef, useState } from 'react';

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
  /** ドラッグで移動可能なSignal（この申請書が持ち込んだもの等）。未指定時はドラッグ無効 */
  draggableSignalIds?: Set<string>;
  /** フレーム範囲・E2E/SecOC予約領域との重複判定（falseならドロップ不可としてプレビューを止める） */
  isPlacementValid?: (bitPosition: number, bitLength: number) => boolean;
  /** ドラッグでbitPositionが確定した時に呼ばれる（呼び出し元が保存要否を判断する） */
  onSignalMoved?: (signalId: string, newBitPosition: number) => void;
}

interface BitCell {
  kind: 'e2e' | 'secoc' | 'signal' | 'unused';
  /** このbitの表示色・クリック対象となるSignal（複数重複時は最後に処理されたもの） */
  signal: BitMatrixSignal | null;
  /** signal以外に同じbitを重複して占有しているSignal（表示上は隠れるがtooltipには列挙する） */
  conflictSignals: BitMatrixSignal[];
}

interface SignalRun {
  signal: BitMatrixSignal;
  /** 表示順（bit7→bit0）における行内開始インデックス（0〜7） */
  displayStartIdx: number;
  /** 行内で連続する長さ（bit数） */
  span: number;
}

interface DragState {
  signalId: string;
  grabOffset: number;
  candidateBitPosition: number;
}

const ROW_LABEL_WIDTH = 56; // w-14
const CELL_WIDTH = 32; // w-8
const CELL_HEIGHT = 24; // h-6

function buildBitCells(props: BitMatrixProps, overridePositions: Record<string, number>): BitCell[] {
  const total = props.dlc * 8;
  const cells: BitCell[] = Array.from({ length: total }, () => ({ kind: 'unused', signal: null, conflictSignals: [] }));

  if (props.e2eEnabled) {
    for (let b = props.e2eReservedStartBit; b < props.e2eReservedStartBit + props.e2eReservedBits && b < total; b++) {
      if (b >= 0) cells[b] = { kind: 'e2e', signal: null, conflictSignals: [] };
    }
  }
  if (props.secocEnabled) {
    for (let b = props.secocReservedStartBit; b < props.secocReservedStartBit + props.secocReservedBits && b < total; b++) {
      if (b >= 0) cells[b] = { kind: 'secoc', signal: null, conflictSignals: [] };
    }
  }
  for (const s of props.signals) {
    const bitPosition = overridePositions[s.id] ?? s.bitPosition;
    for (let b = bitPosition; b < bitPosition + s.bitLength && b < total; b++) {
      if (b < 0) continue;
      const existing = cells[b];
      if (existing.kind === 'signal' && existing.signal) {
        cells[b] = { kind: 'signal', signal: s, conflictSignals: [...existing.conflictSignals, existing.signal] };
      } else {
        cells[b] = { kind: 'signal', signal: s, conflictSignals: [] };
      }
    }
  }
  return cells;
}

/** 行内（1バイト＝8bit、bit7→bit0の表示順）でSignalが連続する区間をまとめ、ラベル描画用に返す */
function getRowSignalRuns(cells: BitCell[], byteIndex: number): SignalRun[] {
  const runs: SignalRun[] = [];
  let i = 0;
  while (i < 8) {
    const linearIndex = byteIndex * 8 + (7 - i);
    const cell = cells[linearIndex];
    if (cell.kind !== 'signal' || !cell.signal) {
      i++;
      continue;
    }
    const signal = cell.signal;
    let j = i + 1;
    while (j < 8) {
      const nextCell = cells[byteIndex * 8 + (7 - j)];
      if (nextCell.kind !== 'signal' || nextCell.signal?.id !== signal.id) break;
      j++;
    }
    runs.push({ signal, displayStartIdx: i, span: j - i });
    i = j;
  }
  return runs;
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

// SIGNAL_COLORSと同順・同数：範囲ライン・端点・ラベル文字に使う濃色（セル背景とのコントラスト用）
const SIGNAL_LINE_BG = ['bg-sky-800', 'bg-violet-800', 'bg-amber-800', 'bg-rose-800', 'bg-teal-800', 'bg-fuchsia-800', 'bg-lime-800', 'bg-orange-800'];
const SIGNAL_LINE_TEXT = ['text-sky-800', 'text-violet-800', 'text-amber-800', 'text-rose-800', 'text-teal-800', 'text-fuchsia-800', 'text-lime-800', 'text-orange-800'];

export function BitMatrix(props: BitMatrixProps) {
  const { dlc, signals, selectedSignalId, onSelectSignal, draggableSignalIds, isPlacementValid, onSignalMoved } = props;
  const total = dlc * 8;
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  if (total <= 0) return null;

  const overridePositions = dragState ? { [dragState.signalId]: dragState.candidateBitPosition } : {};
  const cells = buildBitCells(props, overridePositions);
  const colorIndexOf = (signal: BitMatrixSignal) => signals.findIndex((s) => s.id === signal.id) % SIGNAL_COLORS.length;
  const effectivePosition = (signal: BitMatrixSignal) => overridePositions[signal.id] ?? signal.bitPosition;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, linearIndex: number, signal: BitMatrixSignal) => {
    if (!draggableSignalIds?.has(signal.id)) return;
    setDragState({ signalId: signal.id, grabOffset: linearIndex - signal.bitPosition, candidateBitPosition: signal.bitPosition });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const bitAttr = el?.closest('[data-bit-index]')?.getAttribute('data-bit-index');
    if (bitAttr == null) return;
    const hoveredBit = Number(bitAttr);
    const candidate = hoveredBit - dragState.grabOffset;
    const signal = signals.find((s) => s.id === dragState.signalId);
    if (!signal) return;
    const valid = isPlacementValid ? isPlacementValid(candidate, signal.bitLength) : true;
    if (valid) {
      setDragState((prev) => (prev ? { ...prev, candidateBitPosition: candidate } : prev));
    }
  };

  const handlePointerUp = () => {
    if (!dragState) return;
    const signal = signals.find((s) => s.id === dragState.signalId);
    if (signal && dragState.candidateBitPosition !== signal.bitPosition) {
      onSignalMoved?.(dragState.signalId, dragState.candidateBitPosition);
    }
    setDragState(null);
  };

  const bitColumns = [7, 6, 5, 4, 3, 2, 1, 0];

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={gridRef}
        className="max-h-80 overflow-y-auto overflow-x-auto rounded border border-slate-300"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="inline-block">
          <div className="flex sticky top-0 z-10 bg-slate-50">
            <div className="w-14 shrink-0 border-b border-r border-slate-200" />
            {bitColumns.map((b) => (
              <div
                key={b}
                className="w-8 shrink-0 border-b border-r border-slate-200 text-center text-[10px] text-slate-400"
              >
                {b}
              </div>
            ))}
          </div>
          {Array.from({ length: dlc }, (_, byteIndex) => {
            const runs = getRowSignalRuns(cells, byteIndex);
            return (
              <div key={byteIndex} className="relative flex">
                <div className="flex w-14 shrink-0 items-center border-r border-slate-200 pl-1 text-[10px] text-slate-500">
                  Byte{byteIndex}
                </div>
                {bitColumns.map((bitInByte) => {
                  const linearIndex = byteIndex * 8 + bitInByte;
                  const cell = cells[linearIndex];
                  const conflict = cell.conflictSignals.length > 0;
                  const isDraggable = !!cell.signal && draggableSignalIds?.has(cell.signal.id);
                  const isSelected = !!cell.signal && selectedSignalId === cell.signal.id;
                  const isDragging = dragState?.signalId === cell.signal?.id;

                  const baseClass = 'h-6 w-8 shrink-0 border-b border-r border-slate-100 text-[9px]';

                  if (cell.kind === 'e2e') {
                    return (
                      <div
                        key={bitInByte}
                        data-bit-index={linearIndex}
                        title={`E2E予約領域 bit${linearIndex}`}
                        className={`${baseClass} flex items-center justify-center bg-slate-500 text-white`}
                      >
                        {bitInByte === 7 || linearIndex === props.e2eReservedStartBit ? 'E2E' : ''}
                      </div>
                    );
                  }
                  if (cell.kind === 'secoc') {
                    return (
                      <div
                        key={bitInByte}
                        data-bit-index={linearIndex}
                        title={`SecOC予約領域 bit${linearIndex}`}
                        className={`${baseClass} flex items-center justify-center bg-slate-700 text-white`}
                      >
                        {bitInByte === 7 || linearIndex === props.secocReservedStartBit ? 'SecOC' : ''}
                      </div>
                    );
                  }
                  if (cell.kind === 'signal' && cell.signal) {
                    const names = [...cell.conflictSignals, cell.signal].map((s) => s.name).join(' / ');
                    return (
                      <button
                        key={bitInByte}
                        type="button"
                        data-bit-index={linearIndex}
                        title={
                          conflict
                            ? `bit${linearIndex}：他Signalと重複（${names}）`
                            : `${cell.signal.name}：bit${effectivePosition(cell.signal)}, 長さ${cell.signal.bitLength}bit`
                        }
                        onPointerDown={(e) => handlePointerDown(e, linearIndex, cell.signal!)}
                        onClick={() => onSelectSignal?.(cell.signal!.id)}
                        className={`${baseClass} ${SIGNAL_COLORS[colorIndexOf(cell.signal)]} ${
                          isSelected ? 'ring-2 ring-inset ring-slate-900' : ''
                        } ${conflict ? 'ring-2 ring-inset ring-red-500' : ''} ${
                          isDraggable ? (isDragging ? 'cursor-grabbing opacity-70' : 'cursor-grab') : 'cursor-pointer'
                        }`}
                      />
                    );
                  }
                  return (
                    <div key={bitInByte} data-bit-index={linearIndex} title={`未使用 bit${linearIndex}`} className={`${baseClass} bg-white`} />
                  );
                })}
                {runs.map((run) => {
                  // bitPosition（開始bit）はbitInByte値が小さいほど右側の列（列見出し0側）に来るため、
                  // 開始側の端点は行内では右端、終了側の端点は左端に描画する（列見出し「7…0」の並びと整合）。
                  const startBit = effectivePosition(run.signal);
                  const endBit = startBit + run.signal.bitLength - 1;
                  const isTopmostRow = byteIndex === Math.floor(startBit / 8);
                  const isBottommostRow = byteIndex === Math.floor(endBit / 8);
                  const rightCellLinear = byteIndex * 8 + (7 - run.displayStartIdx);
                  const leftCellLinear = byteIndex * 8 + (7 - (run.displayStartIdx + run.span - 1));
                  const rightConflict = (cells[rightCellLinear]?.conflictSignals.length ?? 0) > 0;
                  const leftConflict = (cells[leftCellLinear]?.conflictSignals.length ?? 0) > 0;
                  const ink = SIGNAL_LINE_TEXT[colorIndexOf(run.signal)];
                  const lineBg = SIGNAL_LINE_BG[colorIndexOf(run.signal)];

                  return (
                    <div
                      key={`${run.signal.id}-${run.displayStartIdx}`}
                      className="pointer-events-none absolute top-0 z-10"
                      style={{ left: ROW_LABEL_WIDTH + run.displayStartIdx * CELL_WIDTH, width: run.span * CELL_WIDTH, height: CELL_HEIGHT }}
                    >
                      {run.span >= 2 && (
                        <span className={`absolute inset-x-1 top-0.5 flex justify-center truncate text-[9px] font-semibold ${ink}`}>
                          {run.signal.name}
                        </span>
                      )}
                      <span className={`absolute inset-x-1 bottom-[3px] h-[1.5px] ${lineBg}`} />
                      {/* 右端＝bitPosition（開始）側 */}
                      <span className="absolute bottom-0 right-0 flex h-2.5 w-2.5 items-center justify-center text-[9px] leading-none">
                        {rightConflict ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" title="他Signalと重複" />
                        ) : isTopmostRow ? (
                          <span className={ink}>▶</span>
                        ) : (
                          <span className="text-slate-400">⌃</span>
                        )}
                      </span>
                      {/* 左端＝終了bit側 */}
                      <span className="absolute bottom-0 left-0 flex h-2.5 w-2.5 items-center justify-center text-[9px] leading-none">
                        {leftConflict ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" title="他Signalと重複" />
                        ) : isBottommostRow ? (
                          <span className={ink}>◀</span>
                        ) : (
                          <span className="text-slate-400">⌄</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
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
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded ring-2 ring-inset ring-red-500" />
          他Signalと重複（Level2チェックで警告対象）
        </span>
      </div>
    </div>
  );
}
