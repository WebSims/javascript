import React from 'react'
import { Handle, Position, useStore } from '@xyflow/react'

interface ObjectPropertyNode {
    data: {
        key: string
        value: string
    }
    id: string
}

const ObjectPropertyNode: React.FC<ObjectPropertyNode> = ({ data, id }) => {
    const edges = useStore((state) => state.edges)
    const hasConnections = edges.some(edge => edge.source === id || edge.target === id)

    return (
        <div className='w-full h-full p-1 flex flex-col gap-1 font-mono text-xs'>
            <div className='flex items-center gap-1'>
                {data.key}: {data.value}
            </div>
            {hasConnections && (
                <>
                    <Handle
                        type="target"
                        position={Position.Right}
                        className="w-16 !bg-teal-500"
                    />
                    <Handle
                        type="source"
                        position={Position.Left}
                        className="w-16 !bg-teal-500"
                    />
                </>
            )}
        </div>
    )
}

export default ObjectPropertyNode