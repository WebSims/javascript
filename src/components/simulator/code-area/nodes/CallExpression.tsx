import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useNodeData } from "@/hooks/useNodeData"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Expression component
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface CallExpressionProps {
    node: ESTree.CallExpression & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

// ----- CallExpression Component -----
const CallExpression: React.FC<CallExpressionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown, wasEvaluated, evaluatedValue } = useNodeData(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.call"

    const decoration = getNodeDecoration("CallExpression", "default")
    const args = node.arguments

    // In the single, static program view we always show evaluated state (scoped to the active frame)
    const showEvaluated = isEvaluated || wasEvaluated

    // Build execution state classes
    const stateClasses = [
        isEvaluating && "evaluating",
        isEvaluated && "evaluated",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    const callVisual = (
        <span
            ref={ref}
            className={`inline-flex items-center gap-1 ${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {/* Function call with subtle background when evaluated */}
            <span
                className={`inline-flex items-center rounded px-0.5 transition-colors ${showEvaluated ? "bg-blue-100/60" : ""}`}
            >
                <Expression expr={node.callee as ESNode} parens={parens} parent={node} />
                <span className="text-slate-500 align-middle font-bold">(</span>
                {args.map((arg, i) => {
                    const argNode = arg as ESNode
                    const key = argNode.range 
                        ? `${argNode.range[0]}-${argNode.range[1]}`
                        : i
                    return (
                        <span key={key}>
                            <Expression expr={argNode} parens={parens} parent={node} />
                            {i < args.length - 1 && (
                                <span className="text-slate-500 align-middle font-bold">,</span>
                            )}
                        </span>
                    )
                })}
                <span className="text-slate-500 align-middle font-bold">)</span>
            </span>

            {/* Return value shown inline with arrow */}
            {showEvaluated && evaluatedValue && (
                <span
                    className="inline-flex items-center gap-0.5 whitespace-nowrap"
                    title={`Returned: ${evaluatedValue.display}`}
                >
                    <span className="text-blue-500 text-sm">→</span>
                    <span className="rounded bg-blue-500 px-1.5 py-0.5 text-xs font-semibold text-white shadow-sm">
                        {evaluatedValue.display}
                    </span>
                </span>
            )}
        </span>
    )

    return callVisual
}

export default CallExpression


