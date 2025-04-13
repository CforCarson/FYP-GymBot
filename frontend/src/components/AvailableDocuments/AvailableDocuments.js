import React, { useState, useEffect } from 'react';
import { ListGroup, Spinner, Button, Modal } from 'react-bootstrap';
import axios from 'axios';

const AvailableDocuments = () => {
    const [documentList, setDocumentList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [deleteSuccess, setDeleteSuccess] = useState(null);

    // Function to fetch documents
    const fetchDocuments = async () => {
        try {
            setLoading(true);
            const response = await axios.get('http://localhost:8000/get_documents/');
            setDocumentList(response.data.data);
            setError(null);
        } catch (error) {
            console.error('Error fetching documents:', error);
            setError('Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    // Load documents on component mount
    useEffect(() => {
        fetchDocuments();
    }, []);

    // Function to handle delete confirmation
    const confirmDelete = () => {
        setShowConfirmModal(true);
    };

    // Function to delete all documents
    const deleteAllDocuments = async () => {
        try {
            setDeleteLoading(true);
            // We can use any filename here as the backend will delete all documents regardless
            await axios.delete(`http://localhost:8000/delete_document/all`);
            
            // Update the document list to empty
            setDocumentList([]);
            setDeleteSuccess(`All documents deleted successfully`);
            
            // Hide success message after 3 seconds
            setTimeout(() => setDeleteSuccess(null), 3000);
        } catch (error) {
            console.error('Error deleting documents:', error);
            setError(`Failed to delete documents: ${error.response?.data?.error || error.message}`);
            
            // Hide error after 5 seconds
            setTimeout(() => setError(null), 5000);
        } finally {
            setDeleteLoading(false);
            setShowConfirmModal(false);
        }
    };

    return (
        <div className="content-section mt-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h3>Available Documents</h3>
                <div>
                    <Button 
                        variant="outline-light" 
                        size="sm" 
                        onClick={fetchDocuments}
                        disabled={loading}
                        className="me-2"
                    >
                        {loading ? <Spinner animation="border" size="sm" /> : 'Refresh'}
                    </Button>
                    <Button 
                        variant="danger" 
                        size="sm" 
                        onClick={confirmDelete}
                        disabled={documentList.length === 0 || loading}
                    >
                        Delete All
                    </Button>
                </div>
            </div>
            
            {/* Success message */}
            {deleteSuccess && (
                <div className="alert alert-success">{deleteSuccess}</div>
            )}
            
            {/* Error message */}
            {error && (
                <div className="alert alert-danger">{error}</div>
            )}
            
            {loading ? (
                <div className="text-center">
                    <Spinner animation="border" variant="light" />
                </div>
            ) : documentList.length === 0 ? (
                <p className="text-muted">No documents available</p>
            ) : (
                <ListGroup variant="flush">
                    {documentList.map((doc, idx) => (
                        <ListGroup.Item 
                            key={idx} 
                            className="bg-transparent text-white d-flex justify-content-between align-items-center"
                        >
                            <span>{doc}</span>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            )}
            
            {/* Confirmation Modal */}
            <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Deletion</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to delete <strong>ALL documents</strong>?
                    <p className="text-danger mt-2">
                        This action cannot be undone. All documents will be removed from the system permanently.
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
                        Cancel
                    </Button>
                    <Button 
                        variant="danger" 
                        onClick={deleteAllDocuments} 
                        disabled={deleteLoading}
                    >
                        {deleteLoading ? <Spinner animation="border" size="sm" /> : 'Delete All'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default AvailableDocuments;
