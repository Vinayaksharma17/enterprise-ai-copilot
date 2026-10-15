import { ChatOllama } from '@langchain/ollama';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { config } from '../../config/env';
import { withOllamaLimits } from './resilience';
import type { ChatMessage, ChatProvider } from './llm.interface';

const toBaseMessage = (message: ChatMessage) => {
  switch (message.role) {
    case 'system':
      return new SystemMessage(message.content);
    case 'assistant':
      return new AIMessage(message.content);
    case 'user':
    default:
      return new HumanMessage(message.content);
  }
};

/**
 * Flattens a LangChain message content payload into plain text. Local models
 * generally return a string, but structured content parts are handled
 * defensively.
 */
const flattenContent = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text: unknown }).text ?? '');
        }
        return '';
      })
      .join('');
  }
  return String(content ?? '');
};

/**
 * Chat provider backed by a locally hosted Ollama model (e.g. qwen2.5:3b).
 *
 * Model auto-pulling is deliberately disabled so a missing model produces a
 * clear error instead of silently downloading gigabytes of weights at request
 * time. Requests are bounded by the shared Ollama semaphore, timeout, and
 * retry policy in `resilience.ts`.
 */
export class OllamaChatProvider implements ChatProvider {
  private readonly client: ChatOllama;

  constructor() {
    this.client = new ChatOllama({
      model: config.llm.model,
      baseUrl: config.llm.ollama.baseUrl,
      temperature: config.llm.temperature,
      numCtx: config.llm.ollama.numCtx,
      numPredict: config.llm.ollama.numPredict,
      keepAlive: config.llm.ollama.keepAlive,
      // Never auto-pull models on request; downloads are an explicit, manual
      // operator step.
      checkOrPullModel: false,
    });
  }

  async generate(messages: ChatMessage[]): Promise<string> {
    const baseMessages = messages.map((toBaseMessage));

    const response = await withOllamaLimits(
      'Ollama chat generation',
      (signal) => this.client.invoke(baseMessages, { signal })
    );

    return flattenContent(response.content);
  }
}
