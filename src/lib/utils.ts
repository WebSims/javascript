import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Import package.json directly
import packageJson from '../../package.json'

export const getAppVersion = (): string => {
  return packageJson.version
}
