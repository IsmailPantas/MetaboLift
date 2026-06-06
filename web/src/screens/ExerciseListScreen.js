import React, { useEffect, useState } from 'react';
import { Box, Grid, Card, CardContent, Typography, CardMedia, CircularProgress, Alert, FormControl, InputLabel, Select, MenuItem } from '@mui/material';

const RAPIDAPI_KEY = process.env.REACT_APP_RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = 'exercisedb.p.rapidapi.com';
const RAPIDAPI_HEADERS = {
  'X-RapidAPI-Key': RAPIDAPI_KEY,
  'X-RapidAPI-Host': RAPIDAPI_HOST,
};

function ExerciseListScreen() {
  const [bodyParts, setBodyParts] = useState([]);
  const [targets, setTargets] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [selectedBodyPart, setSelectedBodyPart] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filteredTargets, setFilteredTargets] = useState([]);
  const [filteredEquipments, setFilteredEquipments] = useState([]);
  const [filteredBodyParts, setFilteredBodyParts] = useState([]);

  // Filtre listelerini çek (ilk yüklemede)
  useEffect(() => {
    const fetchFilters = async () => {
      setLoading(true);
      setError('');
      try {
        const [bodyPartsRes, targetsRes, equipmentsRes] = await Promise.all([
          fetch('https://exercisedb.p.rapidapi.com/exercises/bodyPartList', { headers: RAPIDAPI_HEADERS }),
          fetch('https://exercisedb.p.rapidapi.com/exercises/targetList', { headers: RAPIDAPI_HEADERS }),
          fetch('https://exercisedb.p.rapidapi.com/exercises/equipmentList', { headers: RAPIDAPI_HEADERS }),
        ]);
        const [bodyParts, targets, equipments] = await Promise.all([
          bodyPartsRes.json(),
          targetsRes.json(),
          equipmentsRes.json(),
        ]);
        setBodyParts(bodyParts);
        setTargets(targets);
        setEquipments(equipments);
        setFilteredBodyParts(bodyParts);
        setFilteredTargets(targets);
        setFilteredEquipments(equipments);
      } catch (err) {
        setError('Filtre verileri alınırken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };
    fetchFilters();
  }, []);

  // Seçimlere göre egzersizleri çek
  useEffect(() => {
    // Hiçbir filtre seçilmediyse egzersiz gösterme
    if (!selectedBodyPart && !selectedTarget && !selectedEquipment) {
      setExercises([]);
      setFilteredBodyParts(bodyParts);
      setFilteredTargets(targets);
      setFilteredEquipments(equipments);
      return;
    }
    const fetchExercises = async () => {
      setLoading(true);
      setError('');
      try {
        let url = '';
        if (selectedBodyPart) {
          url = `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${selectedBodyPart}`;
        } else if (selectedTarget) {
          url = `https://exercisedb.p.rapidapi.com/exercises/target/${selectedTarget}`;
        } else if (selectedEquipment) {
          url = `https://exercisedb.p.rapidapi.com/exercises/equipment/${selectedEquipment}`;
        }
        const response = await fetch(url, {
          headers: RAPIDAPI_HEADERS,
        });
        let filtered = await response.json();
        if (selectedBodyPart) filtered = filtered.filter(e => !selectedTarget || e.target === selectedTarget);
        if (selectedBodyPart) filtered = filtered.filter(e => !selectedEquipment || e.equipment === selectedEquipment);
        if (selectedTarget) filtered = filtered.filter(e => !selectedBodyPart || e.bodyPart === selectedBodyPart);
        if (selectedTarget) filtered = filtered.filter(e => !selectedEquipment || e.equipment === selectedEquipment);
        if (selectedEquipment) filtered = filtered.filter(e => !selectedBodyPart || e.bodyPart === selectedBodyPart);
        if (selectedEquipment) filtered = filtered.filter(e => !selectedTarget || e.target === selectedTarget);
        setExercises(filtered);
        // Diğer filtrelerin seçeneklerini güncelle
        setFilteredBodyParts([...new Set(filtered.map(e => e.bodyPart))]);
        setFilteredTargets([...new Set(filtered.map(e => e.target))]);
        setFilteredEquipments([...new Set(filtered.map(e => e.equipment))]);
        // Seçili değerler yeni seçeneklerde yoksa sıfırla
        if (selectedBodyPart && !filtered.some(e => e.bodyPart === selectedBodyPart)) setSelectedBodyPart('');
        if (selectedTarget && !filtered.some(e => e.target === selectedTarget)) setSelectedTarget('');
        if (selectedEquipment && !filtered.some(e => e.equipment === selectedEquipment)) setSelectedEquipment('');
      } catch (err) {
        setError('Egzersiz verileri alınırken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };
    fetchExercises();
  }, [selectedBodyPart, selectedTarget, selectedEquipment, bodyParts, targets, equipments]);

  // Filtre değişim fonksiyonları (sadece seçili değeri günceller)
  const handleBodyPartChange = (e) => {
    setSelectedBodyPart(e.target.value);
  };
  const handleTargetChange = (e) => {
    setSelectedTarget(e.target.value);
  };
  const handleEquipmentChange = (e) => {
    setSelectedEquipment(e.target.value);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Egzersiz Hareketleri
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Vücut bölümü, hedef kas grubu veya ekipman seçerek egzersizleri filtreleyin.
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel id="bodypart-select-label">Vücut Bölümü</InputLabel>
            <Select
              labelId="bodypart-select-label"
              value={selectedBodyPart}
              label="Vücut Bölümü"
              onChange={handleBodyPartChange}
              disabled={loading || filteredBodyParts.length === 0}
            >
              <MenuItem value="">Tümü</MenuItem>
              {filteredBodyParts.map((part, idx) => (
                <MenuItem value={part} key={idx}>{part.charAt(0).toUpperCase() + part.slice(1)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel id="target-select-label">Hedef Kas Grubu</InputLabel>
            <Select
              labelId="target-select-label"
              value={selectedTarget}
              label="Hedef Kas Grubu"
              onChange={handleTargetChange}
              disabled={loading || filteredTargets.length === 0}
            >
              <MenuItem value="">Tümü</MenuItem>
              {filteredTargets.map((target, idx) => (
                <MenuItem value={target} key={idx}>{target.charAt(0).toUpperCase() + target.slice(1)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel id="equipment-select-label">Ekipman</InputLabel>
            <Select
              labelId="equipment-select-label"
              value={selectedEquipment}
              label="Ekipman"
              onChange={handleEquipmentChange}
              disabled={loading || filteredEquipments.length === 0}
            >
              <MenuItem value="">Tümü</MenuItem>
              {filteredEquipments.map((eq, idx) => (
                <MenuItem value={eq} key={idx}>{eq.charAt(0).toUpperCase() + eq.slice(1)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>
      )}
      <Grid container spacing={3}>
        {exercises.map((exercise, idx) => (
          <Grid item xs={12} sm={6} md={4} key={exercise.id || idx}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardMedia
                component="img"
                height="180"
                image={exercise.gifUrl || exercise.image || 'https://via.placeholder.com/300x180?text=Egzersiz'}
                alt={exercise.name}
                sx={{ objectFit: 'cover' }}
              />
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" component="div" color="primary.main">
                  {exercise.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {exercise.bodyPart} | {exercise.equipment} | {exercise.target}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {(selectedBodyPart || selectedTarget || selectedEquipment) && !loading && exercises.length === 0 && !error && (
        <Typography sx={{ mt: 4, textAlign: 'center' }} color="text.secondary">
          Seçilen filtre(ler) için egzersiz bulunamadı.
        </Typography>
      )}
    </Box>
  );
}

export default ExerciseListScreen; 