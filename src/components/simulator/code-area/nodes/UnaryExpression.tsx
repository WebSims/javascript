import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Expression component
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface UnaryExpressionProps {
    node: ESTree.UnaryExpression & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

// ----- UnaryExpression Component -----
const UnaryExpression: React.FC<UnaryExpressionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.operator.unary"

    const decoration = getNodeDecoration("UnaryExpression", "default")

    // Build execution state classes
    const stateClasses = [
        isEvaluating && "evaluating",
        isEvaluated && "evaluated",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    // Handle prefix operators (most unary operators)
    // Some operators like delete, void, typeof need a space after
    const needsSpace = ["delete", "void", "typeof"].includes(node.operator)
    const operatorDisplay = needsSpace ? `${node.operator} ` : node.operator

    return (
        <span
            ref={ref}
            className={`${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {node.prefix && (
                <span className="align-middle font-bold">{operatorDisplay}</span>
            )}
            <Expression expr={node.argument as ESNode} parens={parens} parent={node} />
            {!node.prefix && (
                <span className="align-middle font-bold">{node.operator}</span>
            )}
        </span>
    )
}

export default UnaryExpression


