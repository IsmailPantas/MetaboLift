import React, { useState, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  Grid,
} from '@mui/material';

function BodyAnalysisScreen() {
  const [formData, setFormData] = useState({
    height: '',
    weight: '',
    age: '',
    gender: '',
    activityLevel: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  
  // Python analizi için state'ler
  const [pythonLoading, setPythonLoading] = useState(false);
  const [pythonError, setPythonError] = useState('');
  const [pythonResult, setPythonResult] = useState(null);

  // Kamera ve görüntü işleme için state'ler
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraAnalysisResult, setCameraAnalysisResult] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null); // Dosya inputu için ref
  const [uploadedFile, setUploadedFile] = useState(null); // Yüklenen dosyayı (File object) tutmak için

  const calculateBMI = (weight, height) => {
    const heightM = height / 100;
    return Number((weight / (heightM ** 2)).toFixed(2));
  };

  const calculateBMR = (weight, height, age, gender) => {
    if (gender === 'male') {
      return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
    }
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  };

  const calculateDailyCalories = (bmr, activityLevel) => {
    const activityMultipliers = {
      'sedentary': 1.2,      // Hareketsiz
      'light': 1.375,        // Hafif aktif
      'moderate': 1.55,      // Orta aktif
      'very': 1.725,         // Çok aktif
      'extra': 1.9           // Ekstra aktif
    };
    return Math.round(bmr * activityMultipliers[activityLevel]);
  };

  const calculateBodyFatPercentage = (bmi, age, gender) => {
    if (gender === 'male') {
      return Number(((1.20 * bmi) + (0.23 * age) - 16.2).toFixed(2));
    }
    return Number(((1.20 * bmi) + (0.23 * age) - 5.4).toFixed(2));
  };

  const calculateIdealWeight = (height, gender) => {
    let idealWeight;
    if (gender === 'male') {
      idealWeight = 50 + 2.3 * ((height / 2.54) - 60);
    } else {
      idealWeight = 45.5 + 2.3 * ((height / 2.54) - 60);
    }
    return Number((idealWeight * 0.45359237).toFixed(2)); // Convert to kg
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const { height, weight, age, gender, activityLevel } = formData;

      // Hesaplamaları yap
      const bmi = calculateBMI(Number(weight), Number(height));
      const bmr = calculateBMR(Number(weight), Number(height), Number(age), gender);
      const dailyCalories = calculateDailyCalories(bmr, activityLevel);
      const bodyFatPercentage = calculateBodyFatPercentage(bmi, Number(age), gender);
      const idealWeight = calculateIdealWeight(Number(height), gender);

      setResult({
        bmi,
        bmr,
        dailyCalories,
        bodyFatPercentage,
        idealWeight
      });
    } catch (err) {
      setError('Hesaplama yapılırken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handlePythonSubmit = async (e) => {
    e.preventDefault();
    setPythonLoading(true);
    setPythonError('');
    setPythonResult(null);

    try {
      const response = await fetch('http://localhost:3001/api/body-analysis/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.success) {
        setPythonResult(payload.data);
      } else {
        setPythonError(payload.message || 'Python analizi sırasında bir hata oluştu');
      }
    } catch (err) {
      setPythonError(err.message || 'Python analizi sırasında bir hata oluştu');
    } finally {
      setPythonLoading(false);
    }
  };

  const startCamera = async () => {
    setUploadedFile(null);
    setCapturedImage(null);
    setCameraError('');
    try {
      console.log("Kamera başlatılıyor...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraActive(true); // Önce video DOM'a girsin
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch(e => {
                console.error("Video play hatası:", e);
              });
            }
          };
          console.log("Kamera aktif!");
        } else {
          console.error("videoRef.current yok!");
        }
      }, 100); // 100ms bekle, video DOM'a gelsin
    } catch (err) {
      console.error("Kamera başlatma hatası:", err);
      setCameraError('Kamera erişimi sağlanamadı. Lütfen tarayıcı izinlerini kontrol edin.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  const captureImageAndPrepareBlob = () => {
    return new Promise((resolve, reject) => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Canvas'ı Blob formatına çevir
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "capture.jpg", { type: 'image/jpeg' });
            setUploadedFile(file); // Yakalanan görüntüyü de File nesnesi olarak sakla
            setCapturedImage(URL.createObjectURL(file));
            resolve(file); // File nesnesini döndür
          } else {
            reject(new Error('Görüntüden blob oluşturulamadı.'));
          }
        }, 'image/jpeg', 0.9);
        stopCamera();
      } else {
        reject(new Error('Kamera veya canvas referansı bulunamadı.'));
      }
    });
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      stopCamera(); // Kamera açıksa kapat
      setCapturedImage(URL.createObjectURL(file)); // Önizleme için
      setUploadedFile(file); // Seçilen dosyayı state'e kaydet
      setCameraAnalysisResult(null); // Eski analiz sonuçlarını temizle
      setCameraError(''); // Eski hataları temizle
    } else {
      setCapturedImage(null);
      setUploadedFile(null);
      setCameraError('Lütfen geçerli bir resim dosyası seçin.');
    }
    // Aynı dosyayı tekrar seçebilmek için input değerini sıfırla
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const analyzeImageWithFastAPI = async () => {
    let imageFileToAnalyze = uploadedFile; // Önce yüklenmiş dosyayı kontrol et

    if (!imageFileToAnalyze) { // Eğer dosya yüklenmemişse kameradan yakalamayı dene
      try {
        imageFileToAnalyze = await captureImageAndPrepareBlob();
      } catch (error) {
        setCameraError(error.message || 'Görüntü yakalanırken/hazırlanırken bir hata oluştu.');
        setCameraLoading(false);
        return;
      }
    }

    if (!imageFileToAnalyze) {
      setCameraError('Analiz için bir görüntü (kamera veya dosya) bulunamadı.');
      return;
    }

    const currentGender = formData.gender || 'male';

    setCameraLoading(true);
    setCameraError('');
    setCameraAnalysisResult(null);

    const data = new FormData();
    // imageFileToAnalyze zaten bir File nesnesi olmalı (ya yüklenen dosya ya da kameradan oluşturulan)
    data.append('file', imageFileToAnalyze, imageFileToAnalyze.name || 'analysis_image.jpg');
    data.append('gender', currentGender);

    try {
      const response = await fetch('http://localhost:8000/analyze_image/', {
        method: 'POST',
        body: data,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || payload.message || 'Görüntü analizi sırasında bir sunucu hatası oluştu.');
      }
      setCameraAnalysisResult(payload);

    } catch (err) {
      const errorMessage = err.message || 'Görüntü analizi sırasında bir sunucu hatası oluştu.';
      setCameraError(errorMessage);
      console.error("FastAPI Analiz Hatası:", err);
    } finally {
      setCameraLoading(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Vücut Analizi
        </Typography>

        {/* Kamera Analizi Bölümü */}
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Kamera ile Vücut Analizi
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Kamera ile çekilen görüntü üzerinde kullanarak vücut analizi yapın.
          </Typography>

          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={12} md={6}>
              {/* Kamera ve Resim Önizleme Alanı */}
              <Box sx={{ position: 'relative', width: '100%', minHeight: 300, height: 'auto', bgcolor: 'black', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {capturedImage ? (
                  <img
                    src={capturedImage}
                    alt="Yakalanan veya Yüklenen Görüntü"
                    style={{ maxWidth: '100%', maxHeight: 400, height: 'auto', objectFit: 'contain' }}
                  />
                ) : cameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', height: 400, display: 'block', objectFit: 'contain', background: 'black' }}
                  />
                ) : (
                  null
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </Box>

              {/* Butonlar */}
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {!cameraActive && (
                  <Button
                    variant="contained"
                    onClick={startCamera}
                  >
                    Kamerayı Başlat
                  </Button>
                )}
                {cameraActive && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={captureImageAndPrepareBlob} // Bu artık uploadedFile'ı da set edecek
                  >
                    Görüntü Yakala
                  </Button>
                )}

                {/* Dosya Yükleme Butonu */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  id="image-upload-input"
                />
                <label htmlFor="image-upload-input">
                    <Button 
                        variant="outlined" 
                        component="span" // Bu, label'ın button gibi davranmasını sağlar
                        fullWidth
                    >
                        Resim Dosyası Yükle
                    </Button>
                </label>

                {(capturedImage || uploadedFile) && !cameraLoading && (
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={analyzeImageWithFastAPI}
                    disabled={cameraLoading}
                    sx={{ mt: 1 }} // Diğer butonlarla uyum için
                  >
                    {cameraLoading ? <CircularProgress size={24} /> : 'Seçili Görüntüyü Analiz Et'}
                  </Button>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              {cameraError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {cameraError}
                </Alert>
              )}

              {cameraAnalysisResult && (
                <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
                  <Typography variant="h6">Kamera Analiz Sonuçları (FastAPI)</Typography>
                  <pre>{JSON.stringify(cameraAnalysisResult, null, 2)}</pre>
                </Paper>
              )}
            </Grid>
          </Grid>
        </Paper>

        <Divider sx={{ my: 4 }} />

        {/* JavaScript Hesaplama Bölümü */}
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Kendi Hesaplamalarınızı Yapın
          </Typography>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Boy (cm)"
              name="height"
              type="number"
              value={formData.height}
              onChange={handleChange}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="Kilo (kg)"
              name="weight"
              type="number"
              value={formData.weight}
              onChange={handleChange}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="Yaş"
              name="age"
              type="number"
              value={formData.age}
              onChange={handleChange}
              margin="normal"
              required
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Cinsiyet</InputLabel>
              <Select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                required
              >
                <MenuItem value="male">Erkek</MenuItem>
                <MenuItem value="female">Kadın</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel>Aktivite Seviyesi</InputLabel>
              <Select
                name="activityLevel"
                value={formData.activityLevel}
                onChange={handleChange}
                required
              >
                <MenuItem value="sedentary">Hareketsiz</MenuItem>
                <MenuItem value="light">Hafif Aktif</MenuItem>
                <MenuItem value="moderate">Orta Aktif</MenuItem>
                <MenuItem value="very">Çok Aktif</MenuItem>
                <MenuItem value="extra">Ekstra Aktif</MenuItem>
              </Select>
            </FormControl>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ mt: 3 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Analiz Et'}
            </Button>
          </form>

          {result && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                JavaScript Analiz Sonuçları
              </Typography>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Typography>BMI: {result.bmi}</Typography>
                <Typography>BMR: {result.bmr}</Typography>
                <Typography>Günlük Kalori İhtiyacı: {result.dailyCalories}</Typography>
                <Typography>Vücut Yağ Oranı: {result.bodyFatPercentage}%</Typography>
                <Typography>İdeal Kilo: {result.idealWeight} kg</Typography>
              </Paper>
            </Box>
          )}
        </Paper>

        <Divider sx={{ my: 4 }} />

        {/* Python Hesaplama Bölümü */}
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Python ile Hesaplama
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Bu bolum, P:\kodlar\MetaboLift\backend\python\body_analysis.py dosyasindaki Python kodunu kullanarak hesaplama yapar.
          </Typography>
          
          <form onSubmit={handlePythonSubmit}>
            <TextField
              fullWidth
              label="Boy (cm)"
              name="height"
              type="number"
              value={formData.height}
              onChange={handleChange}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="Kilo (kg)"
              name="weight"
              type="number"
              value={formData.weight}
              onChange={handleChange}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="Yaş"
              name="age"
              type="number"
              value={formData.age}
              onChange={handleChange}
              margin="normal"
              required
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Cinsiyet</InputLabel>
              <Select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                required
              >
                <MenuItem value="male">Erkek</MenuItem>
                <MenuItem value="female">Kadın</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel>Aktivite Seviyesi</InputLabel>
              <Select
                name="activityLevel"
                value={formData.activityLevel}
                onChange={handleChange}
                required
              >
                <MenuItem value="sedentary">Hareketsiz</MenuItem>
                <MenuItem value="light">Hafif Aktif</MenuItem>
                <MenuItem value="moderate">Orta Aktif</MenuItem>
                <MenuItem value="very">Çok Aktif</MenuItem>
                <MenuItem value="extra">Ekstra Aktif</MenuItem>
              </Select>
            </FormControl>

            {pythonError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {pythonError}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ mt: 3 }}
              disabled={pythonLoading}
            >
              {pythonLoading ? <CircularProgress size={24} /> : 'Python ile Analiz Et'}
            </Button>
          </form>

          {pythonResult && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                Python Analiz Sonuçları
              </Typography>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Typography>BMI: {pythonResult.bmi}</Typography>
                <Typography>BMR: {pythonResult.bmr}</Typography>
                <Typography>Günlük Kalori İhtiyacı: {pythonResult.dailyCalories}</Typography>
                <Typography>Vücut Yağ Oranı: {pythonResult.bodyFatPercentage}%</Typography>
                <Typography>İdeal Kilo: {pythonResult.idealWeight} kg</Typography>
              </Paper>
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

export default BodyAnalysisScreen;