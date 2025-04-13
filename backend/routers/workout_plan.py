# backend/routers/workout_plan.py

from fastapi import APIRouter, Request, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from workout_plan_logic import generate_workout_plan_with_ai, adjust_workout_plan, explain_exercise, generate_physical_assessment_with_ai, extract_insights_from_chat
import json

router = APIRouter()
templates = Jinja2Templates(directory="templates")

@router.get("/workout_planner", response_class=HTMLResponse)
async def workout_planner_form(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@router.post("/generate_workout_plan")
async def generate_workout_plan(
    request: Request,
    name: str = Form(...),
    age: int = Form(...),
    gender: str = Form(...),
    height: float = Form(...),
    weight: float = Form(...),
    occupation: str = Form(...),
    experience_level: str = Form(...),
    additional_info: str = Form(""),
    training_environment: str = Form("gym")
):
    user_data = {
        "name": name,
        "age": age,
        "gender": gender,
        "height": height,
        "weight": weight,
        "occupation": occupation,
        "experience_level": experience_level,
        "additional_info": additional_info,
        "training_environment": training_environment
    }
    
    # Log if chat insights are found in the additional_info
    if "--- Imported Chat History ---" in additional_info:
        insights = extract_insights_from_chat(additional_info)
        if insights:
            print(f"Extracted insights for {name}'s workout plan: {insights}")
    
    workout_plan = generate_workout_plan_with_ai(user_data)
    
    return JSONResponse(
        content={
            "plan": workout_plan,
            "name": name
        }
    )

@router.post("/adjust_workout_plan")
async def adjust_workout_plan_endpoint(
    request: Request,
    name: str = Form(...),
    adjustment_text: str = Form(...),
    current_plan: str = Form(...)
):
    try:
        current_plan_dict = json.loads(current_plan)
        adjusted_plan = adjust_workout_plan(
            current_plan=current_plan_dict,
            adjustment_text=adjustment_text,
            name=name
        )
        
        return JSONResponse(
            content={
                "plan": adjusted_plan,
                "name": name
            }
        )
    except json.JSONDecodeError:
        return JSONResponse(
            content={"error": "Invalid plan format"},
            status_code=400
        )
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@router.post("/explain_exercise")
async def explain_exercise_endpoint(
    request: Request,
    name: str = Form(...),
    day: str = Form(...),
    exercise: str = Form(...),
    current_plan: str = Form(...),
    user_data: str = Form(...)
):
    try:
        current_plan_dict = json.loads(current_plan)
        user_data_dict = json.loads(user_data)
        
        explanation = explain_exercise(
            current_plan=current_plan_dict,
            day=day,
            exercise=exercise,
            user_data=user_data_dict
        )
        
        return JSONResponse(
            content={
                "explanation": explanation
            }
        )
    except json.JSONDecodeError:
        return JSONResponse(
            content={"error": "Invalid data format"},
            status_code=400
        )
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@router.post("/generate_physical_assessment")
async def generate_physical_assessment(
    request: Request,
    name: str = Form(...),
    age: int = Form(...),
    gender: str = Form(...),
    height: float = Form(...),
    weight: float = Form(...),
    occupation: str = Form(...),
    experience_level: str = Form(...)
):
    try:
        user_data = {
            "name": name,
            "age": age,
            "gender": gender,
            "height": height,
            "weight": weight,
            "occupation": occupation,
            "experience_level": experience_level
        }
        
        # Calculate BMI
        bmi = weight / ((height / 100) ** 2)
        
        # Create assessment using AI
        assessment = generate_physical_assessment_with_ai(user_data, bmi)
        
        return JSONResponse(
            content={
                "assessment": assessment,
                "name": name
            }
        )
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@router.post("/analyze_chat_insights")
async def analyze_chat_insights(
    request: Request,
    chat_history: str = Form(...)
):
    try:
        # Extract insights from the provided chat history
        insights = extract_insights_from_chat(chat_history)
        
        return JSONResponse(
            content={
                "insights": insights if insights else "No specific workout insights found in the conversation."
            }
        )
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )