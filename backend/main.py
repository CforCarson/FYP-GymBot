# backend/main.py
import json
import os
import asyncio
import uvicorn
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect, Form, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse
from loguru import logger
import openai
from chromadb.config import Settings
from langchain.chains import RetrievalQA
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.callbacks.manager import CallbackManager
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferMemory
import uuid
from sqlalchemy.orm import Session
from models import ChatMessage, get_db

# Import the workout plan logic
from workout_plan_logic import generate_workout_plan_with_ai, set_vector_store

# Make sure to import your router:
from routers.workout_plan import router as workout_plan_router

# -----------------------------------------------------------------------------
# API Configuration
# -----------------------------------------------------------------------------

# Set your OpenAI API key
API_KEY = "sk-RSlhENXN4JW0Hq5v060fDaB48c0d4888B402Ea723949300c"  # Replace with your actual API key
BASE_URL = "https://api.gpt.ge/v1/"

# Initialize OpenAI settings
openai.api_key = API_KEY
openai.base_url = BASE_URL
openai.default_headers = {"x-foo": "true"}

# -----------------------------------------------------------------------------
# Initialize FastAPI app and templates
# -----------------------------------------------------------------------------

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files and templates if necessary
# app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Include the router so that /adjust_workout_plan is registered:
app.include_router(workout_plan_router)

# -----------------------------------------------------------------------------
# Setup LangChain components for PDF Chatbot
# -----------------------------------------------------------------------------

# Create directories if they do not exist
if not os.path.exists('files'):
    os.mkdir('files')
if not os.path.exists('vectorstore_db'):
    os.mkdir('vectorstore_db')



# Define prompt template
template = """
Answer the question based on the context, in a concise manner, in markdown and using bullet points where applicable.

Context: {context}
History: {history}

Question: {question}
Answer:
"""

prompt = PromptTemplate(
    input_variables=["history", "context", "question"],
    template=template,
)

memory = ConversationBufferMemory(
    memory_key="history",
    return_messages=True,
    input_key="question"
)

# Create a function to reset memory
def reset_memory():
    global memory
    # Re-initialize the memory object to clear its history
    memory = ConversationBufferMemory(
        memory_key="history",
        return_messages=True,
        input_key="question"
    )
    logger.info("Conversation memory has been reset")

# Initialize embeddings model
embeddings = OpenAIEmbeddings(
    model="text-embedding-ada-002",  # Specifically use embedding model
    api_key=API_KEY,
    base_url=BASE_URL,
    default_headers=openai.default_headers
)

# Initialize vector store with settings
chroma_settings = Settings(
    anonymized_telemetry=False,
    is_persistent=True
)

vector_store = Chroma(
    persist_directory='vectorstore_db',
    embedding_function=embeddings,
    client_settings=chroma_settings
)

# After initializing the vector_store in main.py, add this line
# (around line 110, after vector_store initialization)
set_vector_store(vector_store)

# Initialize chat model
llm = ChatOpenAI(
    model="gpt-3.5-turbo",  # Use chat model instead of embedding model
    api_key=API_KEY,
    base_url=BASE_URL,
    default_headers=openai.default_headers,
    streaming=True,
    verbose=True,
    callback_manager=CallbackManager([StreamingStdOutCallbackHandler()]),
)

# Configure text splitter - UPDATED PARAMETERS
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1200,
    chunk_overlap=150,
    length_function=len
)

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

def delete_document(filename):
    try:
        # Delete all documents from the vector store
        vector_store._collection.delete(where={})
        logger.info(f"Deleted all documents from vector store")
        return True
    except Exception as e:
        logger.error(f"Error in delete_document: {str(e)}")
        raise

def handle_get_documents():
    try:
        coll = vector_store.get()
        source_file_paths = [metadata['source_file_path'] for metadata in coll['metadatas']]
        return list(set(source_file_paths))
    except Exception as e:
        logger.error(f"Error getting documents: {str(e)}")
        return []

def upload_pdf_to_vectorstore_db(file_path: str):
    try:
        loader = PyPDFLoader(file_path)
        docs = loader.load_and_split(text_splitter)
        # Enhanced metadata to improve search and filtering
        file_name = file_path.split("/")[-1]
        for i, doc in enumerate(docs):
            doc.metadata = {
                "source_file_path": file_name,
                "chunk_id": i,
                "file_type": "pdf",
                "page_number": doc.metadata.get("page", "unknown"),
                "total_chunks": len(docs)
            }
        vector_store.add_documents(docs)
        print(f"Successfully uploaded {len(docs)} documents from {file_path}")
    except Exception as e:
        logger.error(f"Error uploading PDF: {str(e)}")
        raise

# -----------------------------------------------------------------------------
# PDF Chatbot Endpoints
# -----------------------------------------------------------------------------

@app.get("/get_documents/")
def get_documents():
    try:
        documents = handle_get_documents()
        return {"data": documents}
    except Exception as e:
        logger.error(f"Error getting documents: {str(e)}")
        return JSONResponse(
            content={"error": f"Failed to retrieve documents: {str(e)}"},
            status_code=500
        )

@app.post("/upload_pdf/")
async def upload_pdf(file: UploadFile = File(...)):
    file_location = os.path.join("files", file.filename)
    logger.info(f"Received PDF: {file_location}")

    # Save the uploaded file
    with open(file_location, "wb") as f:
        f.write(await file.read())

    upload_pdf_to_vectorstore_db(file_location)
    return {"message": "PDF uploaded and processed successfully"}

@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    try:
        await websocket.accept()
        
        # Extract session_id from query parameters or create a new one
        query_params = dict(websocket.query_params)
        session_id = query_params.get("session_id")
        is_new_session = False
        
        if not session_id:
            session_id = str(uuid.uuid4())
            is_new_session = True
            # Also reset memory when starting a completely new session
            reset_memory()
            # Send the new session ID to the client
            await websocket.send_text(json.dumps({
                "event_type": "session_id",
                "data": session_id
            }))
        
        # Get database session
        db = next(get_db())
        
        # If existing session, send chat history
        if not is_new_session:
            try:
                # Get message history for this session
                history = db.query(ChatMessage).filter(
                    ChatMessage.session_id == session_id
                ).order_by(ChatMessage.timestamp).all()
                
                # If history is empty but this is not a new session ID,
                # it means the history was cleared, so we should reset memory
                if not history:
                    reset_memory()
                
                # Send history to client
                await websocket.send_text(json.dumps({
                    "event_type": "history",
                    "data": [{"role": msg.role, "message": msg.message} for msg in history]
                }))
            except Exception as e:
                logger.error(f"Error retrieving chat history: {str(e)}")
        
        # Initialize the QA chain with enhanced retrieval
        retriever = vector_store.as_retriever(
            search_type="mmr",  # Maximum Marginal Relevance for diversity
            search_kwargs={
                "k": 5,  # Fetch top 5 documents
                "fetch_k": 20,  # Consider top 20 before reranking
                "lambda_mult": 0.7,  # Balance between relevance and diversity
            }
        )
        
        qa_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type='stuff',
            retriever=retriever,
            return_source_documents=True,
            chain_type_kwargs={
                "verbose": True,
                "prompt": prompt,
                "memory": memory,
            }
        )
        
        while True:
            try:
                user_input = await websocket.receive_text()
                
                # Save user message to database
                user_message = ChatMessage(
                    session_id=session_id,
                    role="user",
                    message=user_input
                )
                db.add(user_message)
                db.commit()
                
                # Process the user's query
                response = qa_chain.invoke({"query": user_input})
                answer = response["result"]
                context = response["source_documents"]
                
                # Create a placeholder for the complete answer
                complete_answer = ""
                
                # Stream response word by word
                for chunk in answer.split(" "):
                    chunk_with_space = chunk + " "
                    complete_answer += chunk_with_space
                    
                    await websocket.send_text(json.dumps({
                        "event_type": "answer",
                        "data": chunk_with_space
                    }, ensure_ascii=False))
                    await asyncio.sleep(0.05)
                
                # Save assistant's message to database
                assistant_message = ChatMessage(
                    session_id=session_id,
                    role="assistant", 
                    message=complete_answer
                )
                db.add(assistant_message)
                db.commit()
                
                # Send source document information
                file_names = [f"**{doc.metadata.get('source_file_path', '')}**"
                              for doc in context]
                if file_names:
                    document = "\n\nSource PDF:\n\n" + "\n".join(list(set(file_names)))
                    
                    # Send document source info
                    await websocket.send_text(json.dumps({
                        "event_type": "answer",
                        "data": document
                    }, ensure_ascii=False))
                    
                    # Update the assistant message with source information
                    assistant_message.message += document
                    db.commit()
                    
            except Exception as e:
                logger.error(f"Error in chat loop: {str(e)}")
                await websocket.send_text(json.dumps({
                    "event_type": "error",
                    "data": str(e)
                }))
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
    finally:
        logger.info("WebSocket connection closed")
        try:
            await websocket.close()
        except Exception:
            pass

# Also add this new endpoint to clear chat history
@app.delete("/clear_chat_history/{session_id}")
def clear_chat_history(session_id: str):
    db = next(get_db())
    try:
        db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
        db.commit()
        # Also reset the in-memory conversation history
        reset_memory()
        return {"message": "Chat history cleared successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error clearing chat history: {str(e)}")
        return {"error": str(e)}

@app.on_event("shutdown")
async def shutdown_event():
    # No need to call vector_store._client.close()
    logger.info("Application is shutting down")

# -----------------------------------------------------------------------------
# Workout Planner Endpoints
# -----------------------------------------------------------------------------

@app.get("/workout_planner", response_class=HTMLResponse)
async def workout_planner_form(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/generate_workout_plan")
async def generate_workout_plan(
    request: Request,
    name: str = Form(...),
    age: int = Form(...),
    gender: str = Form(...),
    height: float = Form(...),
    weight: float = Form(...),
    goal: int = Form(0),  # Make optional with default
    activity_level: int = Form(0),  # Make optional with default
    workout_type: int = Form(0),  # Make optional with default
    experience_level: str = Form(...),  # Changed to string
    equipment: int = Form(0),  # Make optional with default
    time_available: int = Form(0),  # Make optional with default
    additional_info: str = Form("")  # Add this parameter
):
    try:
        user_data = {
            'name': name,
            'age': age,
            'gender': gender,
            'height': height,
            'weight': weight,
            'goal': goal,
            'activity_level': activity_level,
            'workout_type': workout_type,
            'experience_level': experience_level,
            'equipment': equipment,
            'time_available': time_available,
            'additional_info': additional_info  # Include the additional info
        }

        # Validate all fields quickly
        if not all(str(v).strip() for k, v in user_data.items() if k in ['name', 'age', 'gender', 'height', 'weight', 'experience_level']):
            return JSONResponse({"error": "All required fields must be provided."}, status_code=400)

        workout_plan = generate_workout_plan_with_ai(user_data)

        # On success, return JSON with the plan
        return JSONResponse({"plan": workout_plan, "name": user_data["name"]})

    except ValueError as e:
        # Return a 400 for any invalid user input
        return JSONResponse({"error": str(e)}, status_code=400)
    except Exception as e:
        logger.error(f"Error generating workout plan: {str(e)}")
        # Return a 500 status for unexpected errors
        return JSONResponse({"error": "An error occurred. Please try again."}, status_code=500)

# -----------------------------------------------------------------------------
# Run the application
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

# Add this endpoint to delete a document
@app.delete("/delete_document/{filename}")
def delete_document_endpoint(filename: str):
    try:
        # Delete all documents from vector store
        delete_document(filename)
        
        # Delete all files in the files directory
        files_path = "files"
        for file in os.listdir(files_path):
            file_path = os.path.join(files_path, file)
            if os.path.isfile(file_path):
                os.remove(file_path)
                logger.info(f"Deleted file: {file_path}")
        
        return JSONResponse(content={"message": "All documents deleted successfully"})
    except Exception as e:
        logger.error(f"Error deleting documents: {str(e)}")
        return JSONResponse(
            content={"error": f"Failed to delete documents: {str(e)}"},
            status_code=500
        )

@app.post("/filtered_search/")
async def filtered_search(request: Request):
    data = await request.json()
    query = data.get("query", "")
    filters = data.get("filters", {})
    
    # Create a filter dict for ChromaDB
    filter_dict = {}
    if "document_name" in filters and filters["document_name"]:
        filter_dict["source_file_path"] = filters["document_name"]
    
    try:
        # Use retriever with filters
        filtered_retriever = vector_store.as_retriever(
            search_type="mmr",
            search_kwargs={
                "k": 5,
                "filter": filter_dict if filter_dict else None,
                "fetch_k": 20,
                "lambda_mult": 0.7,
            }
        )
        
        # Create a temporary chain for this query
        temp_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type='stuff',
            retriever=filtered_retriever,
            return_source_documents=True,
            chain_type_kwargs={
                "verbose": True,
                "prompt": prompt,
            }
        )
        
        # Execute the chain
        response = temp_chain.invoke({"query": query})
        
        # Get results and sources
        answer = response["result"]
        sources = [
            {
                "file_name": doc.metadata.get("source_file_path", "Unknown"),
                "page": doc.metadata.get("page_number", "Unknown"),
            }
            for doc in response["source_documents"]
        ]
        
        return {
            "answer": answer,
            "sources": sources
        }
        
    except Exception as e:
        logger.error(f"Error in filtered search: {str(e)}")
        return {"error": str(e)}

# Add this new endpoint to get chat history by session ID
@app.get("/get_chat_history/{session_id}")
def get_chat_history(session_id: str):
    db = next(get_db())
    try:
        # Get message history for this session
        history = db.query(ChatMessage).filter(
            ChatMessage.session_id == session_id
        ).order_by(ChatMessage.timestamp).all()
        
        # Format history for response
        formatted_history = [{"role": msg.role, "message": msg.message} for msg in history]
        
        return {"history": formatted_history}
    except Exception as e:
        logger.error(f"Error retrieving chat history: {str(e)}")
        return JSONResponse(
            content={"error": f"Failed to retrieve chat history: {str(e)}"},
            status_code=500
        )