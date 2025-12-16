import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Expression component
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface UpdateExpressionProps {
    node: ESTree.UpdateExpression & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

// ----- UpdateExpression Component -----
const UpdateExpression: React.FC<UpdateExpressionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.operator.update"

    const decoration = getNodeDecoration("UpdateExpression", "default")
    const argument = node.argument

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
            {node.prefix && (
                <span className="align-middle font-bold">{node.operator}</span>
            )}
            {argument.type === "Identifier" ? (
                <span className="inline-block p-2 text-blue-600">
                    {(argument as ESTree.Identifier).name}
                </span>
            ) : (
                <Expression expr={argument as ESNode} parens={parens} parent={node} />
            )}
            {!node.prefix && (
                <span className="align-middle font-bold">{node.operator}</span>
            )}
        </span>
    )
}

export default UpdateExpression


