export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { category, format, season, length } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APIキーが設定されていません' });

  const categoryMap = {
    earthquake: '地震対策（揺れた時の行動、家具固定、避難経路など）',
    typhoon: '台風・大雨対策（事前準備、浸水対策、停電対策など）',
    fire: '火災対策（火元管理、消火器の使い方、避難など）',
    stockpile: '備蓄・防災グッズ（食料・水・日用品の備え、ローリングストック）',
    evacuation: '避難・避難所（避難判断、避難所での過ごし方、ハザードマップ）',
    family: '家族・子ども・ペット（家族での備え、子ども・高齢者・ペット対策）',
    daily: '日常の防災豆知識（普段からできる小さな備え、生活の知恵）',
    random: 'ランダム（防災に関する有用な情報全般）',
  };
  const formatMap = {
    tip: '実用的な豆知識（「〜知ってますか？」「〜のコツ」など、目を引く構成）',
    checklist: 'チェックリスト（箇条書きで具体的な行動）',
    question: 'クイズ・問いかけ（読者に考えさせる、答えと解説）',
    story: 'ストーリー・体験談（具体的な状況描写から学びを伝える）',
    warning: '注意喚起・警告（よくある誤解や危険な行動を指摘）',
    seasonal: '季節・タイミング（今の時期に特に重要な防災情報）',
  };
  const lengthMap = {
    short:  { max: 140,  desc: '140字以内（無料Xユーザー向け）' },
    medium: { max: 500,  desc: '500字以内（やや詳しく）' },
    long:   { max: 2000, desc: '2000字以内（X Premium向け、詳細解説可能）' },
  };
  const lengthSpec = lengthMap[length] || lengthMap.short;
  const seasonText = season ? `現在の季節は「${season}」です。季節に合わせた内容を意識してください。` : '';

  const prompt = `あなたは防災のプロフェッショナルです。X（旧Twitter）で防災アカウントを運用するためのポストを3パターン作成してください。

テーマ: ${categoryMap[category] || categoryMap.random}
形式: ${formatMap[format] || formatMap.tip}
文字数: ${lengthSpec.desc}
${seasonText}

【重要な要件】
- 各投稿は${lengthSpec.max}字以内に厳守
- ${length === 'long' ? '長文では、見出し・箇条書き・改行を効果的に使い、読みやすく構成してください。詳しい背景や具体例も含めてOKです。' : length === 'medium' ? '中文では、要点を整理しつつ、ある程度詳しい説明を含めてください。' : '短文では、最も重要なポイントに絞り、簡潔にまとめてください。'}
- 必ず最新かつ正確な防災情報を、信頼できる公的機関（消防庁、内閣府防災、気象庁、自治体など）の知見をベースに作成
- Google検索で最新情報を確認してください
- 適度に絵文字を使い、読みやすく親しみやすく
- 危険を煽るのではなく、行動につながる前向きな表現で
- ハッシュタグは1〜3個まで

必ず以下のJSON形式のみで回答してください（マークダウン記号・コードブロック不要）：
{
  "topic": "今回のテーマの簡潔な説明",
  "source": "情報の根拠",
  "posts": [
    { "text": "X投稿文", "angle": "切り口" },
    { "text": "X投稿文", "angle": "切り口" },
    { "text": "X投稿文", "angle": "切り口" }
  ]
}`;

  try {
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    let data = null, lastError = null;
    for (const model of models) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: { maxOutputTokens: length === 'long' ? 8000 : 3000 },
          }),
        }
      );
      data = await r.json();
      if (r.ok) break;
      lastError = data?.error?.message;
      data = null;
    }
    if (!data) return res.status(500).json({ error: lastError || 'Gemini APIエラー' });

    const rawText = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'レスポンスの解析に失敗しました' });

    return res.status(200).json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message || 'エラーが発生しました' });
  }
}
