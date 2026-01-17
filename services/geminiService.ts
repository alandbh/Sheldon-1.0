import { GoogleGenAI } from "@google/genai";
import { INITIAL_SYSTEM_INSTRUCTION, RESPONSE_FORMATTER_PROMPT } from "../constants";

export class GeminiService {
  private client: GoogleGenAI;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new GoogleGenAI({ apiKey });
  }

  async generatePythonScript(userPrompt: string): Promise<string> {
    try {
      const response = await this.client.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: userPrompt,
        config: {
          systemInstruction: INITIAL_SYSTEM_INSTRUCTION,
          temperature: 0.1, // Low temperature for precise code generation
        },
      });

      let script = response.text || "";
      
      // Clean up markdown code blocks if the model includes them despite instructions
      script = script.replace(/```python/g, "").replace(/```/g, "").trim();
      
      return script;
    } catch (error) {
      console.error("Error generating script:", error);
      throw new Error("Failed to generate analysis script.");
    }
  }

  async generateNaturalLanguageResponse(userPrompt: string, pythonOutput: string): Promise<string> {
    try {
      const prompt = `
      PERGUNTA ORIGINAL DO USUÁRIO: "${userPrompt}"
      
      DADOS BRUTOS CALCULADOS PELO PYTHON:
      ${pythonOutput}
      
      Gere a resposta final para o usuário.
      `;

      const response = await this.client.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
        config: {
          systemInstruction: RESPONSE_FORMATTER_PROMPT,
        },
      });

      return response.text || "Erro ao formatar resposta final.";
    } catch (error) {
      console.error("Error generating response:", error);
      throw new Error("Failed to format final response.");
    }
  }
}