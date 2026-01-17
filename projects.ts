export interface Project {
  slug: string;
  name: string;
  year: number;
  previousSlug: string;
  previousName: string;
  previousYear: number;
  resultsApi: {
    url: string;
    api_key: string;
  };
  heuristicsApi: {
    url: string;
    api_key: string;
  };
}

// Função auxiliar para ler variáveis de ambiente de forma híbrida (Vite ou Node)
const getEnv = (key: string) => {
  // 1. Tenta padrão Vite (import.meta.env) com prefixo obrigatório VITE_
  try {
    // @ts-ignore: Evita erros de lint se types do Vite não estiverem carregados
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const viteKey = `VITE_${key}`;
      // @ts-ignore
      if (import.meta.env[viteKey]) return import.meta.env[viteKey];
    }
  } catch (e) {}

  // 2. Tenta padrão Node/Next/Webpack (process.env)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {}

  return "";
};

// Tenta ler do ambiente (Vite ou Node). Se falhar, usa o fallback hardcoded.
const SHARED_API_KEY = getEnv("PROJECT_API_KEY") || "20rga25";

export const projects: Project[] = [
  {
    slug: "retail6",
    name: "Flashblack 6 (Retail)",
    year: 2025,
    previousSlug: "retail-5",
    previousName: "Flashblack 5",
    previousYear: 2024,
    resultsApi: {
      url: "https://heuristic-v4.vercel.app/api/result?current=retail6&previous=retail-5",
      api_key: SHARED_API_KEY,
    },
    heuristicsApi: {
      url: "https://heuristic-v4.vercel.app/api/heuristics?project=retail6",
      api_key: SHARED_API_KEY,
    },
  },
  {
    slug: "rspla2",
    name: "Garage SPLA 2",
    year: 2025,
    previousSlug: "latam-1",
    previousName: "Garage SPLA 1",
    previousYear: 2024,
    resultsApi: {
      url: "https://heuristic-v4.vercel.app/api/result?current=rspla2&previous=latam-2",
      api_key: SHARED_API_KEY,
    },
    heuristicsApi: {
      url: "https://heuristic-v4.vercel.app/api/heuristics?project=rspla2",
      api_key: SHARED_API_KEY,
    },
  },
];