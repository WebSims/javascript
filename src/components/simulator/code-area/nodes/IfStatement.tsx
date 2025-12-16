import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for components
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>
type StatementRenderer = React.FC<{ st: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface IfStatementProps {
    node: ESTree.IfStatement & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
    Statement: StatementRenderer
}

// ----- IfStatement Component -----
const IfStatement: React.FC<IfStatementProps> = ({ node, parent, parens, Expression, Statement }) => {
    const ref = useRef<HTMLDivElement>(null)
    const { isExecuting, isExecuted, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "statement.conditional.if"

    const decoration = getNodeDecoration("IfStatement", "default")
    
    // Check if consequent is a block statement
    const consequent = node.consequent as ESNode & { body?: unknown }
    const isBlockConsequent = consequent.body !== undefined

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
            <span className="keyword keyword-if text-blue-700 mr-2">if</span>
            <span className="text-slate-500 font-bold">(</span>
            <Expression expr={node.test as ESNode} parens={parens} parent={node} />
            <span className="text-slate-500 font-bold">)</span>
            
            <span className={`${!isBlockConsequent ? "[&>*:first-child]:inline-block" : ""}`}>
                <Statement st={node.consequent as ESNode} parent={node} parens={parens} />
            </span>
            
            {node.alternate && (
                <span className={`${!isBlockConsequent ? "block" : ""}`}>
                    <span className="keyword keyword-else text-red-700 mr-2">else</span>
                    <span className="[&>*:first-child]:inline">
                        <Statement st={node.alternate as ESNode} parent={node} parens={parens} />
                    </span>
                </span>
            )}
        </div>
    )
}

export default IfStatement


