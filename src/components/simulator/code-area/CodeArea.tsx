/* eslint-disable */

import React, { useRef, useEffect, RefObject } from "react"
import { ESNode } from "hermes-parser"
import * as ESTree from "estree"
import { useSimulatorStore } from "@/hooks/useSimulatorStore"
import { useExecStep } from "@/hooks/useExecStep"
import {
    getNodeDecoration,
    getNodeContext,
    getBaseType,
    baseClassNames,
    buildClassName,
} from "@/configs/ast-render.config"

// Import node components
import {
    IdentifierRead,
    Literal,
    ThisExpression as ThisExpressionNode,
    Super as SuperNode,
    ArrayExpression as ArrayExpressionNode,
    ObjectExpression as ObjectExpressionNode,
    MemberExpression as MemberExpressionNode,
    BinaryExpression as BinaryExpressionNode,
    UnaryExpression as UnaryExpressionNode,
    UpdateExpression as UpdateExpressionNode,
    ConditionalExpression as ConditionalExpressionNode,
    AssignmentExpression as AssignmentExpressionNode,
    CallExpression as CallExpressionNode,
    NewExpression as NewExpressionNode,
    ArrowFunctionExpression as ArrowFunctionExpressionNode,
    EmptyStatement as EmptyStatementNode,
    BlockStatement as BlockStatementNode,
    VariableDeclaration as VariableDeclarationNode,
    FunctionDeclaration as FunctionDeclarationNode,
    ReturnStatement as ReturnStatementNode,
    ThrowStatement as ThrowStatementNode,
    TryStatement as TryStatementNode,
    IfStatement as IfStatementNode,
    ForStatement as ForStatementNode,
    ClassDeclaration as ClassDeclarationNode,
    MethodDefinition as MethodDefinitionNode,
    PropertyDefinition as PropertyDefinitionNode,
} from "./nodes"

// ----- Utility Functions -----
const parensSetOf = (tokens: any[]) => {
    const parens = new Set<number>()
    if (tokens) {
        tokens.forEach(({ value, range }) => {
            if (value === "(") {
                parens.add(range[1])
            }
        })
    }
    return parens
}

// ----- Component Props -----
interface CodeAreaProps {
    fromAstOf?: string
    parent?: any
    parens?: any
    debug?: boolean
}

// ----- Statement Component -----
const Statement = ({ st, parent, parens }: { st: ESNode; parent: ESNode; parens: Set<number> }) => {
    const stRef = useRef<HTMLDivElement | HTMLSpanElement>(null)
    const { isExecuting: isExecutingParent, isExecuted: isExecutedParent, isErrorThrown: isErrorThrownParent } = useExecStep(parent, stRef)
    const { isExecuting: isExecutingStatement, isExecuted: isExecutedStatement, isErrorThrown: isErrorThrownStatement } = useExecStep(st, stRef)
    const isExecuting = isExecutingParent || isExecutingStatement
    const isExecuted = isExecutedParent || isExecutedStatement
    const isErrorThrown = isErrorThrownParent || isErrorThrownStatement

    // Apply executing/executed classes to parent DOM element when condition is true
    useEffect(() => {
        const excludedParentTypes = ["BlockStatement", "Program"]
        if (st.type === "BlockStatement" && !excludedParentTypes.includes(parent.type)) {
            const parentElement = stRef.current?.parentElement
            if (parentElement) {
                parentElement.classList.remove("executing", "executed", "error-thrown")
                if (isExecuting) parentElement.classList.add("executing")
                if (isExecuted) parentElement.classList.add("executed")
                if (isErrorThrown) parentElement.classList.add("error-thrown")
            }
        }
    }, [isExecuting, isExecuted, isErrorThrown, st.type, parent.type])

    let component: React.ReactNode = <>UNKNOWN STATEMENT</>

    // BlockStatement
    if (st.type === "BlockStatement") {
        component = <BlockStatementNode node={st as any} parent={parent} parens={parens} Statement={Statement} />
    } else if (parent.type === "ArrowFunctionExpression") {
        component = <Expression expr={st} parens={parens} parent={st} />
    }

    // EmptyStatement
    if (st.type === "EmptyStatement") {
        component = <EmptyStatementNode node={st} parent={parent} parens={parens} />
    }

    // VariableDeclaration
    if (st.type === "VariableDeclaration") {
        component = <VariableDeclarationNode node={st as any} parent={parent} parens={parens} Expression={Expression} />
    }

    // ExpressionStatement
    if (st.type === "ExpressionStatement") {
        const exprSt = st as unknown as ESTree.ExpressionStatement
        component = <Expression expr={exprSt.expression as ESNode} parens={parens} parent={st} />
    }

    // FunctionDeclaration
    if (st.type === "FunctionDeclaration") {
        component = <FunctionDeclarationNode node={st as any} parent={parent} parens={parens} Statement={Statement} FnParamsDef={FnParamsDef} />
    }

    // ClassDeclaration
    if (st.type === "ClassDeclaration") {
        component = <ClassDeclarationNode node={st as any} parent={parent} parens={parens} Expression={Expression} ClassMember={ClassMember} />
    }

    // ReturnStatement
    if (st.type === "ReturnStatement") {
        component = <ReturnStatementNode node={st as any} parent={parent} parens={parens} Expression={Expression} />
    }

    // ThrowStatement
    if (st.type === "ThrowStatement") {
        component = <ThrowStatementNode node={st as any} parent={parent} parens={parens} Expression={Expression} />
    }

    // TryStatement
    if (st.type === "TryStatement") {
        component = <TryStatementNode node={st as any} parent={parent} parens={parens} Statement={Statement} />
    }

    // IfStatement
    if (st.type === "IfStatement") {
        component = <IfStatementNode node={st as any} parent={parent} parens={parens} Expression={Expression} Statement={Statement} />
    }

    // ForStatement
    if (st.type === "ForStatement") {
        component = <ForStatementNode node={st as any} parent={parent} parens={parens} Expression={Expression} Statement={Statement} />
    }

    // Get decoration directly from AST node type
    const context = getNodeContext(st as ESTree.Node, parent as ESTree.Node)
    const decoration = getNodeDecoration(st.type, context)
    const baseType = getBaseType(st.type, context)
    const title = decoration.tooltip
    const cheatSheetId = decoration.cheatSheetId
    const className = buildClassName(baseClassNames[baseType], decoration, { isExecuting, isExecuted, isErrorThrown })

    const excludedParentTypes = ["BlockStatement", "Program"]
    if (st.type === "BlockStatement" && !excludedParentTypes.includes(parent.type)) {
        return (
            <span
                ref={stRef as RefObject<HTMLSpanElement>}
                data-cheat-sheet-id={cheatSheetId}
                className={className + " contents [&>*:first-child]:ml-1"}
                title={title}
            >
                {component}
            </span>
        )
    }

    return (
        <div
            ref={stRef as RefObject<HTMLDivElement>}
            data-cheat-sheet-id={cheatSheetId}
            className={className}
            title={title}
        >
            {component}
        </div>
    )
}

// ----- Expression Component -----
const Expression = ({ expr, parent, parens }: { expr: ESNode; parent: ESNode; parens: Set<number> }) => {
    const exprRef = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(expr, exprRef)

    let component: React.ReactNode = <>UNKNOWN Expression</>
    let isOperator = false

    if (!expr) return null

    // Literal
    if (expr.type === "Literal") {
        component = <Literal node={expr as any} parent={parent} parens={parens} />
    }

    // Identifier (undefined)
    if (expr.type === "Identifier" && (expr as unknown as ESTree.Identifier).name === "undefined") {
        component = <>undefined</>
    }

    // ArrayExpression
    if (expr.type === "ArrayExpression") {
        component = <ArrayExpressionNode node={expr as any} parent={parent} parens={parens} Expression={Expression} />
    }

    // ObjectExpression
    if (expr.type === "ObjectExpression") {
        component = <ObjectExpressionNode node={expr as any} parent={parent} parens={parens} Expression={Expression} />
    }

    // ArrowFunctionExpression
    if (expr.type === "ArrowFunctionExpression") {
        component = <ArrowFunctionExpressionNode node={expr as any} parent={parent} parens={parens} Expression={Expression} Statement={Statement} FnParamsDef={FnParamsDef} />
    }

    // Identifier (read)
    if (expr.type === "Identifier") {
        component = <IdentifierRead node={expr as any} parent={parent} parens={parens} />
    }

    // ThisExpression
    if (expr.type === "ThisExpression") {
        component = <ThisExpressionNode node={expr} parent={parent} parens={parens} />
    }

    // Super
    if (expr.type === "Super") {
        component = <SuperNode node={expr} parent={parent} parens={parens} />
    }

    // MemberExpression
    if (expr.type === "MemberExpression") {
        component = <MemberExpressionNode node={expr as any} parent={parent} parens={parens} Expression={Expression} />
    }

    // UnaryExpression / BinaryExpression / LogicalExpression
    if ((expr as any).operator) {
        const opExpr = expr as any
        if (opExpr.argument) {
            isOperator = true
            component = <UnaryExpressionNode node={expr as any} parent={parent} parens={parens} Expression={Expression} />
        }
        if (opExpr.right && !opExpr.argument) {
            isOperator = true
            component = <BinaryExpressionNode node={expr as any} parent={parent} parens={parens} Expression={Expression} />
        }
    }

    // ConditionalExpression
    if (expr.type === "ConditionalExpression") {
        isOperator = true
        component = <ConditionalExpressionNode node={expr as any} parent={parent} parens={parens} Expression={Expression} />
    }

    // CallExpression
    if (expr.type === "CallExpression") {
        component = <CallExpressionNode node={expr as any} parent={parent} parens={parens} Expression={Expression} Statement={Statement} />
    }

    // NewExpression
    if (expr.type === "NewExpression") {
        component = <NewExpressionNode node={expr as any} parent={parent} parens={parens} Expression={Expression} />
    }

    // AssignmentExpression
    if (expr.type === "AssignmentExpression") {
        component = <AssignmentExpressionNode node={expr as any} parent={parent} parens={parens} Expression={Expression} />
    }

    // UpdateExpression
    if (expr.type === "UpdateExpression") {
        isOperator = true
        component = <UpdateExpressionNode node={expr as any} parent={parent} parens={parens} Expression={Expression} />
    }

    // Handle parentheses - check if it's an operator in a non-statement context
    let parenthized = false
    if (parens.has((expr as any).range?.[0])) {
        const parentBaseType = getBaseType(parent.type)
        if (isOperator && parentBaseType !== "statement") {
            parenthized = true
        }
        parens.delete((expr as any).range[0])
    }

    // Get decoration directly from AST node type
    const context = getNodeContext(expr as ESTree.Node, parent as ESTree.Node)
    const decoration = getNodeDecoration(expr.type, context)
    const baseType = getBaseType(expr.type, context)
    const title = decoration.tooltip
    const color = decoration.color
    const cheatSheetId = decoration.cheatSheetId
    const className = buildClassName(baseClassNames[baseType], decoration, { isEvaluating, isEvaluated, isErrorThrown })

    return (
        <span
            data-cheat-sheet-id={cheatSheetId}
            className={className}
            title={title}
            style={{ color: color }}
            ref={exprRef}
        >
            {parenthized && <span className="text-slate-500 font-bold">(</span>}
            <span className="ast-exp-content">{component}</span>
            {parenthized && <span className="text-slate-500 font-bold">)</span>}
        </span>
    )
}

// ----- FnParamsDef Component -----
const FnParamsDef = ({ params, parens }: { params: ESNode[]; parent: ESNode; parens: Set<number> }) => (
    <>
        <span className="text-slate-500 align-middle font-bold">(</span>
        {params.map((param, i) => {
            let component: React.ReactNode = null

            if (param.type === "Identifier") {
                component = <span className="text-blue-500">{(param as unknown as ESTree.Identifier).name}</span>
            }

            if (param.type === "AssignmentPattern") {
                const pattern = param as unknown as ESTree.AssignmentPattern
                const left = pattern.left as ESTree.Identifier
                component = (
                    <>
                        <span className="text-blue-600">{left.name}</span>
                        <span className="text-slate-500 font-bold">&nbsp;=&nbsp;</span>
                        <Expression expr={pattern.right as ESNode} parens={parens} parent={param} />
                    </>
                )
            }

            return (
                <span key={i} className="ast-fn-def-arg">
                    {component}
                    {i < params.length - 1 && <span className="align-middle font-bold">,&nbsp;</span>}
                </span>
            )
        })}
        <span className="text-slate-500 align-middle font-bold">)</span>
    </>
)

// ----- ClassMember Component -----
const ClassMember = ({ member, parent: parentProp, parens }: { member: ESNode; parent: ESNode; parens: Set<number> }) => {
    // Use parentProp for class member context
    const parent = parentProp || member
    const ref = useRef<HTMLDivElement>(null)
    const { isExecuting } = useExecStep(member, ref)

    let component: React.ReactNode = <>UNKNOWN CLASS MEMBER</>

    // MethodDefinition
    if (member.type === "MethodDefinition") {
        component = <MethodDefinitionNode node={member as any} parent={parent} parens={parens} Expression={Expression} Statement={Statement} FnParamsDef={FnParamsDef} />
    }

    // PropertyDefinition / ClassProperty
    if (member.type === "PropertyDefinition" || member.type === "ClassProperty") {
        component = <PropertyDefinitionNode node={member as any} parent={parent} parens={parens} Expression={Expression} />
    }

    // ClassMethod (Babel AST)
    if (member.type === "ClassMethod") {
        // Handle ClassMethod similar to MethodDefinition
        const cm = member as any
        let keyComponent: React.ReactNode = null
        if (cm.key?.type === "Identifier") {
            keyComponent = <span className="font-medium">{cm.key.name}</span>
        } else if (cm.key?.type === "Literal") {
            keyComponent = <span className="text-blue-500">{cm.key.raw}</span>
        } else if (cm.key?.type === "PrivateIdentifier") {
            keyComponent = <span className="font-medium text-purple-500">#{cm.key.name}</span>
        }

        component = (
            <div className="class-method py-1">
                {cm.static && <span className="keyword keyword-static mr-1 text-purple-600 font-medium">static</span>}
                {cm.kind === "get" && <span className="keyword keyword-getter mr-1 text-purple-600 font-medium">get</span>}
                {cm.kind === "set" && <span className="keyword keyword-setter mr-1 text-purple-600 font-medium">set</span>}
                {cm.computed ? (
                    <>
                        <span className="text-xl align-middle font-bold">[</span>
                        <Expression expr={cm.key} parens={parens} parent={parent} />
                        <span className="text-xl align-middle font-bold">]</span>
                    </>
                ) : keyComponent}
                <FnParamsDef params={cm.params} parens={parens} parent={parent} />
                <span className="text-xl align-middle font-bold ml-1">&#123;</span>
                {cm.body?.body?.length > 0 && (
                    <div className="ml-4 space-y-1">
                        {cm.body.body.map((st: ESNode, i: number) => (
                            <Statement key={i} st={st} parent={parent} parens={parens} />
                        ))}
                    </div>
                )}
                <span className="text-xl align-middle font-bold">&#125;</span>
            </div>
        )
    }

    // Statement inside class
    if (member.type?.endsWith("Statement")) {
        component = (
            <div className="class-statement py-1">
                <Statement st={member} parent={parent} parens={parens} />
            </div>
        )
    }

    // Declaration inside class
    if (member.type?.endsWith("Declaration")) {
        component = (
            <div className="class-declaration py-1">
                <Statement st={member} parent={parent} parens={parens} />
            </div>
        )
    }

    // Get decoration directly from AST node type
    const context = getNodeContext(member as ESTree.Node, parent as ESTree.Node)
    const decoration = getNodeDecoration(member.type, context)
    const baseType = getBaseType(member.type, context)
    const cheatSheetId = decoration.cheatSheetId
    const title = decoration.tooltip
    const className = buildClassName(baseClassNames[baseType], decoration, { isExecuting })

    return (
        <div
            ref={ref}
            data-cheat-sheet-id={cheatSheetId}
            className={className}
            title={title}
        >
            {component}
        </div>
    )
}

// ----- CodeArea Component -----
const CodeArea: React.FC<CodeAreaProps> = ({ parent: parentProp, parens: parensProp }) => {
    const { astOfCode, codeAreaRef, astError, simulatorError } = useSimulatorStore()

    if (!astOfCode || astError) {
        return (
            <div className="relative w-full h-full bg-slate-50 p-4">
                <pre className="text-red-500 font-mono text-sm">
                    {astError || "Code is not valid"}
                </pre>
            </div>
        )
    }

    if (astOfCode && simulatorError) {
        return (
            <div className="relative w-full h-full bg-slate-50 p-4">
                <pre className="text-red-500 font-mono text-sm">
                    {simulatorError}
                </pre>
            </div>
        )
    }

    const parens = parensProp || parensSetOf((astOfCode as any).tokens)
    const parent = parentProp || astOfCode

    const statements = astOfCode instanceof Array ? astOfCode : ((astOfCode as any).body ? (astOfCode as any).body : [astOfCode])

    return (
        <div className="w-full h-full overflow-auto" style={{ containerType: "inline-size" }}>
            <pre
                ref={codeAreaRef as unknown as React.RefObject<HTMLPreElement>}
                className="min-w-fit max-w-full font-mono space-y-1 lg:p-2"
            >
                {statements.map((statement: ESNode, i: number) => (
                    <Statement key={i} st={statement} parent={parent} parens={parens} />
                ))}
            </pre>
        </div>
    )
}

export default CodeArea
