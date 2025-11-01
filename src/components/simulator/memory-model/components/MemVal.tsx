import { ArcherElement } from "react-archer"
import type { ArcherContainerProps } from "react-archer"

interface MemValItem {
    id: string
    value: string
    type: string
    targetRef?: string
    x?: number
    y?: number
    animation?: 'slide-in' | 'fade-out' | 'none' | 'fade-in'
}

interface MemValProps {
    memval: MemValItem[]
}

const getAnimationClass = (animation?: 'slide-in' | 'fade-out' | 'none' | 'fade-in') => {
    switch (animation) {
        case 'slide-in':
            return 'animate-slide-in'
        case 'fade-out':
            return 'animate-fade-out'
        case 'fade-in':
            return 'animate-fade-in'
        default:
            return ''
    }
}

const MemVal = ({ memval }: MemValProps) => {
    if (!memval) return null

    const getRelations = (item: MemValItem): ArcherContainerProps['relations'] => {
        if (!item.targetRef) return undefined

        const relations = [{
            targetId: item.targetRef,
            targetAnchor: 'left' as const,
            sourceAnchor: 'right' as const,
            style: {
                strokeColor: '#9333ea',
                strokeWidth: 2
            }
        }]

        console.log(`MemVal ${item.id} → ${item.targetRef}`, relations)
        return relations
    }

    return (
        <div className="w-1/4 flex flex-col">
            <div className="flex flex-col overflow-hidden border border-gray-300 rounded p-2 flex-grow bg-gray-50">
                <div className="flex-1"></div>
                <div className="flex flex-col-reverse justify-end space-y-reverse space-y-2 min-h-0">
                    {memval.map((mem, index) => {
                        const relations = getRelations(mem)

                        return (
                            <ArcherElement
                                key={`${mem.id}-${index}`}
                                id={mem.id}
                                relations={relations}
                            >
                                <div
                                    className={`bg-white p-3 border-2 border-gray-300 rounded flex-shrink-0 transition-all hover:shadow-md ${getAnimationClass(mem.animation)}`}
                                >
                                    <div className="text-xs text-gray-500 mb-1">{mem.id}</div>
                                    <div className={`font-medium ${mem.type === 'reference' ? 'text-purple-600' : 'text-gray-800'}`}>
                                        {mem.value}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">({mem.type})</div>
                                </div>
                            </ArcherElement>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default MemVal
