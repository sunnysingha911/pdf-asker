from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import ollama


def load_pdf(path: str):
    reader = PdfReader(path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text
    

def chunk_text(text: str, chunk_size = 300, overlap=50) -> list[str]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunks.append(" ".join(words[i:i+chunk_size]))
    return chunks

model = SentenceTransformer("all-MiniLM-L6-v2")

def embed_chunks(chunks: list[str]):
    return model.encode(chunks)

def create_index(vectors):
    vectors = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
    dim = vectors.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(vectors)
    return index


def search(query, index, chunks, k=3):
    query_vec = model.encode([query])
    query_vec = query_vec / np.linalg.norm(query_vec, axis=1, keepdims=True)

    scores, indices = index.search(query_vec, k)
    return [chunks[i] for i in indices[0]]

def ask_llm(query, context):
    context = context[:3000]
    prompt = f"""
        Answer the question using ONLY the context below.

        Context
            {context}

        Question
            {query}

        Also mention which source you used.
    """

    try:
        stream = ollama.chat(
            model='llama3:latest',
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            stream=True
        )


        full_response = ""

        for chunk in stream:
            content = chunk["message"]["content"]
            print(content, end="", flush=True)
            full_response+=content

        print("\n")
        return full_response
    except Exception as e:
        print("❌ LLM Error:", e)
        return "Error generating response"


if __name__ == "__main__":
    text = load_pdf("data/sample.pdf")

    chunks = chunk_text(text)

    vectors = embed_chunks(chunks)

    index = create_index(np.array(vectors))

    print("PDF loaded. Ask Question! \n")

    while True:
        query = input("You: ")

        if query.lower() == "exit":
            break

        relevant_chunks = search(query, index, chunks)

        context = "\n\n".join([f"[Source {i+1}]\n{chunk}" for i, chunk in enumerate(relevant_chunks)])

        answer = ask_llm(query, context)

        print("AI: ", answer,"\n")
