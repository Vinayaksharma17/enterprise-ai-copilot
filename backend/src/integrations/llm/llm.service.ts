import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { config } from '../../config/env';
import { OllamaChatProvider } from './ollama.chat';
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

export class OpenAIChatProvider implements ChatProvider {
  private readonly client: ChatOpenAI;

  constructor() {
    if (!config.llm.apiKey) {
      throw new Error('LLM_API_KEY is not configured');
    }
    this.client = new ChatOpenAI({
      apiKey: config.llm.apiKey,
      model: config.llm.model,
      temperature: config.llm.temperature,
      configuration: config.llm.baseUrl
        ? { baseURL: config.llm.baseUrl }
        : undefined,
    });
  }

  async generate(messages: ChatMessage[]): Promise<string> {
    const response = await this.client.invoke(
      messages.map((message) => toBaseMessage(message))
    );
    const { content } = response;

    if (typeof content === 'string') {
      return content;
    }

    // Some providers return structured content parts; flatten text parts.
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
  }
}

/**
 * Builds the chat provider selected by `LLM_PROVIDER`. Only the configured
 * provider is ever constructed, so selecting Ollama guarantees no cloud client
 * (and no cloud credentials) is used implicitly.
 */
export const createChatProvider = (): ChatProvider => {
  if (config.llm.provider === 'ollama') {
    return new OllamaChatProvider();
  }
  return new OpenAIChatProvider();
};

let chatProviderInstance: ChatProvider | undefined;

export const getChatProvider = (): ChatProvider => {
  if (!chatProviderInstance) {
    chatProviderInstance = createChatProvider();
  }
  return chatProviderInstance;
};

export const setChatProviderForTesting = (provider: ChatProvider): void => {
  chatProviderInstance = provider;
};
