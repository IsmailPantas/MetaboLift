import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import { foodSubmissionService } from '../services/foodSubmissionService';

const formatDate = millis =>
  millis ? new Date(millis).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '-';

function AdminFoodDatabaseScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailForm, setDetailForm] = useState(null);
  const [savingDetail, setSavingDetail] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    let unsubscribe = () => {};

    try {
      unsubscribe = foodSubmissionService.subscribeApprovedSubmissions(
        rows => {
          setItems(rows);
          setLoading(false);
        },
        err => {
          setError(err.message || 'Besin veritabani yuklenemedi.');
          setLoading(false);
        }
      );
    } catch (err) {
      setError(err.message || 'Besin veritabani yuklenemedi.');
      setLoading(false);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const filteredItems = useMemo(() => {
    const q = String(search || '').toLowerCase().trim();
    if (!q) return items;
    return items.filter(item => {
      const name = String(item.name || '').toLowerCase();
      const brand = String(item.brandName || '').toLowerCase();
      const serving = String(item.serving || '').toLowerCase();
      return name.includes(q) || brand.includes(q) || serving.includes(q);
    });
  }, [items, search]);

  const openDetail = item => {
    setSelectedItem(item);
    setDetailForm({
      name: item.name || '',
      brandName: item.brandName || '',
      serving: item.serving || '',
      calories: String(item.calories ?? 0),
      protein: String(item.protein ?? 0),
      carbs: String(item.carbs ?? 0),
      fat: String(item.fat ?? 0),
      saturatedFat: String(item.saturatedFat ?? 0),
      fiber: String(item.fiber ?? 0),
      sugar: String(item.sugar ?? 0),
      sodium: String(item.sodium ?? 0),
      potassium: String(item.potassium ?? 0),
      calcium: String(item.calcium ?? 0),
      iron: String(item.iron ?? 0),
      magnesium: String(item.magnesium ?? 0),
      phosphorus: String(item.phosphorus ?? 0),
      zinc: String(item.zinc ?? 0),
      vitaminC: String(item.vitaminC ?? 0),
      vitaminB12: String(item.vitaminB12 ?? 0),
      glycemicIndex: item.glycemicIndex === 0 || item.glycemicIndex ? String(item.glycemicIndex) : '',
      diseaseTags: Array.isArray(item.diseaseTags) ? item.diseaseTags : [],
      unsuitableDiseaseTags: Array.isArray(item.unsuitableDiseaseTags) ? item.unsuitableDiseaseTags : [],
      notes: item.notes || '',
    });
    setDetailOpen(true);
  };

  const toggleTag = (field, disease) => {
    setDetailForm(prev => {
      const currentTags = Array.isArray(prev[field]) ? prev[field] : [];
      const otherField = field === 'diseaseTags' ? 'unsuitableDiseaseTags' : 'diseaseTags';
      const otherTags = Array.isArray(prev[otherField]) ? prev[otherField] : [];
      const isRemoving = currentTags.includes(disease);
      const nextTags = isRemoving ? currentTags.filter(tag => tag !== disease) : [...currentTags, disease];
      const nextOther = isRemoving ? otherTags : otherTags.filter(tag => tag !== disease);
      return { ...prev, [field]: nextTags, [otherField]: nextOther };
    });
  };

  const saveDetail = async () => {
    if (!selectedItem || !detailForm) return;
    setSavingDetail(true);
    try {
      await foodSubmissionService.updateSubmissionDetails({
        submissionId: selectedItem.id,
        updates: detailForm,
      });
      setDetailOpen(false);
    } catch (err) {
      window.alert(err.message || 'Besin guncellenemedi.');
    } finally {
      setSavingDetail(false);
    }
  };

  const handleDelete = async item => {
    const ok = window.confirm(`"${item.name}" kaydini silmek istedigine emin misin?`);
    if (!ok) return;
    setDeletingId(item.id);
    try {
      await foodSubmissionService.deleteSubmission(item.id);
    } catch (err) {
      window.alert(err.message || 'Besin silinemedi.');
    } finally {
      setDeletingId('');
    }
  };

  if (loading) {
    return (
      <Box py={8} textAlign="center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
        Admin Besin Veritabani
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Onayli tum besinleri buradan arayabilir, duzenleyebilir ve silebilirsin.
      </Typography>

      <TextField
        fullWidth
        label="Besin ara (ad, marka, porsiyon)"
        value={search}
        onChange={event => setSearch(event.target.value)}
        sx={{ mb: 3 }}
      />

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {filteredItems.length === 0 ? (
        <Alert severity="info">Aramaya uygun besin bulunamadi.</Alert>
      ) : (
        <Grid container spacing={2}>
          {filteredItems.map(item => (
            <Grid item xs={12} md={6} key={item.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h6">{item.name}</Typography>
                    <Chip size="small" color="success" label="Onayli" />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Marka: {item.brandName || '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Porsiyon: {item.serving || '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Son guncelleme: {formatDate(item.updatedAtMs || item.createdAtMs)}
                  </Typography>
                  <Typography variant="body2">
                    Kalori: {item.calories} | Protein: {item.protein}g | Karb: {item.carbs}g | Yag: {item.fat}g
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Glisemik indeks: {Number.isFinite(Number(item.glycemicIndex)) ? Number(item.glycemicIndex) : '-'}
                  </Typography>

                  <Box display="flex" gap={1} mt={2}>
                    <Button variant="contained" onClick={() => openDetail(item)}>
                      Duzenle
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      disabled={deletingId === item.id}
                      onClick={() => handleDelete(item)}
                    >
                      {deletingId === item.id ? 'Siliniyor...' : 'Sil'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Besin Duzenle</DialogTitle>
        <DialogContent dividers>
          {detailForm ? (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={4}><TextField fullWidth label="Besin adi" value={detailForm.name} onChange={e => setDetailForm(prev => ({ ...prev, name: e.target.value }))} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth label="Marka" value={detailForm.brandName} onChange={e => setDetailForm(prev => ({ ...prev, brandName: e.target.value }))} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth label="Porsiyon" value={detailForm.serving} onChange={e => setDetailForm(prev => ({ ...prev, serving: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Kalori" value={detailForm.calories} onChange={e => setDetailForm(prev => ({ ...prev, calories: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Protein" value={detailForm.protein} onChange={e => setDetailForm(prev => ({ ...prev, protein: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Karb" value={detailForm.carbs} onChange={e => setDetailForm(prev => ({ ...prev, carbs: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Yag" value={detailForm.fat} onChange={e => setDetailForm(prev => ({ ...prev, fat: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Doymus Yag" value={detailForm.saturatedFat} onChange={e => setDetailForm(prev => ({ ...prev, saturatedFat: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Lif" value={detailForm.fiber} onChange={e => setDetailForm(prev => ({ ...prev, fiber: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Seker" value={detailForm.sugar} onChange={e => setDetailForm(prev => ({ ...prev, sugar: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Sodyum" value={detailForm.sodium} onChange={e => setDetailForm(prev => ({ ...prev, sodium: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Potasyum" value={detailForm.potassium} onChange={e => setDetailForm(prev => ({ ...prev, potassium: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Kalsiyum" value={detailForm.calcium} onChange={e => setDetailForm(prev => ({ ...prev, calcium: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Demir" value={detailForm.iron} onChange={e => setDetailForm(prev => ({ ...prev, iron: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Magnezyum" value={detailForm.magnesium} onChange={e => setDetailForm(prev => ({ ...prev, magnesium: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Fosfor" value={detailForm.phosphorus} onChange={e => setDetailForm(prev => ({ ...prev, phosphorus: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Cinko" value={detailForm.zinc} onChange={e => setDetailForm(prev => ({ ...prev, zinc: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Vitamin C" value={detailForm.vitaminC} onChange={e => setDetailForm(prev => ({ ...prev, vitaminC: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Vitamin B12" value={detailForm.vitaminB12} onChange={e => setDetailForm(prev => ({ ...prev, vitaminB12: e.target.value }))} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Glisemik indeks" value={detailForm.glycemicIndex} onChange={e => setDetailForm(prev => ({ ...prev, glycemicIndex: e.target.value }))} /></Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Uygun etiketler</Typography>
                <Box display="flex" gap={1}>
                  <Chip clickable label="Diyabet icin uygun" color={detailForm.diseaseTags.includes('diabetes') ? 'primary' : 'default'} onClick={() => toggleTag('diseaseTags', 'diabetes')} />
                  <Chip clickable label="Colyak icin uygun" color={detailForm.diseaseTags.includes('celiac') ? 'primary' : 'default'} onClick={() => toggleTag('diseaseTags', 'celiac')} />
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Uygun olmayan etiketler</Typography>
                <Box display="flex" gap={1}>
                  <Chip clickable label="Diyabet icin uygun degil" color={detailForm.unsuitableDiseaseTags.includes('diabetes') ? 'error' : 'default'} onClick={() => toggleTag('unsuitableDiseaseTags', 'diabetes')} />
                  <Chip clickable label="Colyak icin uygun degil" color={detailForm.unsuitableDiseaseTags.includes('celiac') ? 'error' : 'default'} onClick={() => toggleTag('unsuitableDiseaseTags', 'celiac')} />
                </Box>
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth multiline minRows={2} label="Not" value={detailForm.notes} onChange={e => setDetailForm(prev => ({ ...prev, notes: e.target.value }))} />
              </Grid>
            </Grid>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)} disabled={savingDetail}>Vazgec</Button>
          <Button variant="contained" onClick={saveDetail} disabled={savingDetail}>
            {savingDetail ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminFoodDatabaseScreen;
