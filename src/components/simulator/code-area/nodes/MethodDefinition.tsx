import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for components
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>
type StatementRenderer = React.FC<{ st: ESNode; parent: ESNode; parens: Set<number> }>
type FnParamsDefRenderer = React.FC<{ params: ESNode[]; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface MethodDefinitionProps {
    node: ESTree.MethodDefinition & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
    Statement: StatementRenderer
    FnParamsDef: FnParamsDefRenderer
}

// ----- MethodDefinition Component -----
const MethodDefinition: React.FC<MethodDefinitionProps> = ({ 
    node, 
    parent, 
    parens, 
    Expression,
    Statement,
    FnParamsDef,
}) => {
    const ref = useRef<HTMLDivElement>(null)
    const { isExecuting, isExecuted, isErrorThrown } = useExecStep(node, ref)

    // Determine context based on method kind
    let context = "method"
    if (node.kind === "constructor") context = "constructor"
    else if (node.kind === "get") context = "getter"
    else if (node.kind === "set") context = "setter"

    // Assign category for backwards compatibility
    ;(node as any).category = "class.method"

    const decoration = getNodeDecoration("MethodDefinition", context)
    const value = node.value as ESTree.FunctionExpression

    // Build key component
    let keyComponent: React.ReactNode = null
    if (node.key.type === "Identifier") {
        keyComponent = <span className="font-medium">{(node.key as ESTree.Identifier).name}</span>
    } else if (node.key.type === "Literal") {
        const literal = node.key as ESTree.Literal & { raw?: string }
        keyComponent = <span className="text-blue-500">{literal.raw || String(literal.value)}</span>
    } else if ((node.key as any).type === "PrivateIdentifier") {
        keyComponent = <span className="font-medium text-purple-500">#{(node.key as any).name}</span>
    }

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
            {node.static && (
                <span className="keyword keyword-static mr-1 text-purple-600 font-medium">static</span>
            )}
            {node.kind === "get" && (
                <span className="keyword keyword-getter mr-1 text-purple-600 font-medium">get</span>
            )}
            {node.kind === "set" && (
                <span className="keyword keyword-setter mr-1 text-purple-600 font-medium">set</span>
            )}
            
            {node.computed ? (
                <>
                    <span className="align-middle font-bold">[</span>
                    <Expression expr={node.key as ESNode} parens={parens} parent={node} />
                    <span className="align-middle font-bold">]</span>
                </>
            ) : keyComponent}
            
            <FnParamsDef params={value.params as ESNode[]} parens={parens} parent={node} />
            <span className="align-middle font-bold ml-1">&#123;</span>
            
            {value.body && value.body.body && value.body.body.length > 0 && (
                <div className="ml-4 space-y-1">
                    {value.body.body.map((st, i) => (
                        <Statement key={i} st={st as ESNode} parent={node} parens={parens} />
                    ))}
                </div>
            )}
            
            <span className="align-middle font-bold">&#125;</span>
        </div>
    )
}

export default MethodDefinition


