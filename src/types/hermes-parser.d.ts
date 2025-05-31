import * as ESTree from 'estree'

declare module 'hermes-parser' {
    export function parse(code: string, options?: { tokens?: boolean }): ESTree.Program;
} 