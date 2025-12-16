import React from "react"
import { ESNode } from "hermes-parser"
import { getNodeDecoration } from "@/configs/ast-render.config"

// ----- Types -----
export interface EmptyStatementProps {
    node: ESNode
    parent: ESNode
    parens: Set<number>
}

// ----- EmptyStatement Component -----
const EmptyStatement: React.FC<EmptyStatementProps> = ({ node }) => {
    // Assign category for backwards compatibility
    ;(node as any).category = "statement.expression"

    const decoration = getNodeDecoration("EmptyStatement", "default")

    return (
        <span 
            className={`text-slate-500 font-bold ${decoration.className}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            ;
        </span>
    )
}

export default EmptyStatement


