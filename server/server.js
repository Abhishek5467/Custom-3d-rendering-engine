const express = require('express');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Create HTTP server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Frontend available at: http://localhost:3000');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    clients.add(ws);
    
    // Send connection confirmation
    ws.send('CONNECTION_CONFIRMED');
    
    ws.on('close', () => {
        console.log('Client disconnected');
        clients.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

// Function to broadcast gesture to all clients
function broadcastGesture(gesture) {
    const message = gesture.toString().trim();
    console.log(`Broadcasting gesture: ${message}`);
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Start C++ gesture detector process
let gestureProcess = null;

function startGestureDetector() {
    console.log('Starting C++ gesture detector...');
    
    // Path to your compiled C++ executable
    const executablePath = path.join(__dirname, '../backend/build/Debug/gesture_detector.exe');
    
    gestureProcess = spawn(executablePath);
    
    gestureProcess.stdout.on('data', (data) => {
        const gestures = data.toString().split('\n').filter(line => line.trim());
        gestures.forEach(gesture => {
            if (gesture.trim()) {
                broadcastGesture(gesture.trim());
            }
        });
    });
    
    gestureProcess.stderr.on('data', (data) => {
        console.error('Gesture detector error:', data.toString());
    });
    
    gestureProcess.on('close', (code) => {
        console.log(`Gesture detector exited with code ${code}`);
        if (code !== 0) {
            console.log('Attempting to restart gesture detector in 3 seconds...');
            setTimeout(startGestureDetector, 3000);
        }
    });
    
    gestureProcess.on('error', (error) => {
        console.error('Failed to start gesture detector:', error.message);
        console.log('Make sure the C++ executable is built and accessible');
    });
}

// API endpoints for manual testing
app.get('/api/test-gesture/:gesture', (req, res) => {
    const gesture = req.params.gesture;
    broadcastGesture(gesture);
    res.json({ message: `Sent gesture: ${gesture}` });
});

app.get('/api/status', (req, res) => {
    res.json({
        server: 'running',
        connectedClients: clients.size,
        gestureDetector: gestureProcess ? 'running' : 'stopped'
    });
});

// Start gesture detector automatically
startGestureDetector();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    
    if (gestureProcess) {
        gestureProcess.kill();
    }
    
    clients.forEach(client => {
        client.close();
    });
    
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

console.log('\n=== Gesture Control System ===');
console.log('1. C++ gesture detector will start automatically');
console.log('2. Open http://localhost:3000 in your browser');
console.log('3. Show gestures to your webcam');
console.log('4. Watch the 3D cube respond to your gestures!');
console.log('\nTest gestures manually:');
console.log('- http://localhost:3000/api/test-gesture/ROTATE_RIGHT');
console.log('- http://localhost:3000/api/test-gesture/ZOOM_IN');
console.log('\nPress Ctrl+C to stop');
