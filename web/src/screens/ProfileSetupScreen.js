import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { authService } from '../services/api';

function ProfileSetupScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    gender: '',
    height: '',
    weight: '',
    hasDisease: 'no',
    diseases: [],
  });

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (authService.isProfileComplete(currentUser)) {
      navigate('/');
      return;
    }

    setForm({
      firstName: currentUser.firstName || '',
      lastName: currentUser.lastName || '',
      birthDate: currentUser.birthDate || '',
      gender: currentUser.gender || '',
      height: currentUser.height ? String(currentUser.height) : '',
      weight: currentUser.weight ? String(currentUser.weight) : '',
      hasDisease: currentUser.hasDisease ? 'yes' : 'no',
      diseases: Array.isArray(currentUser.diseases) ? currentUser.diseases : [],
    });
  }, [navigate]);

  const handleChange = event => {
    setForm(prev => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleDiseaseToggle = disease => {
    const activeDiseases = form.diseases.includes(disease)
      ? form.diseases.filter(item => item !== disease)
      : [...form.diseases, disease];
    setForm(prev => ({ ...prev, diseases: activeDiseases }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (Number(form.height) <= 0 || Number(form.weight) <= 0) {
      setError('Boy ve kilo 0\'dan büyük olmalı.');
      return;
    }
    if (form.hasDisease === 'yes' && form.diseases.length === 0) {
      setError('Lütfen en az bir hastalık seçin.');
      return;
    }

    setLoading(true);

    try {
      await authService.completeProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        birthDate: form.birthDate,
        gender: form.gender,
        height: Number(form.height),
        weight: Number(form.weight),
        hasDisease: form.hasDisease === 'yes',
        diseases: form.hasDisease === 'yes' ? form.diseases : [],
      });
      setSuccess('Profil bilgileri kaydedildi. Ana sayfaya yönlendiriliyorsunuz...');
      setTimeout(() => navigate('/'), 800);
    } catch (err) {
      setError(err.message || 'Profil kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f3e7e9 0%, #e3eeff 100%)',
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={4} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h4" align="center" gutterBottom color="primary">
            Profil Bilgilerini Tamamla
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 2 }}>
            Uygulamayı kullanmaya devam etmek için temel bilgilerini doldur.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Ad"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
            />
            <TextField
              label="Soyad"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
            />
            <TextField
              label="Doğum Tarihi"
              name="birthDate"
              type="date"
              value={form.birthDate}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Cinsiyet"
              name="gender"
              select
              value={form.gender}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
            >
              <MenuItem value="male">Erkek</MenuItem>
              <MenuItem value="female">Kadın</MenuItem>
            </TextField>
            <TextField
              label="Boy (cm)"
              name="height"
              type="number"
              value={form.height}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
            />
            <TextField
              label="Kilo (kg)"
              name="weight"
              type="number"
              value={form.weight}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
            />
            <FormControl sx={{ mt: 2 }}>
              <FormLabel>Tanılı hastalığınız var mı?</FormLabel>
              <RadioGroup
                row
                name="hasDisease"
                value={form.hasDisease}
                onChange={handleChange}
              >
                <FormControlLabel value="yes" control={<Radio />} label="Evet" />
                <FormControlLabel value="no" control={<Radio />} label="Hayır" />
              </RadioGroup>
            </FormControl>

            {form.hasDisease === 'yes' && (
              <Box sx={{ mt: 1, mb: 1, p: 2, borderRadius: 2, backgroundColor: 'rgba(128, 0, 128, 0.05)' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Hastalık seçimi (birden fazla seçebilirsin)
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.diseases.includes('diabetes')}
                      onChange={() => handleDiseaseToggle('diabetes')}
                    />
                  }
                  label="Diyabet"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.diseases.includes('celiac')}
                      onChange={() => handleDiseaseToggle('celiac')}
                    />
                  }
                  label="Çölyak"
                />
              </Box>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              sx={{ mt: 3, py: 1.5, fontSize: '1.1rem', fontWeight: 600 }}
              disabled={loading}
            >
              {loading ? 'Kaydediliyor...' : 'Bilgileri Kaydet'}
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default ProfileSetupScreen;
