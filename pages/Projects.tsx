import React from "react";
import { AlertTriangle, BarChart3, ChevronRight, Loader2 } from "lucide-react";
import MarieFace from "../assets/marie-face2.svg";
import { Project } from "../projects-data";

interface ProjectsProps {
    projects: Project[];
    authError: string | null;
    isPythonReady: boolean;
    statusLabel: string;
    statusDotClass: string;
    statusTextClass: string;
    onSelectProject: (project: Project) => void;
}

export default function Projects({
    projects,
    authError,
    isPythonReady,
    statusLabel,
    statusDotClass,
    statusTextClass,
    onSelectProject,
}: ProjectsProps) {
    return (
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
                        The most brilliant (sorry, Einstein) AI data scientist,
                        ready to <br />
                        help you make <b>amazing discoveries.</b>
                    </p>

                    <div className="flex items-center justify-center gap-3 mt-7">
                        <span className="h-px w-10 bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
                        <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_0_6px_rgba(80,130,255,0.12)]" />
                        <span className="h-px w-10 bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
                    </div>

                    {!isPythonReady && (
                        <div className="inline-flex items-center justify-center gap-2 text-sm text-slate-500 mt-5 px-4 py-2 rounded-full bg-white/70 border border-white/80 shadow-sm backdrop-blur">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            <span>Preparando ambiente Python (Pyodide)...</span>
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
                    {!isPythonReady
                        ? Array.from({ length: projects.length || 4 }).map(
                              (_, idx) => (
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
                              ),
                          )
                        : projects.map((proj) => (
                              <button
                                  key={proj.slug}
                                  onClick={() => onSelectProject(proj)}
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
                                          Comparativo vs {proj.previousName} (
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
    );
}
