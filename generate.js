
export default async function handler(req, res) {
  try {
    const { product, niche, audience, tone } = req.body;

    const prompt = `
Создай продающее описание для товара "${product}".
Категория: ${niche}
Целевая аудитория: ${audience}
Стиль: ${tone}
Текст должен быть в 3-5 предложений, коротко, ярко, с УТП и без повторов.
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": \`Bearer \${process.env.OPENROUTER_API_KEY}\`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content ?? "Ошибка генерации";

    res.status(200).json({ result });

  } catch (err) {
    res.status(500).json({ error: "Internal error", message: err.message });
  }
}
