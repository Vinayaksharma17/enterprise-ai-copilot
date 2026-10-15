import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from '../config/env';
import { Document as DocumentModel } from '../models/document.model';
import { processDocument } from '../services/document-processing.service';
import { getVectorStore } from '../integrations/vector-store/vector-store.service';

/**
 * Re-embeds every stored document using the currently configured embedding
 * provider/model.
 *
 * This is the safe migration path when switching embedding models (for example
 * from a cloud model to local Ollama embeddings): the new vectors are written
 * to the model-specific collection derived from `EMBEDDING_PROVIDER` and
 * `EMBEDDING_MODEL` (`config.chroma.collection`). Vectors from other models are
 * left untouched in their own collections and are never mixed in.
 *
 * Source files must still be present in `UPLOAD_DIR`.
 *
 *   npm run reindex
 */
const main = async (): Promise<void> => {
  await mongoose.connect(config.mongodb.uri);
  await getVectorStore().ensureCollection();

  console.log(
    `Re-indexing into collection "${config.chroma.collection}" using ` +
      `${config.llm.embeddingProvider}/${config.llm.embeddingModel}`
  );

  const documents = await DocumentModel.find({}).sort({ createdAt: 1 });

  if (documents.length === 0) {
    console.log('No documents found.');
  }

  let processed = 0;
  let failed = 0;

  for (const doc of documents) {
    const result = await processDocument(doc);
    if (result.status === 'processed') {
      processed += 1;
      console.log(`  [ok] ${doc.name} (${result.chunkCount} chunks)`);
    } else {
      failed += 1;
      console.error(`  [failed] ${doc.name}: ${result.processingError}`);
    }
  }

  console.log(`Done. ${processed} processed, ${failed} failed.`);
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('Re-index failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
