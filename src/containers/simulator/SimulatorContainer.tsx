import React, { useEffect } from 'react'
import { useParams } from 'react-router'
import { useHotkeys } from 'react-hotkeys-hook'

import CodeMode from './components/CodeMode'
import MainLayout from '@/layouts/MainLayout'
import ExecutionMode from './components/ExecutionMode'

import { useSimulatorStore } from '@/hooks/useSimulatorStore'

const exampleFiles = import.meta.glob('/src/examples/**', { query: '?raw', import: 'default', eager: true })

const getExamplesMap = () => {
  const map = {} as Record<string, Record<string, string>>
  Object.entries(exampleFiles).forEach(([path, content]) => {
    const relPathMatch = path.match(/\/src\/examples\/(.+)$/)
    if (!relPathMatch) return
    const relPath = relPathMatch[1]
    const exampleId = relPath.split('/')[0]
    if (!map[exampleId]) map[exampleId] = {}
    map[exampleId][relPath] = content as string
  })
  return map
}
const examplesMap = getExamplesMap()

const SimulatorContainer: React.FC = () => {
  const { exampleId } = useParams()
  const { mode, files, initializeFiles, activeFile, toggleMode } = useSimulatorStore()

  useEffect(() => {
    if (exampleId) {
      const exampleFiles = examplesMap[exampleId]
      if (exampleFiles) {
        initializeFiles(exampleFiles)
      }
    } else {
      const savedFilesString = localStorage.getItem('simulatorFiles')
      const savedFiles = JSON.parse(savedFilesString || '{}')

      if (!savedFilesString || Object.keys(savedFiles).length === 0) {
        initializeFiles({ 'main.js': '' })
      } else {
        initializeFiles(savedFiles)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, exampleId])

  useHotkeys(
    'mod+s',
    (event) => {
      event.preventDefault()
      if (files && Object.keys(files).length > 0) {
        localStorage.setItem('simulatorFiles', JSON.stringify(files))
        console.log('Files saved to localStorage!')
        window.dispatchEvent(new CustomEvent('filesaved', {
          detail: { file: activeFile }
        }))
      }
    },
    { preventDefault: true },
    [files, activeFile]
  )

  useHotkeys(
    'mod+r',
    (event) => {
      event.preventDefault()
      if (mode !== 'EXECUTION') {
        toggleMode()
      }
    },
    { preventDefault: true },
    [mode, toggleMode]
  )

  useHotkeys(
    'mod+e',
    (event) => {
      event.preventDefault()
      if (mode !== 'CODE') {
        toggleMode()
      }
    },
    { preventDefault: true },
    [mode, toggleMode]
  )

  return (
    <MainLayout>
      {mode === 'CODE' && <CodeMode />}
      {mode === 'EXECUTION' && <ExecutionMode />}
    </MainLayout>
  )
}

export default SimulatorContainer