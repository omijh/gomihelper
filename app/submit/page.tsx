'use client';
import { useState } from 'react';
import styles from './submit.module.css';

type Lang = 'en' | 'ja';
type PickupType = 'burnable' | 'plastic' | 'cans' | 'bottles' | 'paper' | 'bulk';

const ALL_TYPES: PickupType[] = ['burnable', 'plastic', 'cans', 'bottles', 'paper', 'bulk'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TYPE_LABELS: Record<Lang, Record<PickupType, string>> = {
  en: { burnable: 'Burnable', plastic: 'Plastic', cans: 'Cans', bottles: 'Bottles', paper: 'Paper', bulk: 'Bulk' },
  ja: { burnable: '燃やすごみ', plastic: 'プラ', cans: 'かん', bottles: 'びん', paper: '紙', bulk: '粗大ごみ' },
};

const DAY_LABELS: Record<Lang, Record<string, string>> = {
  en: { Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat', Sun: 'Sun' },
  ja: { Mon: '月', Tue: '火', Wed: '水', Thu: '木', Fri: '金', Sat: '土', Sun: '日' },
};

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    title: 'Submit Schedule Data',
    desc: 'Help us expand coverage! Fill in the garbage collection schedule for your area.',
    wardLabel: 'Ward / City',
    wardPlaceholder: 'e.g. Shinjuku-ku, Hachioji-shi',
    areaLabel: 'Area / Neighborhood',
    areaPlaceholder: 'e.g. Toneri, Nishi-Shinjuku',
    sourceLabel: 'Source URL (optional)',
    sourcePlaceholder: 'Link to the official schedule page',
    schedule: 'Collection Schedule',
    patternLabel: 'Pattern',
    weekly: 'Weekly',
    notesLabel: 'Additional Notes',
    notesPlaceholder: 'Any special rules, exceptions, or corrections...',
    submit: 'Open in Email Client',
    sent: 'Thanks! Your data has been prepared. Please send the email to complete submission.',
    sendAnother: 'Submit another',
    email: 'gomihelper@gmail.com',
  },
  ja: {
    title: '収集データの提供',
    desc: '収集エリアの拡充にご協力ください。お住まいの地域のごみ収集スケジュールを入力してください。',
    wardLabel: '市区町村',
    wardPlaceholder: '例：新宿区、八王子市',
    areaLabel: '地域・町名',
    areaPlaceholder: '例：舎人、西新宿',
    sourceLabel: 'ソースURL（任意）',
    sourcePlaceholder: '公式ページへのリンク',
    schedule: '収集スケジュール',
    patternLabel: '頻度',
    weekly: '毎週',
    notesLabel: '備考',
    notesPlaceholder: '特別なルールや例外など...',
    submit: 'メールクライアントを開く',
    sent: 'データが準備されました。メールを送信して完了してください。',
    sendAnother: '別のデータを送る',
    email: 'gomihelper@gmail.com',
  },
};

const PATTERNS: Record<Lang, { value: string; label: string }[]> = {
  en: [
    { value: '', label: 'Weekly' },
    { value: '第1・3', label: '1st & 3rd' },
    { value: '第2・4', label: '2nd & 4th' },
    { value: '隔週', label: 'Alternating' },
    { value: '第1', label: '1st only' },
    { value: '第2', label: '2nd only' },
    { value: '第3', label: '3rd only' },
    { value: '第4', label: '4th only' },
  ],
  ja: [
    { value: '', label: '毎週' },
    { value: '第1・3', label: '第1・3' },
    { value: '第2・4', label: '第2・4' },
    { value: '隔週', label: '隔週' },
    { value: '第1', label: '第1のみ' },
    { value: '第2', label: '第2のみ' },
    { value: '第3', label: '第3のみ' },
    { value: '第4', label: '第4のみ' },
  ],
};

export default function SubmitPage() {
  const [lang, setLang] = useState<Lang>('en');
  const [ward, setWard] = useState('');
  const [area, setArea] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [sent, setSent] = useState(false);
  const [schedule, setSchedule] = useState<Record<string, { days: string[]; pattern: string }>>(
    Object.fromEntries(ALL_TYPES.map((t) => [t, { days: [], pattern: '' }])),
  );

  const t = (key: string) => STRINGS[lang][key] || key;

  const toggleDay = (type: PickupType, day: string) => {
    setSchedule((prev) => {
      const cur = prev[type];
      const days = cur.days.includes(day)
        ? cur.days.filter((d) => d !== day)
        : [...cur.days, day].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
      return { ...prev, [type]: { ...cur, days } };
    });
  };

  const setPattern = (type: PickupType, pattern: string) => {
    setSchedule((prev) => ({ ...prev, [type]: { ...prev[type], pattern } }));
  };

  const buildBody = () => {
    const lines: string[] = [];
    lines.push(`Ward: ${ward}`);
    lines.push(`Area: ${area}`);
    if (source) lines.push(`Source: ${source}`);
    lines.push('');
    lines.push('--- Schedule ---');
    for (const type of ALL_TYPES) {
      const entry = schedule[type];
      if (entry.days.length === 0) continue;
      const dayStr = entry.days.join(', ');
      const pat = entry.pattern ? ` (${entry.pattern})` : '';
      lines.push(`${TYPE_LABELS[lang][type]}: ${dayStr}${pat}`);
    }
    if (notes) {
      lines.push('');
      lines.push('--- Notes ---');
      lines.push(notes);
    }
    return lines.join('\n');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = buildBody();
    const subject = encodeURIComponent(`Schedule data: ${ward}${area ? ` - ${area}` : ''}`);
    const mailto = `mailto:${STRINGS[lang].email}?subject=${subject}&body=${encodeURIComponent(body)}`;
    window.open(mailto, '_blank');
    setSent(true);
  };

  const hasData = ALL_TYPES.some((t) => schedule[t].days.length > 0) && ward.trim() && area.trim();

  return (
    <main className={styles.page}>
      <div className={styles.surface}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <a href="/" className={styles.brandLink}><span className={styles.logo}>{'\u{1F99D}'}</span>
            <span className={styles.title}>GomiHelper</span></a>
          </div>
          <div className={styles.langSwitch}>
            <button
              type="button"
              className={`${styles.langButton} ${lang === 'en' ? styles.langButtonActive : ''}`}
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
            >EN</button>
            <button
              type="button"
              className={`${styles.langButton} ${lang === 'ja' ? styles.langButtonActive : ''}`}
              onClick={() => setLang('ja')}
              aria-pressed={lang === 'ja'}
            >{'日本語'}</button>
          </div>
        </header>

        {sent ? (
          <div className={styles.card}>
            <h2 className={styles.greeting}>{'\u2709\uFE0F'}</h2>
            <p>{t('sent')}</p>
            <button onClick={() => { setSent(false); setWard(''); setArea(''); setSource(''); setNotes(''); setSchedule(Object.fromEntries(ALL_TYPES.map((t) => [t, { days: [], pattern: '' }]))); }} className={styles.ctaButton} type="button">{t('sendAnother')}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <h1 className={styles.heading}>{t('title')}</h1>
            <p className={styles.desc}>{t('desc')}</p>

            <label className={styles.field}>
              <span className={styles.label}>{t('wardLabel')} <span className={styles.req}>*</span></span>
              <input value={ward} onChange={(e) => setWard(e.target.value)} placeholder={t('wardPlaceholder')} className={styles.input} required />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{t('areaLabel')} <span className={styles.req}>*</span></span>
              <input value={area} onChange={(e) => setArea(e.target.value)} placeholder={t('areaPlaceholder')} className={styles.input} required />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>{t('sourceLabel')}</span>
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder={t('sourcePlaceholder')} className={styles.input} />
            </label>

            <fieldset className={styles.scheduleSection}>
              <legend className={styles.scheduleLegend}>{t('schedule')}</legend>
              {ALL_TYPES.map((type) => (
                <div key={type} className={styles.typeRow}>
                  <span className={styles.typeName}>{TYPE_LABELS[lang][type]}</span>
                  <div className={styles.dayGroup}>
                    {DAYS.map((day) => (
                      <label key={day} className={styles.dayLabel}>
                        <input
                          type="checkbox"
                          checked={schedule[type].days.includes(day)}
                          onChange={() => toggleDay(type, day)}
                          className={styles.dayCheck}
                        />
                        <span className={styles.dayBox}>{DAY_LABELS[lang][day]}</span>
                      </label>
                    ))}
                  </div>
                  <select
                    value={schedule[type].pattern}
                    onChange={(e) => setPattern(type, e.target.value)}
                    className={styles.patternSelect}
                  >
                    {PATTERNS[lang].map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </fieldset>

            <label className={styles.field}>
              <span className={styles.label}>{t('notesLabel')}</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('notesPlaceholder')} className={styles.textarea} rows={4} />
            </label>

            <button type="submit" disabled={!hasData} className={styles.ctaButton}>{t('submit')}</button>
          </form>
        )}

        <footer className={styles.footer}>
          <a href="mailto:gomihelper@gmail.com">gomihelper@gmail.com</a>
        </footer>
      </div>
    </main>
  );
}
