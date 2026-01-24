import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Navigate,
    Route,
    Routes,
    useLocation,
    useNavigate,
} from "react-router-dom";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { GeminiService } from "./services/geminiService";
import { OllamaService } from "./services/ollamaService";
import {
    getFirebaseAuth,
    googleProvider,
    hasFirebaseConfig,
} from "./services/firebaseClient";
import { AuthUser, Message, AppState, ProcessingStep } from "./types";
import { projects, Project } from "./projects-data";
import { ChevronDown, Loader2, ArrowLeft, XCircle, LogOut } from "lucide-react";
import Home from "./pages/Home";
import ProjectsPage from "./pages/Projects";
import ProjectSlugPage from "./pages/ProjectSlug";

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
            (import.meta.env as any).VITE_GEMINI_API_KEY
        ) {
            return (import.meta.env as any).VITE_GEMINI_API_KEY as string;
        }
        if (
            typeof import.meta !== "undefined" &&
            import.meta.env &&
            (import.meta.env as any).VITE_API_KEY
        ) {
            return (import.meta.env as any).VITE_API_KEY as string;
        }
    } catch (e) {}

    try {
        if (
            typeof process !== "undefined" &&
            process.env &&
            (process.env.GEMINI_API_KEY || process.env.API_KEY)
        ) {
            return (process.env.GEMINI_API_KEY ||
                process.env.API_KEY ||
                "") as string;
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
    const [authInitialized, setAuthInitialized] = useState(false);

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
    const profileRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigate = useNavigate();

    // UI State for Exit Confirmation
    const [exitConfirm, setExitConfirm] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const isLoginRoute = location.pathname === "/";
    const isProjectsRoute = location.pathname === "/projects";
    const isProjectDetailRoute = location.pathname.startsWith("/projects/");
    const currentSlug = isProjectDetailRoute
        ? location.pathname.split("/")[2] || null
        : null;
    const isHomeShell = isLoginRoute || isProjectsRoute;
    const isChatShell = isProjectDetailRoute;
    const pythonReady = state.isPythonReady;
    const statusLabel = pythonReady
        ? "Ready to analyze"
        : "Preparing my chemicals. Almost there...";
    const statusDotClass = pythonReady
        ? "bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.15)]"
        : "bg-amber-400 shadow-[0_0_0_6px_rgba(251,146,60,0.18)]";
    const statusTextClass = pythonReady ? "text-emerald-700" : "text-amber-700";
    const shellClass = isHomeShell
        ? "bg-sky-50/60 text-slate-900 home-shell"
        : isChatShell
          ? "bg-sky-50/60 text-slate-900 chat-shell"
          : "bg-slate-200 text-slate-800";
    const headerTheme =
        isHomeShell || isChatShell
            ? "bg-transparent border-transparent text-slate-800"
            : "bg-neutral-950 border-neutral-800 text-white";
    const headerSubtleText =
        isHomeShell || isChatShell ? "text-slate-500" : "text-neutral-500";

    useEffect(() => {
        const desiredTab = isProjectDetailRoute ? "chat" : "home";
        setState((s) =>
            s.activeTab === desiredTab ? s : { ...s, activeTab: desiredTab },
        );
    }, [isProjectDetailRoute]);

    useEffect(() => {
        const navState = location.state as { authError?: string } | null;
        if (navState?.authError) {
            setAuthError(navState.authError);
            navigate(`${location.pathname}${location.search}`, {
                replace: true,
                state: null,
            });
        }
    }, [location, navigate]);

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

    const ensureGeminiService = () => {
        if (gemini) return gemini;
        const key = getEnvApiKey();
        if (key) {
            const svc = new GeminiService(key);
            setGemini(svc);
            setState((s) => ({ ...s, hasApiKey: true }));
            return svc;
        }
        return null;
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

    // Restore auth session on refresh
    useEffect(() => {
        if (!hasFirebaseConfig) {
            setAuthInitialized(true);
            return;
        }

        const auth = getFirebaseAuth();
        if (!auth) {
            setAuthInitialized(true);
            return;
        }

        const normalize = (email?: string | null) =>
            (email || "").trim().toLowerCase();

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser?.email) {
                setUser({
                    email: normalize(firebaseUser.email),
                    name: firebaseUser.displayName || undefined,
                    photoURL: firebaseUser.photoURL || undefined,
                });
            } else {
                setUser(null);
            }
            setAuthInitialized(true);
        });

        return () => unsubscribe();
    }, []);

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
                    `We're so sorry! 😔
Our lab only accepts scientists from R/GA. But if you really, really want to participate, contact the project leaders. Who knows, you might be able to get in?`,
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
        setAuthError(null);
        setMessages([]);
        setInput("");
        setProcessingStep(ProcessingStep.IDLE);
        setState((s) => ({
            ...s,
            isLoadingData: true,
            selectedProject: project,
            heuristicasContent: null,
            resultadosContent: null,
        }));
        setExitConfirm(false);

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
            navigate("/", {
                replace: true,
                state: { authError: "Please sign in to access the projects." },
            });
            return;
        }

        if (!userCanAccessProject(project)) {
            setAuthError(
                "You do not have access to this project. Please contact the R/GA team.",
            );
            return;
        }

        navigate(`/projects/${project.slug}`);
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
        navigate("/projects");
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
    };

    const handleSendMessage = async () => {
        if (!input.trim()) return;
        if (!user) {
            alert(
                "Faça login com sua conta Google para conversar com a Marie.",
            );
            return;
        }
        const activeService =
            modelProvider === "gemini" ? ensureGeminiService() : ollama;
        if (!activeService) {
            alert(
                "Erro: Serviço de IA não inicializado. Defina VITE_GEMINI_API_KEY (ou GEMINI_API_KEY) nas variáveis de ambiente da Vercel.",
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

    if (!authInitialized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-indigo-50 text-slate-900">
                <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white shadow-[0_20px_60px_rgba(66,100,255,0.16)] border border-white/80">
                    <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
                    <span className="text-sm font-semibold">
                        Restaurando sessão...
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`relative flex flex-col min-h-screen font-sans overflow-hidden ${shellClass}`}
        >
            {user && (isHomeShell || isChatShell) && (
                <div
                    className={`home-background pointer-events-none ${isChatShell ? "chat-mode" : ""}`}
                >
                    <div className="mesh-gradient" />
                    <div className="orb orb-a" />
                    <div className="orb orb-b" />
                    <div className="orb orb-c" />
                    <div className="grid-overlay" />
                </div>
            )}
            {/* Header */}
            {user && (
                <header
                    className={`flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b backdrop-blur-sm z-10 ${headerTheme}`}
                >
                    <div className="flex items-center gap-3">
                        {/* <div className="w-8 h-8 bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500 rounded-lg flex items-center justify-center font-bold text-white shadow-[0_10px_30px_rgba(90,140,255,0.35)]">
                            M
                        </div> */}
                        <h1 className="text-lg font-bold tracking-tight">
                            Marie{" "}
                            <span
                                className={`font-normal ml-2 text-sm ${headerSubtleText}`}
                            >
                                v0.0.1
                            </span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
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
                                <div className="absolute z-10 right-0 mt-3 w-72 bg-white border border-white/80 shadow-[0_20px_60px_rgba(90,120,200,0.18)] rounded-2xl p-4 flex flex-col items-start">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center text-base font-bold uppercase">
                                            {user.photoURL ? (
                                                <img
                                                    src={user.photoURL}
                                                    alt={
                                                        user.name || user.email
                                                    }
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                (
                                                    user.name || user.email
                                                ).charAt(0)
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-slate-900">
                                                {user.name || user.email}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {user.email}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleSignOut}
                                        className="inline-flex ml-auto items-center gap-1 text-xs font-semibold py-3 px-5 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                                    >
                                        <LogOut className="w-3 h-3" />
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>

                        {isProjectDetailRoute &&
                            state.selectedProject &&
                            state.selectedProject.slug === currentSlug && (
                                <div className="flex items-center gap-4">
                                    <div className="hidden md:flex flex-col items-end mr-2">
                                        <span
                                            className={`text-sm font-bold ${isChatShell ? "text-slate-800" : "text-white"}`}
                                        >
                                            {state.selectedProject.name}
                                        </span>
                                        <span
                                            className={`text-xs ${isChatShell ? "text-slate-500" : "text-neutral-500"}`}
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
                                                : isChatShell
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
                                            ? "Confirm exit?"
                                            : "Change project"}
                                    </button>
                                </div>
                            )}
                    </div>
                </header>
            )}

            <main className="flex-1 z-1 overflow-hidden relative">
                <Routes>
                    <Route
                        path="/"
                        element={
                            user ? (
                                <Navigate to="/projects" replace />
                            ) : (
                                <Home
                                    authError={authError}
                                    hasFirebaseConfig={hasFirebaseConfig}
                                    isSigningIn={isSigningIn}
                                    onGoogleSignIn={handleGoogleSignIn}
                                />
                            )
                        }
                    />
                    <Route
                        path="/projects"
                        element={
                            !user ? (
                                <Navigate
                                    to="/"
                                    replace
                                    state={{
                                        authError:
                                            "Please sign in to view the projects.",
                                    }}
                                />
                            ) : projectsAllowedForUser.length === 0 ? (
                                <div className="min-h-[60vh] bg-slate-100 text-slate-800 flex items-center justify-center px-6">
                                    <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-[0_20px_60px_rgba(80,110,150,0.18)] p-8 space-y-4 text-center">
                                        <h2 className="text-2xl font-bold">
                                            Access not granted
                                        </h2>
                                        <p className="text-sm text-slate-600">
                                            Your email is not part of @rga.com
                                            and was not found in allowedUsers.
                                            Ask the project owners to add your
                                            address in projects.ts.
                                        </p>
                                        <button
                                            onClick={handleSignOut}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Switch account
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <ProjectsPage
                                    projects={projectsAllowedForUser}
                                    authError={authError}
                                    isPythonReady={state.isPythonReady}
                                    statusLabel={statusLabel}
                                    statusDotClass={statusDotClass}
                                    statusTextClass={statusTextClass}
                                    onSelectProject={handleSelectProject}
                                />
                            )
                        }
                    />
                    <Route
                        path="/projects/:slug"
                        element={
                            !user ? (
                                <Navigate
                                    to="/"
                                    replace
                                    state={{
                                        authError:
                                            "Please sign in to access this project.",
                                    }}
                                />
                            ) : (
                                <ProjectSlugPage
                                    user={user}
                                    userCanAccessProject={userCanAccessProject}
                                    loadProjectData={loadProjectData}
                                    state={state}
                                    messages={messages}
                                    input={input}
                                    processingStep={processingStep}
                                    onInputChange={setInput}
                                    onKeyDown={handleKeyDown}
                                    onResetSession={handleResetSession}
                                />
                            )
                        }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
}
