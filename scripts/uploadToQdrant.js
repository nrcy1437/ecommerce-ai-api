// scripts/uploadToQdrant.js
import fs from "fs";
import readline from "readline";
import { QdrantClient, models } from "@qdrant/js-client-rest";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME = "my_docs";

async function main() {
  console.log(`Создаём коллекцию "${COLLECTION_NAME}" в Qdrant...`);
  await qdrant.recreateCollection({
    collection_name: COLLECTION_NAME,
    vectors: new models.VectorParams({
      size: 1536,
      distance: models.Distance.COSINE,
    }),
  });
  console.log("Коллекция создана (или перезаписана).");

  const fileStream = fs.createReadStream("fragments.jsonl", { encoding: "utf-8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let batch = [];
  const BATCH_SIZE = 50;
  let total = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const fragment = JSON.parse(line);
    const { id, text } = fragment;

    console.log(`Генерим embedding для id="${id}"...`);
    const embResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    const vector = embResponse.data[0].embedding;

    batch.push({
      id: id,
      vector: vector,
      payload: { text },
    });

    if (batch.length >= BATCH_SIZE) {
      console.log(`  Отправляем batch из ${batch.length} точек...`);
      await qdrant.upsert({
        collection_name: COLLECTION_NAME,
        points: batch,
      });
      total += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    console.log(`Отправляем финальный batch из ${batch.length} точек...`);
    await qdrant.upsert({ collection_name: COLLECTION_NAME, points: batch });
    total += batch.length;
  }

  console.log(`Готово! Всего загружено ${total} фрагментов.`);
}

main().catch(err => {
  console.error("Ошибка при загрузке в Qdrant:", err);
  process.exit(1);
});
