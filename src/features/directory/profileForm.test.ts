import { isSafeProfileUrl, minorToMoney, profileFormError } from './profileForm';

const validProfile = {
  name: 'Productora Quito',
  cityIds: ['quito', 'cuenca'],
  primaryCityId: 'quito',
  onsite: true,
  remote: true,
  availableToTravel: false,
  rateMin: '100',
  rateMax: '250',
  portfolio: [{ itemType: 'audio' as const, title: 'Demo', url: 'https://example.test/demo' }],
  links: [{ label: 'Sitio', url: 'https://example.test' }],
};

describe('mobile directory profile form policy', () => {
  it('requires the primary city to belong to the selected service areas', () => {
    expect(profileFormError({ ...validProfile, primaryCityId: 'guayaquil' }))
      .toBe('Selecciona al menos una ciudad y marca la principal.');
  });

  it('rejects unsafe URLs and inverted rates', () => {
    expect(isSafeProfileUrl('https://user:secret@example.test')).toBe(false);
    expect(isSafeProfileUrl('//evil.example/demo')).toBe(false);
    expect(isSafeProfileUrl('https://example.test\\@evil.example/demo')).toBe(false);
    expect(profileFormError({ ...validProfile, rateMin: '-1' }))
      .toBe('Las tarifas deben ser números no negativos.');
    expect(profileFormError({ ...validProfile, rateMax: '50' }))
      .toBe('La tarifa máxima no puede ser menor que la mínima.');
  });

  it('accepts multiple cities and converts minor units for editing', () => {
    expect(profileFormError(validProfile)).toBeNull();
    expect(minorToMoney(10050, 2)).toBe('100.5');
  });

  it('allows an existing non-city primary area to survive an editor round trip', () => {
    expect(profileFormError({ ...validProfile, cityIds: [], primaryCityId: '', hasPreservedPrimaryArea: true })).toBeNull();
  });

  it('accepts same-origin legacy media paths', () => {
    expect(isSafeProfileUrl('/media/profile/demo.mp3')).toBe(true);
  });
});
