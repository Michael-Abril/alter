'use client';

import { useState } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';

interface DraftChatProps {
  draftId: string;
  draftContent: string;
  onContentUpdate: (newContent: string) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function DraftChat({ draftId, draftContent, onContentUpdate }: DraftChatProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');

  async function handleSend() {
    if (!message.trim() || loading) return;

    setLoading(true);
    setError('');
    const userMessage = message.trim();
    setMessage('');
    setHistory(h => [...h, { role: 'user', content: userMessage }]);

    try {
      const res = await fetch('/api/drafts/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, draftContent, message: userMessage }),
      });

      const data = await res.json();

      if (data.success) {
        setHistory(h => [...h, { role: 'assistant', content: data.reply }]);
        if (data.updatedContent) {
          onContentUpdate(data.updatedContent);
        }
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
    'Make it more casual',
    'Shorten it',
    'Add more detail',
    'Make it more professional',
  ];

  return (
    <div className="mt-4 border-t border-nightshift-border pt-4">
      <div className="flex items-center gap-2 text-xs text-nightshift-text-muted mb-3">
        <Sparkles className="w-3 h-3" />
        <span>Ask AI to edit this draft</span>
      </div>

      {/* Quick suggestions */}
      {history.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => {
                setMessage(suggestion);
              }}
              className="text-xs px-2 py-1 rounded-full border border-nightshift-border hover:border-nightshift-accent hover:text-nightshift-accent transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Chat history */}
      {history.length > 0 && (
        <div className="mb-3 max-h-40 overflow-y-auto space-y-2">
          {history.map((msg, i) => (
            <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-right' : ''}`}>
              <span
                className={`inline-block px-3 py-1.5 rounded-lg max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-nightshift-accent/20 text-nightshift-accent'
                    : 'bg-nightshift-surface text-nightshift-text-secondary'
                }`}
              >
                {msg.content}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Make it more casual..."
          disabled={loading}
          className="flex-1 px-3 py-2 text-sm bg-nightshift-surface border border-nightshift-border rounded-lg focus:outline-none focus:ring-1 focus:ring-nightshift-accent disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={loading || !message.trim()}
          className="btn-primary px-3 py-2 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
