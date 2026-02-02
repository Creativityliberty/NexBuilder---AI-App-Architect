import { GoogleGenAI } from "@google/genai";
import { AppConfig, Task, ProjectFile } from "../types";

// Helper to get config safely (still needed for OpenRouter)
const getApiKey = (config: AppConfig): string => {
  if (config.provider === 'google') return process.env.API_KEY || '';
  return config.openRouterKey;
};

// Helper to extract file blocks from AI response
export const extractFilesFromOutput = (text: string): ProjectFile[] => {
  const files: ProjectFile[] = [];
  // Regex to match <file path="...">content</file>
  // Using [\s\S]*? to match any character including newlines non-greedily
  const regex = /<file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const path = match[1];
    let content = match[2];
    
    // Clean up content (remove leading newlines/markdown blocks if mistakenly added)
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

export const generateProjectPlan = async (
  prompt: string, 
  config: AppConfig
): Promise<{ name: string; tasks: Task[] }> => {
  
  const systemPrompt = `
    You are an expert Technical Architect and Project Manager.
    Your goal is to break down a user's app idea into a directed acyclic graph (DAG) of executable tasks.
    
    Output MUST be valid JSON with the following structure:
    {
      "name": "Project Name",
      "tasks": [
        {
          "id": "unique_string_id",
          "title": "Task Title",
          "description": "Detailed instruction for the AI developer.",
          "agentRole": "architect" | "developer" | "reviewer",
          "dependencies": ["id_of_dependency_task"]
        }
      ]
    }

    Rules:
    1. Tasks must be granular and actionable.
    2. Define dependencies logically.
    3. IMPORTANT: Plan for a standard web structure (index.html, style.css, app.js) unless React/specific frameworks are requested.
    4. Do not wrap in markdown code blocks. Return raw JSON.
  `;

  const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}`;

  if (config.provider === 'google') {
    // Must use process.env.API_KEY directly as per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Upgraded to Pro for complex planning tasks
      contents: fullPrompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } else {
    // OpenRouter Implementation
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
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "{}";
    content = content.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(content);
  }
};

export const decomposeTask = async (
  task: Task,
  config: AppConfig
): Promise<Task[]> => {
  const systemPrompt = `
    You are a Senior Technical Lead.
    A developer needs this task broken down into 2-4 smaller, sequential sub-tasks.
    
    Current Task: ${task.title}
    Description: ${task.description}
    
    Output JSON array of objects (NO wrapping object, just the array):
    [
      {
        "title": "Subtask 1",
        "description": "...",
        "agentRole": "developer"
      },
      ...
    ]
    
    Rules:
    1. Keep it sequential.
    2. Be specific.
  `;

  let text = "";

  if (config.provider === 'google') {
    // Must use process.env.API_KEY directly as per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Flash is usually sufficient for simple decomposition, but can upgrade if needed
      contents: systemPrompt,
      config: { responseMimeType: "application/json" }
    });
    text = response.text || "[]";
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
        messages: [{ role: "user", content: systemPrompt }]
      })
    });
    const data = await response.json();
    text = data.choices?.[0]?.message?.content || "[]";
    text = text.replace(/```json/g, '').replace(/```/g, '');
  }
  
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed.tasks || [];
  } catch (e) {
    console.error("Failed to parse decomposition", e);
    return [];
  }
};

export const executeTask = async (
  task: Task, 
  context: string, 
  config: AppConfig
): Promise<string> => {
  const systemPrompt = `
    You are an expert AI ${task.agentRole}.
    Task: ${task.title}
    Description: ${task.description}
    
    Context from previous tasks:
    ${context}
    
    INSTRUCTIONS:
    1. Perform the task diligently.
    2. If you are writing code, you MUST output the code inside strict XML tags like this:
       <file path="filename.ext">
       ... code content ...
       </file>
    3. You can output multiple files in one response.
    4. Do NOT put the <file> tags inside markdown code blocks. Keep them raw so the parser can find them.
    5. If editing an existing file, provide the FULL new content of the file.
  `;

  if (config.provider === 'google') {
    // Must use process.env.API_KEY directly as per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Upgraded to Pro for coding tasks
      contents: systemPrompt,
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
        messages: [{ role: "user", content: systemPrompt }]
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
};