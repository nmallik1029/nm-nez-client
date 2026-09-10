import { describe, expect, it } from 'vitest';
import { KRUNKER_CHAT } from '../krunker/constants';
import {
  channelFromSwitch,
  decideChatTag,
  isChatNoise,
  isNearBottom,
  isTeamMode,
  overflowCount,
} from './chat';

const SENDER = KRUNKER_CHAT.senderMarker;

describe('isTeamMode', () => {
  it('recognises team gamemodes', () => {
    expect(isTeamMode('Team Deathmatch')).toBe(true);
    expect(isTeamMode('Capture the Flag')).toBe(true);
  });

  it('rejects free-for-all and unknown modes', () => {
    expect(isTeamMode('Free for All')).toBe(false);
    expect(isTeamMode('Parkour')).toBe(false);
  });

  it('handles a missing mode', () => {
    expect(isTeamMode(undefined)).toBe(false);
    expect(isTeamMode(null)).toBe(false);
    expect(isTeamMode('')).toBe(false);
  });
});

describe('decideChatTag', () => {
  const base = { teamMode: true, dataTab: '0', itemText: `player${SENDER} hello` };

  it('tags team chat green and all-chat red', () => {
    expect(decideChatTag({ ...base, dataTab: '1' })).toMatchObject({ channel: 'team', label: '[T]' });
    expect(decideChatTag({ ...base, dataTab: '0' })).toMatchObject({ channel: 'all', label: '[M]' });
  });

  it('does not tag anything in a free-for-all', () => {
    // No teams means every line is all-chat, so tagging them all is noise.
    expect(decideChatTag({ ...base, teamMode: false, dataTab: '1' })).toBeNull();
  });

  it('skips system messages that have no sender', () => {
    // Killfeed and join notices have no "name:" marker and shouldn't be
    // labelled as though a player said them.
    expect(decideChatTag({ ...base, itemText: 'somebody joined the game' })).toBeNull();
  });

  it('skips a message with no channel attribute', () => {
    expect(decideChatTag({ ...base, dataTab: undefined })).toBeNull();
    expect(decideChatTag({ ...base, dataTab: '' })).toBeNull();
  });

  it('treats any non-team tab value as all-chat', () => {
    expect(decideChatTag({ ...base, dataTab: '2' })?.channel).toBe('all');
  });
});

describe('channelFromSwitch', () => {
  it('maps the live game values', () => {
    // Checked against the running client: #chatSwitch cycles groups <-> public.
    expect(channelFromSwitch('groups')).toBe('team');
    expect(channelFromSwitch('public')).toBe('all');
  });

  it('does not confuse message tab values with switch values', () => {
    // A message uses '1'/'0' and the switch uses 'groups'/'public'. Passing
    // one where the other belongs shouldn't quietly read as team chat.
    expect(channelFromSwitch('1')).toBe('all');
  });

  it('defaults to all chat when the attribute is missing', () => {
    expect(channelFromSwitch(undefined)).toBe('all');
  });
});

describe('isChatNoise', () => {
  it('matches Krunker filler', () => {
    expect(isChatNoise('Text & Voice Chat is available')).toBe(true);
  });

  it('leaves real messages alone', () => {
    expect(isChatNoise(`player${SENDER} nice shot`)).toBe(false);
  });
});

describe('overflowCount', () => {
  it('reports how many to trim from the top', () => {
    expect(overflowCount(250, 200)).toBe(50);
    expect(overflowCount(200, 200)).toBe(0);
    expect(overflowCount(10, 200)).toBe(0);
  });

  it('treats a limit of zero as unbounded', () => {
    // 0 means don't trim, not trim everything. Backwards here silently wipes
    // the chat.
    expect(overflowCount(5000, 0)).toBe(0);
    expect(overflowCount(5000, -1)).toBe(0);
  });
});

describe('isNearBottom', () => {
  it('follows when pinned to the bottom', () => {
    expect(isNearBottom(800, 1000, 200)).toBe(true);
  });

  it('tolerates a few pixels of slack', () => {
    // Sub-pixel layout and rounding mean you almost never get an exact match.
    expect(isNearBottom(790, 1000, 200)).toBe(true);
  });

  it('pauses once the user has scrolled up', () => {
    expect(isNearBottom(400, 1000, 200)).toBe(false);
  });

  it('follows when the list is shorter than the viewport', () => {
    expect(isNearBottom(0, 100, 200)).toBe(true);
  });
});
