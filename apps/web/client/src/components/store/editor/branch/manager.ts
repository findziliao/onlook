import { CodeFileSystem } from '@onlook/file-system';
import type { Branch, RouterType } from '@onlook/models';
import { toast } from '@onlook/ui/sonner';
import type { ParsedError } from '@onlook/utility';
import { makeAutoObservable, reaction } from 'mobx';
import type { EditorEngine } from '../engine';
import { ErrorManager } from '../error';
import { HistoryManager } from '../history';
import { SandboxManager } from '../sandbox';

export interface BranchData {
    branch: Branch;
    sandbox: SandboxManager;
    history: HistoryManager;
    error: ErrorManager;
    codeEditor: CodeFileSystem;
}

export class BranchManager {
    private editorEngine: EditorEngine;
    private currentBranchId: string | null = null;
    private branchMap = new Map<string, BranchData>();
    private reactionDisposer: (() => void) | null = null;

    constructor(editorEngine: EditorEngine) {
        this.editorEngine = editorEngine;
        makeAutoObservable(this);
    }

    async initBranches(branches: Branch[]): Promise<void> {
        this.reactionDisposer?.();
        this.reactionDisposer = null;
        for (const { sandbox, history, error, codeEditor } of this.branchMap.values()) {
            sandbox.clear();
            history.clear();
            error.clear();
            void codeEditor.cleanup();
        }
        this.branchMap.clear();
        for (const branch of branches) {
            this.createBranchData(branch);
        }
        // Preserve previous selection if still present; else default; else first; else null
        const prev = this.currentBranchId;
        if (prev && this.branchMap.has(prev)) {
            this.currentBranchId = prev;
        } else {
            this.currentBranchId =
                branches.find(b => b.isDefault)?.id
                ?? branches[0]?.id
                ?? null;
        }
    }

    async init(): Promise<void> {
        for (const branchData of this.branchMap.values()) {
            await branchData.codeEditor.initialize();
            await branchData.sandbox.init();
        }
        this.setupActiveFrameReaction();
    }

    private setupActiveFrameReaction(): void {
        this.reactionDisposer?.();
        this.reactionDisposer = reaction(
            () => {
                const selectedFrames = this.editorEngine.frames.selected;
                const activeFrame = selectedFrames.length > 0 ? selectedFrames[0] : this.editorEngine.frames.getAll()[0];
                return activeFrame?.frame?.branchId || null;
            },
            (activeBranchId) => {
                if (activeBranchId && activeBranchId !== this.currentBranchId && this.branchMap.has(activeBranchId)) {
                    this.currentBranchId = activeBranchId;
                }
            }
        );
    }

    get activeBranchData(): BranchData {
        if (!this.currentBranchId) {
            throw new Error('No branch selected. This should not happen after proper initialization.');
        }
        const branchData = this.branchMap.get(this.currentBranchId);
        if (!branchData) {
            throw new Error(`Branch not found for branch ${this.currentBranchId}. This should not happen after proper initialization.`);
        }
        return branchData;
    }

    get activeBranch(): Branch {
        return this.activeBranchData.branch;
    }

    get activeSandbox(): SandboxManager {
        return this.activeBranchData.sandbox;
    }

    get activeHistory(): HistoryManager {
        return this.activeBranchData.history;
    }

    get activeError(): ErrorManager {
        return this.activeBranchData.error;
    }

    get activeCodeEditor(): CodeFileSystem {
        return this.activeBranchData.codeEditor;
    }

    async switchToBranch(branchId: string): Promise<void> {
        if (this.currentBranchId === branchId) {
            return;
        }
        this.currentBranchId = branchId;
    }

    getBranchDataById(branchId: string): BranchData | null {
        return this.branchMap.get(branchId) ?? null;
    }

    getBranchById(branchId: string): Branch | null {
        return this.getBranchDataById(branchId)?.branch ?? null;
    }

    getSandboxById(branchId: string): SandboxManager | null {
        return this.getBranchDataById(branchId)?.sandbox ?? null;
    }

    private createBranchData(branch: Branch, routerType?: RouterType): BranchData {
        const codeEditorApi = new CodeFileSystem(this.editorEngine.projectId, branch.id, { routerType });
        const errorManager = new ErrorManager(branch);
        const sandboxManager = new SandboxManager(branch, this.editorEngine, errorManager, codeEditorApi);
        const historyManager = new HistoryManager(this.editorEngine);

        const branchData: BranchData = {
            branch,
            sandbox: sandboxManager,
            history: historyManager,
            error: errorManager,
            codeEditor: codeEditorApi,
        };

        this.branchMap.set(branch.id, branchData);

        return branchData;
    }

    get allBranches(): Branch[] {
        return Array.from(this.branchMap.values()).map(({ branch }) => branch);
    }

    async listBranches(): Promise<Branch[]> {
        return [];
    }

    async forkBranch(branchId: string): Promise<void> {
        toast.error('Branch forking is not available in local-only mode');
        throw new Error('forkBranch is disabled in local-only mode');
    }

    async createBlankSandbox(branchName?: string): Promise<void> {
        toast.error('Creating blank sandboxes is not available in local-only mode');
        throw new Error('createBlankSandbox is disabled in local-only mode');
    }

    async updateBranch(branchId: string, updates: Partial<Branch>): Promise<void> {
        const branchData = this.branchMap.get(branchId);
        if (!branchData) {
            throw new Error('Branch not found');
        }

        // In local-only mode we only update the in-memory branch representation.
        Object.assign(branchData.branch, updates);
    }

    async removeBranch(branchId: string): Promise<void> {
        const branchData = this.branchMap.get(branchId);
        if (branchData) {
            // Remove all frames associated with this branch
            const framesToRemove = this.editorEngine.frames.getAll().filter(
                frameState => frameState.frame.branchId === branchId
            );

            for (const frameState of framesToRemove) {
                this.editorEngine.frames.delete(frameState.frame.id);
            }

            // Clean up the sandbox, history, error manager, and code editor
            branchData.sandbox.clear();
            branchData.history.clear();
            branchData.error.clear();

            // Clean up the entire branch directory
            await branchData.codeEditor.cleanup();
            // Remove from the map
            this.branchMap.delete(branchId);

            // If this was the current branch, switch to default or first available
            if (this.currentBranchId === branchId) {
                const remainingBranches = Array.from(this.branchMap.values()).map(({ branch }) => branch);
                this.currentBranchId =
                    remainingBranches.find(b => b.isDefault)?.id
                    ?? remainingBranches[0]?.id
                    ?? null;
            }
        }
    }

    async clear(): Promise<void> {
        this.reactionDisposer?.();
        this.reactionDisposer = null;
        for (const branchData of this.branchMap.values()) {
            branchData.sandbox.clear();
            branchData.history.clear();
            branchData.error.clear();
            await branchData.codeEditor.cleanup();
        }
        this.branchMap.clear();
        this.currentBranchId = null;
    }

    // Helper methods for error management
    getAllErrors(): ParsedError[] {
        const allErrors: ParsedError[] = [];
        for (const branchData of this.branchMap.values()) {
            const branchErrors = branchData.error.errors.map(error => ({
                ...error,
                branchId: branchData.branch.id,
                branchName: branchData.branch.name,
            }));
            allErrors.push(...branchErrors);
        }
        return allErrors;
    }

    getTotalErrorCount(): number {
        return Array.from(this.branchMap.values()).reduce(
            (total, branchData) => total + branchData.error.errors.length,
            0
        );
    }

    getErrorsForBranch(branchId: string): ParsedError[] {
        const branchData = this.getBranchDataById(branchId);
        return branchData?.error.errors || [];
    }
}
