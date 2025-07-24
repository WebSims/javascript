import React from 'react'
import { useNavigate, useParams } from 'react-router'
import { XIcon, BookOpenIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { examplesConfig, type ExampleConfig, getExampleById, examplesCategories } from '@/examples/examples.config'

interface MobileMenuProps {
    isOpen: boolean
    onClose: () => void
    mode: 'CODE' | 'EXECUTION'
}

const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, mode }) => {
    const navigate = useNavigate()
    const { exampleId } = useParams()

    const handleExampleSelect = (exampleId: string) => {
        const example = getExampleById(exampleId)
        if (example && example.active) {
            navigate(`/examples/${exampleId}`)
            onClose()
        }
    }

    const handleHomeClick = () => {
        navigate('/')
        onClose()
    }

    const handleHomeKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleHomeClick()
        }
    }

    const currentExample = exampleId ? getExampleById(exampleId) : null

    const groupedExamples = examplesConfig.reduce((acc, example) => {
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
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Menu Drawer */}
            <div className={`
                fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-background border-r border-border z-50 
                transform transition-transform duration-300 ease-in-out lg:hidden
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border">
                        <div
                            className="font-bold text-lg cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={handleHomeClick}
                            onKeyDown={handleHomeKeyDown}
                            tabIndex={0}
                            aria-label="Go to home page"
                            role="button"
                        >
                            WebSims.org/js
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            aria-label="Close menu"
                        >
                            <XIcon className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {/* Examples */}
                        {mode === 'CODE' && (
                            <div className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <BookOpenIcon className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-medium text-sm">Examples</span>
                                </div>

                                {Object.entries(groupedExamples).map(([category, examples]) => (
                                    <div key={category} className="mb-4">
                                        <h3 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                                            {categoryLabels[category as keyof typeof categoryLabels]}
                                        </h3>
                                        <div className="space-y-1">
                                            {examples.map((example) => (
                                                <button
                                                    key={example.id}
                                                    onClick={() => handleExampleSelect(example.id)}
                                                    disabled={!example.active}
                                                    className={`
                                                    w-full text-left px-3 py-2 rounded-md text-sm transition-colors
                                                    ${example.id === currentExample?.id
                                                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                                            : 'hover:bg-accent hover:text-accent-foreground'
                                                        }
                                                    ${!example.active ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                                `}
                                                    aria-label={`Load ${example.title} example`}
                                                >
                                                    <div className="font-medium">{example.title}</div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {example.description}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

export default MobileMenu 