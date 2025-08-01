import { STEP_CONFIG } from '@/configs/steps.config'
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

export interface ScopeColorConfig {
    backgroundColor: string
    borderColor: string
    textColor: string
}

export const getStepColorByDepth = (depth: number, maxDepth: number, isFunctionScope: boolean = false): ScopeColorConfig => {
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