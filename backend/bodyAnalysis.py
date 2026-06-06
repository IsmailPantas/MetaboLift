import cv2
import mediapipe as mp
import numpy as np
import json
import sys
import os
from base64 import b64decode

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

def calculate_body_fat(hip_width, shoulder_width, height_px, gender="male"):
    hip_width = float(hip_width)
    shoulder_width = float(shoulder_width)
    height_px = float(height_px)
    
    whr = hip_width / shoulder_width if shoulder_width > 0 else 0.0

    if gender == "male":
        body_fat = 495.0 / (1.0324 - 0.19077 * np.log10(hip_width) + 0.15456 * np.log10(height_px)) - 450.0
    else:
        body_fat = 495.0 / (1.29579 - 0.35004 * np.log10(hip_width + shoulder_width) + 0.22100 * np.log10(height_px)) - 450.0

    return float(round(body_fat, 2)), float(round(whr, 2))

def calculate_body_ratios(landmarks, image_shape, gender="male"):
    h, w, _ = image_shape
    def get_point(landmark):
        return np.array([float(landmark.x * w), float(landmark.y * h)], dtype=np.float64)

    left_hip = get_point(landmarks[mp_pose.PoseLandmark.LEFT_HIP])
    right_hip = get_point(landmarks[mp_pose.PoseLandmark.RIGHT_HIP])
    left_shoulder = get_point(landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER])
    right_shoulder = get_point(landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER])
    left_ankle = get_point(landmarks[mp_pose.PoseLandmark.LEFT_ANKLE])
    right_ankle = get_point(landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE])

    hip_width = float(np.linalg.norm(left_hip - right_hip))
    shoulder_width = float(np.linalg.norm(left_shoulder - right_shoulder))
    height_px = float(np.linalg.norm(left_ankle - left_shoulder))

    body_fat, whr = calculate_body_fat(hip_width, shoulder_width, height_px, gender)

    return {
        "bodyFatPercentage": body_fat,
        "whr": whr,
        "shoulderWidth": float(round(shoulder_width, 2)),
        "hipWidth": float(round(hip_width, 2)),
        "height": float(round(height_px, 2)),
    }

def analyze_body():
    try:
        # Stdin'den JSON verisini oku
        input_data = json.loads(sys.stdin.read())
        image_data = input_data.get('image')
        gender = input_data.get('gender', 'male')

        if not image_data:
            raise Exception("Görsel verisi bulunamadı")

        # Base64 görsel verisini decode et
        image_data = b64decode(image_data.split(',')[1] if ',' in image_data else image_data)
        
        # Numpy array'e dönüştür
        nparr = np.frombuffer(image_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise Exception("Görsel yüklenemedi")

        with mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5) as pose:
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = pose.process(image_rgb)

            if not results.pose_landmarks:
                raise Exception("Vücut noktaları tespit edilemedi")

            body_ratios = calculate_body_ratios(results.pose_landmarks.landmark, image.shape, gender)
            
            # Sonuçları JSON olarak yazdır
            print(json.dumps({"success": True, "results": body_ratios}))
            sys.stdout.flush()

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.stdout.flush()

if __name__ == "__main__":
    analyze_body() 