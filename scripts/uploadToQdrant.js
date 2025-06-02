/**
 * Этот скрипт:
 * 1. Создаёт (или перезаписывает) коллекцию my_docs в Qdrant.
 * 2. Читает фрагменты из fragments.jsonl.
 * 3. Для каждого фрагмента генерирует embedding через OpenAI.
 * 4. Отправляет в Qdrant с payload = { text: <сам фрагмент> }.
 */

import fs from "fs";
import readline from "readline";
import { QdrantClient, models } from "@qdrant/js-client-rest";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// 1. Инициализация клиентов
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME = "my_docs"; // Имя коллекции, можно менять

async function main() {
  // 2. Создаём (или пересоздаём) коллекцию
  console.log(`Создаём коллекцию "${COLLECTION_NAME}" в Qdrant...`);
  await qdrant.recreateCollection({
    collection_name: COLLECTION_NAME,
    vectors: new models.VectorParams({
      size: 1536,                // размер embedding от OpenAI ("text-embedding-3-small" возвращает 1536)
      distance: models.Distance.COSINE, // либо DOT, в зависимости от того, как вы хотите искать
    }),
  });
  console.log("Коллекция создана или перезаписана.");

  // 3. Читаем fragments.jsonl построчно
  const fileStream = fs.createReadStream("fragments.jsonl", { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let batch = []; // будем отправлять точки пачками по 50–100 штук
  const BATCH_SIZE = 50;
  let total = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    // Парсим JSON-строку
    const fragment = JSON.parse(line);
    const { id, text } = fragment;

    // 4. Генерируем embedding текста через OpenAI
    console.log(`Генерим embedding для фрагмента id="${id}"...`);
    const embResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    const vector = embResponse.data[0].embedding;

    // 5. Добавляем в batch объект с id, vector и payload
    batch.push({
      id: id,             // уникальный id фрагмента
      vector: vector,     // массив float-чисел длины 1536
      payload: { text },  // сохраняем исходный текст во "вспомогательных данных"
    });

    // 6. Если batch набрал BATCH_SIZE, отправляем его в Qdrant
    if (batch.length >= BATCH_SIZE) {
      console.log(`  Отправляем batch из ${batch.length} точек в Qdrant...`);
      await qdrant.upsert({
        collection_name: COLLECTION_NAME,
        points: batch,
      });
      total += batch.length;
      batch = []; // очищаем batch
    }
  }

  // 7. Отправляем остаток, если что-то осталось после цикла
  if (batch.length > 0) {
    console.log(`Отправляем финальный batch из ${batch.length} точек...`);
    await qdrant.upsert({
      collection_name: COLLECTION_NAME,
      points: batch,
    });
    total += batch.length;
  }

  console.log(`Готово! Всего загружено ${total} фрагментов в коллекцию "${COLLECTION_NAME}".`);
}

main().catch(err => {
  console.error("Ошибка при загрузке в Qdrant:", err);
  process.exit(1);
});
