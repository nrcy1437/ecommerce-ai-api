import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { product, niche, audience, tone } = req.body;
  if (!product || !niche || !audience || !tone) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `Generate a product description for "${product}", category: "${niche}", target audience: "${audience}", in a "${tone}" tone.`
        }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    const text = completion.choices[0].message.content;
    res.status(200).json({ result: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OpenAI request failed" });
  }
}

Add generate.js into api folder
