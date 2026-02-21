import React, { useRef, useEffect, useMemo } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useNodeData } from "@/hooks/useNodeData"
import { getNodeDecoration } from "@/configs/ast-render.config"
import { useScopeMorph } from "@/contexts/ScopeMorphContext"

type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

export interface CallExpressionProps {
    node: ESTree.CallExpression & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

const CallExpression: React.FC<CallExpressionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown, wasEvaluated, evaluatedValue } = useNodeData(node, ref)
    const { registerCallRef } = useScopeMorph()

    ;(node as any).category = "expression.call"

    const decoration = getNodeDecoration("CallExpression", "default")
    const args = node.arguments

    const nodeKey = useMemo(() => {
        if (!node.range) return ""
        return `${node.range[0]}-${node.range[1]}`
    }, [node.range])

    const callLabel = useMemo(() => {
        const callee = node.callee
        if (callee.type === "Identifier") return callee.name
        if (callee.type === "MemberExpression") {
            const obj = callee.object
            const prop = callee.property
            const objName = obj.type === "Identifier" ? obj.name : "..."
            const propName = prop.type === "Identifier" ? prop.name : "..."
            return `${objName}.${propName}`
        }
        return "fn"
    }, [node.callee])

    useEffect(() => {
        if (!nodeKey) return
        registerCallRef(nodeKey, ref.current, callLabel)
        return () => registerCallRef(nodeKey, null, callLabel)
    }, [nodeKey, callLabel, registerCallRef])

    const showEvaluated = isEvaluated || wasEvaluated

    const stateClasses = [
        isEvaluating && "evaluating",
        isEvaluated && "evaluated",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    return (
        <span
            ref={ref}
            className={`inline-flex items-center gap-1 ${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
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

            {showEvaluated && evaluatedValue && (
                <span
                    className="inline-flex items-center gap-0.5 whitespace-nowrap"
                    title={`Returned: ${evaluatedValue.display}`}
                >
                    <span className="text-blue-500 text-sm">&rarr;</span>
                    <span className="rounded bg-blue-500 px-1.5 py-0.5 text-xs font-semibold text-white shadow-sm">
                        {evaluatedValue.display}
                    </span>
                </span>
            )}
        </span>
    )
}

export default CallExpression


