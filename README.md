# Marie Curie

**Marie Curie** is an AI-powered data scientist that uses a local Python runtime to analyze UX heuristic data rigorously **without sending** datasets to external servers.

The key differentiator is that raw data is never loaded into the LLM. Instead, the application retrieves data via an authenticated API, and the AI generates Python code to analyze that pre-fetched data.

This Python code executes within a local instance powered by WebAssembly and Pyodide.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in `.env` to your Gemini API key
3. Set the `BASE_API_URL` in `.env` to your base API URL
4. Set the `PROJECT_API_KEY` in `.env` to your project API key
5. Run the app:
   `npm run dev`
