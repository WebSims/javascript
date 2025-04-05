import React, { useEffect, useState, ReactNode } from 'react'
import * as hermesParser from 'hermes-parser'
import MemoryModelDiagram from './MemoryDiagram'

interface MemoryModelProps {
    code: string
}

type MemoryValue = {
    type: 'number' | 'string' | 'boolean' | 'object' | 'array' | 'function' | 'undefined' | 'null'
    value: unknown
    reference?: string
}

type MemoryState = {
    variables: Record<string, MemoryValue>
    objects: Record<string, Record<string, MemoryValue>>
    arrays: Record<string, MemoryValue[]>
    functions: Record<string, { params: string[], body: string }>
}

const MemoryModel: React.FC<MemoryModelProps> = ({ code }) => {
    const [memoryState, setMemoryState] = useState<MemoryState>({
        variables: {},
        objects: {},
        arrays: {},
        functions: {}
    })
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'textual' | 'd3'>('textual')

    useEffect(() => {
        try {
            // Parse the code
            const ast = hermesParser.parse(code, { tokens: true })
            const memorySnapshot = analyzeCodeMemory(code, ast)
            setMemoryState(memorySnapshot)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        }
    }, [code])

    const analyzeCodeMemory = (code: string, ast: hermesParser.ESNode): MemoryState => {
        const memory: MemoryState = {
            variables: {},
            objects: {},
            arrays: {},
            functions: {}
        }

        // Function to process variable declarations
        const processDeclarations = (node: hermesParser.ESNode) => {
            if (node.type === 'VariableDeclaration') {
                const varDecl = node as hermesParser.VariableDeclaration
                varDecl.declarations.forEach((decl: hermesParser.ESNode) => {
                    const varDeclarator = decl as hermesParser.VariableDeclarator
                    const id = varDeclarator.id as hermesParser.Identifier
                    const varName = id.name

                    if (varDeclarator.init) {
                        const init = varDeclarator.init
                        // Process initialization based on type
                        if (init.type === 'Literal') {
                            const literal = init as hermesParser.Literal
                            const literalType = typeof literal.value
                            memory.variables[varName] = {
                                type: literalType as 'number' | 'string' | 'boolean' | 'object' | 'null',
                                value: literal.value
                            }
                            if (literal.value === null) {
                                memory.variables[varName].type = 'null'
                            }
                        }
                        else if (init.type === 'ArrayExpression') {
                            const arrayExpr = init as hermesParser.ArrayExpression
                            const arrayId = `array_${Object.keys(memory.arrays).length}`
                            memory.arrays[arrayId] = []

                            arrayExpr.elements.forEach((element: hermesParser.ESNode | null, index: number) => {
                                if (element && element.type === 'Literal') {
                                    const litElement = element as hermesParser.Literal
                                    memory.arrays[arrayId][index] = {
                                        type: typeof litElement.value as 'number' | 'string' | 'boolean' | 'object' | 'null',
                                        value: litElement.value
                                    }
                                    if (litElement.value === null) {
                                        memory.arrays[arrayId][index].type = 'null'
                                    }
                                }
                            })

                            memory.variables[varName] = {
                                type: 'array',
                                value: '[]',
                                reference: arrayId
                            }
                        }
                        else if (init.type === 'ObjectExpression') {
                            const objExpr = init as hermesParser.ObjectExpression
                            const objectId = `object_${Object.keys(memory.objects).length}`
                            memory.objects[objectId] = {}

                            objExpr.properties.forEach((prop: hermesParser.ESNode) => {
                                const property = prop as hermesParser.Property
                                const keyNode = property.key
                                let propName = ''

                                if (keyNode.type === 'Identifier') {
                                    propName = (keyNode as hermesParser.Identifier).name
                                } else if (keyNode.type === 'Literal') {
                                    propName = String((keyNode as hermesParser.Literal).value)
                                }

                                if (property.value.type === 'Literal') {
                                    const litValue = property.value as hermesParser.Literal
                                    memory.objects[objectId][propName] = {
                                        type: typeof litValue.value as 'number' | 'string' | 'boolean' | 'object' | 'null',
                                        value: litValue.value
                                    }
                                    if (litValue.value === null) {
                                        memory.objects[objectId][propName].type = 'null'
                                    }
                                } else if (property.value.type === 'MemberExpression') {
                                    // Simplified handling of object['prop'] expressions
                                    memory.objects[objectId][propName] = {
                                        type: 'string',
                                        value: '[Reference to another property]'
                                    }
                                }
                            })

                            memory.variables[varName] = {
                                type: 'object',
                                value: '{}',
                                reference: objectId
                            }
                        }
                        else if (init.type === 'ArrowFunctionExpression') {
                            const arrowFn = init as hermesParser.ArrowFunctionExpression
                            const fnId = `function_${Object.keys(memory.functions).length}`
                            const params = arrowFn.params.map((param: hermesParser.ESNode) => {
                                const paramId = param as hermesParser.Identifier
                                return paramId.name
                            })

                            memory.functions[fnId] = {
                                params,
                                body: code.substring(arrowFn.range[0], arrowFn.range[1])
                            }

                            memory.variables[varName] = {
                                type: 'function',
                                value: `(${params.join(', ')}) => {...}`,
                                reference: fnId
                            }
                        }
                        else if (init.type === 'Identifier' && (init as hermesParser.Identifier).name === 'undefined') {
                            memory.variables[varName] = {
                                type: 'undefined',
                                value: undefined
                            }
                        }
                    }
                })
            }
        }

        // Traverse the AST
        const traverseNode = (node: hermesParser.ESNode) => {
            if (!node || typeof node !== 'object') return

            processDeclarations(node)

            // Recursively process all properties of the node
            Object.keys(node).forEach(key => {
                const child = (node as Record<string, unknown>)[key]
                if (Array.isArray(child)) {
                    child.forEach(item => {
                        if (item && typeof item === 'object') {
                            traverseNode(item as hermesParser.ESNode)
                        }
                    })
                } else if (child && typeof child === 'object') {
                    traverseNode(child as hermesParser.ESNode)
                }
            })
        }

        // Start traversal from the program body
        const program = ast as hermesParser.Program
        program.body.forEach((node: hermesParser.ESNode) => traverseNode(node))

        return memory
    }

    const renderValueWithType = (value: MemoryValue): ReactNode => {
        switch (value.type) {
            case 'string':
                return <span className="text-green-600">"{String(value.value)}"</span>
            case 'number':
                return <span className="text-blue-500">{String(value.value)}</span>
            case 'boolean':
                return <span className="text-purple-500">{String(value.value)}</span>
            case 'null':
                return <span className="text-gray-500">null</span>
            case 'undefined':
                return <span className="text-gray-500">undefined</span>
            case 'array':
                return <span className="text-blue-500 font-semibold">{String(value.value)} <span className="text-xs text-gray-500">[ref: {value.reference}]</span></span>
            case 'object':
                return <span className="text-blue-500 font-semibold">{String(value.value)} <span className="text-xs text-gray-500">[ref: {value.reference}]</span></span>
            case 'function':
                return <span className="text-yellow-500 font-semibold">{String(value.value)} <span className="text-xs text-gray-500">[ref: {value.reference}]</span></span>
            default:
                return <span>{String(value.value)}</span>
        }
    }

    const renderVariables = () => (
        <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Variables</h3>
            {Object.keys(memoryState.variables).length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(memoryState.variables).map(([name, value]) => (
                        <div key={name} className="p-2 border border-gray-300 rounded bg-gray-50">
                            <div className="font-mono text-sm">
                                <span className="font-bold">{name}:</span> {renderValueWithType(value)}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-gray-500 italic">No variables declared</div>
            )}
        </div>
    )

    const renderObjects = () => (
        <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Objects</h3>
            {Object.keys(memoryState.objects).length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                    {Object.entries(memoryState.objects).map(([id, props]) => (
                        <div key={id} className="p-3 border border-gray-300 rounded bg-gray-50">
                            <div className="font-bold mb-1">{id}</div>
                            <div className="pl-4 border-l-2 border-gray-300">
                                {Object.entries(props).map(([propName, propValue]) => (
                                    <div key={propName} className="font-mono text-sm mb-1">
                                        <span className="font-semibold">{propName}:</span> {renderValueWithType(propValue)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-gray-500 italic">No objects created</div>
            )}
        </div>
    )

    const renderArrays = () => (
        <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Arrays</h3>
            {Object.keys(memoryState.arrays).length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                    {Object.entries(memoryState.arrays).map(([id, elements]) => (
                        <div key={id} className="p-3 border border-gray-300 rounded bg-gray-50">
                            <div className="font-bold mb-1">{id}</div>
                            <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-gray-300">
                                {elements.map((item, index) => (
                                    <div key={index} className="font-mono text-sm px-2 py-1 border border-gray-200 rounded">
                                        <span className="text-xs text-gray-500">[{index}]:</span> {renderValueWithType(item)}
                                    </div>
                                ))}
                                {elements.length === 0 && (
                                    <div className="text-gray-500 italic">Empty array</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-gray-500 italic">No arrays created</div>
            )}
        </div>
    )

    const renderFunctions = () => (
        <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Functions</h3>
            {Object.keys(memoryState.functions).length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                    {Object.entries(memoryState.functions).map(([id, fn]) => (
                        <div key={id} className="p-3 border border-gray-300 rounded bg-gray-50">
                            <div className="font-bold mb-1">{id}</div>
                            <div className="pl-4 border-l-2 border-gray-300">
                                <div className="font-mono text-sm mb-1">
                                    <span className="font-semibold">Parameters:</span> [{fn.params.join(', ')}]
                                </div>
                                <div className="font-mono text-sm mb-1">
                                    <span className="font-semibold">Body:</span>
                                    <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto">{fn.body}</pre>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-gray-500 italic">No functions defined</div>
            )}
        </div>
    )

    return (
        <div className="h-full overflow-auto text-black">
            {error && (
                <div className="text-red-500 pb-2">
                    Memory Model Error: {error}
                </div>
            )}

            <div className="flex border-b mb-4">
                <button
                    className={`px-4 py-2 font-medium ${activeTab === 'textual' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                    onClick={() => setActiveTab('textual')}
                >
                    Textual View
                </button>
                <button
                    className={`px-4 py-2 font-medium ${activeTab === 'd3' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                    onClick={() => setActiveTab('d3')}
                >
                    Graph View
                </button>
            </div>

            {activeTab === 'textual' ? (
                <div className="space-y-4">
                    {renderVariables()}
                    {renderObjects()}
                    {renderArrays()}
                    {renderFunctions()}
                </div>
            ) : (
                <MemoryModelDiagram memoryState={memoryState} />
            )}
        </div>
    )
}

export default MemoryModel 