import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Expression component
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface PropertyDefinitionProps {
    node: (ESTree.PropertyDefinition | any) & ESNode // any for ClassProperty type
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

// ----- PropertyDefinition Component -----
const PropertyDefinition: React.FC<PropertyDefinitionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLDivElement>(null)
    const { isExecuting, isExecuted, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "class.property"

    const decoration = getNodeDecoration("PropertyDefinition", "default")

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
            
            {node.computed ? (
                <>
                    <span className="align-middle font-bold">[</span>
                    <Expression expr={node.key as ESNode} parens={parens} parent={node} />
                    <span className="align-middle font-bold">]</span>
                </>
            ) : keyComponent}
            
            {node.value && (
                <>
                    <span className="align-middle font-bold mx-1">=</span>
                    <Expression expr={node.value as ESNode} parens={parens} parent={node} />
                </>
            )}
            
            <span className="align-middle font-bold">;</span>
        </div>
    )
}

export default PropertyDefinition


