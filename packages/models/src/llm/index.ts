import type { LanguageModel } from 'ai';

export enum LLMProvider {
    OPENROUTER = 'openrouter',
    OPENAI = 'openai',
    ANTHROPIC = 'anthropic',
    WANQING = 'wanqing',
}

export enum OPENROUTER_MODELS {
    // Generate object does not work for Anthropic models https://github.com/OpenRouterTeam/ai-sdk-provider/issues/165
    CLAUDE_4_5_SONNET = 'anthropic/claude-sonnet-4.5',
    CLAUDE_3_5_HAIKU = 'anthropic/claude-3.5-haiku',
    OPEN_AI_GPT_5 = 'openai/gpt-5',
    OPEN_AI_GPT_5_MINI = 'openai/gpt-5-mini',
    OPEN_AI_GPT_5_NANO = 'openai/gpt-5-nano',
}

export type InitialModelPayload = {
    provider: LLMProvider;
    /**
     * The model identifier used by the underlying provider.
     * For OpenRouter, this is the full `provider/model` id (e.g. `openai/gpt-5`).
     * For OpenAI / Anthropic, this is the raw model id (e.g. `gpt-4.1`, `claude-3-5-sonnet-latest`).
     * For WANQING, this is the WANQING model id (e.g. `ep-xxxx`).
     */
    model: string;
};

export type ModelConfig = {
    model: LanguageModel;
    providerOptions?: Record<string, unknown>;
    headers?: Record<string, string>;
    maxOutputTokens: number;
};

export const MODEL_MAX_TOKENS: Record<string, number> = {
    [OPENROUTER_MODELS.CLAUDE_4_5_SONNET]: 200000,
    [OPENROUTER_MODELS.CLAUDE_3_5_HAIKU]: 200000,
    [OPENROUTER_MODELS.OPEN_AI_GPT_5_NANO]: 400000,
    [OPENROUTER_MODELS.OPEN_AI_GPT_5_MINI]: 400000,
    [OPENROUTER_MODELS.OPEN_AI_GPT_5]: 400000,
};
