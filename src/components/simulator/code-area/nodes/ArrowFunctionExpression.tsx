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
export interface ArrowFunctionExpressionProps {
    node: ESTree.ArrowFunctionExpression & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
    Statement: StatementRenderer
    FnParamsDef: FnParamsDefRenderer
}

// ----- ArrowFunctionExpression Component -----
const ArrowFunctionExpression: React.FC<ArrowFunctionExpressionProps> = ({ 
    node, 
    parent, 
    parens, 
    Expression,
    Statement,
    FnParamsDef,
}) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)

    const isBlockBody = node.body.type === "BlockStatement"

    // Assign category for backwards compatibility
    ;(node as any).category = isBlockBody ? "expression.data.fnArr" : "expression.data.fnArrImplicit"

    const decoration = getNodeDecoration("ArrowFunctionExpression", isBlockBody ? "block" : "implicit")

    // Build execution state classes
    const stateClasses = [
        isEvaluating && "evaluating",
        isEvaluated && "evaluated",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    return (
        <span
            ref={ref}
            className={`${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {node.async && (
                <span className="keyword keyword-prefix keyword-async">async</span>
            )}
            <FnParamsDef params={node.params as ESNode[]} parens={parens} parent={node} />
            <span className="align-middle font-bold">&nbsp;=&gt;&nbsp;</span>
            <Statement st={node.body as ESNode} parent={node} parens={parens} />
        </span>
    )
}

export default ArrowFunctionExpression


