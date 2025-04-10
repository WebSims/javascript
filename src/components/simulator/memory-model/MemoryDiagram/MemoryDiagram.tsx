import React from 'react'
import { ReactFlow, useNodesState, useEdgesState, Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import _ from 'lodash'
import VariableNode from './VariableNode'
import ObjectNode from './ObjectNode'
import ObjectPropertyNode from './ObjectPropertyNode'

const nodeType = {
    variable: VariableNode,
    object: ObjectNode,
    objectProperty: ObjectPropertyNode
}

const initialNodes: Node[] = [
    { id: '1', position: { x: 0, y: 0 }, data: { key: 'name', value: 'jone' }, type: 'variable' },
    // { id: '2', position: { x: 0, y: 100 }, data: { label: '2' } },
    // { id: '3', position: { x: 0, y: 0 }, data: { label: '3' }, parentId: '2', draggable: false },
]

const initialEdges = [{ id: 'e1-2', source: '2-name', target: '1' }]

const MemoryDiagram = () => {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
    const [edges, onEdgesChange] = useEdgesState(initialEdges)

    const assign = ({ type, key, value }: { type: string, key: string, value: unknown }) => {
        const id = nodes.length + 1

        if (type === 'variable') {
            // Find the last variable node by filtering and getting the last element
            const lastVariable = _.findLast(nodes, (node: Node) => node.type === 'variable')
            const yPos = lastVariable ? lastVariable.position.y + 50 : 0

            // Add the new node with the type property
            setNodes([...nodes, {
                id: id.toString(),
                position: { x: 0, y: yPos },
                data: { key, value: String(value) },
                type: 'variable'
            }])
        }
        else if (type === 'object' && typeof value === 'object' && value !== null) {
            const lastObject = _.findLast(nodes, (node: Node) => node.type === 'object')
            const objKeyCount = _.size(value)
            const yPos = lastObject ? (lastObject.position.y + (lastObject.height || 0) + 50) : 0

            // Create the main object node
            const objectNode: Node = {
                id: id.toString(),
                position: { x: 150, y: yPos },
                height: objKeyCount * 50,
                width: 100,
                data: { items: value },
                type: 'object'
            }

            // Create property nodes
            const propertyNodes = Object.entries(value).map(([propKey, propValue], index) => ({
                id: `${id}-${propKey}`,
                parentId: id.toString(),
                position: { x: 10, y: 20 + index * 20 },
                data: { key: propKey, value: String(propValue) },
                type: 'objectProperty',
                draggable: false,
                deletable: false,
                selected: false
            }))

            // Create edges from object properties to property nodes
            // const propertyEdges = propertyNodes.map((node) => ({
            //     id: `e-${id}-${node.id}`,
            //     source: id.toString(),
            //     sourceHandle: `${id}-${node.data.key}-source`,
            //     target: node.id,
            //     type: 'smoothstep'
            // }))

            setNodes([...nodes, objectNode, ...propertyNodes])
            // setEdges([...edges, ...propertyEdges])
        }
        else if (type === 'array') {
            setNodes([...nodes, {
                id: id.toString(),
                position: { x: 0, y: 200 },
                data: { label: '3' },
                type: 'array'
            }])
        }
    }

    return (
        <div className='w-full h-full'>
            <button
                onClick={() => assign({ type: 'object', key: 'obj', value: { name: 'jone', age: 20 } })}
                className="px-4 py-2 mb-4 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
                Assign Variable
            </button>
            <ReactFlow
                fitView
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodesConnectable={false}
                contentEditable={false}
                onBeforeDelete={() => Promise.resolve(false)}
                nodeTypes={nodeType}
            />
        </div>
    )
}

export default MemoryDiagram