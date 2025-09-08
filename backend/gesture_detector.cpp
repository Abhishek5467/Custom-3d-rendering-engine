#include <opencv2/opencv.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/highgui.hpp>
#include <iostream>
#include <vector>
#include <chrono>
#include <thread> 
#include <cmath>
#include <algorithm>
#include <string> 

using namespace cv;
using namespace std;


class GestureDetector {
private:
    VideoCapture cap;
    Mat frame, hsvFrame, mask, morphed;
    vector<vector<Point>> contours;
    vector<Vec4i> hierarchy;
    
    // Gesture state tracking
    string lastGesture = "";
    chrono::steady_clock::time_point lastGestureTime;
    const int GESTURE_COOLDOWN_MS = 500; // Minimum time between gestures
    
    // Hand detection parameters
    Scalar lowerBound = Scalar(0, 30, 60);   // HSV lower bound for skin
    Scalar upperBound = Scalar(20, 150, 255); // HSV upper bound for skin
    
public:
    GestureDetector() {
        cap.open(0);
        if (!cap.isOpened()) {
            cerr << "Error: Cannot open webcam" << endl;
            exit(-1);
        }
        
        // Set camera properties
        cap.set(CAP_PROP_FRAME_WIDTH, 640);
        cap.set(CAP_PROP_FRAME_HEIGHT, 480);
        cap.set(CAP_PROP_FPS, 30);
        
        lastGestureTime = chrono::steady_clock::now();
    }
    
    ~GestureDetector() {
        cap.release();
        destroyAllWindows();
    }
    
    Point getCenterOfMass(const vector<Point>& contour) {
        Moments m = moments(contour);
        if (m.m00 == 0) return Point(0, 0);
        return Point(m.m10/m.m00, m.m01/m.m00);
    }
    
    int countFingers(const vector<Point>& contour) {
        if (contour.size() < 10) return 0;
        
        vector<int> hull;
        convexHull(contour, hull, false, false);
        
        if (hull.size() < 3) return 0;
        
        vector<Vec4i> defects;
        convexityDefects(contour, hull, defects);
        
        int fingerCount = 0;
        Point centerOfMass = getCenterOfMass(contour);
        
        for (size_t i = 0; i < defects.size(); i++) {
            Vec4i defect = defects[i];
            Point start = contour[defect[0]];
            Point end = contour[defect[1]];
            Point far = contour[defect[2]];
            double depth = defect[3] / 256.0;
            
            // Filter defects by depth
            if (depth > 20) {
                // Calculate angle between vectors
                double a = sqrt(pow(end.x - start.x, 2) + pow(end.y - start.y, 2));
                double b = sqrt(pow(far.x - start.x, 2) + pow(far.y - start.y, 2));
                double c = sqrt(pow(end.x - far.x, 2) + pow(end.y - far.y, 2));
                
                double angle = acos((b*b + c*c - a*a) / (2*b*c)) * 57.29; // Convert to degrees
                
                // Count as finger if angle is acute enough
                if (angle <= 90 && depth > 30) {
                    fingerCount++;
                }
            }
        }
        
        // Add 1 because fingers = defects + 1
        return min(fingerCount + 1, 5);
    }
    
    string detectGesture(const vector<Point>& contour, const Point& center) {
        if (contour.empty()) return "NONE";
        
        double area = contourArea(contour);
        if (area < 5000) return "NONE"; // Too small to be a hand
        
        int fingers = countFingers(contour);
        
        // Gesture recognition based on finger count
        switch (fingers) {
            case 1:
                return "ZOOM_OUT";
            case 2:
                return "ROTATE_RIGHT";
            case 3:
                return "ROTATE_LEFT";
            case 4:
                return "ROTATE_UP";
            case 5:
                return "ZOOM_IN";
            default:
                return "NONE";
        }
    }
    
    string detectMotionGesture(const Point& currentCenter, const Point& previousCenter) {
        if (currentCenter == Point(0,0) || previousCenter == Point(0,0)) return "NONE";
        
        int dx = currentCenter.x - previousCenter.x;
        int dy = currentCenter.y - previousCenter.y;
        int threshold = 30;
        
        if (abs(dx) > threshold || abs(dy) > threshold) {
            if (abs(dx) > abs(dy)) {
                return dx > 0 ? "ROTATE_RIGHT" : "ROTATE_LEFT";
            } else {
                return dy > 0 ? "ROTATE_DOWN" : "ROTATE_UP";
            }
        }
        
        return "NONE";
    }
    
    bool shouldSendGesture(const string& gesture) {
        auto now = chrono::steady_clock::now();
        auto timeDiff = chrono::duration_cast<chrono::milliseconds>(now - lastGestureTime);
        
        if (gesture != lastGesture && timeDiff.count() > GESTURE_COOLDOWN_MS) {
            lastGesture = gesture;
            lastGestureTime = now;
            return true;
        }
        
        return false;
    }
    
    void processFrame() {
        static Point previousCenter(0, 0);
        
        cap >> frame;
        if (frame.empty()) return;
        
        // Convert to HSV for better color detection
        cvtColor(frame, hsvFrame, COLOR_BGR2HSV);
        
        // Create mask for skin color
        inRange(hsvFrame, lowerBound, upperBound, mask);
        
        // Morphological operations to reduce noise
        Mat kernel = getStructuringElement(MORPH_ELLIPSE, Size(8, 8));
        morphologyEx(mask, morphed, MORPH_OPEN, kernel);
        morphologyEx(morphed, morphed, MORPH_CLOSE, kernel);
        
        // Find contours
        findContours(morphed, contours, hierarchy, RETR_EXTERNAL, CHAIN_APPROX_SIMPLE);
        
        if (!contours.empty()) {
            // Find largest contour (assumed to be hand)
            size_t largestIdx = 0;
            double maxArea = 0;
            
            for (size_t i = 0; i < contours.size(); i++) {
                double area = contourArea(contours[i]);
                if (area > maxArea) {
                    maxArea = area;
                    largestIdx = i;
                }
            }
            
            if (maxArea > 5000) { // Minimum area threshold
                vector<Point>& handContour = contours[largestIdx];
                Point currentCenter = getCenterOfMass(handContour);
                
                // Detect static gesture (finger count)
                string staticGesture = detectGesture(handContour, currentCenter);
                
                // Detect motion gesture
                string motionGesture = detectMotionGesture(currentCenter, previousCenter);
                
                // Prioritize motion gestures over static ones
                string finalGesture = (motionGesture != "NONE") ? motionGesture : staticGesture;
                
                // Send gesture if it's new and enough time has passed
                if (shouldSendGesture(finalGesture) && finalGesture != "NONE") {
                    cout << finalGesture << endl;
                    cout.flush(); // Ensure immediate output
                }
                
                previousCenter = currentCenter;
                
                // Draw debug info
                drawContours(frame, contours, largestIdx, Scalar(0, 255, 0), 2);
                circle(frame, currentCenter, 5, Scalar(255, 0, 0), -1);
                
                // Display finger count
                int fingers = countFingers(handContour);
                putText(frame, "Fingers: " + to_string(fingers), Point(10, 30), 
                       FONT_HERSHEY_SIMPLEX, 1, Scalar(0, 255, 0), 2);
                putText(frame, "Gesture: " + finalGesture, Point(10, 70), 
                       FONT_HERSHEY_SIMPLEX, 1, Scalar(0, 255, 0), 2);
            }
        }
        
        // Show processed frames (optional - comment out for production)
        imshow("Hand Detection", frame);
        imshow("Mask", morphed);
        
        // Exit on 'q' key
        if (waitKey(1) == 'q') {
            exit(0);
        }
    }
    
    void run() {
        cout << "Gesture detection started. Show your hand to the camera." << endl;
        
        while (true) {
            processFrame();
            this_thread::sleep_for(chrono::milliseconds(33)); // ~30 FPS
        }
    }
};

int main() {
    try {
        GestureDetector detector;
        detector.run();
    } catch (const exception& e) {
        cerr << "Error: " << e.what() << endl;
        return -1;
    }
    
    return 0;
}
