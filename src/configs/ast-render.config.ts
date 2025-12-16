import React from "react"
import {
    NodeContext,
    IdentifierContext,
    LiteralContext,
    NodeDecoration,
    IDENTIFIER_CONTEXT_RULES,
} from "@/types/ast-config"
import * as ESTree from "estree"

// Import all node components
import {
    IdentifierRead,
    IdentifierWrite,
    IdentifierDeclaration,
    IdentifierParameter,
    IdentifierFunctionName,
    IdentifierClassName,
    IdentifierPropertyKey,
    IdentifierMethodName,
    IdentifierUndefined,
} from "@/components/simulator/code-area/nodes/Identifier"
import Literal from "@/components/simulator/code-area/nodes/Literal"
import ThisExpression from "@/components/simulator/code-area/nodes/ThisExpression"
import Super from "@/components/simulator/code-area/nodes/Super"
import ArrayExpression from "@/components/simulator/code-area/nodes/ArrayExpression"
import ObjectExpression from "@/components/simulator/code-area/nodes/ObjectExpression"
import MemberExpression, {
    MemberExpressionStatic,
    MemberExpressionComputed,
} from "@/components/simulator/code-area/nodes/MemberExpression"
import BinaryExpression from "@/components/simulator/code-area/nodes/BinaryExpression"
import UnaryExpression from "@/components/simulator/code-area/nodes/UnaryExpression"
import UpdateExpression from "@/components/simulator/code-area/nodes/UpdateExpression"
import ConditionalExpression from "@/components/simulator/code-area/nodes/ConditionalExpression"
import AssignmentExpression, {
    AssignmentExpressionVariable,
    AssignmentExpressionProperty,
} from "@/components/simulator/code-area/nodes/AssignmentExpression"
import CallExpression from "@/components/simulator/code-area/nodes/CallExpression"
import NewExpression from "@/components/simulator/code-area/nodes/NewExpression"
import ArrowFunctionExpression from "@/components/simulator/code-area/nodes/ArrowFunctionExpression"
import EmptyStatement from "@/components/simulator/code-area/nodes/EmptyStatement"
import BlockStatement from "@/components/simulator/code-area/nodes/BlockStatement"
import VariableDeclaration from "@/components/simulator/code-area/nodes/VariableDeclaration"
import ExpressionStatement from "@/components/simulator/code-area/nodes/ExpressionStatement"
import FunctionDeclaration from "@/components/simulator/code-area/nodes/FunctionDeclaration"
import ReturnStatement from "@/components/simulator/code-area/nodes/ReturnStatement"
import ThrowStatement from "@/components/simulator/code-area/nodes/ThrowStatement"
import TryStatement from "@/components/simulator/code-area/nodes/TryStatement"
import IfStatement from "@/components/simulator/code-area/nodes/IfStatement"
import ForStatement from "@/components/simulator/code-area/nodes/ForStatement"
import ClassDeclaration from "@/components/simulator/code-area/nodes/ClassDeclaration"
import MethodDefinition from "@/components/simulator/code-area/nodes/MethodDefinition"
import PropertyDefinition from "@/components/simulator/code-area/nodes/PropertyDefinition"

// ----- Color Palettes -----
const colorPalettes = [
    ["#FFAEBC", "#A0E7E5", "#B4F8C8", "#FBE7C6"],
    ["#ff00aa", "#f8ff00", "#a41a1a", "#10ff00", "#00ffd9"],
    ["#fdff00", "#ff9a00", "#00ff04", "#00c5ff", "#ff00a7"],
    ["#fdb9c9", "#ffdcbe", "#f6f3b5", "#bbf6f3", "#a7e0f4"],
    ["#ff9fae", "#fde995", "#a6e1c5", "#a7e0f6", "#e1a7fb"],
    ["#e3ff00", "#56ff00", "#00f9ff", "#ff00db", "#bd00ff"],
    ["#f0ff00", "#22ff00", "#ff00db", "#04dfff", "#b000ff"],
    ["#ff659f", "#67dfff", "#83f18d", "#b581fe", "#fcf151"],
    ["#52e2ee", "#ecfd63", "#f2e030", "#333333", "#dbdbdb"],
]

export const colorPalette = colorPalettes[2]

// ----- Base Type -----
export type BaseType = "statement" | "expression" | "class"

// ----- Node Config Entry Type -----
export interface NodeConfigEntry {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: React.FC<any>
    decoration: NodeDecoration
    baseType: BaseType
}

export interface NodeTypeConfig {
    contexts?: Record<string, NodeConfigEntry>
    default: NodeConfigEntry
}

// ----- AST Node Config Map -----
// Maps ESTree node types to their components and decorations
export const astNodeConfig: Record<string, NodeTypeConfig> = {
    // ----- Identifier -----
    Identifier: {
        contexts: {
            read: {
                component: IdentifierRead,
                decoration: {
                    tooltip: "Read variable",
                    cheatSheetId: "exp-read-var",
                    className: "text-blue-600",
                    color: colorPalette[4],
                },
                baseType: "expression",
            },
            write: {
                component: IdentifierWrite,
                decoration: {
                    tooltip: "Set variable",
                    cheatSheetId: "exp-write-var",
                    className: "text-blue-600",
                },
                baseType: "expression",
            },
            declaration: {
                component: IdentifierDeclaration,
                decoration: {
                    tooltip: "Variable declaration",
                    cheatSheetId: "st-dec-var",
                    className: "text-blue-600",
                },
                baseType: "statement",
            },
            parameter: {
                component: IdentifierParameter,
                decoration: {
                    tooltip: "Function parameter",
                    cheatSheetId: "exp-param",
                    className: "text-blue-500",
                },
                baseType: "expression",
            },
            functionName: {
                component: IdentifierFunctionName,
                decoration: {
                    tooltip: "Function name",
                    cheatSheetId: "exp-fn-name",
                    className: "text-purple-600",
                },
                baseType: "statement",
            },
            className: {
                component: IdentifierClassName,
                decoration: {
                    tooltip: "Class name",
                    cheatSheetId: "exp-class-name",
                    className: "text-blue-600",
                },
                baseType: "statement",
            },
            propertyKey: {
                component: IdentifierPropertyKey,
                decoration: {
                    tooltip: "Property key",
                    cheatSheetId: "exp-prop-key",
                    className: "text-slate-700",
                },
                baseType: "expression",
            },
            methodName: {
                component: IdentifierMethodName,
                decoration: {
                    tooltip: "Method name",
                    cheatSheetId: "exp-method-name",
                    className: "text-slate-700",
                },
                baseType: "expression",
            },
            undefined: {
                component: IdentifierUndefined,
                decoration: {
                    tooltip: "Data: Literal (undefined)",
                    cheatSheetId: "data-undefined",
                    className: "text-slate-500",
                },
                baseType: "expression",
            },
        },
        default: {
            component: IdentifierRead,
            decoration: {
                tooltip: "Identifier",
                className: "text-blue-600",
            },
            baseType: "expression",
        },
    },

    // ----- Literal -----
    Literal: {
        contexts: {
            boolean: {
                component: Literal,
                decoration: {
                    tooltip: "Data: Literal (boolean)",
                    cheatSheetId: "data-boolean",
                    className: "text-emerald-600",
                },
                baseType: "expression",
            },
            numeric: {
                component: Literal,
                decoration: {
                    tooltip: "Data: Literal (number)",
                    cheatSheetId: "data-number",
                    className: "text-blue-600",
                },
                baseType: "expression",
            },
            string: {
                component: Literal,
                decoration: {
                    tooltip: "Data: Literal (string)",
                    cheatSheetId: "data-string",
                    className: "text-orange-600",
                },
                baseType: "expression",
            },
            null: {
                component: Literal,
                decoration: {
                    tooltip: "Data: Literal (null)",
                    cheatSheetId: "data-null",
                    className: "text-slate-500",
                },
                baseType: "expression",
            },
            regex: {
                component: Literal,
                decoration: {
                    tooltip: "Data: Literal (regex)",
                    cheatSheetId: "data-regex",
                    className: "text-red-600",
                },
                baseType: "expression",
            },
            bigint: {
                component: Literal,
                decoration: {
                    tooltip: "Data: Literal (bigint)",
                    cheatSheetId: "data-bigint",
                    className: "text-blue-600",
                },
                baseType: "expression",
            },
        },
        default: {
            component: Literal,
            decoration: {
                tooltip: "Literal value",
                className: "text-slate-700",
            },
            baseType: "expression",
        },
    },

    // ----- ThisExpression -----
    ThisExpression: {
        default: {
            component: ThisExpression,
            decoration: {
                tooltip: "this keyword",
                cheatSheetId: "exp-this",
                className: "text-purple-600 font-medium",
            },
            baseType: "expression",
        },
    },

    // ----- Super -----
    Super: {
        default: {
            component: Super,
            decoration: {
                tooltip: "super keyword",
                cheatSheetId: "exp-super",
                className: "text-purple-600 font-medium",
            },
            baseType: "expression",
        },
    },

    // ----- ArrayExpression -----
    ArrayExpression: {
        default: {
            component: ArrayExpression,
            decoration: {
                tooltip: "Data: NEW array",
                cheatSheetId: "data-array",
                className: "text-slate-700",
            },
            baseType: "expression",
        },
    },

    // ----- ObjectExpression -----
    ObjectExpression: {
        default: {
            component: ObjectExpression,
            decoration: {
                tooltip: "Data: NEW object",
                cheatSheetId: "data-object",
                className: "text-slate-700",
            },
            baseType: "expression",
        },
    },

    // ----- ArrowFunctionExpression -----
    ArrowFunctionExpression: {
        contexts: {
            block: {
                component: ArrowFunctionExpression,
                decoration: {
                    tooltip: "Data: NEW arrow function",
                    cheatSheetId: "data-arrow",
                    className: "display-unset text-purple-600",
                },
                baseType: "expression",
            },
            implicit: {
                component: ArrowFunctionExpression,
                decoration: {
                    tooltip: "Data: NEW arrow function (implicit return)",
                    cheatSheetId: "data-arrow",
                    className: "text-purple-600",
                },
                baseType: "expression",
            },
        },
        default: {
            component: ArrowFunctionExpression,
            decoration: {
                tooltip: "Data: NEW arrow function",
                cheatSheetId: "data-arrow",
                className: "text-purple-600",
            },
            baseType: "expression",
        },
    },

    // ----- MemberExpression -----
    MemberExpression: {
        contexts: {
            static: {
                component: MemberExpressionStatic,
                decoration: {
                    tooltip: "Read property of object",
                    cheatSheetId: "exp-read-prop-static",
                    className: "text-blue-600",
                    color: colorPalette[3],
                },
                baseType: "expression",
            },
            computed: {
                component: MemberExpressionComputed,
                decoration: {
                    tooltip: "Read property of object (by expression)",
                    cheatSheetId: "exp-read-prop-dynamic",
                    color: colorPalette[1],
                },
                baseType: "expression",
            },
        },
        default: {
            component: MemberExpression,
            decoration: {
                tooltip: "Member expression",
                className: "text-blue-600",
            },
            baseType: "expression",
        },
    },

    // ----- UnaryExpression -----
    UnaryExpression: {
        default: {
            component: UnaryExpression,
            decoration: {
                tooltip: "Operation (Unary Operator)",
                cheatSheetId: "exp-op-unary",
                className: "ast-exp-op1",
            },
            baseType: "expression",
        },
    },

    // ----- UpdateExpression -----
    UpdateExpression: {
        default: {
            component: UpdateExpression,
            decoration: {
                tooltip: "Operation (Update Operator)",
                cheatSheetId: "exp-op-update",
                className: "ast-exp-op4",
            },
            baseType: "expression",
        },
    },

    // ----- BinaryExpression -----
    BinaryExpression: {
        default: {
            component: BinaryExpression,
            decoration: {
                tooltip: "Operation (Binary Operator)",
                cheatSheetId: "exp-op-binary",
                className: "ast-exp-op2",
            },
            baseType: "expression",
        },
    },

    // ----- LogicalExpression -----
    LogicalExpression: {
        default: {
            component: BinaryExpression,
            decoration: {
                tooltip: "Operation (Logical Operator)",
                cheatSheetId: "exp-op-logical",
                className: "ast-exp-op2",
            },
            baseType: "expression",
        },
    },

    // ----- AssignmentExpression -----
    AssignmentExpression: {
        contexts: {
            variable: {
                component: AssignmentExpressionVariable,
                decoration: {
                    tooltip: "Set variable",
                    cheatSheetId: "exp-write-var",
                    className: "text-blue-600",
                },
                baseType: "expression",
            },
            property: {
                component: AssignmentExpressionProperty,
                decoration: {
                    tooltip: "Set property of object",
                    cheatSheetId: "exp-write-prop",
                    className: "text-blue-600",
                },
                baseType: "expression",
            },
            computed: {
                component: AssignmentExpressionProperty,
                decoration: {
                    tooltip: "Set property of object (by expression)",
                    cheatSheetId: "exp-write-prop-dynamic",
                    className: "text-blue-600",
                },
                baseType: "expression",
            },
        },
        default: {
            component: AssignmentExpression,
            decoration: {
                tooltip: "Assignment expression",
                className: "text-blue-600",
            },
            baseType: "expression",
        },
    },

    // ----- ConditionalExpression -----
    ConditionalExpression: {
        default: {
            component: ConditionalExpression,
            decoration: {
                tooltip: "Operation (Ternary Operator)",
                cheatSheetId: "exp-op-ternary",
                className: "ast-exp-op3",
            },
            baseType: "expression",
        },
    },

    // ----- CallExpression -----
    CallExpression: {
        default: {
            component: CallExpression,
            decoration: {
                tooltip: "Function call",
                cheatSheetId: "exp-func",
                className: "",
            },
            baseType: "expression",
        },
    },

    // ----- NewExpression -----
    NewExpression: {
        default: {
            component: NewExpression,
            decoration: {
                tooltip: "Constructor call",
                cheatSheetId: "exp-new",
                className: "",
            },
            baseType: "expression",
        },
    },

    // ----- Statements -----

    // ----- EmptyStatement -----
    EmptyStatement: {
        default: {
            component: EmptyStatement,
            decoration: {
                tooltip: "Empty statement",
                cheatSheetId: "st-exp-useless",
                className: "text-slate-500",
            },
            baseType: "statement",
        },
    },

    // ----- ExpressionStatement -----
    ExpressionStatement: {
        contexts: {
            useful: {
                component: ExpressionStatement,
                decoration: {
                    tooltip: "Expression Evaluation Statement",
                    cheatSheetId: "st-exp-useful",
                    className: "text-slate-700",
                },
                baseType: "statement",
            },
            useless: {
                component: ExpressionStatement,
                decoration: {
                    tooltip: "Expression Evaluation Statement (no side effects)",
                    cheatSheetId: "st-exp-useless",
                    className: "text-slate-700",
                },
                baseType: "statement",
            },
        },
        default: {
            component: ExpressionStatement,
            decoration: {
                tooltip: "Expression Evaluation Statement",
                cheatSheetId: "st-exp",
                className: "text-slate-700",
            },
            baseType: "statement",
        },
    },

    // ----- BlockStatement -----
    BlockStatement: {
        default: {
            component: BlockStatement,
            decoration: {
                tooltip: "Block Statement",
                cheatSheetId: "st-block",
                className: "text-slate-700",
            },
            baseType: "statement",
        },
    },

    // ----- VariableDeclaration -----
    VariableDeclaration: {
        contexts: {
            withInit: {
                component: VariableDeclaration,
                decoration: {
                    tooltip: "Variable declaration with initialization",
                    cheatSheetId: "st-dec-assign",
                    className: "text-slate-700",
                },
                baseType: "statement",
            },
            withoutInit: {
                component: VariableDeclaration,
                decoration: {
                    tooltip: "Variable declaration",
                    cheatSheetId: "st-dec-var",
                    className: "text-slate-700",
                },
                baseType: "statement",
            },
        },
        default: {
            component: VariableDeclaration,
            decoration: {
                tooltip: "Variable declaration Statement",
                cheatSheetId: "st-dec",
                className: "text-slate-700",
            },
            baseType: "statement",
        },
    },

    // ----- FunctionDeclaration -----
    FunctionDeclaration: {
        default: {
            component: FunctionDeclaration,
            decoration: {
                tooltip: "Function declaration",
                cheatSheetId: "st-dec-fn",
                className: "text-slate-700",
            },
            baseType: "statement",
        },
    },

    // ----- ClassDeclaration -----
    ClassDeclaration: {
        default: {
            component: ClassDeclaration,
            decoration: {
                tooltip: "Class Declaration",
                cheatSheetId: "st-dec-class",
                className: "text-blue-600",
            },
            baseType: "statement",
        },
    },

    // ----- ReturnStatement -----
    ReturnStatement: {
        default: {
            component: ReturnStatement,
            decoration: {
                tooltip: "Return Statement",
                cheatSheetId: "st-flow-return",
                className: "text-purple-600",
            },
            baseType: "statement",
        },
    },

    // ----- ThrowStatement -----
    ThrowStatement: {
        default: {
            component: ThrowStatement,
            decoration: {
                tooltip: "Throw Statement",
                cheatSheetId: "st-flow-throw",
                className: "text-red-600",
            },
            baseType: "statement",
        },
    },

    // ----- TryStatement -----
    TryStatement: {
        default: {
            component: TryStatement,
            decoration: {
                tooltip: "Try Statement",
                cheatSheetId: "st-error-trycatch",
                className: "text-green-600",
            },
            baseType: "statement",
        },
    },

    // ----- IfStatement -----
    IfStatement: {
        default: {
            component: IfStatement,
            decoration: {
                tooltip: "If Statement",
                cheatSheetId: "st-cond-if",
                className: "text-blue-600",
            },
            baseType: "statement",
        },
    },

    // ----- ForStatement -----
    ForStatement: {
        default: {
            component: ForStatement,
            decoration: {
                tooltip: "For Loop",
                cheatSheetId: "st-loop-for-3statements",
                className: "text-green-600",
            },
            baseType: "statement",
        },
    },

    // ----- Class Members -----

    // ----- MethodDefinition -----
    MethodDefinition: {
        contexts: {
            constructor: {
                component: MethodDefinition,
                decoration: {
                    tooltip: "Class Constructor",
                    cheatSheetId: "class-constructor",
                    className: "",
                },
                baseType: "class" as BaseType,
            },
            method: {
                component: MethodDefinition,
                decoration: {
                    tooltip: "Class Method",
                    cheatSheetId: "class-method",
                    className: "",
                },
                baseType: "class" as BaseType,
            },
            getter: {
                component: MethodDefinition,
                decoration: {
                    tooltip: "Getter Method",
                    cheatSheetId: "class-getter",
                    className: "",
                },
                baseType: "class" as BaseType,
            },
            setter: {
                component: MethodDefinition,
                decoration: {
                    tooltip: "Setter Method",
                    cheatSheetId: "class-setter",
                    className: "",
                },
                baseType: "class" as BaseType,
            },
        },
        default: {
            component: MethodDefinition,
            decoration: {
                tooltip: "Class Method",
                cheatSheetId: "class-method",
                className: "",
            },
            baseType: "class" as BaseType,
        },
    },

    // ----- PropertyDefinition -----
    PropertyDefinition: {
        default: {
            component: PropertyDefinition,
            decoration: {
                tooltip: "Class Property",
                cheatSheetId: "class-property",
                className: "",
            },
            baseType: "class" as BaseType,
        },
    },

    // ----- ClassProperty (Babel alias) -----
    ClassProperty: {
        default: {
            component: PropertyDefinition,
            decoration: {
                tooltip: "Class Property",
                cheatSheetId: "class-property",
                className: "",
            },
            baseType: "class" as BaseType,
        },
    },
}

// ----- Context Detection Helpers -----

/**
 * Determine if an ExpressionStatement has side effects
 */
export const hasExpressionSideEffects = (expressionType: string): boolean => {
    return [
        "CallExpression",
        "AssignmentExpression",
        "UpdateExpression",
        "NewExpression",
        "AwaitExpression",
        "YieldExpression",
        "UnaryExpression",
    ].includes(expressionType)
}

/**
 * Get the context for an Identifier node based on its parent
 */
export const getIdentifierContext = (
    node: ESTree.Identifier,
    parent: ESTree.Node,
    parentKey?: string
): IdentifierContext => {
    if (node.name === "undefined") {
        return "read"
    }

    for (const rule of IDENTIFIER_CONTEXT_RULES) {
        if (parent.type === rule.parentType) {
            if (!rule.parentKey || parentKey === rule.parentKey) {
                return rule.context as IdentifierContext
            }
        }
    }

    return "read"
}

/**
 * Get the context for a Literal node based on its value type
 */
export const getLiteralContext = (node: ESTree.Literal): LiteralContext => {
    if (node.value === null) return "null"
    if (typeof node.value === "boolean") return "boolean"
    if (typeof node.value === "number") return "numeric"
    if (typeof node.value === "string") return "string"
    if (node.value instanceof RegExp) return "regex"
    if (typeof node.value === "bigint") return "bigint"
    return "string"
}

/**
 * Generic context detector - determines rendering context for a node based on its type and parent
 */
export const getNodeContext = (
    node: ESTree.Node,
    parent: ESTree.Node,
    parentKey?: string
): NodeContext => {
    switch (node.type) {
        case "Identifier":
            return getIdentifierContext(node as ESTree.Identifier, parent, parentKey)
        
        case "Literal":
            return getLiteralContext(node as ESTree.Literal)
        
        case "MemberExpression": {
            const memberExpr = node as ESTree.MemberExpression
            return memberExpr.computed ? "computed" : "static"
        }
        
        case "AssignmentExpression": {
            const assignExpr = node as ESTree.AssignmentExpression
            if (assignExpr.left.type === "Identifier") return "variable"
            if (assignExpr.left.type === "MemberExpression") {
                const member = assignExpr.left as ESTree.MemberExpression
                return member.computed ? "computed" : "property"
            }
            return "default"
        }
        
        case "ArrowFunctionExpression": {
            const arrowExpr = node as ESTree.ArrowFunctionExpression
            return arrowExpr.body.type === "BlockStatement" ? "block" : "implicit"
        }
        
        case "ExpressionStatement": {
            const exprSt = node as ESTree.ExpressionStatement
            return hasExpressionSideEffects(exprSt.expression.type) ? "useful" : "useless"
        }
        
        case "VariableDeclaration": {
            const varDecl = node as ESTree.VariableDeclaration
            const hasInit = varDecl.declarations.some(d => d.init !== null)
            return hasInit ? "withInit" : "withoutInit"
        }
        
        case "MethodDefinition": {
            const methodDef = node as ESTree.MethodDefinition
            if (methodDef.kind === "constructor") return "constructor"
            if (methodDef.kind === "get") return "getter"
            if (methodDef.kind === "set") return "setter"
            return "method"
        }
        
        case "Property": {
            const prop = node as ESTree.Property
            if (prop.method) return "method"
            if (prop.shorthand) return "shorthand"
            if (prop.kind === "get") return "get"
            if (prop.kind === "set") return "set"
            return "init"
        }
        
        default:
            return "default"
    }
}

// ----- Base Class Names -----
export const baseClassNames: Record<BaseType, string> = {
    statement: "bg-slate-50 rounded-md p-2 pt-6 [&:has(div:hover)]:bg-slate-50 hover:bg-blue-50 transition-colors duration-150",
    expression: "ast-exp inline-block align-middle",
    class: "bg-slate-50 rounded-md p-2 [&:has(div:hover)]:bg-slate-50 hover:bg-blue-50 hover:[&>*:last-child]:text-blue-600 transition-colors duration-150",
}

// ----- Utility Functions -----

/**
 * Get config entry for a node type and context
 */
export const getNodeConfig = (
    nodeType: string,
    context: string = "default"
): NodeConfigEntry | null => {
    const config = astNodeConfig[nodeType]
    if (!config) return null
    
    if (context !== "default" && config.contexts?.[context]) {
        return config.contexts[context]
    }
    
    return config.default
}

/**
 * Get decoration for a node type and context
 */
export const getNodeDecoration = (
    nodeType: string,
    context: string = "default"
): NodeDecoration => {
    const config = getNodeConfig(nodeType, context)
    if (config) return config.decoration
    
    return {
        tooltip: "Unknown node type",
        className: "bg-orange-400 hover:bg-orange-500",
    }
}

/**
 * Get component for a node type and context
 */
export const getNodeComponent = (
    nodeType: string,
    context: string = "default"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): React.FC<any> | null => {
    const config = getNodeConfig(nodeType, context)
    return config?.component || null
}

/**
 * Get baseType for a node type and context
 */
export const getBaseType = (
    nodeType: string,
    context: string = "default"
): BaseType => {
    const config = getNodeConfig(nodeType, context)
    return config?.baseType || "expression"
}

/**
 * Build className string with execution state
 */
export const buildClassName = (
    baseClass: string,
    decoration: NodeDecoration,
    state: {
        isExecuting?: boolean
        isExecuted?: boolean
        isEvaluating?: boolean
        isEvaluated?: boolean
        isErrorThrown?: boolean
    } = {}
): string => {
    const classes = [baseClass, decoration.className || ""]
        .filter(Boolean)
        .join(" ")

    const stateClasses = [
        state.isExecuting && "executing",
        state.isExecuted && "executed",
        state.isEvaluating && "evaluating",
        state.isEvaluated && "evaluated",
        state.isErrorThrown && "error-thrown",
    ]
        .filter(Boolean)
        .join(" ")

    return [classes, stateClasses].filter(Boolean).join(" ")
}

// ----- Execution State Type -----
export interface NodeExecutionState {
    isExecuting?: boolean
    isExecuted?: boolean
    isEvaluating?: boolean
    isEvaluated?: boolean
    isErrorThrown?: boolean
}

// ----- Complete Decoration Result -----
export interface NodeDecorationResult {
    decoration: NodeDecoration
    className: string
    baseType: BaseType
    context: NodeContext
    cheatSheetId?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: React.FC<any> | null
}

/**
 * Build complete decoration result for a node - unified function that handles
 * context detection, decoration lookup, class building, and component retrieval
 */
export const buildNodeDecorationResult = (
    node: ESTree.Node,
    parent: ESTree.Node,
    state: NodeExecutionState = {},
    parentKey?: string
): NodeDecorationResult => {
    const nodeType = node.type
    const context = getNodeContext(node, parent, parentKey)
    const decoration = getNodeDecoration(nodeType, context)
    const baseType = getBaseType(nodeType, context)
    const className = buildClassName(baseClassNames[baseType], decoration, state)
    const component = getNodeComponent(nodeType, context)
    
    return {
        decoration,
        className,
        baseType,
        context,
        cheatSheetId: decoration.cheatSheetId,
        component,
    }
}

export default astNodeConfig
