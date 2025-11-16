'use client';

import { useEditorEngine } from '@/components/store/editor';
import { BranchTabValue, type Branch } from '@onlook/models';
import { Button } from '@onlook/ui/button';
import { Icons } from '@onlook/ui/icons';

export function BranchManagement({ branch }: { branch: Branch }) {
    const editorEngine = useEditorEngine();

    const handleBack = () => {
        editorEngine.state.branchTab = null;
        editorEngine.state.manageBranchId = null;
    };

    return (
        <div className="flex flex-col h-full p-4 gap-3">
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleBack}
                    title="Back to branches"
                >
                    <Icons.ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex flex-col">
                    <span className="text-sm font-medium">Branch: {branch.name}</span>
                    <span className="text-xs text-muted-foreground">
                        Branch management is disabled in local-only mode.
                    </span>
                </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-muted-foreground text-center px-4">
                    In this local fork, creating, forking, or updating branches via backend APIs
                    has been removed. You can still switch between existing branches in the
                    “Branches” list.
                </p>
            </div>
        </div>
    );
}

