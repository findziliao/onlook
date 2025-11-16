import { makeAutoObservable } from "mobx";
import type { EditorEngine } from "../engine";
import type { ChatMessage } from "@onlook/models";

export class ApiManager {
    constructor(private editorEngine: EditorEngine) {
        makeAutoObservable(this);
    }

    async webSearch(input: {
        query: string,
        allowed_domains: string[] | undefined,
        blocked_domains: string[] | undefined
    }): Promise<never> {
        console.warn("webSearch is disabled in local-only mode", input);
        throw new Error("webSearch is not available in local-only mode");
    }

    async applyDiff(input: {
        originalCode: string,
        updateSnippet: string,
        instruction: string,
        metadata: {
            projectId: string;
            conversationId: string | undefined;
        }
    }): Promise<never> {
        console.warn("applyDiff is disabled in local-only mode", input);
        throw new Error("applyDiff is not available in local-only mode");
    }

    async scrapeUrl(input: {
        url: string;
        formats?: ("json" | "markdown" | "html" | "branding")[] | undefined;
        onlyMainContent?: boolean | undefined;
        includeTags?: string[] | undefined;
        excludeTags?: string[] | undefined;
        waitFor?: number | undefined;
    }): Promise<never> {
        console.warn("scrapeUrl is disabled in local-only mode", input);
        throw new Error("scrapeUrl is not available in local-only mode");
    }

    async getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
        console.warn("getConversationMessages is disabled in local-only mode", conversationId);
        throw new Error("getConversationMessages is not available in local-only mode");
    }
}
