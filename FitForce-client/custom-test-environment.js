const { TestEnvironment } = require('jest-environment-node');

class CustomTestEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
  }

  async setup() {
    await super.setup();
    
    // Mock DOM APIs without canvas
    this.global.window = {
      matchMedia: jest.fn(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
      performance: {
        now: jest.fn(() => Date.now()),
        mark: jest.fn(),
        measure: jest.fn(),
        getEntriesByType: jest.fn(() => []),
        getEntriesByName: jest.fn(() => []),
        memory: {
          usedJSHeapSize: 1000000,
          totalJSHeapSize: 2000000,
          jsHeapSizeLimit: 3000000,
        },
      },
      localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      sessionStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      location: {
        href: 'http://localhost:3000',
        origin: 'http://localhost:3000',
        pathname: '/',
        search: '',
        hash: '',
      },
      navigator: {
        userAgent: 'jest-test-agent',
      },
      document: {
        createElement: jest.fn(() => ({
          setAttribute: jest.fn(),
          getAttribute: jest.fn(),
          appendChild: jest.fn(),
          removeChild: jest.fn(),
          querySelector: jest.fn(),
          querySelectorAll: jest.fn(() => []),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          focus: jest.fn(),
          scrollIntoView: jest.fn(),
        })),
        body: {
          appendChild: jest.fn(),
          removeChild: jest.fn(),
        },
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    this.global.document = this.global.window.document;
    this.global.navigator = this.global.window.navigator;
    this.global.localStorage = this.global.window.localStorage;
    this.global.sessionStorage = this.global.window.sessionStorage;
    this.global.fetch = jest.fn();
  }

  async teardown() {
    await super.teardown();
  }
}

module.exports = CustomTestEnvironment;
