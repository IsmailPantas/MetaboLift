import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
} from '@mui/material';

const STORAGE_KEY = 'metabolift_exercise_plan_items';

const safeRead = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

function ExercisePlanScreen() {
  const [items, setItems] = useState(safeRead);
  const [exerciseName, setExerciseName] = useState('');
  const [duration, setDuration] = useState('');
  const [detail, setDetail] = useState('');
  const [info, setInfo] = useState('');

  const totalMinutes = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.duration || 0), 0),
    [items]
  );

  const persist = next => {
    setItems(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleAdd = () => {
    if (!exerciseName.trim() || Number(duration) <= 0) {
      setInfo('Egzersiz adı ve süre (dk) zorunlu.');
      return;
    }

    const next = [
      {
        id: `${Date.now()}`,
        exerciseName: exerciseName.trim(),
        duration: Number(duration),
        detail: detail.trim(),
      },
      ...items,
    ];

    persist(next);
    setExerciseName('');
    setDuration('');
    setDetail('');
    setInfo('');
  };

  const handleDelete = id => {
    persist(items.filter(item => item.id !== id));
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
        Egzersiz Planı
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Günlük egzersizlerini planlayıp süre takibi yapabilirsin.
      </Typography>

      {info ? <Alert severity="warning" sx={{ mb: 2 }}>{info}</Alert> : null}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Egzersiz Ekle</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Egzersiz"
                value={exerciseName}
                onChange={event => setExerciseName(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="number"
                label="Süre (dk)"
                value={duration}
                onChange={event => setDuration(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                label="Detay"
                value={detail}
                onChange={event => setDetail(event.target.value)}
              />
            </Grid>
          </Grid>
          <Button variant="contained" sx={{ mt: 2 }} onClick={handleAdd}>
            Egzersiz Ekle
          </Button>
        </CardContent>
      </Card>

      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
        Toplam Süre: {totalMinutes} dk
      </Typography>

      {items.length === 0 ? (
        <Alert severity="info">Henüz egzersiz eklenmedi.</Alert>
      ) : (
        <Grid container spacing={2}>
          {items.map(item => (
            <Grid item xs={12} md={6} key={item.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6">{item.exerciseName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Süre: {item.duration} dk
                  </Typography>
                  {item.detail ? <Typography variant="body2" sx={{ mt: 1 }}>{item.detail}</Typography> : null}
                  <Button color="error" size="small" sx={{ mt: 1 }} onClick={() => handleDelete(item.id)}>
                    Sil
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

export default ExercisePlanScreen;
