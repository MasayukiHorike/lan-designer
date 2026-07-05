import { FrameRepository } from '../repositories/FrameRepository';
import { SignalRepository } from '../repositories/SignalRepository';
import type { Frame, Signal } from '../types/schema';

const frameRepo = new FrameRepository();
const signalRepo = new SignalRepository();

/** 直前バージョン（このFrameが置き換えた旧バージョン）を取得する */
export async function getPreviousFrameVersion(frame: Frame): Promise<Frame | null> {
  if (!frame.previousVersionId) return null;
  return (await frameRepo.findById(frame.previousVersionId)) ?? null;
}

export async function getPreviousSignalVersion(signal: Signal): Promise<Signal | null> {
  if (!signal.previousVersionId) return null;
  return (await signalRepo.findById(signal.previousVersionId)) ?? null;
}
