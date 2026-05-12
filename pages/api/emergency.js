export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { disasterType, location, details, length, autoFetch } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APIキーが設定されていません' });

  const disasterMap = {
    earthquake:  { label: '地震',         search: '地震 最新 気象庁 速報' },
    tsunami:     { label: '津波',         search: '津波警報 気象庁 最新' },
    typhoon:     { label: '台風',         search: '台風 最新 進路 気象庁' },
    heavyrain:   { label: '大雨・洪水',   search: '大雨警報 洪水 最新' },
    volcano:     { label: '火山噴火',     search: '火山 噴火 最新 警戒レベル' },
    fire:        { label: '火災',         search: '火災 最新 注意' },
    snow:        { label: '大雪・吹雪',   search: '大雪警報 最新' },
    other:       { label: 'その他災害',   search: '災害 最新 警報' },
  };
  const disaster = disasterMap[disasterType] || disasterMap.other;

  const lengthMap = {
    short:  { max: 140,  desc: '140字以内（無料Xユーザー向け、最重要情報のみ）' },
    medium: { max: 500,  desc: '500字以内（要点を簡潔に）' },
    long:   { max: 2000, desc: '2000字以内（詳細な状況・対応策・注意事項）' },
  };
  const lengthSpec = lengthMap[length] || lengthMap.short;

  const userInfo = [];
  if (location) userInfo.push(`場所: ${location}`);
  if (details)  userInfo.push(`詳細・観測: ${details}`);

  const fetchInstruction = autoFetch
    ? `必ずGoogle検索で「${disaster.search}」と検索し、現時点での最新の公的情報（気象庁・自治体発表など）を確認してから投稿を作成してください。発表時刻、震度、警報レベル等の正確な情報を反映してください。`
    : 'ユーザーから提供された情報をベースに投稿を作成してください。Google検索で関連する公的な防災情報や注意事項を補完しても構いません。';

  const prompt = `あなたは防災情報を正確に伝える専門家です。${disaster.label}が発生した際にXで広く正しく情報を伝えるための投稿を3パターン作成してください。

災害種別: ${disaster.label}
${userInfo.join('\n')}
文字数: ${lengthSpec.desc}

${fetchInstruction}

【極めて重要な要件】
1. **正確性**: 不確かな情報は絶対に断定しないこと。「気象庁発表によると〜」「現時点の情報では〜」のように情報源を明示
2. **検証可能性**: 必ず公的情報源（気象庁、自治体、消防庁など）を引用し、ユーザーにも公式情報の確認を促す
3. **行動喚起**: 何をすべきか具体的に（避難、火気の確認、デマに惑わされない等）
4. **デマ防止**: 不確かな情報を拡散しないよう注意喚起を含める
5. **冷静なトーン**: 不安を煽らず、冷静で建設的な表現
6. **文字数厳守**: ${lengthSpec.max}字以内
7. **ハッシュタグ**: #防災 #${disaster.label} など1〜3個

【投稿に必ず含める要素】
- 災害の概要（事実ベース）
- 取るべき行動（${disaster.label}に応じた具体的指示）
- 公式情報源への誘導（気象庁、Yahoo!天気・災害、NHKニュースなど）
- ${length !== 'short' ? '注意すべきデマや誤情報への警鐘' : ''}

必ず以下のJSON形式のみで回答してください（マークダウン記号不要）：
{
  "summary": "現状の事実ベースの簡潔な説明",
  "sources": ["参照した公的情報源のリスト"],
  "lastUpdated": "情報取得時刻（推定でOK）",
  "actionTips": ["取るべき行動1", "取るべき行動2", "取るべき行動3"],
  "posts": [
    { "text": "X投稿文", "angle": "投稿の切り口（例：基本情報、注意喚起、行動指示）" },
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
            generationConfig: { maxOutputTokens: length === 'long' ? 8000 : 3500 },
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
