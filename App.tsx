import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { signInWithPopup, signOut } from "firebase/auth";
import { GeminiService } from "./services/geminiService";
import { OllamaService } from "./services/ollamaService";
import {
    getFirebaseAuth,
    googleProvider,
    hasFirebaseConfig,
} from "./services/firebaseClient";
import MarieFace from "./assets/marie-face2.svg";
import { AuthUser, Message, AppState, ProcessingStep } from "./types";
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
    ChevronDown,
    BarChart3,
    Clock,
    Loader2,
    ArrowLeft,
    XCircle,
    LogIn,
    LogOut,
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
    const [apiUrl, setApiUrl] = useState("");
    const [modelProvider, setModelProvider] = useState<ModelProvider>(
        getInitialModelProvider,
    );
    const [user, setUser] = useState<AuthUser | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    const [isSigningIn, setIsSigningIn] = useState(false);

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
    const profileRef = useRef<HTMLDivElement>(null);

    // UI State for Exit Confirmation
    const [exitConfirm, setExitConfirm] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const isHome = state.activeTab === "home";
    const isChat = state.activeTab === "chat";
    const pythonReady = state.isPythonReady;
    const statusLabel = pythonReady
        ? "Ready to analyze"
        : "Preparing my chemicals. Almost there...";
    const statusDotClass = pythonReady
        ? "bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.15)]"
        : "bg-amber-400 shadow-[0_0_0_6px_rgba(251,146,60,0.18)]";
    const statusTextClass = pythonReady ? "text-emerald-700" : "text-amber-700";
    const shellClass = isHome
        ? "bg-sky-50/60 text-slate-900 home-shell"
        : isChat
          ? "bg-sky-50/60 text-slate-900 chat-shell"
          : "bg-slate-200 text-slate-800";
    const headerTheme =
        isHome || isChat
            ? "bg-transparent border-transparent text-slate-800"
            : "bg-neutral-950 border-neutral-800 text-white";
    const headerSubtleText =
        isHome || isChat ? "text-slate-500" : "text-neutral-500";

    const normalizeEmail = (email?: string | null) =>
        (email || "").trim().toLowerCase();
    const isInternalEmail = (email: string) => email.endsWith("@rga.com");
    const projectsAllowedForUser = useMemo(() => {
        const normalized = normalizeEmail(user?.email);
        if (!normalized) return [];
        if (isInternalEmail(normalized)) return projects;
        return projects.filter((proj) =>
            (proj.allowedUsers || []).some(
                (allowed) => normalizeEmail(allowed) === normalized,
            ),
        );
    }, [user]);

    const userCanAccessProject = (project: Project) => {
        const normalized = normalizeEmail(user?.email);
        if (!normalized) return false;
        if (isInternalEmail(normalized)) return true;
        return (project.allowedUsers || []).some(
            (allowed) => normalizeEmail(allowed) === normalized,
        );
    };

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

    // Close profile popover on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                isProfileOpen &&
                profileRef.current &&
                !profileRef.current.contains(e.target as Node)
            ) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [isProfileOpen]);

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
        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
        });
    }, [messages, processingStep]);

    const handleGoogleSignIn = async () => {
        setAuthError(null);

        if (!hasFirebaseConfig) {
            setAuthError(
                "Firebase Auth não configurado. Defina VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID e VITE_FIREBASE_APP_ID.",
            );
            return;
        }

        const auth = getFirebaseAuth();
        if (!auth) {
            setAuthError(
                "Não foi possível iniciar o Firebase Auth. Verifique as credenciais.",
            );
            return;
        }

        setIsSigningIn(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const email = result.user.email;

            if (!email) {
                throw new Error(
                    "Não conseguimos ler seu email do Google. Tente novamente.",
                );
            }

            const normalized = normalizeEmail(email);
            const allowedList = isInternalEmail(normalized)
                ? projects
                : projects.filter((proj) =>
                      (proj.allowedUsers || []).some(
                          (allowed) => normalizeEmail(allowed) === normalized,
                      ),
                  );

            if (allowedList.length === 0) {
                setAuthError(
                    "Acesso restrito a contas @rga.com. Peça para ser incluído em allowedUsers em projects.ts.",
                );
                await signOut(auth);
                return;
            }

            setUser({
                email: normalized,
                name: result.user.displayName || undefined,
                photoURL: result.user.photoURL || undefined,
            });
            setState((s) => ({ ...s, activeTab: "home" }));
        } catch (error: any) {
            console.error("Google Sign-In error", error);
            const message =
                error?.message ||
                "Erro ao autenticar com o Google. Tente novamente.";
            setAuthError(message);
        } finally {
            setIsSigningIn(false);
        }
    };

    const handleSignOut = async () => {
        try {
            const auth = getFirebaseAuth();
            if (auth) {
                await signOut(auth);
            }
        } catch (e) {
            console.error("Erro ao sair do Firebase", e);
        } finally {
            setUser(null);
            setAuthError(null);
            setIsProfileOpen(false);
            setState((s) => ({
                ...s,
                activeTab: "home",
                selectedProject: null,
                heuristicasContent: null,
                resultadosContent: null,
            }));
            setMessages([]);
            setInput("");
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
        setAuthError(null);
        if (!user) {
            setAuthError(
                "Faça login com sua conta Google para acessar os projetos.",
            );
            return;
        }

        if (!userCanAccessProject(project)) {
            setAuthError(
                "Seu email não tem permissão para este projeto. Peça para ser incluído em allowedUsers.",
            );
            return;
        }

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
            const res = await fetch(apiUrl);
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
        if (!user) {
            alert(
                "Faça login com sua conta Google para conversar com a Marie.",
            );
            return;
        }
        const activeService = modelProvider === "gemini" ? gemini : ollama;
        if (!activeService) {
            alert(
                "Erro: Serviço de IA não inicializado. Configure a API Key do Gemini nas variáveis de ambiente ou selecione o modelo Ollama/Gemma.",
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

    if (!user) {
        return (
            <div className="relative min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50 text-slate-900 overflow-hidden">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-10 -top-24 w-[480px] h-[480px] bg-sky-200/40 rounded-full blur-[120px]" />
                    <div className="absolute -right-16  top-10 w-[420px] h-[420px] bg-indigo-200/40 rounded-full blur-[120px]" />
                    <div className="absolute left-10 bottom-0 w-[520px] h-[520px] bg-blue-100/35 rounded-full blur-[120px]" />
                </div>

                <div className="relative z-10 max-w-5xl mx-auto px-6 py-16 md:py-20 flex flex-col items-center text-center gap-8">
                    <div className="bg-white shadow-[0_20px_60px_rgba(66,100,255,0.16)] border border-white/80 rounded-[32px] px-8 py-10 md:px-12 md:py-12 w-full max-w-3xl">
                        <div className="flex flex-col items-center gap-6">
                            <div className="relative inline-flex items-center justify-center">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-sky-100 to-indigo-100 border border-white shadow-inner flex items-center justify-center">
                                    <img
                                        src={MarieFace}
                                        alt="Marie"
                                        className="w-16 h-16"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-4xl md:text-5xl font-black leading-tight">
                                    Welcome aboard!
                                </h1>
                                <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                                    To enter our amazing lab, please first
                                    identify yourself. Just a reminder that only
                                    R/GA scientists are authorized.
                                </p>
                            </div>
                        </div>

                        {authError && (
                            <div className="mt-6 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-left">
                                {authError}
                            </div>
                        )}

                        {!hasFirebaseConfig && (
                            <div className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left">
                                Configure o Firebase para habilitar o botão:
                                defina VITE_FIREBASE_API_KEY,
                                VITE_FIREBASE_AUTH_DOMAIN,
                                VITE_FIREBASE_PROJECT_ID e VITE_FIREBASE_APP_ID
                                no painel da Vercel.
                            </div>
                        )}

                        <div className="mt-8 flex flex-col gap-3">
                            <button
                                onClick={handleGoogleSignIn}
                                disabled={isSigningIn || !hasFirebaseConfig}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 text-white font-semibold py-3 shadow-[0_18px_40px_rgba(66,112,255,0.35)] hover:shadow-[0_20px_50px_rgba(66,112,255,0.42)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isSigningIn ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <LogIn className="w-5 h-5" />
                                )}
                                Entrar com Google
                            </button>
                            <p className="text-xs text-slate-500">
                                Contas @rga.com são liberadas automaticamente.
                                Outros domínios precisam estar listados em
                                allowedUsers no arquivo projects.ts.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (projectsAllowedForUser.length === 0) {
        return (
            <div className="min-h-screen bg-slate-100 text-slate-800 flex items-center justify-center px-6">
                <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-[0_20px_60px_rgba(80,110,150,0.18)] p-8 space-y-4 text-center">
                    <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
                    <h2 className="text-2xl font-bold">Acesso não liberado</h2>
                    <p className="text-sm text-slate-600">
                        Seu email não faz parte do domínio @rga.com e não foi
                        encontrado em allowedUsers. Peça para o responsável
                        adicionar seu endereço no arquivo projects.ts.
                    </p>
                    <button
                        onClick={handleSignOut}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Trocar de conta
                    </button>
                </div>
            </div>
        );
    }

    // --- LOADING SKELETON UI ---
    if (state.isLoadingData) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col items-center">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <h2 className="text-2xl font-bold">Preparing our lab</h2>
                    <p className="text-neutral-500 mt-2">
                        Loading project data {state.selectedProject?.name}...
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
        <div
            className={`relative flex flex-col min-h-screen font-sans overflow-hidden ${shellClass}`}
        >
            {(isHome || isChat) && (
                <div
                    className={`home-background pointer-events-none ${isChat ? "chat-mode" : ""}`}
                >
                    <div className="mesh-gradient" />
                    <div className="orb orb-a" />
                    <div className="orb orb-b" />
                    <div className="orb orb-c" />
                    <div className="grid-overlay" />
                </div>
            )}
            {/* Header */}
            <header
                className={`flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b backdrop-blur-sm z-10 ${headerTheme}`}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500 rounded-lg flex items-center justify-center font-bold text-white shadow-[0_10px_30px_rgba(90,140,255,0.35)]">
                        M
                    </div>
                    <h1 className="text-lg font-bold tracking-tight">
                        Marie - UX Benchmark Analyst{" "}
                        <span
                            className={`font-normal ml-2 text-sm ${headerSubtleText}`}
                        >
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

                    {user && (
                        <div className="relative" ref={profileRef}>
                            <button
                                onClick={() => setIsProfileOpen((s) => !s)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-white/70 border border-white/80 shadow-sm backdrop-blur hover:bg-white transition-all"
                            >
                                <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold uppercase">
                                    {user.photoURL ? (
                                        <img
                                            src={user.photoURL}
                                            alt={user.name || user.email}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        (user.name || user.email).charAt(0)
                                    )}
                                </div>
                                <ChevronDown
                                    className={`w-4 h-4 text-slate-600 transition-transform ${isProfileOpen ? "rotate-180" : ""}`}
                                />
                            </button>

                            {isProfileOpen && (
                                <div className="absolute right-0 mt-3 w-72 bg-white border border-white/80 shadow-[0_20px_60px_rgba(90,120,200,0.18)] rounded-2xl p-4 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center text-base font-bold uppercase">
                                        {user.photoURL ? (
                                            <img
                                                src={user.photoURL}
                                                alt={user.name || user.email}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            (user.name || user.email).charAt(0)
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-500">
                                            Conectado
                                        </p>
                                        <p className="text-sm font-semibold text-slate-900">
                                            {user.name || user.email}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {user.email}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleSignOut}
                                        className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                                    >
                                        <LogOut className="w-3 h-3" />
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Project Indicator / Back Button */}
                    {state.activeTab === "chat" && state.selectedProject && (
                        <div className="flex items-center gap-4">
                            <div className="hidden md:flex flex-col items-end mr-2">
                                <span
                                    className={`text-sm font-bold ${isChat ? "text-slate-800" : "text-white"}`}
                                >
                                    {state.selectedProject.name}
                                </span>
                                <span
                                    className={`text-xs ${isChat ? "text-slate-500" : "text-neutral-500"}`}
                                >
                                    {state.selectedProject.year} vs{" "}
                                    {state.selectedProject.previousYear}
                                </span>
                            </div>
                            <button
                                onClick={handleBackToHome}
                                className={`text-xs flex items-center gap-2 px-3 py-1.5 rounded transition-all duration-300 ${
                                    exitConfirm
                                        ? "bg-red-600 text-white hover:bg-red-700 animate-pulse"
                                        : isChat
                                          ? "bg-white/80 text-slate-700 border border-white/70 hover:bg-white"
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
                    <div className="relative h-full">
                        <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 flex flex-col items-center">
                            <div className="text-center mb-12 mt-6 md:mt-10">
                                <div className="relative inline-flex items-center justify-center mb-6">
                                    <div className="avatar-glow" />
                                    <img
                                        src={MarieFace}
                                        alt="Marie"
                                        className="w-24 h-24 md:w-28 md:h-28 mx-auto relative drop-shadow-[0_20px_40px_rgba(94,126,255,0.35)]"
                                    />
                                </div>

                                <h2 className="text-4xl md:text-5xl font-black leading-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-500 drop-shadow-[0_15px_40px_rgba(79,130,255,0.25)]">
                                    Cześć! My name is Marie 👋
                                </h2>

                                <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto">
                                    The most brilliant (sorry, Einstein) AI data
                                    scientist, ready to <br />
                                    help you make <b>amazing discoveries.</b>
                                </p>

                                <div className="flex items-center justify-center gap-3 mt-7">
                                    <span className="h-px w-10 bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
                                    <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_0_6px_rgba(80,130,255,0.12)]" />
                                    <span className="h-px w-10 bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
                                </div>

                                {!state.isPythonReady && (
                                    <div className="inline-flex items-center justify-center gap-2 text-sm text-slate-500 mt-5 px-4 py-2 rounded-full bg-white/70 border border-white/80 shadow-sm backdrop-blur">
                                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                        <span>
                                            Preparando ambiente Python
                                            (Pyodide)...
                                        </span>
                                    </div>
                                )}
                            </div>

                            {authError && (
                                <div className="mt-4 inline-flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 max-w-xl mx-auto text-left">
                                    <AlertTriangle className="w-4 h-4 mt-0.5" />
                                    <span>{authError}</span>
                                </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
                                {!state.isPythonReady
                                    ? Array.from({
                                          length:
                                              projectsAllowedForUser.length ||
                                              4,
                                      }).map((_, idx) => (
                                          <div
                                              key={idx}
                                              className="relative glass-card p-6 rounded-2xl text-left flex flex-col gap-4 animate-pulse"
                                          >
                                              <div className="card-glow" />
                                              <div className="flex justify-between items-start relative z-10">
                                                  <div className="w-12 h-12 rounded-xl bg-white/50 border border-white/70" />
                                                  <div className="h-6 w-14 rounded-full bg-white/40" />
                                              </div>
                                              <div className="space-y-3 relative z-10">
                                                  <div className="h-5 bg-white/50 rounded w-3/4" />
                                                  <div className="h-4 bg-white/40 rounded w-1/2" />
                                              </div>
                                          </div>
                                      ))
                                    : projectsAllowedForUser.map((proj) => (
                                          <button
                                              key={proj.slug}
                                              onClick={() =>
                                                  handleSelectProject(proj)
                                              }
                                              className="group relative glass-card p-6 rounded-2xl text-left transition-all duration-500 shadow-[0_25px_80px_rgba(92,133,255,0.16)] hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(92,133,255,0.24)]"
                                          >
                                              <div className="card-glow" />
                                              <div className="flex justify-between items-start relative z-10">
                                                  <div className="icon-pill group-hover:rotate-3">
                                                      <BarChart3 className="w-5 h-5" />
                                                  </div>
                                                  <span className="year-badge">
                                                      {proj.year}
                                                  </span>
                                              </div>

                                              <div className="relative z-10">
                                                  <h3 className="text-xl font-semibold text-[#1f2748] group-hover:text-[#2356ff] transition-colors">
                                                      {proj.name}
                                                  </h3>
                                                  <p className="text-sm text-slate-600 mt-1">
                                                      Comparativo vs{" "}
                                                      {proj.previousName} (
                                                      {proj.previousYear})
                                                  </p>
                                              </div>

                                              <span className="sparkle" />
                                              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all text-sky-500">
                                                  <ChevronRight />
                                              </div>
                                          </button>
                                      ))}
                            </div>

                            <div
                                className={`mt-8 flex items-center gap-2 text-sm bg-white/70 px-4 py-2 rounded-full border border-white/80 shadow-sm backdrop-blur ${statusTextClass}`}
                            >
                                <span
                                    className={`h-2 w-2 rounded-full animate-pulse ${statusDotClass}`}
                                />
                                <span>{statusLabel}</span>
                            </div>
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
                {isChat && (
                    <div className="relative h-full overflow-hidden">
                        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 h-full flex flex-col">
                            <div className="chat-pane flex flex-col gap-6 h-full min-h-0">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="icon-pill">
                                            <BarChart3 className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
                                                Projeto em análise
                                            </p>
                                            <p className="text-base md:text-lg font-semibold text-slate-800">
                                                {state.selectedProject?.name ||
                                                    "Selecione um projeto"}
                                            </p>
                                            {state.selectedProject && (
                                                <p className="text-xs text-slate-500">
                                                    {state.selectedProject.year}{" "}
                                                    vs{" "}
                                                    {
                                                        state.selectedProject
                                                            .previousYear
                                                    }
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div
                                        className={`inline-flex items-center gap-2 text-sm px-4 py-2 rounded-full border border-white/70 bg-white/80 shadow-sm backdrop-blur ${statusTextClass}`}
                                    >
                                        <span
                                            className={`h-2 w-2 rounded-full animate-pulse ${statusDotClass}`}
                                        />
                                        <span>{statusLabel}</span>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                    <div className="chat-feed flex-1 overflow-y-auto space-y-5 pr-1">
                                        {messages.length === 0 && (
                                            <div className="text-center mt-10 md:mt-16 opacity-70 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                                <div className="w-14 h-14 bg-white/70 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/80 shadow-lg">
                                                    <Terminal className="w-7 h-7 text-sky-600" />
                                                </div>
                                                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                                                    {state.selectedProject
                                                        ? `Analisando ${state.selectedProject.name}`
                                                        : "Aguardando análise"}
                                                </h3>
                                                <p className="text-sm max-w-md mx-auto text-slate-600">
                                                    Digite o número da
                                                    heurística (ex: "3.1") para
                                                    iniciar. Os dados foram
                                                    carregados na memória do
                                                    Python.
                                                </p>
                                            </div>
                                        )}

                                        {messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className="flex flex-col gap-2"
                                            >
                                                <div
                                                    className={`flex gap-3 md:gap-4 ${
                                                        msg.role === "user"
                                                            ? "flex-row-reverse"
                                                            : ""
                                                    }`}
                                                >
                                                    <div
                                                        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
                                                            msg.role === "user"
                                                                ? "bg-gradient-to-br from-sky-500 to-indigo-500 text-white"
                                                                : msg.role ===
                                                                    "error"
                                                                  ? "bg-rose-500 text-white"
                                                                  : "bg-indigo-100 text-indigo-600"
                                                        }`}
                                                    >
                                                        {msg.role === "user" ? (
                                                            <User className="w-5 h-5" />
                                                        ) : msg.role ===
                                                          "error" ? (
                                                            <AlertTriangle className="w-5 h-5" />
                                                        ) : (
                                                            <Cpu className="w-5 h-5" />
                                                        )}
                                                    </div>
                                                    <div
                                                        className={`chat-bubble max-w-[85%] ${
                                                            msg.role === "user"
                                                                ? "bubble-user"
                                                                : msg.role ===
                                                                    "error"
                                                                  ? "bubble-error"
                                                                  : "bubble-assistant"
                                                        }`}
                                                    >
                                                        {msg.role === "user" ? (
                                                            <p className="text-sm leading-relaxed text-white">
                                                                {msg.content}
                                                            </p>
                                                        ) : (
                                                            <ReactMarkdown
                                                                className="markdown-body"
                                                                components={{
                                                                    h1: ({
                                                                        node,
                                                                        ...props
                                                                    }) => (
                                                                        <h1
                                                                            className="text-xl font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200"
                                                                            {...props}
                                                                        />
                                                                    ),
                                                                    h2: ({
                                                                        node,
                                                                        ...props
                                                                    }) => (
                                                                        <h2
                                                                            className="text-lg font-semibold text-slate-900 mt-5 mb-2"
                                                                            {...props}
                                                                        />
                                                                    ),
                                                                    h3: ({
                                                                        node,
                                                                        ...props
                                                                    }) => (
                                                                        <h3
                                                                            className="text-md font-semibold text-sky-700 mt-4 mb-2"
                                                                            {...props}
                                                                        />
                                                                    ),
                                                                    ul: ({
                                                                        node,
                                                                        ...props
                                                                    }) => (
                                                                        <ul
                                                                            className="list-disc list-inside space-y-1 mb-3 text-slate-700"
                                                                            {...props}
                                                                        />
                                                                    ),
                                                                    ol: ({
                                                                        node,
                                                                        ...props
                                                                    }) => (
                                                                        <ol
                                                                            className="list-decimal list-inside space-y-1 mb-3 text-slate-700"
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
                                                                            className="mb-3 text-sm text-slate-700 leading-relaxed"
                                                                            {...props}
                                                                        />
                                                                    ),
                                                                    strong: ({
                                                                        node,
                                                                        ...props
                                                                    }) => (
                                                                        <strong
                                                                            className="font-bold text-slate-900"
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
                                                                                className="block bg-slate-900 text-emerald-200 p-3 rounded-xl text-xs font-mono my-3 overflow-x-auto"
                                                                                {...props}
                                                                            >
                                                                                {
                                                                                    children
                                                                                }
                                                                            </code>
                                                                        ) : (
                                                                            <code
                                                                                className="bg-slate-900/80 text-emerald-200 px-1.5 py-0.5 rounded text-[12px] font-mono"
                                                                                {...props}
                                                                            >
                                                                                {
                                                                                    children
                                                                                }
                                                                            </code>
                                                                        );
                                                                    },
                                                                    hr: ({
                                                                        node,
                                                                        ...props
                                                                    }) => (
                                                                        <hr
                                                                            className="border-slate-200 my-5"
                                                                            {...props}
                                                                        />
                                                                    ),
                                                                    blockquote:
                                                                        ({
                                                                            node,
                                                                            ...props
                                                                        }) => (
                                                                            <blockquote
                                                                                className="border-l-4 border-sky-200 pl-4 py-1 my-4 text-slate-700 italic bg-white/60 rounded-r"
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
                                                    (msg.script ||
                                                        msg.pythonOutput) && (
                                                        <div className="ml-12 md:ml-14 max-w-[85%]">
                                                            <details className="group">
                                                                <summary className="text-xs flex items-center gap-2 text-slate-500 hover:text-slate-700 cursor-pointer list-none select-none transition-colors">
                                                                    <Code className="w-3 h-3" />
                                                                    <span>
                                                                        View
                                                                        Generated
                                                                        Script &
                                                                        Logs
                                                                    </span>
                                                                </summary>
                                                                <div className="mt-2 space-y-2">
                                                                    {msg.script && (
                                                                        <div className="log-card">
                                                                            <pre className="text-xs text-emerald-200 font-mono whitespace-pre-wrap">
                                                                                {
                                                                                    msg.script
                                                                                }
                                                                            </pre>
                                                                        </div>
                                                                    )}
                                                                    {msg.pythonOutput && (
                                                                        <div className="log-card">
                                                                            <pre className="text-xs text-amber-200 font-mono whitespace-pre-wrap">
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

                                        {processingStep !==
                                            ProcessingStep.IDLE && (
                                            <div className="flex gap-3 ml-10 md:ml-12">
                                                <div className="px-3 py-2 text-sm text-slate-500 italic flex items-center gap-2 bg-white/70 border border-white/80 rounded-full backdrop-blur">
                                                    <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                                                    {processingStep}
                                                </div>
                                            </div>
                                        )}

                                        <div ref={messagesEndRef} />
                                    </div>
                                </div>

                                {/* Input Area */}
                                <div className="input-shell p-4 md:p-5 rounded-2xl border border-white/80 bg-white/80 backdrop-blur shadow-[0_20px_60px_rgba(90,130,255,0.12)]">
                                    {messages.length > 0 ? (
                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                            {processingStep !==
                                            ProcessingStep.IDLE ? (
                                                <p className="text-xs text-slate-500 text-center animate-pulse">
                                                    Processando análise...
                                                </p>
                                            ) : (
                                                <button
                                                    onClick={handleResetSession}
                                                    className="flex items-center gap-2 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 text-white px-5 py-2.5 rounded-full font-semibold transition-all shadow-[0_12px_30px_rgba(80,120,255,0.35)] hover:shadow-[0_14px_36px_rgba(80,120,255,0.45)]"
                                                >
                                                    <Sparkles className="w-4 h-4" />
                                                    Iniciar Nova Análise
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="relative flex items-center">
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
                                                className="w-full bg-white/80 border border-white/80 rounded-xl pl-4 pr-14 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 disabled:opacity-60 transition-all"
                                            />
                                            <button
                                                onClick={handleSendMessage}
                                                disabled={
                                                    !input.trim() ||
                                                    processingStep !==
                                                        ProcessingStep.IDLE
                                                }
                                                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-lg text-white bg-gradient-to-r from-sky-500 to-indigo-500 shadow-[0_10px_25px_rgba(79,130,255,0.35)] hover:shadow-[0_12px_30px_rgba(79,130,255,0.45)] transition-all disabled:opacity-40"
                                            >
                                                <Play className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
