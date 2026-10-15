type Decoder = (value: unknown) => string;
type QueryCodec = {
  parse: (value: string) => Record<string, unknown>;
  parseUrl: (value: string) => { url: string; query: Record<string, unknown> };
};

const decode = jest.requireActual('decode-uri-component') as Decoder;
const query = jest.requireActual('query-string') as QueryCodec;
const legacy = jest.requireActual('../../../scripts/fixtures/decode-uri-component-0.2.2/index.cjs') as Decoder;

function observeDecodeCalls(decoder: Decoder, value: string) {
  const native = globalThis.decodeURIComponent;
  let calls = 0;
  const spy = jest.spyOn(globalThis, 'decodeURIComponent').mockImplementation(input => {
    calls++;
    return native(input);
  });
  try {
    return { result: decoder(value), calls: () => calls };
  } finally {
    spy.mockRestore();
  }
}

function checkMalformedFamily(decoder: Decoder, count: number) {
  const input = '%FF'.repeat(count);
  const observed = observeDecodeCalls(decoder, input);
  if (observed.result !== input) throw new Error('Malformed byte preservation changed');
  if (observed.calls() === 0 || observed.calls() > 8 * count + 8) {
    throw new Error('Decoder call budget exceeded');
  }
  return observed.calls();
}

describe('SYS-URI-DECODE-001 compatible patched URI decoding', () => {
  test.each([
    ['', ''],
    ['a+b%2Bc', 'a b+c'],
    ['caf%C3%A9', 'café'],
    ['%F0%9F%8E%B5', '🎵'],
    ['%41%FF%42', 'A%FFB'],
    ['%C0%AF', '%C0%AF'],
    ['%ED%A0%80', '%ED%A0%80'],
    ['%F4%90%80%80', '%F4%90%80%80'],
    ['%C2', '�'],
    ['%G1%', '%G1%'],
    ['%00', '\u0000'],
  ])('preserves caller semantics for %j', (input, expected) => {
    expect(decode(input)).toBe(expected);
  });

  test.each([null, undefined, 7, {}, ['%41']])('rejects a non-string input %j', value => {
    expect(() => decode(value)).toThrow(TypeError);
  });

  test('round-trips 250 deterministic Unicode samples over scalar values', () => {
    let seed = 0x544446;
    for (let sample = 0; sample < 250; sample++) {
      let value = '';
      for (let position = 0; position < 12; position++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const scalar = seed % 0x110000;
        if (scalar < 0xd800 || scalar > 0xdfff) value += String.fromCodePoint(scalar);
      }
      expect(decode(encodeURIComponent(value))).toBe(value);
    }
  });

  test('the installed query-string caller handles Unicode, plus signs, duplicates and nulls', () => {
    expect({ ...query.parse('name=caf%C3%A9&term=a+b%2Bc&term=%FF%41&empty=&flag') }).toEqual({
      name: 'café', term: ['a b+c', '%FFA'], empty: '', flag: null,
    });
    expect(query.parseUrl('https://example.invalid/search?term=%FF%41').query.term).toBe('%FFA');
  });

  test.each([4, 8, 16, 32])('bounds decoder calls for the known malformed family of %i bytes', count => {
    checkMalformedFamily(decode, count);
  });

  test('negative control: actual upstream 0.2.2 violates that same call-budget oracle', () => {
    expect(() => checkMalformedFamily(legacy, 32)).toThrow('Decoder call budget exceeded');
  });

  test('negative control: an unadapted upstream namespace breaks the actual CommonJS caller', () => {
    jest.isolateModules(() => {
      jest.doMock('decode-uri-component', () => jest.requireActual('decode-uri-component-upstream'));
      try {
        const unadapted = require('query-string') as QueryCodec;
        expect(() => unadapted.parse('name=caf%C3%A9')).toThrow(TypeError);
      } finally {
        jest.dontMock('decode-uri-component');
      }
    });
  });
});
