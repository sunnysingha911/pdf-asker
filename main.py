import ollama

messages = []

def chat():
    print("Local AI assistant (type exit to continue) \n")
    while True:
        user_input = input("You: ")        
        if user_input.lower() == "exit":
            break

        messages.append({"role":"user","content":user_input})

        response = ollama.chat(
            model="llama3:latest",
            messages=messages
        )

        reply = response['message']['content']
        messages.append({"role":"assistant", "content":reply})

        print("AI:", reply,"\n")

if __name__ == "__main__":
    chat()