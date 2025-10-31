interface HeapProperty {
    name: string
    value: string
    targetRef?: string
}

interface HeapObject {
    id: string
    type: string
    properties?: HeapProperty[]
    x?: number
    y?: number
}

interface HeapProps {
    heap: HeapObject[]
}

const Heap = ({ heap }: HeapProps) => {
    if (!heap) return null

    const getTypeColors = (type: string) => {
        switch (type) {
            case 'Array':
                return {
                    bg: '#c6f6d5',
                    border: '#68d391',
                    text: '#22543d'
                }
            case 'Function':
                return {
                    bg: '#bee3f8',
                    border: '#63b3ed',
                    text: '#1a365d'
                }
            default:
                return {
                    bg: '#fefcbf',
                    border: '#ecc94b',
                    text: '#744210'
                }
        }
    }

    return (
        <div className="w-1/2 flex flex-col">
            <h2 className="text-lg font-bold mb-2 shrink-0">Heap</h2>
            <div className="flex flex-col overflow-hidden border border-gray-300 rounded p-2 flex-grow bg-gray-50">
                <div className="flex-1"></div>
                <div className="flex flex-col-reverse justify-end space-y-reverse space-y-2 min-h-0">
                    {heap.map(heapObj => {
                        const colors = getTypeColors(heapObj.type)
                        return (
                            <div
                                key={heapObj.id}
                                className="p-3 border-2 rounded flex-shrink-0 transition-all"
                                style={{
                                    backgroundColor: colors.bg,
                                    borderColor: colors.border
                                }}
                            >
                                <div className="font-semibold mb-2" style={{ color: colors.text }}>
                                    {heapObj.id} <span className="text-xs font-normal">({heapObj.type})</span>
                                </div>
                                {heapObj.properties && heapObj.properties.length > 0 ? (
                                    <ul className="space-y-1">
                                        {heapObj.properties.map(prop => (
                                            <li key={prop.name} className="text-sm">
                                                <span className="font-medium">{prop.name}:</span>{" "}
                                                <span className={`${prop.targetRef ? 'text-orange-600 font-medium' : 'text-blue-600'}`}>
                                                    {prop.value}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-gray-500 italic">No properties</p>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default Heap
