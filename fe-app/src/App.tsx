import { useState } from "react";
import "./App.css";

type Message = {
  role: "user" | "ai";
  content: string;
};

function App() {
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [uploading, setUploading] = useState(false);

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
    <main className="flex flex-col h-screen bg-slate-950 text-slate-100">

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800">
        <h2 className="text-xl font-semibold text-blue-400 tracking-tight">
          Rag Chat
        </h2>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`
            max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed
            ${msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md text-right"
                  : "bg-slate-800 text-slate-200 rounded-bl-md text-left"
                }
          `}
            >
              {msg.content || (
                <span className="animate-pulse text-slate-400">Typing...</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-800 p-4 bg-slate-950">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">

          {/* 📎 Upload Button */}
          <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 px-4 py-3 rounded-xl text-sm">
            📎
            <input
              type="file"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setFileName(file.name);
                setUploading(true);

                const formData = new FormData();
                formData.append("file", file);

                try {
                  await fetch("http://localhost:8000/upload", {
                    method: "POST",
                    body: formData,
                  });

                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "ai",
                      content: `✅ Uploaded: ${file.name}`,
                    },
                  ]);
                } catch (err) {
                  console.error(err);
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>

          {/* 🧾 File Name */}
          {fileName && (
            <span className="text-xs text-slate-400 truncate max-w-[120px]">
              {fileName}
            </span>
          )}

          {/* 💬 Input */}
          <input
            type="text"
            value={input}
            placeholder="Ask something about your document..."
            className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" ? sendMessage() : undefined
            }
          />

          {/* 🚀 Send Button */}
          <button
            className="bg-blue-500 hover:bg-blue-400 active:scale-95 text-slate-950 font-semibold px-6 py-3 rounded-xl transition-all disabled:opacity-50"
            onClick={sendMessage}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Send"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default App;