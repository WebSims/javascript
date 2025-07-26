import { STEP_CONFIG } from '@/components/simulator/player/player.config'
import { ExecStep, ExecStepType } from '@/types/simulator'

export const getStepConfig = (stepType: ExecStepType) => {
    return STEP_CONFIG[stepType]
}

export const getStepTag = (stepType: ExecStepType, step?: ExecStep): string => {
    const config = STEP_CONFIG[stepType]
    const tag = config.tag

    if (typeof tag === 'function' && step) {
        return tag(step)
    }

    return typeof tag === 'string' ? tag : ''
}

export const getStepClassName = (stepType: ExecStepType, step?: ExecStep): string => {
    const config = STEP_CONFIG[stepType]
    const className = config.className

    if (typeof className === 'function' && step) {
        return className(step)
    }

    return typeof className === 'string' ? className : ''
}

export const getStepTooltip = (stepType: ExecStepType): string => {
    return STEP_CONFIG[stepType].tooltip
}

export { STEP_CONFIG } 