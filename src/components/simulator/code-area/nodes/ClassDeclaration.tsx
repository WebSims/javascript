import React, { useRef } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import { useExecStep } from "@/hooks/useExecStep"
import { getNodeDecoration } from "@/configs/ast-render.config"

// Forward declaration for components
type ExpressionRenderer = React.FC<{ expr: ESNode; parent: ESNode; parens: Set<number> }>
type ClassMemberRenderer = React.FC<{ member: ESNode; parent: ESNode; parens: Set<number> }>

// ----- Types -----
export interface ClassDeclarationProps {
    node: ESTree.ClassDeclaration & ESNode
    parent: ESNode
    parens: Set<number>
    Expression: ExpressionRenderer
    ClassMember: ClassMemberRenderer
}

// ----- ClassDeclaration Component -----
const ClassDeclaration: React.FC<ClassDeclarationProps> = ({ 
    node, 
    parent, 
    parens, 
    Expression,
    ClassMember,
}) => {
    const ref = useRef<HTMLDivElement>(null)
    const { isExecuting, isExecuted, isErrorThrown } = useExecStep(node, ref)

    // Assign category for backwards compatibility
    ;(node as any).category = "statement.class"

    const decoration = getNodeDecoration("ClassDeclaration", "default")
    const body = node.body as ESTree.ClassBody & ESNode

    // Build execution state classes
    const stateClasses = [
        isExecuting && "executing",
        isExecuted && "executed",
        isErrorThrown && "error-thrown",
    ].filter(Boolean).join(" ")

    return (
        <div
            ref={ref}
            className={`${decoration.className} ${stateClasses}`}
            title={decoration.tooltip}
            data-cheat-sheet-id={decoration.cheatSheetId}
        >
            <span className="text-purple-600 font-medium">class</span>
            {node.id && (
                <span className="text-blue-600 font-medium mx-1">{node.id.name}</span>
            )}
            {node.superClass && (
                <>
                    <span className="text-purple-600 font-medium">extends</span>
                    <Expression expr={node.superClass as ESNode} parens={parens} parent={node} />
                </>
            )}
            <span className="text-slate-500 font-bold ml-1">&#123;</span>
            {body.body && body.body.length > 0 && (
                <div className="ml-4 space-y-1">
                    {body.body.map((member, i) => (
                        <ClassMember 
                            key={i} 
                            member={member as ESNode} 
                            parens={parens} 
                            parent={node} 
                        />
                    ))}
                </div>
            )}
            <span className="text-slate-500 font-bold">&#125;</span>
        </div>
    )
}

export default ClassDeclaration


