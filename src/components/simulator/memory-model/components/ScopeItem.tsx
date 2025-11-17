import ScopeVariable from "./ScopeVariable"

interface Variable {
    name: string
    value: string
    targetRef?: string
}

interface ScopeItemData {
    id: string
    name: string
    variables: Variable[]
    isCurrent: boolean
    color?: string
    borderColor?: string
    x?: number
    y?: number
}

interface ScopeItemProps {
    scope: ScopeItemData
}

const ScopeItem = ({ scope }: ScopeItemProps) => {
    return (
        <div
            className={`p-0.5 md:p-2 border-2 rounded-lg flex-shrink-0 transition-all duration-200 hover:shadow-lg w-full ${
                scope.isCurrent 
                    ? 'ring-1 ring-blue-500 ring-offset-2 shadow-md' 
                    : ''
            }`}
            style={{
                backgroundColor: scope.color || '#ffffff',
                borderColor: scope.borderColor || '#d1d5db'
            }}
        >
            <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="font-bold text-xs md:text-base text-gray-800 break-all">{scope.name}</div>
                {scope.isCurrent && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 flex-shrink-0">
                        Active
                    </span>
                )}
            </div>
            {scope.variables.length > 0 ? (
                <div className="space-y-2">
                    {scope.variables.map(variable => (
                        <ScopeVariable 
                            key={variable.name} 
                            variable={variable} 
                            scopeId={scope.id} 
                        />
                    ))}
                </div>
            ) : (
                <p className="text-xs text-gray-400 italic px-2">No variables</p>
            )}
        </div>
    )
}

export default ScopeItem

