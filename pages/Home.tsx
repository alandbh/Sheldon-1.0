import React from "react";
import { LogIn, Loader2 } from "lucide-react";
import MarieFace from "../assets/marie-face2.svg";

interface HomeProps {
    authError: string | null;
    hasFirebaseConfig: boolean;
    isSigningIn: boolean;
    onGoogleSignIn: () => void;
}

export default function Home({
    authError,
    hasFirebaseConfig,
    isSigningIn,
    onGoogleSignIn,
}: HomeProps) {
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
                            <div className="w-24 h-24 rounded-full flex items-center justify-center animate-bounce-slow">
                                <img
                                    src={MarieFace}
                                    alt="Marie"
                                    className="w-20 h-20"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-4xl md:text-5xl font-black leading-tight text-transparent bg-clip-text bg-linear-to-r from-red-500 via-green-500 via to-blue-500">
                                Welcome aboard!
                            </h1>
                            <p className="text-base md:text-xl font-bold text-slate-600 max-w-2xl mx-auto">
                                I am{" "}
                                <a
                                    className="text-indigo-500"
                                    title="Inspired by Marie Curie"
                                    target="_blank"
                                    href="https://en.wikipedia.org/wiki/Marie_Curie"
                                >
                                    Marie
                                </a>
                                , the most badass scientist in history (sorry,
                                Newton).
                            </p>
                            <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto mt-10">
                                To enter our amazing lab, please first identify
                                yourself.
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
                            Configure o Firebase para habilitar o botão: defina
                            VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN,
                            VITE_FIREBASE_PROJECT_ID e VITE_FIREBASE_APP_ID no
                            painel da Vercel.
                        </div>
                    )}

                    <div className="mt-10 flex flex-col gap-6">
                        <button
                            onClick={onGoogleSignIn}
                            disabled={isSigningIn || !hasFirebaseConfig}
                            className="w-full text-xl inline-flex items-center py-4 justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 text-white font-semibold shadow-[0_18px_40px_rgba(66,112,255,0.35)] hover:shadow-[0_20px_50px_rgba(66,112,255,0.42)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSigningIn ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <LogIn className="w-5 h-5" />
                            )}
                            Sign in with Google
                        </button>
                        <p className="text-base text-slate-400 max-w-2xl mx-auto mt-2">
                            Just a reminder that only R/GA scientists are
                            authorized. ;)
                        </p>
                        <p className="text-xs text-slate-500">
                            Accounts using the domain @rga.com are automatically
                            approved. <br /> Other domains need to be authorized
                            by the R/GA team.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
