import { Button } from '@/components/ui/button'
import React from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import { useDeviceDetection } from '@/hooks/useDeviceDetection'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { MenuIcon, ChevronDownIcon } from 'lucide-react'
import ExecutionBar from '@/components/simulator/execution-bar/ExecutionBar'
interface MainLayoutProps {
    children: React.ReactNode
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { isDesktop } = useDeviceDetection()
    const { mode, toggleMode } = useSimulatorStore()

    return (
        <div className='h-screen'>
            <header className='h-12 bg-background justify-between items-center flex px-3 border-b border-slate-200'>
                <div className='lg:hidden'>
                    <MenuIcon className='w-6 h-6' />
                </div>

                <div className='hidden lg:flex w-full items-center gap-2'>
                    <div className='font-bold text-lg'>
                        WebSims.org/js
                    </div>
                    {isDesktop && mode === 'CODE' ? (
                        <nav className='flex items-center gap-2'>
                            example drop dropdown
                            <Button variant='ghost' size='icon'>
                                <ChevronDownIcon className='w-4 h-4' />
                            </Button>
                        </nav>
                    ) : <ExecutionBar />}
                </div>

                <div className='flex items-center gap-2'>
                    <div className="flex items-center space-x-2">
                        <Switch checked={mode === 'EXECUTION'} onCheckedChange={toggleMode} />
                        <Label>Execution</Label>
                    </div>
                </div>
            </header>
            <div className='h-[calc(100vh-48px)]'>
                {children}
            </div>
        </div>
    )
}

export default MainLayout