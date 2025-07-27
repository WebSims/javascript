import React from 'react'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { JSValue } from '@/types/simulator'

interface ConsoleProps {
    code: string
}

const ConsoleOutput: React.FC<ConsoleProps> = () => {
    const { currentStep, astError } = useSimulatorStore()

    const formatJSValue = (value: JSValue): React.ReactNode => {
        if (value.type === 'primitive') {
            if (value.value === undefined) {
                return <span className="text-gray-500 italic">undefined</span>
            }
            if (value.value === null) {
                return <span className="text-gray-500 italic">null</span>
            }
            if (typeof value.value === 'string') {
                return <span className="text-green-600">"{value.value}"</span>
            }
            if (typeof value.value === 'number') {
                return <span className="text-blue-600">{value.value}</span>
            }
            if (typeof value.value === 'boolean') {
                return <span className="text-purple-600">{String(value.value)}</span>
            }
            return <span className="text-gray-900">{String(value.value)}</span>
        } else if (value.type === 'reference') {
            return <span className="text-orange-600">[Object {value.ref}]</span>
        }
        return <span className="text-gray-900">{String(value)}</span>
    }

    const getConsoleOutput = () => {
        const output = []

        // Add AST error if present
        if (astError) {
            output.push({
                type: 'error' as const,
                values: [{ type: 'primitive' as const, value: astError }]
            })
        }

        // Add regular console output
        if (currentStep?.consoleSnapshot) {
            output.push(...currentStep.consoleSnapshot)
        }

        return output
    }

    const getConsoleIcon = (type: string) => {
        switch (type) {
            case 'error':
                return (
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                )
            case 'warn':
                return (
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                )
            case 'info':
                return (
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                )
            case 'debug':
                return (
                    <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                )
            default:
                return (
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                )
        }
    }

    const getConsoleStyle = (type: string) => {
        switch (type) {
            case 'error':
                return 'bg-red-50 border-l-4 border-red-500'
            case 'warn':
                return 'bg-yellow-50 border-l-4 border-yellow-500'
            case 'info':
                return 'bg-blue-50 border-l-4 border-blue-500'
            case 'debug':
                return 'bg-gray-50 border-l-4 border-gray-500'
            default:
                return 'bg-white border-l-4 border-gray-300'
        }
    }

    const consoleOutput = getConsoleOutput()

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Console Content */}
            <div className="flex-1 overflow-auto bg-white">
                {consoleOutput.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                        <div className="text-center">
                            <p className="text-sm">No console output yet</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-0">
                        {consoleOutput.map((entry, index) => (
                            <div
                                key={index}
                                className={`flex items-start space-x-2 px-3 py-2 hover:bg-gray-50 transition-colors ${getConsoleStyle(entry.type)}`}
                            >
                                <div className="flex-shrink-0 mt-0.5">
                                    {getConsoleIcon(entry.type)}
                                </div>
                                <div className="flex-1 font-mono text-sm leading-relaxed">
                                    {entry.values.map((value, valueIndex) => (
                                        <span key={valueIndex}>
                                            {formatJSValue(value)}
                                            {valueIndex < entry.values.length - 1 ? ' ' : ''}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default ConsoleOutput 