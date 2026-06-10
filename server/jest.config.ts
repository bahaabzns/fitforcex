import type { Config } from 'jest';

const config: Config = {
    testEnvironment: 'node',
    rootDir:         '.',
    testMatch:       ['**/tests/**/*.test.ts'],
    setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: '<rootDir>/tsconfig.test.json',
        }],
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/config/**',
        '!src/**/*.d.ts',
    ],
    coverageThreshold: {
        global: { lines: 70, functions: 70, branches: 60 },
    },
};

export default config;
