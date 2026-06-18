'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './page.module.css';

type Lang = 'en' | 'ja';
type PickupType = 'burnable' | 'plastic' | 'cans' | 'bottles' | 'paper' | 'bulk';
type Pickup = { day: string; type: PickupType; pattern?: string };

type Schedule = {
  ward: string;
  station?: string;
  version: string;
  pickups: Pickup[];
  bulkyFees?: { item: string; feeYen: number; notes?: string }[];
};

type AreaEntry = {
  ward: string;
  aliases: string[];
  file: string;
};

type IndexData = { version: string; areas: AreaEntry[] };

const INDEX_CACHE_KEY = 'gh_index';
const ALL_TYPES: PickupType[] = ['burnable', 'plastic', 'cans', 'bottles', 'paper', 'bulk'];

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    placeholder: 'Search ward...',
    search: 'Search',
    datasetVersion: 'Dataset version',
    weeklyPickups: 'Weekly pickups',
    bulkyFees: 'Bulky-item fees',
    feedback: 'Feedback',
    code: 'Code: MIT · Data: CC BY 4.0',
    hint: 'Try Chuo, Bunkyo, Saitama, Nakano\u2026',
    loading: 'Loading\u2026',
    lastUpdated: 'Last updated',
    emptyState: 'Start by searching for your area.',
    detectLocation: 'Detect my location',
    detecting: 'Detecting\u2026',
    geoNotFound: 'Could not determine your ward. Try typing it manually.',
    geoDenied: 'Location access denied. Please type your ward manually.',
    geoUnavailable: 'Location unavailable on this device.',
    feesHeaderItem: 'Item',
    feesHeaderFee: 'Fee',
    feesHeaderNotes: 'Notes',
  },
  ja: {
    placeholder: '市区町村を検索...',
    search: '検索',
    datasetVersion: 'データ版',
    weeklyPickups: '週間の収集',
    bulkyFees: '粗大ごみ料金',
    feedback: 'ご意見',
    code: 'コード: MIT · データ: CC BY 4.0',
    hint: '例：中央区、文京区、さいたま市、中野区',
    loading: '読み込み中…',
    lastUpdated: '最終更新日',
    emptyState: 'お住まいの地域を検索してください。',
    detectLocation: '現在地を検出',
    detecting: '検出中…',
    geoNotFound: '区を特定できませんでした。手動で入力してください。',
    geoDenied: '位置情報が拒否されました。手動で入力してください。',
    geoUnavailable: 'お使いの端末では位置情報が利用できません。',
    feesHeaderItem: '品目',
    feesHeaderFee: '料金',
    feesHeaderNotes: '備考',
  },
};

const TYPE_LABELS: Record<Lang, Record<PickupType, string>> = {
  en: {
    burnable: 'burnable',
    plastic: 'plastic',
    cans: 'cans',
    bottles: 'bottles',
    paper: 'paper',
    bulk: 'bulk',
  },
  ja: {
    burnable: '可燃ごみ',
    plastic: 'プラ',
    cans: 'かん',
    bottles: 'びん',
    paper: '紙',
    bulk: '粗大ごみ',
  },
};

const TYPE_DESCRIPTIONS: Record<Lang, Record<PickupType, string>> = {
  en: {
    burnable: 'Kitchen waste, paper, diapers, etc.',
    plastic: 'Plastic containers & packaging',
    cans: 'Aluminum & steel cans',
    bottles: 'Glass bottles & PET bottles',
    paper: 'Newspapers, magazines, cardboard',
    bulk: 'Large garbage (fees apply)',
  },
  ja: {
    burnable: '生ごみ、紙類、紙おむつなど',
    plastic: '容器包装プラスチック',
    cans: 'アルミ缶・スチール缶',
    bottles: 'びん・ペットボトル',
    paper: '新聞・雑誌・段ボール',
    bulk: '粗大ごみ（有料）',
  },
};

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DAY_LABELS: Record<Lang, Record<string, string>> = {
  en: { Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat', Sun: 'Sun' },
  ja: { Mon: '月', Tue: '火', Wed: '水', Thu: '木', Fri: '金', Sat: '土', Sun: '日' },
};

const AREA_JA_NAMES: Record<string, string> = {
  'Chuo-ku': '中央区',
  'Bunkyo-ku': '文京区',
  'Nakano-ku': '中野区',
  'Koto-ku': '江東区',
  'Sumida-ku': '墨田区',
  'Shinagawa-ku': '品川区',
  'Taito-ku': '台東区',
  'Kiyose-shi': '清瀬市',
  'Suginami-ku': '杉並区',
  'Adachi-ku': '足立区',
  'Nerima-ku': '練馬区',
  'Shinjuku-ku': '新宿区',
  'Setagaya-ku': '世田谷区',
  'Edogawa-ku': '江戸川区',
  'Arakawa-ku': '荒川区',
  'Ota-ku': '大田区',
  'Chiyoda-ku': '千代田区',
  'Minato-ku': '港区',
  'Meguro-ku': '目黒区',
  'Shibuya-ku': '渋谷区',
  'Toshima-ku': '豊島区',
  'Kita-ku': '北区',
  'Itabashi-ku': '板橋区',
  'Katsushika-ku': '葛飾区',
  Tachikawa: '立川市',
  Higashikurume: '東久留米市',
  'Saitama-shi': 'さいたま市',
};

const EXTRA_AREA_ALIASES: Record<string, string[]> = {
  'Chuo-ku': ['ちゅうおうく', 'チュウオウク', 'ちゅうおう'],
  'Bunkyo-ku': ['ぶんきょうく', 'ブンキョウク', 'ぶんきょう'],
  'Nakano-ku': ['なかのく', 'ナカノク', 'なかの'],
  'Koto-ku': ['こうとうく', 'コウトウク', 'こうとう'],
  'Sumida-ku': ['すみだく', 'スミダク', 'すみだ'],
  'Shinagawa-ku': ['しながわく', 'シナガワク', 'しながわ'],
  'Taito-ku': ['たいとうく', 'タイトウク', 'たいとう'],
  'Kiyose-shi': ['きよせし', 'キヨセシ', 'きよせ'],
  'Suginami-ku': ['すぎなみく', 'スギナミク', 'すぎなみ'],
  'Adachi-ku': ['あだちく', 'アダチク', 'あだち'],
  'Nerima-ku': ['ねりまく', 'ネリマク', 'ねりま'],
  'Shinjuku-ku': ['しんじゅくく', 'シンジュクク', 'しんじゅく'],
  'Setagaya-ku': ['せたがやく', 'セタガヤク', 'せたがや'],
  'Edogawa-ku': ['えどがわく', 'エドガワク', 'えどがわ'],
  'Arakawa-ku': ['あらかわく', 'アラカワク', 'あらかわ'],
  'Ota-ku': ['おおたく', 'オオタク', 'おおた'],
  'Chiyoda-ku': ['ちよだく', 'チヨダク', 'ちよだ'],
  'Minato-ku': ['みなとく', 'ミナトク', 'みなと'],
  'Meguro-ku': ['めぐろく', 'メグロク', 'めぐろ'],
  'Shibuya-ku': ['しぶやく', 'シブヤク', 'しぶや'],
  'Toshima-ku': ['としまく', 'トシマク', 'としま'],
  'Kita-ku': ['きたく', 'キタク', 'きた'],
  'Itabashi-ku': ['いたばしく', 'イタバシク', 'いたばし'],
  'Katsushika-ku': ['かつしかく', 'カツシカク', 'かつしか'],
  Tachikawa: ['たちかわし', 'タチカワシ', 'たちかわ'],
  Higashikurume: ['ひがしくるめし', 'ヒガシクルメシ', 'ひがしくるめ'],
  'Saitama-shi': ['さいたまし', 'サイタマシ', 'さいたま', 'いわつきく', 'イワツキク', 'いわつき'],
};

const BULKY_FEE_TRANSLATIONS: Record<string, string> = {
  'Sofa (2-seat)': 'ソファ（2人掛け）',
  'Sofa': 'ソファ',
  'Bicycle': '自転車',
  'Futon set': '布団一式',
  'Small chair': '小型いす',
  'Electric fan': '扇風機',
  'Tatami mat': '畳',
  'Desk (small)': '机（小型）',
  'Washing machine': '洗濯機',
  Bookshelf: '本棚',
  Futon: '布団',
  Desk: '机',
  'Electric kotatsu': '電気こたつ',
  'Large furniture': '大型家具',
  'Small furniture': '小型家具',
  'Oversized item collection': '粗大ごみ戸別収集',
  'Spring mattress': 'スプリング入りマットレス',
  'Spring sofa': 'スプリング入りソファ',
};

const BULKY_NOTE_TRANSLATIONS: Record<string, string> = {
  'per mat': '1枚あたり',
  'under 15kg': '15kg未満',
  'over 50cm': '50cm超',
  'under 50cm': '50cm未満',
  'per item': '1品あたり',
};

const TYPE_TO_STYLE: Record<PickupType, string> = {
  burnable: styles.typeBadgeBurnable,
  plastic: styles.typeBadgePlastic,
  cans: styles.typeBadgeCans,
  bottles: styles.typeBadgeBottles,
  paper: styles.typeBadgePaper,
  bulk: styles.typeBadgeBulk,
};

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) { d[i] = [i]; }
  for (let j = 0; j <= n; j++) { d[0][j] = j; }
  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase().replace(/[ー−]/g, '');
  const t = target.toLowerCase().replace(/[ー−]/g, '');
  if (t.includes(q) || q.includes(t)) return true;
  if (q.length < 2) return false;
  return levenshtein(q, t) <= Math.max(1, Math.floor(q.length / 3));
}

export default function Home() {
  const [lang, setLang] = useState<Lang>('en');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [suggestions, setSuggestions] = useState<AreaEntry[]>([]);
  const [filterType, setFilterType] = useState<PickupType | null>(null);
  const indexRef = useRef<AreaEntry[] | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const loadFromHash = useCallback((areas: AreaEntry[]) => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const decoded = decodeURIComponent(hash);
    setQuery(decoded);
    const norm = decoded.toLowerCase().replace(/[ー−]/g, '');
    const match = areas.find((a) =>
      a.aliases.some((alias) => alias.toLowerCase().replace(/[ー−]/g, '') === norm),
    );
    if (match) {
      setLoading(true);
      fetch(`/data/${match.file}`)
        .then((r) => r.json())
        .then((d: Schedule) => { setData(d); setQuery(d.ward); })
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    const saved =
      typeof window !== 'undefined'
        ? (window.localStorage.getItem('gh_lang') as Lang | null)
        : null;
    if (saved === 'en' || saved === 'ja') setLang(saved);
    const cached = localStorage.getItem(INDEX_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as IndexData;
        indexRef.current = parsed.areas;
        loadFromHash(parsed.areas);
        return;
      } catch { /* fall through to fetch */ }
    }
    fetch('/data/index.json')
      .then((r) => r.json())
      .then((idx: IndexData) => {
        indexRef.current = idx.areas;
        localStorage.setItem(INDEX_CACHE_KEY, JSON.stringify(idx));
        loadFromHash(idx.areas);
      })
      .catch(() => {});
  }, [loadFromHash]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('gh_lang', lang);
  }, [lang]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (data && typeof window !== 'undefined') {
      history.replaceState(null, '', `#${encodeURIComponent(data.ward)}`);
    }
  }, [data]);

  const t = (key: string) => STRINGS[lang][key] || key;

  const normalize = (s: string) =>
    s
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[ァ-ン]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .replace(/東京都|東京|市区町村|[\s\-ー−・.。,_]/g, '')
      .trim();

  const getAreaTerms = (area: AreaEntry) => [
    area.ward,
    area.ward.replace(/-(ku|shi)$/i, ''),
    AREA_JA_NAMES[area.ward],
    AREA_JA_NAMES[area.ward]?.replace(/[区市]$/, ''),
    ...(EXTRA_AREA_ALIASES[area.ward] ?? []),
    ...area.aliases,
  ].filter(Boolean);

  const areaMatches = (area: AreaEntry, value: string, exact = false) => {
    const norm = normalize(value);
    return getAreaTerms(area).some((term) => {
      const normalizedTerm = normalize(term);
      return exact ? normalizedTerm === norm : fuzzyMatch(norm, normalizedTerm);
    });
  };

  const formatAreaName = (ward: string) => (lang === 'ja' ? AREA_JA_NAMES[ward] ?? ward : ward);
  const formatBulkyItem = (item: string) => (lang === 'ja' ? BULKY_FEE_TRANSLATIONS[item] ?? item : item);
  const formatBulkyNote = (notes?: string) => {
    if (!notes) return '\u2014';
    return lang === 'ja' ? BULKY_NOTE_TRANSLATIONS[notes] ?? notes : notes;
  };

  const searchByMatch = async (match: AreaEntry) => {
    setLoading(true);
    setNotFound(false);
    setGeoError('');
    setSuggestions([]);
    try {
      const res = await fetch(`/data/${match.file}`);
      if (!res.ok) throw new Error(`Failed to load data: ${res.status}`);
      const d = (await res.json()) as Schedule;
      setData(d);
      setFilterType(null);
      setQuery(d.ward);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const selectSuggestion = (area: AreaEntry) => {
    setQuery(area.ward);
    setSuggestions([]);
    searchByMatch(area);
  };

  const searchByWardName = (wardName: string): boolean => {
    if (!indexRef.current) return false;
    const match = indexRef.current.find((a) =>
      areaMatches(a, wardName, true),
    );
    if (!match) return false;
    searchByMatch(match);
    return true;
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGeoError(t('geoUnavailable'));
      return;
    }
    setDetecting(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&accept-language=ja`,
            { headers: { 'User-Agent': 'GomiHelper/1.0' } },
          );
          const geo = await res.json();
          const addr = geo.address || {};
          const wardName = addr.city || addr.town || addr.suburb || addr.neighbourhood || '';
          if (!searchByWardName(wardName)) {
            setGeoError(t('geoNotFound'));
          }
        } catch {
          setGeoError(t('geoNotFound'));
        } finally {
          setDetecting(false);
        }
      },
      (err) => {
        setDetecting(false);
        if (err.code === err.PERMISSION_DENIED) setGeoError(t('geoDenied'));
        else setGeoError(t('geoNotFound'));
      },
      { timeout: 10000 },
    );
  };

  const search = async () => {
    const q = query.trim();
    if (!q || !indexRef.current) return;
    setGeoError('');
    setSuggestions([]);
    const match = indexRef.current.find((a) =>
      areaMatches(a, q),
    );
    if (!match) {
      setNotFound(true);
      return;
    }
    await searchByMatch(match);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search();
  };

  return (
    <main className={styles.page}>
      <div className={styles.surface}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.logo}>{'\u{1F99D}'}</span>
            <span className={styles.title}>GomiHelper</span>
          </div>
          <div className={styles.langSwitch} role="radiogroup" aria-label="Language">
            <button
              type="button"
              className={`${styles.langButton} ${lang === 'en' ? styles.langButtonActive : ''}`}
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
            >
              EN
            </button>
            <button
              type="button"
              className={`${styles.langButton} ${lang === 'ja' ? styles.langButtonActive : ''}`}
              onClick={() => setLang('ja')}
              aria-pressed={lang === 'ja'}
            >
              {'\u65E5\u672C\u8A9E'}
            </button>
          </div>
        </header>

        <div className={styles.hero}>
          <div className={styles.searchWrap} ref={searchRef}>
            <div className={styles.searchRow}>
              <input
                value={query}
                onChange={(e) => {
                  const v = e.target.value;
                  setQuery(v);
                  if (v.trim().length >= 1 && indexRef.current) {
                    setSuggestions(
                      indexRef.current.filter((a) =>
                        areaMatches(a, v),
                      ).slice(0, 6),
                    );
                  } else {
                    setSuggestions([]);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder={t('placeholder')}
                className={styles.input}
                aria-label={t('placeholder')}
              />
              <button onClick={search} disabled={loading || detecting} className={styles.ctaButton}>
                {loading ? t('loading') : t('search')}
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className={styles.suggestions}>
                {suggestions.map((area) => (
                  <button
                    key={area.ward}
                    className={styles.suggestionItem}
                    onMouseDown={(e) => { e.preventDefault(); selectSuggestion(area); }}
                  >
                    <span className={styles.suggestionItemEm}>{formatAreaName(area.ward)}</span>
                    <span className={styles.suggestionAliases}>
                      {getAreaTerms(area).filter((term) => term !== area.ward && term !== AREA_JA_NAMES[area.ward]).slice(0, 3).join(', ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className={styles.hint}>{t('hint')}</p>
          <div className={styles.actions}>
            <button
              onClick={detectLocation}
              disabled={loading || detecting}
              className={styles.geoButton}
              type="button"
            >
              {detecting ? t('detecting') : t('detectLocation')}
            </button>
            {geoError && <span className={styles.geoError}>{geoError}</span>}
          </div>
        </div>

        {loading && (
          <div className={styles.skeleton}>
            <div className={styles.skelHeader}>
              <div className={styles.skelLine} style={{ width: '40%' }} />
              <div className={styles.skelLine} style={{ width: '25%' }} />
            </div>
            <div className={styles.skelGrid}>
              {DAY_ORDER.map((d) => (
                <div key={d} className={styles.skelDay}>
                  <div className={styles.skelLine} style={{ width: '70%', height: 10, margin: '0 auto 8px' }} />
                  <div className={styles.skelLine} style={{ width: '60%', height: 8, margin: '2px auto' }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && notFound && <div className={styles.emptyState}>{t('hint')}</div>}

        {!loading && !data && !notFound && (
          <div className={styles.emptyState}>{t('emptyState')}</div>
        )}

        {data && !loading && (
          <div className={styles.result}>
            <div className={styles.resultHeader}>
              <h2>{formatAreaName(data.ward)}{data.station ? ` · ${data.station}` : ''}</h2>
              <span className={styles.datasetTag}>
                {t('lastUpdated')}: {data.version}
              </span>
            </div>

            <div>
              <h3 className={styles.sectionTitle}>{t('weeklyPickups')}</h3>
              <div className={styles.filterRow}>
                <button
                  className={`${styles.filterBtn} ${filterType === null ? styles.filterBtnActive : ''}`}
                  onClick={() => setFilterType(null)}
                  type="button"
                >
                  {lang === 'ja' ? 'すべて' : 'All'}
                </button>
                {ALL_TYPES.map((t) => (
                  <button
                    key={t}
                    className={`${styles.filterBtn} ${filterType === t ? styles.filterBtnActive : ''}`}
                    onClick={() => setFilterType(t)}
                    title={TYPE_DESCRIPTIONS[lang][t]}
                    type="button"
                  >
                    {TYPE_LABELS[lang][t]}
                  </button>
                ))}
              </div>
              <div className={styles.calendarGrid}>
                {(() => {
                  const byDay: Record<string, Pickup[]> = {};
                  for (const p of data.pickups) {
                    if (filterType && p.type !== filterType) continue;
                    (byDay[p.day] ??= []).push(p);
                  }
                  const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
                  return DAY_ORDER.map((day) => {
                    const pickups = byDay[day] ?? [];
                    const isToday = day === today;
                    return (
                      <div
                        key={day}
                        className={`${styles.calendarDay} ${isToday ? styles.calendarDayToday : ''}`}
                      >
                        <div className={styles.calendarDayName}>{DAY_LABELS[lang][day]}</div>
                        {pickups.length > 0 ? pickups.map((p) => (
                          <span
                            key={p.type}
                            className={`${styles.typeBadge} ${TYPE_TO_STYLE[p.type]}`}
                            title={TYPE_DESCRIPTIONS[lang][p.type]}
                          >
                            {TYPE_LABELS[lang][p.type]}
                          </span>
                        )) : <div className={styles.calendarDayEmpty} />}
                        {pickups.some((p) => p.pattern) && (
                          <div className={styles.patternLine}>
                            {pickups.filter((p) => p.pattern).map((p) => p.pattern).join(' ')}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {data.bulkyFees?.length ? (
              <div>
                <h3 className={styles.sectionTitle}>{t('bulkyFees')}</h3>
                <table className={styles.bulkyTable}>
                  <thead>
                    <tr>
                      <th>{t('feesHeaderItem')}</th>
                      <th>{t('feesHeaderFee')}</th>
                      <th>{t('feesHeaderNotes')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bulkyFees.map((fee, index) => (
                      <tr key={`${fee.item}-${index}`}>
                        <td>{formatBulkyItem(fee.item)}</td>
                        <td>{'\u00A5'}{fee.feeYen.toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-US')}</td>
                        <td>{formatBulkyNote(fee.notes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}

        <footer className={styles.footer}>
          <span><a href="/submit">{lang === 'ja' ? 'データを提供' : 'Submit data'}</a> &middot; {t('feedback')}: <a href="mailto:gomihelper@gmail.com">gomihelper@gmail.com</a></span>
          <span>{t('code')}</span>
        </footer>
      </div>
    </main>
  );
}
