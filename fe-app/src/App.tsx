import { useState } from "react";
import "./App.css";

type Message = {
  role: "user" | "ai";
  content: string;
};

function App() {
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);

  const sendMessage = async () => {
    if (!input) return;

    const userInput = input;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userInput },
    ]);

    setInput(""); // ✅ moved here

    const res = await fetch("http://localhost:8000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: userInput }),
    });

    if (!res.body) {
      throw new Error("No response body");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let aiMessage = "";

    // placeholder AI message
    setMessages((prev) => [...prev, { role: "ai", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      aiMessage += chunk;

      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];

        updated[updated.length - 1] = {
          ...last,
          content: aiMessage,
        };

        return updated;
      });
    }
  };

  return (
    <main className="flex flex-col h-screen bg-stone-950 text-stone-100">

      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-800">
        <h2 className="text-xl font-semibold text-amber-400 tracking-tight">
          Rag Chat
        </h2>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
              }`}
          >
            <div
              className={`
              max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed
              ${msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-stone-800 text-stone-200 rounded-bl-md"
                }
            `}
            >
              {msg.content || (
                <span className="animate-pulse text-stone-400">Typing...</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="border-t border-stone-800 p-4 bg-stone-950">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            placeholder="Type a message..."
            className="flex-1 bg-stone-900 border border-stone-700 text-stone-100 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-stone-500"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" ? sendMessage() : undefined
            }
          />

          <button
            className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 font-semibold px-6 py-3 rounded-xl transition-all"
            onClick={sendMessage}
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}

export default App;