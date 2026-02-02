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

export const generateProjectPlan = async (
  prompt: string, 
  config: AppConfig
): Promise<{ name: string; tasks: Task[] }> => {
  
  validateConfig(config);

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
    4. Return raw JSON.
  `;

  const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}`;
  let responseText = "";

  try {
    if (config.provider === 'google') {
      const ai = getGoogleClient(config);
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: fullPrompt,
        config: { responseMimeType: "application/json" }
      });
      responseText = response.text || "{}";
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
            { role: "user", content: prompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      responseText = data.choices?.[0]?.message?.content || "{}";
    }

    const parsed = parseJSONFromText(responseText);

    if (!parsed.tasks || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      throw new Error("AI returned a valid JSON object but it contained no tasks.");
    }

    return {
        name: parsed.name || "Untitled Project",
        tasks: parsed.tasks
    };

  } catch (error) {
    console.error("AI Service Error (generateProjectPlan):", error);
    throw error; // Propagate error to UI
  }
};

export const decomposeTask = async (
  task: Task,
  config: AppConfig
): Promise<Task[]> => {
  
  validateConfig(config);

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
  `;

  let responseText = "";

  try {
    if (config.provider === 'google') {
      const ai = getGoogleClient(config);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: systemPrompt,
        config: { responseMimeType: "application/json" }
      });
      responseText = response.text || "[]";
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
      
      if (!response.ok) throw new Error("OpenRouter API Error");
      const data = await response.json();
      responseText = data.choices?.[0]?.message?.content || "[]";
    }
    
    const parsed = parseJSONFromText(responseText);
    return Array.isArray(parsed) ? parsed : parsed.tasks || [];
  } catch (e) {
    console.error("Failed to parse decomposition", e);
    throw new Error("Failed to decompose task: " + (e as Error).message);
  }
};

export const executeTask = async (
  task: Task, 
  context: string, 
  config: AppConfig
): Promise<string> => {
  
  validateConfig(config);

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

  try {
    if (config.provider === 'google') {
      const ai = getGoogleClient(config);
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
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
      
      if (!response.ok) throw new Error(`OpenRouter Error: ${response.status}`);
      
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    }
  } catch (error) {
     console.error("Task Execution Error", error);
     throw error;
  }
};