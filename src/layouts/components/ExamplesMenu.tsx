import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { CodeIcon } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
} from '@/components/ui/select'
import { EXAMPLES_CONFIG } from '@/examples/examples.config'
import { type ExampleConfig, examplesCategories } from '@/types/examples'
import { getExampleById } from '@/helpers/examples'

const ExamplesMenu: React.FC = () => {
    const navigate = useNavigate()
    const { exampleId } = useParams()
    const [isOpen, setIsOpen] = useState(false)

    const handleExampleSelect = (exampleId: string) => {
        const example = getExampleById(exampleId)
        if (example && example.active) {
            navigate(`/examples/${exampleId}`)
            setIsOpen(false)
        }
    }

    const currentExample = exampleId ? getExampleById(exampleId) : null
    const displayText = currentExample ? currentExample.title : 'Examples'

    const groupedExamples = EXAMPLES_CONFIG.reduce((acc, example) => {
        if (!acc[example.category]) {
            acc[example.category] = []
        }
        acc[example.category].push(example)
        return acc
    }, {} as Record<string, ExampleConfig[]>)

    const categoryLabels = examplesCategories.reduce((acc, category) => {
        acc[category] = category.charAt(0).toUpperCase() + category.slice(1)
        return acc
    }, {} as Record<(typeof examplesCategories)[number], string>)

    return (
        <Select onValueChange={handleExampleSelect} open={isOpen} onOpenChange={setIsOpen} value={exampleId || ''}>
            <SelectTrigger className="w-48 flex items-center gap-1 text-sm !text-primary focus:ring-0 focus:ring-offset-0 border-0 shadow-none bg-transparent hover:bg-gray-100">
                <CodeIcon className="w-4 h-4" />
                <span className="text-sm">{displayText}</span>
            </SelectTrigger>
            <SelectContent>
                {Object.entries(groupedExamples).map(([category, examples]) => (
                    <SelectGroup key={category}>
                        <SelectLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {categoryLabels[category as keyof typeof categoryLabels]}
                        </SelectLabel>
                        {examples.map((example) => (
                            <SelectItem
                                key={example.id}
                                value={example.id}
                                disabled={!example.active}
                                className={!example.active ? 'opacity-50 cursor-not-allowed' : ''}
                                onMouseDown={(event: React.MouseEvent<HTMLDivElement>) => {
                                    if (event.button === 1 && example.active) {
                                        event.preventDefault()
                                        window.open(`/examples/${example.id}`, '_blank', 'noopener')
                                    }
                                }}
                            >
                                <div className="flex flex-col items-start">
                                    <div className={`font-medium text-sm ${!example.active ? 'text-gray-400' : 'text-gray-900'}`}>
                                        {example.title}
                                        {!example.active && <span className="ml-2 text-xs text-gray-400">(Coming Soon)</span>}
                                    </div>
                                    <div className={`text-xs ${!example.active ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {example.description}
                                    </div>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectGroup>
                ))}
            </SelectContent>
        </Select>
    )
}

export default ExamplesMenu
