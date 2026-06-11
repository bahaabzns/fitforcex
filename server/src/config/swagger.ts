import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title:       'FitForce X API',
            version:     '1.0.0',
            description: 'Coach-client fitness management SaaS platform',
        },
        servers: [
            { url: 'http://localhost:4000/api', description: 'Development' },
            { url: 'https://api.fitforce.io/api', description: 'Production' },
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in:   'cookie',
                    name: 'token',
                },
            },
            schemas: {
                Client: {
                    type: 'object',
                    properties: {
                        id:          { type: 'string' },
                        fname:       { type: 'string' },
                        lname:       { type: 'string' },
                        email:       { type: 'string', format: 'email' },
                        phone:       { type: 'string', nullable: true },
                        workspaceId: { type: 'string' },
                        createdAt:   { type: 'string', format: 'date-time' },
                    },
                },
                Thread: {
                    type: 'object',
                    properties: {
                        id:          { type: 'string' },
                        workspaceId: { type: 'string' },
                        clientId:    { type: 'string' },
                        status:      { type: 'string', enum: ['open', 'closed'] },
                        updatedAt:   { type: 'string', format: 'date-time' },
                    },
                },
                Message: {
                    type: 'object',
                    properties: {
                        id:          { type: 'string' },
                        threadId:    { type: 'string' },
                        senderType:  { type: 'string', enum: ['team', 'client'] },
                        senderId:    { type: 'string' },
                        body:        { type: 'string' },
                        createdAt:   { type: 'string', format: 'date-time' },
                    },
                },
                NutritionPlan: {
                    type: 'object',
                    properties: {
                        id:         { type: 'string' },
                        clientId:   { type: 'string', nullable: true },
                        name:       { type: 'string' },
                        status:     { type: 'string', enum: ['draft', 'active'] },
                        createdAt:  { type: 'string', format: 'date-time' },
                    },
                },
                WorkoutPlan: {
                    type: 'object',
                    properties: {
                        id:         { type: 'string' },
                        clientId:   { type: 'string', nullable: true },
                        name:       { type: 'string' },
                        status:     { type: 'string', enum: ['draft', 'active'] },
                        createdAt:  { type: 'string', format: 'date-time' },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
            },
        },
        security: [{ cookieAuth: [] }],
    },
    apis: ['./src/modules/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
