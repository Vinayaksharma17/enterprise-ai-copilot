'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { askQuestion, SourceCitation } from '@/lib/api-client';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources: SourceCitation[];
}

export default function ChatPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    setToken(storedToken);
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!token || !trimmed || loading) {
      return;
    }

    setError('');
    setQuestion('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed, sources: [] }]);
    setLoading(true);

    try {
      const response = await askQuestion(token, {
        question: trimmed,
        conversationId,
      });

      if (response.success && response.data) {
        setConversationId(response.data.conversationId);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: response.data!.answer,
            sources: response.data!.sources,
          },
        ]);
      } else {
        setError(response.message || 'Failed to get an answer');
      }
    } catch {
      setError('Failed to get an answer');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    router.push('/login');
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setError('');
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-gray-900">Ask the Knowledge Base</h1>
            <nav className="flex gap-4 text-sm text-gray-600">
              <Link href="/documents" className="hover:text-gray-900">
                Documents
              </Link>
              <Link href="/chat" className="font-medium text-gray-900">
                Chat
              </Link>
              <Link href="/profile" className="hover:text-gray-900">
                Profile
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {conversationId && (
              <button
                onClick={startNewConversation}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                New conversation
              </button>
            )}
            <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
        <div className="flex-1 space-y-4 overflow-y-auto">
          {messages.length === 0 && !loading && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
              Ask a question about the documents you have access to. Answers include source
              citations.
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                  message.role === 'user'
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-200 bg-white text-gray-900'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>

                {message.sources.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Sources
                    </p>
                    {message.sources.map((source, sourceIndex) => (
                      <details
                        key={`${source.chunkId}-${sourceIndex}`}
                        className="rounded-md bg-gray-50 p-2"
                      >
                        <summary className="cursor-pointer text-xs font-medium text-gray-800">
                          {source.documentName}
                          {source.pageNumber ? ` — page ${source.pageNumber}` : ''}
                          {source.sectionTitle ? ` — ${source.sectionTitle}` : ''}
                        </summary>
                        <p className="mt-2 text-xs leading-relaxed text-gray-600">
                          {source.excerpt}
                        </p>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
                Thinking...
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
          )}

          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about your documents..."
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="rounded-md bg-gray-900 px-5 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Ask
          </button>
        </form>
      </main>
    </div>
  );
}
