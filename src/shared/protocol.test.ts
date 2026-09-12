import { describe, expect, it } from 'vitest';
import { findProtocolUrl, normaliseRegion, parseProtocolUrl, PROTOCOL_PREFIX } from './protocol';

/**
 * A link can come from any page anyone clicks, so most of what is worth
 * testing here is what the parser refuses.
 */

/** The shape the tournament bot builds, as one string. */
const LINK =
  `${PROTOCOL_PREFIX}game?action=host-comp&mapId=Burg&team1Name=Team%20One` +
  '&team2Name=Team%20Two&teamSize=3v3&team1Players=alpha%2C%20beta%2C%20gamma' +
  '&team2Players=delta%2C%20epsilon%2C%20zeta&region=NY' +
  '&webhook=https%3A%2F%2Fbot.example%2Fkrunker';

describe('parseProtocolUrl', () => {
  it('reads a host link the way the bot writes it', () => {
    const request = parseProtocolUrl(LINK);
    expect(request?.kind).toBe('host-comp');
    expect(request?.host).toMatchObject({
      mapId: 'Burg',
      team1Name: 'Team One',
      team2Name: 'Team Two',
      teamSize: '3v3',
      team1Players: 'alpha, beta, gamma',
      team2Players: 'delta, epsilon, zeta',
      region: 'us-nj',
      webhook: 'https://bot.example/krunker',
    });
  });

  it('ignores another client scheme', () => {
    expect(parseProtocolUrl('kcc://game?action=host-comp&mapId=Burg')).toBeNull();
    expect(parseProtocolUrl('https://krunker.io/?action=host-comp')).toBeNull();
  });

  it('ignores an action we do not implement', () => {
    expect(parseProtocolUrl(`${PROTOCOL_PREFIX}game?action=host-ffa`)).toBeNull();
    expect(parseProtocolUrl(`${PROTOCOL_PREFIX}game?mapId=Burg`)).toBeNull();
  });

  it('ignores a string that is not a URL at all', () => {
    expect(parseProtocolUrl('')).toBeNull();
    expect(parseProtocolUrl('nmnez')).toBeNull();
  });

  it('leaves absent parameters empty rather than undefined', () => {
    const host = parseProtocolUrl(`${PROTOCOL_PREFIX}game?action=host-comp`)?.host;
    expect(host).toEqual({
      mapId: '',
      team1Name: '',
      team2Name: '',
      teamSize: '',
      team1Players: '',
      team2Players: '',
      spectators: '',
      classLimits: {},
      webhook: '',
      region: '',
    });
  });

  it('strips control characters and trims', () => {
    const nul = String.fromCharCode(0);
    const url = `${PROTOCOL_PREFIX}game?action=host-comp&team1Name=${encodeURIComponent(`  Tea${nul}m  `)}`;
    expect(parseProtocolUrl(url)?.host.team1Name).toBe('Tea m');
  });

  it('caps a name at something a text input can hold', () => {
    const long = 'a'.repeat(500);
    const url = `${PROTOCOL_PREFIX}game?action=host-comp&team1Name=${long}`;
    expect(parseProtocolUrl(url)?.host.team1Name.length).toBe(64);
  });

  describe('team size', () => {
    const size = (value: string): string | undefined =>
      parseProtocolUrl(`${PROTOCOL_PREFIX}game?action=host-comp&teamSize=${value}`)?.host.teamSize;

    it('takes the label the bot sends', () => {
      expect(size('3v3')).toBe('3v3');
      expect(size('10v10')).toBe('10v10');
    });

    it('takes a bare dropdown index', () => {
      expect(size('2')).toBe('2');
    });

    it('drops anything else', () => {
      expect(size('three-v-three')).toBe('');
      expect(size('%3Cscript%3E')).toBe('');
    });
  });

  describe('class limits', () => {
    const limits = (value: string): Readonly<Record<string, number>> | undefined =>
      parseProtocolUrl(`${PROTOCOL_PREFIX}game?action=host-comp&classes=${encodeURIComponent(value)}`)
        ?.host.classLimits;

    it('reads the classes Krunker has a limit input for', () => {
      expect(limits('{"ak":1,"sniper":2}')).toEqual({ ak: 1, sniper: 2 });
    });

    it('drops a class that is not one of them', () => {
      expect(limits('{"ak":1,"bazooka":3}')).toEqual({ ak: 1 });
    });

    it('drops a limit that is not a number, and floors the ones that are', () => {
      expect(limits('{"ak":"lots","smg":2.7}')).toEqual({ smg: 2 });
    });

    it('clamps an absurd limit', () => {
      expect(limits('{"ak":100000}')).toEqual({ ak: 99 });
    });

    it('survives malformed JSON', () => {
      expect(limits('{not json')).toEqual({});
      expect(limits('[1,2,3]')).toEqual({});
    });
  });

  describe('webhook', () => {
    const hook = (value: string): string | undefined =>
      parseProtocolUrl(`${PROTOCOL_PREFIX}game?action=host-comp&webhook=${encodeURIComponent(value)}`)
        ?.host.webhook;

    it('takes an https URL', () => {
      expect(hook('https://bot.example/krunker')).toBe('https://bot.example/krunker');
    });

    it('refuses plain http, which would put a scoreboard on the wire', () => {
      expect(hook('http://bot.example/krunker')).toBe('');
    });

    it('refuses anything that is not a URL', () => {
      expect(hook('javascript:alert(1)')).toBe('');
      expect(hook('bot.example/krunker')).toBe('');
    });
  });
});

describe('normaliseRegion', () => {
  it('takes the short code a game id uses', () => {
    expect(normaliseRegion('NY')).toBe('us-nj');
    expect(normaliseRegion('dal')).toBe('us-tx');
  });

  it('takes a Krunker server key unchanged', () => {
    expect(normaliseRegion('us-nj')).toBe('us-nj');
    expect(normaliseRegion('DE-FRA')).toBe('de-fra');
  });

  it('takes the codes other clients use for the same servers', () => {
    expect(normaliseRegion('MUM')).toBe('as-mb');
    expect(normaliseRegion('ME')).toBe('me-bhn');
    expect(normaliseRegion('BR')).toBe('brz');
  });

  it('is empty for a region nobody has, so the lobby goes up where it would anyway', () => {
    expect(normaliseRegion('MARS')).toBe('');
    expect(normaliseRegion('')).toBe('');
  });
});

describe('findProtocolUrl', () => {
  it('finds the link among the launch arguments', () => {
    const argv = ['C:/app/NM-NZ.exe', '--allow-file-access', `${PROTOCOL_PREFIX}game?action=host-comp`];
    expect(findProtocolUrl(argv)).toBe(`${PROTOCOL_PREFIX}game?action=host-comp`);
  });

  it('matches the scheme however Windows cases it', () => {
    expect(findProtocolUrl(['NMNEZ://game?action=host-comp'])).toBe('NMNEZ://game?action=host-comp');
  });

  it('is null for an ordinary launch', () => {
    expect(findProtocolUrl(['C:/app/NM-NZ.exe', '.'])).toBeNull();
  });

  it('ignores arguments that are not strings', () => {
    expect(findProtocolUrl([null, 42, undefined])).toBeNull();
  });
});
