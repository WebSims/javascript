import { ArcherElement } from "react-archer"

interface Variable {
    name: string
    value: string
    targetRef?: string
}

interface ScopeVariableProps {
    variable: Variable
    scopeId: string
}

const ScopeVariable = ({ variable, scopeId }: ScopeVariableProps) => {
    const varId = `${scopeId}-var-${variable.name}`

    return (
        <ArcherElement
            key={variable.name}
            id={varId}
        >
            <div className="text-sm bg-gray-50 px-2.5 py-1.5 rounded-md hover:bg-gray-100 transition-colors border border-gray-200 break-words">
                <span className="font-semibold text-gray-700">{variable.name}:</span>{" "}
                <span className={`${variable.targetRef ? 'text-purple-600 font-semibold' : 'text-blue-600 font-medium'}`}>
                    {variable.value}
                </span>
            </div>
        </ArcherElement>
    )
}

export default ScopeVariable

