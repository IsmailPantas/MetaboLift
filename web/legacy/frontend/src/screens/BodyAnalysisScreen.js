import React, { useState, useRef } from 'react';

const BodyAnalysisScreen = () => {
  const [formData, setFormData] = useState({
    gender: 'male'
  });

  const [imageAnalysis, setImageAnalysis] = useState({
    loading: false,
    error: null,
    result: null,
    image: null
  });

  const fileInputRef = useRef(null);

  const handleImageCapture = async () => {
    try {
      const image = await new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            video.srcObject = stream;
            video.play();

            video.onloadedmetadata = () => {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              context.drawImage(video, 0, 0);
              stream.getTracks().forEach(track => track.stop());
              resolve(canvas.toDataURL('image/jpeg'));
            };
          })
          .catch(reject);
      });

      setImageAnalysis(prev => ({ ...prev, image, loading: true, error: null }));

      const response = await fetch('/api/body-analysis/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image,
          gender: formData.gender
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Görüntü analizi başarısız oldu');
      }

      setImageAnalysis(prev => ({
        ...prev,
        loading: false,
        result: data.data
      }));
    } catch (error) {
      setImageAnalysis(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setImageAnalysis(prev => ({ ...prev, image, loading: true, error: null }));

      const response = await fetch('/api/body-analysis/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image,
          gender: formData.gender
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Görüntü analizi başarısız oldu');
      }

      setImageAnalysis(prev => ({
        ...prev,
        loading: false,
        result: data.data
      }));
    } catch (error) {
      setImageAnalysis(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Görüntü Analizi Bölümü */}
      <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Görüntü Analizi</h2>
        
        <div className="space-y-4">
          <div className="flex gap-4">
            <button
              onClick={handleImageCapture}
              disabled={imageAnalysis.loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {imageAnalysis.loading ? 'Analiz Yapılıyor...' : 'Fotoğraf Çek'}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={imageAnalysis.loading}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {imageAnalysis.loading ? 'Analiz Yapılıyor...' : 'Dosya Yükle'}
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          {imageAnalysis.error && (
            <div className="p-4 bg-red-100 text-red-700 rounded-md">
              <strong>Hata:</strong> {imageAnalysis.error}
            </div>
          )}

          {imageAnalysis.image && (
            <div className="mt-4">
              <img
                src={imageAnalysis.image}
                alt="Analiz edilen görüntü"
                className="max-w-full h-auto rounded-md"
              />
            </div>
          )}

          {imageAnalysis.result && (
            <div className="mt-4 space-y-2">
              <h3 className="text-xl font-semibold">Analiz Sonuçları:</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="font-medium">Vücut Yağ Oranı:</p>
                  <p className="text-lg">{imageAnalysis.result["Vücut Yağ Oranı (%)"].toFixed(1)}%</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="font-medium">Bel-Kalça Oranı:</p>
                  <p className="text-lg">{imageAnalysis.result["Bel-Kalça Oranı (WHR)"].toFixed(2)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="font-medium">Omuz Genişliği:</p>
                  <p className="text-lg">{imageAnalysis.result["Omuz Genişliği (px)"].toFixed(0)} px</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="font-medium">Kalça Genişliği:</p>
                  <p className="text-lg">{imageAnalysis.result["Kalça Genişliği (px)"].toFixed(0)} px</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BodyAnalysisScreen; 