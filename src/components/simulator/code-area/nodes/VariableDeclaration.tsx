import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"
import { useInScopeVariableValue } from "@/hooks/useInScopeVariableValue"

// Forward declaration for Expression component
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface VariableDeclarationProps {
    node: ESTree.VariableDeclaration & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
}

// ----- VariableDeclaration Component -----
const VariableDeclaration: React.FC<VariableDeclarationProps> = ({ node, parent, parens, Expression }) => {
    const ref = useRef<HTMLDivElement>(null)
    const { isExecuting, isExecuted, isErrorThrown } = useExecStep(node, ref)

    const { kind, declarations } = node
    const { init, id } = declarations[0]
    const hasInit = init !== null

    // Assign category for backwards compatibility
    ;(node as any).category = "statement.declaration"

    const decoration = getNodeDecoration("VariableDeclaration", hasInit ? "withInit" : "withoutInit")

    // Build execution state classes
    const stateClasses = [
        isExecuting && "executing",
        isExecuted && "executed",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    // Get identifier execution state
    const { isExecuting: isIdExecuting } = useExecStep(id as ESNode)

    const declaredName = (id as ESTree.Identifier)?.name
    const currentValue = useInScopeVariableValue(declaredName)

    return (
        <div
            ref={ref}
            className={`${decoration.className} ${stateClasses} flex items-center gap-2`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            <div className="flex-1 min-w-0">
                <span className="keyword keyword-prefix keyword-def">{kind}</span>
                <span className={`text-blue-600 ${isIdExecuting ? "executing" : ""}`}>
                    {(id as ESTree.Identifier).name}
                </span>
                {hasInit && (
                    <>
                        <span className="text-slate-500 font-bold">&nbsp;=&nbsp;</span>
                        <Expression expr={init as ESNode} parens={parens} parent={node} />
                    </>
                )}
            </div>

            {currentValue && (
                <span
                    className="shrink-0 rounded bg-slate-200/70 px-1.5 py-0.5 text-xs font-mono text-slate-700"
                    title={`Current value: ${currentValue.display}`}
                >
                    {currentValue.display}
                </span>
            )}
        </div>
    )
}

export default VariableDeclaration


