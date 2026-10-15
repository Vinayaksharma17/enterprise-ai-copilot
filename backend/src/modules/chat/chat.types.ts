export interface SourceCitation {
  documentId: string;
  documentName: string;
  chunkId: string;
  pageNumber?: number;
  sectionTitle?: string;
  excerpt: string;
}

export interface ChatInput {
  question: string;
  conversationId?: string | null;
}

export interface ChatResponse {
  conversationId: string;
  answer: string;
  sources: SourceCitation[];
}
