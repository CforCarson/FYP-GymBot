import React, { useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import axios from 'axios';

const UploadPDF = () => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleFileSelect = (event) => {
        setFile(event.target.files[0]);
        setMessage(null);
    };

    const handleFileUpload = async (event) => {
        event.preventDefault();
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        setUploading(true);

        try {
            await axios.post('http://localhost:8000/upload_pdf/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            setMessage({ type: 'success', text: 'File uploaded successfully!' });
            setFile(null);
            // Reset the file input
            event.target.reset();
        } catch (error) {
            setMessage({ type: 'error', text: 'Error uploading file. Please try again.' });
            console.error('Error uploading file:', error);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="content-section mt-4">
            <h3>Upload PDF</h3>
            <Form onSubmit={handleFileUpload}>
                <Form.Group className="mb-3">
                    <Form.Control
                        type="file"
                        onChange={handleFileSelect}
                        accept=".pdf"
                        disabled={uploading}
                    />
                </Form.Group>
                <Button 
                    type="submit" 
                    disabled={!file || uploading}
                    className="w-100"
                >
                    {uploading ? 'Uploading...' : 'Upload PDF'}
                </Button>
            </Form>
            {message && (
                <div className={`alert mt-3 ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
                    {message.text}
                </div>
            )}
        </div>
    );
};

export default UploadPDF;
