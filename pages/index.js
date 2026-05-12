import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const TONES = [
  { id: 'enthusiast', emoji: '🔥', label: 'おすすめ系', desc: '熱狂・ポジティブ' },
  { id: 'neutral',    emoji: '📊', label: '情報系',   desc: '客観・レポート' },
  { id: 'critical',   emoji: '🧐', label: '辛口系',   desc: '正直・バランス' },
];
const BOSAI_CATEGORIES = [
  { id: 'random',     emoji: '🎲', label: 'おまかせ',     desc: '幅広いテーマ' },
  { id: 'earthquake', emoji: '🏠', label: '地震対策',     desc: '揺れ・家具固定' },
  { id: 'typhoon',    emoji: '🌀', label: '台風・大雨',   desc: '浸水・停電' },
  { id: 'fire',       emoji: '🔥', label: '火災対策',     desc: '消火・避難' },
  { id: 'stockpile',  emoji: '📦', label: '備蓄',         desc: '食料・水' },
  { id: 'evacuation', emoji: '🏃', label: '避難',         desc: '判断・避難所' },
  { id: 'family',     emoji: '👨‍👩‍👧', label: '家族・ペット', desc: '子供・高齢者' },
  { id: 'daily',      emoji: '💡', label: '日常',         desc: '普段の備え' },
];
const BOSAI_FORMATS = [
  { id: 'tip',       emoji: '💡', label: '豆知識' },
  { id: 'checklist', emoji: '✅', label: 'チェックリスト' },
  { id: 'question',  emoji: '❓', label: 'クイズ' },
  { id: 'story',     emoji: '📖', label: 'ストーリー' },
  { id: 'warning',   emoji: '⚠️', label: '注意喚起' },
  { id: 'seasonal',  emoji: '🗓️', label: '季節' },
];
const DISASTER_TYPES = [
  { id: 'earthquake', emoji: '🌐', label: '地震' },
  { id: 'tsunami',    emoji: '🌊', label: '津波' },
  { id: 'typhoon',    emoji: '🌀', label: '台風' },
  { id: 'heavyrain',  emoji: '🌧️', label: '大雨・洪水' },
  { id: 'volcano',    emoji: '🌋', label: '火山噴火' },
  { id: 'fire',       emoji: '🔥', label: '火災' },
  { id: 'snow',       emoji: '❄️', label: '大雪' },
  { id: 'other',      emoji: '⚠️', label: 'その他' },
];
const LENGTHS = [
  { id: 'short',  label: '短文',  desc: '〜140字'  },
  { id: 'medium', label: '中文',  desc: '〜500字'  },
  { id: 'long',   label: '長文',  desc: '〜2000字' },
];

// P2P地震情報API: maxScale → 震度
function scaleToText(scale) {
  if (scale == null) return '不明';
  const map = { 10:'1', 20:'2', 30:'3', 40:'4', 45:'5弱', 50:'5強', 55:'6弱', 60:'6強', 70:'7' };
  return map[scale] || '不明';
}
function scaleToNumber(scale) {
  // For threshold comparison: returns approximate intensity number
  if (scale == null) return 0;
  if (scale >= 70) return 7;
  if (scale >= 60) return 6.5;
  if (scale >= 55) return 6;
  if (scale >= 50) return 5.5;
  if (scale >= 45) return 5;
  return scale / 10;
}

function isAmazonUrl(u) { return /amazon\.(co\.jp|com|co\.uk|de|fr|ca|com\.au)/i.test(u); }
function extractTag(u) { try { return new URL(u).searchParams.get('tag') || ''; } catch { return ''; } }
function countChars(text) {
  const urls = text.match(/https?:\/\/\S+/g) || [];
  return text.replace(/https?:\/\/\S+/g, '').length + urls.length * 23;
}
function getCurrentSeason() {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5)  return '春';
  if (m >= 6 && m <= 8)  return '夏';
  if (m >= 9 && m <= 11) return '秋';
  return '冬';
}
function maxForLength(l) { return l === 'long' ? 2000 : l === 'medium' ? 500 : 280; }

// Play beep sound using Web Audio API
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beepOnce = (freq, when, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + when);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + when + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + when + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + duration);
    };
    beepOnce(880, 0,    0.3);
    beepOnce(880, 0.4,  0.3);
    beepOnce(1100, 0.8, 0.6);
  } catch (e) {}
}

export default function Home() {
  const [mode, setMode] = useState('bosai');

  // Amazon
  const [url, setUrl] = useState('');
  const [tag, setTag] = useState('');
  const [tone, setTone] = useState('enthusiast');

  // Bosai
  const [category, setCategory] = useState('random');
  const [format, setFormat] = useState('tip');
  const [useSeasonal, setUseSeasonal] = useState(true);

  // Emergency
  const [disasterType, setDisasterType] = useState('earthquake');
  const [emLocation, setEmLocation] = useState('');
  const [emDetails, setEmDetails] = useState('');
  const [autoFetch, setAutoFetch] = useState(true);

  // Common
  const [length, setLength] = useState('short');
  const [step, setStep] = useState('input');
  const [error, setError] = useState('');
  const [posts, setPosts] = useState([]);
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const [product, setProduct] = useState(null);
  const [affUrl, setAffUrl] = useState('');
  const [bosaiTopic, setBosaiTopic] = useState('');
  const [bosaiSource, setBosaiSource] = useState('');
  const [emInfo, setEmInfo] = useState(null);

  // ─── Notification state ───
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState('default');
  const [notifThreshold, setNotifThreshold] = useState(3);
  const [notifSound, setNotifSound] = useState(true);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [recentEqs, setRecentEqs] = useState([]);
  const [lastEqAlert, setLastEqAlert] = useState(null);
  const seenIdsRef = useRef([]);
  const initialFetchDoneRef = useRef(false);

  // Load notification settings from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('eqNotifSettings');
      if (saved) {
        const s = JSON.parse(saved);
        setNotifEnabled(!!s.enabled);
        setNotifThreshold(s.threshold ?? 3);
        setNotifSound(s.sound !== false);
      }
      const seen = localStorage.getItem('eqSeenIds');
      if (seen) seenIdsRef.current = JSON.parse(seen);
      if ('Notification' in window) setNotifPermission(Notification.permission);
    } catch (e) {}
  }, []);

  // Save settings when they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('eqNotifSettings', JSON.stringify({
      enabled: notifEnabled,
      threshold: notifThreshold,
      sound: notifSound,
    }));
  }, [notifEnabled, notifThreshold, notifSound]);

  // ─── Earthquake polling ───
  useEffect(() => {
    if (!notifEnabled) return;
    let cancelled = false;

    async function checkEarthquakes() {
      try {
        const res = await fetch('https://api.p2pquake.net/v2/history?codes=551&limit=10');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        setRecentEqs(data);

        // First fetch: just record IDs, don't notify
        if (!initialFetchDoneRef.current) {
          seenIdsRef.current = data.map(eq => eq.id);
          localStorage.setItem('eqSeenIds', JSON.stringify(seenIdsRef.current));
          initialFetchDoneRef.current = true;
          return;
        }

        // Find new earthquakes above threshold
        for (const eq of data) {
          if (seenIdsRef.current.includes(eq.id)) continue;
          seenIdsRef.current.push(eq.id);

          const intensityValue = scaleToNumber(eq.earthquake?.maxScale);
          if (intensityValue >= notifThreshold) {
            triggerEarthquakeAlert(eq);
          }
        }

        // Trim seen IDs to prevent unbounded growth
        if (seenIdsRef.current.length > 100) {
          seenIdsRef.current = seenIdsRef.current.slice(-100);
        }
        localStorage.setItem('eqSeenIds', JSON.stringify(seenIdsRef.current));
      } catch (e) {
        console.error('Earthquake fetch failed:', e);
      }
    }

    checkEarthquakes();
    const interval = setInterval(checkEarthquakes, 60000); // 1 min
    return () => { cancelled = true; clearInterval(interval); };
  }, [notifEnabled, notifThreshold]);

  function triggerEarthquakeAlert(eq) {
    const place = eq.earthquake?.hypocenter?.name || '震源情報なし';
    const magnitude = eq.earthquake?.hypocenter?.magnitude;
    const intensity = scaleToText(eq.earthquake?.maxScale);
    const time = eq.earthquake?.time || '';

    setLastEqAlert({ id: eq.id, place, magnitude, intensity, time, raw: eq });

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification('🚨 地震速報', {
          body: `${place}\n最大震度 ${intensity}${magnitude != null && magnitude !== -1 ? ` / M${magnitude}` : ''}\n発生時刻: ${time}`,
          tag: eq.id,
          requireInteraction: true,
          badge: '/favicon.ico',
        });
        n.onclick = () => {
          window.focus();
          n.close();
          openEmergencyMode(eq);
        };
      } catch (e) {}
    }

    if (notifSound) playBeep();
  }

  async function requestNotifPermission() {
    if (!('Notification' in window)) {
      alert('このブラウザは通知機能に対応していません');
      return;
    }
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      setNotifEnabled(true);
      // Test notification
      try {
        new Notification('🔔 通知が有効になりました', {
          body: '震度3以上の地震が発生したらお知らせします',
        });
      } catch (e) {}
    }
  }

  function toggleNotif() {
    if (notifPermission === 'granted') {
      setNotifEnabled(prev => !prev);
    } else {
      requestNotifPermission();
    }
  }

  // Pre-fill emergency mode with earthquake data
  function openEmergencyMode(eq) {
    setMode('emergency');
    setDisasterType('earthquake');
    setEmLocation(eq.earthquake?.hypocenter?.name || '');
    const mag = eq.earthquake?.hypocenter?.magnitude;
    const intensity = scaleToText(eq.earthquake?.maxScale);
    const time = eq.earthquake?.time || '';
    setEmDetails(`${time}頃、${eq.earthquake?.hypocenter?.name || '不明'}を震源とする地震が発生。最大震度${intensity}${mag != null && mag !== -1 ? `、マグニチュード${mag}` : ''}。`);
    setStep('input');
    setShowNotifPanel(false);
  }

  function handleUrlChange(val) {
    setUrl(val);
    const t = extractTag(val);
    if (t && !tag) setTag(t);
  }

  async function callApi(endpoint, body) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'エラーが発生しました');
    return data;
  }

  async function generateBosai() {
    setError(''); setStep('loading');
    try {
      const data = await callApi('/api/bosai', {
        category, format, length,
        season: useSeasonal ? getCurrentSeason() : null,
      });
      setBosaiTopic(data.topic || '');
      setBosaiSource(data.source || '');
      setPosts(data.posts || []);
      setSelected(0);
      setStep('result');
    } catch (e) { setError(e.message); setStep('input'); }
  }
  async function generateEmergency() {
    setError(''); setStep('loading');
    try {
      const data = await callApi('/api/emergency', {
        disasterType, location: emLocation, details: emDetails, length, autoFetch,
      });
      setEmInfo({
        summary: data.summary || '',
        sources: data.sources || [],
        lastUpdated: data.lastUpdated || '',
        actionTips: data.actionTips || [],
      });
      setPosts(data.posts || []);
      setSelected(0);
      setStep('result');
    } catch (e) { setError(e.message); setStep('input'); }
  }
  async function analyzeAmazon() {
    if (!url.trim()) return;
    if (!isAmazonUrl(url)) { setError('AmazonのURLを入力してください'); return; }
    setError(''); setStep('loading');
    try {
      const data = await callApi('/api/analyze', { url, tone, associateTag: tag.trim(), length });
      setProduct(data.product);
      setPosts(data.posts || []);
      setAffUrl(data.affiliateUrl || '');
      setSelected(0);
      setStep('result');
    } catch (e) { setError(e.message); setStep('input'); }
  }
  function copyPost() {
    navigator.clipboard.writeText(posts[selected]?.text || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  function postToX() {
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(posts[selected]?.text || '')}`, '_blank');
  }
  function reset() {
    setStep('input'); setProduct(null); setPosts([]); setError(''); setAffUrl('');
    setSelected(0); setBosaiTopic(''); setBosaiSource(''); setEmInfo(null);
  }
  function switchMode(m) { setMode(m); reset(); }
  function generate() {
    if (mode === 'bosai') generateBosai();
    else if (mode === 'emergency') generateEmergency();
    else analyzeAmazon();
  }

  const chars = posts[selected] ? countChars(posts[selected].text) : 0;
  const maxChars = maxForLength(length);
  const accent = mode === 'amazon' ? 'amazon' : mode === 'emergency' ? 'emergency' : 'bosai';
  const headerEmoji = mode === 'amazon' ? '📦' : mode === 'emergency' ? '🚨' : '🛡️';
  const headerTitle = mode === 'amazon' ? 'Amazon → X' : mode === 'emergency' ? '緊急情報 → X' : '防災 → X';
  const headerSubtitle = mode === 'amazon' ? 'レビューをAIが分析、投稿文を自動生成'
    : mode === 'emergency' ? '災害発生時の正確な情報を3パターンで作成'
    : '最新の防災情報をAIが投稿文化';

  return (
    <>
      <Head>
        <title>X ポストジェネレーター</title>
        <meta name="description" content="AIで防災・緊急情報・Amazon商品のX投稿文を生成" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Floating earthquake alert */}
      {lastEqAlert && (
        <div className="eq-alert fade-up">
          <div className="eq-alert-header">
            <span className="eq-alert-icon">🚨</span>
            <span className="eq-alert-title">地震速報</span>
            <button className="eq-alert-close" onClick={() => setLastEqAlert(null)}>×</button>
          </div>
          <p className="eq-alert-place">{lastEqAlert.place}</p>
          <p className="eq-alert-detail">
            最大震度 <strong>{lastEqAlert.intensity}</strong>
            {lastEqAlert.magnitude != null && lastEqAlert.magnitude !== -1 && ` / M${lastEqAlert.magnitude}`}
          </p>
          <p className="eq-alert-time">{lastEqAlert.time}</p>
          <button className="eq-alert-cta" onClick={() => { openEmergencyMode(lastEqAlert.raw); setLastEqAlert(null); }}>
            🚨 この地震の投稿文を作成
          </button>
        </div>
      )}

      <div className="page">
        <div className="orb orb1" data-mode={accent} />
        <div className="orb orb2" />

        <main className="card fade-up">

          {/* Notification Bell */}
          <div className="notif-bar">
            <button className={`notif-toggle${notifEnabled ? ' active' : ''}`} onClick={() => setShowNotifPanel(!showNotifPanel)}>
              <span className="notif-icon">{notifEnabled ? '🔔' : '🔕'}</span>
              <span className="notif-label">
                地震通知 {notifEnabled ? 'ON' : 'OFF'}
              </span>
              {notifEnabled && <span className="notif-pulse" />}
            </button>
          </div>

          {/* Notification Panel */}
          {showNotifPanel && (
            <div className="notif-panel fade-up">
              <div className="notif-section">
                <div className="notif-row">
                  <div>
                    <p className="notif-row-title">地震速報通知</p>
                    <p className="notif-row-desc">
                      {notifPermission === 'granted'
                        ? '震度3以上の地震を自動で通知します'
                        : 'ブラウザの通知を許可してください'}
                    </p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={notifEnabled} onChange={toggleNotif} />
                    <span className="slider" />
                  </label>
                </div>
                <p className="notif-warn">⚠️ このタブを開いている間のみ動作します（モバイルではブラウザがバックグラウンドだと制限される場合があります）</p>
              </div>

              {notifEnabled && (
                <div className="notif-section">
                  <p className="notif-section-title">通知する震度</p>
                  <div className="threshold-grid">
                    {[2, 3, 4, 5].map(n => (
                      <button key={n} className={`threshold-btn${notifThreshold === n ? ' active' : ''}`} onClick={() => setNotifThreshold(n)}>
                        震度{n}+
                      </button>
                    ))}
                  </div>

                  <label className="toggle-row" style={{ marginTop: 12 }}>
                    <input type="checkbox" checked={notifSound} onChange={e => setNotifSound(e.target.checked)} />
                    <span className="toggle-label">通知音を鳴らす</span>
                  </label>
                </div>
              )}

              {recentEqs.length > 0 && (
                <div className="notif-section">
                  <p className="notif-section-title">最近の地震情報</p>
                  <div className="eq-list">
                    {recentEqs.slice(0, 5).map((eq, i) => (
                      <button key={eq.id || i} className="eq-item" onClick={() => openEmergencyMode(eq)}>
                        <div className="eq-item-top">
                          <span className="eq-item-intensity">震度{scaleToText(eq.earthquake?.maxScale)}</span>
                          <span className="eq-item-time">{eq.earthquake?.time || ''}</span>
                        </div>
                        <p className="eq-item-place">{eq.earthquake?.hypocenter?.name || '震源情報なし'}</p>
                        {eq.earthquake?.hypocenter?.magnitude != null && eq.earthquake.hypocenter.magnitude !== -1 && (
                          <p className="eq-item-mag">M{eq.earthquake.hypocenter.magnitude}</p>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="notif-warn">📡 データ提供: <a href="https://www.p2pquake.net/" target="_blank" rel="noopener">P2P地震情報</a>（気象庁データ）</p>
                </div>
              )}
            </div>
          )}

          <header className="header" data-mode={accent}>
            <div className="logo-row">
              <span className="logo-icon">{headerEmoji}</span>
              <svg className="arrow-svg" viewBox="0 0 40 12" fill="none">
                <path d="M0 6h36M30 1l6 5-6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="logo-icon x-logo">𝕏</span>
            </div>
            <h1 className="title">{headerTitle} ポスター</h1>
            <p className="subtitle">{headerSubtitle}</p>
            <div className="powered-badge">Powered by Gemini</div>
          </header>

          <div className="mode-tabs">
            <button className={`mode-tab${mode === 'bosai' ? ' active bosai' : ''}`} onClick={() => switchMode('bosai')}>🛡️ 防災</button>
            <button className={`mode-tab${mode === 'emergency' ? ' active emergency' : ''}`} onClick={() => switchMode('emergency')}>🚨 緊急情報</button>
            <button className={`mode-tab${mode === 'amazon' ? ' active amazon' : ''}`} onClick={() => switchMode('amazon')}>📦 Amazon</button>
          </div>

          {step === 'input' && (
            <div className="body">
              <div className="field-group">
                <label className="field-label">投稿の長さ</label>
                <div className="length-grid">
                  {LENGTHS.map(l => (
                    <button key={l.id} className={`length-btn${length === l.id ? ' active ' + accent : ''}`} onClick={() => setLength(l.id)}>
                      <span className="length-label">{l.label}</span>
                      <span className="length-desc">{l.desc}</span>
                    </button>
                  ))}
                </div>
                {length !== 'short' && (
                  <p className="field-hint warn">⚠️ 中文・長文はX Premium加入者のみ投稿可能です</p>
                )}
              </div>

              {mode === 'bosai' && (
                <>
                  <div className="field-group">
                    <label className="field-label">テーマ</label>
                    <div className="bosai-grid">
                      {BOSAI_CATEGORIES.map(c => (
                        <button key={c.id} className={`bosai-btn${category === c.id ? ' active' : ''}`} onClick={() => setCategory(c.id)}>
                          <span className="bosai-emoji">{c.emoji}</span>
                          <span className="bosai-label">{c.label}</span>
                          <span className="bosai-desc">{c.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field-group">
                    <label className="field-label">投稿の形式</label>
                    <div className="format-grid">
                      {BOSAI_FORMATS.map(f => (
                        <button key={f.id} className={`format-btn${format === f.id ? ' active' : ''}`} onClick={() => setFormat(f.id)}>
                          <span className="format-emoji">{f.emoji}</span>
                          <span className="format-label">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field-group">
                    <label className="toggle-row">
                      <input type="checkbox" checked={useSeasonal} onChange={e => setUseSeasonal(e.target.checked)} />
                      <span className="toggle-label">現在の季節（{getCurrentSeason()}）に合わせた内容にする</span>
                    </label>
                  </div>
                </>
              )}

              {mode === 'emergency' && (
                <>
                  <div className="emergency-notice">
                    <span className="em-icon">⚠️</span>
                    <div>
                      <p className="em-title">緊急情報モードについて</p>
                      <p className="em-desc">災害発生時にXで正しい情報を発信するための投稿を生成します。必ず公式情報源（気象庁・自治体）を確認してから投稿してください。</p>
                    </div>
                  </div>
                  <div className="field-group">
                    <label className="field-label">災害の種類</label>
                    <div className="disaster-grid">
                      {DISASTER_TYPES.map(d => (
                        <button key={d.id} className={`disaster-btn${disasterType === d.id ? ' active' : ''}`} onClick={() => setDisasterType(d.id)}>
                          <span className="disaster-emoji">{d.emoji}</span>
                          <span className="disaster-label">{d.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field-group">
                    <div className="label-row">
                      <label className="field-label">場所</label>
                      <span className="badge-optional">任意</span>
                    </div>
                    <input className="text-input" type="text" value={emLocation}
                      onChange={e => setEmLocation(e.target.value)}
                      placeholder="例: 関東地方、東京都、〇〇市など" />
                  </div>
                  <div className="field-group">
                    <div className="label-row">
                      <label className="field-label">詳細・観測情報</label>
                      <span className="badge-optional">任意</span>
                    </div>
                    <textarea className="text-input textarea" value={emDetails}
                      onChange={e => setEmDetails(e.target.value)}
                      placeholder="例: 14:30頃に震度4の揺れを観測。停電あり。" rows={3} />
                  </div>
                  <div className="field-group">
                    <label className="toggle-row">
                      <input type="checkbox" checked={autoFetch} onChange={e => setAutoFetch(e.target.checked)} />
                      <span className="toggle-label">最新の公的情報を自動で取得（推奨）</span>
                    </label>
                  </div>
                </>
              )}

              {mode === 'amazon' && (
                <>
                  <div className="field-group">
                    <label className="field-label">投稿のトーン</label>
                    <div className="tone-grid">
                      {TONES.map(t => (
                        <button key={t.id} className={`tone-btn${tone === t.id ? ' active' : ''}`} onClick={() => setTone(t.id)}>
                          <span className="tone-emoji">{t.emoji}</span>
                          <span className="tone-label">{t.label}</span>
                          <span className="tone-desc">{t.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Amazon商品URL</label>
                    <input className="text-input" type="url" value={url}
                      onChange={e => handleUrlChange(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && analyzeAmazon()}
                      placeholder="https://www.amazon.co.jp/dp/..." />
                  </div>
                  <div className="field-group">
                    <div className="label-row">
                      <label className="field-label">アソシエイトタグ</label>
                      <span className="badge-optional">任意</span>
                    </div>
                    <input className="text-input" type="text" value={tag}
                      onChange={e => setTag(e.target.value)}
                      placeholder="例: yourname-22" />
                  </div>
                </>
              )}

              {error && <p className="error-msg">⚠️ {error}</p>}

              <button className={`cta-btn ${accent}`} onClick={generate}>
                {mode === 'bosai' && '🛡️ 防災ポストを生成'}
                {mode === 'emergency' && '🚨 緊急情報ポストを生成'}
                {mode === 'amazon' && '✨ レビューを分析してXポスト生成'}
              </button>
              {mode === 'emergency' && (
                <p className="footer-note em-note">※ 投稿前に必ず気象庁・自治体の公式発表をご確認ください</p>
              )}
            </div>
          )}

          {step === 'loading' && (
            <div className="loading-body">
              <div className={`spinner ${accent}`} />
              <p className="loading-title">
                {mode === 'bosai' && '防災ポストを生成中...'}
                {mode === 'emergency' && '災害情報を収集・整理中...'}
                {mode === 'amazon' && 'レビューを分析中...'}
              </p>
              <p className="loading-sub">
                {mode === 'emergency' ? '公的情報源から最新データを取得しています' : 'Google検索で情報を収集しています'}
              </p>
              <div className="dots">
                {[0,1,2].map(i => <span key={i} className={`dot ${accent}`} style={{ animationDelay: `${i*0.25}s` }} />)}
              </div>
            </div>
          )}

          {step === 'result' && (
            <div className="body">
              {mode === 'amazon' && product && (
                <div className="product-card">
                  <div className="product-top">
                    <span className="product-cat">{product.category}</span>
                    <span className="product-rating">
                      {'★'.repeat(Math.round(product.avgRating || 0))}{'☆'.repeat(5-Math.round(product.avgRating || 0))}
                      {' '}{product.avgRating} ({(product.reviewCount||0).toLocaleString()}件)
                    </span>
                  </div>
                  <p className="product-name">{product.name}</p>
                  {product.priceRange && <p className="product-price">{product.priceRange}</p>}
                  {affUrl && <span className="aff-badge">🔗 アソシエイトリンク付き</span>}
                </div>
              )}
              {mode === 'bosai' && bosaiTopic && (
                <div className="info-card bosai">
                  <span className="info-label">🛡️ 今回のテーマ</span>
                  <p className="info-topic">{bosaiTopic}</p>
                  {bosaiSource && <p className="info-source">情報源: {bosaiSource}</p>}
                </div>
              )}
              {mode === 'emergency' && emInfo && (
                <div className="info-card emergency">
                  <span className="info-label">🚨 災害情報サマリー</span>
                  <p className="info-topic">{emInfo.summary}</p>
                  {emInfo.actionTips?.length > 0 && (
                    <div className="action-tips">
                      <p className="action-tips-label">取るべき行動：</p>
                      <ul>
                        {emInfo.actionTips.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                  {emInfo.sources?.length > 0 && (
                    <p className="info-source">参照: {emInfo.sources.join(' / ')}</p>
                  )}
                  {emInfo.lastUpdated && <p className="info-source">情報取得: {emInfo.lastUpdated}</p>}
                </div>
              )}

              <label className="field-label">投稿パターンを選択</label>
              <div className="tabs">
                {posts.map((p, i) => (
                  <button key={i} className={`tab${selected === i ? ' active ' + accent : ''}`} onClick={() => setSelected(i)}>
                    <span>パターン {i+1}</span>
                    <span className="tab-angle">{p.angle}</span>
                  </button>
                ))}
              </div>

              {posts[selected] && (
                <div className="x-preview">
                  <div className="x-header">
                    <div className="x-avatar">You</div>
                    <div>
                      <span className="x-name">あなた</span>
                      <span className="x-handle">@username</span>
                    </div>
                  </div>
                  <p className="x-body">{posts[selected].text}</p>
                  <div className="x-footer">
                    <span className={`char-count${chars > maxChars ? ' over' : ''}`}>
                      {chars} / {maxChars}
                    </span>
                    {affUrl && <span className="aff-tag">🔗 アフィリエイト</span>}
                  </div>
                </div>
              )}

              <div className="action-row">
                <button className="btn-copy" onClick={copyPost}>{copied ? '✅ コピー済み' : '📋 コピー'}</button>
                <button className="btn-x" onClick={postToX}><span style={{fontWeight:800}}>𝕏</span> Xに投稿する</button>
              </div>
              <div className="action-row">
                <button className="btn-regenerate" onClick={generate}>🔄 もう一度生成</button>
                <button className="btn-reset-inline" onClick={reset}>← 戻る</button>
              </div>
            </div>
          )}
        </main>
      </div>

      <style jsx>{`
        .page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; position: relative; overflow: hidden; }
        .orb { position: fixed; border-radius: 50%; pointer-events: none; filter: blur(60px); transition: background 0.4s; }
        .orb1 { top: -120px; left: -120px; width: 480px; height: 480px; background: radial-gradient(circle, rgba(255,69,0,0.18) 0%, transparent 70%); }
        .orb1[data-mode="bosai"] { background: radial-gradient(circle, rgba(0,184,148,0.18) 0%, transparent 70%); }
        .orb1[data-mode="emergency"] { background: radial-gradient(circle, rgba(255,46,99,0.22) 0%, transparent 70%); }
        .orb2 { bottom: -100px; right: -100px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(29,155,240,0.14) 0%, transparent 70%); }
        .card { width: 100%; max-width: 600px; background: var(--surface); border: 1px solid var(--border); border-radius: 28px; backdrop-filter: blur(24px); overflow: hidden; position: relative; z-index: 1; }

        /* Floating earthquake alert */
        .eq-alert { position: fixed; top: 20px; right: 20px; z-index: 100; background: linear-gradient(135deg, #ff2e63, #c70039); border: 2px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 16px 18px; max-width: 320px; box-shadow: 0 8px 32px rgba(255,46,99,0.4); color: #fff; }
        .eq-alert-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .eq-alert-icon { font-size: 22px; animation: pulse 1.5s ease-in-out infinite; }
        .eq-alert-title { flex: 1; font-weight: 800; font-size: 15px; letter-spacing: 0.05em; }
        .eq-alert-close { background: rgba(255,255,255,0.2); width: 24px; height: 24px; border-radius: 50%; color: #fff; font-size: 16px; line-height: 1; padding: 0; }
        .eq-alert-place { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
        .eq-alert-detail { font-size: 14px; margin-bottom: 4px; }
        .eq-alert-detail strong { font-size: 18px; font-weight: 800; }
        .eq-alert-time { font-size: 11px; opacity: 0.8; margin-bottom: 12px; }
        .eq-alert-cta { width: 100%; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.3); border-radius: 10px; padding: 10px; color: #fff; font-size: 13px; font-weight: 700; }
        .eq-alert-cta:hover { background: rgba(0,0,0,0.6); }

        /* Notification bar */
        .notif-bar { padding: 10px 16px 0; display: flex; justify-content: flex-end; }
        .notif-toggle { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 20px; padding: 6px 12px; color: rgba(255,255,255,0.6); font-size: 12px; font-weight: 600; transition: all 0.2s; position: relative; }
        .notif-toggle:hover { background: rgba(255,255,255,0.08); }
        .notif-toggle.active { background: rgba(255,46,99,0.12); border-color: rgba(255,46,99,0.4); color: #ff8fa3; }
        .notif-icon { font-size: 14px; }
        .notif-pulse { position: absolute; top: 4px; right: 8px; width: 8px; height: 8px; background: #ff2e63; border-radius: 50%; animation: pulse 1.5s ease-in-out infinite; }

        /* Notification panel */
        .notif-panel { background: rgba(0,0,0,0.3); border-bottom: 1px solid var(--border); padding: 18px 20px; }
        .notif-section { margin-bottom: 16px; }
        .notif-section:last-child { margin-bottom: 0; }
        .notif-section-title { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
        .notif-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .notif-row-title { font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 2px; }
        .notif-row-desc { font-size: 11px; color: var(--muted); line-height: 1.4; }
        .notif-warn { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 8px; line-height: 1.5; }
        .notif-warn a { color: var(--x-blue); text-decoration: underline; }

        /* Switch toggle */
        .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; inset: 0; background: rgba(255,255,255,0.15); border-radius: 24px; transition: 0.3s; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; top: 3px; background: white; border-radius: 50%; transition: 0.3s; }
        .switch input:checked + .slider { background: #ff2e63; }
        .switch input:checked + .slider:before { transform: translateX(20px); }

        /* Threshold grid */
        .threshold-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
        .threshold-btn { background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 10px; padding: 8px; color: rgba(255,255,255,0.6); font-size: 12px; font-weight: 700; transition: all 0.2s; }
        .threshold-btn:hover { background: rgba(255,255,255,0.08); }
        .threshold-btn.active { background: rgba(255,46,99,0.18); border-color: rgba(255,46,99,0.5); color: #ff8fa3; }

        /* Earthquake list */
        .eq-list { display: flex; flex-direction: column; gap: 6px; }
        .eq-item { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; text-align: left; transition: background 0.2s; cursor: pointer; }
        .eq-item:hover { background: rgba(255,255,255,0.08); }
        .eq-item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .eq-item-intensity { font-size: 11px; font-weight: 700; color: #ff8fa3; background: rgba(255,46,99,0.15); border-radius: 12px; padding: 2px 8px; }
        .eq-item-time { font-size: 10px; color: var(--muted); }
        .eq-item-place { font-size: 13px; color: #fff; font-weight: 600; }
        .eq-item-mag { font-size: 11px; color: var(--muted); margin-top: 2px; }

        .header { padding: 28px 32px 22px; text-align: center; border-bottom: 1px solid var(--border); transition: background 0.4s; }
        .header[data-mode="bosai"] { background: linear-gradient(180deg, rgba(0,184,148,0.07) 0%, transparent 100%); }
        .header[data-mode="emergency"] { background: linear-gradient(180deg, rgba(255,46,99,0.08) 0%, transparent 100%); }
        .header[data-mode="amazon"] { background: linear-gradient(180deg, rgba(255,69,0,0.07) 0%, transparent 100%); }
        .logo-row { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 14px; }
        .logo-icon { font-size: 28px; line-height: 1; }
        .x-logo { font-family: 'Syne', sans-serif; font-weight: 800; }
        .arrow-svg { width: 36px; color: rgba(255,255,255,0.25); }
        .title { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.5px; color: #fff; margin-bottom: 6px; }
        .subtitle { font-size: 13px; color: var(--muted); margin-bottom: 12px; }
        .powered-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: #4285f4; background: rgba(66,133,244,0.12); border: 1px solid rgba(66,133,244,0.25); border-radius: 20px; padding: 4px 12px; }
        .powered-badge::before { content: '✦'; color: #34a853; }

        .mode-tabs { display: grid; grid-template-columns: 1fr 1fr 1fr; border-bottom: 1px solid var(--border); }
        .mode-tab { background: transparent; padding: 14px 8px; color: var(--muted); font-size: 13px; font-weight: 600; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .mode-tab:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.02); }
        .mode-tab.active { color: #fff; }
        .mode-tab.active.bosai { border-bottom-color: var(--bosai); }
        .mode-tab.active.emergency { border-bottom-color: #ff2e63; }
        .mode-tab.active.amazon { border-bottom-color: var(--accent); }

        .body { padding: 24px 28px 30px; }
        .field-group { margin-bottom: 20px; }
        .field-label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
        .label-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .label-row .field-label { margin-bottom: 0; }
        .badge-optional { font-size: 10px; font-weight: 700; color: var(--x-blue); background: rgba(29,155,240,0.12); border: 1px solid rgba(29,155,240,0.25); border-radius: 20px; padding: 2px 8px; }

        .text-input { width: 100%; background: rgba(255,255,255,0.055); border: 1px solid var(--border); border-radius: 14px; padding: 13px 16px; color: #fff; font-size: 14px; transition: border-color 0.2s; font-family: inherit; }
        .text-input:focus { border-color: rgba(255,69,0,0.5); }
        .text-input::placeholder { color: rgba(255,255,255,0.22); }
        .textarea { resize: vertical; min-height: 80px; line-height: 1.5; }
        .field-hint { font-size: 11px; color: rgba(255,255,255,0.28); margin-top: 7px; }
        .field-hint.warn { color: #fbbf24; }

        .length-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .length-btn { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 12px; padding: 10px 8px; display: flex; flex-direction: column; align-items: center; gap: 3px; transition: all 0.2s; color: var(--text); }
        .length-btn:hover { background: rgba(255,255,255,0.07); }
        .length-btn.active.bosai { background: rgba(0,184,148,0.14); border-color: rgba(0,184,148,0.5); }
        .length-btn.active.emergency { background: rgba(255,46,99,0.14); border-color: rgba(255,46,99,0.5); }
        .length-btn.active.amazon { background: rgba(255,69,0,0.14); border-color: rgba(255,69,0,0.5); }
        .length-label { font-size: 13px; font-weight: 700; }
        .length-desc { font-size: 10px; color: var(--muted); }

        .tone-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .tone-btn { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 14px; padding: 12px 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all 0.2s; color: var(--text); }
        .tone-btn:hover { background: rgba(255,255,255,0.07); }
        .tone-btn.active { background: rgba(255,69,0,0.14); border-color: rgba(255,69,0,0.5); }
        .tone-emoji { font-size: 18px; }
        .tone-label { font-size: 12px; font-weight: 700; }
        .tone-desc { font-size: 10px; color: var(--muted); }

        .bosai-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .bosai-btn { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 14px; padding: 10px 6px; display: flex; flex-direction: column; align-items: center; gap: 3px; transition: all 0.2s; color: var(--text); }
        .bosai-btn:hover { background: rgba(255,255,255,0.07); }
        .bosai-btn.active { background: rgba(0,184,148,0.14); border-color: rgba(0,184,148,0.5); }
        .bosai-emoji { font-size: 18px; }
        .bosai-label { font-size: 11px; font-weight: 700; text-align: center; }
        .bosai-desc { font-size: 9px; color: var(--muted); text-align: center; line-height: 1.2; }

        .format-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .format-btn { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 12px; padding: 10px 6px; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all 0.2s; color: var(--text); }
        .format-btn:hover { background: rgba(255,255,255,0.07); }
        .format-btn.active { background: rgba(0,184,148,0.14); border-color: rgba(0,184,148,0.5); }
        .format-emoji { font-size: 16px; }
        .format-label { font-size: 11px; font-weight: 600; }

        .disaster-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .disaster-btn { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 14px; padding: 12px 6px; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all 0.2s; color: var(--text); }
        .disaster-btn:hover { background: rgba(255,255,255,0.07); }
        .disaster-btn.active { background: rgba(255,46,99,0.14); border-color: rgba(255,46,99,0.5); }
        .disaster-emoji { font-size: 22px; }
        .disaster-label { font-size: 11px; font-weight: 700; text-align: center; }

        .emergency-notice { background: rgba(255,46,99,0.08); border: 1px solid rgba(255,46,99,0.3); border-radius: 14px; padding: 14px 16px; display: flex; gap: 12px; margin-bottom: 22px; }
        .em-icon { font-size: 22px; flex-shrink: 0; }
        .em-title { font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .em-desc { font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.5; }
        .em-note { color: #ff8fa3 !important; font-weight: 600 !important; }

        .toggle-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; cursor: pointer; }
        .toggle-row input { width: 16px; height: 16px; cursor: pointer; }
        .toggle-label { font-size: 13px; color: var(--text); }

        .error-msg { color: #ff6b6b; font-size: 13px; margin-bottom: 14px; }
        .cta-btn { width: 100%; border-radius: 14px; padding: 15px; color: #fff; font-size: 15px; font-weight: 700; letter-spacing: 0.02em; transition: opacity 0.2s, transform 0.15s; margin-bottom: 12px; }
        .cta-btn.amazon { background: linear-gradient(135deg, var(--accent), var(--accent2)); }
        .cta-btn.bosai { background: linear-gradient(135deg, var(--bosai), var(--bosai2)); }
        .cta-btn.emergency { background: linear-gradient(135deg, #ff2e63, #ff6b6b); }
        .cta-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .footer-note { font-size: 11px; color: rgba(255,255,255,0.22); text-align: center; }

        .loading-body { padding: 70px 32px; display: flex; flex-direction: column; align-items: center; gap: 18px; }
        .spinner { width: 52px; height: 52px; border: 3px solid rgba(255,69,0,0.18); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.75s linear infinite; }
        .spinner.bosai { border: 3px solid rgba(0,184,148,0.18); border-top-color: var(--bosai); }
        .spinner.emergency { border: 3px solid rgba(255,46,99,0.18); border-top-color: #ff2e63; }
        .loading-title { font-size: 17px; font-weight: 700; }
        .loading-sub { font-size: 13px; color: var(--muted); text-align: center; }
        .dots { display: flex; gap: 8px; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: pulse 1.2s ease-in-out infinite; }
        .dot.bosai { background: var(--bosai); }
        .dot.emergency { background: #ff2e63; }

        .info-card { border-radius: 16px; padding: 16px; margin-bottom: 22px; }
        .info-card.bosai { background: rgba(0,184,148,0.08); border: 1px solid rgba(0,184,148,0.25); }
        .info-card.emergency { background: rgba(255,46,99,0.08); border: 1px solid rgba(255,46,99,0.3); }
        .info-label { display: inline-block; font-size: 11px; font-weight: 700; margin-bottom: 6px; }
        .info-card.bosai .info-label { color: var(--bosai2); }
        .info-card.emergency .info-label { color: #ff8fa3; }
        .info-topic { color: #fff; font-size: 14px; font-weight: 600; line-height: 1.5; margin-bottom: 8px; }
        .info-source { font-size: 11px; color: var(--muted); margin-top: 6px; }
        .action-tips { background: rgba(0,0,0,0.2); border-radius: 10px; padding: 10px 14px; margin: 8px 0; }
        .action-tips-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: 4px; }
        .action-tips ul { padding-left: 20px; }
        .action-tips li { font-size: 12px; color: rgba(255,255,255,0.85); line-height: 1.6; }

        .product-card { background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 16px; padding: 16px; margin-bottom: 22px; }
        .product-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
        .product-cat { font-size: 11px; font-weight: 700; color: var(--accent2); background: rgba(255,140,0,0.15); border-radius: 20px; padding: 3px 10px; }
        .product-rating { font-size: 12px; color: var(--muted); }
        .product-name { color: #fff; font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .product-price { color: var(--accent2); font-size: 13px; font-weight: 700; margin-bottom: 8px; }
        .aff-badge { display: inline-block; font-size: 11px; font-weight: 700; color: var(--x-blue); background: rgba(29,155,240,0.12); border: 1px solid rgba(29,155,240,0.25); border-radius: 20px; padding: 3px 10px; }

        .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0 18px; }
        .tab { background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 10px; padding: 8px 14px; color: var(--muted); font-size: 12px; display: flex; flex-direction: column; gap: 3px; transition: all 0.2s; }
        .tab:hover { background: rgba(255,255,255,0.08); }
        .tab.active.amazon { background: rgba(29,155,240,0.14); border-color: rgba(29,155,240,0.4); color: var(--x-blue); }
        .tab.active.bosai { background: rgba(0,184,148,0.14); border-color: rgba(0,184,148,0.5); color: var(--bosai2); }
        .tab.active.emergency { background: rgba(255,46,99,0.14); border-color: rgba(255,46,99,0.5); color: #ff8fa3; }
        .tab-angle { font-size: 10px; color: rgba(255,255,255,0.28); }

        .x-preview { background: #0f1117; border: 1px solid rgba(255,255,255,0.1); border-radius: 18px; padding: 22px; margin-bottom: 18px; }
        .x-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .x-avatar { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, var(--x-blue), #0d8ecf); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; flex-shrink: 0; }
        .x-name { color: #fff; font-weight: 700; font-size: 14px; margin-right: 6px; }
        .x-handle { color: var(--muted); font-size: 13px; }
        .x-body { color: #e7e9ea; font-size: 15px; line-height: 1.75; white-space: pre-wrap; word-break: break-word; margin-bottom: 14px; }
        .x-footer { display: flex; justify-content: space-between; align-items: center; }
        .char-count { font-size: 12px; color: rgba(255,255,255,0.28); }
        .char-count.over { color: #ff6b6b; }
        .aff-tag { font-size: 11px; color: var(--x-blue); background: rgba(29,155,240,0.1); border-radius: 20px; padding: 2px 8px; }

        .action-row { display: flex; gap: 10px; margin-bottom: 14px; }
        .action-row:last-child { margin-bottom: 0; }
        .btn-copy { flex: 1; background: rgba(255,255,255,0.07); border: 1px solid var(--border); border-radius: 12px; padding: 13px; color: #fff; font-size: 14px; font-weight: 600; transition: opacity 0.2s; }
        .btn-copy:hover { opacity: 0.8; }
        .btn-x { flex: 2; background: #000; border: 1px solid rgba(255,255,255,0.18); border-radius: 12px; padding: 13px; color: #fff; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; transition: opacity 0.2s; }
        .btn-x:hover { opacity: 0.8; }
        .btn-regenerate { flex: 2; background: rgba(255,255,255,0.06); border: 1px solid var(--border); border-radius: 12px; padding: 11px; color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600; transition: opacity 0.2s; }
        .btn-regenerate:hover { background: rgba(255,255,255,0.1); }
        .btn-reset-inline { flex: 1; background: transparent; color: rgba(255,255,255,0.4); font-size: 13px; padding: 11px; border-radius: 12px; }
        .btn-reset-inline:hover { color: rgba(255,255,255,0.7); }

        @media (max-width: 480px) {
          .header { padding: 24px 20px 20px; }
          .body { padding: 22px 20px 28px; }
          .title { font-size: 19px; }
          .subtitle { font-size: 12px; }
          .bosai-grid { grid-template-columns: repeat(2, 1fr); }
          .disaster-grid { grid-template-columns: repeat(3, 1fr); }
          .format-grid { grid-template-columns: repeat(2, 1fr); }
          .tone-grid { grid-template-columns: 1fr; }
          .mode-tab { font-size: 12px; padding: 12px 4px; }
          .eq-alert { top: 10px; right: 10px; left: 10px; max-width: none; }
        }
      `}</style>
    </>
  );
}
