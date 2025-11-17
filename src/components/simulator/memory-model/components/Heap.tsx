import HeapItem from "./HeapItem"

interface HeapProperty {
    name: string
    value: string
    targetRef?: string
}

interface HeapObject {
    id: string
    type: string
    properties?: HeapProperty[]
    referencedBy?: string[]
    x?: number
    y?: number
}

interface HeapProps {
    heap: HeapObject[]
}

const Heap = ({ heap }: HeapProps) => {
    if (!heap) return null

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex flex-col border border-gray-300 rounded p-1.5 md:p-2 flex-grow bg-gray-50">
                <div className="flex-1"></div>
                <div className="flex flex-col-reverse justify-end space-y-reverse space-y-2 min-h-0 w-full">
                    {heap.map(heapObj => (
                        <HeapItem key={heapObj.id} heapObj={heapObj} />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Heap
