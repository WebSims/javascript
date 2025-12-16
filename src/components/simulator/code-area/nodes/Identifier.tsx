import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useNodeData } from "@/hooks/useNodeData"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"
import { IdentifierContext } from "@/types/ast-config"

// ----- Types -----
export interface IdentifierProps {
    node: ESTree.Identifier & ESNode
    parent: ESNode
    parens: Set<number>
    context?: IdentifierContext
}

// ----- Identifier Read Component -----
// Used when reading a variable value: console.log(x)
export const IdentifierRead: React.FC<IdentifierProps> = ({ node, parent }) => {
    const ref = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, wasEvaluated, evaluatedValue } = useNodeData(node, ref)

    // Show evaluated state if currently evaluated OR was evaluated in a previous step
    const showEvaluated = isEvaluated || wasEvaluated

    const decoration = getNodeDecoration("Identifier", "read")

    return (
        <span
            ref={ref}
            className={`relative inline-flex flex-col items-center ${isEvaluating ? "evaluating" : ""} ${isEvaluated ? "evaluated" : ""}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {/* Evaluated value badge - shown above the name when evaluated */}
            {showEvaluated && evaluatedValue && (
                <span
                    className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-emerald-700"
                    title={`Evaluated to: ${evaluatedValue.display}`}
                >
                    {evaluatedValue.display}
                </span>
            )}

            {/* Variable name with strikethrough when evaluated */}
            <span
                className={`relative ${decoration.className} ${showEvaluated ? "after:absolute after:left-0 after:top-1/2 after:h-0.5 after:w-full after:-translate-y-1/2 after:bg-emerald-500" : ""}`}
                style={decoration.color ? { color: decoration.color } : undefined}
            >
                {node.name}
            </span>
        </span>
    )
}

// ----- Identifier Write Component -----
// Used when writing to a variable: x = 5
export const IdentifierWrite: React.FC<IdentifierProps> = ({ node, parent }) => {
    const { isExecuting } = useExecStep(parent.type === "VariableDeclaration" 
        ? (parent as any).declarations[0].id 
        : (parent as any).left
    )

    const decoration = getNodeDecoration("Identifier", "write")

    return (
        <span 
            className={`${decoration.className} ${isExecuting ? "executing" : ""}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {node.name}
        </span>
    )
}

// ----- Identifier Declaration Component -----
// Used in variable declarations: let x
export const IdentifierDeclaration: React.FC<IdentifierProps> = ({ node, parent }) => {
    const { isExecuting } = useExecStep(parent.type === "VariableDeclaration" 
        ? (parent as any).declarations[0].id 
        : node
    )

    const decoration = getNodeDecoration("Identifier", "declaration")

    return (
        <span 
            className={`${decoration.className} ${isExecuting ? "executing" : ""}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {node.name}
        </span>
    )
}

// ----- Identifier Parameter Component -----
// Used for function parameters: function(a)
export const IdentifierParameter: React.FC<IdentifierProps> = ({ node }) => {
    const decoration = getNodeDecoration("Identifier", "parameter")

    return (
        <span 
            className={decoration.className}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {node.name}
        </span>
    )
}

// ----- Identifier Function Name Component -----
// Used for function names: function foo()
export const IdentifierFunctionName: React.FC<IdentifierProps> = ({ node }) => {
    const decoration = getNodeDecoration("Identifier", "functionName")

    return (
        <span 
            className={`ast-exp-fn-name ${decoration.className}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {node.name}
        </span>
    )
}

// ----- Identifier Class Name Component -----
// Used for class names: class Foo
export const IdentifierClassName: React.FC<IdentifierProps> = ({ node }) => {
    const decoration = getNodeDecoration("Identifier", "className")

    return (
        <span 
            className={`font-medium mx-1 ${decoration.className}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {node.name}
        </span>
    )
}

// ----- Identifier Property Key Component -----
// Used for property keys: { name: value }
export const IdentifierPropertyKey: React.FC<IdentifierProps> = ({ node }) => {
    const decoration = getNodeDecoration("Identifier", "propertyKey")

    return (
        <span 
            className={`align-middle ${decoration.className}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {node.name}
        </span>
    )
}

// ----- Identifier Method Name Component -----
// Used for method names in classes
export const IdentifierMethodName: React.FC<IdentifierProps> = ({ node }) => {
    const decoration = getNodeDecoration("Identifier", "methodName")

    return (
        <span 
            className={`font-medium ${decoration.className}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            {node.name}
        </span>
    )
}

// ----- Identifier Undefined Component -----
// Special case for "undefined" identifier which is a data literal
export const IdentifierUndefined: React.FC<IdentifierProps> = ({ node, parent }) => {
    // Assign category for backwards compatibility
    ;(node as any).category = "expression.data.undefined"

    const decoration = getNodeDecoration("Literal", "undefined")

    return (
        <span 
            className={decoration.className}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            undefined
        </span>
    )
}

// ----- Main Identifier Component -----
// Determines context and renders appropriate sub-component
const Identifier: React.FC<IdentifierProps> = (props) => {
    const { node, context } = props

    // Special case: undefined identifier is a data literal
    if (node.name === "undefined") {
        return <IdentifierUndefined {...props} />
    }

    // Use provided context or default to "read"
    const resolvedContext = context || "read"

    switch (resolvedContext) {
        case "read":
            return <IdentifierRead {...props} />
        case "write":
            return <IdentifierWrite {...props} />
        case "declaration":
            return <IdentifierDeclaration {...props} />
        case "parameter":
            return <IdentifierParameter {...props} />
        case "functionName":
            return <IdentifierFunctionName {...props} />
        case "className":
            return <IdentifierClassName {...props} />
        case "propertyKey":
            return <IdentifierPropertyKey {...props} />
        case "methodName":
            return <IdentifierMethodName {...props} />
        default:
            return <IdentifierRead {...props} />
    }
}

export default Identifier

