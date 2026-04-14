import { useState } from "react";
import "./App.css";

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);

  const sendMessage = async () => {
    if (!input) return;

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: input }]);

    const res = await fetch("http://localhost:8000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: input }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    let aiMessage = "AI: ";

    // Add placeholder AI message
    setMessages((prev) => [...prev, { role: "ai", content: "" }]);

    while (true) {
      const { done, value } = await reader?.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      aiMessage += chunk;

      // Update last message live
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].content = aiMessage;
        return updated;
      });
      setInput("");
    }
  };

  console.log(messages, "messages");

  return (
    <main className="flex flex-col h-screen bg-stone-950 text-stone-100 p-4 md:p-8">
      {/* Header */}
      <h2 className="text-2xl font-bold mb-4 text-amber-500 tracking-tight">
        Rag Chat
      </h2>

      {/* Chat Window: flex-1 makes this grow to fill the screen */}
      <div className="flex-1 flex flex-col mb-6 rounded-xl border border-stone-800 bg-stone-900/50 backdrop-blur-sm overflow-hidden shadow-inner">
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white text-right"
                    : "bg-stone-800 text-stone-200 text-left"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="flex items-center gap-3 max-w-4xl w-full mx-auto">
        <input
          type="text"
          value={input}
          placeholder="Type a message..."
          className="flex-1 bg-stone-900 border border-stone-700 text-stone-100 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all placeholder:text-stone-500"
          onChange={(e) => setInput(e?.target?.value)}
          onKeyDown={(e) => (e?.key === "Enter" ? sendMessage() : undefined)}
        />
        <button
          className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 font-semibold py-3 px-8 rounded-lg transition-all shadow-lg shadow-amber-900/20"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </main>
  );
}

export default App;
