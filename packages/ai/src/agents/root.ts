import type { ToolCall } from '@ai-sdk/provider-utils';
import { ChatType, LLMProvider, OPENROUTER_MODELS, type ChatMessage, type ModelConfig } from '@onlook/models';
import { NoSuchToolError, generateObject, smoothStream, stepCountIs, streamText, type ToolSet } from 'ai';
import {
    convertToStreamMessages,
    getAskModeSystemPrompt,
    getCreatePageSystemPrompt,
    getSystemPrompt,
    getToolSetFromType,
    initModel,
} from '../index';

export const createRootAgentStream = ({
    chatType,
    conversationId,
    projectId,
    userId,
    traceId,
    messages,
}: {
    chatType: ChatType;
    conversationId: string;
    projectId: string;
    userId: string;
    traceId: string;
    messages: ChatMessage[];
}) => {
    const modelConfig = getModelFromType(chatType);
    const systemPrompt = getSystemPromptFromType(chatType);

    const envProvider = process.env.LLM_PROVIDER as LLMProvider | undefined;
    const isWanqing = envProvider === LLMProvider.WANQING;

    const toolSet = isWanqing ? ({} as ToolSet) : getToolSetFromType(chatType);

    return streamText({
        providerOptions: modelConfig.providerOptions,
        messages: convertToStreamMessages(messages),
        model: modelConfig.model,
        system: systemPrompt,
        // 在 WANQING 模式下禁用工具调用，仅进行纯聊天，避免兼容性问题
        tools: isWanqing ? undefined : toolSet,
        headers: modelConfig.headers,
        stopWhen: stepCountIs(20),
        experimental_repairToolCall: isWanqing ? undefined : repairToolCall,
        experimental_transform: smoothStream(),
        experimental_telemetry: {
            isEnabled: true,
            metadata: {
                conversationId,
                projectId,
                userId,
                chatType,
                tags: ['chat'],
                langfuseTraceId: traceId,
                sessionId: conversationId,
            },
        },
    });
};

function resolveOpenRouterModel(envVarName: string, fallback: OPENROUTER_MODELS): OPENROUTER_MODELS {
    const value = typeof process !== 'undefined' ? process.env[envVarName] : undefined;
    if (!value) {
        return fallback;
    }
    // Allow any custom model id (e.g. qwen, kimi) and pass it through to OpenRouter.
    return value as OPENROUTER_MODELS;
}

const DEFAULT_MODEL_CREATE = OPENROUTER_MODELS.OPEN_AI_GPT_5;
const DEFAULT_MODEL_FIX = OPENROUTER_MODELS.OPEN_AI_GPT_5;
const DEFAULT_MODEL_ASK = OPENROUTER_MODELS.CLAUDE_4_5_SONNET;
const DEFAULT_MODEL_EDIT = OPENROUTER_MODELS.CLAUDE_4_5_SONNET;
const DEFAULT_MODEL_REPAIR = OPENROUTER_MODELS.OPEN_AI_GPT_5_NANO;

const CONFIG_MODEL_CREATE = resolveOpenRouterModel('OPENROUTER_MODEL_CREATE', DEFAULT_MODEL_CREATE);
const CONFIG_MODEL_FIX = resolveOpenRouterModel('OPENROUTER_MODEL_FIX', DEFAULT_MODEL_FIX);
const CONFIG_MODEL_ASK = resolveOpenRouterModel('OPENROUTER_MODEL_ASK', DEFAULT_MODEL_ASK);
const CONFIG_MODEL_EDIT = resolveOpenRouterModel('OPENROUTER_MODEL_EDIT', DEFAULT_MODEL_EDIT);
const CONFIG_MODEL_REPAIR = resolveOpenRouterModel('OPENROUTER_MODEL_REPAIR', DEFAULT_MODEL_REPAIR);

const getSystemPromptFromType = (chatType: ChatType): string => {
    switch (chatType) {
        case ChatType.CREATE:
            return getCreatePageSystemPrompt();
        case ChatType.ASK:
            return getAskModeSystemPrompt();
        case ChatType.EDIT:
        default:
            return getSystemPrompt();
    }
};

const getEnvModelConfig = () => {
    const provider = process.env.LLM_PROVIDER as LLMProvider | undefined;
    const model = process.env.LLM_MODEL;

    if (!provider || !model) {
        return null;
    }

    if (!Object.values(LLMProvider).includes(provider)) {
        console.warn(
            `[ai] Invalid LLM_PROVIDER="${provider}", expected one of ${Object.values(LLMProvider).join(
                ', ',
            )}. Falling back to built-in defaults.`,
        );
        return null;
    }

    return { provider, model };
};

const getModelFromType = (chatType: ChatType): ModelConfig => {
    // If a global provider/model is configured via env, use it for all chat types.
    const envConfig = getEnvModelConfig();
    if (envConfig) {
        return initModel(envConfig);
    }

    // Otherwise, fall back to the original OpenRouter-based mapping.
    switch (chatType) {
        case ChatType.CREATE:
        case ChatType.FIX:
            return initModel({
                provider: LLMProvider.OPENROUTER,
                model: chatType === ChatType.CREATE ? CONFIG_MODEL_CREATE : CONFIG_MODEL_FIX,
            });
        case ChatType.ASK:
        case ChatType.EDIT:
        default:
            return initModel({
                provider: LLMProvider.OPENROUTER,
                model: chatType === ChatType.ASK ? CONFIG_MODEL_ASK : CONFIG_MODEL_EDIT,
            });
    }
};

export const repairToolCall = async ({
    toolCall,
    tools,
    error,
}: {
    toolCall: ToolCall<string, unknown>;
    tools: ToolSet;
    error: Error;
}) => {
    if (NoSuchToolError.isInstance(error)) {
        throw new Error(
            `Tool "${toolCall.toolName}" not found. Available tools: ${Object.keys(tools).join(', ')}`,
        );
    }
    const tool = tools[toolCall.toolName];
    if (!tool?.inputSchema) {
        throw new Error(`Tool "${toolCall.toolName}" has no input schema`);
    }

    const envConfig = getEnvModelConfig();

    // WANQING 自定义 provider 目前只实现了基础的文本 / tool 调用，不适合作为
    // generateObject 的“修复模型”。在 WANQING 模式下，直接抛出原始的参数错误，
    // 避免在修复阶段再次触发模型调用异常。
    if (envConfig?.provider === LLMProvider.WANQING) {
        throw error;
    }

    console.warn(
        `Invalid parameter for tool ${toolCall.toolName} with args ${JSON.stringify(
            toolCall.input,
        )}, attempting to fix`,
    );

    const { model } = initModel(
        envConfig ?? {
            provider: LLMProvider.OPENROUTER,
            model: CONFIG_MODEL_REPAIR,
        },
    );

    const { object: repairedArgs } = await generateObject({
        model,
        schema: tool.inputSchema,
        prompt: [
            `The model tried to call the tool "${toolCall.toolName}"` +
                ` with the following arguments:`,
            JSON.stringify(toolCall.input),
            `The tool accepts the following schema:`,
            JSON.stringify(tool?.inputSchema),
            'Please fix the inputs. Return the fixed inputs as a JSON object, DO NOT include any other text.',
        ].join('\n'),
    });

    return {
        type: 'tool-call' as const,
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        input: JSON.stringify(repairedArgs),
    };
};
