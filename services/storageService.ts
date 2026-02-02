import { get, set, del } from 'idb-keyval';
import { Project, AppConfig } from '../types';

const PROJECT_KEY = 'nexbuilder_project';
const CONFIG_KEY = 'nexbuilder_config';
const IDEA_KEY = 'nexbuilder_idea';

export const saveProject = async (project: Project) => {
  await set(PROJECT_KEY, project);
};

export const loadProject = async (): Promise<Project | undefined> => {
  return await get(PROJECT_KEY);
};

export const clearProject = async () => {
  await del(PROJECT_KEY);
  await del(IDEA_KEY);
};

export const saveConfig = async (config: AppConfig) => {
  await set(CONFIG_KEY, config);
};

export const loadConfig = async (): Promise<AppConfig | undefined> => {
  return await get(CONFIG_KEY);
};

export const saveIdea = async (idea: string) => {
  await set(IDEA_KEY, idea);
};

export const loadIdea = async (): Promise<string | undefined> => {
  return await get(IDEA_KEY);
};