# PDF Chatbot & Workout Planner - FastAPI Backend

This repository hosts a FastAPI application that combines document processing capabilities with an AI-powered workout planning system.

## Features

### PDF Chatbot Features
- **Upload PDF**: Process and store PDF files for retrieval
- **WebSocket Chat**: Real-time question answering with session management
- **Document Retrieval**: Smart content retrieval from uploaded documents
- **Document Management**: Delete documents when no longer needed
- **Filtered Search**: Search documents with custom filters
- **Memory Integration**: Conversation history for context-aware responses
- **Session Management**: Maintain separate chat sessions with history

### Workout Planner Features
- **RAG-Enhanced Plan Generation**: Creates personalized workout plans using:
  - Vector database retrieval for context-aware recommendations
  - User demographics (name, age, gender, height, weight)
  - Activity level and goals
  - Experience level
  - Training environment (gym, home, bodyweight)
  - Additional information (injuries, limitations, goals)
- **Physical Assessment**: BMI calculation and AI-generated fitness assessment
- **Plan Adjustment**: Modifies existing plans based on user feedback with natural language processing
- **Exercise Explanations**: Provides detailed explanations for each exercise, including:
  - Benefits and purpose
  - Integration with overall plan
  - Safety considerations
  - Form tips
  - Injury prevention guidance
- **Fallback Mechanisms**: Robust error handling with default plans when API fails

## Setup Instructions

### Prerequisites

- Python 3.10 or newer
- Required packages (install via requirements.txt)
- Environment variables for API keys (or configured in code)

### Installation

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Start the FastAPI server:
   ```bash
   uvicorn main:app --host 127.0.0.1 --port 8000
   ```

### API Endpoints

#### PDF Chatbot Endpoints
- **GET `/get_documents/`**: List all processed documents
- **POST `/upload_pdf/`**: Upload and process new PDFs
- **DELETE `/delete_document/{filename}`**: Remove a document from storage
- **DELETE `/clear_chat_history/{session_id}`**: Clear chat history for a session
- **POST `/filtered_search/`**: Search documents with custom filters
- **WebSocket `/ws/chat`**: Real-time chat interface with session support

#### Workout Planner Endpoints
- **GET `/workout_planner`**: Display workout planner form
- **POST `/generate_physical_assessment`**: Generate AI-powered physical assessment
- **POST `/generate_workout_plan`**: Generate personalized workout plans
- **POST `/adjust_workout_plan`**: Modify existing plans based on user input
- **POST `/explain_exercise`**: Get detailed explanations for specific exercises

## Technologies Used

- **FastAPI**: Modern web framework for APIs
- **LangChain**: NLP and document processing
- **OpenAI Integration**: AI-powered responses and plan generation
- **Chroma Vector Store**: Document embedding storage and RAG retrieval
- **WebSocket**: Real-time communication
- **SQLAlchemy**: Database ORM for chat history
- **Jinja2**: Template rendering
- **Retrieval-Augmented Generation (RAG)**: Enhanced responses using document context

## Implementation Details

### RAG Implementation
The application uses Retrieval-Augmented Generation to enhance both the PDF chatbot and workout planner:

1. **Document Processing**:
   - PDFs are processed and split into chunks
   - Text is embedded using OpenAI's embedding model
   - Embeddings are stored in a Chroma vector database

2. **Workout Plan Generation**:
   - User queries are embedded and matched against stored fitness knowledge
   - Relevant context is retrieved and included in the prompt
   - The LLM generates plans with this additional context
   - Fallback to direct generation if RAG processing fails

3. **Error Handling**:
   - Robust exception handling throughout the codebase
   - Default workout plan generation when API calls fail
   - Structured error responses with appropriate HTTP status codes