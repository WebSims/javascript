import { parse as hermesParser } from "hermes-parser"
import ts from "typescript"

export const astOf = (
    codeStr: string,
    parser: 'hermesParser' | 'typescript' = 'hermesParser'
) => {
    if (parser === 'hermesParser') {
        return hermesParser(codeStr, { tokens: true })
    }

    if (parser === 'typescript') {
        return ts.createSourceFile(
            'code.ts',
            codeStr,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS
        )
    }

    return null
}
