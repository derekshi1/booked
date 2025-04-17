# chatbot.py
import sys
import json
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
import os


load_dotenv()


library = ['Moby Dick', 'The Scarlett Letter']
chat_model = ChatOpenAI(api_key=os.getenv("OPENAI_API_KEY"), model="gpt-4o-mini")
chat_history = [SystemMessage(content=f"You are a helpful AI assistant. The user has a personal library with: {', '.join(library)}")]


for line in sys.stdin:
   try:
       data = json.loads(line)
       user_input = data.get("message")
       chat_history.append(HumanMessage(content=user_input))
       response = chat_model(chat_history)
       chat_history.append(AIMessage(content=response.content))
       print(json.dumps({ "response": response.content }))
       sys.stdout.flush()
   except Exception as e:
       print(json.dumps({ "error": str(e) }))
       sys.stdout.flush()
