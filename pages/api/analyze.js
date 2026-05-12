export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, tone, associateTag, length } = req.body;
  if (!url) return res.status(400).json({ error: 'URLが必要です' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APIキーが設定されていません' });

  const toneInstructions = {
    enthusiast: '熱狂的で感情的な表現を使い、読者が試してみたくなるような投稿にしてください。絵文字を多めに。',
    neutral: '客観的でレポート風の表現を使い、商品の特徴をバランスよく伝えてください。絵文字は控えめに。',
    critical: '正直な評価で長所・短所を両方伝え、購入を考えている人が判断できるように。絵文字は適度に。',
  };
  const lengthMap = {
    short:  { max: 140,  desc: '140字以内（無料Xユーザー向け）' },
    medium: { max: 500,  desc: '500字以内（やや詳しいレビュー紹介）' },
    long:   { max: 2000, desc: '2000字以内（詳細レビュー、メリット・デメリット解説）' },
  };
  const lengthSpec = lengthMap[length] || lengthMap.short;

  const prompt = `以下のAmazon商品URLについて、Googleで商品名・レビュー・評価を検索して分析し、X用の投稿文を3パターン作成してください。

商品URL: ${url}
投稿トーン: ${toneInstructions[tone] || toneInstructions.enthusiast}
文字数: ${lengthSpec.desc}

【要件】
- 各投稿は${lengthSpec.max}字以内
- ${length === 'long' ? '長文では、メリット・デメリット・使用シーンなどを詳しく解説してください。' : length === 'medium' ? '中文では、要点を整理しつつ、レビューの傾向やおすすめポイントを含めてください。' : '短文では、最も魅力的なポイントに絞り簡潔に。'}

必ず以下のJSON形式のみで回答（マークダウン記号不要）：
{
  "product": { "name": "商品名", "category": "カテゴリ", "avgRating": 4.5, "reviewCount": 1234, "priceRange": "¥1,980〜" },
  "posts": [
    { "text": "X投稿文（本文のみ・URLなし）", "angle": "切り口" },
    { "text": "X投稿文（本文のみ・URLなし）", "angle": "切り口" },
    { "text": "X投稿文（本文のみ・URLなし）", "angle": "切り口" }
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

    const parsed = JSON.parse(jsonMatch[0]);

    let affiliateUrl = '';
    if (associateTag) {
      const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
      const domainMatch = url.match(/amazon\.(co\.jp|com|co\.uk|de|fr|ca|com\.au)/i);
      const domain = domainMatch ? domainMatch[0] : 'amazon.co.jp';
      if (asinMatch) {
        affiliateUrl = `https://www.${domain}/dp/${asinMatch[1]}/?tag=${encodeURIComponent(associateTag)}`;
      } else {
        try { const u = new URL(url); u.searchParams.set('tag', associateTag); affiliateUrl = u.toString(); }
        catch { affiliateUrl = url; }
      }
    }

    const posts = (parsed.posts || []).map(p => ({
      ...p,
      text: affiliateUrl ? `${p.text}\n${affiliateUrl}` : p.text,
    }));

    return res.status(200).json({ product: parsed.product, posts, affiliateUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'エラーが発生しました' });
  }
}
