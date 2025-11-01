import { ArcherElement } from "react-archer"
import type { ComponentProps } from "react"

interface MemValItemData {
    id: string
    value: string
    type: string
    targetRef?: string
    x?: number
    y?: number
    animation?: 'slide-in' | 'fade-out' | 'none' | 'fade-in'
    showConnection?: boolean
}

interface MemValItemProps {
    memval: MemValItemData
    index: number
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

const getRelations = (item: MemValItemData): ComponentProps<typeof ArcherElement>['relations'] => {
    if (!item.targetRef) return undefined
    if (item.showConnection === false) return undefined

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

const MemValItem = ({ memval, index }: MemValItemProps) => {
    const relations = getRelations(memval)
    const isReference = memval.type === 'reference'

    return (
        <ArcherElement
            key={`${memval.id}-${index}`}
            id={memval.id}
            relations={relations}
        >
            <div
                className={`bg-white p-4 border-2 rounded-lg flex-shrink-0 transition-all duration-200 hover:shadow-lg w-full ${
                    isReference ? 'border-purple-300 bg-purple-50/30' : 'border-gray-300'
                } ${getAnimationClass(memval.animation)}`}
            >
                <div className="text-xs font-medium text-gray-500 mb-2 break-words">{memval.id}</div>
                <div className={`font-bold text-base mb-2 break-words ${isReference ? 'text-purple-600' : 'text-gray-800'}`}>
                    {memval.value}
                </div>
                <div className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block break-all ${
                    isReference 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-gray-100 text-gray-600'
                }`}>
                    {memval.type}
                </div>
            </div>
        </ArcherElement>
    )
}

export default MemValItem

