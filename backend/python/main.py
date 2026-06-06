import os
import shutil
import uuid
import logging
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

# Refaktör edilmiş body_analysis modülünü import et
from body_analysis import analyze_body, BodyAnalysisError, calculate_bmi, calculate_bmr, calculate_daily_calories, calculate_body_fat_percentage, calculate_ideal_weight

# Logger yapılandırması
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MetaboLift Backend API",
    description="Vücut analizi ve besin değeri sorgulama için API servisleri.",
    version="1.0.0"
)

cors_origins = [
    origin.strip()
    for origin in os.getenv("BODY_ANALYSIS_CORS_ORIGINS", "http://localhost:3000,http://localhost:3002").split(",")
    if origin.strip()
]

# CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_IMAGE_DIR = "temp_images"
if not os.path.exists(TEMP_IMAGE_DIR):
    os.makedirs(TEMP_IMAGE_DIR)

@app.post("/analyze_image/")
async def create_upload_file_and_analyze(gender: str = Form("male"), file: UploadFile = File(...) ):
    """
    Yüklenen bir resmi kullanarak vücut analizini gerçekleştirir.

    - **gender**: Analiz için cinsiyet ('male' veya 'female'). Varsayılan: 'male'.
    - **file**: Analiz edilecek resim dosyası.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Yüklenen dosya bir resim değil.")

    temp_file_path = None
    try:
        # Geçici bir dosya adı oluştur
        file_extension = os.path.splitext(file.filename)[1]
        temp_filename = f"{uuid.uuid4()}{file_extension}"
        temp_file_path = os.path.join(TEMP_IMAGE_DIR, temp_filename)

        # Dosyayı geçici yola kaydet
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        logger.info(f"Resim geçici olarak şuraya kaydedildi: {temp_file_path}")

        # Vücut analizini yap
        analysis_results = analyze_body(temp_file_path, gender)
        return analysis_results
        
    except BodyAnalysisError as e:
        logger.error(f"Vücut analizi hatası: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Beklenmedik bir sunucu hatası oluştu: {e}") # exc_info=True gibi davranır
        raise HTTPException(status_code=500, detail="Görüntü analizi sırasında sunucuda beklenmedik bir hata oluştu.")
    finally:
        # Geçici dosyayı sil
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
                logger.info(f"Geçici resim silindi: {temp_file_path}")
            except Exception as e:
                logger.error(f"Geçici resim silinirken hata: {temp_file_path}, Hata: {e}")

# Diğer hesaplama fonksiyonları için de endpoint'ler eklenebilir (isteğe bağlı)
# Bu fonksiyonlar `body_analysis.py` içinde zaten var ve import edildi.
# Eğer sadece resim analizi değil, doğrudan bu değerleri de hesaplatmak isterseniz:

@app.get("/calculate/bmi/")
async def get_bmi(weight: float = Query(..., gt=0, description="Kilogram cinsinden ağırlık"), 
                height: float = Query(..., gt=0, description="Santimetre cinsinden boy") ):
    try:
        bmi = calculate_bmi(weight, height)
        return {"bmi": bmi, "unit": "kg/m^2"}
    except BodyAnalysisError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/calculate/bmr/")
async def get_bmr(weight: float = Query(..., gt=0, description="Kilogram cinsinden ağırlık"), 
                height: float = Query(..., gt=0, description="Santimetre cinsinden boy"), 
                age: int = Query(..., gt=0, description="Yıl cinsinden yaş"), 
                gender: str = Query(..., description="Cinsiyet: 'male' veya 'female'") ):
    try:
        bmr = calculate_bmr(weight, height, age, gender)
        return {"bmr": bmr, "unit": "calories/day"}
    except BodyAnalysisError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/calculate/daily_calories/")
async def get_daily_calories(bmr: float = Query(..., gt=0, description="Bazal Metabolizma Hızı (kalori/gün)"), 
                           activity_level: str = Query(..., description="Aktivite Seviyesi: sedentary, light, moderate, very, extra") ):
    try:
        calories = calculate_daily_calories(bmr, activity_level)
        return {"daily_calories": calories, "unit": "calories/day"}
    except BodyAnalysisError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/calculate/body_fat_percentage/")
async def get_body_fat_percentage(bmi: float = Query(..., description="Vücut Kitle İndeksi (kg/m^2)"), 
                                age: int = Query(..., gt=0, description="Yıl cinsinden yaş"), 
                                gender: str = Query(..., description="Cinsiyet: 'male' veya 'female'") ):
    try:
        bfp = calculate_body_fat_percentage(bmi, age, gender)
        return {"body_fat_percentage": bfp, "unit": "%"}
    except BodyAnalysisError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/calculate/ideal_weight/")
async def get_ideal_weight(height: float = Query(..., gt=0, description="Santimetre cinsinden boy"), 
                         gender: str = Query(..., description="Cinsiyet: 'male' veya 'female'") ):
    try:
        iw = calculate_ideal_weight(height, gender)
        return {"ideal_weight": iw, "unit": "kg"}
    except BodyAnalysisError as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    # Geliştirme sunucusunu 0.0.0.0 üzerinde çalıştırarak yerel ağdan erişime izin ver
    uvicorn.run(app, host="0.0.0.0", port=8000) 