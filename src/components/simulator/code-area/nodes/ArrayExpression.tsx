import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Expression component (will be imported from parent)
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface ArrayExpressionProps {
    node: ESTree.ArrayExpression & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

// ----- ArrayExpression Component -----
const ArrayExpression: React.FC<ArrayExpressionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.data.arr"

    const decoration = getNodeDecoration("ArrayExpression", "default")
    const elements = node.elements

    // Build execution state classes
    const stateClasses = [
        isEvaluating && "evaluating",
        isEvaluated && "evaluated",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    return (
        <span 
            ref={ref}
            className={`data new arr ${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            <span className="text-xl align-middle font-bold mr-1">[</span>
            {elements[0] && elements.map((item, i) => {
                if (!item) return null
                return (
                    <span key={i} className="ast-arr-item">
                        <Expression expr={item as ESNode} parens={parens} parent={node} />
                        {i < elements.length - 1 && (
                            <span className="text-xl align-middle font-bold">,&nbsp;</span>
                        )}
                    </span>
                )
            })}
            <span className="text-xl align-middle font-bold ml-1">]</span>
        </span>
    )
}

export default ArrayExpression


