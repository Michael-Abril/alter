/**
 * Chat with Alter - Standalone chat page
 * Talk to your AI digital twin
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Send, Loader2, Sparkles, MessageSquare, Bot, User } from 'lucide-react';
import { isUserNotFoundResponse } from '@/lib/dashboard-client-guard';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  async function handleSend() {
    if (!message.trim() || loading) return;

    setLoading(true);
    setError('');
    const userMessage = message.trim();
    setMessage('');

    // Add user message to history immediately
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setHistory((h) => [...h, newUserMessage]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (isUserNotFoundResponse(res, data)) {
        router.replace('/onboarding');
        return;
      }

      if (data.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date(),
        };
        setHistory((h) => [...h, assistantMessage]);
      } else {
        setError(data.error || 'Failed to get response');
      }
    } catch (err) {
      setError('Failed to connect to AI');
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    'What can you help me with?',
    'Summarize my recent activity',
    'Help me write an email',
    'What projects am I working on?',
  ];

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-6">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-nightshift-accent to-nightshift-highlight flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold tracking-tight text-nightshift-text-primary">
                    Chat with Alter
                  </h1>
                  <p className="text-sm text-nightshift-text-secondary">
                    Your AI digital twin, powered by Llama 3.3 70B
                  </p>
                </div>
              </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-4">
              {history.length === 0 ? (
                // Empty state with suggestions
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="h-16 w-16 rounded-2xl bg-nightshift-surface border border-nightshift-border flex items-center justify-center mb-4">
                    <MessageSquare className="h-8 w-8 text-nightshift-text-muted" />
                  </div>
                  <h2 className="text-lg font-semibold text-nightshift-text-primary mb-2">
                    Start a conversation
                  </h2>
                  <p className="text-sm text-nightshift-text-secondary mb-6 max-w-md">
                    I'm Alter, your AI assistant. I can help you with tasks, answer questions, and learn your preferences over time.
                  </p>

                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setMessage(suggestion)}
                        className="text-sm px-4 py-2 rounded-full border border-nightshift-border hover:border-nightshift-accent hover:text-nightshift-accent transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                // Chat messages
                <>
                  {history.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-nightshift-accent to-nightshift-highlight flex items-center justify-center shrink-0">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-nightshift-accent text-white'
                            : 'bg-nightshift-surface border border-nightshift-border text-nightshift-text-primary'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            msg.role === 'user'
                              ? 'text-white/60'
                              : 'text-nightshift-text-muted'
                          }`}
                        >
                          {msg.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="h-8 w-8 rounded-lg bg-nightshift-surface border border-nightshift-border flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-nightshift-text-muted" />
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-nightshift-accent to-nightshift-highlight flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-nightshift-surface border border-nightshift-border rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2 text-nightshift-text-muted">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-nightshift-error/10 border border-nightshift-error/30 text-nightshift-error text-sm">
                {error}
              </div>
            )}

            {/* Input area */}
            <div className="border-t border-nightshift-border pt-4">
              <div className="flex gap-3">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message..."
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-nightshift-surface border border-nightshift-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nightshift-accent focus:border-transparent disabled:opacity-50 text-nightshift-text-primary placeholder:text-nightshift-text-muted"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !message.trim()}
                  className="btn-primary px-5 py-3 rounded-xl disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-nightshift-text-muted mt-2 text-center">
                Powered by Akash ML (Llama 3.3 70B)
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
