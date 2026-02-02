
import { GoogleGenAI } from "@google/genai";
import { AppConfig, Task, ProjectFile } from "../types";

// Validation helper
const validateConfig = (config: AppConfig) => {
  if (config.provider === 'google' && !config.googleKey && !process.env.API_KEY) {
    throw new Error("Google API Key is missing. Please check your setup or add a key in Settings.");
  }
  if (config.provider === 'openrouter' && !config.openRouterKey) {
    throw new Error("OpenRouter API Key is missing. Please enter it in Settings.");
  }
};

// Helper to extract file blocks from AI response
export const extractFilesFromOutput = (text: string): ProjectFile[] => {
  const files: ProjectFile[] = [];
  // Regex to match <file path="...">content</file>
  const regex = /<file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const path = match[1];
    let content = match[2];
    content = content.trim();
    
    // Basic language inference
    let language = 'plaintext';
    if (path.endsWith('.js') || path.endsWith('.jsx') || path.endsWith('.ts') || path.endsWith('.tsx')) language = 'javascript';
    if (path.endsWith('.html')) language = 'html';
    if (path.endsWith('.css')) language = 'css';
    if (path.endsWith('.json')) language = 'json';

    files.push({ path, content, language });
  }
  return files;
};

// Helper to find JSON in messy model output
const parseJSONFromText = (text: string): any => {
  try {
    // 1. Try direct parse
    return JSON.parse(text);
  } catch (e) {
    // 2. Try extracting from markdown block
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
      try { return JSON.parse(markdownMatch[1]); } catch (e2) { /* continue */ }
    }

    // 3. Try finding the first '{' and last '}'
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = text.substring(firstBrace, lastBrace + 1);
      try { return JSON.parse(jsonCandidate); } catch (e3) { /* continue */ }
    }

    throw new Error("Could not parse valid JSON from AI response.");
  }
};

const getGoogleClient = (config: AppConfig) => {
    const apiKey = config.googleKey || process.env.API_KEY;
    if (!apiKey) throw new Error("No Google API Key available.");
    return new GoogleGenAI({ apiKey });
};

const callAI = async (systemPrompt: string, userPrompt: string, config: AppConfig, jsonMode = false): Promise<string> => {
    validateConfig(config);
    
    if (config.provider === 'google') {
      const ai = getGoogleClient(config);
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `${systemPrompt}\n\nUser: ${userPrompt}`,
        config: jsonMode ? { responseMimeType: "application/json" } : undefined
      });
      return response.text || "";
    } else {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "NexBuilder"
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    }
};

export const generateProjectPlan = async (
  prompt: string, 
  config: AppConfig
): Promise<{ name: string; tasks: Task[]; packages: string[] }> => {
  
  const systemPrompt = `
    You are an expert Technical Architect.
    Break down a user's app idea into a DAG of executable tasks.
    
    Output JSON:
    {
      "name": "Project Name",
      "packages": ["react", "framer-motion"], // List of NPM packages required
      "tasks": [
        {
          "id": "unique_id",
          "title": "Task Title",
          "description": "Detailed instruction.",
          "agentRole": "architect" | "developer",
          "dependencies": []
        }
      ]
    }
  `;

  try {
    const responseText = await callAI(systemPrompt, prompt, config, true);
    const parsed = parseJSONFromText(responseText);

    if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
      throw new Error("Invalid plan generated.");
    }

    return {
        name: parsed.name || "Untitled Project",
        tasks: parsed.tasks,
        packages: parsed.packages || []
    };

  } catch (error) {
    console.error("AI Plan Error:", error);
    throw error;
  }
};

export const decomposeTask = async (task: Task, config: AppConfig): Promise<Task[]> => {
  const systemPrompt = `
    Split this task into 2-4 sequential sub-tasks.
    Output JSON Array: [{"title": "...", "description": "...", "agentRole": "developer"}]
  `;
  const responseText = await callAI(systemPrompt, JSON.stringify(task), config, true);
  const parsed = parseJSONFromText(responseText);
  return Array.isArray(parsed) ? parsed : parsed.tasks || [];
};

export const refineTaskDescription = async (
    currentDescription: string, 
    taskTitle: string,
    config: AppConfig
): Promise<string> => {
    const systemPrompt = `
      You are a Senior Tech Lead.
      Refine the following task instruction to be highly detailed, technical, and actionable for an AI developer.
      Include specific requirements, edge cases to handle, and suggested implementation details.
      Keep it as a plain text string (markdown allowed).
    `;
    const userPrompt = `Task: ${taskTitle}\nDraft Instructions: ${currentDescription}`;
    return await callAI(systemPrompt, userPrompt, config, false);
};

export const executeTask = async (
  task: Task, 
  context: string, 
  packages: string[],
  config: AppConfig
): Promise<string> => {
  
  const packageImportInstructions = packages.length > 0 
    ? `
      AVAILABLE PACKAGES: ${packages.join(', ')}
      IMPORTANT: When using these packages in frontend code (HTML/JS/React), you MUST import them via ESM.SH.
      Example: import React from "https://esm.sh/react";
      Example: import { motion } from "https://esm.sh/framer-motion";
      Do not use 'require' or bare module specifiers.
    ` 
    : '';

  const systemPrompt = `
    You are an expert AI ${task.agentRole}.
    Task: ${task.title}
    Description: ${task.description}
    
    ${packageImportInstructions}

    Context:
    ${context}
    
    INSTRUCTIONS:
    1. Write code inside strict <file path="filename.ext">...</file> tags.
    2. Do not use markdown code blocks for the file tags.
    3. Provide full file content.
  `;

  return await callAI(systemPrompt, "Execute this task.", config, false);
};
