let renderer, cube, animationLoop;
let websocket = null;

function init() {
    const canvas = document.getElementById('canvas');
    renderer = new Renderer(canvas);

    cube = new Cube(2);
    cube.position.z = -2;

    cube.material.baseColor = [0, 255, 65];

    animationLoop = new AnimationLoop(renderer, [cube]);
    animationLoop.start();

    setupKeyboardControls();
    connectWebSocket();
}

function setViewportMode(mode) {
    renderer.setViewportMode(mode);
    updateModeButtons(mode);
}

function toggleBackface(){
    renderer.toggleBackfaceCulling();
    updateBackfaceButton();
}

function updateModeButtons(activeMode){
    const buttons = document.querySelectorAll('.mode-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`${activeMode.toLowerCase()}-btn`);
    if(activeBtn) activeBtn.classList.add('active');
}

function updateWireframeButton() {
    const btn = document.getElementById('wireframe-toggle');
    if(btn) {
        btn.textContent = `Wireframe Overlay: ${renderer.showWireframe ? 'ON' : 'OFF'}`;
        btn.classList.toggle('active', renderer.showWireframe);
    }
}

function updateBackfaceButton() {
    const btn = document.getElementById('backface-toggle');
    if(btn){
        btn.textContent = `Backface Culling: ${renderer.backfaceCulling ? 'ON' : 'OFF'}`;
        btn.classList.toggle('active', renderer.backfaceCulling);
    }
}

function connectWebSocket() {
    try {
        websocket = new WebSocket('ws://localhost:3000');

        websocket.onopen = function(){
            updateGestureStatus('Connected to gesture control server.');
            console.log('WebSocket connected');
        };

        websocket.onmessage = function(event){
            handleGestureEvent(event.data);
        }

        websocket.onclose = function() {
            updateGestureStatus('Disconnected from gesture control server - Attempting to reconnect...');
            console.log('WebSocket disconnected - retrying in 2 seconds');
            setTimeout(connectWebSocket, 2000);
        };

    }
    catch (error) {
        updateGestureStatus('Failed to connect');
        console.error('Failed to create WebSocket:', error);
    }
}

function handleGestureEvent(gesture) {
    console.log('Gesture received:', gesture);
    updateGestureStatus(`Last gesture: ${gesture}`);

    switch(gesture.trim()) {
        case 'ROTATE_RIGHT':
            cube.rotate(0, 0.2, 0);
            break;
        case 'ROTATE_LEFT':
            cube.rotate(0, -0.2, 0);
            break;
        case 'ROTATE_UP':
            cube.rotate(-0.2, 0, 0);
            break;
        case 'ROTATE_DOWN':
            cube.rotate(0.2, 0, 0);
            break;
        case 'ZOOM_IN':
            cube.scale.x *= 1.1;
            cube.scale.y *= 1.1;
            cube.scale.z *= 1.1;
            break;
        case 'ZOOM_OUT':
            cube.scale.x /= 1.1;
            cube.scale.y /= 1.1;
            cube.scale.z /= 1.1;
            break;
        case 'RESET':
            cube.resetRotation();
            cube.scale = {x:1, y:1, z:1};
            break;
        default:
            console.log('Unknown gesture:', gesture);
    }
}

function updateGestureStatus(status) {
    const statusElement = document.getElementById('gestureStatus');
    if(statusElement) {
        statusElement.textContent = status;
    }
}

function setupKeyboardControls() {
    document.addEventListener('keydown', function(event) {
        const rotationSpeed = 0.1;

        switch(event.key) {
            case '1':
                setViewportMode('wireframe');
                break;
            case '2':
                setViewportMode('solid');
                break;
            case '3':
                setViewportMode('material');
                break;
            case '4':
                setViewportMode('rendered');
                break;
            case 'w':
            case 'W':
                toggleWireframe();
                break;
            case 'b':
            case 'B':
                toggleBackface();
                break;
            case 'ArrowUp':
                cube.rotate(-rotationSpeed, 0, 0);
                break;
            case 'ArrowDown':
                cube.rotate(rotationSpeed, 0, 0);
                break;
            case 'ArrowLeft':
                cube.rotate(0, -rotationSpeed, 0);
                break;
            case 'ArrowRight':
                cube.rotate(0, rotationSpeed, 0);
                break;
            case 'r':
            case 'R':
                cube.resetRotation();
                cube.scale = {x:1, y:1, z:1};
                break;
            case '+':
                cube.scale.x *= 1.1;
                cube.scale.y *= 1.1;
                cube.scale.z *= 1.1;
                break;
            case '-':
                cube.scale.x /= 1.1;
                cube.scale.y /= 1.1;
                cube.scale.z /= 1.1;
                break;   
        }
    });
}

window.addEventListener('DOMContentLoaded', init);