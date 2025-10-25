
import { patch } from './client';
import type { PipelineCard } from './types';

const rawFlag = (import.meta.env.VITE_PIPELINES_API_ENABLED ?? '').toString().trim().toLowerCase();
const PIPELINES_API_ENABLED = ['1', 'true', 'yes', 'on'].includes(rawFlag);

let warnedDisabled = false;
let warnedUnavailable = false;

// Hook point: when backend exposes endpoints, call them here.
// Example PATCH: /pipelines/:type/:id { stage }
export async function updateStage(card: PipelineCard, newStage: string) {
  if (!PIPELINES_API_ENABLED) {
    if (!warnedDisabled) {
      console.info('Pipeline API deshabilitada; se mantiene el estado en memoria.');
      warnedDisabled = true;
    }
    return;
  }

  try {
    await patch<void>(`/pipelines/${card.type.toLowerCase()}/${card.id}`, { stage: newStage });
  } catch (e) {
    if (!warnedUnavailable) {
      console.warn('Pipeline API no disponible todavía; se mantiene el estado en memoria.');
      warnedUnavailable = true;
    }
  }
}
