import React from 'react'
import { VariableIcon } from 'lucide-react'
import { Handle, Position, useStore } from '@xyflow/react'

interface VariableNodeProps {
    data: {
        key: string,
        value: string
    }
    id: string
}

const VariableNode: React.FC<VariableNodeProps> = ({ data, id }) => {
    const edges = useStore((state) => state.edges)
    const hasConnections = edges.some(edge => edge.source === id || edge.target === id)

    return (
        <div className='w-full h-full rounded-md border border-gray-300 p-1 flex items-center gap-1 font-mono text-xs'>
            <VariableIcon className="h-4 w-4 text-gray-600" />
            {data.key}: {data.value}
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

export default VariableNode