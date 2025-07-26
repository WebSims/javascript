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