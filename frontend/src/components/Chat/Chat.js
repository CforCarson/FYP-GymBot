import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Form, Button, InputGroup, FormControl } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';

const Chat = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [socket, setSocket] = useState(null);
    const [sessionId, setSessionId] = useState(localStorage.getItem('chatSessionId') || '');
    const [isConnecting, setIsConnecting] = useState(false);
    const messagesEndRef = useRef(null);

    const connectWebSocket = () => {
        setIsConnecting(true);
        
        // Build the WebSocket URL with session ID if available
        const wsUrl = sessionId 
            ? `ws://localhost:8000/ws/chat?session_id=${sessionId}`
            : 'ws://localhost:8000/ws/chat';
        
        const newSocket = new WebSocket(wsUrl);
        
        newSocket.onopen = () => {
            console.log('WebSocket connected');
            setIsConnecting(false);
        };

        newSocket.onmessage = (event) => {
            const parsedData = JSON.parse(event.data);
            
            // Handle session ID message
            if (parsedData.event_type === 'session_id') {
                const newSessionId = parsedData.data;
                setSessionId(newSessionId);
                localStorage.setItem('chatSessionId', newSessionId);
            }
            // Handle history message
            else if (parsedData.event_type === 'history') {
                setMessages(parsedData.data);
            }
            // Handle regular messages
            else {
                handleSocketMessage(event.data);
            }
        };

        newSocket.onclose = (event) => {
            console.log('WebSocket connection closed', event.code);
            setIsConnecting(false);
        };

        newSocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            setIsConnecting(false);
        };

        setSocket(newSocket);
        return newSocket;
    };

    useEffect(() => {
        const ws = connectWebSocket();
        
        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, []);  // Only connect once on component mount

    const handleSocketMessage = (data) => {
        const parsedData = JSON.parse(data);

        if (parsedData.event_type === 'document') {
            // Handle document event
        } else if (parsedData.event_type === 'answer') {
            let answer = parsedData.data;
            setMessages(prevMessages => {
                const updatedMessages = [...prevMessages];
                const loadingMessageIndex = updatedMessages.findIndex(msg => msg.role === 'assistant' && msg.message === 'loading...');
                
                if (loadingMessageIndex !== -1) {
                    updatedMessages[loadingMessageIndex] = { role: 'assistant', message: answer };
                    return updatedMessages;
                } else {
                    const lastMessage = prevMessages[prevMessages.length - 1];
                    if (lastMessage && lastMessage.role === 'assistant') {
                        const updatedMessage = { ...lastMessage, message: lastMessage.message + answer };
                        return [...prevMessages.slice(0, -1), updatedMessage];
                    } else {
                        return [...prevMessages, { role: 'assistant', message: answer }];
                    }
                }
            });
        }
    };

    const sendMessage = () => {
        if (socket && socket.readyState === WebSocket.OPEN && input.trim()) {
            setMessages(prevMessages => [...prevMessages, { role: 'user', message: input }]);
            setMessages(prevMessages => [...prevMessages, { role: 'assistant', message: 'loading...' }]);
            socket.send(input);
            setInput('');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage();
    };

    const resetChat = async () => {
        if (sessionId) {
            try {
                // Call the API to clear chat history
                await axios.delete(`http://localhost:8000/clear_chat_history/${sessionId}`);
                
                // Close current socket
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.close();
                }
                
                // Clear local state
                setMessages([]);
                
                // Create a new session
                localStorage.removeItem('chatSessionId');
                setSessionId('');
                
                // Reconnect socket
                connectWebSocket();
                
            } catch (error) {
                console.error('Error resetting chat:', error);
            }
        }
    };

    const exportChatHistory = () => {
        if (messages.length === 0) {
            alert('No chat history to export');
            return;
        }
        
        // Create export data object with messages and session ID
        const exportData = {
            sessionId,
            messages,
            exportDate: new Date().toISOString(),
        };
        
        // Convert to JSON and create download link
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create temporary link and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_history_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <Container data-bs-theme="dark">
            <Row className="justify-content-md-center">
                <Col xs={12} md={12}>
                    <div className="d-flex justify-content-between align-items-center">
                        <h1 className="mt-5">GYM Chatbot</h1>
                        <div>
                            <Button 
                                variant="success" 
                                onClick={exportChatHistory}
                                disabled={isConnecting || messages.length === 0}
                                className="me-2"
                            >
                                Export Chat
                            </Button>
                            <Button 
                                variant="danger" 
                                onClick={resetChat}
                                disabled={isConnecting}
                            >
                                Reset Chat
                            </Button>
                        </div>
                    </div>
                    <div className="chat-window rounded" style={{ border: '1px solid #ccc', padding: '10px', height: '400px', overflowY: 'scroll' }}>
                        {isConnecting && (
                            <div className="text-center p-3">
                                <div className="spinner-border text-light" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <p className="mt-2">Connecting to chat server...</p>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div key={idx} className={`chat-message ${msg.role}`}>
                                <strong>{msg.role === 'user' ? 'You: ' : 'Assistant: '}</strong>
                                <ReactMarkdown>{msg.message}</ReactMarkdown>
                            </div>
                        ))}

                        <div ref={messagesEndRef} />
                    </div>
                    <Form onSubmit={handleSubmit} className="mt-3">
                        <InputGroup>
                            <FormControl
                                placeholder="Type your message..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={isConnecting || !socket || socket.readyState !== WebSocket.OPEN}
                            />
                            <Button 
                                type="submit" 
                                variant="primary"
                                disabled={isConnecting || !socket || socket.readyState !== WebSocket.OPEN}
                            >
                                Send
                            </Button>
                        </InputGroup>
                    </Form>
                </Col>
            </Row>
        </Container>
    );
};

export default Chat;
