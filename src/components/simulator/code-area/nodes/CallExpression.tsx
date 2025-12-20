import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useNodeData } from "@/hooks/useNodeData"
import { getNodeDecoration } from "@/configs/ast-render.config"
import { useFunctionCallStack } from "@/hooks/useFunctionCallStack"
import { useRenderDepth } from "@/contexts/RenderDepthContext"
import { useActiveScopeOptional } from "@/contexts/ActiveScopeContext"
import { cn } from "@/lib/utils"

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
    const { isEvaluating, isEvaluated, isErrorThrown, wasEvaluated, evaluatedValue } = useNodeData(node, ref)
    const frames = useFunctionCallStack()
    const depth = useRenderDepth()
    const activeScope = useActiveScopeOptional()

    // Check if this specific CallExpression is active at the current depth
    const rangeKey = node.range ? `${node.range[0]}-${node.range[1]}` : ''
    const activeFrame = frames[depth]
    const isCallActive = activeFrame && activeFrame.callNodeKey === rangeKey

    // Check if this call is the currently viewed frame in the navigator
    const isViewedFrame = activeScope && activeScope.activeFrame?.callNodeKey === rangeKey

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.call"

    const decoration = getNodeDecoration("CallExpression", "default")
    const args = node.arguments

    const showExecutionUi = depth > 0

    // Only show evaluated state inside popovers (not in the main code area)
    const showEvaluated = showExecutionUi && (isEvaluated || wasEvaluated)

    // Build execution state classes
    const stateClasses = [
        showExecutionUi && isEvaluating && "evaluating",
        showExecutionUi && isEvaluated && "evaluated",
        showExecutionUi && isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    return (
        <span
            ref={ref}
            className={cn(
                "inline-flex items-center gap-1",
                decoration.className,
                stateClasses,
                // Highlight when this call is active in the execution
                isCallActive && "ring-2 ring-blue-400 ring-offset-1 rounded bg-blue-50/50",
                // Additional highlight when this is the viewed frame
                isViewedFrame && "ring-blue-500 bg-blue-100/70"
            )}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
            data-call-active={isCallActive ? "true" : undefined}
            data-viewed-frame={isViewedFrame ? "true" : undefined}
        >
            {/* Function call with subtle background when evaluated */}
            <span
                className={cn(
                    "inline-flex items-center rounded px-0.5 transition-colors",
                    showEvaluated && "bg-blue-100/60"
                )}
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

            {/* Return value shown inline with arrow */}
            {showEvaluated && evaluatedValue && (
                <span
                    className="inline-flex items-center gap-0.5 whitespace-nowrap"
                    title={`Returned: ${evaluatedValue.display}`}
                >
                    <span className="text-blue-500 text-sm">→</span>
                    <span className="rounded bg-blue-500 px-1.5 py-0.5 text-xs font-semibold text-white shadow-sm">
                        {evaluatedValue.display}
                    </span>
                </span>
            )}
        </span>
    )
}

export default CallExpression
