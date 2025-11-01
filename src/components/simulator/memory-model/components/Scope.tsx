import ScopeItem from "./ScopeItem"

interface Variable {
    name: string
    value: string
    targetRef?: string
}

interface ScopeData {
    id: string
    name: string
    variables: Variable[]
    isCurrent: boolean
    color?: string
    borderColor?: string
    x?: number
    y?: number
}

interface ScopeProps {
    scopes: ScopeData[]
}

const Scope = ({ scopes }: ScopeProps) => {
    if (!scopes) return null

    return (
        <div className="w-6/12 flex flex-col">
            <div className="flex flex-col overflow-y-auto overflow-x-hidden border border-gray-300 rounded p-2 flex-grow bg-gray-50">
                <div className="flex-1"></div>
                <div className="flex flex-col-reverse justify-end space-y-reverse space-y-2 min-h-0 w-full">
                    {scopes.map(scope => (
                        <ScopeItem key={scope.id} scope={scope} />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Scope
