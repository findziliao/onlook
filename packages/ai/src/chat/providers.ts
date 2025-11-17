import {
    LLMProvider,
    MODEL_MAX_TOKENS,
    type InitialModelPayload,
    type ModelConfig
} from '@onlook/models';
import { assertNever } from '@onlook/utility';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';
import { WanqingLanguageModel } from './wanqing-model';

const DEFAULT_MAX_TOKENS = 200000;

export function initModel({
    provider: requestedProvider,
    model: requestedModel,
}: InitialModelPayload): ModelConfig {
    let model: LanguageModel;
    let providerOptions: Record<string, any> | undefined;
    let headers: Record<string, string> | undefined;
    const maxOutputTokens: number = MODEL_MAX_TOKENS[requestedModel] ?? DEFAULT_MAX_TOKENS;

    switch (requestedProvider) {
        case LLMProvider.OPENROUTER: {
            model = getOpenRouterProvider(requestedModel);
            headers = {
                'HTTP-Referer': 'https://onlook.com',
                'X-Title': 'Onlook',
            };
            providerOptions = {
                openrouter: { transforms: ['middle-out'] },
            };
            break;
        }
        case LLMProvider.OPENAI: {
            model = getOpenAIProvider(requestedModel);
            break;
        }
        case LLMProvider.ANTHROPIC: {
            model = getAnthropicProvider(requestedModel);
            break;
        }
        case LLMProvider.WANQING: {
            model = getWanqingProvider(requestedModel);
            break;
        }
        default:
            assertNever(requestedProvider);
    }

    return {
        model,
        providerOptions,
        headers,
        maxOutputTokens,
    };
}

function getOpenRouterProvider(model: string): LanguageModel {
    if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY must be set for OpenRouter provider');
    }
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    return openrouter(model);
}

function getOpenAIProvider(model: string): LanguageModel {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY must be set for OpenAI provider');
    }
    const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
    });
    return openai(model);
}

function getAnthropicProvider(model: string): LanguageModel {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY must be set for Anthropic provider');
    }
    const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: process.env.ANTHROPIC_BASE_URL,
    });
    return anthropic(model);
}

function getWanqingProvider(model: string): LanguageModel {
    return new WanqingLanguageModel(model);
}
