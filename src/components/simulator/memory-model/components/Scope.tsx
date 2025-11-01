interface Scope {
    id: string
    name: string
    variables: Array<{
        name: string
        value: string
        targetRef?: string
    }>
    isCurrent: boolean
    color?: string
    borderColor?: string
    x?: number
    y?: number
}

interface ScopeProps {
    scopes: Scope[]
}

const Scope = ({ scopes }: ScopeProps) => {
    if (!scopes) return null

    return (
        <div className="w-1/4 flex flex-col">
            <div className="flex flex-col overflow-hidden border border-gray-300 rounded p-2 flex-grow bg-gray-50">
                <div className="flex-1"></div>
                <div className="flex flex-col-reverse justify-end space-y-reverse space-y-2 min-h-0">
                    {scopes.map(scope => (
                        <div
                            key={scope.id}
                            className={`p-3 border-2 rounded flex-shrink-0 transition-all ${scope.isCurrent ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                            style={{
                                backgroundColor: scope.color || '#ffffff',
                                borderColor: scope.borderColor || '#d1d5db'
                            }}
                        >
                            <div className="font-semibold mb-1 text-gray-800">{scope.name}</div>
                            {scope.variables.length > 0 ? (
                                <ul className="space-y-1">
                                    {scope.variables.map(variable => (
                                        <li key={variable.name} className="text-sm">
                                            <span className="font-medium">{variable.name}:</span>{" "}
                                            <span className={`${variable.targetRef ? 'text-purple-600 font-medium' : 'text-blue-600'}`}>
                                                {variable.value}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-gray-500 italic">No variables</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Scope
