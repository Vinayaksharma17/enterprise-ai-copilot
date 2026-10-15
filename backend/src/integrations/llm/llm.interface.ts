/**
 * Provider-agnostic interfaces for the LLM and embedding providers used by the
 * RAG pipeline. Concrete provider implementations live in
 * `embeddings.service.ts` and `llm.service.ts`; keeping the contracts here lets
 * providers be swapped without touching business logic.
 */

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface EmbeddingsProvider {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

export interface ChatProvider {
  generate(messages: ChatMessage[]): Promise<string>;
}
