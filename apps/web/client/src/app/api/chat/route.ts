import { createRootAgentStream } from '@onlook/ai';
import { ChatType, type ChatMessage, type ChatMetadata } from '@onlook/models';
import { type NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { errorHandler } from './helpers';

export async function POST(req: NextRequest) {
    try {
        return streamResponse(req);
    } catch (error: unknown) {
        console.error('Error in chat', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            code: 500,
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

const LOCAL_USER_ID = 'local-user';

export const streamResponse = async (req: NextRequest) => {
    const body = await req.json();
    const { messages, chatType, conversationId, projectId } = body as {
        messages: ChatMessage[],
        chatType: ChatType,
        conversationId: string,
        projectId: string,
    };
    // Updating the usage record and rate limit is done here to avoid
    // abuse in the case where a single user sends many concurrent requests.
    // If the call below fails, the user will not be penalized.
    try {
        const lastUserMessage = messages.findLast((message) => message.role === 'user');
        const traceId = lastUserMessage?.id ?? uuidv4();

        const stream = createRootAgentStream({
            chatType,
            conversationId,
            projectId,
            userId: LOCAL_USER_ID,
            traceId,
            messages,
        });
        return stream.toUIMessageStreamResponse<ChatMessage>(
            {
                originalMessages: messages,
                generateMessageId: () => uuidv4(),
                messageMetadata: ({ part }) => {
                    return {
                        createdAt: new Date(),
                        conversationId,
                        context: [],
                        checkpoints: [],
                        finishReason: part.type === 'finish-step' ? part.finishReason : undefined,
                        usage: part.type === 'finish-step' ? part.usage : undefined,
                    } satisfies ChatMetadata;
                },
                onError: errorHandler,
            }
        );
    } catch (error) {
        console.error('Error in streamResponse setup', error);
        throw error;
    }
}
