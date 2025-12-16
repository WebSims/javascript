import React from "react"
import * as ESTree from "estree"

// ----- ESTree Node Types -----
// Based on https://github.com/estree/estree/blob/master/es5.md

export type ESTreeNodeType =
    // Expressions
    | "Identifier"
    | "Literal"
    | "ThisExpression"
    | "ArrayExpression"
    | "ObjectExpression"
    | "FunctionExpression"
    | "ArrowFunctionExpression"
    | "UnaryExpression"
    | "UpdateExpression"
    | "BinaryExpression"
    | "AssignmentExpression"
    | "LogicalExpression"
    | "MemberExpression"
    | "ConditionalExpression"
    | "CallExpression"
    | "NewExpression"
    | "SequenceExpression"
    // Statements
    | "ExpressionStatement"
    | "BlockStatement"
    | "EmptyStatement"
    | "DebuggerStatement"
    | "ReturnStatement"
    | "LabeledStatement"
    | "BreakStatement"
    | "ContinueStatement"
    | "IfStatement"
    | "SwitchStatement"
    | "ThrowStatement"
    | "TryStatement"
    | "WhileStatement"
    | "DoWhileStatement"
    | "ForStatement"
    | "ForInStatement"
    | "ForOfStatement"
    // Declarations
    | "FunctionDeclaration"
    | "VariableDeclaration"
    | "ClassDeclaration"
    // Class Members
    | "MethodDefinition"
    | "PropertyDefinition"
    | "ClassProperty"
    | "ClassMethod"
    // Patterns
    | "AssignmentPattern"
    | "RestElement"
    | "SpreadElement"
    // Other
    | "Property"
    | "Super"
    | "TemplateLiteral"
    | "TaggedTemplateExpression"
    | "AwaitExpression"
    | "YieldExpression"
    | "Program"

// ----- Context Types -----
// Contexts determine how a node should be rendered based on its parent/usage

export type IdentifierContext =
    | "read"           // Reading a variable value: console.log(x)
    | "write"          // Writing to a variable: x = 5
    | "declaration"    // Declaring a variable: let x
    | "parameter"      // Function parameter: function(a)
    | "functionName"   // Function name: function foo()
    | "className"      // Class name: class Foo
    | "propertyKey"    // Property key in object: { name: value }
    | "methodName"     // Method name in class
    | "label"          // Label: loop: for(...)

export type LiteralContext =
    | "boolean"
    | "numeric"
    | "string"
    | "null"
    | "regex"
    | "bigint"

export type MemberExpressionContext =
    | "static"         // obj.property
    | "computed"       // obj[expression]

export type AssignmentContext =
    | "variable"       // x = 5
    | "property"       // obj.x = 5
    | "computed"       // obj[key] = 5

// ArrowFunctionExpression context
export type ArrowFunctionContext =
    | "block"          // Arrow with block body: () => { }
    | "implicit"       // Arrow with implicit return: () => x

// ExpressionStatement context
export type ExpressionStatementContext =
    | "useful"         // Has side effects
    | "useless"        // No side effects

// VariableDeclaration context
export type VariableDeclarationContext =
    | "withInit"       // Has initializer: let x = 5
    | "withoutInit"    // No initializer: let x

// MethodDefinition context
export type MethodContext =
    | "constructor"
    | "method"
    | "getter"
    | "setter"

// Property context
export type PropertyContext =
    | "init"           // Regular property
    | "get"            // Getter
    | "set"            // Setter
    | "method"         // Method shorthand
    | "shorthand"      // Shorthand property

export type NodeContext =
    | IdentifierContext
    | LiteralContext
    | MemberExpressionContext
    | AssignmentContext
    | ArrowFunctionContext
    | ExpressionStatementContext
    | VariableDeclarationContext
    | MethodContext
    | PropertyContext
    | "default"

// ----- Decoration Configuration -----
export interface NodeDecoration {
    tooltip: string
    cheatSheetId?: string
    className?: string
    color?: string
}

// ----- Component Props -----
export interface BaseNodeProps {
    node: ESTree.Node
    parent: ESTree.Node
    parens: Set<number>
}

export interface IdentifierProps extends BaseNodeProps {
    node: ESTree.Identifier
    context: IdentifierContext
}

export interface LiteralProps extends BaseNodeProps {
    node: ESTree.Literal
    context: LiteralContext
}

// Generic node component type
export type NodeComponent<P extends BaseNodeProps = BaseNodeProps> = React.FC<P>

// ----- Node Render Configuration -----
export interface ContextRenderConfig {
    component: NodeComponent<any>
    decoration: NodeDecoration
}

// For nodes with multiple contexts (like Identifier)
export interface MultiContextNodeConfig {
    contexts: Partial<Record<NodeContext, ContextRenderConfig>>
    default: ContextRenderConfig
    // Function to determine context from parent node
    getContext?: (node: ESTree.Node, parent: ESTree.Node, parentKey?: string) => NodeContext
}

// For nodes with single rendering (like BinaryExpression)
export interface SingleContextNodeConfig {
    component: NodeComponent<any>
    decoration: NodeDecoration
}

export type NodeConfig = MultiContextNodeConfig | SingleContextNodeConfig

// Type guard to check if config is multi-context
export const isMultiContextConfig = (config: NodeConfig): config is MultiContextNodeConfig => {
    return "contexts" in config
}

// ----- AST Render Config Type -----
export type ASTRenderConfig = Partial<Record<ESTreeNodeType, NodeConfig>>

// ----- Helper types for context detection -----
export type ParentNodeKey = string

export interface ContextDetectionRule {
    parentType: ESTreeNodeType
    parentKey?: ParentNodeKey
    context: NodeContext
}

// Context detection rules for Identifier
export const IDENTIFIER_CONTEXT_RULES: ContextDetectionRule[] = [
    { parentType: "AssignmentExpression", parentKey: "left", context: "write" },
    { parentType: "VariableDeclarator", parentKey: "id", context: "declaration" },
    { parentType: "FunctionDeclaration", parentKey: "id", context: "functionName" },
    { parentType: "FunctionExpression", parentKey: "id", context: "functionName" },
    { parentType: "ArrowFunctionExpression", parentKey: "params", context: "parameter" },
    { parentType: "FunctionDeclaration", parentKey: "params", context: "parameter" },
    { parentType: "FunctionExpression", parentKey: "params", context: "parameter" },
    { parentType: "ClassDeclaration", parentKey: "id", context: "className" },
    { parentType: "ClassExpression", parentKey: "id", context: "className" },
    { parentType: "MemberExpression", parentKey: "property", context: "propertyKey" },
    { parentType: "Property", parentKey: "key", context: "propertyKey" },
    { parentType: "MethodDefinition", parentKey: "key", context: "methodName" },
    { parentType: "LabeledStatement", parentKey: "label", context: "label" },
]

// ----- Utility type for extracting node type from ESTree -----
export type ExtractESTreeNode<T extends ESTreeNodeType> = Extract<ESTree.Node, { type: T }>

// ----- Render State Types -----
export interface NodeRenderState {
    isExecuting: boolean
    isExecuted: boolean
    isEvaluating: boolean
    isEvaluated: boolean
    isErrorThrown: boolean
}

// ----- Category Path (for backwards compatibility with decorations) -----
export type CategoryPath = string // e.g., "expression.read.var", "statement.declaration"

export interface LegacyDecoration extends NodeDecoration {
    classN?: string // Legacy className property
}

