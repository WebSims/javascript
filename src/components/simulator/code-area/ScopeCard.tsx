import React, { useMemo } from "react"
import * as ESTree from "estree"
import { ESNode } from "hermes-parser"
import type { ScopeMorphEntry } from "@/contexts/ScopeMorphContext"
import type { CallFrame } from "@/hooks/useFunctionCallStack"
import type { ExecStep } from "@/types/simulator"
import { ScopedStepContext } from "@/contexts/ScopedStepContext"
import ActiveCallFrameContext from "@/contexts/ActiveCallFrameContext"
import ScopeOverlayContext from "@/contexts/ScopeOverlayContext"
import { useOpenScopeOverlays } from "@/hooks/useOpenScopeOverlays"
import CodeArea from "./CodeArea"

interface ScopeCardProps {
  entry: ScopeMorphEntry
  cardIndex: number
  activeCardIndex: number
  totalEntries: number
  frames: CallFrame[]
  steps: ExecStep[]
  currentStep: ExecStep | null
  containerRect: DOMRect | null
}

const ScopeCardBody: React.FC<{
  entry: ScopeMorphEntry
  parens: Set<number>
}> = ({ entry, parens }) => {
  const scopeOverlay = useOpenScopeOverlays()
  const fnNode = entry.frame.fnNode
  const body = fnNode.body as ESTree.BlockStatement & ESNode
  const isBlockBody = body.type === "BlockStatement"
  const bodyAst = isBlockBody
    ? (body.body as unknown as ESNode[])
    : [body as unknown as ESNode]

  return (
    <ActiveCallFrameContext.Provider value={{ activeFrame: entry.frame }}>
      <ScopeOverlayContext.Provider value={scopeOverlay}>
        <div className="h-full overflow-auto">
          <CodeArea
            ast={bodyAst}
            parent={isBlockBody ? body : (fnNode as unknown as ESNode)}
            parens={parens}
          />
        </div>
      </ScopeOverlayContext.Provider>
    </ActiveCallFrameContext.Provider>
  )
}

const ANIM_DURATION = 3000
const ANIM_CONTENT_DELAY = 1500
const ANIM_CONTENT_FADE = 1500
const ANIM_EASING = "cubic-bezier(0.25, 0.8, 0.25, 1)"
const ANIM_DEPTH = 1500
const BRACE_W = 14

const buildPosTransition = (dur: number, ease: string) =>
  `top ${dur}ms ${ease}, left ${dur}ms ${ease}, height ${dur}ms ${ease}`

const BraceSvg: React.FC<{ side: "left" | "right" }> = ({ side }) => {
  const d = side === "left"
    ? "M 10 0 C 5 0, 3 3, 3 8 L 3 43 C 3 47, 1 49, 0 50 C 1 51, 3 53, 3 57 L 3 92 C 3 97, 5 100, 10 100"
    : "M 0 0 C 5 0, 7 3, 7 8 L 7 43 C 7 47, 9 49, 10 50 C 9 51, 7 53, 7 57 L 7 92 C 7 97, 5 100, 0 100"

  return (
    <svg
      viewBox="0 0 10 100"
      preserveAspectRatio="none"
      className="w-full h-full"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

const ScopeCard: React.FC<ScopeCardProps> = ({
  entry,
  cardIndex,
  activeCardIndex,
  totalEntries,
  frames,
  steps,
  currentStep,
  containerRect,
}) => {
  const { phase, originRect, callerLabel, callerHtml, definitionLabel } = entry
  const cH = containerRect?.height ?? 400
  const cW = containerRect?.width ?? 600

  const hasOrigin = !!originRect && !!containerRect
  
  const isEntering = phase === "entering"
  const isExiting = phase === "exiting"
  const isCollapsed = isEntering || isExiting
  const noTransition = isEntering
  const easing = isExiting ? "cubic-bezier(0.8, 0, 0.2, 1)" : ANIM_EASING
  
  // Calculate exact target destination based on origin
  const originTop = hasOrigin ? originRect!.top - containerRect!.top : cH * 0.4
  const originLeft = hasOrigin ? originRect!.left - containerRect!.left : cW * 0.4
  const originWidth = hasOrigin ? originRect!.width : 60
  const originHeight = hasOrigin ? originRect!.height : 20
  const scopedStep = useMemo(() => {
    const frameIdx = cardIndex
    if (frames.length > frameIdx + 1) {
      return steps[frames[frameIdx + 1].stepIndex] ?? currentStep
    }
    return currentStep
  }, [cardIndex, frames, steps, currentStep])

  const startIndex = useMemo(() => {
    return frames[cardIndex]?.stepIndex ?? 0
  }, [cardIndex, frames])

  const parens = useMemo(() => new Set<number>(), [])

  // Card background fades in
  const bgStyle = useMemo((): React.CSSProperties => ({
    opacity: isCollapsed ? 0 : 1,
    transition: noTransition
      ? "none"
      : `opacity ${ANIM_DURATION}ms ${easing}`,
  }), [isCollapsed, noTransition, easing])

  // Caller label moves to top left
  const labelWrapperStyle = useMemo((): React.CSSProperties => ({
    position: "absolute",
    top: isCollapsed ? originTop : 4,
    left: isCollapsed ? originLeft : BRACE_W + 8,
    zIndex: 30,
    pointerEvents: "none",
    display: "flex",
    alignItems: "flex-start",
    transition: noTransition
      ? "none"
      : `top ${ANIM_DURATION}ms ${easing}, left ${ANIM_DURATION}ms ${easing}`,
  }), [isCollapsed, originTop, originLeft, noTransition, easing])

  // Braces start at origin and expand to sides
  const leftBraceBoxStyle = useMemo((): React.CSSProperties => ({
    position: "absolute",
    top: isCollapsed ? originTop : 0,
    left: isCollapsed ? originLeft : 0,
    height: isCollapsed ? originHeight : cH,
    width: BRACE_W,
    zIndex: 25,
    opacity: isCollapsed ? 0 : 1,
    transition: noTransition ? "none" : `${buildPosTransition(ANIM_DURATION, easing)}, opacity ${ANIM_DURATION}ms ${easing}`,
  }), [isCollapsed, originTop, originLeft, originHeight, cH, noTransition, easing])

  const rightBraceBoxStyle = useMemo((): React.CSSProperties => ({
    position: "absolute",
    top: isCollapsed ? originTop : 0,
    left: isCollapsed ? originLeft + originWidth : cW - BRACE_W,
    height: isCollapsed ? originHeight : cH,
    width: BRACE_W,
    zIndex: 25,
    opacity: isCollapsed ? 0 : 1,
    transition: noTransition ? "none" : `${buildPosTransition(ANIM_DURATION, easing)}, opacity ${ANIM_DURATION}ms ${easing}`,
  }), [isCollapsed, originTop, originLeft, originWidth, originHeight, cH, cW, noTransition, easing])

  const isAboveActive = cardIndex > activeCardIndex
  const distanceFromActive = activeCardIndex - cardIndex

  const outerStyle = useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = {
      zIndex: 10 + cardIndex,
      transition: `opacity ${ANIM_DEPTH}ms ease, filter ${ANIM_DEPTH}ms ease`,
    }

    if (phase === "exiting") {
      return { ...base, pointerEvents: "none" }
    }

    if (isAboveActive) {
      return {
        ...base,
        opacity: 0.12,
        filter: "blur(2px)",
        pointerEvents: "none",
      }
    }

    if (distanceFromActive > 0) {
      const d = distanceFromActive
      return {
        ...base,
        opacity: Math.max(0.4, 1 - d * 0.2),
        filter: `blur(${d * 1.5}px)`,
        pointerEvents: "none",
      }
    }

    return base
  }, [cardIndex, phase, isAboveActive, distanceFromActive])

  const contentOpacity = phase === "entering" ? 0 : 1

  return (
    <div className="absolute inset-0" style={outerStyle}>
      <div className="scope-card absolute inset-0" style={bgStyle}>
        <div className="absolute inset-0 bg-white/[0.97]" />

        <div
          className="h-full relative z-10 pt-6"
          style={{
            paddingLeft: BRACE_W + 8,
            paddingRight: BRACE_W + 8,
            opacity: contentOpacity,
            transition: `opacity ${ANIM_CONTENT_FADE}ms ease ${ANIM_CONTENT_DELAY}ms`,
          }}
        >
          <ScopedStepContext.Provider
            value={{ step: scopedStep, startIndex }}
          >
            <ScopeCardBody entry={entry} parens={parens} />
          </ScopedStepContext.Provider>
        </div>
      </div>

      <div style={labelWrapperStyle}>
        <div className="flex items-start gap-1.5 relative">
          <div className="relative">
            <span
              className="font-mono text-[11px] font-medium text-blue-500/80 whitespace-nowrap flex items-center h-full"
              style={{
                opacity: isCollapsed ? 0 : 1,
                transition: noTransition ? "none" : `opacity ${ANIM_DURATION}ms ${easing}`,
              }}
            >
              {definitionLabel}
            </span>
            {!callerHtml && (
              <div
                className="font-mono text-[11px] font-medium text-blue-500/80 absolute left-0 top-0 whitespace-nowrap"
                style={{
                  opacity: isCollapsed ? 1 : 0,
                  transition: noTransition ? "none" : `opacity ${ANIM_DURATION}ms ${easing}`,
                }}
              >
                {callerLabel}
              </div>
            )}
          </div>
          <span
            className="text-[9px] font-medium px-1 py-px rounded bg-blue-100/60 text-blue-400 self-center"
            style={{
              opacity: isCollapsed ? 0 : 1,
              transition: noTransition ? "none" : `opacity ${ANIM_DURATION}ms ${easing}`,
            }}
          >
            {cardIndex + 1}/{totalEntries}
          </span>
        </div>
      </div>

      {/* Exact Caller HTML Clone Overlay */}
      {callerHtml && (
        <div
          className="absolute z-40 pointer-events-none font-mono origin-top-left"
          style={{
            top: isCollapsed ? originTop : 4,
            left: isCollapsed ? originLeft : BRACE_W + 8,
            opacity: isCollapsed ? 1 : 0,
            transform: isCollapsed ? "scale(1)" : "scale(0.8)",
            transition: noTransition
              ? "none"
              : `top ${ANIM_DURATION}ms ${easing}, left ${ANIM_DURATION}ms ${easing}, opacity ${ANIM_DURATION}ms ${easing}, transform ${ANIM_DURATION}ms ${easing}`,
          }}
          dangerouslySetInnerHTML={{ __html: callerHtml }}
        />
      )}
      <div
        className="text-slate-300 select-none pointer-events-none"
        style={leftBraceBoxStyle}
        aria-hidden="true"
      >
        <BraceSvg side="left" />
      </div>

      <div
        className="text-slate-300 select-none pointer-events-none"
        style={rightBraceBoxStyle}
        aria-hidden="true"
      >
        <BraceSvg side="right" />
      </div>
    </div>
  )
}

export default ScopeCard
