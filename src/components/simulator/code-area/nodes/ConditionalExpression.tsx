import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Expression component
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface ConditionalExpressionProps {
    node: ESTree.ConditionalExpression & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

// ----- ConditionalExpression Component -----
const ConditionalExpression: React.FC<ConditionalExpressionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.operator.ternary"

    const decoration = getNodeDecoration("ConditionalExpression", "default")

    // Build execution state classes
    const stateClasses = [
        isEvaluating && "evaluating",
        isEvaluated && "evaluated",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    return (
        <span
            ref={ref}
            className={`${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            <Expression expr={node.test as ESNode} parens={parens} parent={node} />
            <span className="text-slate-500 align-middle font-bold">?</span>
            <Expression expr={node.consequent as ESNode} parens={parens} parent={node} />
            <span className="text-slate-500 align-middle font-bold">:</span>
            <Expression expr={node.alternate as ESNode} parens={parens} parent={node} />
        </span>
    )
}

export default ConditionalExpression


