import { get, post } from './client';
import type { components } from './generated/types';

export type ExperimentAssignment = components['schemas']['ExperimentAssignment'];
export type ExperimentExposureResult = components['schemas']['ExperimentExposureResult'];

export const getExperimentAssignment = (experimentId: string): Promise<ExperimentAssignment> =>
  get<ExperimentAssignment>(
    `/session/experiments/${encodeURIComponent(experimentId)}/assignment`,
  );

export const recordExperimentExposure = (experimentId: string): Promise<ExperimentExposureResult> =>
  post<ExperimentExposureResult>(
    `/session/experiments/${encodeURIComponent(experimentId)}/exposure`,
    {},
  );
