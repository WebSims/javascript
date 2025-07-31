/* eslint-disable */

import React, { useRef } from "react"
import * as _ from 'lodash'
import { useSimulatorStore } from "@/hooks/useSimulatorStore"
import { useExecStep } from "@/hooks/useExecStep"

// import * as ts from "typescript";
// const ast = ts.createSourceFile("temp.ts", codeStr, ts.ScriptTarget.Latest);

// Parsers:
// flow & typescript: fault tolerant 👍
// hermes-parser: nicer errors 👍 (expecting X instead of unexpected token)
// typescript: no operator as string 👎
// flow & typescript: no literal type as string 👎
// hermes: no parens 👎 (have to use tokens to know about them)

const parensSetOf = tokens => {
    const parens = new Set() // Set of starting locations of parenthized expressions
    if (tokens) {
        tokens.forEach(({ value, range }) => {
            if (value == '(') {
                parens.add(range[1])
            }
        })
    }
    return parens
}

const colorPalletes = [
    // canva  [hotPint, tiffanyBlue, mint, yellow]
    ["#FFAEBC", "#A0E7E5", "#B4F8C8", "#FBE7C6"],
    // Highlight Color Text [red, yellow, brown, green, cyan]
    ['#ff00aa', '#f8ff00', '#a41a1a', '#10ff00', '#00ffd9'],
    // Highlighter Colors [yellow, orange, green, blue, magenta]
    ['#fdff00', '#ff9a00', '#00ff04', '#00c5ff', '#ff00a7'],
    // Highlight mild [red, orange, yellow, cyan, blue]
    ['#fdb9c9', '#ffdcbe', '#f6f3b5', '#bbf6f3', '#a7e0f4'],
    // highlighter pastel [red, yelow, green, blue, purple]
    ['#ff9fae', '#fde995', '#a6e1c5', '#a7e0f6', '#e1a7fb'],
    // highlighters [lime, green, cyan, magenta, purple]
    ['#e3ff00', '#56ff00', '#00f9ff', '#ff00db', '#bd00ff'],
    // Highlighter Fun [yellow, green, magenta, cyan, purple]
    ['#f0ff00', '#22ff00', '#ff00db', '#04dfff', '#b000ff'],
    // Highlighter x Co [magenta, cyan, green, purple, yellow]
    ['#ff659f', '#67dfff', '#83f18d', '#b581fe', '#fcf151'],
    // Highlight [cyan, yellow, gold, black, gray]
    ['#52e2ee', '#ecfd63', '#f2e030', '#333333', '#dbdbdb'],
]

const colorPallete = colorPalletes[2]

export const decorations = {
    statement: {
        classN: "bg-slate-50 rounded-md p-2 [&:has(div:hover)]:bg-slate-50 hover:bg-blue-50 transition-colors duration-150",
        expression: { tooltip: "Expression Evaluation Statement", cheatSheetId: "st-exp", classN: "text-slate-700" },
        declaration: { tooltip: "Variable declaration Statement", cheatSheetId: "st-dec", classN: "text-slate-700" },
        block: { tooltip: "Block Statement", cheatSheetId: "st-block", classN: "text-slate-700" },
        return: { tooltip: "Return Statement", cheatSheetId: "st-flow-return", classN: "text-purple-600" },
        throw: { tooltip: "Throw Statement", cheatSheetId: "st-flow-throw", classN: "text-red-600" },
        class: { tooltip: "Class Declaration", cheatSheetId: "st-dec-class", classN: "text-blue-600" },
        try: { tooltip: "Try Statement", cheatSheetId: "st-error-trycatch", classN: "text-green-600" },
        catch: { tooltip: "Catch Clause", cheatSheetId: "st-error-trycatch", classN: "text-red-600" },
        finally: { tooltip: "Finally Clause", cheatSheetId: "st-error-trycatchfinally", classN: "text-green-600" },
        conditional: {
            if: { tooltip: "If Statement", cheatSheetId: "st-cond-if", classN: "text-blue-600" },
            else: { tooltip: "Else Statement", cheatSheetId: "st-cond-else", classN: "text-red-600" },
        },
        loop: {
            for: { tooltip: "For Loop", cheatSheetId: "st-loop-for-3statements", classN: "text-green-600" },
        },
        UNKNOWN: { tooltip: "UNKNOWN Statement", classN: "bg-orange-400 hover:bg-orange-500" },
    },
    expression: {
        classN: "ast-exp inline-block align-middle",
        data: {
            classN: "ast-exp-data",
            boolean: { tooltip: "Data: Literal (boolean)", cheatSheetId: "data-boolean", classN: "text-emerald-600" },
            numeric: { tooltip: "Data: Literal (number)", cheatSheetId: "data-number", classN: "text-blue-600" },
            string: { tooltip: "Data: Literal (string)", cheatSheetId: "data-string", classN: "text-orange-600" },
            null: { tooltip: "Data: Literal (null)", cheatSheetId: "data-null", classN: "text-slate-500" },
            undefined: { tooltip: "Data: Literal (undefined)", cheatSheetId: "data-undefined", classN: "text-slate-500" },
            arr: { tooltip: "Data: NEW array", cheatSheetId: "data-array", classN: "text-slate-700" },
            obj: { tooltip: "Data: NEW object", cheatSheetId: "data-object", classN: "text-slate-700" },
            fn: { tooltip: "Data: NEW anonymous function", cheatSheetId: "data-function", classN: "text-purple-600" },
            fnArr: { tooltip: "Data: NEW arrow function", cheatSheetId: "data-arrow", classN: "display-unset text-purple-600" },
            fnArrImplicit: { tooltip: "Data: NEW arrow function", cheatSheetId: "data-arrow", classN: "text-purple-600" },
        },
        read: {
            classN: "ast-exp-read",
            var: { tooltip: "Read variable", cheatSheetId: "exp-read-var", classN: "text-blue-600", color: colorPallete[4] },
            prop: { tooltip: "Read property of object", cheatSheetId: "exp-read-prop-static", classN: "text-blue-600", color: colorPallete[3] },
            expr: { tooltip: "Read property of object (by expression)", cheatSheetId: "exp-read-prop-dynamic", color: colorPallete[1] },
        },
        write: {
            classN: "ast-exp-write",
            var: { tooltip: "Set variable", cheatSheetId: "exp-write-var", classN: "text-blue-600" },
            prop: { tooltip: "Set property of object", cheatSheetId: "exp-write-prop", classN: "text-blue-600" },
            expr: { tooltip: "Set property of object (by expression)", cheatSheetId: "exp-write-prop-dynamic", classN: "text-blue-600" },
        },
        operator: {
            classN: "ast-exp-op",
            unary: { tooltip: "Operation (Unary Operator)", cheatSheetId: "exp-op-unary", classN: "ast-exp-op1" },
            binary: { tooltip: "Operation (Binary Operator)", cheatSheetId: "exp-op-binary", classN: "ast-exp-op2" },
            ternary: { tooltip: "Operation (Ternary Operator)", cheatSheetId: "exp-op-ternary", classN: "ast-exp-op3" },
            update: { tooltip: "Operation (Update Operator)", cheatSheetId: "exp-op-update", classN: "ast-exp-op4" },
        },
        call: { tooltip: "Function call", cheatSheetId: "exp-func", classN: "" },
        new: { tooltip: "Constructor call", cheatSheetId: "exp-new", classN: "" },
        UNKNOWN: { tooltip: "UNKNOWN Expression", classN: "bg-orange-400 hover:bg-orange-500" },
    },
    class: {
        classN: "bg-slate-50 rounded-md p-2 [&:has(div:hover)]:bg-slate-50 hover:bg-blue-50 transition-colors duration-150",
        property: { tooltip: "Class Property", cheatSheetId: "class-property", classN: "" },
        method: { tooltip: "Class Method", cheatSheetId: "class-method", classN: "" },
        UNKNOWN: { tooltip: "UNKNOWN Class", classN: "bg-orange-400 hover:bg-orange-500" },
    }
}

interface CodeAreaProps {
    fromAstOf?: string
    parent?: any
    parens?: any
    debug?: boolean
}

const EmptyStatement = () => (
    <span className="text-slate-500 font-bold">;</span>
)

const Statement = ({ st, parent, parens }) => {
    const stRef = useRef<HTMLDivElement | HTMLSpanElement>(null)
    const { isExecuting: isExecutingParent, isExecuted: isExecutedParent, isErrorThrown: isErrorThrownParent } = useExecStep(parent, stRef)
    const { isExecuting: isExecutingStatement, isExecuted: isExecutedStatement, isErrorThrown: isErrorThrownStatement } = useExecStep(st, stRef)
    const isExecuting = isExecutingParent || isExecutingStatement
    const isExecuted = isExecutedParent || isExecutedStatement
    const isErrorThrown = isErrorThrownParent || isErrorThrownStatement

    let component = <>UNKNWON STATEMENT</>;
    let cheatSheetId

    if (st.type == "BlockStatement") {
        st.category = parent.category
        component = <BlockStatement st={st} parent={parent} parens={parens} />
    } else if (parent.type == "ArrowFunctionExpression") {
        st.category = "expression.data.fnArrImplicit"
        component = <Expression expr={st} parens={parens} parent={st} />
    }

    // EmptyStatement
    if (st.type == "EmptyStatement") {
        st.category = "statement.expression"
        cheatSheetId = 'st-exp-useless'
        component = <EmptyStatement />
    }

    // VariableDeclaration kind:string declarations:VariableDeclarator[]
    // VariableDeclarator init:expr id:Identifier
    if (st.type == "VariableDeclaration") {
        const { kind, declarations } = st
        const { init, id } = declarations[0]
        st.category = "statement.declaration"
        if (init) {
            cheatSheetId = 'st-dec-assign'
            component = <Def defBy={kind} name={id.name} setBy="=" setTo={init} parens={parens} parent={st} />
        } else {
            cheatSheetId = 'st-dec-var'
            component = <Def defBy={kind} name={id.name} setBy="" setTo={init} parens={parens} parent={st} />
        }
    }

    // ExpressionStatement expression:expr
    if (st.type == "ExpressionStatement") {
        st.category = "statement.expression"
        cheatSheetId = [
            "CallExpression", "AssignmentExpression", "UpdateExpression",
            "NewExpression", "AwaitExpression", "YieldExpression",
            "UnaryExpression" // need further check for void/delete
        ].includes(st.expression.type) ? 'st-exp-useful' : 'st-exp-useless'
        component = <Expression expr={st.expression} parens={parens} parent={st} />
    }

    // FunctionDeclaration async:bool id:Identifier params:[] body:{BlockStatement body:[st]}
    if (st.type == "FunctionDeclaration") {
        st.category = "statement.declaration"
        component = <NewFn async={st.async} name={st.id.name} params={st.params} code={st.body} parens={parens} parent={st} />
    }

    // ClassDeclaration id:Identifier superClass:Identifier|null body:{ClassBody body:[MethodDefinition|PropertyDefinition]}
    if (st.type == "ClassDeclaration") {
        st.category = "statement.class"
        component = <NewClass name={st.id.name} superClass={st.superClass} body={st.body} parens={parens} parent={st} />
    }

    // ReturnStatement argument:expr
    if (st.type == "ReturnStatement") {
        st.category = "statement.return"
        component = <ReturnStatement expr={st.argument} parens={parens} parent={st} />
    }

    // ThrowStatement argument:expr
    if (st.type == "ThrowStatement") {
        st.category = "statement.throw"
        component = <ThrowSt expr={st.argument} parens={parens} parent={st} />
    }

    // TryStatement block:BlockStatement handler:CatchClause|null finalizer:BlockStatement|null
    if (st.type == "TryStatement") {
        st.category = "statement.try"
        component = <TryStatement st={st} parent={parent} parens={parens} />
    }

    if (st.type == "IfStatement") {
        st.category = parent.type === "IfStatement" ? "statement.conditional.else" : "statement.conditional.if"
        component = <IfStatement st={st} parent={parent} parens={parens} />
    }

    if (st.type == "ForStatement") {
        st.category = "statement.loop.for"
        component = <ForStatement st={st} parent={parent} parens={parens} />
    }


    const decoratorObject = _.get(decorations, st.category || "statement.UNKNOWN")
    const title = decoratorObject.tooltip
    cheatSheetId = cheatSheetId || decoratorObject.cheatSheetId
    const className = (st.category || "statement.UNKNOWN").split('.').map((__, i, all) =>
        _.get(decorations, all.slice(0, i + 1).join('.')).classN || ''
    ).join(' ') + (isExecuting ? ' executing' : '') + (isExecuted ? ' executed' : '') + (isErrorThrown ? ' error-thrown' : '')

    if (st.type === "BlockStatement") {
        return <span
            ref={stRef}
            data-cheat-sheet-id={cheatSheetId}
            className={className}
            title={title}
        >{component}</span>
    }

    return <div
        ref={stRef}
        data-cheat-sheet-id={cheatSheetId}
        className={className}
        title={title}
    >{component}</div>
}

const Def = ({ defBy, name, setBy, setTo, parens, parent }) => {
    return <>
        <span className="keyword keyword-prefix keyword-def">{defBy}</span>
        <WriteVar name={name} setBy={setBy} setTo={setTo} parent={parent} parens={parens} />
    </>
}

// const SReturn = ({ expr }) => (
//   <div className="statement">return {<Expression {...expr} />}</div>
// )

const Expression = ({ expr, parent, parens }: { expr: any, parent: any, parens: any }) => {
    const exprRef = useRef<HTMLSpanElement>(null)
    const { isEvaluating, isEvaluated, isErrorThrown } = useExecStep(expr, exprRef)

    let component = <>UNKNOWN Expression</>

    // Guard against null or undefined expr
    if (!expr) {
        return
    }

    // Literal literalType:string raw:string
    if (expr.type == "Literal") {
        const { literalType, raw } = expr
        expr.category = "expression.data." + literalType
        component = <>{raw}</>
    }

    // Identifier name:'undefined'
    if (expr.type == "Identifier" && expr.name == "undefined") {
        expr.category = "expression.data.undefined"
        component = <>undefined</>
    }

    // ArrayExpression elements:expr[]
    if (expr.type == "ArrayExpression") {
        expr.category = "expression.data.arr"
        component = <NewArr items={expr.elements} parens={parens} parent={expr} />
    }

    // ObjectExpression properties:Property[]
    if (expr.type == "ObjectExpression") {
        expr.category = "expression.data.obj"
        component = <NewObj props={expr.properties} parens={parens} parent={expr} />
    }

    // ArrowFunctionExpression params:[] body:expr|{BlockStatement body:[st]} async:bool expression:bool
    if (expr.type == "ArrowFunctionExpression") {
        if (expr.body.type == "BlockStatement") {
            expr.category = "expression.data.fnArr"
        } else {
            expr.category = "expression.data.fnArrImplicit"
        }
        component = <NewFnArrow async={expr.async || false} params={expr.params} code={expr.body} parens={parens} parent={expr} />
    }

    // Identifier name:string
    if (expr.type == "Identifier") {
        expr.category = "expression.read.var"
        component = <ReadVar name={expr.name} />
    }

    // ThisExpression
    if (expr.type == "ThisExpression") {
        expr.category = "expression.read.prop"
        component = <span className="text-purple-600 font-medium">this</span>
    }

    // SuperExpression
    if (expr.type == "Super") {
        expr.category = "expression.read.prop"
        component = <span className="text-purple-600 font-medium">super</span>
    }

    // MemberExpression object:expr property:expr computed:bool
    if (expr.type == "MemberExpression") {
        const { object, property, computed } = expr
        if (computed) {
            expr.category = "expression.read.expr"
            component = <ReadIndex expr={property} of={object} parens={parens} parent={expr} />
        } else {
            expr.category = "expression.read.prop"
            component = <ReadProp name={property.name} of={object} parens={parens} parent={expr} />
        }
    }

    // UnaryExpression operator:string argument:expr
    // XXXXExpression operator:string left:expr right:exp
    if (expr.operator) {
        const { operator, argument, left, right } = expr
        if (argument) {
            expr.category = "expression.operator.unary"
            component = <OperatorUnary operator={operator} operand={argument} parens={parens} parent={expr} />
        }
        if (right) {
            expr.category = "expression.operator.binary"
            component = <OperatorBinary {...{ operator, left, right }} parens={parens} parent={expr} />
        }
    }

    // ConditionalExpression test:exp alternate:exp consequent:exp
    if (expr.type == "ConditionalExpression") {
        const { test, alternate, consequent } = expr
        expr.category = "expression.operator.ternary"
        component = <OperatorTernary cond={test} truthy={consequent} falsy={alternate} parens={parens} parent={expr} />
    }

    // CallExpression callee:expr arguments:expr[]
    if (expr.type == "CallExpression") {
        expr.category = "expression.call"
        component = <Call expr={expr} args={expr.arguments} parens={parens} parent={expr} />
    }

    // NewExpression callee:expr arguments:expr[]
    if (expr.type == "NewExpression") {
        expr.category = "expression.new"
        component = <NewConstructor expr={expr.callee} args={expr.arguments} parens={parens} parent={expr} />
    }

    if (expr.type == "AssignmentExpression") {
        const { left, right } = expr
        if (left.type === "Identifier") {
            expr.category = "expression.write.var"
            component = <WriteVar name={left.name} setBy={expr.operator} setTo={right} parent={expr} parens={parens} />
        } else {
            expr.category = "expression.write.prop"
            component = <WriteProp of={left} setBy={expr.operator} setTo={right} parent={expr} parens={parens} />
        }
    }

    if (expr.type === 'UpdateExpression') {
        expr.category = "expression.operator.update"
        component = <UpdateExpression prefix={expr.prefix} operator={expr.operator} argument={expr.argument} parens={parens} parent={expr} />
    }

    // console.log('rendering:', { expr, range0: expr.range[0], parenthized: expr.parenthized, parens: [...parens] })
    if (parens.has(expr.range[0])) {
        // console.log('exp has paren:', {expr, parent: expr.parent })
        // console.log('exp has paren:', { isOp: expr.category.includes("operator"),
        // mainExp: !expr.parent.category.includes("statement") })
        if (expr.category?.includes("operator") && !parent.category?.includes("statement")) {
            expr.parenthized = true
        }
        parens.delete(expr.range[0])
        // console.log('had parens', { newParens: [...parens] })
    }

    const decoratorObject = _.get(decorations, expr.category || "expression.UNKNOWN")
    const title = decoratorObject.tooltip
    const color = decoratorObject.color
    const cheatSheetId = decoratorObject.cheatSheetId
    const className = (expr.category || "statement.UNKNOWN").split('.').map((__, i, all) =>
        _.get(decorations, all.slice(0, i + 1).join('.')).classN || ''
    ).join(' ') + (isEvaluating ? ' evaluating' : '') + (isEvaluated ? ' evaluated' : '') + (isErrorThrown ? ' error-thrown' : '')

    return <span
        data-cheat-sheet-id={cheatSheetId}
        className={className}
        title={title}
        style={{ color: color }}
        ref={exprRef}
    >
        {expr.parenthized && (
            <span className="text-slate-500 font-bold">(</span>
        )}
        <span className="ast-exp-content">{component}</span>
        {expr.parenthized && (
            <span className="text-slate-500 font-bold">)</span>
        )}
    </span>
}

const NewArr = ({ items, parent, parens }) => {
    // TODO: in loop, set parent of sub expressions (each item)
    return <span className="data new arr">
        <span className="text-xl align-middle font-bold mr-1">[</span>
        {items[0] && items.map((item, i) => {
            return <span key={i} className="ast-arr-item">
                <Expression expr={item} parens={parens} parent={parent} />
                {i < items.length - 1 && <span className="text-xl align-middle font-bold">,&nbsp;</span>}
            </span>
        })}
        <span className="text-xl align-middle font-bold ml-1">]</span>
    </span>
}

const NewObj = ({ props, parent, parens }) => {
    // TODO: in loop, set parent of sub expressions ( each computed name and each value)
    // Property key:expr value:expr computed:bool method:bool shorthand:bool
    return <span className="data new obj">
        <span className="text-xl align-middle font-bold mr-1">&#123;</span>
        {
            props.map((prop, i) => {
                let key
                if (prop.key.type == "Identifier") {
                    key = <span className="align-middle">{prop.key.name}</span>
                }
                if (prop.key.type == "Literal") {
                    key = <span className="text-blue-500">{prop.key.raw}</span>
                }
                return <span key={i} className="ast-obj-prop ">
                    {key}
                    <span className="align-middle font-bold">:&nbsp;</span>
                    <Expression expr={prop.value} parens={parens} parent={parent} />
                    {i < props.length - 1 &&
                        <span className="align-middle font-bold">,&nbsp;</span>
                    }
                </span>
            }
            )
        }
        <span className="text-xl align-middle font-bold ml-1">&#125;</span>
    </span>
}

const NewFnArrow = ({ async, params, code, parent, parens }) => {
    return (
        <>
            {async && <span className="keyword keyword-prefix keyword-async">async</span>}
            {/* {name && <span className="ast-exp-fn-name">{name}</span>} */}
            <FnParamsDef params={params} parens={parens} parent={parent} />
            <span className="align-middle font-bold">&nbsp;=&gt;&nbsp;</span>
            <Statement st={code} parent={parent} parens={parens} />
        </>
    )
}

const NewFn = ({ async, name, params, code, parent, parens }) => {
    return (
        <>
            {async && <span className="keyword keyword-prefix keyword-async">async</span>}
            <span className="keyword keyword-prefix keyword-fn">function</span>
            {name && <span className="ast-exp-fn-name">{name}</span>}
            <FnParamsDef params={params} parens={parens} parent={parent} />
            <Statement st={code} parent={parent} parens={parens} />
        </>
    )
}

const FnParamsDef = ({ params, parent, parens }) => (
    <>
        <span className="text-slate-500 align-middle font-bold">(</span>
        {params.map((param, i) => {
            let component

            // Identifier name:string
            if (param.type == "Identifier") {
                component = <span className="text-blue-500">{param.name}</span>
            }

            // AssignmentPattern left:Identifier right:exp
            if (param.type == "AssignmentPattern") {
                component = <WriteVar name={param.left.name} setBy="=" setTo={param.right} parent={param} parens={parens} />
            }

            return <span key={i} className="ast-fn-def-arg">
                {component}
                {i < params.length - 1 &&
                    <span className="align-middle font-bold">,&nbsp;</span>
                }
            </span>
        })}
        <span className="text-slate-500 align-middle font-bold">)</span>
    </>
)

const ReadVar = ({ name }) => (
    <span>{name}</span>
)

const ReadProp = ({ name, of, parent, parens }) => (
    <>
        <span className="ast-noundef">
            <Expression expr={of} parens={parens} parent={parent} />
        </span>
        <span className="align-middle font-bold">.</span>
        <span>{name}</span>
    </>
)

const ReadIndex = ({ expr, of, parent, parens }) => (
    <>
        <span className="ast-noundef">
            <Expression expr={of} parens={parens} parent={parent} />
        </span>
        <span className="text-xl align-middle font-bold">[</span>
        <Expression expr={expr} parens={parens} parent={parent} />
        <span className="text-xl align-middle font-bold">]</span>
    </>
)

const WriteVar = ({ name, setBy, setTo, parent, parens }) => {
    const { isExecuting: isIdExecuting } = useExecStep(parent.type === "VariableDeclaration" ? parent.declarations[0].id : parent.left)
    return (
        <>
            <span className={`text-blue-600 ${isIdExecuting ? 'executing' : ''}`}>{name}</span>
            <span className="text-slate-500 font-bold">&nbsp;{setBy}&nbsp;</span>
            <Expression expr={setTo} parens={parens} parent={parent} />
        </>
    )
}

const WriteProp = ({ of, setBy, setTo, parent, parens }) => {
    return (
        <>
            {/* <span className="ast-noundef"> */}

            {of.computed ? (
                <>
                    <Expression expr={of.object} parens={parens} parent={parent} />
                    <span className="text-xl align-middle font-bold">[</span>
                    <Expression expr={of.property} parens={parens} parent={parent} />
                    <span className="text-xl align-middle font-bold">]</span>
                </>
            ) : (
                <>
                    <Expression expr={of.object} parens={parens} parent={parent} />
                    <span className="text-slate-500 font-bold">.</span>
                    <span className="text-blue-600">{of.property.name}</span>
                </>
            )}
            <span className="text-slate-500 font-bold">&nbsp;{setBy}&nbsp;</span>
            <Expression expr={setTo} parens={parens} parent={parent} />
        </>
    )
}

const WriteIndex = ({ expr, of, setBy, setTo, parent, parens }) => (
    <>
        {/* <span className="ast-noundef"> */}
        <Expression expr={of} parens={parens} parent={parent} />
        <span className="text-slate-500 font-bold">[</span>
        <Expression expr={expr} parens={parens} parent={parent} />
        <span className="text-slate-500 font-bold">]</span>
        <span className="text-slate-500 font-bold">&nbsp;{setBy}&nbsp;</span>
        <Expression expr={setTo} parens={parens} parent={parent} />
    </>
)

const OperatorUnary = ({ operator, operand, parent, parens }) => {
    return (
        <>
            <span className="align-middle font-bold">{operator}&nbsp;</span>
            <Expression expr={operand} parens={parens} parent={parent} />
        </>
    )
}

const OperatorBinary = ({ operator, left, right, parent, parens }) => {
    const decoratorObject = _.get(decorations, parent.category || "expression.UNKNOWN")

    return (
        <>
            <Expression expr={left} parens={parens} parent={parent} />
            <span className="align-middle font-bold">&nbsp;{operator}&nbsp;</span>
            <Expression expr={right} parens={parens} parent={parent} />
        </>
    )
}

const OperatorTernary = ({ cond, truthy, falsy, parent, parens }) => {
    return (
        <>
            <Expression expr={cond} parens={parens} parent={parent} />
            <span className="text-slate-500 align-middle font-bold">?</span>
            <Expression expr={truthy} parens={parens} parent={parent} />
            <span className="text-slate-500 align-middle font-bold">:</span>
            <Expression expr={falsy} parens={parens} parent={parent} />
        </>
    )
}

const Call = ({ expr, args, parent, parens }) => {
    return <>
        <Expression expr={expr.callee} parens={parens} parent={parent} />
        <span className="text-slate-500 align-middle font-bold">(</span>
        {args.map((arg, i) => {
            return (
                <span key={`${arg.range[0]}-${arg.range[1]}`}>
                    <Expression expr={arg} parens={parens} parent={parent} />
                    {i < args.length - 1 &&
                        <span className="text-slate-500 align-middle font-bold">,</span>
                    }
                </span>
            )
        })}
        <span className="text-slate-500 align-middle font-bold">)</span>
    </>
}

const NewConstructor = ({ expr, args, parent, parens }) => {
    return <>
        <span className="keyword keyword-new text-purple-600 font-medium mr-1">new</span>
        <Expression expr={expr} parens={parens} parent={parent} />
        <span className="text-slate-500 align-middle font-bold">(</span>
        {args.map((arg, i) => {
            return <>
                <Expression key={i} expr={arg} parens={parens} parent={parent} />
                {i < args.length - 1 &&
                    <span className="text-slate-500 align-middle font-bold">,</span>
                }
            </>
        })}
        <span className="text-slate-500 align-middle font-bold">)</span>
    </>
}

const ReturnStatement = ({ expr, parens, parent }) => (
    <>
        <span className="text-purple-600 font-medium">return</span>
        {expr && (
            <>
                <span className="mx-1"></span>
                <Expression expr={expr} parens={parens} parent={parent} />
            </>
        )}
    </>
)

const ThrowSt = ({ expr, parens, parent }: { expr: any, parens: any, parent: any }) => (
    <>
        <span className="text-red-600 font-medium">throw</span>
        {expr && (
            <>
                <span className="mx-1"></span>
                <Expression expr={expr} parens={parens} parent={parent} />
            </>
        )}
    </>
)

const NewClass = ({ name, superClass, body, parens, parent }) => {
    return (
        <>
            <span className="text-purple-600 font-medium">class</span>
            <span className="text-blue-600 font-medium mx-1">{name}</span>
            {superClass && (
                <>
                    <span className="text-purple-600 font-medium">extends</span>
                    <Expression expr={superClass} parens={parens} parent={parent} />
                </>
            )}
            <span className="text-slate-500 font-bold ml-1">&#123;</span>
            {body.body && body.body.length > 0 && (
                <div className="ml-4 space-y-1">
                    {body.body.map((member, i) => (
                        <ClassMember key={i} member={member} parens={parens} parent={parent} />
                    ))}
                </div>
            )}
            <span className="text-slate-500 font-bold">&#125;</span>
        </>
    )
}

const MethodDefinition = ({ member, parens, parent }) => {
    let keyComponent = null
    if (member.key.type === 'Identifier') {
        keyComponent = <span className="font-medium">{member.key.name}</span>
    } else if (member.key.type === 'Literal') {
        keyComponent = <span className="text-blue-500">{member.key.raw}</span>
    } else if (member.key.type === 'PrivateIdentifier') {
        keyComponent = <span className="font-medium text-purple-500">#{member.key.name}</span>
    }

    // Constructor, Method, or Getter/Setter
    return (
        <>
            {member.static && <span className="keyword keyword-static mr-1 text-purple-600 font-medium">static</span>}
            {member.kind === 'get' && <span className="keyword keyword-getter mr-1 text-purple-600 font-medium">get</span>}
            {member.kind === 'set' && <span className="keyword keyword-setter mr-1 text-purple-600 font-medium">set</span>}
            {member.computed ? (
                <>
                    <span className="align-middle font-bold">[</span>
                    <Expression expr={member.key} parens={parens} parent={parent} />
                    <span className="align-middle font-bold">]</span>
                </>
            ) : keyComponent}
            <FnParamsDef params={member.value.params} parens={parens} parent={parent} />
            <span className="align-middle font-bold ml-1">&#123;</span>
            {member.value.body && member.value.body.body && member.value.body.body.length > 0 && (
                <div className="ml-4 space-y-1">
                    {member.value.body.body.map((st, i) => (
                        <Statement key={i} st={st} parent={parent} parens={parens} />
                    ))}
                </div>
            )}
            <span className="align-middle font-bold">&#125;</span>
        </>
    )
}

const ClassProperty = ({ member, parens, parent }) => {
    let keyComponent = null
    if (member.key.type === 'Identifier') {
        keyComponent = <span className="font-medium">{member.key.name}</span>
    } else if (member.key.type === 'Literal') {
        keyComponent = <span className="text-blue-500">{member.key.raw}</span>
    } else if (member.key.type === 'PrivateIdentifier') {
        keyComponent = <span className="font-medium text-purple-500">#{member.key.name}</span>
    }

    return (
        <>
            {member.static && <span className="keyword keyword-static mr-1 text-purple-600 font-medium">static</span>}
            {member.computed ? (
                <>
                    <span className="align-middle font-bold">[</span>
                    <Expression expr={member.key} parens={parens} parent={parent} />
                    <span className="align-middle font-bold">]</span>
                </>
            ) : keyComponent}
            {member.value && (
                <>
                    <span className="align-middle font-bold mx-1">=</span>
                    <Expression expr={member.value} parens={parens} parent={parent} />
                </>
            )}
            <span className="align-middle font-bold">;</span>
        </>
    )
}

const ClassMethod = ({ member, parens, parent }) => {
    let keyComponent = null
    if (member.type === 'Identifier') {
        keyComponent = <span className="font-medium">{member.name}</span>
    } else if (member.type === 'Literal') {
        keyComponent = <span className="text-blue-500">{member.raw}</span>
    } else if (member.type === 'PrivateIdentifier') {
        keyComponent = <span className="font-medium text-purple-500">#{member.name}</span>
    }

    return (
        <div className="class-method py-1">
            {member.static && <span className="keyword keyword-static mr-1 text-purple-600 font-medium">static</span>}
            {member.kind === 'get' && <span className="keyword keyword-getter mr-1 text-purple-600 font-medium">get</span>}
            {member.kind === 'set' && <span className="keyword keyword-setter mr-1 text-purple-600 font-medium">set</span>}
            {member.computed ? (
                <>
                    <span className="text-xl align-middle font-bold">[</span>
                    <Expression expr={member.key} parens={parens} parent={parent} />
                    <span className="text-xl align-middle font-bold">]</span>
                </>
            ) : keyComponent}
            <FnParamsDef params={member.value.params} parens={parens} parent={parent} />
            <span className="text-xl align-middle font-bold ml-1">&#123;</span>
            {member.value.body && member.value.body.body && member.value.body.body.length > 0 && (
                <div className="ml-4 space-y-1">
                    {member.value.body.body.map((st, i) => (
                        <Statement key={i} st={st} parent={parent} parens={parens} />
                    ))}
                </div>
            )}
            <span className="text-xl align-middle font-bold">&#125;</span>
        </div>
    )
}

const ClassMember = ({ member, parens, parent }) => {
    const { isExecuting } = useExecutingNodes()
    const executing = isExecuting(member)

    let component = <>UNKNOWN CLASS MEMBER</>

    // MethodDefinition: key:Identifier|Literal kind:string static:bool computed:bool value:FunctionExpression
    if (member.type === 'MethodDefinition') {
        member.category = "class.method"

        component = (
            <MethodDefinition
                member={member}
                parens={parens}
                parent={parent}
            />
        )
    }

    // PropertyDefinition (class fields): key:Identifier|Literal static:bool computed:bool value:Expression|null
    if (member.type === 'PropertyDefinition' || member.type === 'ClassProperty') {
        member.category = "class.property"
        component = (
            <ClassProperty
                member={member}
                parens={parens}
                parent={parent}
            />
        )
    }

    // ClassMethod: type:string key:Identifier body:BlockStatement params:[] static:bool
    if (member.type === 'ClassMethod') {
        member.category = "class.method"
        component = (
            <ClassMethod
                member={member}
                parens={parens}
                parent={parent}
            />
        )
    }

    // Try to handle any other member that could be a statement
    if (member.type && typeof member.type === 'string' && member.type.endsWith('Statement')) {
        component = (
            <div className="class-statement py-1">
                <Statement st={member} parent={parent} parens={parens} />
            </div>
        )
    }

    // Try to handle any other member that could be a declaration
    if (member.type && typeof member.type === 'string' && member.type.endsWith('Declaration')) {
        component = (
            <div className="class-declaration py-1">
                <Statement st={member} parent={parent} parens={parens} />
            </div>
        )
    }

    const cheatSheetId = _.get(decorations, member.category || "class.UNKNOWN")
    const title = _.get(decorations, member.category || "class.UNKNOWN").tooltip
    const className = (member.category || "class.UNKNOWN").split('.').map((__, i, all) =>
        _.get(decorations, all.slice(0, i + 1).join('.')).classN || ''
    ).join(' ') + (executing ? ' executing' : '')

    return <div
        data-cheat-sheet-id={cheatSheetId}
        className={className}
        title={title}
    >{component}</div>
}

const TryStatement = ({ st, parent, parens }: { st: any, parent: any, parens: any }) => {
    return (
        <div
            className="relative my-2"
            tabIndex={0}
            aria-label="Try statement block"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
            }}
        >
            <span className="keyword keyword-try text-blue-700 font-bold mr-2">try</span>
            <Statement st={st.block} parent={st} parens={parens} />
            {st.handler && (
                <>
                    <span className="keyword keyword-catch text-red-700 font-bold mr-2">catch</span>
                    <span className="text-blue-600">(
                        {st?.handler?.param?.name || ''}
                        )</span>
                    <Statement st={st.handler.body} parent={st} parens={parens} />
                </>
            )}
            {st.finalizer && (
                <TryCatchFinallyStatement st={st.finalizer} parent={st} parens={parens} />
            )}
        </div>
    )
}

const TryCatchFinallyStatement = ({ st, parent, parens }: { st: any, parent: any, parens: any }) => {
    parent.category = "statement.finally"
    return (
        <>
            <span className="keyword keyword-finally text-purple-700 font-bold mr-2">finally</span>
            <Statement st={st} parent={parent} parens={parens} />
        </>
    )
}

const IfStatement = ({ st, parent, parens }: { st: any, parent: any, parens: any }) => {
    return (
        <>
            <span className="keyword keyword-if text-blue-700 font-bold mr-2">if</span>
            <span className="text-slate-500 font-bold">(</span>
            <Expression expr={st.test} parens={parens} parent={parent} />
            <span className="text-slate-500 font-bold">)</span>
            <span className={`${st.consequent.body === undefined ? '[&>*:first-child]:inline-block' : ''}`}>
                <Statement st={st.consequent} parent={st} parens={parens} />
            </span>
            {
                st.alternate && (
                    <span className={`${st.consequent.body === undefined ? 'block' : ''}`}>
                        <span className="keyword keyword-else text-red-700 font-bold mr-2">else</span>
                        <span className="[&>*:first-child]:inline">
                            <Statement st={st.alternate} parent={st} parens={parens} />
                        </span>
                    </span>
                )
            }
        </>
    )
}

const ForStatement = ({ st, parent, parens }: { st: any, parent: any, parens: any }) => {
    return (
        <>
            <span className="keyword keyword-for text-green-700 font-bold mr-2">for</span>
            <span className="text-slate-500 font-bold">(</span>
            {st.init.type === "VariableDeclaration" ? (
                <span className="[&>*:first-child]:inline">
                    <Statement st={st.init} parens={parens} parent={parent} />
                </span>
            ) : (
                <span className="[&>*:first-child]:inline">
                    <Expression expr={st.init} parens={parens} parent={parent} />
                </span>
            )}

            <span className="text-slate-500 font-bold">;</span>
            <Expression expr={st.test} parens={parens} parent={parent} />
            <span className="text-slate-500 font-bold">;</span>
            <Expression expr={st.update} parens={parens} parent={parent} />
            <span className="text-slate-500 font-bold">)</span>
            <Statement st={st.body} parent={st} parens={parens} />
        </>
    )
}

const BlockStatement = ({ st, parent, parens }: { st: any, parent: any, parens: any }) => {
    return (
        <>
            <span className="text-slate-500 font-bold">&#123;</span>
            <div className="ml-6 border-l-2 border-blue-200 pl-4 my-1">
                {st && st.body && st.body.length > 0 && st.body.map((statement: any, i: number) => (
                    <Statement key={i} st={statement} parent={st} parens={parens} />
                ))}
            </div>
            <span className="text-slate-500 font-bold">&#125;</span>
        </>
    )
}

const UpdateExpression = ({ prefix, operator, argument, parent, parens }: {
    prefix: boolean,
    operator: string,
    argument: any,
    parent: any,
    parens: any
}) => {
    return (
        <>
            {prefix && <span className="align-middle font-bold">{operator}</span>}
            {argument.type === 'Identifier' ?
                <span className="inline-block p-2 text-blue-600">{argument.name}</span>
                :
                <Expression expr={argument} parens={parens} parent={parent} />
            }
            {!prefix && <span className="align-middle font-bold">{operator}</span>}
        </>
    )
}

const CodeArea: React.FC<CodeAreaProps> = ({ parent, parens, debug }) => {
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

    let isRoot = false

    if (!parens) {
        parens = parensSetOf(astOfCode.tokens)
        isRoot = true
    }
    if (!parent) {
        parent = astOfCode
    }

    const statements = astOfCode instanceof Array ? astOfCode : (astOfCode.body ? astOfCode.body : [astOfCode])

    return (
        <div className="w-full h-full overflow-auto">
            <pre
                ref={codeAreaRef}
                className="min-w-fit max-w-full font-mono space-y-1 p-2"
            >
                {statements.map((statement, i) => {
                    return <Statement key={i} st={statement} parent={parent} parens={parens} />
                })}
            </pre>
        </div>
    )
}

export default CodeArea