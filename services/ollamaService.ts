import {
    GET_INITIAL_SYSTEM_INSTRUCTION,
    RESPONSE_FORMATTER_PROMPT,
} from "../constants";
import { Project } from "../projects";

type ChatRole = "system" | "user" | "assistant";

interface ChatMessage {
    role: ChatRole;
    content: string;
}

interface OllamaConfig {
    baseUrl?: string;
    model?: string;
}

const getEnvValue = (key: string): string => {
    try {
        // @ts-ignore - Vite style env
        if (typeof import.meta !== "undefined" && import.meta.env?.[key]) {
            // @ts-ignore
            return import.meta.env[key] as string;
        }
    } catch (e) {}

    try {
        if (typeof process !== "undefined" && process.env?.[key]) {
            return process.env[key] as string;
        }
    } catch (e) {}

    return "";
};

export class OllamaService {
    private baseUrl: string;
    private model: string;

    constructor(config?: OllamaConfig) {
        const envBase =
            getEnvValue("VITE_OLLAMA_BASE_URL") ||
            getEnvValue("OLLAMA_BASE_URL") ||
            "http://localhost:11434";
        const envModel =
            getEnvValue("VITE_OLLAMA_MODEL") ||
            getEnvValue("OLLAMA_MODEL") ||
            "gemma3:4b";

        this.baseUrl = config?.baseUrl || envBase;
        this.model = config?.model || envModel;
    }

    private async chat(
        messages: ChatMessage[],
        temperature = 0.1,
    ): Promise<string> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        try {
            const res = await fetch(`${this.baseUrl}/api/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: this.model,
                    messages,
                    stream: false,
                    options: { temperature },
                }),
                signal: controller.signal,
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(
                    `Ollama error ${res.status}: ${text.slice(0, 200)}`,
                );
            }

            const data = await res.json();
            const content =
                data?.message?.content || data?.response || data?.content || "";
            if (!content) {
                throw new Error("Resposta vazia do Ollama.");
            }
            return typeof content === "string"
                ? content
                : JSON.stringify(content);
        } catch (err: any) {
            const reason =
                err?.name === "AbortError"
                    ? "Tempo limite ao chamar o Ollama."
                    : err?.message || "Falha ao chamar o Ollama.";
            throw new Error(reason);
        } finally {
            clearTimeout(timeout);
        }
    }

    async generatePythonScript(
        userPrompt: string,
        project?: Project | null,
    ): Promise<string> {
        const systemInstruction = GET_INITIAL_SYSTEM_INSTRUCTION(
            project || undefined,
        );

        const responseText = await this.chat(
            [
                { role: "system", content: systemInstruction },
                { role: "user", content: userPrompt },
            ],
            0.1,
        );

        let script = responseText || "";
        script = script
            .replace(/```python/gi, "")
            .replace(/```/g, "")
            .trim();
        return script;
    }

    async generateNaturalLanguageResponse(
        userPrompt: string,
        pythonOutput: string,
    ): Promise<string> {
        const prompt = `
PERGUNTA ORIGINAL DO USUÁRIO: "${userPrompt}"

DADOS BRUTOS CALCULADOS PELO PYTHON:
${pythonOutput}

Gere a resposta final para o usuário.
`;

        const responseText = await this.chat(
            [
                { role: "system", content: RESPONSE_FORMATTER_PROMPT },
                { role: "user", content: prompt },
            ],
            0.3,
        );

        return responseText || "Erro ao formatar resposta final.";
    }
}
