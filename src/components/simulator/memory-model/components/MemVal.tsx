interface MemValItem {
    id: string
    value: string
    type: string
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

    return (
        <div className="w-1/4 flex flex-col">
            <h2 className="text-lg font-bold mb-2 shrink-0">Memory Values</h2>
            <div className="flex flex-col overflow-hidden border border-gray-300 rounded p-2 flex-grow bg-gray-50">
                <div className="flex-1"></div>
                <div className="flex flex-col-reverse justify-end space-y-reverse space-y-2 min-h-0">
                    {memval.map((mem, index) => (
                        <div
                            key={`${mem.id}-${index}`}
                            className={`bg-white p-3 border-2 border-gray-300 rounded flex-shrink-0 transition-all hover:shadow-md ${getAnimationClass(mem.animation)}`}
                        >
                            <div className="text-xs text-gray-500 mb-1">{mem.id}</div>
                            <div className={`font-medium ${mem.type === 'reference' ? 'text-purple-600' : 'text-gray-800'}`}>
                                {mem.value}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">({mem.type})</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default MemVal
