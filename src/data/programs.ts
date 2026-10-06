import type { Project } from './types'
import { loadCollection, replaceAll } from './demo-store'

const SEED_PROJECTS: Project[] = [
  {
    id: 'prog-1',
    name: 'Project Gold',
    client: 'Halcyon Robotics',
    archived: false,
  },
  {
    id: 'prog-2',
    name: 'Project Sonic',
    client: 'Brightpath Health',
    archived: false,
  },
  {
    id: 'prog-3',
    name: 'Project Atlas',
    client: 'Orbit Retail',
    archived: false,
  },
]

export const PROJECTS: Project[] = loadCollection('projects', SEED_PROJECTS)

export function saveProjects(next: Project[]): void {
  replaceAll('projects', PROJECTS, next)
}
