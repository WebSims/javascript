import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Expression component
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface ObjectExpressionProps {
    node: ESTree.ObjectExpression & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

// ----- ObjectExpression Component -----
const ObjectExpression: React.FC<ObjectExpressionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.data.obj"

    const decoration = getNodeDecoration("ObjectExpression", "default")
    const properties = node.properties

    // Build execution state classes
    const stateClasses = [
        isEvaluating && "evaluating",
        isEvaluated && "evaluated",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    return (
        <span 
            ref={ref}
            className={`data new obj ${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            <span className="text-xl align-middle font-bold mr-1">&#123;</span>
            {properties.map((prop, i) => {
                // Handle SpreadElement
                if (prop.type === "SpreadElement") {
                    return (
                        <span key={i} className="ast-obj-prop">
                            <span className="align-middle font-bold">...</span>
                            <Expression expr={(prop as ESTree.SpreadElement).argument as ESNode} parens={parens} parent={node} />
                            {i < properties.length - 1 && (
                                <span className="align-middle font-bold">,&nbsp;</span>
                            )}
                        </span>
                    )
                }

                // Handle Property
                const property = prop as ESTree.Property
                let key: React.ReactNode = null

                if (property.key.type === "Identifier") {
                    key = <span className="align-middle">{(property.key as ESTree.Identifier).name}</span>
                } else if (property.key.type === "Literal") {
                    const literal = property.key as ESTree.Literal & { raw?: string }
                    key = <span className="text-blue-500">{literal.raw || String(literal.value)}</span>
                } else if (property.computed) {
                    key = (
                        <>
                            <span className="align-middle font-bold">[</span>
                            <Expression expr={property.key as ESNode} parens={parens} parent={node} />
                            <span className="align-middle font-bold">]</span>
                        </>
                    )
                }

                return (
                    <span key={i} className="ast-obj-prop">
                        {key}
                        <span className="align-middle font-bold">:&nbsp;</span>
                        <Expression expr={property.value as ESNode} parens={parens} parent={node} />
                        {i < properties.length - 1 && (
                            <span className="align-middle font-bold">,&nbsp;</span>
                        )}
                    </span>
                )
            })}
            <span className="text-xl align-middle font-bold ml-1">&#125;</span>
        </span>
    )
}

export default ObjectExpression


