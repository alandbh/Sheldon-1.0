import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Code, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import MarieAvatar from "../assets/marie-avatar.svg";
import { Project, projects } from "../projects-data";
import { AppState, AuthUser, Message, ProcessingStep } from "../types";

interface ProjectSlugProps {
    user: AuthUser | null;
    userCanAccessProject: (project: Project) => boolean;
    loadProjectData: (project: Project) => Promise<void>;
    state: AppState;
    messages: Message[];
    input: string;
    processingStep: ProcessingStep;
    onInputChange: (value: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onResetSession: () => void;
}

export default function ProjectSlug({
    user,
    userCanAccessProject,
    loadProjectData,
    state,
    messages,
    input,
    processingStep,
    onInputChange,
    onKeyDown,
    onResetSession,
}: ProjectSlugProps) {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [viewError, setViewError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const project = useMemo(
        () => projects.find((p) => p.slug === slug),
        [slug],
    );

    useEffect(() => {
        if (!slug) return;

        if (!project) {
            setViewError("This project does not exist.");
            return;
        }

        if (!user) {
            setViewError("You need to sign in to access this project.");
            return;
        }

        if (!userCanAccessProject(project)) {
            setViewError(
                "You do not have access to this project. Please contact the R/GA team.",
            );
            return;
        }

        setViewError(null);

        const needsLoad =
            state.selectedProject?.slug !== project.slug ||
            !state.heuristicasContent ||
            !state.resultadosContent;

        if (needsLoad && !state.isLoadingData) {
            loadProjectData(project);
        }
    }, [
        slug,
        project,
        user,
        userCanAccessProject,
        loadProjectData,
        state.selectedProject?.slug,
        state.heuristicasContent,
        state.resultadosContent,
        state.isLoadingData,
    ]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
        });
    }, [messages, processingStep]);

    if (viewError) {
        return (
            <div className="min-h-[60vh] bg-slate-100 text-slate-800 flex items-center justify-center px-6">
                <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-[0_20px_60px_rgba(80,110,150,0.18)] p-8 space-y-4 text-center">
                    <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
                    <h2 className="text-2xl font-bold">Access issue</h2>
                    <p className="text-sm text-slate-600">{viewError}</p>
                    <button
                        onClick={() => navigate("/projects")}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go back
                    </button>
                </div>
            </div>
        );
    }

    if (state.isLoadingData) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col items-center">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <h2 className="text-2xl font-bold">Preparing our lab</h2>
                    <p className="text-neutral-500 mt-2">
                        Loading project data {project?.name || ""}...
                    </p>
                </div>

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
        <div className="relative h-full overflow-hidden">
            <div className="relative z-1 max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 h-full flex flex-col">
                <div className="chat-pane flex flex-col h-full min-h-0">
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        <div className="chat-feed flex-1 overflow-y-auto space-y-5 pr-1">
                            {messages.length === 0 && (
                                <>
                                    <div className="text-center mt-4 md:mt-4 opacity-70 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                        <div className="w-22 h-22 bg-white/70 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/80 shadow-lg">
                                            <img
                                                src={MarieAvatar}
                                                alt="Marie"
                                                className="w-20 h-20"
                                            />
                                        </div>
                                        <h3 className="text-2xl font-semibold text-slate-800 mb-2">
                                            {state.selectedProject && (
                                                <span>
                                                    Ask me{" "}
                                                    <i className="font-serif text-3xl">
                                                        anything
                                                    </i>{" "}
                                                    about{" "}
                                                    {state.selectedProject.name}
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-lg text-slate-600 mb-6">
                                            In{" "}
                                            <i className="font-serif text-xl">
                                                any
                                            </i>{" "}
                                            language, mon chéri. 💅
                                        </p>
                                    </div>
                                    <div className=" max-w-2xl mx-auto gap-3 flex flex-col mt-12">
                                        <p className="text-lg text-slate-600 font-bold">
                                            👉 For example, if you type...
                                        </p>
                                        <ul className="list-disc text-slate-500 space-y-1 ml-4 mb-8 flex flex-col gap-3">
                                            <li>
                                                Just the heuristic number, like:{" "}
                                                <i className="font-bold">
                                                    "3.12"
                                                </i>
                                                <br />↳ I will do a complete
                                                analysis of the results of this
                                                heuristic.
                                            </li>
                                            <li>
                                                Or the "theme" of a heuristic,
                                                like:{" "}
                                                <i className="font-bold">
                                                    "tolerance to typing errors"
                                                </i>
                                                <br />↳ I will find the
                                                heuristic number and do a
                                                complete analysis.
                                            </li>
                                        </ul>
                                        <p className="text-lg text-slate-600 font-bold">
                                            👉 But you can also ask more complex
                                            questions, such as:
                                        </p>
                                        <ul className="list-disc text-slate-500 space-y-1 ml-8 flex flex-col gap-3">
                                            <li>
                                                <i className="font-bold">
                                                    "considering only apps,
                                                    which players have voice
                                                    search?"
                                                </i>
                                                <br />↳ I will find the
                                                heuristic for this topic,
                                                analyze the success criteria,
                                                and filter only the players in
                                                the "App" journey.
                                            </li>
                                            <li>
                                                <i className="font-bold">
                                                    "players who were able to
                                                    identify an invalid number"
                                                </i>
                                                <br />↳ I will try to find the
                                                answer in all evaluator's
                                                comments
                                            </li>
                                        </ul>
                                    </div>
                                </>
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
                                            className={`chat-bubble max-w-[85%] ${
                                                msg.role === "user"
                                                    ? "bubble-user"
                                                    : msg.role === "error"
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
                                                                    {children}
                                                                </code>
                                                            ) : (
                                                                <code
                                                                    className="bg-slate-900/80 text-emerald-200 px-1.5 py-0.5 rounded text-[12px] font-mono"
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
                                                                className="border-slate-200 my-5"
                                                                {...props}
                                                            />
                                                        ),
                                                        blockquote: ({
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
                                        (msg.script || msg.pythonOutput) && (
                                            <div className="ml-12 md:ml-14 max-w-[85%]">
                                                <details className="group">
                                                    <summary className="text-xs flex items-center gap-2 text-slate-500 hover:text-slate-700 cursor-pointer list-none select-none transition-colors">
                                                        <Code className="w-3 h-3" />
                                                        <span>
                                                            View Generated
                                                            Script & Logs
                                                        </span>
                                                    </summary>
                                                    <div className="mt-2 space-y-2">
                                                        {msg.script && (
                                                            <div className="log-card">
                                                                <pre className="text-xs text-emerald-200 font-mono whitespace-pre-wrap">
                                                                    {msg.script}
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

                            {processingStep !== ProcessingStep.IDLE && (
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

                    <div className="input-shell p-4 md:p-5 rounded-2xl border border-white/80 mb-10">
                        {messages.length > 0 ? (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 ">
                                {processingStep === ProcessingStep.IDLE && (
                                    <button
                                        onClick={onResetSession}
                                        className="flex cursor-pointer text-lg mx-auto items-center gap-2 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 text-white px-5 py-3 px-6 rounded-full font-semibold transition-all shadow-[0_12px_30px_rgba(80,120,255,0.35)] hover:shadow-[0_14px_36px_rgba(80,120,255,0.45)]"
                                    >
                                        <Sparkles className="w-5 h-5" />
                                        Perform New Analysis
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="relative flex items-center">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) =>
                                        onInputChange(e.target.value)
                                    }
                                    onKeyDown={onKeyDown}
                                    placeholder="Type the heuristic number or your question here..."
                                    disabled={
                                        !state.isPythonReady ||
                                        processingStep !== ProcessingStep.IDLE
                                    }
                                    className="w-full bg-white border border-slate-300 rounded-xl pl-4 pr-14 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 disabled:opacity-60 transition-all"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
