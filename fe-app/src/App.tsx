import { useRef, useState } from "react";
import "./App.css";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type Message = {
  role: "user" | "ai";
  content: string;
};

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);

  const sessionId = useRef(crypto.randomUUID());

  // -------------------------------
  // SEND MESSAGE (Streaming)
  // -------------------------------
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userInput = input;

    // add user message
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userInput },
    ]);

    setInput("");

    const res = await fetch("http://localhost:8000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: userInput,
        session_id: sessionId.current,
      }),
    });

    if (!res.body) throw new Error("No response body");

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
        updated[updated.length - 1] = {
          role: "ai",
          content: aiMessage,
        };
        return updated;
      });
    }
  };

  // -------------------------------
  // FILE UPLOAD
  // -------------------------------
  const handleUpload = async (file: File) => {
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
  };

  // -------------------------------
  // RENDER
  // -------------------------------
  return (
    <main className="flex flex-col h-screen bg-slate-950 text-slate-100">

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800">
        <h2 className="text-xl font-semibold text-blue-400">
          RAG Chat
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
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                ${msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md text-right"
                  : "bg-slate-800 text-slate-200 rounded-bl-md"
                }`}
            >
              {/* 🔥 Markdown Rendering */}
              {msg.content ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ inline, className, children }) {
                      const match = /language-(\w+)/.exec(
                        className || ""
                      );

                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                        >
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      ) : (
                        <code className="bg-slate-900 px-1 rounded">
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <span className="animate-pulse text-slate-400">
                  Typing...
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">

          {/* Upload */}
          <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 px-4 py-3 rounded-xl text-sm">
            📎
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
          </label>

          {/* File name */}
          {fileName && (
            <span className="text-xs text-slate-400 truncate max-w-[120px]">
              {fileName}
            </span>
          )}

          {/* Input */}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask something..."
            className="flex-1 bg-slate-900 border border-slate-700 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Send */}
          <button
            onClick={sendMessage}
            disabled={uploading}
            className="bg-blue-500 hover:bg-blue-400 text-black font-semibold px-6 py-3 rounded-xl disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Send"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default App;