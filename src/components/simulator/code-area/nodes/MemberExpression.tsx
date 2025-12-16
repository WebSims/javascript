import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Expression component
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface MemberExpressionProps {
    node: ESTree.MemberExpression & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

// ----- MemberExpression Static (dot notation) -----
// obj.property
export const MemberExpressionStatic: React.FC<MemberExpressionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.read.prop"

    const decoration = getNodeDecoration("MemberExpression", "static")
    const propertyName = (node.property as ESTree.Identifier).name

    // Build execution state classes
    const stateClasses = [
        isEvaluating && "evaluating",
        isEvaluated && "evaluated",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    return (
        <span
            ref={ref}
            className={stateClasses}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
            style={decoration.color ? { color: decoration.color } : undefined}
        >
            <span className="ast-noundef">
                <Expression expr={node.object as ESNode} parens={parens} parent={node} />
            </span>
            <span className="align-middle font-bold">.</span>
            <span>{propertyName}</span>
        </span>
    )
}

// ----- MemberExpression Computed (bracket notation) -----
// obj[expression]
export const MemberExpressionComputed: React.FC<MemberExpressionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.read.expr"

    const decoration = getNodeDecoration("MemberExpression", "computed")

    // Build execution state classes
    const stateClasses = [
        isEvaluating && "evaluating",
        isEvaluated && "evaluated",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    return (
        <span
            ref={ref}
            className={stateClasses}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
            style={decoration.color ? { color: decoration.color } : undefined}
        >
            <span className="ast-noundef">
                <Expression expr={node.object as ESNode} parens={parens} parent={node} />
            </span>
            <span className="text-xl align-middle font-bold">[</span>
            <Expression expr={node.property as ESNode} parens={parens} parent={node} />
            <span className="text-xl align-middle font-bold">]</span>
        </span>
    )
}

// ----- Main MemberExpression Component -----
const MemberExpression: React.FC<MemberExpressionProps> = (props) => {
    const { node } = props

    if (node.computed) {
        return <MemberExpressionComputed {...props} />
    }

    return <MemberExpressionStatic {...props} />
}

export default MemberExpression


