console.log("1. Iniciando script...");

// test-ollama.js
async function testGemma() {
    console.log("2. Dentro da função testGemma...");
    const url = "http://localhost:11434/api/chat";
    const payload = {
        model: "gemma3:4b",
        messages: [
            {
                role: "system",
                content: "Você é um assistente especialista em Python.",
            },
            {
                role: "user",
                content: "Crie um script simples que filtre nomes em um JSON.",
            },
        ],
        stream: false,
        options: { temperature: 0.1 },
    };

    console.log("🚀 Enviando requisição para o Ollama (Gemma 3 27B)...");

    try {
        const start = Date.now();
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const duration = (Date.now() - start) / 1000;

        console.log("\n✅ RESPOSTA RECEBIDA (" + duration + "s):");
        console.log("------------------------------------------");
        console.log(data.message.content);
        console.log("------------------------------------------");
    } catch (error) {
        console.error("\n❌ ERRO AO CONECTAR:");
        if (error.cause && error.cause.code === "ECONNREFUSED") {
            console.error(
                "O Ollama não parece estar rodando. Use 'ollama serve' no terminal.",
            );
        } else {
            console.error(error.message);
        }
    }
}

console.log("3. Chamando a função...");
testGemma();
