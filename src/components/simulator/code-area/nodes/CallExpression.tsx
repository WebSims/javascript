import React, { useRef, useMemo } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { useFunctionCallExpansion } from "@/hooks/useFunctionCallExpansion"
import { getNodeDecoration } from "@/configs/ast-render.config"
import { formatJSValue } from "@/utils/formatJSValue"
import { JSValue, Heap, Scope } from "@/types/simulator"
import { ExpansionProvider } from "@/contexts/ExpansionContext"

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

// Variable display component for scope
const VariableItem = ({ 
    name, 
    value, 
    heap 
}: { 
    name: string
    value: JSValue
    heap: Heap
}) => {
    const formatted = formatJSValue(value, heap)
    const isReference = value.type === "reference"

    return (
        <span className="inline-flex items-center gap-1 text-xs bg-slate-100 px-1.5 py-0.5 rounded">
            <span className="font-semibold text-slate-600">{name}:</span>
            <span className={isReference ? "text-purple-600 font-medium" : "text-blue-600"}>
                {formatted.display}
            </span>
        </span>
    )
}

// Inline expansion component
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
    totalDepth: number  // Total number of active scopes
    Statement?: StatementRenderer
    Expression: ExpressionRenderer
    parens: Set<number>
    returnValue: JSValue | null
    isReturning: boolean
    isScopeClosing: boolean
}) => {
    // Calculate fade: more layers on top = more faded
    const layersOnTop = totalDepth - stackIndex - 1
    const fadeOpacity = layersOnTop > 0 ? Math.max(0.3, 1 - (layersOnTop * 0.25)) : 1
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

    // Color themes for different stack depths (like notification layers)
    const layerColors = [
        { header: "from-indigo-500 to-purple-500", shadow: "shadow-indigo-300/50", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-600" },
        { header: "from-violet-500 to-fuchsia-500", shadow: "shadow-violet-300/50", border: "border-violet-200", badge: "bg-violet-100 text-violet-600" },
        { header: "from-purple-500 to-pink-500", shadow: "shadow-purple-300/50", border: "border-purple-200", badge: "bg-purple-100 text-purple-600" },
        { header: "from-fuchsia-500 to-rose-500", shadow: "shadow-fuchsia-300/50", border: "border-fuchsia-200", badge: "bg-fuchsia-100 text-fuchsia-600" },
    ]
    const colors = layerColors[stackIndex % layerColors.length]

    // Is this layer faded (has children on top)?
    const isFaded = layersOnTop > 0

    return (
        <div 
            className={`mt-2 relative min-w-[340px] max-w-[540px] transition-all duration-300 ${isFaded ? "scale-[0.98]" : ""}`}
            style={{
                // Stack offset - each layer shifts slightly
                marginLeft: `${stackIndex * 8}px`,
                // Z-index for proper stacking
                zIndex: 10 + stackIndex,
                // Fade effect for parent layers
                opacity: fadeOpacity,
                // Slight blur for deeper layers
                filter: isFaded ? `blur(${layersOnTop * 0.5}px)` : "none",
            }}
        >
            {/* Stack shadow layers behind - notification stack effect */}
            {stackIndex === 0 && !isFaded && (
                <>
                    <div className="absolute inset-0 translate-y-2 translate-x-1 bg-slate-200/60 rounded-xl blur-sm" />
                    <div className="absolute inset-0 translate-y-1 translate-x-0.5 bg-slate-100/80 rounded-xl" />
                </>
            )}
            
            {/* Overlay when faded */}
            {isFaded && (
                <div className="absolute inset-0 bg-slate-500/10 rounded-xl z-10 pointer-events-none" />
            )}
            
            {/* Main card */}
            <div className={`
                relative bg-white rounded-xl overflow-hidden
                border ${colors.border}
                shadow-lg ${colors.shadow}
                transform transition-all duration-200
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
                <div className="p-3 max-h-64 overflow-auto bg-white">
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
                            // Closing this layer
                            <>
                                <span className="text-amber-500 text-lg animate-bounce">↑</span>
                                <span className="text-amber-600 text-xs font-medium">result:</span>
                                <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-md">
                                    {formattedReturnValue.display}
                                </span>
                            </>
                        ) : (
                            // Return value ready
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
        <span className="inline-flex flex-col">
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

            {/* Inline expansion below the call expression */}
            {isExpanded && activeFunctionCall && (
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
        </span>
    )
}

export default CallExpression
