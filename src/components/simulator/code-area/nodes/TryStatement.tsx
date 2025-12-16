import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Statement component
type StatementRenderer = React.FC<{ st: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface TryStatementProps {
    node: ESTree.TryStatement & ESNode
    parent: ESNode
    parens: Set<number>
    Statement: StatementRenderer
}

// ----- TryStatement Component -----
const TryStatement: React.FC<TryStatementProps> = ({ node, parent, parens, Statement }) => {
    const ref = useRef<HTMLDivElement>(null)
    const { isExecuting, isExecuted, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "statement.try"

    const decoration = getNodeDecoration("TryStatement", "default")

    // Build execution state classes
    const stateClasses = [
        isExecuting && "executing",
        isExecuted && "executed",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    const handleClick = (e: React.MouseEvent) => e.stopPropagation()
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") e.stopPropagation()
    }

    return (
        <div
            ref={ref}
            className={`relative my-2 ${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
            tabIndex={0}
            aria-label="Try statement block"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
        >
            <span className="keyword keyword-try text-blue-700 font-bold mr-2">try</span>
            <Statement st={node.block as ESNode} parent={node} parens={parens} />
            
            {node.handler && (
                <>
                    <span className="keyword keyword-catch text-red-700 font-bold mr-2">catch</span>
                    <span className="text-blue-600">
                        ({(node.handler.param as ESTree.Identifier)?.name || ""})
                    </span>
                    <Statement st={node.handler.body as ESNode} parent={node} parens={parens} />
                </>
            )}
            
            {node.finalizer && (
                <>
                    <span className="keyword keyword-finally text-purple-700 font-bold mr-2">finally</span>
                    <Statement st={node.finalizer as ESNode} parent={node} parens={parens} />
                </>
            )}
        </div>
    )
}

export default TryStatement


