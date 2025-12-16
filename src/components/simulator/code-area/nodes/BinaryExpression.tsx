import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useNodeData } from "@/hooks/useNodeData"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Expression component
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface BinaryExpressionProps {
    node: (ESTree.BinaryExpression | ESTree.LogicalExpression) & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

// ----- BinaryExpression Component -----
const BinaryExpression: React.FC<BinaryExpressionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown, wasEvaluated, evaluatedValue } = useNodeData(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.operator.binary"

    const decoration = getNodeDecoration("BinaryExpression", "default")

    // Show evaluated state if currently evaluated OR was evaluated in a previous step
    const showEvaluated = isEvaluated || wasEvaluated

    // Build execution state classes
    const stateClasses = [
        isEvaluating && "evaluating",
        isEvaluated && "evaluated",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    return (
        <span
            ref={ref}
            className={`inline-flex items-center gap-1 ${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {/* Expression content with subtle background when evaluated */}
            <span
                className={`inline-flex items-center rounded px-0.5 transition-colors ${showEvaluated ? "bg-emerald-100/60" : ""}`}
            >
                <Expression expr={node.left as ESNode} parens={parens} parent={node} />
                <span className="align-middle font-bold">&nbsp;{node.operator}&nbsp;</span>
                <Expression expr={node.right as ESNode} parens={parens} parent={node} />
            </span>

            {/* Result shown inline with arrow - clearer visual flow */}
            {showEvaluated && evaluatedValue && (
                <span
                    className="inline-flex items-center gap-0.5 whitespace-nowrap"
                    title={`Evaluated to: ${evaluatedValue.display}`}
                >
                    <span className="text-emerald-500 text-sm">→</span>
                    <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-xs font-semibold text-white shadow-sm">
                        {evaluatedValue.display}
                    </span>
                </span>
            )}
        </span>
    )
}

export default BinaryExpression


