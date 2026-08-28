async function test() {
    try {
        const res = await fetch("http://localhost:3000/api/ai/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: "Tell me a joke",
                systemInstruction: "You are a funny assistant."
            })
        });
        console.log(res.status, await res.text());
    } catch(e) {
        console.error(e);
    }
}
test();
