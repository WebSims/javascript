import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Expression component
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface CallExpressionProps {
    node: ESTree.CallExpression & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

// ----- CallExpression Component -----
const CallExpression: React.FC<CallExpressionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.call"

    const decoration = getNodeDecoration("CallExpression", "default")
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
            <Expression expr={node.callee as ESNode} parens={parens} parent={node} />
            <span className="text-slate-500 align-middle font-bold">(</span>
            {args.map((arg, i) => {
                const argNode = arg as ESNode
                const key = argNode.range 
                    ? `${argNode.range[0]}-${argNode.range[1]}`
                    : i
                return (
                    <span key={key}>
                        <Expression expr={argNode} parens={parens} parent={node} />
                        {i < args.length - 1 && (
                            <span className="text-slate-500 align-middle font-bold">,</span>
                        )}
                    </span>
                )
            })}
            <span className="text-slate-500 align-middle font-bold">)</span>
        </span>
    )
}

export default CallExpression


