import { Icons } from '@onlook/ui/icons/index';
import { ChatTabContent } from './chat-tab-content';
import { useEditorEngine } from '@/components/store/editor';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import type { ChatMessage } from '@onlook/models';

interface ChatTabProps {
    conversationId: string;
    projectId: string;
}

export const ChatTab = observer(({ conversationId, projectId }: ChatTabProps) => {
    const editorEngine = useEditorEngine();
    const [isLoading, setIsLoading] = useState(true);
    const [initialMessages, setInitialMessages] = useState<ChatMessage[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        (async () => {
            try {
                const stored = await editorEngine.chat.conversation.getConversations(projectId);
                const current = stored.find((c) => c.id === conversationId);
                // For now we do not persist message history; start with empty array.
                if (!cancelled) {
                    setInitialMessages([]);
                }
            } catch (error) {
                console.error('Failed to load initial messages for conversation', error);
                if (!cancelled) {
                    setInitialMessages([]);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [conversationId, projectId, editorEngine.chat.conversation]);

    if (!initialMessages || isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center w-full h-full text-foreground-secondary" >
                <Icons.LoadingSpinner className="animate-spin mr-2" />
                <p>Loading messages...</p>
            </div >
        );
    }

    return (
        <ChatTabContent
            // Used to force re-render the use-chat hook when the conversationId changes
            key={conversationId}
            conversationId={conversationId}
            projectId={projectId}
            initialMessages={initialMessages}
        />
    );
});
