import React from 'react'
import { Link, useParams } from 'react-router'
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'
import { EXAMPLES_CONFIG } from '@/configs/examples.config'
import { type ExampleConfig, examplesCategories } from '@/types/examples'
import { getExampleById } from '@/helpers/examples'
import { useModeToggle } from '@/hooks/useModeToggle'
import { BookOpenIcon, CodeIcon, ZapIcon, LayersIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const DesktopMenu: React.FC = () => {
    const { exampleId } = useParams()
    const { currentMode } = useModeToggle()

    const getExampleUrl = (exampleId: string) => {
        const example = getExampleById(exampleId)
        if (example && example.active) {
            return currentMode === 'RUN'
                ? {
                    pathname: `/examples/${exampleId}`,
                    search: "?mode=run"
                }
                : {
                    pathname: `/examples/${exampleId}`
                }
        }
        return '#'
    }

    const currentExample = exampleId ? getExampleById(exampleId) : null

    const groupedExamples = EXAMPLES_CONFIG.reduce((acc, example) => {
        if (!acc[example.category]) {
            acc[example.category] = []
        }
        acc[example.category].push(example)
        return acc
    }, {} as Record<string, ExampleConfig[]>)

    const categoryLabels = examplesCategories.reduce((acc, category) => {
        acc[category] = category.charAt(0).toUpperCase() + category.slice(1)
        return acc
    }, {} as Record<(typeof examplesCategories)[number], string>)

    const categoryIcons = {
        basics: CodeIcon,
        functions: ZapIcon,
        classes: LayersIcon,
        advanced: BookOpenIcon
    }

    const ListItem = React.forwardRef<
        React.ElementRef<typeof Link>,
        React.ComponentPropsWithoutRef<typeof Link>
    >(({ className, title, children, ...props }, ref) => {
        return (
            <li>
                <NavigationMenuLink asChild>
                    <Link
                        ref={ref}
                        className={cn(
                            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                            className
                        )}
                        {...props}
                    >
                        <div className="text-sm font-medium leading-none">{title}</div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                            {children}
                        </p>
                    </Link>
                </NavigationMenuLink>
            </li>
        )
    })
    ListItem.displayName = "ListItem"

    return (
        <NavigationMenu delayDuration={100} className='z-50'>
            <NavigationMenuList>
                <NavigationMenuItem>
                    <NavigationMenuTrigger
                        onClick={(e) => e.preventDefault()}
                        className={cn(
                            navigationMenuTriggerStyle(),
                            currentExample ? "text-blue-600 focus:text-blue-600" : ""
                        )}
                    >
                        Examples
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                        <div className="grid w-[800px] grid-cols-2 gap-10 p-6">
                            {Object.entries(groupedExamples).map(([category, examples]) => {
                                const IconComponent = categoryIcons[category as keyof typeof categoryIcons]
                                return (
                                    <div key={category} className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <IconComponent className="w-4 h-4 text-muted-foreground" />
                                            <h3 className="text-md font-semibold text-foreground">
                                                {categoryLabels[category as keyof typeof categoryLabels]}
                                            </h3>
                                        </div>
                                        <ul className="grid w-full grid-cols-1 gap-1">
                                            {examples.map((example) => (
                                                <ListItem
                                                    key={example.id}
                                                    title={example.title}
                                                    to={getExampleUrl(example.id)}
                                                    className={cn(
                                                        "cursor-pointer ml-8",
                                                        example.id === currentExample?.id
                                                            ? "bg-blue-50 text-blue-900 border border-blue-200"
                                                            : "",
                                                        !example.active && "opacity-50 cursor-not-allowed"
                                                    )}
                                                    aria-label={`Load ${example.title} example`}
                                                >
                                                    {example.description}
                                                </ListItem>
                                            ))}
                                        </ul>
                                    </div>
                                )
                            })}
                        </div>
                    </NavigationMenuContent>
                </NavigationMenuItem>
            </NavigationMenuList>
        </NavigationMenu>
    )
}

export default DesktopMenu
