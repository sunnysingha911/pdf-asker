from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import numpy as np
import ollama
import json
from rag_multi_pdf_search_en_mistral import (load_multi_pdf, chunk_with_source, embed_chunks, create_index, search)
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

docs = load_multi_pdf("data")
chunks, sources = chunk_with_source(docs)
vectors = embed_chunks(chunks)
index = create_index(np.array(vectors))


@app.post("/chat")
async def chat(req: dict):
    query = req['query']

    res = search(query, index, chunks, sources)

    context = "\n\n".join([
        f"[Source: {src}]\n{chunk}"
        for chunk, src in res
    ])[:1500]

    def stream():
        try:
            stream = ollama.chat(
                model='mistral',
                messages=[{
                    "role": "user",
                    "content": f"{context}\n\nQuestion: {query}"
                }],
                stream=True
            )

            for chunk in stream:
                yield chunk.get("message",{}).get("content","")
        except Exception as e:
            yield "\n[ERROR]: Model crashed. Try smaller query.\n"
        
    return StreamingResponse(stream(), media_type="text/plain")