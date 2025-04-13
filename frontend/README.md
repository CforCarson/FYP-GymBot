# PDF Chatbot & Workout Planner - React Frontend

This is a web application that combines two main features:
1. A PDF chatbot with Retrieval-Augmented Generation (RAG)
2. An intelligent workout planner with personalized fitness assessments

## Features

### PDF Chatbot
- Real-time chat interface with WebSocket communication
- Session management with persistent chat history
- PDF document upload, processing, and management
- Filtered document search capabilities
- Context-aware responses through RAG technology

### Workout Planner
- Multi-step workflow for comprehensive user profiling:
  - Basic demographics (name, age, gender, height, weight)
  - Occupation and fitness experience level
  - AI-generated physical assessment with BMI analysis
  - Training environment selection (gym, home with light weights, bodyweight)
  - Injury/limitation documentation
- Personalized workout plan generation considering:
  - Physical assessment results
  - Training environment constraints
  - Experience level and limitations
  - RAG-enhanced recommendations
- Interactive workout plan features:
  - Double-click exercises for detailed explanations
  - Natural language plan adjustments
  - Plan regeneration option
  - Exercise explanation caching for better performance
  - Safety and form guidance for injury prevention

## Technologies Used

- React.js for component-based UI
- React Bootstrap for responsive layout
- WebSocket for real-time chat communication
- Axios for HTTP requests to backend API
- ReactMarkdown for formatted content display
- Session management for persistent interactions
- Modal interfaces for detailed explanations

## Getting Started

### Prerequisites

Ensure you have Node.js installed on your local machine.

### Installation

1. Clone the repository
2. Install dependencies:
   ```sh
   npm install
   ```

### Usage

1. Start the development server:
   ```sh
   npm start
   ```
2. Open your browser and go to [http://localhost:3000](http://localhost:3000)

### Features Guide

#### PDF Chatbot
- Upload PDF documents in the "Upload PDF" section
- View and manage documents in the available documents list
- Filter searches to specific documents
- Chat with the AI about document contents
- Sessions maintain your conversation history

#### Workout Planner
1. Complete the initial form with personal information
2. Review your AI-generated physical assessment
3. Specify any injuries/limitations and select your training environment
4. Receive a personalized workout plan
5. Interact with your plan:
   - Get detailed exercise explanations with form guidance
   - Request plan adjustments using natural language
   - Create new plans as needed

## UI Elements

### Enhanced Exercise Explanation
The exercise explanation modal provides:
- Detailed breakdown of exercise benefits
- Form guidance with safety tips
- Integration explanation with overall plan
- Adaptation options for different fitness levels
- Cached explanations for faster access on repeat viewing

### Training Environment Selection
Choose from three training environments:
- Gym: Full access to equipment and machines
- Home with light weights: Limited equipment like dumbbells and bands
- Bodyweight only: No equipment required

### Physical Assessment Display
- BMI calculation and categorization
- Occupation-specific physical considerations
- Experience-appropriate recommendations
- Visual formatting for easy reading