import { type ChatConversation } from '@onlook/models';
import localforage from 'localforage';
import { makeAutoObservable } from 'mobx';
import type { EditorEngine } from '../engine';

interface CurrentConversation extends ChatConversation {
    messageCount: number;
}

export class ConversationManager {
    current: CurrentConversation | null = null;
    conversations: ChatConversation[] = [];
    creatingConversation = false;

    constructor(private editorEngine: EditorEngine) {
        makeAutoObservable(this);
    }

    async getConversations(projectId: string): Promise<ChatConversation[]> {
        const conversations = await this.getConversationsFromStorage(projectId);
        const sorted = conversations.sort((a, b) => {
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        return sorted;
    }

    setConversationLength(length: number) {
        if (this.current) {
            this.current = {
                ...this.current,
                messageCount: length,
            };
        }
    }

    async startNewConversation() {
        try {
            this.creatingConversation = true;
            if (this.current?.messageCount === 0 && !this.current?.title) {
                // Current conversation is already empty; no need to start a new one.
                return;
            }
            const newConversation = await this.upsertConversationInStorage({
                projectId: this.editorEngine.projectId,
            });
            this.current = {
                ...newConversation,
                messageCount: 0,
            };
            this.conversations.push(newConversation);
        } catch (error) {
            console.error('Error starting new conversation', error);
        } finally {
            this.creatingConversation = false;
        }
    }

    async selectConversation(id: string) {
        const match = this.conversations.find((c) => c.id === id);
        if (!match) {
            console.error('No conversation found with id', id);
            return;
        }

        this.current = {
            ...match,
            messageCount: 0,
        };
    }

    deleteConversation(id: string) {
        if (!this.current) {
            console.error('No conversation found');
            return;
        }

        const index = this.conversations.findIndex((c) => c.id === id);
        if (index === -1) {
            console.error('No conversation found with id', id);
            return;
        }
        this.conversations.splice(index, 1);
        void this.deleteConversationInStorage(id);
        if (this.current?.id === id) {
            if (this.conversations.length > 0 && !!this.conversations[0]) {
                void this.selectConversation(this.conversations[0].id);
            } else {
                void this.startNewConversation();
            }
        }
    }

    async generateTitle(content: string): Promise<void> {
        if (!this.current) {
            console.error('No conversation found');
            return;
        }
        const title =
            content?.split('\n')?.[0]?.slice(0, 80)?.trim() || 'Conversation';
        if (!title) {
            console.error('Error generating conversation title. No title returned.');
            return;
        }
        // Update local active conversation 
        this.current = {
            ...this.current,
            title,
        };
        // Update in local conversations list
        const index = this.conversations.findIndex((c) => c.id === this.current?.id);
        if (index !== -1 && this.conversations[index]) {
            this.conversations[index] = {
                ...this.conversations[index],
                title,
            };
        }
    }

    async getConversationsFromStorage(id: string): Promise<ChatConversation[] | null> {
        const key = getStorageKey(id);
        const stored = await localforage.getItem<ChatConversation[]>(key);
        if (!stored) {
            return [];
        }
        // Ensure Date instances for createdAt/updatedAt
        return stored.map((conversation) => ({
            ...conversation,
            createdAt: new Date(conversation.createdAt),
            updatedAt: new Date(conversation.updatedAt),
        }));
    }

    async upsertConversationInStorage(conversation: Partial<ChatConversation>): Promise<ChatConversation> {
        const projectId = this.editorEngine.projectId;
        const key = getStorageKey(projectId);
        const existing = await this.getConversationsFromStorage(projectId);
        const now = new Date();

        if (conversation.id) {
            const index = existing.findIndex((c) => c.id === conversation.id);
            if (index !== -1) {
                const updated: ChatConversation = {
                    ...existing[index]!,
                    ...conversation,
                    updatedAt: now,
                } as ChatConversation;
                existing[index] = updated;
                await localforage.setItem(key, existing);
                return updated;
            }
        }

        const id = crypto.randomUUID();
        const newConversation: ChatConversation = {
            id,
            projectId,
            title: null,
            createdAt: now,
            updatedAt: now,
            ...conversation,
        } as ChatConversation;
        const next = [...existing, newConversation];
        await localforage.setItem(key, next);
        return newConversation;
    }

    async updateConversationInStorage(conversation: Partial<ChatConversation> & { id: string }) {
        const projectId = this.editorEngine.projectId;
        const key = getStorageKey(projectId);
        const existing = await this.getConversationsFromStorage(projectId);
        const index = existing.findIndex((c) => c.id === conversation.id);
        if (index === -1) return;

        const updated: ChatConversation = {
            ...existing[index]!,
            ...conversation,
            updatedAt: new Date(),
        };
        existing[index] = updated;
        await localforage.setItem(key, existing);
    }

    async deleteConversationInStorage(id: string) {
        const projectId = this.editorEngine.projectId;
        const key = getStorageKey(projectId);
        const existing = await this.getConversationsFromStorage(projectId);
        const next = existing.filter((c) => c.id !== id);
        await localforage.setItem(key, next);
    }

    clear() {
        this.current = null;
        this.conversations = [];
    }
}

const getStorageKey = (projectId: string) => `onlook-local-conversations:${projectId}`;
