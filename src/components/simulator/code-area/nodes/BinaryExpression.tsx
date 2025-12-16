import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
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
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.operator.binary"

    const decoration = getNodeDecoration("BinaryExpression", "default")

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
            <Expression expr={node.left as ESNode} parens={parens} parent={node} />
            <span className="align-middle font-bold">&nbsp;{node.operator}&nbsp;</span>
            <Expression expr={node.right as ESNode} parens={parens} parent={node} />
        </span>
    )
}

export default BinaryExpression


