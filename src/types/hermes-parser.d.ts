import * as ESTree from 'estree'

declare module 'hermes-parser' {
    // ESNode is ESTree.Node with range property
    export interface ESNode extends ESTree.Node {
        range?: [number, number]
    }
    
    export function parse(code: string, options?: { tokens?: boolean; range?: boolean }): ESTree.Program & { tokens?: any[] }
} 