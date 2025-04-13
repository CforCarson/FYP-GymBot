# PDF Chatbot & Workout Planner - Full Stack Application

This is a full-stack web application that combines two main features: a PDF Chatbot with Retrieval-Augmented Generation (RAG) and an AI-powered Workout Planner. The application provides personalized fitness planning with injury management capabilities.

## Frontend Structure (React.js)
Located in `/frontend/src/`:

1. **Main Components**:
   - `App.js`: Root component for routing between features
   - Key feature components:
     - `/components/Chat/`: Real-time chat with session management
     - `/components/UploadPDF/`: PDF upload/deletion and management
     - `/components/AvailableDocuments/`: Document listing with filtering
     - `/components/WorkoutPlanner/`: Comprehensive workout planning system
       - `WorkoutPlannerForm.js`: Multi-step user data collection with physical assessment
       - Exercise explanation functionality with caching
       - Plan adjustment interface with natural language support
       - Training environment selection (gym, home, bodyweight)

2. **Styling**:
   - Bootstrap for responsive layout
   - Custom dark theme in `index.css`
   - Mobile-friendly interfaces
   - Interactive UI elements for exercise selection and explanation

## Backend Structure (FastAPI)
Located in `/backend/`:

1. **Core Files**:
   - `main.py`: FastAPI application entry point
     - API routes configuration
     - WebSocket connection handling with session support
     - CORS and middleware setup
     - PDF document processing
     - Vector store initialization for RAG

2. **Key Components**:
   - `workout_plan_logic.py`: Workout planning business logic:
     - RAG-enhanced plan generation using vector store retrieval
     - Physical assessment generation with BMI calculation
     - Personalized workout plan creation with environment adaptation
     - Plan adjustment based on user feedback
     - Exercise explanations with safety considerations
     - OpenAI API integration with fallback mechanisms

3. **Routers**:
   - `routers/workout_plan.py`: Workout-related endpoints:
     - `/generate_physical_assessment`
     - `/generate_workout_plan`
     - `/adjust_workout_plan`
     - `/explain_exercise`

4. **Database**:
   - `models.py`: SQLAlchemy models for chat history persistence
   - `chat_history.db`: SQLite database for conversation storage
   - `vectorstore_db/`: Chroma vector storage for document embeddings

## Core Features

1. **PDF Chatbot with RAG**:
   - Real-time WebSocket communication with session persistence
   - PDF document processing and vectorization
   - Document management (upload, list, delete)
   - LangChain integration for context-aware responses
   - Vector database (Chroma) for document retrieval
   - Chat history management with session tracking

2. **AI-Powered Workout Planner**:
   - Comprehensive user profiling:
     - Demographics (age, gender, height, weight)
     - Occupation and activity level
     - Experience level assessment
   - Physical assessment with BMI calculation
   - Training environment selection (gym, home with light weights, bodyweight)
   - Injury and limitation management through additional information input
   - RAG-enhanced workout plan generation using fitness knowledge
   - Plan adjustment based on user feedback
   - Detailed exercise explanations with form guidance and safety considerations
   - Explanation caching for improved performance

## API Integration
- **OpenAI API** used for:
  - Physical assessment generation
  - RAG-enhanced personalized workout planning
  - Plan adjustments with context awareness
  - Exercise explanations with safety guidance
  - Document Q&A through RAG
- **WebSocket** for real-time chat with session tracking
- **REST endpoints** for workout planning functions
- **Vector database** (Chroma) for document embedding storage and fitness knowledge retrieval

## Data Flow
1. Frontend makes API calls via Axios or WebSocket
2. Backend processes requests through FastAPI routes
3. Business logic handled in specialized modules
4. RAG integration retrieves relevant context for enhanced responses
5. AI integration through OpenAI API with fallback mechanisms
6. Document storage and retrieval via vector database
7. Chat history persistence in SQL database
8. Response rendering in React components

This architecture enables personalized fitness guidance while leveraging AI to provide contextually relevant information from both documents and fitness knowledge. The RAG implementation enhances both the PDF chatbot and workout planner components by providing more accurate, context-aware responses.