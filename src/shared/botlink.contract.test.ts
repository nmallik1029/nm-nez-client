import { describe, expect, it } from 'vitest';
import { parseProtocolUrl } from './protocol';

/**
 * The tourney bot's links, parsed by the real parser.
 *
 * These are the exact strings `web/handlers.py handle_launch` emits for
 * `client=nmnez`, pasted verbatim. If a Krunker or bot change breaks the
 * contract, this is where it shows up rather than in front of a captain.
 */
const BOT_LINK =
  'nmnez://game?action=host-comp&mapId=Frontier&team1Name=Team%20Alpha' +
  '&team2Name=Team%20Bravo&teamSize=4v4' +
  '&webhook=https%3A%2F%2Ftourney-bot-production.up.railway.app%2Fkrunker&region=NY';

/**
 * A real CKL/PUG link, taken from `pug.match.build_host_url(match, 'nmnez', guild)`
 * through `handle_launch`. Full rosters, and a region the bot spells `TKY` and
 * rewrites to `TOK` on the way out.
 */
const CKL_LINK =
  'nmnez://game?action=host-comp&mapId=Frontier&team1Name=AlterFroX&team2Name=Asokra' +
  '&teamSize=4v4&team1Players=AlterFroX%2C%20PvlseFN%2C%20waII%2C%20Zeit2k' +
  '&team2Players=Asokra%2C%20Lvpez%2C%20infwi%2C%20s2nc' +
  '&webhook=https%3A%2F%2Ftourney-bot-production.up.railway.app%2Fkrunker&region=TOK';

describe('a real CKL pug link', () => {
  it('parses, with both rosters intact', () => {
    const host = parseProtocolUrl(CKL_LINK)!.host;
    expect(host.team1Players).toBe('AlterFroX, PvlseFN, waII, Zeit2k');
    expect(host.team2Players).toBe('Asokra, Lvpez, infwi, s2nc');
  });

  it('lands on Tokyo, which the bot spells TKY', () => {
    expect(parseProtocolUrl(CKL_LINK)!.host.region).toBe('jb-hnd');
  });

  it('keeps the webhook', () => {
    expect(parseProtocolUrl(CKL_LINK)!.host.webhook).toBe(
      'https://tourney-bot-production.up.railway.app/krunker',
    );
  });
});

describe('tourney bot host links', () => {
  it('accepts the link the bot builds', () => {
    const request = parseProtocolUrl(BOT_LINK);
    expect(request).not.toBeNull();
    expect(request?.kind).toBe('host-comp');
  });

  it('reads every field the bot sends', () => {
    const host = parseProtocolUrl(BOT_LINK)!.host;
    expect(host.mapId).toBe('Frontier');
    expect(host.team1Name).toBe('Team Alpha');
    expect(host.team2Name).toBe('Team Bravo');
    expect(host.webhook).toBe('https://tourney-bot-production.up.railway.app/krunker');
  });

  it('keeps teamSize in the NvN form the host form matches on', () => {
    expect(parseProtocolUrl(BOT_LINK)!.host.teamSize).toBe('4v4');
  });

  it('resolves NY to a Krunker server key', () => {
    expect(parseProtocolUrl(BOT_LINK)!.host.region).toBe('us-nj');
  });

  it('resolves every region code the bot can send', () => {
    // core/config.py REGION_NAMES, after views/pickban.py nmnez_region() rewrites
    // the two we spell differently (TKY -> TOK, IND -> MBI).
    const sent = ['BHN', 'BRZ', 'DAL', 'FRA', 'NY', 'SIN', 'SV', 'SYD', 'TOK', 'MBI'];
    const unresolved = sent.filter((code) => {
      const url = BOT_LINK.replace('region=NY', `region=${code}`);
      return parseProtocolUrl(url)!.host.region === '';
    });
    expect(unresolved).toEqual([]);
  });

  it('still drops codes Krunker has no server for', () => {
    // AFR/HKG/JPN/LON/MIA are in the bot's picker but not in Krunker's server list;
    // an empty region means "host where you already are", which is the safe outcome.
    for (const code of ['AFR', 'HKG', 'JPN', 'LON', 'MIA']) {
      const url = BOT_LINK.replace('region=NY', `region=${code}`);
      expect(parseProtocolUrl(url)!.host.region).toBe('');
    }
  });

  it('rejects a link aimed at another client', () => {
    expect(parseProtocolUrl(BOT_LINK.replace('nmnez://', 'kcc://'))).toBeNull();
  });
});
