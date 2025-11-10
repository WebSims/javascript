import { ArcherElement } from "react-archer"
import type { ArcherContainerProps } from "react-archer"

interface HeapProperty {
    name: string
    value: string
    targetRef?: string
}

interface HeapObjectData {
    id: string
    type: string
    properties?: HeapProperty[]
    referencedBy?: string[]
    x?: number
    y?: number
}

interface HeapItemProps {
    heapObj: HeapObjectData
}

const getTypeColors = (type: string) => {
    switch (type) {
        case 'Array':
            return {
                bg: 'bg-emerald-50',
                border: 'border-emerald-400',
                text: 'text-emerald-900',
                badge: 'bg-emerald-100 text-emerald-700'
            }
        case 'Function':
            return {
                bg: 'bg-sky-50',
                border: 'border-sky-400',
                text: 'text-sky-900',
                badge: 'bg-sky-100 text-sky-700'
            }
        default:
            return {
                bg: 'bg-amber-50',
                border: 'border-amber-400',
                text: 'text-amber-900',
                badge: 'bg-amber-100 text-amber-700'
            }
    }
}

const HeapItem = ({ heapObj }: HeapItemProps) => {
    const colors = getTypeColors(heapObj.type)

    // Get scope variables that reference this heap object (from data)
    const scopeVarTargets = heapObj.referencedBy || []
    const heapRelations: ArcherContainerProps['relations'] = scopeVarTargets.length > 0
        ? scopeVarTargets.map(varId => ({
            targetId: varId,
            targetAnchor: 'left' as const,
            sourceAnchor: 'right' as const,
            style: {
                strokeColor: '#7c3aed',
                strokeWidth: 2
            }
        }))
        : undefined

    if (heapRelations) {
        console.log(`Heap object ${heapObj.id} → scope variables`, scopeVarTargets)
    }

    return (
        <ArcherElement
            key={heapObj.id}
            id={heapObj.id}
            relations={heapRelations}
        >
            <div
                className={`p-0.5 md:p-2 border-2 rounded-lg flex-shrink-0 transition-all duration-200 hover:shadow-lg w-full ${colors.bg} ${colors.border}`}
            >
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className={`font-bold text-xs md:text-base ${colors.text} break-all`}>
                        {heapObj.id}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0 ${colors.badge}`}>
                        {heapObj.type}
                    </span>
                </div>
                {heapObj.properties && heapObj.properties.length > 0 ? (
                    <div className="space-y-2">
                        {heapObj.properties.map(prop => {
                            const propId = `${heapObj.id}-prop-${prop.name}`
                            const propRelations: ArcherContainerProps['relations'] = prop.targetRef
                                ? [{
                                    targetId: prop.targetRef,
                                    targetAnchor: 'left' as const,
                                    sourceAnchor: 'right' as const,
                                    style: {
                                        strokeColor: '#ea580c',
                                        strokeWidth: 2
                                    }
                                }]
                                : undefined

                            if (propRelations) {
                                console.log(`Heap property ${propId} → ${prop.targetRef}`, propRelations)
                            }

                            return (
                                <ArcherElement
                                    key={prop.name}
                                    id={propId}
                                    relations={propRelations}
                                >
                                    <div className="text-xs md:text-sm bg-white/60 px-2.5 py-1.5 rounded-md hover:bg-white/80 transition-colors break-words">
                                        <span className="font-semibold text-gray-700">{prop.name}:</span>{" "}
                                        <span className={`${prop.targetRef ? 'text-orange-600 font-semibold' : 'text-blue-600 font-medium'}`}>
                                            {prop.value}
                                        </span>
                                    </div>
                                </ArcherElement>
                            )
                        })}
                    </div>
                ) : (
                    <p className="text-xs text-gray-400 italic px-2">No properties</p>
                )}
            </div>
        </ArcherElement>
    )
}

export default HeapItem

