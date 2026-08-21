import {
  classifiedFormError,
  moneyToMinor,
  parseIsoInput,
  taxonomyRequirements,
} from './classifiedForm';

const completeInput = {
  required: new Set<string>(),
  cityIds: ['quito'], remote: false, availableToTravel: false,
  professionIds: ['producer'], instrumentIds: ['bass'], genreIds: ['rock'],
  startsAt: '2026-09-20T20:00:00-05:00', endsAt: '2026-09-20T22:00:00-05:00',
  compensationTypeId: 'range', budgetMode: 'range', budgetMin: '100.50', budgetMax: '250',
  serviceOfferingId: 'recording',
};

describe('mobile directory classified form policy', () => {
  it('honors contextual category requirements from the API', () => {
    const required = taxonomyRequirements({ requirements: { required: ['instrumentIds', 'locations'] } });
    expect(required).toEqual(new Set(['instrumentIds', 'locations']));
    expect(classifiedFormError({ ...completeInput, required, instrumentIds: [] })).toBe('Selecciona al menos un instrumento.');
    expect(classifiedFormError({ ...completeInput, required })).toBeNull();
  });

  it('validates periods and budget ranges', () => {
    expect(classifiedFormError({ ...completeInput, startsAt: 'not-a-date' })).toBe('El inicio no es una fecha ISO válida.');
    expect(classifiedFormError({ ...completeInput, budgetMax: '50' })).toBe('El máximo no puede ser menor que el mínimo.');
  });

  it('normalizes ISO dates and currency minor units', () => {
    expect(parseIsoInput('2026-09-20T20:00:00-05:00')).toBe('2026-09-21T01:00:00.000Z');
    expect(moneyToMinor('100.50', 2)).toBe(10050);
    expect(moneyToMinor('-1', 2)).toBeUndefined();
  });
});
