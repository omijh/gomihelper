import { mkdirSync, renameSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import * as XLSX from 'xlsx';

const API_BASE = 'https://service.api.metro.tokyo.lg.jp/api';

type PickupType = 'burnable' | 'plastic' | 'cans' | 'bottles' | 'paper' | 'bulk';
type Pickup = { day: string; type: PickupType; pattern?: string };
type BulkyFee = { item: string; feeYen: number; notes?: string };
type Schedule = { ward: string; station?: string; version: string; pickups: Pickup[]; bulkyFees?: BulkyFee[]; source: string };
type ColumnMapping = Record<string, string | string[]>;

type Source =
  | { type: 'api'; id: string }
  | { type: 'csv'; url: string; encoding?: string }
  | { type: 'html-table'; url: string; selector?: string };

type WardConfig = {
  ward: string;
  aliases: string[];
  source: Source;
  mapping: ColumnMapping;
  bulkyFees?: BulkyFee[];
};

const WARDS: WardConfig[] = [
  {
    ward: 'Chuo-ku',
    aliases: ['chuo', '中央区', '中央', 'ginza', '銀座', 'nihonbashi', '日本橋', 'tsukiji', '築地'],
    source: { type: 'api', id: 't131024d0000000002-56cfd55d78d59249573a72e6db09c202-0' },
    mapping: { burnable: '燃やすごみ', plastic: 'プラマーク', bulk: '粗大ごみ' },
    bulkyFees: [{ item: 'Sofa (2-seat)', feeYen: 800 }, { item: 'Bicycle', feeYen: 600 }, { item: 'Futon set', feeYen: 400 }],
  },
  {
    ward: 'Bunkyo-ku',
    aliases: ['bunkyo', '文京区', '文京', 'koraku', '後楽', 'hakusan', '白山', 'todai', '東大'],
    source: { type: 'api', id: 't131059d0110060001-1d720c8dd69f0c03764f85e15d1429b1-0' },
    mapping: { burnable: '可燃ごみ（週2回）', plastic: '資源（週1回）', bulk: '不燃ごみ（月2回）' },
    bulkyFees: [{ item: 'Small chair', feeYen: 400 }, { item: 'Electric fan', feeYen: 600 }, { item: 'Tatami mat', feeYen: 1000, notes: 'per mat' }],
  },
  {
    ward: 'Nakano-ku',
    aliases: ['nakano', '中野区', '中野', 'koenji', '高円寺', 'ochiai', '落合'],
    source: { type: 'api', id: 't131148d0000000135-27c4073e1a91e886c5eaf4fafb01b924-0' },
    mapping: { burnable: '燃やすごみ', plastic: '資源プラスチック', bottles: 'びん,ペットボトル', bulk: '陶器,ガラス,金属ごみ' },
    bulkyFees: [{ item: 'Desk (small)', feeYen: 500 }, { item: 'Washing machine', feeYen: 2000, notes: 'under 15kg' }, { item: 'Bookshelf', feeYen: 800 }],
  },
  {
    ward: 'Koto-ku',
    aliases: ['koto', '江東区', '江東', 'toyosu', '豊洲', 'kiba', '木場'],
    source: { type: 'api', id: 't131083d3100000009-671838441b8036aa352b967b5514a545-0' },
    mapping: { burnable: '燃やすごみ', plastic: 'プラスチック', paper: '資源', bulk: '燃やさないごみ' },
    bulkyFees: [{ item: 'Sofa', feeYen: 1000 }, { item: 'Bicycle', feeYen: 500 }, { item: 'Futon', feeYen: 300 }],
  },
  {
    ward: 'Sumida-ku',
    aliases: ['sumida', '墨田区', '墨田', 'ryogoku', '両国', 'kinshicho', '錦糸町'],
    source: { type: 'api', id: 't131075d0000000110-98a666d3ade587dceffc051d0ae41206-0' },
    mapping: { burnable: ['燃やすごみの収集曜日', '燃やすごみの収集曜日1'], bulk: ['燃やさないごみの収集曜日', '燃やさないごみの収集曜日1'], paper: '資源物の収集曜日' },
    bulkyFees: [{ item: 'Sofa', feeYen: 800 }, { item: 'Bicycle', feeYen: 500 }, { item: 'Tatami mat', feeYen: 1000, notes: 'per mat' }],
  },
  {
    ward: 'Shinagawa-ku',
    aliases: ['shinagawa', '品川区', '品川', 'omori', '大森'],
    source: { type: 'api', id: 't131091d0000000007-a4331d1df483d520922d04477412ad13-0' },
    mapping: { burnable: '燃やすごみ', plastic: '資源', bulk: '陶器・ガラス・金属ごみ' },
    bulkyFees: [{ item: 'Desk', feeYen: 600 }, { item: 'Electric kotatsu', feeYen: 800 }, { item: 'Bookshelf', feeYen: 700 }],
  },
  {
    ward: 'Taito-ku',
    aliases: ['taito', '台東区', '台東', 'ueno', '上野', 'asakusa', '浅草'],
    source: { type: 'api', id: 't131067d0000000077-0f64b85fe050faa5e631861811f3345e-0' },
    mapping: { burnable: '燃やすごみ', plastic: '資源', bulk: '燃やさないごみ' },
    bulkyFees: [{ item: 'Sofa', feeYen: 800 }, { item: 'Bicycle', feeYen: 500 }, { item: 'Electric fan', feeYen: 600 }],
  },
  {
    ward: 'Kiyose-shi',
    aliases: ['kiyose', '清瀬市', '清瀬'],
    source: { type: 'api', id: 't132217d0000000047-8437e36c4fc65c237ec5412e42bd3975-0' },
    mapping: { burnable: '可燃ごみ（週2回）', plastic: '容器包装プラスチック', bottles: 'ペットボトル', paper: '古紙・古布', cans: 'びん・かん', bulk: '不燃ごみ' },
    bulkyFees: [{ item: 'Large furniture', feeYen: 1000, notes: 'over 50cm' }, { item: 'Small furniture', feeYen: 500, notes: 'under 50cm' }, { item: 'Bicycle', feeYen: 500 }],
  },
  {
    ward: 'Suginami-ku',
    aliases: ['suginami', '杉並区', '杉並', 'ogikubo', '荻窪', 'koenji', '高円寺', 'asagaya', '阿佐谷'],
    source: { type: 'csv', url: 'https://www.city.suginami.tokyo.jp/documents/12125/garbage.csv', encoding: 'utf-8' },
    mapping: { burnable: '可燃ごみ', bulk: '不燃ごみ', plastic: 'びん・かん・プラ', paper: '古紙・ペットボトル' },
    bulkyFees: [{ item: 'Sofa', feeYen: 800 }, { item: 'Bicycle', feeYen: 500 }, { item: 'Desk', feeYen: 600 }],
  },
  {
    ward: 'Adachi-ku',
    aliases: ['adachi', '足立区', '足立', 'kitasenju', '北千住', 'ayase', '綾瀬', 'takenotsuka', '竹の塚', 'toneri', '舎人'],
    source: { type: 'html-table', url: 'https://www.city.adachi.tokyo.jp/seso/kurashi/sche.html' },
    mapping: { burnable: '燃やすごみ', plastic: 'プラスチック', bulk: '不燃ごみ', paper: '資源' },
    bulkyFees: [{ item: 'Sofa', feeYen: 800 }, { item: 'Bicycle', feeYen: 600 }, { item: 'Futon set', feeYen: 400 }],
  },
  {
    ward: 'Nerima-ku',
    aliases: ['nerima', '練馬区', '練馬'],
    source: { type: 'html-table', url: 'https://www.city.nerima.tokyo.jp/kurashi/gomi/wakekata/ichiran/' },
    mapping: { burnable: '可燃ごみ', bulk: '不燃ごみ', plastic: '容器包装プラスチック', cans: 'びん・缶', bottles: 'ペットボトル' },
    bulkyFees: [{ item: 'Large furniture', feeYen: 1000 }, { item: 'Bicycle', feeYen: 500 }, { item: 'Futon set', feeYen: 400 }],
  },
  {
    ward: 'Shinjuku-ku',
    aliases: ['shinjuku', '新宿区', '新宿', 'kabukicho', '歌舞伎町'],
    source: { type: 'html-table', url: 'https://www.city.shinjuku.lg.jp/seikatsu/file09_01_00001.html' },
    mapping: { burnable: '燃やすごみ', bulk: '金属・陶器・ガラスごみ', paper: '資源' },
    bulkyFees: [{ item: 'Sofa', feeYen: 800 }, { item: 'Bicycle', feeYen: 500 }, { item: 'Electric fan', feeYen: 600 }],
  },
  {
    ward: 'Setagaya-ku',
    aliases: ['setagaya', '世田谷区', '世田谷', 'shimokitazawa', '下北沢'],
    source: { type: 'html-table', url: 'https://www.city.setagaya.lg.jp/02241/416.html' },
    mapping: { burnable: '可燃ごみ', bulk: '不燃ごみ', paper: '資源', bottles: 'ペットボトル' },
    bulkyFees: [{ item: 'Sofa', feeYen: 800 }, { item: 'Desk', feeYen: 600 }, { item: 'Bookshelf', feeYen: 700 }],
  },
  {
    ward: 'Edogawa-ku',
    aliases: ['edogawa', '江戸川区', '江戸川', 'kasai', '葛西', 'kasa', '小岩'],
    source: { type: 'html-table', url: 'https://www.city.edogawa.tokyo.jp/e025/kurashi/gomi_recycle/kategomi/yobihyo.html' },
    mapping: { burnable: '燃やすごみ', bulk: '燃やさないごみ', paper: '資源' },
    bulkyFees: [{ item: 'Sofa', feeYen: 800 }, { item: 'Bicycle', feeYen: 500 }, { item: 'Futon set', feeYen: 400 }],
  },
  {
    ward: 'Arakawa-ku',
    aliases: ['arakawa', '荒川区', '荒川', 'minamisenju', '南千住', 'nippori', '日暮里'],
    source: { type: 'html-table', url: 'https://www.city.arakawa.tokyo.jp/a025/recycle/shuushuubi/syusyubi.html' },
    mapping: { burnable: '燃やすごみ', bulk: '燃やさないごみ', plastic: 'プラスチック' },
    bulkyFees: [{ item: 'Sofa', feeYen: 800 }, { item: 'Bicycle', feeYen: 500 }, { item: 'Futon set', feeYen: 400 }],
  },
  {
    ward: 'Ota-ku',
    aliases: ['ota', '大田区', '大田', 'kamata', '蒲田', 'omori', '大森'],
    source: { type: 'csv', url: 'https://www.opendata.metro.tokyo.lg.jp/ootaku/131113_shigengomiyoubi.xlsx' },
    mapping: { burnable: '可燃ごみ', bulk: '不燃ごみ', plastic: 'プラ', paper: '資源' },
    bulkyFees: [{ item: 'Sofa', feeYen: 800 }, { item: 'Bicycle', feeYen: 500 }, { item: 'Electric fan', feeYen: 600 }],
  },

  {
    ward: 'Chiyoda-ku',
    aliases: ['chiyoda', '千代田区', '千代田', 'iidabashi', '飯田橋', 'kanda', '神田', 'akihabara', '秋葉原'],
    source: { type: 'html-table', url: 'https://www.city.chiyoda.lg.jp/koho/kurashi/gomi/wakekata/index.html' },
    mapping: { burnable: '燃やすごみ', bulk: '燃やさないごみ', plastic: 'プラスチック', paper: '資源' },
    bulkyFees: [{ item: 'Sofa', feeYen: 900 }, { item: 'Bicycle', feeYen: 400 }, { item: 'Futon set', feeYen: 400 }],
  },
  {
    ward: 'Minato-ku',
    aliases: ['minato', '港区', '港', 'akasaka', '赤坂', 'roppongi', '六本木', 'takanawa', '高輪'],
    source: { type: 'html-table', url: 'https://www.city.minato.tokyo.jp/unei/2025gomikarenda.html' },
    mapping: { burnable: '可燃', bulk: '不燃', plastic: 'プラ', paper: '資源' },
    bulkyFees: [{ item: 'Sofa', feeYen: 900 }, { item: 'Bicycle', feeYen: 400 }, { item: 'Futon set', feeYen: 400 }],
  },
  {
    ward: 'Meguro-ku',
    aliases: ['meguro', '目黒区', '目黒', 'aobadai', '青葉台', 'nakameguro', '中目黒', 'jiyugaoka', '自由が丘'],
    source: { type: 'html-table', url: 'https://www.city.meguro.tokyo.jp/seisou/kurashi/gomi/youbiichiran.html' },
    mapping: { burnable: '燃やすごみ', bulk: '燃やさないごみ', paper: '資源' },
    bulkyFees: [{ item: 'Sofa', feeYen: 900 }, { item: 'Bicycle', feeYen: 400 }, { item: 'Futon set', feeYen: 400 }],
  },
  {
    ward: 'Shibuya-ku',
    aliases: ['shibuya', '渋谷区', '渋谷', 'uehara', '上原', 'ebisu', '恵比寿', 'harajuku', '原宿'],
    source: { type: 'html-table', url: 'https://www.city.shibuya.tokyo.jp/kurashi/gomi/kateigomi/gomid.html' },
    mapping: { burnable: '可燃ごみ', bulk: '不燃ごみ', paper: '資源' },
    bulkyFees: [{ item: 'Sofa', feeYen: 900 }, { item: 'Bicycle', feeYen: 400 }, { item: 'Futon set', feeYen: 400 }],
  },
  {
    ward: 'Toshima-ku',
    aliases: ['toshima', '豊島区', '豊島', 'ikebukuro', '池袋', 'komagome', '駒込', 'sugamo', '巣鴨'],
    source: { type: 'html-table', url: 'https://www.city.toshima.lg.jp/150/kurashi/gomi/shigen/2303021832.html' },
    mapping: { burnable: '燃やすごみ', bulk: '金属・陶器・ガラスごみ', plastic: 'プラスチック', cans: 'びん・かん・ペットボトル', bottles: 'びん・かん・ペットボトル', paper: '紙・布類' },
    bulkyFees: [{ item: 'Sofa', feeYen: 900 }, { item: 'Bicycle', feeYen: 400 }, { item: 'Futon set', feeYen: 400 }],
  },
  {
    ward: 'Kita-ku',
    aliases: ['kita', '北区', '北', 'akabane', '赤羽', 'oji', '王子', 'tabata', '田端'],
    source: { type: 'html-table', url: 'https://www.city.kita.lg.jp/living/bins/1002013/1002014.html' },
    mapping: { burnable: '可燃ごみ', bulk: '不燃ごみ', plastic: 'プラスチック', cans: 'びん・缶・ペットボトル', bottles: 'びん・缶・ペットボトル', paper: '古紙' },
    bulkyFees: [{ item: 'Sofa', feeYen: 900 }, { item: 'Bicycle', feeYen: 400 }, { item: 'Futon set', feeYen: 400 }],
  },
  {
    ward: 'Itabashi-ku',
    aliases: ['itabashi', '板橋区', '板橋', 'aioicho', '相生町', 'akatsuka', '赤塚', 'oyama', '大山'],
    source: { type: 'html-table', url: 'https://www.city.itabashi.tokyo.jp/tetsuduki/gomi/kaishu/1038152.html' },
    mapping: { burnable: '可燃ごみ', bulk: '不燃ごみ', paper: '資源' },
    bulkyFees: [{ item: 'Sofa', feeYen: 900 }, { item: 'Bicycle', feeYen: 400 }, { item: 'Futon set', feeYen: 400 }],
  },
  {
    ward: 'Katsushika-ku',
    aliases: ['katsushika', '葛飾区', '葛飾', 'ohanajaya', 'お花茶屋', 'kosuge', '小菅', 'horikiri', '堀切'],
    source: { type: 'html-table', url: 'https://www.city.katsushika.lg.jp/kurashi/1000048/1017199/1020038.html' },
    mapping: { burnable: '燃やすごみ', bulk: '燃やさないごみ', plastic: 'プラスチック製容器包装', paper: '資源' },
    bulkyFees: [{ item: 'Sofa', feeYen: 900 }, { item: 'Bicycle', feeYen: 400 }, { item: 'Futon set', feeYen: 400 }],
  },
  {
    ward: 'Tachikawa',
    aliases: ['tachikawa', '立川市', '立川', 'tachikawa-shi'],
    source: { type: 'html-table', url: 'https://www.city.tachikawa.lg.jp/kurashi/gomi/1001716/1027202/1027203.html' },
    mapping: { burnable: '燃やせるごみ', plastic: 'プラスチック', bottles: 'ペットボトル', cans: '缶', bulk: '燃やせないごみ', paper: '雑誌・本・雑がみ・牛乳等紙パック' },
    bulkyFees: [{ item: 'Sofa', feeYen: 800 }, { item: 'Bicycle', feeYen: 500 }, { item: 'Electric fan', feeYen: 600 }],
  },
  {
    ward: 'Higashikurume',
    aliases: ['higashikurume', '東久留米市', '東久留米', 'higashikurume-shi'],
    source: { type: 'html-table', url: 'https://www.city.higashikurume.lg.jp/kurashi/kankyo/shigen/1018874/1000817.html' },
    mapping: { burnable: '燃やせるごみ', plastic: '容器包装プラスチック', bottles: 'PETボトル', cans: '缶', bulk: '燃やせないごみ', paper: '紙類' },
    bulkyFees: [{ item: 'Sofa', feeYen: 800 }, { item: 'Bicycle', feeYen: 500 }, { item: 'Electric fan', feeYen: 600 }],
  },
  {
    ward: 'Saitama-shi',
    aliases: ['saitama', 'saitama-shi', 'さいたま市', 'さいたま', '埼玉市', '埼玉', 'iwatsuki', '岩槻区', '岩槻'],
    source: { type: 'html-table', url: 'https://www.city.saitama.lg.jp/001/006/010/003/p001912.html' },
    mapping: { burnable: '燃', bulk: '不燃', paper: '資2', plastic: '資1', cans: '資1', bottles: '資1' },
    bulkyFees: [
      { item: 'Oversized item collection', feeYen: 550, notes: 'per item' },
      { item: 'Spring mattress', feeYen: 2200 },
      { item: 'Spring sofa', feeYen: 2200 },
    ],
  },
];

const DAY_MAP: Record<string, string> = {
  '月曜日': 'Mon', '火曜日': 'Tue', '水曜日': 'Wed', '木曜日': 'Thu', '金曜日': 'Fri', '土曜日': 'Sat', '日曜日': 'Sun',
  '月曜': 'Mon', '火曜': 'Tue', '水曜': 'Wed', '木曜': 'Thu', '金曜': 'Fri', '土曜': 'Sat', '日曜': 'Sun',
  '月': 'Mon', '火': 'Tue', '水': 'Wed', '木': 'Thu', '金': 'Fri', '土': 'Sat', '日': 'Sun',
};

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DAY_REGEX = (() => {
  const sorted = Object.keys(DAY_MAP).sort((a, b) => b.length - a.length);
  const escaped = sorted.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  return new RegExp(escaped.join('|'), 'g');
})();

const DAY_CLEAN_REGEX = (() => {
  const allKeys = Object.keys(DAY_MAP);
  const sorted = allKeys.sort((a, b) => b.length - a.length);
  const escaped = sorted.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  return new RegExp(escaped.join('|'), 'g');
})();

function extractPattern(value: string): string | undefined {
  const parts: string[] = [];
  const week = value.match(/(?:第\s*[0-9０-９]+(?:[\s・･,，]+[0-9０-９]+)*)/g);
  if (week) parts.push(...week);
  const session = value.match(/[0-9０-９]+[\s・･,，]?[0-9０-９]*\s*回目/g);
  if (session) parts.push(...session);
  if (/隔週/.test(value)) parts.push('隔週');
  if (parts.length === 0) return undefined;
  return parts.map(p => p.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 65248))).join(' ');
}

function extractDays(value: string): string[] {
  const matches = value.match(DAY_REGEX) || [];
  const result: string[] = [];
  for (const m of matches) {
    const en = DAY_MAP[m];
    if (en && !result.includes(en)) result.push(en);
  }
  const sortedMeta = ['隔週', 'その月の', '第', '回目', '番目'];
  if (sortedMeta.some(s => value.includes(s))) return result;
  if (value.includes('～') || value.includes('~')) {
    const rangeDays = [...new Set(matches.map(m => DAY_MAP[m]).filter(Boolean))];
    if (rangeDays.length >= 2) {
      const start = DAY_ORDER.indexOf(rangeDays[0]);
      const end = DAY_ORDER.indexOf(rangeDays[rangeDays.length - 1]);
      if (start !== -1 && end !== -1 && end > start) {
        for (let i = start; i <= end; i++) {
          if (!result.includes(DAY_ORDER[i])) result.push(DAY_ORDER[i]);
        }
      }
    }
  }
  return result.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

function getColumnVal(row: Record<string, string>, col: string | string[]): string {
  if (Array.isArray(col)) return col.map(c => row[c] || '').filter(Boolean).join(' ');
  return row[col] || '';
}

function extractPickupSchedule(hits: Record<string, string>[], mapping: ColumnMapping): Pickup[] {
  const firstRow = hits[0];
  if (!firstRow) return [];
  const result: Pickup[] = [];
  const added = new Set<string>();
  for (const [typeKey, columnName] of Object.entries(mapping)) {
    if (!columnName) continue;
    const val = getColumnVal(firstRow, columnName);
    if (val) {
      const pattern = extractPattern(val);
      for (const day of DAY_ORDER) {
        if (extractDays(val).includes(day)) {
          const key = `${day}-${typeKey}`;
          if (!added.has(key)) { added.add(key); result.push({ day, type: typeKey as PickupType, pattern }); }
        }
      }
    }
  }
  return result;
}

function extractShinagawaSchedule(hits: Record<string, string>[], mapping: ColumnMapping): Pickup[] {
  const areaGroups = new Map<string, Map<string, string>>();
  for (const row of hits) {
    const area = row['地区名'] || '';
    if (!area) continue;
    if (!areaGroups.has(area)) areaGroups.set(area, new Map());
    const typeName = row['ゴミ分類区分'] || '';
    const days = row['収集曜日'] || '';
    if (typeName && days) areaGroups.get(area)!.set(typeName, days);
  }
  const firstArea = areaGroups.values().next().value;
  if (!firstArea) return [];
  const result: Pickup[] = [];
  const added = new Set<string>();
  for (const [typeKey, columnName] of Object.entries(mapping)) {
    if (!columnName) continue;
    const col = Array.isArray(columnName) ? columnName[0] : columnName;
    const val = firstArea.get(col);
    if (val) {
      const pattern = extractPattern(val);
      for (const day of DAY_ORDER) {
        if (extractDays(val).includes(day)) {
          const key = `${day}-${typeKey}`;
          if (!added.has(key)) { added.add(key); result.push({ day, type: typeKey as PickupType, pattern }); }
        }
      }
    }
  }
  return result;
}
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  });
}

async function fetchCSV(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

async function fetchHTMLTable(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTML fetch failed: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const rows: Record<string, string>[] = [];
  $('table.datatable tr').each((_, tr) => {
    const cells = $(tr).find('th, td');
    if (cells.length < 2) return;
    const area = $(cells[0]).text().trim();
    if (!area || area === '地域') return;
    const vals: string[] = [];
    cells.each((i, cell) => {
      if (i === 0) return;
      vals.push($(cell).text().replace(/\s+/g, '').trim());
    });
    if (vals.length >= 4) {
      rows.push({
        '地域': area,
        '燃やすごみ': vals[0],
        '資源': vals[1],
        '不燃ごみ': vals[2],
        'プラスチック': vals[3],
      });
    }
  });
  return rows;
}

async function fetchAPIData(id: string): Promise<Record<string, string>[]> {
  const url = `${API_BASE}/${id}/json?limit=200`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { accept: 'application/json', 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.hits || [];
}

async function fetchNerimaTable(): Promise<Record<string, string>[]> {
  const kanaPages = ['a', 'ka', 'sa', 'ta', 'na', 'ha', 'ma'];
  const rows: Record<string, string>[] = [];
  for (const kana of kanaPages) {
    const url = `https://www.city.nerima.tokyo.jp/kurashi/gomi/wakekata/ichiran/${kana}_gyochiiki.html`;
    try {
      const res = await fetch(url);
      const html = await res.text();
      const $ = cheerio.load(html);
      $('table tr').each((_, tr) => {
        const cells = $(tr).find('th, td');
        const town = $(cells[0]).text().replace(/\s+/g, '').trim();
        if (!town || town === '町名' || town === '50音') return;
        const col2 = $(cells[2]).text().replace(/\s+/g, '').trim();
        const col3 = $(cells[3]).text().replace(/\s+/g, '').trim();
        const col4 = $(cells[4]).text().replace(/\s+/g, '').trim();
        const col5 = $(cells[5]).text().replace(/\s+/g, '').trim();
        const col6 = $(cells[6]).text().replace(/\s+/g, '').trim();
        if (col2) {
          rows.push({
            '可燃ごみ': col2,
            '不燃ごみ': col3,
            '容器包装プラスチック': col4,
            'びん・缶': col5,
            'ペットボトル': col6,
          });
        }
      });
    } catch { /* skip failed page */ }
  }
  return rows;
}

async function fetchShinjukuTable(): Promise<Record<string, string>[]> {
  const res = await fetch('https://www.city.shinjuku.lg.jp/seikatsu/file09_01_00001.html');
  const html = await res.text();
  const $ = cheerio.load(html);
  const rows: Record<string, string>[] = [];
  $('table tr').each((_, tr) => {
    const cells = $(tr).find('th, td');
    const addr = $(cells[1]).text().trim();
    if (!addr || addr === '集積所の住所' || addr.startsWith('町名')) return;
    const vals: string[] = [];
    cells.each((i, cell) => { vals.push($(cell).text().replace(/\s+/g, '').trim()); });
    if (vals.length >= 5) {
      rows.push({
        '資源': vals[2],
        '燃やすごみ': vals[3],
        '金属・陶器・ガラスごみ': vals[4],
      });
    }
  });
  return rows;
}

async function fetchSetagayaTable(): Promise<Record<string, string>[]> {
  const res = await fetch('https://www.city.setagaya.lg.jp/02241/416.html');
  const html = await res.text();
  const $ = cheerio.load(html);
  const rows: Record<string, string>[] = [];
  $('table').eq(1).find('tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 7) return;
    const town = $(cells[1]).text().trim();
    if (!town || town === '町名') return;
    rows.push({
      '可燃ごみ': $(cells[4]).text().replace(/\s+/g, '').trim(),
      '不燃ごみ': $(cells[5]).text().replace(/\s+/g, '').trim(),
      '資源': $(cells[3]).text().replace(/\s+/g, '').trim(),
      'ペットボトル': $(cells[6]).text().replace(/\s+/g, '').trim(),
    });
  });
  return rows;
}

async function fetchEdogawaTable(): Promise<Record<string, string>[]> {
  const res = await fetch('https://www.city.edogawa.tokyo.jp/e025/kurashi/gomi_recycle/kategomi/yobihyo.html');
  const html = await res.text();
  const $ = cheerio.load(html);
  const rows: Record<string, string>[] = [];
  $('table').each((_, table) => {
    $(table).find('tr').each((_, tr) => {
      const cells = $(tr).find('td');
      if (cells.length < 5) return;
      const label0 = $(cells[0]).text().replace(/\s+/g, '').trim();
      if (!label0 || label0 === '地域' || label0.startsWith('管轄')) return;
      const col2 = $(cells[2]).text().replace(/\s+/g, '').trim();
      const col3 = $(cells[3]).text().replace(/\s+/g, '').trim();
      const col4 = $(cells[4]).text().replace(/\s+/g, '').trim();
      if (!col2 && !col3 && !col4) return;
      rows.push({ '資源': col2, '燃やすごみ': col3, '燃やさないごみ': col4 });
    });
  });
  return rows;
}

async function fetchArakawaTable(): Promise<Record<string, string>[]> {
  const res = await fetch('https://www.city.arakawa.tokyo.jp/a025/recycle/shuushuubi/syusyubi.html');
  const html = await res.text();
  const $ = cheerio.load(html);
  const rows: Record<string, string>[] = [];
  $('table').first().find('tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 4) return;
    const area = $(cells[0]).text().trim();
    if (!area || area === '地域' || area === '物件名') return;
    rows.push({
      '燃やすごみ': $(cells[1]).text().replace(/\s+/g, '').trim(),
      '燃やさないごみ': $(cells[2]).text().replace(/\s+/g, '').trim(),
      'プラスチック': $(cells[3]).text().replace(/\s+/g, '').trim(),
    });
  });
  return rows;
}

const TACHIKAWA_ITEM_MAP: Record<string, PickupType> = {
  '燃やせるごみ': 'burnable',
  'プラスチック': 'plastic',
  'ペットボトル': 'bottles',
  '燃やせないごみ': 'bulk',
  '燃やせないごみ・缶': 'bulk',
  '缶': 'cans',
  '段ボール・茶色紙': 'paper',
  '雑誌・本・雑がみ・牛乳等紙パック': 'paper',
  '古布': 'paper',
  '新聞・折込チラシ': 'paper',
};

const HIGASHIKURUME_ITEM_MAP: Record<string, PickupType> = {
  '燃やせるごみ': 'burnable',
  '容器包装プラスチック': 'plastic',
  'PETボトル': 'bottles',
  '燃やせないごみ': 'bulk',
  '有害ごみ': 'bulk',
  '缶': 'cans',
  '紙類': 'paper',
  '布類': 'paper',
};

const DAY_CHECK = /月|火|水|木|金|土|日/;

function pickup(day: string, type: PickupType, pattern?: string): Pickup {
  return pattern ? { day, type, pattern } : { day, type };
}

function verifiedRepresentativeSchedule(config: WardConfig): Schedule | null {
  const common = {
    version: new Date().toISOString().slice(0, 10),
    bulkyFees: config.bulkyFees,
  };

  switch (config.ward) {
    case 'Chiyoda-ku':
      return {
        ...common,
        ward: config.ward,
        station: '飯田橋二・三丁目 / Calendar No.1',
        pickups: [
          pickup('Mon', 'bulk', '第1・3'),
          pickup('Tue', 'burnable'),
          pickup('Wed', 'plastic'),
          pickup('Thu', 'burnable'),
          pickup('Sat', 'paper'),
        ],
        source: 'Official 2026 Chiyoda collection calendar No.1 PDF',
      };
    case 'Minato-ku':
      return {
        ...common,
        ward: config.ward,
        station: '赤坂一丁目 / Calendar 1',
        pickups: [
          pickup('Mon', 'burnable'),
          pickup('Tue', 'bulk', '第2・4'),
          pickup('Wed', 'plastic'),
          pickup('Thu', 'burnable'),
          pickup('Sat', 'paper'),
        ],
        source: 'Official 2026 Minato collection calendar 1 PDF',
      };
    case 'Meguro-ku':
      return {
        ...common,
        ward: config.ward,
        station: '青葉台一〜三丁目',
        pickups: [
          pickup('Tue', 'burnable'),
          pickup('Thu', 'paper'),
          pickup('Fri', 'burnable'),
          pickup('Sat', 'bulk', '第1・3'),
        ],
        source: 'Official Meguro collection weekday list PDF',
      };
    case 'Shibuya-ku':
      return {
        ...common,
        ward: config.ward,
        station: '上原一丁目',
        pickups: [
          pickup('Mon', 'bulk', '第2'),
          pickup('Tue', 'paper'),
          pickup('Wed', 'burnable'),
          pickup('Sat', 'burnable'),
        ],
        source: 'Official Shibuya collection day page',
      };
    case 'Toshima-ku':
      return {
        ...common,
        ward: config.ward,
        station: '池袋一・四丁目',
        pickups: [
          pickup('Mon', 'burnable'),
          pickup('Tue', 'cans'),
          pickup('Tue', 'bottles'),
          pickup('Wed', 'plastic'),
          pickup('Thu', 'burnable'),
          pickup('Fri', 'bulk', '第1・3'),
        ],
        source: 'Official Toshima 2026 waste plan collection weekday table PDF',
      };
    case 'Kita-ku':
      return {
        ...common,
        ward: config.ward,
        station: '赤羽一丁目1〜9番',
        pickups: [
          pickup('Tue', 'burnable'),
          pickup('Wed', 'bulk', '第2・4'),
          pickup('Thu', 'paper'),
          pickup('Thu', 'plastic'),
          pickup('Fri', 'burnable'),
          pickup('Fri', 'cans'),
          pickup('Fri', 'bottles'),
        ],
        source: 'Official Kita 2026 household waste guide PDF',
      };
    case 'Itabashi-ku':
      return {
        ...common,
        ward: config.ward,
        station: '相生町',
        pickups: [
          pickup('Tue', 'burnable'),
          pickup('Wed', 'paper'),
          pickup('Thu', 'burnable'),
          pickup('Fri', 'bulk', '第2・4'),
          pickup('Sat', 'burnable'),
        ],
        source: 'Official Itabashi 2026 regional collection table',
      };
    case 'Katsushika-ku':
      return {
        ...common,
        ward: config.ward,
        station: 'お花茶屋一〜三丁目 / Collection district 1',
        pickups: [
          pickup('Mon', 'burnable'),
          pickup('Tue', 'plastic'),
          pickup('Thu', 'burnable'),
          pickup('Fri', 'paper'),
          pickup('Wed', 'bulk', '月2回'),
        ],
        source: 'Official Katsushika 2026 collection calendar district 1 PDF',
      };
    case 'Saitama-shi':
      return {
        ...common,
        ward: config.ward,
        station: '岩槻区 相野原',
        pickups: [
          pickup('Tue', 'burnable'),
          pickup('Fri', 'burnable'),
          pickup('Wed', 'bulk'),
          pickup('Wed', 'paper'),
          pickup('Thu', 'plastic'),
          pickup('Thu', 'cans'),
          pickup('Thu', 'bottles'),
        ],
        source: 'Official Saitama City 2026 household waste manual PDF',
      };
    default:
      return null;
  }
}

async function fetchTachikawaSchedule(): Promise<Schedule> {
  const url = 'https://www.city.tachikawa.lg.jp/kurashi/gomi/1001716/1027202/1027203.html';
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);
  const pickups: Pickup[] = [];
  const added = new Set<string>();

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 3) return;
    const dayText = $(cells[0]).text().trim();
    const itemText = $(cells[1]).text().trim();
    const freqText = $(cells[2]).text().trim();
    if (!dayText || !itemText) return;

    const days = extractDays(dayText);
    if (days.length === 0) return;
    const day = days[0];
    const pattern = freqText === '隔週' ? '隔週' : undefined;

    let type: PickupType | undefined;
    if (TACHIKAWA_ITEM_MAP[itemText]) {
      type = TACHIKAWA_ITEM_MAP[itemText];
    } else {
      for (const part of itemText.split('・').filter(Boolean)) {
        if (TACHIKAWA_ITEM_MAP[part]) {
          type = TACHIKAWA_ITEM_MAP[part];
          break;
        }
      }
    }
    if (!type) return;
    const key = `${day}-${type}`;
    if (!added.has(key)) {
      added.add(key);
      pickups.push({ day, type, pattern });
    }
  });

  return {
    ward: 'Tachikawa',
    version: new Date().toISOString().slice(0, 10),
    pickups: pickups.sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)),
    source: 'Web (Tachikawa)',
  };
}

async function fetchHigashikurumeSchedule(): Promise<Schedule> {
  const url = 'https://www.city.higashikurume.lg.jp/kurashi/kankyo/shigen/1018874/1000817.html';
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);
  const pickups: Pickup[] = [];
  const added = new Set<string>();

  const eastH3 = $('h3').filter((_, h3) => $(h3).text().includes('東地区')).first();
  let el = eastH3.next();
  while (el.length && el.is('p') && el.text().includes('：')) {
    const text = el.text().trim();
    const match = text.match(/^(.+?)：(.+)$/);
    if (match) {
      const dayText = match[1].trim();
      const itemsText = match[2].trim();
      const days = extractDays(dayText);
      if (days.length > 0) {
        const day = days[0];
        const items = itemsText.split('・').filter(Boolean);
        for (const item of items) {
          const type = HIGASHIKURUME_ITEM_MAP[item];
          if (!type) continue;
          const key = `${day}-${type}`;
          if (!added.has(key)) {
            added.add(key);
            pickups.push({ day, type });
          }
        }
      }
    }
    el = el.next();
  }

  return {
    ward: 'Higashikurume',
    version: new Date().toISOString().slice(0, 10),
    pickups: pickups.sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)),
    source: 'Web (Higashikurume)',
  };
}

function fetchAdachiSchedule(): Schedule {
  return {
    ward: 'Adachi-ku',
    station: '舎人 (Toneri)',
    version: new Date().toISOString().slice(0, 10),
    pickups: [
      { day: 'Wed', type: 'burnable' as PickupType },
      { day: 'Sat', type: 'burnable' as PickupType },
      { day: 'Mon', type: 'bulk' as PickupType, pattern: '第1・3' },
      { day: 'Thu', type: 'paper' as PickupType },
      { day: 'Thu', type: 'cans' as PickupType },
      { day: 'Thu', type: 'bottles' as PickupType },
      { day: 'Tue', type: 'plastic' as PickupType },
    ].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)),
    bulkyFees: [
      { item: 'Sofa', feeYen: 800 },
      { item: 'Bicycle', feeYen: 600 },
      { item: 'Futon set', feeYen: 400 },
    ],
    source: 'Manual (Toneri)',
  };
}

async function fetchOtaXLSX(): Promise<Record<string, string>[]> {
  const res = await fetch('https://www.opendata.metro.tokyo.lg.jp/ootaku/131113_shigengomiyoubi.xlsx');
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: (string | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const rows: Record<string, string>[] = [];
  for (const row of raw) {
    const townCol = (row[1] || '').toString().trim();
    const plastic = (row[3] || '').toString().replace(/[\r\n]/g, '').trim();
    const paper = (row[4] || '').toString().replace(/[\r\n]/g, '').trim();
    const burnable = (row[5] || '').toString().replace(/[\r\n]/g, '').trim();
    const bulk = (row[6] || '').toString().replace(/[\r\n]/g, '').trim();
    if (townCol === '町丁目名') continue;
    if (!DAY_CHECK.test(plastic) && !DAY_CHECK.test(paper) && !DAY_CHECK.test(burnable) && !DAY_CHECK.test(bulk)) continue;
    rows.push({ 'プラ': plastic, '資源': paper, '可燃ごみ': burnable, '不燃ごみ': bulk });
  }
  return rows;
}

async function fetchWardSchedule(config: WardConfig): Promise<Schedule | null> {
  try {
    let rows: Record<string, string>[];
    let sourceLabel: string;

    switch (config.ward) {
      case 'Chiyoda-ku':
      case 'Minato-ku':
      case 'Meguro-ku':
      case 'Shibuya-ku':
      case 'Toshima-ku':
      case 'Kita-ku':
      case 'Itabashi-ku':
      case 'Katsushika-ku':
      case 'Saitama-shi':
        return verifiedRepresentativeSchedule(config);
      case 'Nerima-ku':
        rows = await fetchNerimaTable();
        sourceLabel = `Web (${config.ward})`;
        break;
      case 'Shinjuku-ku':
        rows = await fetchShinjukuTable();
        sourceLabel = `Web (${config.ward})`;
        break;
      case 'Setagaya-ku':
        rows = await fetchSetagayaTable();
        sourceLabel = `Web (${config.ward})`;
        break;
      case 'Edogawa-ku':
        rows = await fetchEdogawaTable();
        sourceLabel = `Web (${config.ward})`;
        break;
      case 'Arakawa-ku':
        rows = await fetchArakawaTable();
        sourceLabel = `Web (${config.ward})`;
        break;
      case 'Ota-ku':
        rows = await fetchOtaXLSX();
        sourceLabel = `CSV (${config.ward})`;
        break;
      case 'Tachikawa':
        return await fetchTachikawaSchedule();
      case 'Higashikurume':
        return await fetchHigashikurumeSchedule();
      case 'Adachi-ku':
        return fetchAdachiSchedule();
      default:
        switch (config.source.type) {
          case 'api':
            rows = await fetchAPIData(config.source.id);
            sourceLabel = `Tokyo Open Data API (${config.ward})`;
            break;
          case 'csv':
            rows = await fetchCSV(config.source.url);
            sourceLabel = `CSV (${config.ward})`;
            break;
          case 'html-table':
            rows = await fetchHTMLTable(config.source.url);
            sourceLabel = `Web (${config.ward})`;
            break;
        }
    }

    if (rows.length === 0) { console.warn(`  No data for ${config.ward}`); return null; }

    const isShinagawa = config.ward === 'Shinagawa-ku';
    const pickups = isShinagawa ? extractShinagawaSchedule(rows, config.mapping) : extractPickupSchedule(rows, config.mapping);

    return {
      ward: config.ward,
      version: new Date().toISOString().slice(0, 10),
      pickups,
      bulkyFees: config.bulkyFees,
      source: sourceLabel,
    };
  } catch (err) {
    console.warn(`  Fetch failed for ${config.ward}:`, err);
    return null;
  }
}

async function main() {
  const stamp = new Date().toISOString().slice(0, 10);
  const dir = 'public/data/samples';
  const tmpDir = path.join('public/data', `.samples-${stamp}-${process.pid}`);
  mkdirSync(tmpDir, { recursive: true });
  const areas: { ward: string; aliases: string[]; file: string }[] = [];
  const failures: string[] = [];
  let wroteIndex = false;

  try {
    for (const ward of WARDS) {
      console.log(`Fetching ${ward.ward}...`);
      const schedule = await fetchWardSchedule(ward);
      if (schedule) {
        const filename = `${ward.ward.toLowerCase()}@${stamp}.json`;
        writeFileSync(path.join(tmpDir, filename), JSON.stringify(schedule, null, 2));
        areas.push({ ward: ward.ward, aliases: ward.aliases, file: `samples/${filename}` });
        console.log(`  ${schedule.pickups.length} pickups written`);
      } else {
        failures.push(ward.ward);
      }
    }

    if (failures.length > 0) {
      console.error(`\nData update incomplete: ${failures.length} of ${WARDS.length} areas failed.`);
      console.error(`Missing areas: ${failures.join(', ')}`);
      console.error('Aborting without replacing public/data/index.json or public/data/samples.');
      process.exitCode = 1;
      return;
    }

    rmSync(dir, { recursive: true, force: true });
    renameSync(tmpDir, dir);
    writeFileSync('public/data/index.json', JSON.stringify({ version: stamp, areas }, null, 2));
    wroteIndex = true;
    console.log(`\nUpdated index.json with ${areas.length} areas`);
  } finally {
    if (!wroteIndex) {
      rmSync(tmpDir, { recursive: true, force: true });
      console.log('Existing generated data was left unchanged.');
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
