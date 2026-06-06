import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, LinearProgress, Typography } from '@mui/material';

const STORAGE_KEY = 'metabolift_water_ml';
const DAILY_TARGET_ML = 2500;

const safeRead = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
};

function WaterTrackingPage() {
  const [waterMl, setWaterMl] = useState(safeRead);
  const progress = useMemo(() => Math.min(100, Math.round((waterMl / DAILY_TARGET_ML) * 100)), [waterMl]);

  const persist = next => {
    setWaterMl(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  const addWater = ml => {
    persist(Math.max(0, waterMl + ml));
  };

  const resetDay = () => {
    persist(0);
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
        Su Takibi
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Günlük su tüketimini hızlıca takip etmek için bu sayfayı kullanabilirsin.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6">Günlük Hedef</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {DAILY_TARGET_ML} ml
          </Typography>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 20, mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {waterMl} ml / {DAILY_TARGET_ML} ml ({progress}%)
          </Typography>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Button variant="contained" onClick={() => addWater(200)}>+200 ml</Button>
        <Button variant="contained" onClick={() => addWater(250)}>+250 ml</Button>
        <Button variant="contained" onClick={() => addWater(500)}>+500 ml</Button>
        <Button variant="outlined" color="error" onClick={resetDay}>Sıfırla</Button>
      </Box>

      {progress >= 100 ? (
        <Alert severity="success">Harika! Günlük su hedefini tamamladın.</Alert>
      ) : (
        <Alert severity="info">Hedefe kalan: {Math.max(0, DAILY_TARGET_ML - waterMl)} ml</Alert>
      )}
    </Box>
  );
}

export default WaterTrackingPage;
