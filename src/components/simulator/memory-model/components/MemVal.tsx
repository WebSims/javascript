import MemValItem from "./MemValItem"

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

interface MemValProps {
    memval: MemValItemData[]
}

const MemVal = ({ memval }: MemValProps) => {
    if (!memval) return null

    return (
        <div className="w-3/12 flex flex-col">
            <div className="flex flex-col overflow-hidden border border-gray-300 rounded p-2 flex-grow bg-gray-50">
                <div className="flex-1"></div>
                <div className="flex flex-col-reverse justify-end space-y-reverse space-y-2 min-h-0 w-full">
                    {memval.map((mem, index) => (
                        <MemValItem key={`${mem.id}-${index}`} memval={mem} index={index} />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default MemVal
