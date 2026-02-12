import { get, patch } from './client';
import type { PipelineCard, PipelineStage } from '../types';
import type { PipelineCardDTO } from './types';

const rawFlag = (process.env.EXPO_PUBLIC_PIPELINES_API_ENABLED ?? '').toString().trim().toLowerCase();
const PIPELINES_API_ENABLED = ['1', 'true', 'yes', 'on'].includes(rawFlag);

let warnedDisabled = false;
let warnedUnavailable = false;

type PipelineKind = 'mixing' | 'mastering';

const toPipelineCard = (dto: PipelineCardDTO): PipelineCard => ({
  id: dto.id,
  title: dto.title,
  artist: dto.artist ?? null,
  stage: dto.stage as PipelineStage,
  kind: dto.type === 'mastering' ? 'mastering' : 'mixing',
});

export async function listPipeline(kind: PipelineKind): Promise<PipelineCard[]> {
  if (!PIPELINES_API_ENABLED) {
    if (!warnedDisabled) {
      console.info('Pipeline API deshabilitada; se devuelve lista vacia.');
      warnedDisabled = true;
    }
    return [];
  }

  try {
    const rows = await get<PipelineCardDTO[]>(`/pipelines/${kind}`);
    return rows.map(toPipelineCard);
  } catch (_error) {
    if (!warnedUnavailable) {
      console.warn('Pipeline API no disponible; se devuelve lista vacia.');
      warnedUnavailable = true;
    }
    return [];
  }
}

export async function updateStage(
  kind: PipelineKind,
  id: PipelineCard['id'],
  stage: PipelineStage
): Promise<void> {
  if (!PIPELINES_API_ENABLED) {
    if (!warnedDisabled) {
      console.info('Pipeline API deshabilitada; no se persiste el cambio de etapa.');
      warnedDisabled = true;
    }
    return;
  }

  try {
    await patch<PipelineCardDTO>(`/pipelines/${kind}/${id}`, { stage });
  } catch (_error) {
    if (!warnedUnavailable) {
      console.warn('Pipeline API no disponible; no se pudo persistir el cambio de etapa.');
      warnedUnavailable = true;
    }
  }
}
