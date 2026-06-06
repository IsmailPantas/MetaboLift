import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Checkbox,
  Container,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  Paper,
  Alert,
} from '@mui/material';
import { authService } from '../services/api';

function RegisterScreen() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    passwordConfirm: '',
    hasDisease: 'no',
    diseases: [],
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleDiseaseToggle = disease => {
    const activeDiseases = form.diseases.includes(disease)
      ? form.diseases.filter(item => item !== disease)
      : [...form.diseases, disease];
    setForm(prev => ({ ...prev, diseases: activeDiseases }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.password !== form.passwordConfirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    if (form.hasDisease === 'yes' && form.diseases.length === 0) {
      setError('Lütfen en az bir hastalık seçin.');
      return;
    }
    setLoading(true);
    try {
      const response = await authService.register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        hasDisease: form.hasDisease === 'yes',
        diseases: form.hasDisease === 'yes' ? form.diseases : [],
      });
      if (response.success) {
        setSuccess('Hesap oluşturuldu! Profil bilgilerini tamamlayalım...');
        setTimeout(() => navigate('/profile-setup'), 900);
      } else {
        setError('Kayıt başarısız.');
      }
    } catch (err) {
      setError(err.message || 'Kayıt sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f3e7e9 0%, #e3eeff 100%)' }}>
      <Container maxWidth="sm">
        <Paper elevation={4} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h4" align="center" gutterBottom color="primary">
            Kayıt Ol
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
              label="E-posta"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
            />
            <TextField
              label="Şifre"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              fullWidth
              margin="normal"
              required
            />
            <TextField
              label="Şifre Tekrar"
              name="passwordConfirm"
              type="password"
              value={form.passwordConfirm || ''}
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
              {loading ? 'Kayıt Yapılıyor...' : 'Kayıt Ol'}
            </Button>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Zaten hesabınız var mı?{' '}
                <Button variant="text" onClick={() => navigate('/login')}>Giriş Yap</Button>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default RegisterScreen; 