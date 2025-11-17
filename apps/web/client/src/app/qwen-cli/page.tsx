'use client';

import { useState, type KeyboardEvent } from 'react';

type Message = {
    role: 'user' | 'assistant';
    content: string;
};

export default function QwenCliPage() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSend = async () => {
        if (!input.trim() || isLoading) {
            return;
        }

        const prompt = input.trim();
        setInput('');
        setError(null);

        const userMessage: Message = {
            role: 'user',
            content: prompt,
        };
        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/qwen-cli', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt }),
            });

            const data = (await response.json().catch(() => null)) as
                | { answer?: unknown; error?: unknown }
                | null;

            if (!response.ok || !data || typeof data.answer !== 'string') {
                const errorMessage =
                    (data && typeof data.error === 'string' && data.error) ||
                    'Failed to call Qwen Code CLI. Please check the server logs.'

                setError(errorMessage);
                setMessages((prev) => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: errorMessage,
                    },
                ]);
                return;
            }

            const assistantMessage: Message = {
                role: 'assistant',
                content: data.answer,
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch {
            const errorMessage = 'Failed to call Qwen Code CLI. Please check the server logs.';

            setError(errorMessage);
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: errorMessage,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void handleSend();
        }
    };

    return (
        <div className="flex h-screen flex-col gap-4 p-4">
            <h1 className="text-title1">Qwen Code CLI Chat</h1>

            <div className="flex-1 overflow-y-auto rounded border border-border bg-background p-3 text-sm">
                {messages.length === 0 ? (
                    <p className="text-muted-foreground">
                        {'Ask Qwen Code CLI about this repository (you can reference files like @apps/web/client/src/...).'}
                    </p>
                ) : (
                    <div className="space-y-2">
                        {messages.map((message, index) => (
                            <div key={index} className="whitespace-pre-wrap">
                                <span className="font-semibold">
                                    {message.role === 'user' ? 'You' : 'Qwen'}:
                                </span>{' '}
                                {message.content}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2">
                <input
                    className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ask Qwen Code CLI about this repository (you can reference files like @apps/web/client/src/...)."
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                />
                <button
                    type="button"
                    className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    onClick={() => {
                        void handleSend();
                    }}
                    disabled={isLoading || !input.trim()}
                >
                    {isLoading ? '...' : 'Send'}
                </button>
            </div>

            {error && (
                <p className="text-xs text-red-500">
                    {error}
                </p>
            )}
        </div>
    );
}
