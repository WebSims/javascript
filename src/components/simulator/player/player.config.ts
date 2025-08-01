import { EXEC_STEP_TYPE, ExecStep, ExecStepType } from '@/types/simulator'

export interface StepConfigItem {
    tag: string | ((step: ExecStep) => string)
    className: string | ((step: ExecStep) => string)
    tooltip: string
}

// Depth-based color configuration for scopes
export interface ScopeColorConfig {
    backgroundColor: string
    borderColor: string
    textColor: string
}

export const getScopeColorsByDepth = (depth: number, maxDepth: number, isFunctionScope: boolean = false): ScopeColorConfig => {
    // Calculate lightness based on depth percentage
    const baseLightness = 25
    const maxLightness = 75
    const lightnessRange = maxLightness - baseLightness

    const depthPercentage = maxDepth > 0 ? depth / maxDepth : 0
    const lightness = baseLightness + (depthPercentage * lightnessRange)

    if (isFunctionScope) {
        // Blue color scheme for function scopes
        return {
            backgroundColor: `hsl(220, 100%, ${lightness}%)`,
            borderColor: `hsl(220, 100%, ${Math.max(lightness - 20, 10)}%)`,
            textColor: lightness > 50 ? '#1e293b' : '#ffffff'
        }
    } else {
        // Grayscale for regular scopes
        return {
            backgroundColor: `hsl(0, 0%, ${lightness}%)`,
            borderColor: `hsl(0, 0%, ${Math.max(lightness - 20, 10)}%)`,
            textColor: lightness > 50 ? '#1e293b' : '#ffffff'
        }
    }
}

export const getScopeColorsByType = (scopeType: string): ScopeColorConfig => {
    switch (scopeType) {
        case 'global':
            return {
                backgroundColor: '#e9d8fd',
                borderColor: '#9f7aea',
                textColor: '#1e293b'
            }
        case 'function':
            return {
                backgroundColor: '#c6f6d5',
                borderColor: '#68d391',
                textColor: '#1e293b'
            }
        case 'block':
            return {
                backgroundColor: '#fee2e2',
                borderColor: '#f87171',
                textColor: '#1e293b'
            }
        default:
            return {
                backgroundColor: '#e2e8f0',
                borderColor: '#a0aec0',
                textColor: '#1e293b'
            }
    }
}

export const STEP_CONFIG: Record<ExecStepType, StepConfigItem> = {
    [EXEC_STEP_TYPE.SCRIPT_EXECUTION]: {
        tag: 'S',
        className: 'bg-white',
        tooltip: 'Script Execution',
    },
    [EXEC_STEP_TYPE.PUSH_SCOPE]: {
        tag: '{',
        className: (step: ExecStep) => {
            if (step.memoryChange?.type === 'push_scope' && step.memoryChange.kind === 'function') {
                return 'bg-blue-100'
            }
            return 'bg-gray-100'
        },
        tooltip: 'Create Scope',
    },
    [EXEC_STEP_TYPE.HOISTING]: {
        tag: 'H',
        className: 'bg-orange-200',
        tooltip: 'Hoisting',
    },
    [EXEC_STEP_TYPE.POP_SCOPE]: {
        tag: '}',
        className: (step: ExecStep) => {
            if (step.memoryChange?.type === 'pop_scope' && step.memoryChange.kind === 'function') {
                return 'bg-blue-100'
            }
            return 'bg-gray-100'
        },
        tooltip: 'Remove Scope',
    },
    [EXEC_STEP_TYPE.EXECUTING]: {
        tag: 'S',
        className: 'bg-yellow-200',
        tooltip: 'Executing Statement',
    },
    [EXEC_STEP_TYPE.EXECUTED]: {
        tag: ';',
        className: 'bg-yellow-200',
        tooltip: 'Statement Executed',
    },
    [EXEC_STEP_TYPE.EVALUATING]: {
        tag: '(',
        className: 'bg-green-100',
        tooltip: 'Evaluating Expression',
    },
    [EXEC_STEP_TYPE.EVALUATED]: {
        tag: ')',
        className: 'bg-green-100',
        tooltip: 'Expression Evaluated',
    },
    [EXEC_STEP_TYPE.FUNCTION_CALL]: {
        tag: 'F',
        className: 'bg-purple-100',
        tooltip: 'Function Call',
    },
    [EXEC_STEP_TYPE.SCRIPT_EXECUTED]: {
        tag: 'S',
        className: 'bg-white',
        tooltip: 'Script Executed',
    },
}

export const TOOLTIP_WIDTH = 260
