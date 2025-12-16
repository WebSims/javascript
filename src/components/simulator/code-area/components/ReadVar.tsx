import React, { useRef } from "react"
import { ESNode } from "hermes-parser"
import { useNodeData } from "@/hooks/useNodeData"

interface ReadVarProps {
    name: string
    node?: ESNode
}

const ReadVar: React.FC<ReadVarProps> = ({ name, node }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, wasEvaluated, evaluatedValue } = useNodeData(node, ref)

    // Base case: no node provided, just render the name
    if (!node) {
        return <span>{name}</span>
    }

    // Show evaluated state if currently evaluated OR was evaluated in a previous step
    const showEvaluated = isEvaluated || wasEvaluated

    return (
        <span
            ref={ref}
            className={`relative inline-flex flex-col items-center ${isEvaluating ? "evaluating" : ""} ${isEvaluated ? "evaluated" : ""}`}
        >
            {/* Evaluated value badge - shown above the name when evaluated (current or previous) */}
            {showEvaluated && evaluatedValue && (
                <span
                    className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-emerald-700"
                    title={`Evaluated to: ${evaluatedValue.display}`}
                >
                    {evaluatedValue.display}
                </span>
            )}

            {/* Variable name with strikethrough when evaluated */}
            <span
                className={`relative ${showEvaluated ? "after:absolute after:left-0 after:top-1/2 after:h-0.5 after:w-full after:-translate-y-1/2 after:bg-emerald-500" : ""}`}
            >
                {name}
            </span>
        </span>
    )
}

export default ReadVar
