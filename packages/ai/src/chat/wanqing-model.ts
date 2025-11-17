import type { LanguageModel } from 'ai';

type ToolChoice =
    | 'auto'
    | 'none'
    | 'required'
    | {
          type: 'tool';
          toolName: string;
      };

type ToolDefinition = {
    type: 'function';
    name: string;
    description?: string;
    // In practice this is a JSON schema object.
    inputSchema?: unknown;
};

type PromptMessage = {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: Array<
        | { type: 'text'; text: string }
        | { type: 'file'; filename?: string }
        | {
              type: 'tool-call';
              toolCallId: string;
              toolName: string;
              args: unknown;
          }
        | {
              type: 'tool-result';
              toolCallId: string;
              result: unknown;
          }
    >;
};

type CallOptions = {
    prompt: PromptMessage[];
    tools?: ToolDefinition[];
    toolChoice?: ToolChoice;
    maxOutputTokens?: number;
    temperature?: number;
    abortSignal?: AbortSignal;
    headers?: Record<string, string | undefined>;
    providerOptions?: Record<string, unknown>;
};

export class WanqingLanguageModel implements LanguageModel {
    readonly specificationVersion = 'v2' as const;
    readonly provider = 'wanqing.chat';
    readonly supportedUrls = {};

    constructor(public readonly modelId: string) {}

    async doGenerate(options: CallOptions) {
        const baseURL = process.env.WQ_BASE_URL;
        const apiKey = process.env.WQ_API_KEY;

        if (!baseURL || !apiKey) {
            throw new Error('WQ_BASE_URL and WQ_API_KEY must be set for WANQING provider');
        }

        const messages = this.convertMessages(options.prompt);
        const tools = this.convertTools(options.tools ?? []);
        const tool_choice = this.convertToolChoice(options.toolChoice);

        const body = {
            model: this.modelId,
            messages,
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: tool_choice ?? 'auto',
            max_tokens: options.maxOutputTokens,
            temperature: options.temperature,
        };

        const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                ...options.headers,
            },
            body: JSON.stringify(body),
            signal: options.abortSignal,
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(
                `WANQING chat request failed: ${response.status} ${response.statusText} ${text}`,
            );
        }

        const data: any = await response.json();
        const choice = data.choices?.[0];

        if (!choice) {
            throw new Error('WANQING response has no choices');
        }

        const usage = {
            inputTokens: data.usage?.prompt_tokens ?? 0,
            outputTokens: data.usage?.completion_tokens ?? 0,
            totalTokens:
                data.usage?.total_tokens ??
                (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0),
            reasoningTokens: 0,
            cachedInputTokens: 0,
        };

        // Tool calls
        if (choice.message?.tool_calls?.length) {
            const content = choice.message.tool_calls.map((tc: any) => ({
                type: 'tool-call' as const,
                toolCallId: tc.id,
                toolName: tc.function?.name,
                input: tc.function?.arguments ?? '{}',
            }));

            return {
                content,
                usage,
                finishReason: this.mapFinishReason(choice.finish_reason),
                response: {
                    id: data.id,
                    timestamp: new Date(),
                    modelId: data.model ?? this.modelId,
                    headers: Object.fromEntries(response.headers.entries()),
                },
                request: {
                    body,
                },
            };
        }

        // Plain text
        const text = choice.message?.content ?? '';

        return {
            content: [
                {
                    type: 'text' as const,
                    text,
                },
            ],
            usage,
            finishReason: this.mapFinishReason(choice.finish_reason),
            response: {
                id: data.id,
                timestamp: new Date(),
                modelId: data.model ?? this.modelId,
                headers: Object.fromEntries(response.headers.entries()),
            },
            request: {
                body,
            },
        };
    }

    async doStream(options: CallOptions) {
        // Fallback implementation: reuse doGenerate and wrap result into a simple stream.
        const result = await this.doGenerate(options as CallOptions);

        const stream = new ReadableStream({
            start(controller) {
                for (const part of result.content as any[]) {
                    if (part.type === 'text') {
                        controller.enqueue({
                            type: 'text-delta',
                            textDelta: part.text,
                        });
                    } else if (part.type === 'tool-call') {
                        controller.enqueue({
                            type: 'tool-call',
                            toolCallId: part.toolCallId,
                            toolName: part.toolName,
                            input: part.input,
                        });
                    }
                }

                controller.enqueue({
                    type: 'finish',
                    finishReason: (result as any).finishReason ?? 'stop',
                    usage: result.usage,
                });

                controller.close();
            },
        });

        return {
            stream,
            response: result.response,
            request: result.request,
        };
    }

    private convertMessages(prompt: PromptMessage[] | any[]) {
        return prompt.map((message: any) => {
            const rawContent = message.content;
            const parts: any[] = Array.isArray(rawContent)
                ? rawContent
                : rawContent == null
                  ? []
                  : [{ type: 'text', text: String(rawContent) }];

            switch (message.role as string) {
                case 'system':
                    return {
                        role: 'system',
                        content: parts
                            .map((part) => (part.type === 'text' ? part.text : ''))
                            .join(''),
                    };
                case 'user':
                    return {
                        role: 'user',
                        content: parts
                            .map((part) => {
                                if (part.type === 'text') return part.text;
                                if (part.type === 'file') {
                                    return `[File: ${part.filename ?? 'unknown'}]`;
                                }
                                return '';
                            })
                            .join(''),
                    };
                case 'assistant': {
                    const assistantContent = parts
                        .map((part) => {
                            if (part.type === 'text') return part.text;
                            if (part.type === 'tool-call') {
                                return `Tool call: ${part.toolName}`;
                            }
                            return '';
                        })
                        .join('');

                    const toolCalls = parts
                        .filter((part) => part.type === 'tool-call')
                        .map((part: any) => ({
                            id: part.toolCallId,
                            type: 'function',
                            function: {
                                name: part.toolName,
                                arguments: JSON.stringify(part.args ?? {}),
                            },
                        }));

                    return {
                        role: 'assistant',
                        content: assistantContent,
                        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
                    };
                }
                case 'tool':
                    return {
                        role: 'tool',
                        content: parts
                            .map((part) => {
                                if (part.type === 'tool-result') {
                                    return JSON.stringify({
                                        tool_use_id: part.toolCallId,
                                        content: part.result,
                                    });
                                }
                                return '';
                            })
                            .join(''),
                    };
                default:
                    throw new Error(`Unsupported message role: ${message.role as string}`);
            }
        });
    }

    private convertTools(tools: ToolDefinition[]) {
        return tools
            .filter((tool) => tool.type === 'function')
            .map((tool) => ({
                type: 'function',
                function: {
                    name: tool.name,
                    description: tool.description,
                    // The AI SDK already provides a JSON schema in inputSchema
                    parameters: tool.inputSchema,
                },
            }));
    }

    private convertToolChoice(toolChoice?: ToolChoice) {
        if (!toolChoice || toolChoice === 'auto') return 'auto';
        if (toolChoice === 'none' || toolChoice === 'required') return toolChoice;

        if (typeof toolChoice === 'object' && toolChoice.type === 'tool') {
            return {
                type: 'function',
                function: {
                    name: toolChoice.toolName,
                },
            };
        }

        return undefined;
    }

    private mapFinishReason(reason: string | null | undefined) {
        switch (reason) {
            case 'stop':
            case 'length':
            case 'content_filter':
            case 'tool_calls':
            case 'error':
                return reason === 'content_filter' ? 'content-filter' : reason === 'tool_calls' ? 'tool-calls' : reason;
            default:
                return 'other';
        }
    }
}
