const { spawn } = require('child_process');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();

router.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Görsel yüklenmedi' });
        }

        const pythonProcess = spawn('python', ['bodyAnalysis.py']);
        
        let result = '';
        let error = '';

        // Base64'e çevir
        const base64Image = req.file.buffer.toString('base64');
        
        // Python scriptine veriyi gönder
        pythonProcess.stdin.write(JSON.stringify({
            image: base64Image,
            gender: req.body.gender || 'male'
        }));
        pythonProcess.stdin.end();

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
                    error: error || 'Vücut analizi sırasında bir hata oluştu.' 
                });
            }
            try {
                const parsedResult = JSON.parse(result);
                res.json(parsedResult);
            } catch (e) {
                res.status(500).json({ 
                    success: false, 
                    error: 'Sonuçlar işlenirken bir hata oluştu' 
                });
            }
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            error: 'Sunucu hatası: ' + err.message 
        });
    }
});

module.exports = router; 