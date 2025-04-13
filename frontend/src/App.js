// src/App.js

import React from 'react';
import Chat from './components/Chat';
import UploadPDF from './components/UploadPDF';
import AvailableDocuments from './components/AvailableDocuments';
import WorkoutPlanner from './components/WorkoutPlanner/WorkoutPlanner';
import { Container, Row, Col, Nav, Tab } from 'react-bootstrap';

const App = () => {
  return (
    <Container fluid className="px-4">
      <Tab.Container defaultActiveKey="chat">
        <Row>
          {/* Sidebar Navigation */}
          <Col xs={12} md={3} lg={2} className="sidebar">
            <Nav variant="pills" className="flex-column mt-4 sticky-top">
              <Nav.Item>
                <Nav.Link eventKey="chat" className="text-white">
                  GYM Chatbot
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="workout" className="text-white">
                  Workout Planner
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>

          {/* Main Content Area */}
          <Col xs={12} md={9} lg={10} className="main-content">
            <Tab.Content>
              <Tab.Pane eventKey="chat">
                <div className="content-section">
                  <Chat />
                  <div className="mt-4">
                    <UploadPDF />
                    <AvailableDocuments />
                  </div>
                </div>
              </Tab.Pane>
              <Tab.Pane eventKey="workout">
                <div className="content-section">
                  <WorkoutPlanner />
                </div>
              </Tab.Pane>
            </Tab.Content>
          </Col>
        </Row>
      </Tab.Container>
    </Container>
  );
};

export default App;