'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Calendar, Sparkles } from 'lucide-react';
import Image from 'next/image';
import type { PMScoreResult } from '@/types/analysis';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatProps {
  pmScore: PMScoreResult | null;
  websiteUrl: string;
}

export function AIChat({ pmScore, websiteUrl }: AIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Initialize with welcome message when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0 && pmScore) {
      const companyName = (() => {
        try {
          return new URL(websiteUrl).hostname.replace('www.', '').split('.')[0];
        } catch {
          return 'your website';
        }
      })();

      setMessages([
        {
          role: 'assistant',
          content: `Hi! I've analyzed ${companyName}'s positioning and found some interesting insights. Your site scored ${pmScore.totalScore}/100 (Grade ${pmScore.grade}).\n\nAsk me anything about the results — like "Why did I score low on problem articulation?" or "How can I improve my hero section?"\n\nFor deeper strategic work, you can also book a call with Matteo!`,
        },
      ]);
    }
  }, [isOpen, messages.length, pmScore, websiteUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !pmScore) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          pmScore,
          websiteUrl,
          history: messages,
        }),
      });

      if (!response.ok) throw new Error('Chat failed');

      const data = await response.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "I'm having trouble connecting right now. For detailed help, book a call with Matteo!",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = [
    "What's my biggest positioning gap?",
    "How can I improve my hero section?",
    "What quick wins should I prioritize?",
  ];

  if (!pmScore) return null;

  return (
    <>
      {/* Floating chat button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 group ${isOpen ? 'hidden' : ''}`}
        aria-label="Open chat"
      >
        <div className="relative flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-card border border-border transition-transform duration-200 hover:scale-105 logo-spin-trigger">
          <Image
            src="/genesys-logo.png"
            alt="Genesys"
            width={28}
            height={28}
            className="rounded-full relative z-10 logo-spin-target sm:w-9 sm:h-9"
          />
          {/* Online indicator */}
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-primary rounded-full border-2 border-background" />
        </div>
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed inset-2 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:w-[400px] sm:h-[560px] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center overflow-hidden logo-spin-trigger">
                  <Image
                    src="/genesys-logo.png"
                    alt="Genesys"
                    width={28}
                    height={28}
                    className="rounded-lg logo-spin-target"
                  />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-card" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground tracking-tight">Genesys AI</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Powered by Claude
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-secondary rounded-xl transition-colors duration-200"
              aria-label="Close chat"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-secondary text-foreground rounded-bl-md border border-border'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-secondary border border-border rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested questions */}
          {messages.length <= 2 && (
            <div className="px-5 pb-3 flex flex-wrap gap-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="text-xs px-3 py-1.5 rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent transition-all duration-200"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-5 pb-4 pt-2 border-t border-border">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 relative group">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your results..."
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              <a
                href="https://cal.com/matteo-titta/30min?layout=month_view&overlayCalendar=true"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                <Calendar className="h-3 w-3" />
                <span>Want deeper help? Book a call with Matteo</span>
              </a>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
