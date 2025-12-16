import React, { useRef } from "react"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// ----- Types -----
export interface ThisExpressionProps {
    node: ESNode
    parent: ESNode
    parens: Set<number>
}

// ----- ThisExpression Component -----
const ThisExpression: React.FC<ThisExpressionProps> = ({ node, parent }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "expression.read.prop"

    const decoration = getNodeDecoration("ThisExpression", "default")

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
            this
        </span>
    )
}

export default ThisExpression


