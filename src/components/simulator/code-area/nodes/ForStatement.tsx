import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for components
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>
type StatementRenderer = React.FC<{ st: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface ForStatementProps {
    node: ESTree.ForStatement & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
    Statement: StatementRenderer
}

// ----- ForStatement Component -----
const ForStatement: React.FC<ForStatementProps> = ({ node, parent, parens, Expression, Statement }) => {
    const ref = useRef<HTMLDivElement>(null)
    const { isExecuting, isExecuted, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "statement.loop.for"

    const decoration = getNodeDecoration("ForStatement", "default")

    // Build execution state classes
    const stateClasses = [
        isExecuting && "executing",
        isExecuted && "executed",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    const init = node.init as ESNode | null

    return (
        <div
            ref={ref}
            className={`${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            <span className="keyword keyword-for text-green-700 mr-2">for</span>
            <span className="text-slate-500 font-bold">(</span>
            
            {init && (
                init.type === "VariableDeclaration" ? (
                    <span className="[&>*:first-child]:inline">
                        <Statement st={init} parens={parens} parent={node} />
                    </span>
                ) : (
                    <span className="[&>*:first-child]:inline">
                        <Expression expr={init} parens={parens} parent={node} />
                    </span>
                )
            )}
            
            <span className="text-slate-500 font-bold">;</span>
            {node.test && <Expression expr={node.test as ESNode} parens={parens} parent={node} />}
            <span className="text-slate-500 font-bold">;</span>
            {node.update && <Expression expr={node.update as ESNode} parens={parens} parent={node} />}
            <span className="text-slate-500 font-bold">)</span>
            
            <Statement st={node.body as ESNode} parent={node} parens={parens} />
        </div>
    )
}

export default ForStatement


