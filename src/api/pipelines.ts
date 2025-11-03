import { get, patch } from './client';
import type { PipelineCardDTO } from './types';
import { fromPipelineCardDTO } from './types';
import type { PipelineCard, PipelineKind, PipelineStage } from '../types';

const rawFlag = (process.env.EXPO_PUBLIC_PIPELINES_API_ENABLED ?? '').toString().trim().toLowerCase();
const PIPELINES_API_ENABLED = ['1', 'true', 'yes', 'on'].includes(rawFlag);

let warnedDisabled = false;
let warnedUnavailable = false;

export async function listPipeline(kind: PipelineKind): Promise<PipelineCard[]> {
  const data = await get<PipelineCardDTO[]>(`/pipelines/${kind}`);
  return data.map(fromPipelineCardDTO);
}

export async function updateStage(kind: PipelineKind, id: PipelineCard['id'], stage: PipelineStage): Promise<void> {
  if (!PIPELINES_API_ENABLED) {
    if (!warnedDisabled) {
      console.info('Pipeline API deshabilitada; se mantiene el estado en memoria.');
      warnedDisabled = true;
    }
    return;
  }

  try {
    await patch<void>(`/pipelines/${kind}/${id}`, { stage });
  } catch (error) {
    if (!warnedUnavailable) {
      console.warn('Pipeline API no disponible todavía; se mantiene el estado en memoria.');
      warnedUnavailable = true;
    }
  }
}
