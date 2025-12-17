import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useNodeData } from "@/hooks/useNodeData"
import { getNodeDecoration } from "@/configs/ast-render.config"
import { useFunctionCallStack } from "@/hooks/useFunctionCallStack"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"
import CodeArea from "../CodeArea"
import { formatJSValue } from "@/utils/formatJSValue"
import { RenderDepthContext, useRenderDepth } from "@/contexts/RenderDepthContext"

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

    // Check if this specific CallExpression is active at the current depth
    const rangeKey = node.range ? `${node.range[0]}-${node.range[1]}` : ''
    const activeFrame = frames[depth]
    const isCallActive = activeFrame && activeFrame.callNodeKey === rangeKey

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

    const callVisual = (
        <span
            ref={ref}
            className={`inline-flex items-center gap-1 ${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {/* Function call with subtle background when evaluated */}
            <span
                className={`inline-flex items-center rounded px-0.5 transition-colors ${showEvaluated ? "bg-blue-100/60" : ""}`}
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

    return (
        <Popover open={isCallActive}>
            <PopoverAnchor asChild>
                {callVisual}
            </PopoverAnchor>
            
            {activeFrame && (
                <PopoverContent 
                    className="w-[500px] max-w-[90vw] max-h-[60vh] overflow-hidden p-0 flex flex-col shadow-xl border-slate-200"
                    side="bottom"
                    align="start"
                    sideOffset={8}
                    avoidCollisions
                >
                    {/* Header */}
                    <div className="bg-slate-100 border-b border-slate-200 p-2 text-sm font-mono flex items-center gap-2">
                        <span className="text-purple-600 font-bold">
                            {activeFrame.fnNode.id?.name || 'anonymous'}
                        </span>
                        <span className="text-slate-500">(</span>
                        <div className="flex gap-1">
                            {activeFrame.fnNode.params.map((param, i) => {
                                const argVal = activeFrame.args[i]
                                const formattedArg = argVal 
                                    ? formatJSValue(argVal, activeFrame.heapAtCall)
                                    : { display: 'undefined' }
                                
                                return (
                                    <span key={i} className="flex items-center">
                                        <span className="text-blue-600">
                                            {(param as any).name}
                                        </span>
                                        <span className="text-slate-400 mx-1">=</span>
                                        <span className="text-slate-700 bg-slate-200/50 px-1 rounded text-xs">
                                            {formattedArg.display}
                                        </span>
                                        {i < activeFrame.fnNode.params.length - 1 && (
                                            <span className="text-slate-400 mr-1">,</span>
                                        )}
                                    </span>
                                )
                            })}
                        </div>
                        <span className="text-slate-500">)</span>
                    </div>

                    {/* Function Body */}
                    <div className="flex-1 overflow-auto bg-white p-2">
                        <RenderDepthContext.Provider value={depth + 1}>
                            <CodeArea 
                                ast={activeFrame.fnNode.body as ESNode} 
                                parent={activeFrame.fnNode}
                            />
                        </RenderDepthContext.Provider>
                    </div>
                </PopoverContent>
            )}
        </Popover>
    )
}

export default CallExpression


