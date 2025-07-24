export const examplesCategories = [
    'basics',
    'functions',
    'classes',
    'advanced'
] as const

export interface ExampleConfig {
    id: string
    title: string
    description: string
    category: (typeof examplesCategories)[number]
    active: boolean
}

export const examplesConfig: ExampleConfig[] = [
    {
        id: 'binary',
        title: 'Binary Operations',
        description: 'Logical operators and arithmetic expressions',
        category: 'basics',
        active: true
    },
    {
        id: 'fibonacci',
        title: 'Fibonacci Function',
        description: 'Recursive function implementation',
        category: 'functions',
        active: true
    },
    {
        id: 'class',
        title: 'Class Definition',
        description: 'ES6 classes with methods, getters, and inheritance',
        category: 'classes',
        active: false
    },
    {
        id: 'for-loop',
        title: 'For Loop',
        description: 'Loop control and variable scoping',
        category: 'basics',
        active: true
    },
    {
        id: 'function-call',
        title: 'Function Execution',
        description: 'Nested function calls with try-catch blocks',
        category: 'functions',
        active: true
    },
    {
        id: 'property',
        title: 'Property Access',
        description: 'Dynamic property access and assignment',
        category: 'advanced',
        active: true
    },
    {
        id: 'try',
        title: 'Try-Catch Blocks',
        description: 'Error handling with try-catch and default parameters',
        category: 'advanced',
        active: true
    }
]

export const getExampleById = (id: string): ExampleConfig | undefined => {
    return examplesConfig.find(example => example.id === id)
}

export const getExamplesByCategory = (category: ExampleConfig['category']) => {
    return examplesConfig.filter(example => example.category === category)
} 