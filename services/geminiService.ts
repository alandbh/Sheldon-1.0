import { GoogleGenAI } from "@google/genai";
import {
    GET_INITIAL_SYSTEM_INSTRUCTION,
    RESPONSE_FORMATTER_PROMPT,
} from "../constants";
import { Project } from "../projects-data";

const PYTHON_ONLY_INSTRUCTION = ``;

const DATASET_HINT = ``;

export class GeminiService {
    private client: GoogleGenAI;
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.client = new GoogleGenAI({ apiKey });
    }

    private sanitizePython(raw: string): string {
        if (!raw) return "";
        const fenceMatch = raw.match(/```(?:python)?\s*([\s\S]*?)```/i);
        const code = fenceMatch ? fenceMatch[1] : raw;
        return code
            .replace(/```python/gi, "")
            .replace(/```/g, "")
            .trim();
    }

    private looksLikePython(script: string): boolean {
        if (!script) return false;
        const nonCommentLine = script
            .split("\n")
            .some((line) => line.trim() && !line.trim().startsWith("#"));
        if (!nonCommentLine) return false;

        const pythonSignals = [
            /^(import|from)\s+\w+/m,
            /^def\s+\w+\s*\(/m,
            /^for\s+\w+\s+in\s+/m,
            /json\.load/,
            /players_current/,
        ];

        return pythonSignals.some((regex) => regex.test(script));
    }

    async generatePythonScript(
        userPrompt: string,
        project?: Project | null,
    ): Promise<string> {
        try {
            const systemInstruction = `${GET_INITIAL_SYSTEM_INSTRUCTION(project || undefined)}\n\n${PYTHON_ONLY_INSTRUCTION}`;
            const userMessage = `${userPrompt}

${DATASET_HINT}
Lembrete: responda somente com código Python executável, sem markdown ou texto extra.`;

            const response = await this.client.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ role: "user", parts: [{ text: userMessage }] }],
                config: {
                    systemInstruction,
                    temperature: 0.1, // Low temperature for precise code generation
                },
            });

            const script = this.sanitizePython(response.text || "");

            if (!this.looksLikePython(script)) {
                throw new Error(
                    "O Gemini não retornou um script Python. Tente novamente com outra formulação.",
                );
            }

            return script;
        } catch (error) {
            console.error("Error generating script:", error);
            throw new Error(
                "Are you sure that this question has anything to do with this study? Seriously?",
            );
        }
    }

    async generateNaturalLanguageResponse(
        userPrompt: string,
        pythonOutput: string,
    ): Promise<string> {
        try {
            const prompt = `
      PERGUNTA ORIGINAL DO USUÁRIO: "${userPrompt}"
      
      DADOS BRUTOS CALCULADOS PELO PYTHON:
      ${pythonOutput}
      
      Gere a resposta final para o usuário.
      `;

            const response = await this.client.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
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
