/* eslint-disable */

import React, { useEffect } from "react"
import * as hermesParser from "hermes-parser"
import * as _ from 'lodash'
import { useSimulatorStore } from "@/hooks/useSimulatorStore"

// import * as ts from "typescript";
// const ast = ts.createSourceFile("temp.ts", codeStr, ts.ScriptTarget.Latest);

// Parsers:
// flow & typescript: fault tolerant 👍
// hermes-parser: nicer errors 👍 (expecting X instead of unexpected token)
// typescript: no operator as string 👎
// flow & typescript: no literal type as string 👎
// hermes: no parens 👎 (have to use tokens to know about them)

const astOf = codeStr => hermesParser.parse(codeStr, { tokens: true })

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

const decorations = {
    statement: {
        classN: "ast-st",
        expression: { tooltip: "Expression Evaluation Statement", cheatSheetId: "st-exp", classN: "" },
        declaration: { tooltip: "Variable declaration Statement", cheatSheetId: "st-dec", classN: "" },
        UNKNOWN: { tooltip: "UNKNOWN Statement", classN: "bg-orange-500" },
    },
    expression: {
        classN: "ast-exp",
        data: {
            classN: "ast-exp-data",
            boolean: { tooltip: "Data: Literal (boolean)", cheatSheetId: "data-boolean", classN: "text-blue-500" },
            numeric: { tooltip: "Data: Literal (number)", cheatSheetId: "data-number", classN: "text-blue-500" },
            string: { tooltip: "Data: Literal (string)", cheatSheetId: "data-string", classN: "text-blue-500" },
            null: { tooltip: "Data: Literal (null)", cheatSheetId: "data-null", classN: "text-blue-500" },
            undefined: { tooltip: "Data: Literal (undefined)", cheatSheetId: "data-undefined", classN: "text-blue-500" },
            arr: { tooltip: "Data: NEW array", cheatSheetId: "data-array", classN: "" },
            obj: { tooltip: "Data: NEW object", cheatSheetId: "data-object", classN: "" },
            fn: { tooltip: "Data: NEW anonymous function", cheatSheetId: "data-function", classN: "" },
            fnArr: { tooltip: "Data: NEW arrow function", cheatSheetId: "data-arrow", classN: "" },
        },
        read: {
            classN: "ast-exp-read",
            var: { tooltip: "Read variable", cheatSheetId: "exp-read-var", classN: "", color: colorPallete[4] },
            prop: { tooltip: "Read property of object", cheatSheetId: "exp-read-prop", classN: "", color: colorPallete[3] },
            expr: { tooltip: "Read property of object (by expression)", color: colorPallete[1] },
        },
        write: {
            classN: "ast-exp-write",
            var: { tooltip: "Set variable", classN: "" },
            prop: { tooltip: "Set property of object", classN: "" },
            expr: { tooltip: "Set property of object (by expression)", classN: "" },
        },
        operator: {
            classN: "ast-exp-op",
            unary: { tooltip: "Operation (Unary Operator)", cheatSheetId: "exp-op-unary", classN: "" },
            binary: { tooltip: "Operation (Binary Operator)", cheatSheetId: "exp-op-binary", classN: "" },
            ternary: { tooltip: "Operation (Ternary Operator)", cheatSheetId: "exp-op-ternary", classN: "" },
        },
        call: { tooltip: "Function call", cheatSheetId: "exp-func", classN: "" },
        UNKNOWN: { tooltip: "UNKNOWN Expression", classN: "bg-orange-500" },
    },
}

interface CodeAreaProps {
    fromAstOf?: string
    parent?: any
    parens?: any
    debug?: boolean
}

const Statement = ({ st, parent, parens }) => {
    let component = <>UNKNWON STATEMENT</>;
    let cheatSheetId = "statement.UNKNOWN"

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
        cheatSheetId = 'st-dec-func'
        component = <NewFn async={st.async} name={st.id.name} args={st.params} code={st.body} parens={parens} parent={st} />
    }

    const title = _.get(decorations, st.category || "statement.UNKNOWN").tooltip
    const className = (st.category || "statement.UNKNOWN").split('.').map((__, i, all) =>
        _.get(decorations, all.slice(0, i + 1).join('.')).classN || ''
    ).join(' ')

    return <div data-cheat-sheet-id={cheatSheetId} className={className} title={title}>{component}</div>
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

const Expression = ({ fromAstOf, expr, parent, parens }) => {
    if (fromAstOf) {
        const ast = astOf(fromAstOf)
        expr = ast.body[0].expression
        parens = parensSetOf(ast.tokens)
    }

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
        expr.category = "expression.data.fnArr"
        component = <NewFnArrow async={expr.async || false} args={expr.params} code={expr.body} parens={parens} parent={expr} />
    }

    // Identifier name:string
    if (expr.type == "Identifier") {
        expr.category = "expression.read.var"
        component = <ReadVar name={expr.name} />
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

    // AssignmentExpression operator:string left:Identifier|MemberExpression right:expr
    // if (expr.type == "AssignmentExpression") {
    //     const { left, operator, right } = st.expression

    //     // Identifier name:string
    //     if (left.type == "Identifier") {
    //         expr.category = "expression.write.var"
    //         component = <WriteVar name={left.name} setBy={operator} setTo={right} />
    //     }

    //     // MemberExpression object:expr property:expr computed:bool
    //     if (left.type == "MemberExpression") {
    //         const { object, property, computed } = left
    //         if (computed) {
    //             expr.category = "expression.write.expr"
    //             component = <WriteIndex expr={property} of={object} setBy={operator} setTo={right} parens={parens} parent={expr} />
    //         } else {
    //             expr.category = "expression.write.prop"
    //             component = <WriteProp name={property.name} of={object} setBy={operator} setTo={right} parens={parens} parent={expr} />
    //         }
    //     }
    // }

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
        component = <Call expr={expr.callee} args={expr.arguments} parens={parens} parent={expr} />
    }

    // console.log('rendering:', { expr, range0: expr.range[0], parenthized: expr.parenthized, parens: [...parens] })
    if (parens.has(expr.range[0])) {
        // console.log('exp has paren:', {expr, parent: expr.parent })
        // console.log('exp has paren:', { isOp: expr.category.includes("operator"),
        // mainExp: !expr.parent.category.includes("statement") })
        if (expr.category.includes("operator") && !parent.category.includes("statement")) {
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
    ).join(' ')
    return <span data-cheat-sheet-id={cheatSheetId} className={className} title={title} style={{ color: color }}>
        {expr.parenthized &&
            <span className="punc punc-exp-group punc-open">(</span>
        }
        <span className="ast-exp-content">{component}</span>
        {expr.parenthized &&
            <span className="punc punc-exp-group punc-close">)</span>
        }
    </span>
}

const NewArr = ({ items, parent, parens }) => {
    // TODO: in loop, set parent of sub expressions (each item)
    return <span className="data new arr">
        <span className="punc punc-new-arr punc-open">[</span>
        {items[0] && items.map((item, i) => {
            return <span key={i} className="ast-arr-item">
                <Expression expr={item} parens={parens} parent={parent} />
                {i < items.length - 1 && <span className="punc punc-new-arr-item-sep punc-comma">,&nbsp;</span>}
            </span>
        })}
        <span className="punc punc-new-arr punc-close">]</span>
    </span>
}

const NewObj = ({ props, parent, parens }) => {
    // TODO: in loop, set parent of sub expressions ( each computed name and each value)
    // Property key:expr value:expr computed:bool method:bool shorthand:bool
    return <span className="data new obj">
        <span className="punc punc-new-obj punc-open">&#123;</span>
        {
            props.map((prop, i) => {
                let key
                if (prop.key.type == "Identifier") {
                    key = <span>{prop.key.name}</span>
                }
                if (prop.key.type == "Literal") {
                    key = <span className="text-blue-500">{prop.key.raw}</span>
                }
                return <span key={i} className="ast-obj-prop ">
                    {key}
                    <span className="punc punc-colon punc-new-obj-prop-sep">:&nbsp;</span>
                    <Expression expr={prop.value} parens={parens} parent={parent} />
                    {i < props.length - 1 &&
                        <span className="punc punc-comma punc-new-obj-prop-sep">,&nbsp;</span>
                    }
                </span>
            }
            )
        }
        <span className="punc punc-new-obj punc-close">&#125;</span>
    </span>
}

const NewFnArrow = ({ async, args, code, parent, parens }) => {
    let content;
    if (code.type == "BlockStatement") {
        content = <>
            <span className="punc punc-block punc-new-fn-block punc-open">&#123;<br /></span>
            {code.body && code.body.length > 0 &&
                <div className="ml-4">
                    {code.body.map((statement, i) =>
                        <Statement key={i} st={statement} parent={parent} parens={parens} />
                    )}
                </div>
            }
            <span className="punc punc-block punc-new-fn-block punc-close"><br />&#125;</span>
        </>
    } else {
        content = <Expression expr={code} parens={parens} parent={parent} />
    }
    return (
        <>
            {async && <span className="keyword keyword-prefix keyword-async">async</span>}
            {/* {name && <span className="ast-exp-fn-name">{name}</span>} */}
            <FnArgsDef args={args} parens={parens} parent={parent} />
            <span className="punc punc-arrow">&nbsp;=&gt;&nbsp;</span>
            {content}
        </>
    )
}

const NewFn = ({ async, name, args, code, parent, parens }) => {
    console.log(parent)
    return (
        <>
            {async && <span className="keyword keyword-prefix keyword-async">async</span>}
            <span className="keyword keyword-prefix keyword-fn">function</span>
            {name && <span className="ast-exp-fn-name">{name}</span>}
            <FnArgsDef args={args} parens={parens} parent={parent} />
            <span className="punc punc-block punc-new-fn-block punc-open">&#123;<br /></span>
            {code.body && code.body.length > 0 &&
                <div className="ml-4">
                    {code.body.map((statement, i) =>
                        <Statement key={i} st={statement} parent={parent} parens={parens} />
                    )}
                </div>
            }
            <span className="punc punc-block punc-new-fn-block punc-close"><br />&#125;</span>
        </>
    )
}

const FnArgsDef = ({ args, parent, parens }) => (
    <>
        <span className="punc punc-new-fn-arg punc-open">(</span>
        {args.map((arg, i) => {
            let component

            // Identifier name:string
            if (arg.type == "Identifier") {
                component = <span>{arg.name}</span>
            }

            // AssignmentPattern left:Identifier right:exp
            if (arg.type == "AssignmentPattern") {
                component = <WriteVar name={arg.left.name} setBy="=" setTo={arg.right} parent={parent} parens={parens} />
            }

            return <span key={i} className="ast-fn-def-arg">
                {component}
                {i < args.length - 1 &&
                    <span className="punc punc-comma punc-new-fn-arg-sep">,&nbsp;</span>
                }
            </span>
        })}
        <span className="punc punc-new-fn-arg punc-close">)</span>
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
        <span className="punc punc-member-name">.</span>
        <span>{name}</span>
    </>
)

const ReadIndex = ({ expr, of, parent, parens }) => (
    <>
        <span className="ast-noundef">
            <Expression expr={of} parens={parens} parent={parent} />
        </span>
        <span className="punc punc-member-exp punc-open">[</span>
        <Expression expr={expr} parens={parens} parent={parent} />
        <span className="punc punc-member-exp punc-close">]</span>
    </>
)

const WriteVar = ({ name, setBy, setTo, parent, parens }) => (
    <>
        <span>{name}</span>
        <span className="punc punc-ass">&nbsp;{setBy}&nbsp;</span>
        <Expression expr={setTo} parens={parens} parent={parent} />
    </>
)

const WriteProp = ({ name, of, setBy, setTo, parent, parens }) => (
    <>
        {/* <span className="ast-noundef"> */}
        <Expression expr={of} parens={parens} parent={parent} />
        {/* </span> */}
        <span className="punc punc-member-name">.</span>
        <span>{name}</span>
        <span className="punc punc-ass">&nbsp;{setBy}&nbsp;</span>
        <Expression expr={setTo} parens={parens} parent={parent} />
    </>
)

const WriteIndex = ({ expr, of, setBy, setTo, parent, parens }) => (
    <>
        {/* <span className="ast-noundef"> */}
        <Expression expr={of} parens={parens} parent={parent} />
        {/* </span> */}
        <span className="punc punc-member-exp punc-open">[</span>
        <Expression expr={expr} parens={parens} parent={parent} />
        <span className="punc punc-member-exp punc-close">]</span>
        <span className="punc punc-ass">&nbsp;{setBy}&nbsp;</span>
        <Expression expr={setTo} parens={parens} parent={parent} />
    </>
)

const OperatorUnary = ({ operator, operand, parent, parens }) => {
    return (
        <>
            <span className="punc punc-op">{operator}&nbsp;</span>
            <Expression expr={operand} parens={parens} parent={parent} />
        </>
    )
}

const OperatorBinary = ({ operator, left, right, parent, parens }) => {
    const decoratorObject = _.get(decorations, parent.category || "expression.UNKNOWN")

    return (
        <>
            <Expression expr={left} parens={parens} parent={parent} />
            <span className="punc punc-op">&nbsp;{operator}&nbsp;</span>
            <Expression expr={right} parens={parens} parent={parent} />
        </>
    )
}

const OperatorTernary = ({ cond, truthy, falsy, parent, parens }) => {
    return (
        <>
            <Expression expr={cond} parens={parens} parent={parent} />
            <span className="punc punc-op">?</span>
            <Expression expr={truthy} parens={parens} parent={parent} />
            <span className="punc punc-op">:</span>
            <Expression expr={falsy} parens={parens} parent={parent} />
        </>
    )
}

const Call = ({ expr, args, parent, parens }) => {
    return <>
        <Expression expr={expr} parens={parens} parent={parent} />
        <span className="punc punc-open">(</span>
        {args.map((arg, i) => {
            return <>
                <Expression key={i} expr={arg} parens={parens} parent={parent} />
                {i < args.length - 1 &&
                    <span className="punc punc-comma">,</span>
                }
            </>
        })}
        <span className="punc punc-close">)</span>
    </>
}

const CodeArea: React.FC<CodeAreaProps> = ({ fromAstOf, parent, parens, debug }) => {
    const { updateCodeStr, astOfCode, codeAreaRef } = useSimulatorStore()

    useEffect(() => {
        if (fromAstOf) {
            updateCodeStr(fromAstOf)
        }
    }, [fromAstOf])

    let isRoot = false

    if (!parens) {
        parens = parensSetOf(astOfCode.tokens)
        isRoot = true
    }
    if (!parent) {
        parent = astOfCode
    }

    // Handle case when astOfCode is null
    if (!astOfCode) {
        return <pre ref={codeAreaRef}><span className="text-red-500">No code available</span></pre>
    }

    const statements = astOfCode instanceof Array ? astOfCode : (astOfCode.body ? astOfCode.body : [astOfCode]);

    return (
        <pre ref={codeAreaRef} >
            {statements.map((statement, i) =>
                <Statement key={i} st={statement} parent={parent} parens={parens} />
            )}
        </pre>
    )
}

export default CodeArea