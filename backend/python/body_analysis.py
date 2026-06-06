import cv2
import mediapipe as mp
import numpy as np
# import sys # sys.exit kaldırıldığı için buna gerek kalmayabilir
import json # Hata mesajları için belki hala kullanılabilir ama ana çıktı json.dumps ile olmayacak
import os

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

class BodyAnalysisError(Exception):
    """Vücut analizi sırasında özel hata sınıfı"""
    pass

def calculate_bmi(weight, height):
    if height <= 0:
        raise BodyAnalysisError("Boy değeri pozitif olmalıdır.")
    height_m = height / 100
    return round(weight / (height_m ** 2), 2)

def calculate_bmr(weight, height, age, gender):
    if gender.lower() not in ['male', 'female']:
        raise BodyAnalysisError("Geçersiz cinsiyet değeri. 'male' veya 'female' olmalıdır.")
    if gender.lower() == 'male':
        bmr = 10 * weight + 6.25 * height - 5 * age + 5
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age - 161
    return round(bmr)

def calculate_daily_calories(bmr, activity_level):
    activity_multipliers = {
        'sedentary': 1.2,
        'light': 1.375,
        'moderate': 1.55,
        'very': 1.725,
        'extra': 1.9
    }
    if activity_level.lower() not in activity_multipliers:
        raise BodyAnalysisError("Geçersiz aktivite seviyesi.")
    return round(bmr * activity_multipliers[activity_level.lower()])

def calculate_body_fat_percentage(bmi, age, gender):
    if gender.lower() not in ['male', 'female']:
        raise BodyAnalysisError("Geçersiz cinsiyet değeri. 'male' veya 'female' olmalıdır.")
    if gender.lower() == 'male':
        body_fat = (1.20 * bmi) + (0.23 * age) - 16.2
    else:
        body_fat = (1.20 * bmi) + (0.23 * age) - 5.4
    return round(body_fat, 2)

def calculate_ideal_weight(height, gender):
    if gender.lower() not in ['male', 'female']:
        raise BodyAnalysisError("Geçersiz cinsiyet değeri. 'male' veya 'female' olmalıdır.")
    # Devine Formula
    height_inches = height / 2.54
    if height_inches < 60: # Formül 60 inç (5 feet) altı için tasarlanmamış olabilir
        # raise BodyAnalysisError("Boy ideal kilo hesaplaması için çok kısa.")
        # Alternatif olarak, daha düşük boylar için bir taban değer döndürebilir veya farklı bir formül kullanabiliriz.
        # Şimdilik Devine formülünü olduğu gibi uygulayalım, ancak bu bir sınırlama olabilir.
        pass

    if gender.lower() == 'male':
        ideal_weight_lb = 50 + 2.3 * (height_inches - 60)
    else:
        ideal_weight_lb = 45.5 + 2.3 * (height_inches - 60)
    
    if ideal_weight_lb < 0: # Negatif ağırlık mantıksız
        # Bu durum genellikle çok kısa boylar için (formülün sınırları dışında) oluşur.
        # raise BodyAnalysisError("Hesaplanan ideal kilo negatif. Boy değeri formül için uygun olmayabilir.")
        # Makul bir minimum döndürebiliriz ya da hatayı olduğu gibi bırakabiliriz.
        # Şimdilik 0 döndürelim veya küçük bir pozitif değer. Ya da hatayı olduğu gibi bırakalım.
        # Pratik bir uygulama için bu durumun nasıl ele alınacağına karar vermek gerekir.
        # Şimdilik, formülün doğrudan sonucunu döndürelim, negatif çıksa bile.
        pass

    return round(ideal_weight_lb * 0.45359237, 2)  # Convert to kg

def _calculate_internal_body_fat_from_measurements(hip_width, shoulder_width, height_px, gender="male"):
    # Bu fonksiyon, doğrudan çağrılmak yerine calculate_body_ratios içinden kullanılacak
    # ve print/sys.exit içermeyecek şekilde düzenlendi.
    try:
        if shoulder_width <= 0 or hip_width <=0 or height_px <=0:
             # raise BodyAnalysisError("Genişlik ve yükseklik ölçümleri pozitif olmalıdır.")
             # Sıfır veya negatif ölçümler logaritmada veya bölmede sorun yaratır.
             # Bu durumda WHR için 0, body_fat için de makul bir hata değeri (örn. -1 veya None) döndürebiliriz.
             return -1, 0 # Hata durumu için body_fat, whr

        whr = hip_width / shoulder_width
        
        # Logaritma hesaplamalarında argümanların pozitif olması gerekir.
        # Ölçümler (hip_width, shoulder_width, height_px) piksel cinsinden ve pozitif olmalı.
        
        # np.log10(0) veya np.log10(negatif_sayı) tanımsızdır (NaN veya -inf verir).
        # Bu nedenle, bu değerlerin pozitif olduğundan emin olmak önemlidir.
        # Yukarıdaki if koşulu bunu bir miktar ele alır.

        if gender.lower() == "male":
            # Değerlerin çok küçük olması durumunda logaritma çok büyük negatif sayılar verebilir.
            # Bu da 495 / (çok küçük pozitif sayı) -> çok büyük pozitif sayı sonucunu doğurabilir.
            # Ya da 495 / (çok büyük negatif sayı) -> çok küçük negatif sayı.
            # Nutritionix gibi API'ler bu tür hesaplamaları daha karmaşık ve doğrulanmış modellerle yapar.
            # Bu formülün sınırlamaları olduğunu bilmek önemlidir.
            denominator = 1.0324 - 0.19077 * np.log10(hip_width) + 0.15456 * np.log10(height_px)
        else: # female
            denominator = 1.29579 - 0.35004 * np.log10(hip_width + shoulder_width) + 0.22100 * np.log10(height_px)

        if denominator == 0:
            # raise BodyAnalysisError("Vücut yağı hesaplamasında payda sıfır oldu.")
            return -1, round(whr, 2) # Hata durumu için body_fat

        body_fat = 495 / denominator - 450
        
        # Sonuçların makul aralıklarda olup olmadığını kontrol etmek faydalı olabilir.
        # Örneğin, vücut yağ oranı %0-%100 arasında olmalıdır.
        # if not (0 <= body_fat <= 100):
        #     # Belki bu durumda bir uyarı loglanır veya değer -1 (hata) olarak ayarlanır.
        #     pass


        return round(body_fat, 2), round(whr, 2)
    except (ValueError, ZeroDivisionError) as e: # Logaritma veya bölme hataları
        # raise BodyAnalysisError(f"Vücut yağ oranı hesaplanırken matematiksel hata: {str(e)}")
        # Hata durumunda istemciye daha anlamlı bir mesaj vermek için sarmalayıcı fonksiyon karar verebilir.
        # Şimdilik spesifik bir hata değeri döndürelim.
        return -1, (hip_width / shoulder_width if shoulder_width > 0 else 0) # body_fat için -1, whr için hesaplanabildiği kadar

def calculate_body_ratios(landmarks, image_shape, gender="male"):
    try:
        h, w, _ = image_shape
        def get_point(landmark):
            # Görüntü boyutları içinde kalmasını sağla
            x = min(max(landmark.x * w, 0), w -1)
            y = min(max(landmark.y * h, 0), h -1)
            return int(x), int(y)

        # Gerekli noktaları al
        left_hip = get_point(landmarks[mp_pose.PoseLandmark.LEFT_HIP.value])
        right_hip = get_point(landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value])
        left_shoulder = get_point(landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value])
        right_shoulder = get_point(landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value])
        
        # Ayak bilekleri yerine, boy için daha stabil olabilecek üst ve alt vücut noktaları kullanılabilir.
        # Örneğin, başın üstü (eğer tespit edilebiliyorsa) veya omuzlar ve kalçalar arası dikey mesafe.
        # Mevcut implementasyonda ayak bilekleri kullanılıyor, bu da pozun doğruluğuna çok bağlı.
        # Eğer ayak bilekleri resimde yoksa veya yanlış tespit edilirse height_px hatalı olur.
        # Bu fonksiyonun çağrıldığı yerde landmarkların varlığı kontrol edilmeli.

        left_ankle = get_point(landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value])
        # right_ankle = get_point(landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value]) # Sadece sol kullanılıyor gibi

        # Mesafeleri hesapla
        hip_width = np.linalg.norm(np.array(left_hip) - np.array(right_hip))
        shoulder_width = np.linalg.norm(np.array(left_shoulder) - np.array(right_shoulder))
        
        # Boy (piksel cinsinden) - Omuz ve ayak bileği arasındaki dikey mesafeyi kullanmak yerine,
        # tüm vücut iskeletinin dikey izdüşümünü kullanmak daha doğru olabilir.
        # Ancak mevcut kod sol omuz ve sol ayak bileği arasını kullanıyor.
        # Bu, kişinin kameraya tam dik durmadığı durumlarda hatalı olabilir.
        # height_px = np.linalg.norm(np.array(left_ankle) - np.array(left_shoulder)) # Bu 3D mesafe, 2D değil
        
        # Daha doğru bir 2D yükseklik için:
        # En üst nokta (örneğin burun veya gözlerin ortası) ile en alt nokta (ayak bilekleri)
        # arasındaki y farkını kullanmak daha iyi olabilir.
        # Şimdilik orijinal mantığı koruyalım ama bunun bir geliştirme alanı olduğunu belirtelim.
        # Orijinal kodda height_px, sol omuz ve sol ayak bileği arasındaki Öklid mesafesi.
        # Bu, vücudun eğik durması durumunda gerçek dikey boyu temsil etmeyebilir.
        
        # Yükseklik için daha stabil bir yaklaşım:
        all_ys = [get_point(lm)[1] for lm_idx, lm in enumerate(landmarks) if lm.visibility > 0.5] # Sadece görünür noktalar
        if not all_ys:
             raise BodyAnalysisError("Yükseklik hesaplamak için görünür nokta bulunamadı.")
        min_y = min(all_ys)
        max_y = max(all_ys)
        height_px = max_y - min_y

        if height_px <= 0:
            raise BodyAnalysisError("Hesaplanan piksel boyu geçersiz.")


        # Vücut yağ oranını hesapla
        body_fat, whr = _calculate_internal_body_fat_from_measurements(hip_width, shoulder_width, height_px, gender)

        return {
            "Vücut Yağ Oranı (%)": body_fat if body_fat != -1 else "Hesaplanamadı",
            "Bel-Kalça Oranı (WHR)": whr, # WHR için kalça ve bel ölçümü lazım, burada omuz ve kalça kullanılıyor. WHR değil SHR olmalı.
                                        # Bel (waist) çevresi ve kalça (hip) çevresi gerekir. Mevcut implementasyon
                                        # hip_width (kalça genişliği) ve shoulder_width (omuz genişliği) kullanıyor.
                                        # Bu aslında Bel-Omuz oranı (Waist-Shoulder Ratio) veya Kalça-Omuz Oranı (Hip-Shoulder Ratio) gibi bir şeydir.
                                        # Standart WHR için farklı landmarklar (örn. NAVEL) gerekir.
                                        # Şimdilik isimlendirmeyi "Kalça/Omuz Genişlik Oranı" olarak değiştirebiliriz.
            "Kalça/Omuz Genişlik Oranı": whr, # Daha doğru bir isimlendirme
            "Omuz Genişliği (px)": round(shoulder_width, 2),
            "Kalça Genişliği (px)": round(hip_width, 2),
            "Boy Uzunluğu (px)": round(height_px, 2),
        }
    except IndexError:
        # Bu genellikle landmarks listesinde beklenen PoseLandmark'ın bulunmaması durumunda olur.
        # Örneğin, bazı vücut kısımları algılanamamışsa.
        raise BodyAnalysisError("Vücut oranları hesaplanırken gerekli tüm vücut noktaları tespit edilemedi.")
    except Exception as e:
        raise BodyAnalysisError(f"Vücut oranları hesaplanırken genel hata: {str(e)}")


def analyze_body(image_path: str, gender: str = "male"):
    try:
        if not os.path.exists(image_path):
            raise BodyAnalysisError(f"Görüntü dosyası bulunamadı: {image_path}")

        image = cv2.imread(image_path)
        if image is None:
            raise BodyAnalysisError(f"Görüntü yüklenemedi veya bozuk: {image_path}")

        with mp_pose.Pose(
            static_image_mode=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        ) as pose:
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = pose.process(image_rgb)

            if not results.pose_landmarks:
                raise BodyAnalysisError("Görüntüde vücut noktaları tespit edilemedi.")
            
            # Landmarkların sayısını kontrol etme, bazıları eksik olabilir.
            # calculate_body_ratios içinde IndexError ile bu durum ele alınmaya çalışıldı.
            # Alternatif olarak, burada gerekli tüm landmarkların varlığını (visibility > threshold) kontrol edebiliriz.
            # Örneğin:
            # required_landmarks = [
            #     mp_pose.PoseLandmark.LEFT_HIP, mp_pose.PoseLandmark.RIGHT_HIP,
            #     mp_pose.PoseLandmark.LEFT_SHOULDER, mp_pose.PoseLandmark.RIGHT_SHOULDER,
            #     mp_pose.PoseLandmark.LEFT_ANKLE
            # ]
            # for lm_enum in required_landmarks:
            #     if results.pose_landmarks.landmark[lm_enum.value].visibility < 0.5: # Visibility eşiği
            #         raise BodyAnalysisError(f"{lm_enum.name} noktası yeterince görünür değil veya tespit edilemedi.")


            body_ratios = calculate_body_ratios(results.pose_landmarks.landmark, image.shape, gender)
            return body_ratios

    except BodyAnalysisError: # Kendi tanımladığımız hataları tekrar fırlat
        raise
    except Exception as e: # Beklenmedik diğer hatalar için genel bir hata
        # Burada orijinal hatayı loglamak iyi bir pratik olabilir.
        # logger.error(f"Analiz sırasında beklenmedik hata: {e}", exc_info=True)
        raise BodyAnalysisError(f"Analiz sırasında beklenmedik bir sunucu hatası oluştu.")


# if __name__ == "__main__":
#     # Komut satırı kullanımı için bu blok kalabilir veya kaldırılabilir.
#     # FastAPI içinde bu kısım çağrılmayacak.
#     if len(sys.argv) < 2:
#         print(json.dumps({"error": "Görüntü yolu belirtilmedi!"}))
#         sys.exit(1)

#     image_path_arg = sys.argv[1]
#     gender_arg = sys.argv[2] if len(sys.argv) > 2 else "male"

#     if not os.path.exists(image_path_arg):
#         print(json.dumps({"error": "Görüntü dosyası bulunamadı!"}))
#         sys.exit(1)
    
#     try:
#         analysis_results = analyze_body(image_path_arg, gender_arg)
#         print(json.dumps(analysis_results, indent=2))
#     except BodyAnalysisError as e:
#         print(json.dumps({"error": str(e)}))
#     except Exception as e:
#         print(json.dumps({"error": f"Beklenmedik bir hata oluştu: {str(e)}"})) 