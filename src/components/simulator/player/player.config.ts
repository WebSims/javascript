import { EXEC_STEP_TYPE, ExecStep, ExecStepType } from '@/types/simulator'

export interface StepConfigItem {
    tag: string | ((step: ExecStep) => string)
    className: string | ((step: ExecStep) => string)
    tooltip: string
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
