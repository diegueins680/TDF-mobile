import AsyncStorage from '@react-native-async-storage/async-storage';

import { get, patch } from './client';
import type { PipelineCard, PipelineStage } from '../types';
import type { PipelineCardDTO } from './types';

const rawFlag = (process.env.EXPO_PUBLIC_PIPELINES_API_ENABLED ?? '').toString().trim().toLowerCase();
const PIPELINES_API_ENABLED = ['1', 'true', 'yes', 'on'].includes(rawFlag);

let warnedDisabled = false;
let warnedUnavailable = false;

type PipelineKind = 'mixing' | 'mastering';
type StageOverrides = Record<string, PipelineStage>;

const FALLBACK_STAGE_OVERRIDES_KEY = 'tdf-mobile-pipeline-stage-overrides-v1';
const PIPELINE_STAGES: PipelineStage[] = [
  'Intake',
  'Editing',
  'Mixing',
  'Revisions',
  'Mastering',
  'Approved',
];
const STAGE_BY_LOWER = new Map<string, PipelineStage>(
  PIPELINE_STAGES.map((stage) => [stage.toLowerCase(), stage]),
);

const FALLBACK_PIPELINE_DATA: Record<PipelineKind, PipelineCard[]> = {
  mixing: [
    { id: 'mx-101', title: 'Noches del Estudio', artist: 'Sofi Vega', stage: 'Editing', kind: 'mixing' },
    { id: 'mx-102', title: 'Late Session', artist: 'Doble Filo', stage: 'Mixing', kind: 'mixing' },
    { id: 'mx-103', title: 'Voz Principal EP', artist: 'Nera', stage: 'Revisions', kind: 'mixing' },
  ],
  mastering: [
    { id: 'ms-201', title: 'Ciudad de Humo', artist: 'Marea 9', stage: 'Mastering', kind: 'mastering' },
    { id: 'ms-202', title: 'Acoustic Live Set', artist: 'A. Cornejo', stage: 'Intake', kind: 'mastering' },
    { id: 'ms-203', title: 'Tape Dreams', artist: 'Valn', stage: 'Approved', kind: 'mastering' },
  ],
};

const normalizeKind = (raw: unknown): PipelineKind => {
  if (typeof raw !== 'string') return 'mixing';
  return raw.trim().toLowerCase() === 'mastering' ? 'mastering' : 'mixing';
};

const normalizeStage = (raw: unknown): PipelineStage | undefined => {
  if (typeof raw !== 'string') return undefined;
  return STAGE_BY_LOWER.get(raw.trim().toLowerCase());
};

const toPipelineCard = (dto: PipelineCardDTO): PipelineCard => ({
  id: dto.id,
  title: dto.title,
  artist: dto.artist ?? null,
  stage: normalizeStage(dto.stage) ?? 'Intake',
  kind: normalizeKind(dto.type),
});

const overrideKey = (kind: PipelineKind, id: PipelineCard['id']): string => `${kind}:${String(id)}`;

const cloneFallbackCards = (kind: PipelineKind): PipelineCard[] =>
  FALLBACK_PIPELINE_DATA[kind].map((card) => ({ ...card }));

async function readStageOverrides(): Promise<StageOverrides> {
  try {
    const raw = await AsyncStorage.getItem(FALLBACK_STAGE_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      await AsyncStorage.removeItem(FALLBACK_STAGE_OVERRIDES_KEY);
      return {};
    }

    const next: StageOverrides = {};
    let sanitized = false;
    Object.entries(parsed).forEach(([key, value]) => {
      const cleanKey = key.trim();
      const cleanStage = normalizeStage(value);
      if (!cleanKey || !cleanStage) {
        sanitized = true;
        return;
      }
      if (cleanKey !== key || cleanStage !== value) {
        sanitized = true;
      }
      next[cleanKey] = cleanStage;
    });

    if (sanitized) {
      await writeStageOverrides(next);
    }
    return next;
  } catch {
    await AsyncStorage.removeItem(FALLBACK_STAGE_OVERRIDES_KEY);
    return {};
  }
}

async function writeStageOverrides(next: StageOverrides): Promise<void> {
  const keys = Object.keys(next);
  if (keys.length === 0) {
    await AsyncStorage.removeItem(FALLBACK_STAGE_OVERRIDES_KEY);
    return;
  }
  await AsyncStorage.setItem(FALLBACK_STAGE_OVERRIDES_KEY, JSON.stringify(next));
}

function applyStageOverrides(
  cards: PipelineCard[],
  kind: PipelineKind,
  overrides: StageOverrides
): PipelineCard[] {
  return cards.map((card) => ({
    ...card,
    stage: overrides[overrideKey(kind, card.id)] ?? card.stage,
  }));
}

async function listFallbackPipeline(kind: PipelineKind): Promise<PipelineCard[]> {
  const overrides = await readStageOverrides();
  const base = cloneFallbackCards(kind);
  return applyStageOverrides(base, kind, overrides);
}

async function persistLocalStage(
  kind: PipelineKind,
  id: PipelineCard['id'],
  stage: PipelineStage
): Promise<void> {
  const current = await readStageOverrides();
  const next: StageOverrides = { ...current, [overrideKey(kind, id)]: stage };
  await writeStageOverrides(next);
}

export async function listPipeline(kind: PipelineKind): Promise<PipelineCard[]> {
  if (!PIPELINES_API_ENABLED) {
    if (!warnedDisabled) {
      console.info('Pipeline API deshabilitada; se devuelve un tablero local editable.');
      warnedDisabled = true;
    }
    return listFallbackPipeline(kind);
  }

  try {
    const rows = await get<PipelineCardDTO[]>(`/pipelines/${kind}`);
    return rows.map(toPipelineCard);
  } catch (_error) {
    if (!warnedUnavailable) {
      console.warn('Pipeline API no disponible; se devuelve un tablero local editable.');
      warnedUnavailable = true;
    }
    return listFallbackPipeline(kind);
  }
}

export async function updateStage(
  kind: PipelineKind,
  id: PipelineCard['id'],
  stage: PipelineStage
): Promise<void> {
  if (!PIPELINES_API_ENABLED) {
    if (!warnedDisabled) {
      console.info('Pipeline API deshabilitada; se guarda el cambio de etapa localmente.');
      warnedDisabled = true;
    }
    await persistLocalStage(kind, id, stage);
    return;
  }

  try {
    await patch<PipelineCardDTO>(`/pipelines/${kind}/${id}`, { stage });
  } catch (_error) {
    if (!warnedUnavailable) {
      console.warn('Pipeline API no disponible; se guarda el cambio de etapa localmente.');
      warnedUnavailable = true;
    }
    await persistLocalStage(kind, id, stage);
  }
}
