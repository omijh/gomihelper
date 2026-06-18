import assert from 'node:assert/strict';
import {
  areaMatches,
  findBestAreaMatch,
  rankAreaSuggestions,
  type SearchAreaEntry,
} from '../app/area-search';

const AREA_JA_NAMES: Record<string, string> = {
  'Itabashi-ku': '板橋区',
  'Saitama-shi': 'さいたま市',
};

const EXTRA_AREA_ALIASES: Record<string, string[]> = {
  'Itabashi-ku': ['いたばしく', 'イタバシク', 'いたばし'],
  'Saitama-shi': ['さいたまし', 'サイタマシ', 'さいたま', 'いわつきく', 'イワツキク', 'いわつき'],
};

const areas: SearchAreaEntry[] = [
  {
    ward: 'Itabashi-ku',
    aliases: ['itabashi', '板橋区', '板橋', 'oyama'],
    file: 'samples/itabashi-ku@test.json',
  },
  {
    ward: 'Saitama-shi',
    aliases: ['saitama', 'saitama-shi', 'さいたま市', 'さいたま', '埼玉市', '埼玉', 'iwatsuki'],
    file: 'samples/saitama-shi@test.json',
  },
];

const getAreaTerms = (area: SearchAreaEntry) => [
  area.ward,
  area.ward.replace(/-(ku|shi)$/i, ''),
  AREA_JA_NAMES[area.ward],
  AREA_JA_NAMES[area.ward]?.replace(/[区市]$/, ''),
  ...(EXTRA_AREA_ALIASES[area.ward] ?? []),
  ...area.aliases,
].filter(Boolean);

assert.equal(
  findBestAreaMatch(areas, 'Saitama-shi', getAreaTerms)?.ward,
  'Saitama-shi',
  'exact romanized Saitama-shi should not resolve to Itabashi-ku',
);

assert.equal(
  findBestAreaMatch(areas, 'さいたま市', getAreaTerms)?.ward,
  'Saitama-shi',
  'Japanese Saitama city name should resolve to Saitama-shi',
);

assert.equal(
  rankAreaSuggestions(areas, 'Saitama-shi', getAreaTerms, 2)[0]?.ward,
  'Saitama-shi',
  'Saitama-shi should rank before weaker fuzzy matches in suggestions',
);

assert.equal(
  areaMatches(areas[0], 'いたばし', getAreaTerms, true),
  true,
  'exact Japanese alias matching should continue to work for Itabashi-ku',
);

console.log('Search matching tests passed.');
