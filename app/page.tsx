'use client';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import styles from './page.module.css';

type Lang = 'en' | 'ja';
type PickupType = 'burnable' | 'plastic' | 'cans' | 'bottles' | 'paper' | 'bulk';

type Schedule = {
  ward: string;
  station?: string;
  version: string; // ISO date
  pickups: { day: string; type: PickupType; notes?: string }[];
  bulkyFees?: { item: string; feeYen: number; notes?: string }[];
};

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    title: 'GomiHelper',
    tagline: 'Concise recycling guidance for every Japanese ward.',
    placeholder: 'Ward / station',
    search: 'Search schedule',
    datasetVersion: 'Dataset version',
    weeklyPickups: 'Weekly pickups',
    bulkyFees: 'Bulky-item fees (¥)',
    feedback: 'Feedback',
    code: 'Code: MIT · Data: CC BY 4.0',
    hint: 'Try a ward name (e.g., Minato, Meguro, Fukuoka Chūō)…',
    navOverview: 'Overview',
    navSchedule: 'Pickup schedule',
    navPricing: 'Bulky-item pricing',
    navDatasets: 'Dataset guide',
    supportTitle: 'Need a new area?',
    supportText: 'Send us your ward or station—we are expanding coverage weekly.',
    quickStart: 'Quick start',
    quickStartHint: 'Search for any Tokyo ward to preview an example dataset.',
    languageLabel: 'Language',
    loading: 'Loading…',
    lastUpdated: 'Last updated',
    emptyState: 'Start by searching for your area to unlock the latest pickup calendar.',
    feesHeaderItem: 'Item',
    feesHeaderFee: 'Fee',
    feesHeaderNotes: 'Notes',
  },
  ja: {
    title: 'GomiHelper',
    tagline: '全国の自治体向けに、ごみ分別と収集日をすっきり表示。',
    placeholder: '区・駅名',
    search: '収集日を検索',
    datasetVersion: 'データ版',
    weeklyPickups: '週間の収集',
    bulkyFees: '粗大ごみ料金 (¥)',
    feedback: 'ご意見',
    code: 'コード: MIT · データ: CC BY 4.0',
    hint: '区名または駅名を入力してください（例：港区、目黒区、福岡・中央）',
    navOverview: 'ダッシュボード',
    navSchedule: '収集スケジュール',
    navPricing: '粗大ごみ料金',
    navDatasets: 'データセット案内',
    supportTitle: '新しい地域が必要ですか？',
    supportText: '区や駅を教えてください。毎週エリアを追加しています。',
    quickStart: 'クイックスタート',
    quickStartHint: 'まずは東京都内の区名でサンプルデータを確認できます。',
    languageLabel: '言語',
    loading: '読み込み中…',
    lastUpdated: '最終更新日',
    emptyState: 'お住まいの地域を検索して、最新の収集カレンダーを確認しましょう。',
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

export default function Home() {
  const [lang, setLang] = useState<Lang>('en');
  const [query, setQuery] = useState('文京区');
  const [data, setData] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved =
      typeof window !== 'undefined'
        ? (window.localStorage.getItem('gh_lang') as Lang | null)
        : null;
    if (saved === 'en' || saved === 'ja') setLang(saved);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('gh_lang', lang);
  }, [lang]);

  const t = (key: string) => STRINGS[lang][key] || key;

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/schedule?q=${encodeURIComponent(query)}`, {
        cache: 'no-store',
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load dataset');
      setData(json.schedule as Schedule);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    search();
  }, [search]);

  return (
    <main className={styles.page}>
      <div className={styles.surface}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <div className={styles.logo}>🦝</div>
            <div>
              <h1>{t('title')}</h1>
              <p>{t('tagline')}</p>
            </div>
          </div>

          <nav className={styles.nav} aria-label="Primary">
            <button className={`${styles.navButton} ${styles.navButtonActive}`} type="button">
              {t('navOverview')}
            </button>
            <button className={styles.navButton} type="button">
              {t('navSchedule')}
            </button>
            <button className={styles.navButton} type="button">
              {t('navPricing')}
            </button>
            <button className={styles.navButton} type="button">
              {t('navDatasets')}
            </button>
          </nav>

          <div className={styles.support}>
            <h3>{t('supportTitle')}</h3>
            <p>{t('supportText')}</p>
            <a className={styles.badge} href="mailto:gomihelper@gmail.com">
              ✉️ gomihelper@gmail.com
            </a>
          </div>

          <div>
            <p className={styles.helperText}>{t('quickStart')}</p>
            <p className={styles.helperText}>{t('quickStartHint')}</p>
          </div>

          <div>
            <p className={styles.helperText} style={{ marginBottom: 8 }}>
              {t('languageLabel')}
            </p>
            <div className={styles.langSwitch} role="radiogroup" aria-label={t('languageLabel')}>
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
                日本語
              </button>
            </div>
          </div>
        </aside>

        <section className={styles.content}>
          <div className={styles.toolbar}>
            <h2>{t('navSchedule')}</h2>
            {data && (
              <span className={styles.datasetTag}>
                <span role="img" aria-hidden="true">
                  📅
                </span>
                {t('lastUpdated')}: {data.version}
              </span>
            )}
          </div>

          <div className={styles.searchCard}>
            <div>
              <h3 style={{ margin: '0 0 4px' }}>{t('title')}</h3>
              <p className={styles.helperText}>{t('hint')}</p>
            </div>
            <div className={styles.searchRow}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('placeholder')}
                className={styles.input}
                aria-label={t('placeholder')}
              />
              <button onClick={search} disabled={loading} className={styles.ctaButton}>
                <span>{loading ? t('loading') : t('search')}</span>
              </button>
            </div>
          </div>

          {loading && (
            <div className={styles.loading}>{t('loading')}</div>
          )}

          {error && !loading && (
            <div className={styles.emptyState} role="alert">
              {error}
            </div>
          )}

          {!loading && !data && <div className={styles.emptyState}>{t('emptyState')}</div>}

          {data && !loading && (
            <div className={styles.resultCard}>
              <div className={styles.resultHeader}>
                <h3>
                  {data.ward}
                  {data.station ? ` · ${data.station}` : ''}
                </h3>
                <small>
                  {t('datasetVersion')}: {data.version}
                </small>
              </div>

              <div>
                <h4 style={{ margin: '0 0 12px' }}>{t('weeklyPickups')}</h4>
                <div className={styles.pickupGrid}>
                  {data.pickups.map((pickup, index) => (
                    <div key={`${pickup.day}-${index}`} className={styles.pickupCard}>
                      <span className={styles.pickupDay}>{pickup.day}</span>
                      <span className={styles.pickupType}>{TYPE_LABELS[lang][pickup.type]}</span>
                      {pickup.notes ? (
                        <small className={styles.helperText}>{pickup.notes}</small>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {data.bulkyFees?.length ? (
                <div>
                  <h4 style={{ margin: '0 0 12px' }}>{t('bulkyFees')}</h4>
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
                          <td>¥{fee.feeYen.toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-US')}</td>
                          <td>{fee.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}

          <footer className={styles.footer}>
            <span>
              {t('feedback')}: <a href="mailto:gomihelper@gmail.com">gomihelper@gmail.com</a>
            </span>
            <span>{t('code')}</span>
          </footer>

          <Image
            src="/mascot.svg"
            alt="Helpful raccoon mascot pointing to recycling bins"
            width={360}
            height={360}
            className={styles.mascot}
            priority
          />
        </section>
      </div>
    </main>
  );
}
