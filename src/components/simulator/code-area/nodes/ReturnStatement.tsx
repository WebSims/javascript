import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Expression component
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface ReturnStatementProps {
    node: ESTree.ReturnStatement & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

// ----- ReturnStatement Component -----
const ReturnStatement: React.FC<ReturnStatementProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLDivElement>(null)
    const { isExecuting, isExecuted, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "statement.return"

    const decoration = getNodeDecoration("ReturnStatement", "default")

    // Build execution state classes
    const stateClasses = [
        isExecuting && "executing",
        isExecuted && "executed",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    return (
        <div
            ref={ref}
            className={`${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            <span className="text-purple-600 font-medium">return</span>
            {node.argument && (
                <>
                    <span className="mx-1"></span>
                    <Expression expr={node.argument as ESNode} parens={parens} parent={node} />
                </>
            )}
        </div>
    )
}

export default ReturnStatement


