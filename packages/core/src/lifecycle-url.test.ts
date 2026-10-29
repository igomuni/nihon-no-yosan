import { describe, expect, it } from 'vitest';
import { INITIAL_LIFECYCLE_FILTERS } from './lifecycle-list.ts';
import { INITIAL_LIFECYCLE_URL_STATE, decodeLifecycleUrl, encodeLifecycleUrl, type LifecycleUrlState } from './lifecycle-url.ts';
import { INITIAL_RS_FILTERS } from './rs.ts';

const state = (o: Partial<LifecycleUrlState>): LifecycleUrlState => ({ ...INITIAL_LIFECYCLE_URL_STATE, ...o });

describe('encodeLifecycleUrl', () => {
  it('writes nothing for the initial state, and only the values that differ from the initial ones', () => {
    expect(encodeLifecycleUrl(INITIAL_LIFECYCLE_URL_STATE)).toBe('');
    const q = encodeLifecycleUrl(state({ view: 'moku', year: 2024, filters: { ...INITIAL_LIFECYCLE_FILTERS, uses: ['1'], majors: ['35', '95'], mokuName: '給' } }));
    expect(q).toBe('view=moku&year=2024&major=35&major=95&use=1&moku=%E7%B5%A6');
  });

  it('writes the RS filters only for the RS view, and the other filters only for the other views', () => {
    const rs = { ...INITIAL_RS_FILTERS, ministries: ['厚生労働省'], link: 'linked' as const };
    expect(encodeLifecycleUrl(state({ view: 'rs', rsFilters: rs, filters: { ...INITIAL_LIFECYCLE_FILTERS, uses: ['1'] } }))).toBe('view=rs&ministry=%E5%8E%9A%E7%94%9F%E5%8A%B4%E5%83%8D%E7%9C%81&link=linked');
    expect(encodeLifecycleUrl(state({ view: 'list', rsFilters: rs }))).toBe('');
  });
});

describe('decodeLifecycleUrl', () => {
  it('returns null when there is no query (the saved state is used), or for another page', () => {
    expect(decodeLifecycleUrl('#/lifecycle')).toBeNull();
    expect(decodeLifecycleUrl('#/lifecycle?')).toBeNull();
    expect(decodeLifecycleUrl('#/trend?view=moku')).toBeNull();
    expect(decodeLifecycleUrl('')).toBeNull();
  });

  it('reads back what was written (the round trip keeps the state, with the selected row)', () => {
    const s = state({
      view: 'jikou',
      year: 2023,
      selected: '2023:general:内閣|内閣官房|001|内閣官房共通費|事項 X',
      filters: { ...INITIAL_LIFECYCLE_FILTERS, publishers: ['財務省'], accts: ['一般会計', '__none__'], org: '^本', orgRegex: true, majors: ['20'], pattern: 'partial', links: 'unsettled' },
    });
    expect(decodeLifecycleUrl(`#/lifecycle?${encodeLifecycleUrl(s)}`)).toEqual(s);
    const rs = state({ view: 'rs', year: 2025, selected: '123', rsFilters: { ...INITIAL_RS_FILTERS, ministries: ['総務省', '文部科学省'], bureau: '局', bureauRegex: true, name: '研究', link: 'unlinked' } });
    expect(decodeLifecycleUrl(`#/lifecycle?${encodeLifecycleUrl(rs)}`)).toEqual(rs);
  });

  it('treats what is written as the whole state: the items that are not written are the initial ones', () => {
    const d = decodeLifecycleUrl('#/lifecycle?use=1')!;
    expect(d).toMatchObject({ view: 'list', year: null, selected: null });
    expect(d.filters).toEqual({ ...INITIAL_LIFECYCLE_FILTERS, uses: ['1'] });
  });

  it('ignores unknown parameters and bad values instead of failing', () => {
    const d = decodeLifecycleUrl('#/lifecycle?view=nope&year=abc&pattern=zzz&links=x&foo=bar&moku_re=1&use=%E0%A4%A')!;
    expect(d.view).toBe('list');
    expect(d.year).toBeNull();
    expect(d.filters.pattern).toBe('all');
    expect(d.filters.links).toBe('all');
    expect(d.filters.mokuNameRegex).toBe(true);
    expect(d.filters.uses).toEqual(['%E0%A4%A']); // 壊れた % は、そのまま
  });
});
