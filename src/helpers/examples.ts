import { ExampleConfig } from '../types/examples'
import { EXAMPLES_CONFIG } from '../examples/examples.config'

export const getExampleById = (id: string): ExampleConfig | undefined => {
    return EXAMPLES_CONFIG.find(example => example.id === id)
}

export const getExamplesByCategory = (category: ExampleConfig['category']) => {
    return EXAMPLES_CONFIG.filter(example => example.category === category)
} 