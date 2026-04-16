from fastapi import FastAPI, UploadFile, File
from fastapi.responses import StreamingResponse
import numpy as np
import ollama
import shutil
from rag_multi_pdf_search_en_mistral import (load_multi_pdf, chunk_with_source, embed_chunks, create_index, search)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel



app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

docs = load_multi_pdf("data")

if not docs:
    print("⚠️ No PDFs found. System running without knowledge base.")
    index, chunks, sources = None, [], []
else:
    chunks, sources = chunk_with_source(docs)
    vectors = embed_chunks(chunks)
    index = create_index(np.array(vectors))



@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_path = f"data/{file.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    global index, chunks, sources

    docs = load_multi_pdf("data")

    if  docs:
        chunks, sources = chunk_with_source(docs)
        vectors = embed_chunks(chunks)
        index = create_index(np.array(vectors))

        return {'message':"File Uploaded successfully"}    


@app.get("/health")
async def check_health():
    return {"message":"Server is running"}

class ChatRequest(BaseModel):
    query: str
    session_id: str

chat_sessions = {}


@app.post("/chat")
async def chat(req: ChatRequest):
    global chat_sessions

    query = req.query
    session_id = req.session_id

    if session_id not in chat_sessions:
        chat_sessions[session_id] = []

    history = chat_sessions[session_id]


    history.append({
        "role": "user",
        "content": query
    })

    if index is None:
        return {"message": "No documents uploaded yet. Please upload a PDF first."}

    res = search(query, index, chunks, sources)

    context = "\n\n".join([
        f"[Source: {src}]\n{chunk}"
        for chunk, src in res
    ])[:1200]

    messages = [
        {
            "role": "system",
            "content": f""" 
                You are a human assistant.
                Use the context below to answer.

                Context:
                {context}

                If not found say I dont know
            """
        }
    ] + history[-4:]

    def stream():
        try:
            response_stream  = ollama.chat(
                model='mistral',
                messages=messages,
                stream=True
            )

            full_response = ""

            for chunk in response_stream:
                content = chunk.get("message",{}).get("content","")
                full_response += content
                yield content
            
            history.append({
                "role": "assistant",
                "content": full_response
            })

            chat_sessions[session_id] = chat_sessions[-6:]
        except Exception as e:
            yield "\n[ERROR]: Model crashed. Try smaller query.\n"
        
    return StreamingResponse(stream(), media_type="text/plain")