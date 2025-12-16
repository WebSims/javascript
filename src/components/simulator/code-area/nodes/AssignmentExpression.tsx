import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for Expression component
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface AssignmentExpressionProps {
    node: ESTree.AssignmentExpression & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

// ----- AssignmentExpression Variable Component -----
// x = 5
export const AssignmentExpressionVariable: React.FC<AssignmentExpressionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)
    const { isExecuting: isIdExecuting } = useExecStep(node.left as ESNode)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.write.var"

    const decoration = getNodeDecoration("AssignmentExpression", "variable")
    const identifier = node.left as ESTree.Identifier

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
        >
            <span className={`text-blue-600 ${isIdExecuting ? "executing" : ""}`}>
                {identifier.name}
            </span>
            <span className="text-slate-500 font-bold">&nbsp;{node.operator}&nbsp;</span>
            <Expression expr={node.right as ESNode} parens={parens} parent={node} />
        </span>
    )
}

// ----- AssignmentExpression Property Component -----
// obj.prop = 5 or obj[key] = 5
export const AssignmentExpressionProperty: React.FC<AssignmentExpressionProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)

    const member = node.left as ESTree.MemberExpression

    // Assign category for backwards compatibility
    ;(node as any).category = member.computed ? "expression.write.expr" : "expression.write.prop"

    const decoration = getNodeDecoration("AssignmentExpression", member.computed ? "computed" : "property")

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
        >
            {member.computed ? (
                <>
                    <Expression expr={member.object as ESNode} parens={parens} parent={node} />
                    <span className="text-xl align-middle font-bold">[</span>
                    <Expression expr={member.property as ESNode} parens={parens} parent={node} />
                    <span className="text-xl align-middle font-bold">]</span>
                </>
            ) : (
                <>
                    <Expression expr={member.object as ESNode} parens={parens} parent={node} />
                    <span className="text-slate-500 font-bold">.</span>
                    <span className="text-blue-600">{(member.property as ESTree.Identifier).name}</span>
                </>
            )}
            <span className="text-slate-500 font-bold">&nbsp;{node.operator}&nbsp;</span>
            <Expression expr={node.right as ESNode} parens={parens} parent={node} />
        </span>
    )
}

// ----- Main AssignmentExpression Component -----
const AssignmentExpression: React.FC<AssignmentExpressionProps> = (props) => {
    const { node } = props

    if (node.left.type === "Identifier") {
        return <AssignmentExpressionVariable {...props} />
    }

    return <AssignmentExpressionProperty {...props} />
}

export default AssignmentExpression


