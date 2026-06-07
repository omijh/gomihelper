'use client';
import { useEffect, useRef, useState } from 'react';
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

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    placeholder: 'Search ward...',
    search: 'Search',
    datasetVersion: 'Dataset version',
    weeklyPickups: 'Weekly pickups',
    bulkyFees: 'Bulky-item fees',
    feedback: 'Feedback',
    code: 'Code: MIT · Data: CC BY 4.0',
    hint: 'Try Chuo, Bunkyo, Taito, Nakano\u2026',
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
    placeholder: '区名を検索...',
    search: '検索',
    datasetVersion: 'データ版',
    weeklyPickups: '週間の収集',
    bulkyFees: '粗大ごみ料金',
    feedback: 'ご意見',
    code: 'コード: MIT · データ: CC BY 4.0',
    hint: '例：中央区、文京区、台東区、中野区',
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
  const indexRef = useRef<AreaEntry[] | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved =
      typeof window !== 'undefined'
        ? (window.localStorage.getItem('gh_lang') as Lang | null)
        : null;
    if (saved === 'en' || saved === 'ja') setLang(saved);
    fetch('/data/index.json')
      .then((r) => r.json())
      .then((idx: { areas: AreaEntry[] }) => {
        indexRef.current = idx.areas;
        const hash = window.location.hash.slice(1);
        if (hash) {
          const decoded = decodeURIComponent(hash);
          setQuery(decoded);
          const norm = decoded.toLowerCase().replace(/[ー−]/g, '');
          const match = idx.areas.find((a) =>
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
        }
      })
      .catch(() => {});
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

  const normalize = (s: string) => s.toLowerCase().replace(/[ー−]/g, '').trim();

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
    const norm = normalize(wardName);
    const match = indexRef.current.find((a) =>
      a.aliases.some((alias) => normalize(alias) === norm),
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
    const norm = normalize(q);
    const match = indexRef.current.find((a) =>
      a.aliases.some((alias) => fuzzyMatch(norm, alias)),
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
                    const normed = normalize(v);
                    setSuggestions(
                      indexRef.current.filter((a) =>
                        a.aliases.some((alias) => fuzzyMatch(normed, alias)),
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
                    <span className={styles.suggestionItemEm}>{area.ward}</span>
                    <span className={styles.suggestionAliases}>
                      {area.aliases.slice(1, 4).join(', ')}
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
              <h2>{data.ward}{data.station ? ` · ${data.station}` : ''}</h2>
              <span className={styles.datasetTag}>
                {t('lastUpdated')}: {data.version}
              </span>
            </div>

            <div>
              <h3 className={styles.sectionTitle}>{t('weeklyPickups')}</h3>
              <div className={styles.calendarGrid}>
                {(() => {
                  const byDay: Record<string, Pickup[]> = {};
                  for (const p of data.pickups) {
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
                        <div className={styles.calendarDayName}>{day}</div>
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
                        <td>{fee.item}</td>
                        <td>{'\u00A5'}{fee.feeYen.toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-US')}</td>
                        <td>{fee.notes ?? '\u2014'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}

        <footer className={styles.footer}>
          <span>{t('feedback')}: <a href="mailto:gomihelper@gmail.com">gomihelper@gmail.com</a></span>
          <span>{t('code')}</span>
        </footer>
      </div>
    </main>
  );
}
