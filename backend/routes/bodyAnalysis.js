const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);

// Geçici dosyalar için klasörü oluştur
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

router.post('/analyze', async (req, res) => {
  try {
    const { height, weight, age, gender, activityLevel } = req.body;

    // Python script'ini çalıştır
    const pythonProcess = spawn('python', [
      path.join(__dirname, '../python/body_analysis.py'),
      JSON.stringify({ height, weight, age, gender, activityLevel })
    ]);

    let result = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return res.status(500).json({
          success: false,
          message: 'Vücut analizi yapılırken bir hata oluştu',
          error: error
        });
      }

      try {
        const analysisResult = JSON.parse(result);
        res.json({
          success: true,
          data: analysisResult
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          message: 'Sonuçlar işlenirken bir hata oluştu',
          error: err.message
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Bir hata oluştu',
      error: error.message
    });
  }
});

router.post('/analyze-image', async (req, res) => {
  let tempImagePath = null;
  try {
    const { image, gender } = req.body;
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Görüntü verisi eksik'
      });
    }

    // Base64 formatını ve uzantısını algıla
    let base64Data, ext;
    if (image.startsWith('data:image/png')) {
      base64Data = image.replace(/^data:image\/png;base64,/, '');
      ext = 'png';
    } else if (image.startsWith('data:image/jpeg') || image.startsWith('data:image/jpg')) {
      base64Data = image.replace(/^data:image\/jpeg;base64,/, '').replace(/^data:image\/jpg;base64,/, '');
      ext = 'jpg';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Desteklenmeyen görüntü formatı'
      });
    }

    tempImagePath = path.join(tempDir, `temp_${Date.now()}.${ext}`);
    await writeFileAsync(tempImagePath, base64Data, 'base64');

    // Python script'ini çalıştır
    const pythonProcess = spawn('python', [
      path.join(__dirname, '../python/body_analysis.py'),
      tempImagePath,
      gender || 'male'
    ]);

    let result = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    pythonProcess.on('close', async (code) => {
      if (tempImagePath && fs.existsSync(tempImagePath)) {
        try {
          await fs.promises.unlink(tempImagePath);
        } catch (err) {
          console.error('Geçici dosya silinemedi:', err);
        }
      }

      if (code !== 0) {
        return res.status(500).json({
          success: false,
          message: 'Görüntü analizi sırasında bir hata oluştu',
          error: error || result
        });
      }

      try {
        const analysisResult = JSON.parse(result);
        if (analysisResult.error) {
          return res.status(400).json({
            success: false,
            message: analysisResult.error
          });
        }
        res.json({
          success: true,
          data: analysisResult
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          message: 'Sonuçlar işlenirken bir hata oluştu',
          error: err.message + ' | ' + result
        });
      }
    });
  } catch (error) {
    if (tempImagePath && fs.existsSync(tempImagePath)) {
      try {
        await fs.promises.unlink(tempImagePath);
      } catch (err) {
        console.error('Geçici dosya silinemedi:', err);
      }
    }
    res.status(500).json({
      success: false,
      message: 'Bir hata oluştu',
      error: error.message
    });
  }
});

module.exports = router; 