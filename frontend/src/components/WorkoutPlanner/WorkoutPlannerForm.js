// src/components/WorkoutPlanner/WorkoutPlannerForm.js

import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Modal, Form } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';

const WorkoutPlannerForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: '',
    height: '',
    weight: '',
    occupation: '',
    experience_level: 'Beginner'
  });

  // Add a new state for showing the assessment step
  const [showAssessment, setShowAssessment] = useState(false);
  // Add a state for the physical assessment
  const [physicalAssessment, setPhysicalAssessment] = useState(null);
  // Add a state for additional information from user
  const [additionalInfo, setAdditionalInfo] = useState('');
  // Add a state for training environment
  const [trainingEnvironment, setTrainingEnvironment] = useState('gym');

  const [workoutPlan, setWorkoutPlan] = useState(null);
  const [adjustmentInput, setAdjustmentInput] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [exerciseExplanation, setExerciseExplanation] = useState('');
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [explanationCache, setExplanationCache] = useState({});
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);
  const [loadingChatImport, setLoadingChatImport] = useState(false);
  const chatFileInputRef = useRef(null);
  const [chatInsights, setChatInsights] = useState('');
  const [showInsightsAlert, setShowInsightsAlert] = useState(false);

  const styles = {
    exerciseExplanation: {
      padding: '0.5rem',
      lineHeight: '1.6',
      fontSize: '1rem'
    },
    markdownHeading: {
      marginTop: '1rem',
      marginBottom: '0.5rem',
      fontWeight: 'bold'
    },
    markdownList: {
      marginLeft: '1rem',
      marginBottom: '1rem'
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    const data = new FormData();
    Object.keys(formData).forEach((key) => {
      data.append(key, formData[key]);
    });

    // Instead of generating the full workout plan right away,
    // first get a physical assessment
    axios.post('http://localhost:8000/generate_physical_assessment', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
      .then((response) => {
        setLoading(false);
        if (response.data.error) {
          setError(response.data.error);
        } else {
          setPhysicalAssessment(response.data.assessment);
          setShowAssessment(true);
          setError(null);
        }
      })
      .catch((error) => {
        setLoading(false);
        if (error.response?.data?.error) {
          setError(error.response.data.error);
        } else {
          setError('An error occurred. Please try again.');
        }
      });
  };

  // Function to handle the generation of the final workout plan
  const handleGenerateFinalPlan = () => {
    setLoading(true);

    const data = new FormData();
    Object.keys(formData).forEach((key) => {
      data.append(key, formData[key]);
    });
    data.append('additional_info', additionalInfo);
    data.append('training_environment', trainingEnvironment);

    axios.post('http://localhost:8000/generate_workout_plan', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
      .then((response) => {
        setLoading(false);
        if (response.data.error) {
          setError(response.data.error);
          setWorkoutPlan(null);
        } else {
          setWorkoutPlan(response.data.plan);
          setShowAssessment(false); // Move to the plan view
          setError(null);
        }
      })
      .catch((error) => {
        setLoading(false);
        if (error.response?.data?.error) {
          setError(error.response.data.error);
        } else {
          setError('An error occurred. Please try again.');
        }
        setWorkoutPlan(null);
      });
  };

  const handleAdjustPlan = async (e) => {
    e.preventDefault();
    if (!adjustmentInput.trim()) return;

    setLoading(true);
    const data = new FormData();
    data.append('name', formData.name);
    data.append('adjustment_text', adjustmentInput);
    data.append('current_plan', JSON.stringify(workoutPlan));

    try {
      const response = await axios.post('http://localhost:8000/adjust_workout_plan', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.error) {
        setError(response.data.error);
      } else {
        setWorkoutPlan(response.data.plan);
        setAdjustmentInput('');
        setError(null);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExerciseClick = async (day, exercise) => {
    setSelectedExercise({ day, exercise });
    setShowExplanationModal(true);

    const cacheKey = `${day}-${exercise}`;

    if (explanationCache[cacheKey]) {
      setExerciseExplanation(explanationCache[cacheKey]);
      return;
    }

    setLoadingExplanation(true);

    const data = new FormData();
    data.append('name', formData.name);
    data.append('day', day);
    data.append('exercise', exercise);
    data.append('current_plan', JSON.stringify(workoutPlan));
    data.append('user_data', JSON.stringify(formData));

    try {
      const response = await axios.post('http://localhost:8000/explain_exercise', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.error) {
        setError(response.data.error);
      } else {
        const explanation = response.data.explanation;
        setExplanationCache(prev => ({
          ...prev,
          [cacheKey]: explanation
        }));
        setExerciseExplanation(explanation);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'An error occurred while getting the explanation.');
    } finally {
      setLoadingExplanation(false);
    }
  };

  const renderWorkoutPlan = (plan) => {
    return (
      <div className="workout-plan-container" style={{
        border: '1px solid #ccc',
        padding: '1rem',
        borderRadius: '8px',
        marginTop: '1rem'
      }}>
        {Object.entries(plan).map(([day, exercises]) => (
          <div key={day} style={{ marginBottom: '1rem' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>{day}</h2>
            <ul style={{ paddingLeft: '1.2rem' }}>
              {exercises.map((ex, i) => (
                <li 
                  key={i} 
                  style={{ 
                    marginBottom: '0.25rem',
                    cursor: 'pointer'
                  }}
                  onDoubleClick={() => handleExerciseClick(day, typeof ex === 'object' ? JSON.stringify(ex) : ex)}
                  className="exercise-item"
                >
                  {typeof ex === 'object'
                    ? Object.entries(ex).map(([key, value]) => (
                        <div key={key}>{key}: {value}</div>
                      ))
                    : ex
                  }
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  };

  // Function to trigger the chat history file input
  const triggerChatFileInput = () => {
    chatFileInputRef.current.click();
  };

  // Function to handle importing chat history from JSON file
  const handleChatHistoryImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setLoadingChatImport(true);
    setError(null);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        // Validate the imported data has messages
        if (!importedData.messages || !Array.isArray(importedData.messages)) {
          throw new Error('Invalid chat history file format');
        }
        
        // Format the chat history into a readable text
        const formattedHistory = importedData.messages
          .map(msg => `${msg.role === 'user' ? 'You' : 'Assistant'}: ${msg.message}`)
          .join('\n\n');
        
        // Add a header to the formatted history
        const chatHistoryText = `--- Imported Chat History ---\n\n${formattedHistory}`;
        
        // Append to existing additional info or set as new value
        if (additionalInfo.trim()) {
          setAdditionalInfo(additionalInfo + '\n\n' + chatHistoryText);
        } else {
          setAdditionalInfo(chatHistoryText);
        }
        
        // Analyze insights from the chat history
        analyzeChatInsights(chatHistoryText);
        
        // Reset the file input
        e.target.value = null;
        
      } catch (error) {
        console.error('Import error:', error);
        setError('Failed to import chat history. Please make sure the file is valid.');
      } finally {
        setLoadingChatImport(false);
      }
    };
    
    reader.readAsText(file);
  };

  // After handleChatHistoryImport and before importChatHistoryFromSession, add:
  const analyzeChatInsights = async (chatHistory) => {
    setLoadingChatImport(true);
    try {
      const formData = new FormData();
      formData.append('chat_history', chatHistory);
      
      const response = await axios.post(
        'http://localhost:8000/analyze_chat_insights',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );
      
      if (response.data.insights && response.data.insights !== "No specific workout insights found in the conversation.") {
        // Show insights in the UI
        setChatInsights(response.data.insights);
        setShowInsightsAlert(true);
        
        // Auto-hide insights alert after 10 seconds
        setTimeout(() => setShowInsightsAlert(false), 10000);
      }
    } catch (error) {
      console.error('Error analyzing chat insights:', error);
    } finally {
      setLoadingChatImport(false);
    }
  };

  // Add a function to import chat history directly from the session ID
  const importChatHistoryFromSession = async () => {
    const sessionId = localStorage.getItem('chatSessionId');
    if (!sessionId) {
      setError('No active chat session found. Please start a chat conversation first.');
      return;
    }
    
    setLoadingChatImport(true);
    setError(null);
    
    try {
      const response = await axios.get(`http://localhost:8000/get_chat_history/${sessionId}`);
      
      if (response.data.error) {
        setError(response.data.error);
      } else {
        // Format the chat history into a readable text
        const history = response.data.history;
        
        if (history.length === 0) {
          setError('No chat history found for the current session.');
          setLoadingChatImport(false);
          return;
        }
        
        const formattedHistory = history
          .map(msg => `${msg.role === 'user' ? 'You' : 'Assistant'}: ${msg.message}`)
          .join('\n\n');
          
        // Add a header to the formatted history
        const chatHistoryText = `--- Imported Chat History ---\n\n${formattedHistory}`;
        
        // Append to existing additional info or set as new value
        if (additionalInfo.trim()) {
          setAdditionalInfo(additionalInfo + '\n\n' + chatHistoryText);
        } else {
          setAdditionalInfo(chatHistoryText);
        }
        
        // Analyze insights from the chat history
        analyzeChatInsights(chatHistoryText);
      }
    } catch (error) {
      console.error('Error importing chat history:', error);
      setError(error.response?.data?.error || 'Failed to import chat history');
    } finally {
      setLoadingChatImport(false);
    }
  };

  // Update the renderAssessmentStep function to include chat history import
  const renderAssessmentStep = () => {
    return (
      <div className="assessment-container">
        <h2>Your Physical Assessment</h2>
        
        <div className="physical-assessment" style={{
          background: '#333',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem'
        }}>
          <p dangerouslySetInnerHTML={{ __html: physicalAssessment }}></p>
        </div>
        
        <h3>Refine Your Workout Plan</h3>
        
        {/* Training Environment Selection */}
        <div className="mb-4">
          <h4>Training Environment</h4>
          <p>Please select your preferred training environment:</p>
          
          <Form.Group>
            <div className="training-environment-options">
              <div 
                className={`training-option ${trainingEnvironment === 'gym' ? 'selected' : ''}`}
                onClick={() => setTrainingEnvironment('gym')}
              >
                <div className="option-icon">🏋️</div>
                <div className="option-label">Well-Equipped Gym</div>
                <div className="option-description">
                  Access to full gym equipment (machines, barbells, weights, etc.)
                </div>
              </div>
              
              <div 
                className={`training-option ${trainingEnvironment === 'home_light' ? 'selected' : ''}`}
                onClick={() => setTrainingEnvironment('home_light')}
              >
                <div className="option-icon">💪</div>
                <div className="option-label">Home Workout with Light Weights</div>
                <div className="option-description">
                  Simple equipment like dumbbells, resistance bands, etc.
                </div>
              </div>
              
              <div 
                className={`training-option ${trainingEnvironment === 'bodyweight' ? 'selected' : ''}`}
                onClick={() => setTrainingEnvironment('bodyweight')}
              >
                <div className="option-icon">🤸</div>
                <div className="option-label">Bodyweight Workout</div>
                <div className="option-description">
                  No equipment needed, using only your body weight
                </div>
              </div>
            </div>
          </Form.Group>
        </div>
        
        <h4>Additional Information</h4>
        <p>To create a more personalized workout plan, please provide any additional information about:</p>
        <ul>
          <li>Any injuries or limitations</li>
          <li>Specific fitness goals</li>
          <li>Time constraints</li>
          <li>Activity preferences</li>
          <li>Other relevant health information</li>
        </ul>
        
        <div className="mb-3">
          <textarea
            className="form-control"
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            placeholder="Describe your physical condition, limitations, and specific goals here..."
            rows={5}
          />
        </div>
        
        {/* Display chat insights alert */}
        {showInsightsAlert && chatInsights && (
          <div className="alert alert-info alert-dismissible fade show" role="alert">
            <h4 className="alert-heading">Insights from Your Conversation</h4>
            <p>We found some relevant workout preferences in your chat history:</p>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#f8f9fa', padding: '10px', borderRadius: '5px' }}>
              {chatInsights}
            </pre>
            <p className="mb-0">These insights will be considered when creating your workout plan.</p>
            <button type="button" className="btn-close" onClick={() => setShowInsightsAlert(false)} aria-label="Close"></button>
          </div>
        )}
        
        {/* Add chat history import buttons */}
        <div className="mb-3">
          <div className="d-flex gap-2 mb-2">
            {/* Direct session import button */}
            <button 
              type="button" 
              onClick={importChatHistoryFromSession}
              className="btn btn-primary btn-sm"
              disabled={loadingChatImport}
            >
              {loadingChatImport ? 'Importing...' : 'Import from Current Session'}
            </button>
            
            {/* File import button */}
            <input
              type="file"
              ref={chatFileInputRef}
              onChange={handleChatHistoryImport}
              accept=".json"
              style={{ display: 'none' }}
            />
            <button 
              type="button" 
              onClick={triggerChatFileInput}
              className="btn btn-secondary btn-sm"
              disabled={loadingChatImport}
            >
              {loadingChatImport ? 'Importing...' : 'Import from File'}
            </button>
          </div>
          <small className="text-muted d-block">
            Import your conversation with the chatbot as additional information
          </small>
        </div>
        
        <div className="d-flex justify-content-between">
          <button 
            onClick={() => setShowAssessment(false)} 
            className="btn btn-secondary"
          >
            Go Back
          </button>
          <button 
            onClick={handleGenerateFinalPlan} 
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Generating Plan...' : 'Generate Workout Plan'}
          </button>
        </div>
      </div>
    );
  };

  // Function to handle exporting the workout plan
  const handleExportPlan = () => {
    if (!workoutPlan) return;
    
    // Create the export data that includes both the plan and user info
    const exportData = {
      workoutPlan,
      userData: formData,
      additionalInfo,
      trainingEnvironment
    };
    
    // Convert the data to JSON string
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create a Blob and URL for the JSON data
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link element to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.name}_workout_plan.json`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Function to export workout plan as iCalendar (.ics) file
  const handleExportToCalendar = () => {
    if (!workoutPlan) return;
    
    // Create iCalendar content
    let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Workout Planner//EN\nCALSCALE:GREGORIAN\n';
    
    // Generate a start date (beginning next Monday)
    const today = new Date();
    const nextMonday = new Date(today);
    const daysUntilMonday = (1 + 7 - today.getDay()) % 7;
    nextMonday.setDate(today.getDate() + (daysUntilMonday || 7)); // If today is Monday, start next Monday
    nextMonday.setHours(0, 0, 0, 0);
    
    // Generate events for each workout day
    Object.entries(workoutPlan).forEach(([day, exercises]) => {
      // Map day names to day numbers (0-6, where 0 is Sunday)
      const dayMap = {
        'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 
        'Friday': 5, 'Saturday': 6, 'Sunday': 0
      };
      
      // Get day number from day name
      const dayNumber = dayMap[day.split(' ')[0]];
      if (dayNumber === undefined) return; // Skip if day format is not recognized
      
      // Calculate the date for this workout
      const workoutDate = new Date(nextMonday);
      const dayOffset = (dayNumber - 1 + 7) % 7; // Calculate days from Monday
      workoutDate.setDate(nextMonday.getDate() + dayOffset);
      
      // Format date for iCalendar (YYYYMMDD)
      const formattedDate = workoutDate.toISOString().replace(/[-:]/g, '').split('T')[0];
      
      // Create a summary of exercises
      const exerciseSummary = exercises.map(ex => {
        return typeof ex === 'object' 
          ? Object.entries(ex).map(([key, value]) => `${key}: ${value}`).join(', ')
          : ex;
      }).join('\\n');
      
      // Create event
      icsContent += 'BEGIN:VEVENT\n';
      icsContent += `DTSTART:${formattedDate}T080000\n`; // 8:00 AM start
      icsContent += `DTEND:${formattedDate}T090000\n`;   // 9:00 AM end
      icsContent += `SUMMARY:${formData.name}'s Workout - ${day}\n`;
      icsContent += `DESCRIPTION:${exerciseSummary.replace(/,/g, '\\,')}\n`;
      icsContent += 'END:VEVENT\n';
    });
    
    icsContent += 'END:VCALENDAR';
    
    // Create a Blob and URL for the ics data
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link element to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.name}_workout_calendar.ics`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Function to trigger the file input click
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  // Function to handle importing a workout plan
  const handleImportPlan = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setImportError(null);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        // Validate the imported data
        if (!importedData.workoutPlan || !importedData.userData) {
          throw new Error('Invalid workout plan file format');
        }
        
        // Update state with imported data
        setWorkoutPlan(importedData.workoutPlan);
        setFormData(importedData.userData);
        setAdditionalInfo(importedData.additionalInfo || '');
        setTrainingEnvironment(importedData.trainingEnvironment || 'gym');
        setShowAssessment(false);
        
        // Reset the file input
        e.target.value = null;
      } catch (error) {
        setImportError('Failed to import workout plan. Please make sure the file is valid.');
        console.error('Import error:', error);
        
        // Reset the file input
        e.target.value = null;
      }
    };
    
    reader.readAsText(file);
  };

  return (
    <div>
      {showAssessment && !workoutPlan && !loading ? (
        renderAssessmentStep()
      ) : !workoutPlan && !loading ? (
        <form onSubmit={handleSubmit} style={{ padding: '1rem', maxWidth: '500px' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold' }}>Name:</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your name"
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold' }}>Age:</label>
            <input
              type="number"
              name="age"
              required
              value={formData.age}
              onChange={handleChange}
              placeholder="e.g. 30"
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold' }}>Gender:</label>
            <select
              name="gender"
              required
              value={formData.gender}
              onChange={handleChange}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              <option value="">Select gender</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold' }}>Height (cm):</label>
            <input
              type="number"
              name="height"
              required
              value={formData.height}
              onChange={handleChange}
              placeholder="e.g. 175"
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold' }}>Weight (kg):</label>
            <input
              type="number"
              name="weight"
              required
              value={formData.weight}
              onChange={handleChange}
              placeholder="e.g. 70"
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold' }}>Occupation:</label>
            <input
              type="text"
              name="occupation"
              required
              value={formData.occupation}
              onChange={handleChange}
              placeholder="e.g. Software Developer"
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold' }}>Experience Level:</label>
            <select
              name="experience_level"
              required
              value={formData.experience_level}
              onChange={handleChange}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          <div className="mt-3 d-flex justify-content-between">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportPlan}
              accept=".json"
              style={{ display: 'none' }}
            />
            <button 
              type="button" 
              onClick={triggerFileInput}
              className="btn btn-outline-secondary"
              style={{ marginRight: '10px' }}
            >
              Import Plan
            </button>
            
            <button 
              type="submit" 
              style={{ 
                padding: '0.8rem 1.2rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                flex: '1'
              }}
            >
              Continue
            </button>
          </div>
          
          {importError && (
            <div className="alert alert-danger mt-3">
              {importError}
            </div>
          )}
        </form>
      ) : loading ? (
        <div className="text-center mt-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">
            {adjustmentInput ? 'Adjusting your plan...' : showAssessment ? 'Generating your plan...' : 'Assessing your physical condition...'}
          </p>
        </div>
      ) : (
        <div style={{ marginTop: '1rem' }}>
          <h1>Your Workout Plan</h1>
          {renderWorkoutPlan(workoutPlan)}

          {/* Export Button */}
          <div className="mt-3 mb-4">
            <div className="d-flex">
              <button 
                onClick={handleExportPlan}
                className="btn btn-success flex-grow-1 me-2"
              >
                Export Workout Plan
              </button>
              
              <button 
                onClick={handleExportToCalendar}
                className="btn btn-info flex-grow-1"
              >
                Add to Calendar
              </button>
            </div>
          </div>

          {/* Plan Adjustment Form */}
          <div className="content-section mt-4">
            <h3>Adjust Your Plan</h3>
            <form onSubmit={handleAdjustPlan}>
              <div className="mb-3">
                <textarea
                  className="form-control"
                  value={adjustmentInput}
                  onChange={(e) => setAdjustmentInput(e.target.value)}
                  placeholder="Describe how you'd like to adjust your plan (e.g., 'I need more rest days' or 'I want to focus more on upper body')"
                  rows={4}
                />
              </div>
              <button 
                type="submit"
                className="btn btn-primary w-100"
                disabled={!adjustmentInput.trim() || loading}
              >
                {loading ? 'Adjusting Plan...' : 'Adjust Plan'}
              </button>
            </form>
          </div>

          <div className="d-flex justify-content-between mt-3">
            <button 
              onClick={() => {
                setWorkoutPlan(null);
                setAdjustmentInput('');
                setError(null);
                setShowAssessment(false);
                setPhysicalAssessment(null);
                setAdditionalInfo('');
              }} 
              className="btn btn-secondary"
            >
              Create New Plan
            </button>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportPlan}
              accept=".json"
              style={{ display: 'none' }}
            />
            <button 
              type="button" 
              onClick={triggerFileInput}
              className="btn btn-outline-primary"
            >
              Import Different Plan
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger mt-3">
          {error}
        </div>
      )}
      
      {importError && (
        <div className="alert alert-danger mt-3">
          {importError}
        </div>
      )}

      {/* Exercise Explanation Modal */}
      <Modal
        show={showExplanationModal}
        onHide={() => {
          setShowExplanationModal(false);
          setSelectedExercise(null);
          setExerciseExplanation('');
        }}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Exercise Explanation
            {selectedExercise && (
              <div className="text-muted fs-6">
                {selectedExercise.day} - {selectedExercise.exercise}
              </div>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingExplanation ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2">Getting exercise explanation...</p>
            </div>
          ) : (
            <div className="exercise-explanation" style={styles.exerciseExplanation}>
              <ReactMarkdown
                components={{
                  h1: props => <h1 style={styles.markdownHeading} {...props} />,
                  h2: props => <h2 style={styles.markdownHeading} {...props} />,
                  h3: props => <h3 style={styles.markdownHeading} {...props} />,
                  ul: props => <ul style={styles.markdownList} {...props} />,
                  ol: props => <ol style={styles.markdownList} {...props} />
                }}
              >
                {exerciseExplanation}
              </ReactMarkdown>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default WorkoutPlannerForm;