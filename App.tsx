import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { GeminiService } from "./services/geminiService";
import { OllamaService } from "./services/ollamaService";
import { StorageService } from "./services/storageService";
import MarieFace from "./assets/marie-face2.svg";
import { Message, AppState, ProcessingStep } from "./types";
import { projects, Project } from "./projects";
import {
    User,
    Cpu,
    Upload,
    Terminal,
    Play,
    AlertTriangle,
    CheckCircle,
    Database,
    ShieldAlert,
    Globe,
    Link as LinkIcon,
    Key,
    Code,
    Bug,
    FileJson,
    Save,
    Trash2,
    RefreshCw,
    Sparkles,
    ChevronRight,
    BarChart3,
    Clock,
    Loader2,
    ArrowLeft,
    XCircle,
} from "lucide-react";

// Declare global Pyodide
declare global {
    interface Window {
        loadPyodide: any;
    }
    interface ImportMetaEnv {
        VITE_API_KEY?: string;
        [key: string]: string | undefined;
    }
    interface ImportMeta {
        readonly env: ImportMetaEnv;
    }
}

type ModelProvider = "gemini" | "ollama";
const MODEL_STORAGE_KEY = "rga_model_provider";
const MODEL_OPTIONS: { value: ModelProvider; label: string }[] = [
    { value: "gemini", label: "Gemini" },
    { value: "ollama", label: "Ollama/Gemma" },
];

// Helper para ler API Key em qualquer ambiente (Vite ou Node)
const getEnvApiKey = () => {
    try {
        if (
            typeof import.meta !== "undefined" &&
            import.meta.env &&
            import.meta.env.VITE_API_KEY
        ) {
            return import.meta.env.VITE_API_KEY;
        }
    } catch (e) {}

    try {
        if (
            typeof process !== "undefined" &&
            process.env &&
            process.env.API_KEY
        ) {
            return process.env.API_KEY;
        }
    } catch (e) {}

    return "";
};

const getInitialModelProvider = (): ModelProvider => {
    try {
        const stored =
            typeof window !== "undefined"
                ? localStorage.getItem(MODEL_STORAGE_KEY)
                : null;
        if (stored === "ollama") return "ollama";
        return "gemini";
    } catch (e) {
        return "gemini";
    }
};

export default function App() {
    const [apiKey, setApiKey] = useState(getEnvApiKey());
    const [apiUrl, setApiUrl] = useState("");
    const [resultsApiKey, setResultsApiKey] = useState("");
    const [modelProvider, setModelProvider] = useState<ModelProvider>(
        getInitialModelProvider,
    );

    // FIX: Initialize GeminiService immediately if API key exists in environment
    const [gemini, setGemini] = useState<GeminiService | null>(() => {
        const key = getEnvApiKey();
        return key ? new GeminiService(key) : null;
    });
    const [ollama] = useState<OllamaService>(() => new OllamaService());

    const [state, setState] = useState<AppState>({
        hasApiKey: !!getEnvApiKey(),
        isPythonReady: false,
        activeTab: "home",
        selectedProject: null,
        isLoadingData: false,
        heuristicasContent: null,
        resultadosContent: null,
        heuristicasFile: null,
    });

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [processingStep, setProcessingStep] = useState<ProcessingStep>(
        ProcessingStep.IDLE,
    );
    const [pyodide, setPyodide] = useState<any>(null);
    const [debugOutput, setDebugOutput] = useState<string>("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // UI State for Exit Confirmation
    const [exitConfirm, setExitConfirm] = useState(false);

    // 1. Initialize Pyodide with Robust Polling
    useEffect(() => {
        let isMounted = true;
        const checkAndLoadPyodide = async () => {
            if (pyodide) return;

            if (window.loadPyodide) {
                try {
                    const py = await window.loadPyodide();
                    if (isMounted) {
                        setPyodide(py);
                        setState((s) => ({ ...s, isPythonReady: true }));
                        console.log("Python Runtime Ready");
                    }
                } catch (e) {
                    console.error("Failed to load Pyodide", e);
                }
            } else {
                // Poll every 500ms until script loads
                setTimeout(checkAndLoadPyodide, 500);
            }
        };

        checkAndLoadPyodide();
        return () => {
            isMounted = false;
        };
    }, [pyodide]);

    useEffect(() => {
        try {
            localStorage.setItem(MODEL_STORAGE_KEY, modelProvider);
        } catch (e) {
            // Ignore persistence errors (private mode, etc.)
        }
    }, [modelProvider]);

    // 2. Sync Pyodide FS when data or runtime changes
    useEffect(() => {
        if (pyodide && state.isPythonReady) {
            if (state.heuristicasContent) {
                try {
                    pyodide.FS.writeFile(
                        "heuristicas.json",
                        JSON.stringify(state.heuristicasContent),
                    );
                    console.log("Synced heuristicas.json to Pyodide FS");
                } catch (e) {
                    console.error("FS Sync Error", e);
                }
            }
            if (state.resultadosContent) {
                try {
                    pyodide.FS.writeFile(
                        "resultados.json",
                        JSON.stringify(state.resultadosContent),
                    );
                    console.log("Synced resultados.json to Pyodide FS");
                } catch (e) {
                    console.error("FS Sync Error", e);
                }
            }
        }
    }, [
        state.heuristicasContent,
        state.resultadosContent,
        state.isPythonReady,
        pyodide,
    ]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, processingStep]);

    const handleSetApiKey = () => {
        if (apiKey.trim().length > 0) {
            setGemini(new GeminiService(apiKey));
            setState((s) => ({ ...s, hasApiKey: true }));
        }
    };

    const loadProjectData = async (project: Project) => {
        setState((s) => ({
            ...s,
            isLoadingData: true,
            selectedProject: project,
        }));

        try {
            // Fetch Results
            const resResults = await fetch(project.resultsApi.url, {
                headers: { api_key: project.resultsApi.api_key },
            });
            if (!resResults.ok)
                throw new Error(`Failed to load results for ${project.name}`);
            const resultsData = await resResults.json();

            // Fetch Heuristics
            const resHeuristics = await fetch(project.heuristicsApi.url, {
                headers: { api_key: project.heuristicsApi.api_key },
            });
            if (!resHeuristics.ok)
                throw new Error(
                    `Failed to load heuristics for ${project.name}`,
                );
            const heuristicsData = await resHeuristics.json();

            setState((s) => ({
                ...s,
                heuristicasContent: heuristicsData,
                resultadosContent: resultsData,
                isLoadingData: false,
                activeTab: "chat",
            }));
        } catch (error: any) {
            console.error(error);
            alert(`Erro ao carregar projeto: ${error.message}`);
            setState((s) => ({
                ...s,
                isLoadingData: false,
                selectedProject: null,
            }));
        }
    };

    const handleSelectProject = (project: Project) => {
        loadProjectData(project);
    };

    const handleBackToHome = () => {
        if (!exitConfirm) {
            setExitConfirm(true);
            // Auto-reset confirmation after 3 seconds if not clicked
            setTimeout(() => setExitConfirm(false), 3000);
            return;
        }

        // Confirmed exit
        setState((s) => ({
            ...s,
            activeTab: "home",
            selectedProject: null,
            heuristicasContent: null,
            resultadosContent: null,
        }));
        setMessages([]);
        setInput("");
        setExitConfirm(false);
    };

    // --- Handlers for Legacy Admin ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const content = JSON.parse(event.target?.result as string);
                    setState((s) => ({
                        ...s,
                        heuristicasFile: file,
                        heuristicasContent: content,
                    }));
                } catch (err) {
                    alert("Erro ao ler JSON de heurísticas");
                }
            };
            reader.readAsText(file);
        }
    };

    const fetchResultsLegacy = async () => {
        if (!apiUrl.trim()) return;
        try {
            const headers: HeadersInit = {};
            if (resultsApiKey.trim()) headers["api_key"] = resultsApiKey;
            const res = await fetch(apiUrl, { headers });
            if (!res.ok) throw new Error(`Status: ${res.status}`);
            const data = await res.json();
            setState((s) => ({ ...s, resultadosContent: data }));
            alert(
                `Dados carregados! (${Object.keys(data).length || "Vários"} registros)`,
            );
        } catch (e: any) {
            alert(`Erro: ${e.message}`);
        }
    };

    const handleResetSession = () => {
        setMessages([]);
        setInput("");
        setProcessingStep(ProcessingStep.IDLE);
        setDebugOutput("");
    };

    const handleSendMessage = async () => {
        if (!input.trim()) return;
        const activeService = modelProvider === "gemini" ? gemini : ollama;
        if (!activeService) {
            alert(
                "Erro: Serviço de IA não inicializado. Informe a API Key do Gemini ou selecione o modelo Ollama/Gemma.",
            );
            return;
        }
        if (!pyodide) {
            alert("Aguarde: O ambiente Python ainda está carregando.");
            return;
        }
        if (!state.heuristicasContent || !state.resultadosContent) {
            alert("Dados não carregados.");
            return;
        }

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input,
            timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setProcessingStep(ProcessingStep.GENERATING_SCRIPT);

        try {
            // Pass the selected project to the generator so it knows the years
            const script = await activeService.generatePythonScript(
                userMsg.content,
                state.selectedProject,
            );

            setProcessingStep(ProcessingStep.EXECUTING_PYTHON);

            // Ensure FS is synced
            pyodide.FS.writeFile(
                "heuristicas.json",
                JSON.stringify(state.heuristicasContent),
            );
            pyodide.FS.writeFile(
                "resultados.json",
                JSON.stringify(state.resultadosContent),
            );

            let pythonOutput = "";
            try {
                pyodide.setStdout({
                    batched: (msg: string) => {
                        pythonOutput += msg + "\n";
                    },
                });
                pyodide.setStderr({
                    batched: (msg: string) => {
                        pythonOutput += "ERROR: " + msg + "\n";
                    },
                });
                await pyodide.runPythonAsync(script);
            } catch (pyError: any) {
                console.error(pyError);
                pythonOutput += `\nCRITICAL PYTHON ERROR: ${pyError.message}`;
            }

            setProcessingStep(ProcessingStep.GENERATING_RESPONSE);
            const finalResponse =
                await activeService.generateNaturalLanguageResponse(
                    userMsg.content,
                    pythonOutput,
                );

            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: finalResponse,
                    timestamp: Date.now(),
                    script: script,
                    pythonOutput: pythonOutput,
                },
            ]);
        } catch (error: any) {
            console.error("Process error:", error);
            const friendlyMessage =
                error?.message ||
                "Ocorreu um erro crítico no processamento. Verifique o console.";
            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: "error",
                    content: friendlyMessage,
                    timestamp: Date.now(),
                },
            ]);
        } finally {
            setProcessingStep(ProcessingStep.IDLE);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    if (modelProvider === "gemini" && !state.hasApiKey) {
        return (
            <div className="min-h-screen bg-slate-200 text-white flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 p-8 rounded-xl shadow-2xl">
                    <div className="mb-4">
                        <label className="text-xs uppercase tracking-wide text-neutral-500">
                            Selecionar modelo
                        </label>
                        <div className="mt-2">
                            <select
                                value={modelProvider}
                                onChange={(e) =>
                                    setModelProvider(
                                        e.target.value as ModelProvider,
                                    )
                                }
                                className="w-full bg-neutral-950 border border-neutral-700 rounded p-3 text-white text-sm focus:outline-none focus:border-red-600"
                            >
                                {MODEL_OPTIONS.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                        className="bg-neutral-950"
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-center mb-6">
                        <ShieldAlert className="w-16 h-16 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-center mb-2">
                        R/GA UX Benchmark
                    </h1>
                    <p className="text-neutral-400 text-center mb-6 text-sm">
                        System requires authentication.
                    </p>
                    <input
                        type="password"
                        placeholder="Enter App API Key"
                        className="w-full bg-neutral-950 border border-neutral-700 rounded p-3 text-white mb-4 focus:outline-none focus:border-red-600"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                    />
                    <button
                        onClick={handleSetApiKey}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded transition-colors"
                    >
                        Authenticate
                    </button>
                </div>
            </div>
        );
    }

    // --- LOADING SKELETON UI ---
    if (state.isLoadingData) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col items-center">
                    <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />
                    <h2 className="text-2xl font-bold">
                        Inicializando Ambiente
                    </h2>
                    <p className="text-neutral-500 mt-2">
                        Carregando dados do projeto{" "}
                        {state.selectedProject?.name}...
                    </p>
                </div>

                {/* Skeleton Blocks */}
                <div className="w-full max-w-2xl space-y-4 opacity-50">
                    <div className="h-4 bg-neutral-800 rounded w-3/4 animate-pulse"></div>
                    <div className="h-4 bg-neutral-800 rounded w-1/2 animate-pulse"></div>
                    <div className="h-32 bg-neutral-800 rounded w-full animate-pulse"></div>
                    <div className="flex gap-4">
                        <div className="h-10 bg-neutral-800 rounded w-1/3 animate-pulse"></div>
                        <div className="h-10 bg-neutral-800 rounded w-1/3 animate-pulse"></div>
                    </div>
                </div>

                <div className="text-xs text-neutral-600 font-mono">
                    {state.isPythonReady
                        ? "> Python Runtime Ready"
                        : "> Loading Pyodide Kernel..."}{" "}
                    <br />
                    {state.heuristicasContent
                        ? "> Heuristics Loaded"
                        : "> Fetching Heuristics..."}{" "}
                    <br />
                    {state.resultadosContent
                        ? "> Results Loaded"
                        : "> Fetching Results..."}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-200 text-slate-800 font-sans">
            {/* Header */}
            <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-400 bg-slate-100 backdrop-blur z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-600 rounded-sm flex items-center justify-center font-bold text-white">
                        M
                    </div>
                    <h1 className="text-lg font-bold tracking-tight">
                        Marie - UX Benchmark Analyst{" "}
                        <span className="text-neutral-500 font-normal ml-2 text-sm">
                            v0.0.1
                        </span>
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    {/* I changed classname "flex" to hidden */}
                    <div className="hidden items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm">
                        <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Modelo
                        </span>
                        <select
                            value={modelProvider}
                            onChange={(e) =>
                                setModelProvider(
                                    e.target.value as ModelProvider,
                                )
                            }
                            className="bg-transparent text-white text-sm focus:outline-none"
                        >
                            {MODEL_OPTIONS.map((option) => (
                                <option
                                    key={option.value}
                                    value={option.value}
                                    className="bg-neutral-900 text-white"
                                >
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Project Indicator / Back Button */}
                    {state.activeTab === "chat" && state.selectedProject && (
                        <div className="flex items-center gap-4">
                            <div className="hidden md:flex flex-col items-end mr-2">
                                <span className="text-sm font-bold text-white">
                                    {state.selectedProject.name}
                                </span>
                                <span className="text-xs text-neutral-500">
                                    {state.selectedProject.year} vs{" "}
                                    {state.selectedProject.previousYear}
                                </span>
                            </div>
                            <button
                                onClick={handleBackToHome}
                                className={`text-xs flex items-center gap-2 px-3 py-1.5 rounded transition-all duration-300 ${
                                    exitConfirm
                                        ? "bg-red-600 text-white hover:bg-red-700 animate-pulse"
                                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                                }`}
                            >
                                {exitConfirm ? (
                                    <XCircle className="w-3 h-3" />
                                ) : (
                                    <ArrowLeft className="w-3 h-3" />
                                )}
                                {exitConfirm
                                    ? "Confirmar Saída?"
                                    : "Trocar de Projeto"}
                            </button>
                        </div>
                    )}

                    {state.activeTab === "admin" && (
                        <button
                            onClick={() =>
                                setState((s) => ({ ...s, activeTab: "home" }))
                            }
                            className="text-sm text-neutral-400 hover:text-white"
                        >
                            Voltar
                        </button>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden relative">
                {/* --- HOME: PROJECT SELECTION --- */}
                {state.activeTab === "home" && (
                    <div className="h-full overflow-y-auto p-8 max-w-5xl mx-auto flex flex-col items-center">
                        <div className="text-center mb-12 mt-10">
                            <img
                                src={MarieFace}
                                alt="Marie"
                                className="w-28 h-28 mx-auto mb-6"
                            />

                            <h2 className="text-4xl font-bold text-blue-500 mb-4">
                                Cześć! My name is Marie 👋
                            </h2>

                            <p className="text-slate-600 max-w-lg mx-auto">
                                A brilliant AI data scientist, ready to help you
                                make amazing discoveries.
                            </p>
                            {!state.isPythonReady && (
                                <div className="flex items-center justify-center gap-2 text-sm text-neutral-400 mt-4">
                                    <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                                    <span>
                                        Preparando ambiente Python (Pyodide)...
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
                            {!state.isPythonReady
                                ? Array.from({
                                      length: projects.length || 4,
                                  }).map((_, idx) => (
                                      <div
                                          key={idx}
                                          className="group relative bg-neutral-900 border border-neutral-800 p-6 rounded-xl text-left shadow-lg flex flex-col gap-4 animate-pulse pointer-events-none"
                                      >
                                          <div className="flex justify-between items-start">
                                              <div className="w-12 h-12 bg-neutral-800 rounded-lg" />
                                              <div className="w-14 h-5 bg-neutral-800 rounded" />
                                          </div>
                                          <div className="space-y-3">
                                              <div className="h-5 bg-neutral-800 rounded w-3/4" />
                                              <div className="h-4 bg-neutral-800 rounded w-1/2" />
                                          </div>
                                          <div className="mt-2 pt-4 border-t border-neutral-800 flex items-center text-xs text-neutral-500 gap-4">
                                              <div className="h-4 bg-neutral-800 rounded w-20" />
                                              <div className="h-4 bg-neutral-800 rounded w-16" />
                                          </div>
                                      </div>
                                  ))
                                : projects.map((proj) => (
                                      <button
                                          key={proj.slug}
                                          onClick={() =>
                                              handleSelectProject(proj)
                                          }
                                          className="group relative bg-neutral-900 border border-neutral-800 hover:border-red-600/50 hover:bg-neutral-800/50 p-6 rounded-xl text-left transition-all duration-300 shadow-lg hover:shadow-red-900/10 flex flex-col gap-4"
                                      >
                                          <div className="flex justify-between items-start">
                                              <div className="bg-red-600/10 text-red-500 p-3 rounded-lg group-hover:bg-red-600 group-hover:text-white transition-colors">
                                                  <BarChart3 className="w-6 h-6" />
                                              </div>
                                              <span className="bg-neutral-950 text-neutral-500 text-xs px-2 py-1 rounded border border-neutral-800 font-mono">
                                                  {proj.year}
                                              </span>
                                          </div>

                                          <div>
                                              <h3 className="text-xl font-bold text-white group-hover:text-red-500 transition-colors">
                                                  {proj.name}
                                              </h3>
                                              <p className="text-sm text-neutral-500 mt-1">
                                                  Comparativo vs{" "}
                                                  {proj.previousName} (
                                                  {proj.previousYear})
                                              </p>
                                          </div>

                                          <div className=" hidden mt-2 pt-4 border-t border-neutral-800 __flex items-center text-xs text-neutral-400 gap-4">
                                              <div className="flex items-center gap-1">
                                                  <Database className="w-3 h-3" />
                                                  <span>Auto-Fetch JSON</span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                  <Cpu className="w-3 h-3" />
                                                  <span>Python Ready</span>
                                              </div>
                                          </div>

                                          <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all text-red-500">
                                              <ChevronRight />
                                          </div>
                                      </button>
                                  ))}
                        </div>
                    </div>
                )}

                {/* --- ADMIN TAB (LEGACY) --- */}
                {state.activeTab === "admin" && (
                    <div className="h-full overflow-y-auto p-8 max-w-4xl mx-auto">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
                            <Database className="w-6 h-6 text-red-500" /> Upload
                            Manual
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-lg">
                                <h3 className="mb-4 font-bold">Heurísticas</h3>
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileUpload}
                                    className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-neutral-800 file:text-white hover:file:bg-neutral-700"
                                />
                                {state.heuristicasContent && (
                                    <span className="text-green-500 text-xs mt-2 block">
                                        Carregado
                                    </span>
                                )}
                            </div>
                            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-lg">
                                <h3 className="mb-4 font-bold">
                                    Resultados (API)
                                </h3>
                                <input
                                    type="text"
                                    value={apiUrl}
                                    onChange={(e) => setApiUrl(e.target.value)}
                                    placeholder="API URL"
                                    className="w-full bg-black border border-neutral-700 p-2 rounded mb-2 text-sm"
                                />
                                <button
                                    onClick={fetchResultsLegacy}
                                    className="bg-neutral-800 px-4 py-2 rounded text-sm w-full"
                                >
                                    Fetch
                                </button>
                                {state.resultadosContent && (
                                    <span className="text-green-500 text-xs mt-2 block">
                                        Carregado
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- CHAT TAB --- */}
                {state.activeTab === "chat" && (
                    <div className="flex flex-col h-full max-w-4xl mx-auto border-x border-neutral-900 bg-black">
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {messages.length === 0 && (
                                <div className="text-center mt-20 opacity-50 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-neutral-800">
                                        <Terminal className="w-8 h-8 text-red-600" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">
                                        {state.selectedProject
                                            ? `Analisando ${state.selectedProject.name}`
                                            : "Aguardando Análise"}
                                    </h3>
                                    <p className="text-sm max-w-md mx-auto text-neutral-400">
                                        Digite o número da heurística (ex:
                                        "3.1") para iniciar. Os dados foram
                                        carregados na memória do Python.
                                    </p>
                                </div>
                            )}

                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className="flex flex-col gap-2"
                                >
                                    <div
                                        className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                                    >
                                        <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                msg.role === "user"
                                                    ? "bg-white text-black"
                                                    : msg.role === "error"
                                                      ? "bg-red-900 text-white"
                                                      : "bg-red-600 text-white"
                                            }`}
                                        >
                                            {msg.role === "user" ? (
                                                <User className="w-5 h-5" />
                                            ) : msg.role === "error" ? (
                                                <AlertTriangle className="w-5 h-5" />
                                            ) : (
                                                <Cpu className="w-5 h-5" />
                                            )}
                                        </div>
                                        <div
                                            className={`p-4 rounded-lg text-sm leading-relaxed max-w-[85%] overflow-hidden ${
                                                msg.role === "user"
                                                    ? "bg-neutral-900 text-neutral-200"
                                                    : msg.role === "error"
                                                      ? "bg-red-950/30 border border-red-900 text-red-200"
                                                      : "bg-neutral-950 border border-neutral-800 text-neutral-300"
                                            }`}
                                        >
                                            {msg.role === "user" ? (
                                                msg.content
                                            ) : (
                                                <ReactMarkdown
                                                    className="prose prose-invert prose-sm max-w-none"
                                                    components={{
                                                        h1: ({
                                                            node,
                                                            ...props
                                                        }) => (
                                                            <h1
                                                                className="text-xl font-bold text-white mb-4 pb-2 border-b border-neutral-800"
                                                                {...props}
                                                            />
                                                        ),
                                                        h2: ({
                                                            node,
                                                            ...props
                                                        }) => (
                                                            <h2
                                                                className="text-lg font-bold text-white mt-6 mb-3"
                                                                {...props}
                                                            />
                                                        ),
                                                        h3: ({
                                                            node,
                                                            ...props
                                                        }) => (
                                                            <h3
                                                                className="text-md font-bold text-red-500 mt-4 mb-2"
                                                                {...props}
                                                            />
                                                        ),
                                                        ul: ({
                                                            node,
                                                            ...props
                                                        }) => (
                                                            <ul
                                                                className="list-disc list-inside space-y-1 mb-4 text-neutral-300"
                                                                {...props}
                                                            />
                                                        ),
                                                        ol: ({
                                                            node,
                                                            ...props
                                                        }) => (
                                                            <ol
                                                                className="list-decimal list-inside space-y-1 mb-4 text-neutral-300"
                                                                {...props}
                                                            />
                                                        ),
                                                        li: ({
                                                            node,
                                                            ...props
                                                        }) => (
                                                            <li
                                                                className="text-sm ml-2"
                                                                {...props}
                                                            />
                                                        ),
                                                        p: ({
                                                            node,
                                                            ...props
                                                        }) => (
                                                            <p
                                                                className="mb-3 text-sm text-neutral-300 leading-relaxed"
                                                                {...props}
                                                            />
                                                        ),
                                                        strong: ({
                                                            node,
                                                            ...props
                                                        }) => (
                                                            <strong
                                                                className="font-bold text-white"
                                                                {...props}
                                                            />
                                                        ),
                                                        code: ({
                                                            node,
                                                            className,
                                                            children,
                                                            ...props
                                                        }) => {
                                                            const match =
                                                                /language-(\w+)/.exec(
                                                                    className ||
                                                                        "",
                                                                );
                                                            return match ? (
                                                                <code
                                                                    className="block bg-black p-2 rounded text-xs font-mono my-2 overflow-x-auto"
                                                                    {...props}
                                                                >
                                                                    {children}
                                                                </code>
                                                            ) : (
                                                                <code
                                                                    className="bg-neutral-800 px-1 py-0.5 rounded text-xs font-mono text-red-400"
                                                                    {...props}
                                                                >
                                                                    {children}
                                                                </code>
                                                            );
                                                        },
                                                        hr: ({
                                                            node,
                                                            ...props
                                                        }) => (
                                                            <hr
                                                                className="border-neutral-800 my-6"
                                                                {...props}
                                                            />
                                                        ),
                                                        blockquote: ({
                                                            node,
                                                            ...props
                                                        }) => (
                                                            <blockquote
                                                                className="border-l-4 border-red-900 pl-4 py-1 my-4 text-neutral-400 italic bg-neutral-900/50 rounded-r"
                                                                {...props}
                                                            />
                                                        ),
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            )}
                                        </div>
                                    </div>

                                    {msg.role === "assistant" &&
                                        (msg.script || msg.pythonOutput) && (
                                            <div className="ml-12 max-w-[85%]">
                                                <details className="group">
                                                    <summary className="text-xs flex items-center gap-2 text-neutral-500 hover:text-neutral-300 cursor-pointer list-none select-none transition-colors">
                                                        <Code className="w-3 h-3" />
                                                        <span>
                                                            View Generated
                                                            Script & Logs
                                                        </span>
                                                    </summary>
                                                    <div className="mt-2 space-y-2">
                                                        {msg.script && (
                                                            <div className="bg-neutral-950 border border-neutral-800 rounded p-2 overflow-x-auto">
                                                                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                                                                    {msg.script}
                                                                </pre>
                                                            </div>
                                                        )}
                                                        {msg.pythonOutput && (
                                                            <div className="bg-neutral-950 border border-neutral-800 rounded p-2 overflow-x-auto">
                                                                <pre className="text-xs text-yellow-400 font-mono whitespace-pre-wrap">
                                                                    {
                                                                        msg.pythonOutput
                                                                    }
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                </details>
                                            </div>
                                        )}
                                </div>
                            ))}

                            {processingStep !== ProcessingStep.IDLE && (
                                <div className="flex gap-4 ml-12">
                                    <div className="p-3 text-sm text-neutral-500 italic flex items-center gap-2">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        {processingStep}
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t border-neutral-800 bg-neutral-900/30 backdrop-blur">
                            {messages.length > 0 ? (
                                <div className="flex flex-col items-center justify-center gap-3 py-2 min-h-[52px]">
                                    {processingStep !== ProcessingStep.IDLE ? (
                                        <p className="text-xs text-neutral-500 text-center animate-pulse">
                                            Processando análise...
                                        </p>
                                    ) : (
                                        <button
                                            onClick={handleResetSession}
                                            className="flex items-center gap-2 bg-white text-black hover:bg-neutral-200 px-6 py-3 rounded-full font-bold transition-all shadow-lg hover:shadow-white/20"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            Iniciar Nova Análise
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) =>
                                            setInput(e.target.value)
                                        }
                                        onKeyDown={handleKeyDown}
                                        placeholder="Digite o número da heurística..."
                                        disabled={
                                            !state.isPythonReady ||
                                            processingStep !==
                                                ProcessingStep.IDLE
                                        }
                                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-4 pr-12 py-3 focus:outline-none focus:border-red-600 disabled:opacity-50 transition-colors"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={
                                            !input.trim() ||
                                            processingStep !==
                                                ProcessingStep.IDLE
                                        }
                                        className="absolute right-2 top-2 p-1.5 bg-neutral-800 hover:bg-red-600 rounded text-neutral-400 hover:text-white transition-all disabled:opacity-0"
                                    >
                                        <Play className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
