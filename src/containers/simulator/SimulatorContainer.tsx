import React, { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'

import CodeMode from './components/CodeMode'
import MainLayout from '@/layouts/MainLayout'
import RunMode from './components/RunMode'
import EmailReminder from './components/EmailReminder'

import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import useSimulatorHotkeys from '@/hooks/useSimulatorHotkeys'
import { useModeToggle } from '@/hooks/useModeToggle'
import useEmailReminderTrigger from '@/hooks/useEmailReminderTrigger'
import { isEmpty } from 'lodash'

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
  const navigate = useNavigate()
  const { exampleId } = useParams()
  const { files, initializeFiles, activeFile } = useSimulatorStore()
  const { currentMode, toggleMode } = useModeToggle()
  const { shouldShowDrawer, dismissDrawer } = useEmailReminderTrigger()

  useEffect(() => {
    if (exampleId) {
      const exampleFiles = examplesMap[exampleId]
      if (exampleFiles) {
        initializeFiles(exampleFiles)
      } else {
        initializeFiles({ 'src/main.js': '' })
      }
    } else {
      const savedFilesString = localStorage.getItem('simulatorFiles')
      const savedFiles = JSON.parse(savedFilesString || '{}')

      if (savedFiles && !isEmpty(savedFiles)) {
        initializeFiles(savedFiles)
      } else {
        initializeFiles({ 'src/main.js': '' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exampleId])

  useSimulatorHotkeys({
    files,
    activeFile,
    mode: currentMode,
    toggleMode,
    exampleId,
    navigate
  })

  return (
    <MainLayout>
      {currentMode === 'CODE' && <CodeMode />}
      {currentMode === 'RUN' && <RunMode />}
      <EmailReminder
        isOpen={shouldShowDrawer}
        onClose={dismissDrawer}
      />
    </MainLayout>
  )
}

export default SimulatorContainer