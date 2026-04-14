from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import ollama
import os

model = SentenceTransformer("all-MiniLM-L6-v2")

def load_multi_pdf(dir_name):
    doc_list = []
    
    for file in os.listdir(dir_name):
        if file.endswith('.pdf'):
            path = os.path.join(dir_name, file)
            reader = PdfReader(path)

            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""

            doc_list.append((file, text))
    return doc_list

def chunk_with_source(docs, chunk_size=300, overlap=50):
    chunks = []
    sources = []

    for filename, text in docs:
        words = text.split()

        for i in range(0, len(words), chunk_size-overlap):
            chunk = " ".join(words[i:i+chunk_size])
            chunks.append(chunk)
            sources.append(filename)
    
    return chunks, sources

def embed_chunks(chunks):
    return model.encode(chunks)

def create_index(vectors):
    vectors = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
    
    dim = vectors.shape[1]
    index = faiss.IndexFlatIP(dim)

    index.add(vectors)
    return index

def search(query, index, chunks, sources, k=5):
    query_vec = model.encode([query])
    query_vec = query_vec / np.linalg.norm(query_vec, axis=1, keepdims=True)

    scores, indices = index.search(query_vec, k * 3)  # get more candidates

    results = []
    seen_sources = set()

    for i in indices[0]:
        chunk = chunks[i]
        source = sources[i]

        # ensure diversity (1 chunk per PDF first)
        if source not in seen_sources:
            results.append((chunk, source))
            seen_sources.add(source)

        # stop when enough results
        if len(results) >= k:
            break

    return results


def ask_llm_stream(query, context):
    prompt = f"""
You are an assistant. Answer ONLY using the context below.

Context:
{context}

Question:
{query}

If the answer is not in the context, say "I don't know".
Also mention the source.
"""

    stream = ollama.chat(
        model="llama3:latest",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        stream=True   # 🔥 IMPORTANT FIX
    )

    print("\nAI: ", end="", flush=True)

    full_response = ""

    for chunk in stream:
        content = chunk.get("message", {}).get("content", "")
        print(content, end="", flush=True)
        full_response += content

    print("\n")
    return full_response


if __name__ == '__main__':
    docs = load_multi_pdf("data")
    chunks, sources = chunk_with_source(docs)

    print(f"Loaded {len(docs)} documents")
    print(f"Created {len(chunks)} chunks")


    vectors = embed_chunks(chunks)
    index = create_index(np.array(vectors))

    print("\n🤖 Ask questions (type 'exit' to quit)\n")

    while True:
        query = input("You: ")

        if query.lower() == "exit":
            break

        results = search(query, index, chunks, sources)

        context = "\n\n".join([
            f"[Source: {src}]\n{chunk}"
            for chunk, src in results
        ])

        ask_llm_stream(query, context)

