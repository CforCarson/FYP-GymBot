# workout_plan_logic.py

import json
from openai import OpenAI
from typing import Dict, List, Optional
from loguru import logger
import os
import re

# Import the necessary components
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

# Configure OpenAI client
client = OpenAI(
    api_key="sk-RSlhENXN4JW0Hq5v060fDaB48c0d4888B402Ea723949300c", 
    base_url="https://api.gpt.ge/v1/"
)

# This function will be imported from main.py
vector_store = None
def set_vector_store(vs):
    global vector_store
    vector_store = vs

def generate_workout_plan_with_ai(user_data: Dict) -> Dict[str, List[str]]:
    # Check if RAG is available
    if vector_store is None:
        # Fallback to original method if vector store is not set
        return generate_plan_from_prompt(create_ai_prompt(user_data))
    
    # Map training environment to a more descriptive text
    training_env_descriptions = {
        "gym": "well-equipped gym with access to machines, barbells, and full range of weights",
        "home_light": "home workout with limited equipment like dumbbells, resistance bands, and bodyweight exercises",
        "bodyweight": "bodyweight-only exercises with no equipment"
    }
    
    training_env = user_data.get('training_environment', 'gym')
    training_env_description = training_env_descriptions.get(training_env, training_env_descriptions["gym"])
    
    # Extract insights from the additional_info field if it contains imported chat
    additional_info = user_data.get('additional_info', '')
    extracted_insights = extract_insights_from_chat(additional_info)
    
    # Create an enhanced prompt for RAG-based generation
    query = f"""
    Create a detailed workout plan for a {user_data['age']} year old {user_data['gender']} 
    with the following characteristics:
    - Height: {user_data['height']} cm
    - Weight: {user_data['weight']} kg
    - Occupation: {user_data.get('occupation', 'Not specified')}
    - Experience level: {user_data.get('experience_level', 'Beginner')}
    - Goal: {get_goal_description(user_data.get('goal', 0))}
    - Time available: {user_data.get('time_available', 60)} minutes per day
    
    Training Environment: {training_env_description}
    
    Additional information provided by the user:
    {additional_info}
    
    {extracted_insights}
    
    The plan should include exercises that are safe, effective, and appropriate for this individual.
    Take into account any limitations, injuries, or specific goals mentioned in the additional information.
    All exercises MUST be suitable for the specified training environment.
    """
    
    try:
        # Initialize retriever with MMR for diverse, relevant results
        retriever = vector_store.as_retriever(
            search_type="mmr",
            search_kwargs={
                "k": 3,  # Fetch top 3 documents for workouts (less is needed than for general QA)
                "fetch_k": 10,  # Consider top 10 before reranking
                "lambda_mult": 0.7,  # Balance between relevance and diversity
            }
        )
        
        # Create the RAG prompt template
        template = """
        You are creating a personalized workout plan. Use the context information about exercises, 
        workout structure, and fitness principles to create an appropriate plan.
        
        Context information from fitness resources:
        {context}
        
        User profile:
        {question}
        
        Create a balanced, safe, and effective workout plan for this person.
        Include specific exercises, sets, reps, and rest periods that match their profile.
        If the user profile contains any extracted insights from previous conversations, prioritize those preferences 
        and adapt the workout plan accordingly.
        
        IMPORTANT FORMATTING INSTRUCTIONS:
        1. Your response MUST be ONLY a valid JSON object with days of the week as keys and lists of exercises as values.
        2. DO NOT include any explanatory text, markdown, or other text before or after the JSON.
        3. DO NOT include ```json or ``` markers or any other formatting - just the raw JSON object.
        4. Ensure all exercises are suitable for the specified training environment.
        
        Example of proper response format:
        {{"Monday": ["Exercise 1: 3 sets x 12 reps", "Exercise 2: 4 sets x 10 reps"], "Tuesday": ["Exercise 3: 30 minutes"]}}
        """
        
        prompt = PromptTemplate(
            input_variables=["context", "question"],
            template=template,
        )
        
        # Initialize LLM with the same settings used in main.py
        llm = ChatOpenAI(
            model="gpt-3.5-turbo",
            api_key="sk-RSlhENXN4JW0Hq5v060fDaB48c0d4888B402Ea723949300c",
            base_url="https://api.gpt.ge/v1/",
            default_headers={"x-foo": "true"},
            temperature=0.3,  # Lower temperature for more consistent workout plans
        )
        
        # Create the RAG chain
        rag_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type='stuff',
            retriever=retriever,
            return_source_documents=True,
            chain_type_kwargs={
                "verbose": True,
                "prompt": prompt,
            }
        )
        
        # Execute the chain with the workout query
        response = rag_chain.invoke({"query": query})
        
        # Extract and process the result
        result = response["result"]
        
        try:
            # Try to parse as JSON
            workout_plan = json.loads(result)
            logger.info("Successfully generated RAG-based workout plan")
            
            # Log source documents for reference
            if "source_documents" in response:
                sources = [doc.metadata.get('source_file_path', 'unknown') for doc in response["source_documents"]]
                logger.info(f"Plan generated using sources: {sources}")
                
            return workout_plan
        
        except json.JSONDecodeError:
            # Try to extract JSON from the response
            workout_plan = extract_json_from_response(result)
            if workout_plan:
                return workout_plan
            
            # Fallback to original method if JSON extraction fails
            logger.warning("Failed to parse RAG response as JSON, falling back to direct generation")
            return generate_plan_from_prompt(create_ai_prompt(user_data))
    
    except Exception as e:
        logger.error(f"Error in RAG workout plan generation: {str(e)}")
        # Fallback to original method
        return generate_plan_from_prompt(create_ai_prompt(user_data))

def extract_insights_from_chat(additional_info: str) -> str:
    """
    Analyzes imported chat history for specific workout strategies, preferences, and limitations.
    Returns a structured summary of insights to inform the workout plan generation.
    """
    # Check if there's imported chat history
    if '--- Imported Chat History ---' not in additional_info:
        return ''
    
    try:
        # Extract patterns relevant to workout planning
        insights = []
        
        # Look for exercise preferences
        exercise_matches = re.findall(r'(prefer|like|enjoy|love|favorite).*?(exercise|workout|training|routine).*?(\w+)', additional_info, re.IGNORECASE)
        for match in exercise_matches:
            insights.append(f"User seems to prefer {match[2]} exercises or workouts.")
        
        # Look for injury information
        injury_matches = re.findall(r'(injury|injured|pain|hurt|sore).*?(\w+)', additional_info, re.IGNORECASE)
        for match in injury_matches:
            insights.append(f"User may have an injury or pain in their {match[1]}. Consider exercises that don't stress this area.")
        
        # Look for timing preferences
        time_matches = re.findall(r'(\d+)\s*(minute|hour|min).*?(workout|training|exercise)', additional_info, re.IGNORECASE)
        for match in time_matches:
            insights.append(f"User may prefer workouts lasting around {match[0]} {match[1]}s.")
        
        # Look for specific exercise mentions
        exercise_types = ['cardio', 'strength', 'weight', 'hiit', 'yoga', 'pilates', 'stretching', 'flexibility',
                          'squats', 'deadlifts', 'bench press', 'pushups', 'pull-ups', 'running', 'swimming']
        
        for exercise in exercise_types:
            if re.search(r'\b' + exercise + r'\b', additional_info, re.IGNORECASE):
                insights.append(f"User has mentioned {exercise} in their conversation.")
        
        # Return formatted insights
        if insights:
            formatted_insights = "INSIGHTS EXTRACTED FROM CONVERSATION:\n" + "\n".join([f"- {insight}" for insight in insights])
            logger.info(f"Extracted insights from chat: {formatted_insights}")
            return formatted_insights
        
        return ''
    
    except Exception as e:
        logger.error(f"Error extracting insights from chat: {str(e)}")
        return ''

# Helper functions to convert numeric values to text descriptions
def get_goal_description(goal_num):
    goals = {1: "Weight Loss", 2: "Muscle Gain", 3: "Maintenance"}
    return goals.get(goal_num, "General fitness")

def get_experience_description(exp_num):
    levels = {1: "Beginner", 2: "Intermediate", 3: "Advanced"}
    return levels.get(exp_num, "Beginner")

def get_equipment_description(equip_num):
    equipment = {1: "No Equipment", 2: "Basic Equipment", 3: "Full Gym Access"}
    return equipment.get(equip_num, "Basic equipment")

def adjust_workout_plan(current_plan: Dict[str, List[str]], adjustment_text: str, name: str) -> Dict[str, List[str]]:
    prompt = f"""
    Current workout plan for {name}:
    {json.dumps(current_plan, indent=2)}

    User's adjustment request:
    {adjustment_text}

    Please modify the workout plan according to the user's request while maintaining:
    1. A balanced workout structure
    2. Appropriate progression
    3. Adequate rest periods
    4. Safe exercise selection

    Return the adjusted plan in the same JSON format with days of the week as keys and lists of exercises as values.
    """

    return generate_plan_from_prompt(prompt)

def generate_plan_from_prompt(prompt: str) -> Dict[str, List[str]]:
    try:
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a professional fitness trainer. Generate or modify workout plans based on "
                        "user input. Always maintain proper exercise form, progression, and safety. "
                        "IMPORTANT: Your response MUST be ONLY a valid JSON object with days of the week as keys "
                        "and lists of exercises as values. DO NOT include any explanatory text, markdown code blocks, "
                        "or other formatting - just the raw JSON object. Example format: "
                        "{'Monday': ['Exercise 1: 3 sets x 12 reps', 'Exercise 2: 4 sets x 10 reps']}"
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3  # Lower temperature for more consistent formatting
        )
        
        response_content = completion.choices[0].message.content.strip()
        try:
            workout_plan = json.loads(response_content)
        except json.JSONDecodeError:
            workout_plan = extract_json_from_response(response_content)
            if workout_plan is None:
                return generate_default_plan()

        return workout_plan

    except Exception as e:
        print(f"Error generating workout plan: {str(e)}")
        return generate_default_plan()

def create_ai_prompt(user_data: Dict) -> str:
    # Convert goal, workout type, and equipment numbers to descriptions
    goals = {1: "Weight Loss", 2: "Muscle Gain", 3: "Maintenance"}
    workout_types = {1: "Cardio", 2: "Strength Training", 3: "Flexibility", 4: "HIIT", 5: "Mixed"}
    experience_levels = {1: "Beginner", 2: "Intermediate", 3: "Advanced"}
    
    # Map training environment to descriptive text
    training_env_descriptions = {
        "gym": "well-equipped gym with access to machines, barbells, and full range of weights",
        "home_light": "home workout with limited equipment like dumbbells, resistance bands, and bodyweight exercises",
        "bodyweight": "bodyweight-only exercises with no equipment"
    }
    
    training_env = user_data.get('training_environment', 'gym')
    training_env_description = training_env_descriptions.get(training_env, training_env_descriptions["gym"])
    
    prompt = f"""
    Please create a detailed weekly workout plan for a person with the following characteristics:

    Personal Information:
    - Age: {user_data['age']}
    - Gender: {user_data['gender']}
    - Height: {user_data['height']} cm
    - Weight: {user_data['weight']} kg
    - Occupation: {user_data.get('occupation', 'Not specified')}

    Fitness Parameters:
    - Goal: {goals.get(user_data.get('goal', 0), 'General fitness')}
    - Activity Level: Level {user_data.get('activity_level', 3)}
    - Preferred Workout Type: {workout_types.get(user_data.get('workout_type', 5), 'Mixed')}
    - Experience Level: {user_data.get('experience_level', 'Beginner')}
    - Training Environment: {training_env_description}
    - Time Available: {user_data.get('time_available', 60)} minutes per day

    Additional Information:
    {user_data.get('additional_info', 'No additional information provided.')}

    Please provide a detailed weekly plan with specific exercises, sets, reps, and rest periods where applicable.
    All exercises must be suitable for the specified training environment.
    Return the response in JSON format with days of the week as keys and lists of exercises as values.
    """
    return prompt

def extract_json_from_response(response_content: str) -> Dict:
    """Enhanced function to extract valid JSON from model responses.
    Handles different formats including markdown code blocks, text with explanations, etc."""
    
    # First, try to see if it's already a valid JSON
    try:
        return json.loads(response_content)
    except json.JSONDecodeError:
        pass
    
    # Try to extract JSON from markdown code blocks like ```json {...} ```
    try:
        if "```json" in response_content or "```" in response_content:
            # Extract content between markdown code blocks
            import re
            code_block_pattern = r"```(?:json)?\s*([\s\S]*?)\s*```"
            match = re.search(code_block_pattern, response_content)
            if match:
                json_str = match.group(1).strip()
                return json.loads(json_str)
    except Exception:
        pass
    
    # Fall back to the brace matching approach
    try:
        # Find the first opening brace and last closing brace
        start_index = response_content.find('{')
        if start_index == -1:
            return None
        
        # Find the matching closing brace by counting open/close braces
        brace_count = 0
        in_string = False
        escape_next = False
        end_index = -1
        
        for i in range(start_index, len(response_content)):
            char = response_content[i]
            
            # Handle string literals properly
            if char == '\\' and not escape_next:
                escape_next = True
                continue
            
            if char == '"' and not escape_next:
                in_string = not in_string
            
            escape_next = False
            
            if not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_index = i + 1
                        break
        
        if end_index == -1:
            return None
            
        json_str = response_content[start_index:end_index]
        return json.loads(json_str)
    except (ValueError, json.JSONDecodeError, IndexError):
        return None

def generate_default_plan() -> Dict[str, List[str]]:
    """Generate a basic default plan in case of API failure"""
    return {
        'Monday': ['30 minutes walking', 'Basic stretching'],
        'Tuesday': ['Body weight exercises', 'Light cardio'],
        'Wednesday': ['Rest day', 'Light stretching'],
        'Thursday': ['30 minutes walking', 'Basic stretching'],
        'Friday': ['Body weight exercises', 'Light cardio'],
        'Saturday': ['Active recovery', 'Light walking'],
        'Sunday': ['Rest day', 'Light stretching']
    }

def explain_exercise(current_plan: Dict[str, List[str]], day: str, exercise: str, user_data: Dict) -> str:
    # Map training environment to a more descriptive text
    training_env_descriptions = {
        "gym": "well-equipped gym",
        "home_light": "home with light weights",
        "bodyweight": "bodyweight-only, no equipment"
    }
    
    training_env = user_data.get('training_environment', 'gym')
    training_env_description = training_env_descriptions.get(training_env, training_env_descriptions["gym"])
    
    prompt = f"""
    Current workout plan context:
    {json.dumps(current_plan, indent=2)}

    Please explain why the exercise "{exercise}" was chosen for {day} for this person:
    - Age: {user_data['age']}
    - Gender: {user_data['gender']}
    - Occupation: {user_data.get('occupation', 'Not specified')}
    - Experience Level: {user_data.get('experience_level', 'Beginner')}
    - Training Environment: {training_env_description}

    Provide a detailed explanation including:
    1. Benefits of this exercise
    2. How it fits into the overall plan
    3. Why it's scheduled on this specific day
    4. How it's appropriate for the person's experience level
    5. How it's suitable for their training environment
    6. Any safety considerations or form tips

    Return the explanation in a clear, concise format.
    """

    try:
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional fitness trainer explaining the benefits and reasoning behind specific exercises in a workout plan."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        explanation = completion.choices[0].message.content.strip()
        return explanation

    except Exception as e:
        print(f"Error generating exercise explanation: {str(e)}")
        return "Unable to generate explanation at this time."

def generate_physical_assessment_with_ai(user_data: Dict, bmi: float) -> str:
    """Generate a physical assessment based on user data and BMI."""
    
    # Categorize BMI
    bmi_category = "normal weight"
    if bmi < 18.5:
        bmi_category = "underweight"
    elif bmi >= 25 and bmi < 30:
        bmi_category = "overweight"
    elif bmi >= 30:
        bmi_category = "obese"
    
    prompt = f"""
    Generate a brief physical assessment for a {user_data['age']} year old {user_data['gender']} with the following characteristics:
    - Height: {user_data['height']} cm
    - Weight: {user_data['weight']} kg
    - BMI: {bmi:.1f} (classified as {bmi_category})
    - Occupation: {user_data['occupation']}
    - Fitness experience level: {user_data['experience_level']}
    
    Provide:
    1. A brief analysis of their physical condition based on the provided metrics
    2. Potential physical implications of their occupation
    3. Some general recommendations based on their experience level
    4. Potential concerns or considerations
    
    The assessment should be concise, professional, and include HTML paragraph tags for formatting.
    """
    
    try:
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a professional fitness trainer and physical assessment specialist. "
                        "Provide accurate, helpful, and respectful physical assessments based on the data provided."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        assessment = completion.choices[0].message.content.strip()
        return assessment
    
    except Exception as e:
        logger.error(f"Error generating physical assessment: {str(e)}")
        return """<p>Unable to generate a physical assessment at this time.</p>
                <p>Please proceed with creating your workout plan or try again later.</p>"""