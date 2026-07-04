// バージョンNo（メジャー-マイナー形式。例: "00-a", "01-b"）のパース・比較
const VERSION_PATTERN = /^(\d+)-([a-z]+)$/;

export function isValidVersionFormat(versionNo: string): boolean {
  return VERSION_PATTERN.test(versionNo);
}

/** v1 > v2 なら正、v1 < v2 なら負、等しければ0。不正な形式はエラーを投げる */
export function compareVersions(v1: string, v2: string): number {
  const m1 = VERSION_PATTERN.exec(v1);
  const m2 = VERSION_PATTERN.exec(v2);
  if (!m1 || !m2) {
    throw new Error(`不正なバージョン形式です: ${v1} / ${v2}`);
  }
  const major1 = Number(m1[1]);
  const major2 = Number(m2[1]);
  if (major1 !== major2) return major1 - major2;
  return m1[2] < m2[2] ? -1 : m1[2] > m2[2] ? 1 : 0;
}
