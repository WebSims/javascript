import React, { useEffect, useState } from 'react'

type ConsoleLogValue = string | number | boolean | null | undefined | object

type ConsoleLog = {
    type: 'log' | 'error' | 'warn' | 'info'
    args: ConsoleLogValue[]
    timestamp: number
}

interface ConsoleProps {
    code: string
}

const Console: React.FC<ConsoleProps> = ({ code }) => {
    const [logs, setLogs] = useState<ConsoleLog[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setLogs([])
        setError(null)

        // Create a sandbox environment to safely execute code
        const executeCode = () => {
            const consoleLogs: ConsoleLog[] = []

            // Create a mock console object
            const mockConsole = {
                log: (...args: ConsoleLogValue[]) => {
                    consoleLogs.push({ type: 'log', args, timestamp: Date.now() })
                },
                error: (...args: ConsoleLogValue[]) => {
                    consoleLogs.push({ type: 'error', args, timestamp: Date.now() })
                },
                warn: (...args: ConsoleLogValue[]) => {
                    consoleLogs.push({ type: 'warn', args, timestamp: Date.now() })
                },
                info: (...args: ConsoleLogValue[]) => {
                    consoleLogs.push({ type: 'info', args, timestamp: Date.now() })
                }
            }

            try {
                // Prepare code with mock console
                const codeToExecute = `
                    const console = {
                        log: (...args) => { self.mockConsole.log(...args) },
                        error: (...args) => { self.mockConsole.error(...args) },
                        warn: (...args) => { self.mockConsole.warn(...args) },
                        info: (...args) => { self.mockConsole.info(...args) }
                    };
                    
                    ${code}
                `

                // Create a safe evaluation environment using Function constructor
                const evaluator = new Function('self', `
                    self.mockConsole = arguments[0];
                    try {
                        ${codeToExecute}
                    } catch (e) {
                        self.mockConsole.error("Error:", e.message);
                    }
                `)

                // Execute the code with our mock console
                evaluator(mockConsole)
                setLogs(consoleLogs)
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
            }
        }

        executeCode()
    }, [code])

    // Function to format console log arguments
    const formatLogArgs = (args: ConsoleLogValue[]) => {
        return args.map((arg, index) => {
            if (typeof arg === 'object') {
                try {
                    return <span key={index} className="text-blue-500">{JSON.stringify(arg)}</span>
                } catch {
                    return <span key={index} className="text-blue-500">[Object]</span>
                }
            } else if (typeof arg === 'string') {
                return <span key={index} className="text-green-600">"{arg}"</span>
            } else if (typeof arg === 'number') {
                return <span key={index} className="text-blue-500">{arg}</span>
            } else if (typeof arg === 'boolean') {
                return <span key={index} className="text-purple-500">{String(arg)}</span>
            } else if (arg === null) {
                return <span key={index} className="text-gray-500">null</span>
            } else if (arg === undefined) {
                return <span key={index} className="text-gray-500">undefined</span>
            }
            return <span key={index}>{String(arg)}</span>
        }).reduce((acc: React.ReactNode[], item, i) => {
            if (i === 0) return [item]
            return [...acc, <span key={`sep-${i}`} className="mx-1">,</span>, item]
        }, [])
    }

    return (
        <div className="h-full text-white font-mono text-sm">
            {error && (
                <div className="text-red-500 pb-2">
                    Execution Error: {error}
                </div>
            )}
            {logs.map((log, index) => {
                let className = "border-b border-gray-800 py-1"

                switch (log.type) {
                    case 'error':
                        className += " text-red-500"
                        break
                    case 'warn':
                        className += " text-yellow-500"
                        break
                    case 'info':
                        className += " text-cyan-400"
                        break
                    default:
                        className += " text-white"
                }

                return (
                    <div key={index} className={className}>
                        <span className="text-gray-500 mr-2">{'>'}</span>
                        {formatLogArgs(log.args)}
                    </div>
                )
            })}
            {logs.length === 0 && !error && (
                <div className="text-gray-500 italic">No console output</div>
            )}
        </div>
    )
}

export default Console 