declare module 'hermes-parser' {
    export function parse(code: string, options?: { tokens?: boolean }): ESNode;

    export interface ESNode {
        type: string;
        range: [number, number];
        [key: string]: unknown;
    }

    export interface Program extends ESNode {
        type: 'Program';
        body: ESNode[];
    }

    export interface ExpressionStatement extends ESNode {
        type: 'ExpressionStatement';
        expression: ESNode;
    }

    export interface VariableDeclaration extends ESNode {
        type: 'VariableDeclaration';
        declarations: ESNode[];
        kind: 'var' | 'let' | 'const';
    }

    export interface VariableDeclarator extends ESNode {
        type: 'VariableDeclarator';
        id: ESNode;
        init: ESNode | null;
    }

    export interface Identifier extends ESNode {
        type: 'Identifier';
        name: string;
    }

    export interface PrivateIdentifier extends ESNode {
        type: 'PrivateIdentifier';
        name: string;
    }

    export interface Literal extends ESNode {
        type: 'Literal';
        value: string | number | boolean | null;
        raw: string;
    }

    export interface ArrayExpression extends ESNode {
        type: 'ArrayExpression';
        elements: ESNode[];
    }

    export interface ObjectExpression extends ESNode {
        type: 'ObjectExpression';
        properties: ESNode[];
    }

    export interface Property extends ESNode {
        type: 'Property';
        key: ESNode;
        value: ESNode;
        kind: 'init' | 'get' | 'set';
        method: boolean;
        shorthand: boolean;
        computed: boolean;
    }

    export interface ArrowFunctionExpression extends ESNode {
        type: 'ArrowFunctionExpression';
        id: ESNode | null;
        params: ESNode[];
        body: ESNode;
        expression: boolean;
        async: boolean;
    }

    export interface MemberExpression extends ESNode {
        type: 'MemberExpression';
        object: ESNode;
        property: ESNode;
        computed: boolean;
    }
} 