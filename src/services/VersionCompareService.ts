import { FrameRepository } from '../repositories/FrameRepository';
import { SignalRepository } from '../repositories/SignalRepository';
import { compareVersions } from '../utils/versionUtils';
import type { Frame, Signal } from '../types/schema';

const frameRepo = new FrameRepository();
const signalRepo = new SignalRepository();

/** 直前バージョン（現在より古いバージョンの中で最新のもの）を取得する */
export async function getPreviousFrameVersion(frame: Frame): Promise<Frame | null> {
  const all = await frameRepo.findAllIncludingDeleted(frame.projectId);
  const older = all
    .filter((f) => f.name === frame.name && f.variantNo === frame.variantNo && f._id !== frame._id)
    .filter((f) => compareVersions(f.versionNo, frame.versionNo) < 0)
    .sort((a, b) => compareVersions(b.versionNo, a.versionNo));
  return older[0] ?? null;
}

export async function getPreviousSignalVersion(signal: Signal): Promise<Signal | null> {
  const all = await signalRepo.findAllIncludingDeleted(signal.projectId);
  const older = all
    .filter((s) => s.name === signal.name && s.variantNo === signal.variantNo && s._id !== signal._id)
    .filter((s) => compareVersions(s.versionNo, signal.versionNo) < 0)
    .sort((a, b) => compareVersions(b.versionNo, a.versionNo));
  return older[0] ?? null;
}
