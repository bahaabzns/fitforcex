declare global {
    namespace Express {
        interface Request {
            user?: {
                userId:      string;
                workspaceId: string;
                role:        string;
                permissions: Record<string, Record<string, boolean>> | null;
                isOwner:     boolean;
            };
            client?: {
                clientId:    string;
                workspaceId: string;
            };
            clientAccess?: {
                status:      string;
                withinGrace: boolean;
                access:      Record<string, boolean>;
            };
            admin?: {
                isAdmin: boolean;
                [key: string]: unknown;
            };
        }
    }
}

export {};
