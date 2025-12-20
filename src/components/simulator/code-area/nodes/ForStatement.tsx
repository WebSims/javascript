import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"
import { useScopeOverlay } from "@/contexts/ScopeOverlayContext"

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
    const { scopeDepthsByKey } = useScopeOverlay()

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

    const rangeKey = node.range ? `${node.range[0]}-${node.range[1]}` : ""
    const overlayDepths = rangeKey ? (scopeDepthsByKey[rangeKey] || []) : []

    const overlayClassName = (() => {
        if (!overlayDepths.length) return ""
        const palette = [
            "bg-blue-500/[0.06] border-blue-400/30",
            "bg-emerald-500/[0.06] border-emerald-400/30",
            "bg-purple-500/[0.06] border-purple-400/30",
            "bg-amber-500/[0.06] border-amber-400/30",
        ]
        const deepest = overlayDepths[overlayDepths.length - 1]
        return palette[deepest % palette.length]
    })()

    return (
        <div
            ref={ref}
            className={`relative ${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {overlayDepths.length > 0 && (
                <div
                    aria-hidden="true"
                    className={[
                        "pointer-events-none absolute inset-0 rounded-md border",
                        overlayClassName,
                    ].filter(Boolean).join(" ")}
                />
            )}
            <div className="relative z-10">
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
        </div>
    )
}

export default ForStatement


