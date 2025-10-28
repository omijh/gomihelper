'use client';
import { useEffect, useState } from 'react';

type Lang = 'en' | 'ja';
type PickupType = 'burnable'|'plastic'|'cans'|'bottles'|'paper'|'bulk';

type Schedule = {
  ward: string;
  station?: string;
  version: string; // ISO date
  pickups: { day: string; type: PickupType }[];
  bulkyFees?: { item: string; feeYen: number; notes?: string }[];
};

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    title: 'GomiHelper 🦝',
    tagline: 'Trash day & bulky-item fee lookups. 100% JSON. No login.',
    placeholder: 'Ward / station',
    search: 'Search',
    datasetVersion: 'Dataset version',
    weeklyPickups: 'Weekly pickups',
    bulkyFees: 'Bulky-item fees (¥)',
    feedback: 'Feedback',
    code: 'Code: MIT · Data: CC BY 4.0',
    hint: 'Try a ward name (e.g., Adachi, Meguro, Fukuoka Chūō)…'
  },
  ja: {
    title: 'GomiHelper 🦝',
    tagline: 'ごみ収集日と粗大ごみ料金を検索。100% JSON、ログイン不要。',
    placeholder: '区・駅名',
    search: '検索',
    datasetVersion: 'データ版',
    weeklyPickups: '週間の収集',
    bulkyFees: '粗大ごみ料金 (¥)',
    feedback: 'ご意見',
    code: 'コード: MIT · データ: CC BY 4.0',
    hint: '区名または駅名を入力してください（例：足立区、目黒区、福岡・中央）'
  }
};

const TYPE_LABELS: Record<Lang, Record<PickupType, string>> = {
  en: {
    burnable: 'burnable',
    plastic: 'plastic',
    cans: 'cans',
    bottles: 'bottles',
    paper: 'paper',
    bulk: 'bulk'
  },
  ja: {
    burnable: '可燃ごみ',
    plastic: 'プラ',
    cans: 'かん',
    bottles: 'びん',
    paper: '紙',
    bulk: '粗大ごみ'
  }
};

export default function Home() {
  const [lang, setLang] = useState<Lang>('en');
  const [query, setQuery] = useState('Adachi');
  const [data, setData] = useState<Schedule|null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('gh_lang') as Lang | null : null;
    if (saved === 'en' || saved === 'ja') setLang(saved);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('gh_lang', lang);
  }, [lang]);

  const t = (k: string) => STRINGS[lang][k] || k;

  const search = async () => {
    setLoading(true);
    try {
      const res = await fetch('/data/samples/adachi-ku@2025-10-28.json');
      if (!res.ok) throw new Error(`Failed to load data: ${res.status}`);
      const sample = (await res.json()) as Schedule;
      setData(sample);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { search(); }, []);

  return (
    <main style={{maxWidth:860, margin:'40px auto', padding:'0 16px'}}>
      <header style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
        <h1 style={{margin:0}}>{t('title')}</h1>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button onClick={()=>setLang('en')} aria-pressed={lang==='en'}>EN</button>
          <button onClick={()=>setLang('ja')} aria-pressed={lang==='ja'}>日本語</button>
        </div>
      </header>

      <p style={{marginTop:8}}>{t('tagline')}</p>

      <div style={{display:'flex', gap:8, margin:'16px 0'}}>
        <input
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder={t('placeholder')}
          style={{flex:1, padding:'10px 12px', borderRadius:12, border:'1px solid #ddd'}}
        />
        <button onClick={search} disabled={loading} style={{padding:'10px 14px', borderRadius:12}}>
          {loading ? '…' : t('search')}
        </button>
      </div>

      {!data && <p>{t('hint')}</p>}

      {data && (
        <section>
          <h2 style={{margin:'16px 0'}}>{data.ward}{data.station ? ` · ${data.station}`:''}</h2>
          <small>{t('datasetVersion')}: {data.version}</small>
          <h3 style={{marginTop:16}}>{t('weeklyPickups')}</h3>
          <ul>
            {data.pickups.map((p,i)=>(
              <li key={i}><b>{p.day}:</b> {TYPE_LABELS[lang][p.type]}</li>
            ))}
          </ul>
          {data.bulkyFees?.length ? (
            <>
              <h3>{t('bulkyFees')}</h3>
              <ul>
                {data.bulkyFees.map((b,i)=>(
                  <li key={i}>{b.item}: ¥{b.feeYen}{b.notes?` — ${b.notes}`:''}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      )}

      <footer style={{marginTop:32, fontSize:12, opacity:.8}}>
        {t('feedback')}: <a href="mailto:gomihelper@gmail.com">gomihelper@gmail.com</a> · {t('code')}
      </footer>
    </main>
  );
}
