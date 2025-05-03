import React, { useEffect, useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon, BookOpenIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useSimulatorStore } from '@/hooks/useSimulatorStore'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import CHEAT_SHEET_DATA from '@/components/simulator/cheat-sheet/CheatSheetData.json'
import CheatSheetBox from '@/components/simulator/cheat-sheet/components/CheatSheetBox'
import useDeviceDetection from '@/hooks/useDeviceDetection'
import CheatSheet from '@/components/simulator/cheat-sheet/CheatSheet'

type CheatSheetDataType = Record<string, string>

interface CheatSheetAccordionProps {
    open?: boolean
    onOpenChange?: (isOpen: boolean) => void
}

const CheatSheetAccordion: React.FC<CheatSheetAccordionProps> = ({ open = true, onOpenChange }) => {
    const { isDesktop } = useDeviceDetection()
    const { cheatSheetRef, highlightedId } = useSimulatorStore()
    const [isOpen, setIsOpen] = useState<boolean>(open)

    const handleOpenChange = (value: boolean) => {
        setIsOpen(value)
        onOpenChange?.(value)
    }

    const getTopLevelCategories = () => {
        return Object.keys(CHEAT_SHEET_DATA as CheatSheetDataType).filter(key => !key.includes('/'))
    }

    const topLevelCategories = getTopLevelCategories()

    return (
        <div className='h-full' ref={cheatSheetRef}>
            <Tabs
                defaultValue={topLevelCategories[0]}
                value={highlightedId?.split('-')[0]}
                className='w-full h-full overflow-hidden'
            >
                <div className='h-full w-full flex flex-col justify-center'>
                    <div className={`flex items-center justify-between px-3 ${isOpen && isDesktop ? 'py-2 border-b border-slate-100' : 'py-1 text-sm'}`}>
                        {isOpen && !isDesktop ? (
                            <TabsList>
                                {topLevelCategories.map((category) => (
                                    <span
                                        key={category}
                                        className='cheat-sheet-item'
                                    >
                                        <TabsTrigger key={category} value={category} id={category} >
                                            {(CHEAT_SHEET_DATA as CheatSheetDataType)[category]}
                                        </TabsTrigger>
                                    </span>
                                ))}
                            </TabsList>
                        ) : (
                            <div className="flex items-center gap-2">
                                <BookOpenIcon className={`${isOpen ? 'h-5 w-5' : 'h-4 w-4'} text-muted-foreground`} />
                                <h4 className="font-semibold text-foreground">Cheat Sheet</h4>
                            </div>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenChange(!isOpen)}
                            aria-label={isOpen ? "Collapse cheat sheet" : "Expand cheat sheet"}
                            aria-expanded={isOpen}
                            className="h-6 w-6 hover:bg-accent/80 transition-colors"
                        >
                            {isOpen ? (
                                <ChevronUpIcon className="transition-transform duration-200" />
                            ) : (
                                <ChevronDownIcon className="transition-transform duration-200" />
                            )}
                        </Button>
                    </div>
                    <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'h-[calc(100%-48px)] opacity-100' : 'h-0 opacity-0'}`}
                    >
                        {isDesktop ? <CheatSheet /> :
                            <div className='flex flex-col'>
                                {topLevelCategories.map((category) => (
                                    <TabsContent key={category} value={category} className='h-full'>
                                        <CheatSheetBox
                                            path={category}
                                            data={CHEAT_SHEET_DATA as CheatSheetDataType}
                                        />
                                    </TabsContent>
                                ))}
                            </div>
                        }
                    </div>
                </div>
            </Tabs>
        </div >
    )
}

export default CheatSheetAccordion