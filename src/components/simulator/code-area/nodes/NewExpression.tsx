import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Expression component
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface NewExpressionProps {
    node: ESTree.NewExpression & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

// ----- NewExpression Component -----
const NewExpression: React.FC<NewExpressionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.new"

    const decoration = getNodeDecoration("NewExpression", "default")
    const args = node.arguments

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
            <span className="keyword keyword-new text-purple-600 font-medium mr-1">new</span>
            <Expression expr={node.callee as ESNode} parens={parens} parent={node} />
            <span className="text-slate-500 align-middle font-bold">(</span>
            {args.map((arg, i) => (
                <React.Fragment key={i}>
                    <Expression expr={arg as ESNode} parens={parens} parent={node} />
                    {i < args.length - 1 && (
                        <span className="text-slate-500 align-middle font-bold">,</span>
                    )}
                </React.Fragment>
            ))}
            <span className="text-slate-500 align-middle font-bold">)</span>
        </span>
    )
}

export default NewExpression


