import AsyncStorage from '@react-native-async-storage/async-storage';

import { get, patch } from './client';
import type {
  PipelineCard,
  PipelineDefinition,
  PipelineStage,
} from '../types';
import type {
  PipelineCardDTO,
  PipelineDefinitionDTO,
  PipelineSnapshotDTO,
} from './types';

const SNAPSHOT_SCHEMA_VERSION = 1 as const;
const SNAPSHOT_KEY = 'tdf-mobile-pipeline-snapshot-v1';

export interface PipelineSnapshot {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  revision: number;
  source: 'network';
  syncedAt: string;
  definitions: PipelineDefinition[];
  cards: Record<string, PipelineCard[]>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const toStage = (value: unknown): PipelineStage | null => {
  if (!isRecord(value) || !hasText(value.id) || !hasText(value.code)
    || !hasText(value.nameEs) || !hasText(value.nameEn)
    || typeof value.sortOrder !== 'number' || typeof value.terminal !== 'boolean') return null;
  return {
    id: value.id,
    code: value.code,
    nameEs: value.nameEs,
    nameEn: value.nameEn,
    sortOrder: value.sortOrder,
    terminal: value.terminal,
  };
};

const toDefinition = (dto: PipelineDefinitionDTO): PipelineDefinition | null => {
  const stages = dto.stages.map(toStage);
  if (!hasText(dto.workflowId) || !hasText(dto.code) || !hasText(dto.nameEs)
    || !hasText(dto.nameEn) || stages.some((stage) => stage === null)
    || dto.serviceOfferings.some((service) => !hasText(service.id) || !hasText(service.code)
      || !hasText(service.nameEs) || !hasText(service.nameEn))) return null;
  return {
    workflowId: dto.workflowId,
    code: dto.code,
    nameEs: dto.nameEs,
    nameEn: dto.nameEn,
    revision: dto.revision,
    serviceOfferings: dto.serviceOfferings,
    stages: stages as PipelineStage[],
  };
};

const toCard = (dto: PipelineCardDTO, definition: PipelineDefinition): PipelineCard | null => {
  const stage = definition.stages.find((item) => item.id === dto.workflowStateId);
  const service = definition.serviceOfferings.find((item) => item.id === dto.serviceOfferingId);
  if (!stage || !service || dto.workflowId !== definition.workflowId
    || !hasText(dto.id) || !hasText(dto.title)) return null;
  return {
    id: dto.id,
    title: dto.title,
    artist: dto.artist ?? null,
    serviceOfferingId: service.id,
    serviceOfferingCode: service.code,
    workflowId: definition.workflowId,
    workflowStateId: stage.id,
    workflowStateCode: stage.code,
    workflowStateNameEs: stage.nameEs,
    workflowStateNameEn: stage.nameEn,
    sortOrder: dto.sortOrder ?? 0,
  };
};

export const parsePipelineSnapshot = (raw: string | null): PipelineSnapshot | null => {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== SNAPSHOT_SCHEMA_VERSION
      || typeof parsed.revision !== 'number' || parsed.revision < 1
      || parsed.source !== 'network' || !hasText(parsed.syncedAt)
      || !Array.isArray(parsed.definitions) || !isRecord(parsed.cards)) return null;
    const definitions = (parsed.definitions as PipelineDefinitionDTO[]).map(toDefinition);
    if (definitions.some((definition) => definition === null)) return null;
    const validDefinitions = definitions as PipelineDefinition[];
    const cards: Record<string, PipelineCard[]> = {};
    for (const definition of validDefinitions) {
      const values = parsed.cards[definition.workflowId];
      if (!Array.isArray(values)) return null;
      const converted = (values as PipelineCardDTO[]).map((card) => toCard(card, definition));
      if (converted.some((card) => card === null)) return null;
      cards[definition.workflowId] = converted as PipelineCard[];
    }
    return { schemaVersion: SNAPSHOT_SCHEMA_VERSION, revision: parsed.revision, source: 'network', syncedAt: parsed.syncedAt, definitions: validDefinitions, cards };
  } catch {
    return null;
  }
};

export const loadPipelineSnapshot = async (): Promise<PipelineSnapshot | null> =>
  parsePipelineSnapshot(await AsyncStorage.getItem(SNAPSHOT_KEY));

export async function refreshPipelineSnapshot(): Promise<PipelineSnapshot> {
  try {
    const dto = await get<PipelineSnapshotDTO>('/pipelines/snapshot');
    const definitions = dto.definitions.map(toDefinition);
    if (definitions.some((definition) => definition === null)) throw new Error('Invalid persisted pipeline definition');
    const validDefinitions = definitions as PipelineDefinition[];
    const knownWorkflows = new Set(validDefinitions.map((definition) => definition.workflowId));
    if (dto.cards.some((card) => !knownWorkflows.has(card.workflowId))) {
      throw new Error('Invalid canonical pipeline card');
    }
    const cardPairs = validDefinitions.map((definition) => {
      const cards = dto.cards
        .filter((card) => card.workflowId === definition.workflowId)
        .map((card) => toCard(card, definition));
      if (cards.some((card) => card === null)) throw new Error('Invalid canonical pipeline card');
      return [definition.workflowId, cards as PipelineCard[]] as const;
    });
    const snapshot: PipelineSnapshot = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      revision: dto.revision,
      source: 'network',
      syncedAt: new Date().toISOString(),
      definitions: validDefinitions,
      cards: Object.fromEntries(cardPairs),
    };
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    return snapshot;
  } catch (error) {
    const cached = await loadPipelineSnapshot();
    if (cached) return cached;
    throw error;
  }
}

export async function updateStage(
  workflowId: string,
  id: PipelineCard['id'],
  workflowStateId: string,
): Promise<PipelineCard> {
  const dto = await patch<PipelineCardDTO>(
    `/pipelines/${encodeURIComponent(workflowId)}/${encodeURIComponent(String(id))}`,
    { workflowStateId },
  );
  const cached = await loadPipelineSnapshot();
  const definition = cached?.definitions.find((item) => item.workflowId === workflowId);
  if (!definition) throw new Error('Actualiza los catálogos de pipelines antes de mover esta tarjeta.');
  const card = toCard(dto, definition);
  if (!card) throw new Error('El servidor devolvió una etapa que no pertenece a este pipeline.');
  const next: PipelineSnapshot = {
    ...cached,
    cards: {
      ...cached.cards,
      [workflowId]: (cached.cards[workflowId] ?? []).map((item) => item.id === card.id ? card : item),
    },
  };
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
  return card;
}
