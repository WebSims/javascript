import React, { useRef, useMemo } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { useFunctionCallExpansion } from "@/hooks/useFunctionCallExpansion"
import { getNodeDecoration } from "@/configs/ast-render.config"
import { formatJSValue } from "@/utils/formatJSValue"
import { JSValue, Heap, Scope } from "@/types/simulator"
import { ExpansionProvider } from "@/contexts/ExpansionContext"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

// Forward declaration for Expression and Statement components
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>
type StatementRenderer = React.FC<{ st: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface CallExpressionProps {
    node: ESTree.CallExpression & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
    Statement?: StatementRenderer
}

// Popover expansion component
const FunctionExpansion = ({
    functionNode,
    functionName,
    scope,
    heap,
    stackIndex,
    totalDepth,
    Statement,
    Expression,
    parens,
    returnValue,
    isReturning,
    isScopeClosing
}: {
    functionNode: ESTree.Function | null
    functionName: string
    scope: Scope
    heap: Heap
    stackIndex: number
    totalDepth: number
    Statement?: StatementRenderer
    Expression: ExpressionRenderer
    parens: Set<number>
    returnValue: JSValue | null
    isReturning: boolean
    isScopeClosing: boolean
}) => {
    // Get scope variables
    const variables = useMemo(() => {
        if (!scope || !scope.variables) return []
        return Object.entries(scope.variables).map(([name, varValue]) => ({
            name,
            value: varValue.value,
            declarationType: varValue.declarationType
        }))
    }, [scope])

    if (!functionNode || !functionNode.body) return null

    const formattedReturnValue = returnValue ? formatJSValue(returnValue, heap) : null

    // Color themes for different stack depths
    const layerColors = [
        { header: "from-indigo-500 to-purple-500", shadow: "shadow-indigo-300/50", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-600" },
        { header: "from-violet-500 to-fuchsia-500", shadow: "shadow-violet-300/50", border: "border-violet-200", badge: "bg-violet-100 text-violet-600" },
        { header: "from-purple-500 to-pink-500", shadow: "shadow-purple-300/50", border: "border-purple-200", badge: "bg-purple-100 text-purple-600" },
        { header: "from-fuchsia-500 to-rose-500", shadow: "shadow-fuchsia-300/50", border: "border-fuchsia-200", badge: "bg-fuchsia-100 text-fuchsia-600" },
    ]
    const colors = layerColors[stackIndex % layerColors.length]

    return (
        <div className="relative w-[min(500px,80vw)]">
            {/* Main card */}
            <div className={`
                relative bg-white rounded-xl overflow-hidden
                border ${colors.border}
                shadow-xl ${colors.shadow}
            `}>
                {/* Header bar - colored by depth */}
                <div className={`bg-gradient-to-r ${colors.header} px-4 py-2.5 flex items-center gap-3`}>
                    {/* Stack depth indicator */}
                    <div className="flex items-center gap-1">
                        {Array.from({ length: stackIndex + 1 }).map((_, i) => (
                            <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/40" />
                        ))}
                    </div>
                    
                    <span className="text-white font-semibold text-sm">
                        {functionName}()
                    </span>
                    
                    {/* Scope variables */}
                    {variables.length > 0 && (
                        <div className="flex items-center gap-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                            {variables.map(v => (
                                <span key={v.name} className="text-white/90">
                                    <span className="opacity-60">{v.name}:</span>
                                    <span className="ml-1 font-mono">
                                        {formatJSValue(v.value, heap).display}
                                    </span>
                                </span>
                            ))}
                        </div>
                    )}
                    
                    {/* Layer badge */}
                    <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                        #{stackIndex + 1}
                    </span>
                </div>

                {/* Function Body */}
                <div 
                    className="p-3 overflow-auto bg-white"
                    style={{ maxHeight: "min(50vh, 400px)", minHeight: "80px" }}
                >
                    <ExpansionProvider>
                        {Statement ? (
                            <Statement 
                                st={functionNode.body as ESNode} 
                                parent={functionNode as unknown as ESNode} 
                                parens={parens} 
                            />
                        ) : (
                            functionNode.body.type !== "BlockStatement" ? (
                                <Expression 
                                    expr={functionNode.body as ESNode} 
                                    parent={functionNode as unknown as ESNode} 
                                    parens={parens} 
                                />
                            ) : (
                                <span className="text-slate-400 text-sm">Function body</span>
                            )
                        )}
                    </ExpansionProvider>
                </div>

                {/* Footer - Result display */}
                {isReturning && formattedReturnValue && (
                    <div className={`
                        px-4 py-2.5 flex items-center justify-center gap-3 border-t
                        ${isScopeClosing 
                            ? "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200" 
                            : "bg-slate-50 border-slate-200"
                        }
                    `}>
                        {isScopeClosing ? (
                            <>
                                <span className="text-amber-500 text-lg animate-bounce">↑</span>
                                <span className="text-amber-600 text-xs font-medium">result:</span>
                                <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-md">
                                    {formattedReturnValue.display}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="text-slate-400">↑</span>
                                <span className="text-slate-500 text-xs">return</span>
                                <span className="bg-slate-600 text-white px-3 py-1 rounded text-xs font-bold">
                                    {formattedReturnValue.display}
                                </span>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ----- CallExpression Component -----
const CallExpression: React.FC<CallExpressionProps> = ({ node, parent, parens, Expression, Statement }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)
    const { isExpanded, activeFunctionCall, activeFunctionCalls, stackIndex } = useFunctionCallExpansion(node)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.call"

    const decoration = getNodeDecoration("CallExpression", "default")
    const args = node.arguments

    // Build execution state classes
    const stateClasses = [
        isEvaluating && "evaluating",
        isEvaluated && "evaluated",
        isErrorThrown && "error-thrown",
        isExpanded && "bg-indigo-100/50 rounded px-1 py-0.5",
    ].filter(Boolean).join(" ")

    return (
        <Popover open={isExpanded && !!activeFunctionCall}>
            <PopoverTrigger asChild>
                <span
                    ref={ref}
                    className={`inline-flex items-center gap-1 ${decoration.className} ${stateClasses}`}
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
            </PopoverTrigger>
            <PopoverContent 
                side="bottom" 
                align="start" 
                sideOffset={4}
                alignOffset={0}
                avoidCollisions={false}
                className="w-auto p-0 border-0 bg-transparent shadow-none"
            >
                {activeFunctionCall && (
                    <FunctionExpansion
                        functionNode={activeFunctionCall.functionNode}
                        functionName={activeFunctionCall.functionName}
                        scope={activeFunctionCall.scope}
                        heap={activeFunctionCall.heap}
                        stackIndex={stackIndex}
                        totalDepth={activeFunctionCalls.length}
                        Statement={Statement}
                        Expression={Expression}
                        parens={parens}
                        returnValue={activeFunctionCall.returnValue}
                        isReturning={activeFunctionCall.isReturning}
                        isScopeClosing={activeFunctionCall.isScopeClosing}
                    />
                )}
            </PopoverContent>
        </Popover>
    )
}

export default CallExpression
