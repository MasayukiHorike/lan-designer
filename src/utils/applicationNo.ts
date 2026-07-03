// 申請書番号採番ルール
// APP-{申請ECU名（バリナンバーなし）}-{年月日}-{連番2桁}
// 例）APP-EngineECU-20240110-01
export function generateApplicationNo(ecuName: string, date: Date, seq: number): string {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const seqStr = String(seq).padStart(2, '0');
  return `APP-${ecuName}-${dateStr}-${seqStr}`;
}
