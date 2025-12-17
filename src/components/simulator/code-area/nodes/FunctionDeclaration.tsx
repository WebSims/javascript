import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"
import { useRenderDepth } from "@/contexts/RenderDepthContext"
import { ExecutionUiContext } from "@/contexts/ExecutionUiContext"

// Forward declaration for components
type StatementRenderer = React.FC<{ st: ESNode; parent: ESNode; parens: Set<number> }>
type FnParamsDefRenderer = React.FC<{ params: ESNode[]; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface FunctionDeclarationProps {
    node: ESTree.FunctionDeclaration & ESNode
    parent: ESNode
    parens: Set<number>
    Statement: StatementRenderer
    FnParamsDef: FnParamsDefRenderer
}

// ----- FunctionDeclaration Component -----
const FunctionDeclaration: React.FC<FunctionDeclarationProps> = ({ 
    node, 
    parent, 
    parens, 
    Statement,
    FnParamsDef,
}) => {
    const ref = useRef<HTMLDivElement>(null)
    const { isExecuting, isExecuted, isErrorThrown } = useExecStep(node, ref)
    const depth = useRenderDepth()

    // Assign category for backwards compatibility
    ;(node as any).category = "statement.declaration"

    const decoration = getNodeDecoration("FunctionDeclaration", "default")

    // In the main code area, don't show execution/hoisting highlight for top-level function declarations
    const showExecutionUi = !(depth === 0 && parent.type === "Program")

    // Build execution state classes
    const stateClasses = [
        showExecutionUi && isExecuting && "executing",
        showExecutionUi && isExecuted && "executed",
        showExecutionUi && isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    return (
        <ExecutionUiContext.Provider value={showExecutionUi}>
        <div
            ref={ref}
            className={`${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {node.async && (
                <span className="keyword keyword-prefix keyword-async">async</span>
            )}
            <span className="keyword keyword-prefix keyword-fn">function</span>
            {node.id && (
                <span className="ast-exp-fn-name">{node.id.name}</span>
            )}
            <FnParamsDef params={node.params as ESNode[]} parens={parens} parent={node} />
            <Statement st={node.body as ESNode} parent={node} parens={parens} />
        </div>
        </ExecutionUiContext.Provider>
    )
}

export default FunctionDeclaration


