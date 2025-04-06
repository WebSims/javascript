import { parse as hermesParser } from "hermes-parser"

export const astOf = (codeStr: string, parser = 'hermesParser') => {
    if (parser === 'hermesParser') {
        return hermesParser(codeStr, { tokens: true })
    }
    return null
}
