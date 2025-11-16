import { Main } from '@/app/project/[id]/_components/main';
import { ProjectProviders } from '@/app/project/[id]/providers';
import type { Branch, Project } from '@onlook/models';

const LOCAL_PROJECT_ID = 'local-project';
const LOCAL_BRANCH_ID = 'local-branch';

export default function LocalProjectPage() {
    const now = new Date();

    const project: Project = {
        id: LOCAL_PROJECT_ID,
        name: 'Local Project',
        metadata: {
            createdAt: now,
            updatedAt: now,
            description: 'Local editing project',
            tags: [],
            previewImg: null,
        },
    };

    const branch: Branch = {
        id: LOCAL_BRANCH_ID,
        projectId: LOCAL_PROJECT_ID,
        name: 'main',
        description: null,
        createdAt: now,
        updatedAt: now,
        isDefault: true,
        git: null,
        sandbox: {
            id: 'local',
        },
    };

    return (
        <ProjectProviders project={project} branches={[branch]}>
            <Main />
        </ProjectProviders>
    );
}

