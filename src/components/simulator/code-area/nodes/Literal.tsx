import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration, getLiteralContext } from "@/configs/ast-render.config"
import { LiteralContext } from "@/types/ast-config"

// ----- Types -----
export interface LiteralProps {
    node: (ESTree.Literal & ESNode) & { literalType?: string; raw?: string }
    parent: ESNode
    parens: Set<number>
    context?: LiteralContext
}

// ----- Literal Boolean Component -----
export const LiteralBoolean: React.FC<LiteralProps> = ({ node }) => {
    const decoration = getNodeDecoration("Literal", "boolean")
    const raw = node.raw || String(node.value)

    return (
        <span 
            className={decoration.className}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {raw}
        </span>
    )
}

// ----- Literal Numeric Component -----
export const LiteralNumeric: React.FC<LiteralProps> = ({ node }) => {
    const decoration = getNodeDecoration("Literal", "numeric")
    const raw = node.raw || String(node.value)

    return (
        <span 
            className={decoration.className}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {raw}
        </span>
    )
}

// ----- Literal String Component -----
export const LiteralString: React.FC<LiteralProps> = ({ node }) => {
    const decoration = getNodeDecoration("Literal", "string")
    const raw = node.raw || JSON.stringify(node.value)

    return (
        <span 
            className={decoration.className}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {raw}
        </span>
    )
}

// ----- Literal Null Component -----
export const LiteralNull: React.FC<LiteralProps> = ({ node }) => {
    const decoration = getNodeDecoration("Literal", "null")

    return (
        <span 
            className={decoration.className}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            null
        </span>
    )
}

// ----- Literal Regex Component -----
export const LiteralRegex: React.FC<LiteralProps> = ({ node }) => {
    const decoration = getNodeDecoration("Literal", "regex")
    const raw = node.raw || String(node.value)

    return (
        <span 
            className={decoration.className}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {raw}
        </span>
    )
}

// ----- Literal BigInt Component -----
export const LiteralBigInt: React.FC<LiteralProps> = ({ node }) => {
    const decoration = getNodeDecoration("Literal", "bigint")
    const raw = node.raw || String(node.value)

    return (
        <span 
            className={decoration.className}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {raw}
        </span>
    )
}

// ----- Main Literal Component -----
const Literal: React.FC<LiteralProps> = (props) => {
    const { node, parent, context } = props
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(node, ref)

    // Determine literal type from node
    const literalContext = context || node.literalType as LiteralContext || getLiteralContext(node)

    // Assign category for backwards compatibility
    ;(node as any).category = `expression.data.${literalContext}`

    const decoration = getNodeDecoration("Literal", literalContext)
    const raw = node.raw || String(node.value)

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
            {raw}
        </span>
    )
}

export default Literal

