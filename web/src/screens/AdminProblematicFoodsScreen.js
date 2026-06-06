import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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

const AdminProblematicFoodsScreen = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailForm, setDetailForm] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  React.useEffect(() => {
    setLoading(true);
    let unsubscribe = () => {};

    try {
      unsubscribe = foodSubmissionService.subscribePendingFoodIssueReports(
        rows => {
          setItems(rows);
          setLoading(false);
        },
        error => {
          window.alert(error.message || 'Sorunlu besinler yuklenemedi.');
          setLoading(false);
        }
      );
    } catch (error) {
      window.alert(error.message || 'Sorunlu besinler yuklenemedi.');
      setLoading(false);
    }

    return () => unsubscribe();
  }, []);

  const filteredItems = useMemo(() => {
    const q = String(search || '').toLowerCase().trim();
    if (!q) return items;
    return items.filter(item => {
      const foodName = String(item.foodName || '').toLowerCase();
      const reason = String(item.reportReason || '').toLowerCase();
      const email = String(item.reportedByEmail || '').toLowerCase();
      return foodName.includes(q) || reason.includes(q) || email.includes(q);
    });
  }, [items, search]);

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

  const handleOpenDetail = async report => {
    try {
      setSaving(true);
      const food = await foodSubmissionService.getSubmissionById(report.foodSubmissionId);
      setSelectedReport(report);
      setAdminNote('');
      setDetailForm({
        name: food.name || '',
        brandName: food.brandName || '',
        serving: food.serving || '',
        calories: String(food.calories ?? 0),
        protein: String(food.protein ?? 0),
        carbs: String(food.carbs ?? 0),
        fat: String(food.fat ?? 0),
        saturatedFat: String(food.saturatedFat ?? 0),
        fiber: String(food.fiber ?? 0),
        sugar: String(food.sugar ?? 0),
        sodium: String(food.sodium ?? 0),
        potassium: String(food.potassium ?? 0),
        calcium: String(food.calcium ?? 0),
        iron: String(food.iron ?? 0),
        magnesium: String(food.magnesium ?? 0),
        phosphorus: String(food.phosphorus ?? 0),
        zinc: String(food.zinc ?? 0),
        vitaminC: String(food.vitaminC ?? 0),
        vitaminB12: String(food.vitaminB12 ?? 0),
        glycemicIndex: food.glycemicIndex === 0 || food.glycemicIndex ? String(food.glycemicIndex) : '',
        diseaseTags: Array.isArray(food.diseaseTags) ? food.diseaseTags : [],
        unsuitableDiseaseTags: Array.isArray(food.unsuitableDiseaseTags) ? food.unsuitableDiseaseTags : [],
        notes: food.notes || '',
      });
      setDetailOpen(true);
    } catch (error) {
      window.alert(error.message || 'Besin detaylari acilamadi.');
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedReport || !detailForm) return;
    setSaving(true);
    try {
      await foodSubmissionService.updateFoodIssueReportAndFood({
        reportId: selectedReport.id,
        foodSubmissionId: selectedReport.foodSubmissionId,
        foodUpdates: detailForm,
        resolutionStatus: 'resolved',
        adminNote,
      });
      setDetailOpen(false);
      setSelectedReport(null);
      setDetailForm(null);
      setAdminNote('');
      window.alert('Rapor cozuldu ve besin guncellendi.');
    } catch (error) {
      window.alert(error.message || 'Rapor cozulurken hata olustu.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async report => {
    const ok = window.confirm(`"${report.foodName}" raporunu silmek istiyor musun?`);
    if (!ok) return;
    setDeletingId(report.id);
    try {
      await foodSubmissionService.deleteFoodIssueReport(report.id);
    } catch (error) {
      window.alert(error.message || 'Rapor silinemedi.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 700, color: '#2D5A27' }}>
        Sorunlu Besinler
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Kullanicilarin bildirdigi sorunlu besinleri duzenle, onayla ve yonet.
      </Typography>

      <TextField
        fullWidth
        label="Ara (besin, neden, e-posta)"
        value={search}
        onChange={event => setSearch(event.target.value)}
        sx={{ mb: 2 }}
      />

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : filteredItems.length === 0 ? (
        <Alert severity="info">Bekleyen sorun bildirimi yok.</Alert>
      ) : (
        <Grid container spacing={2}>
          {filteredItems.map(item => (
            <Grid item xs={12} md={6} key={item.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {item.foodName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Bildiren: {item.reportedByEmail || item.reportedBy}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tarih: {formatDate(item.createdAtMs)}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Neden: {item.reportReason}
                  </Typography>
                  <Box display="flex" gap={1} mt={2}>
                    <Button variant="contained" onClick={() => handleOpenDetail(item)}>
                      Duzenle
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? 'Siliniyor...' : 'Sorunu Sil'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Raporu Duzenle</DialogTitle>
        <DialogContent dividers>
          {detailForm ? (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Alert severity="warning">{selectedReport?.reportReason || '-'}</Alert>
              </Grid>
              <Grid item xs={12}><TextField fullWidth label="Besin adi" value={detailForm.name} onChange={event => setDetailForm(prev => ({ ...prev, name: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Marka" value={detailForm.brandName} onChange={event => setDetailForm(prev => ({ ...prev, brandName: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Porsiyon" value={detailForm.serving} onChange={event => setDetailForm(prev => ({ ...prev, serving: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Kalori" value={detailForm.calories} onChange={event => setDetailForm(prev => ({ ...prev, calories: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Protein" value={detailForm.protein} onChange={event => setDetailForm(prev => ({ ...prev, protein: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Karb" value={detailForm.carbs} onChange={event => setDetailForm(prev => ({ ...prev, carbs: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Yag" value={detailForm.fat} onChange={event => setDetailForm(prev => ({ ...prev, fat: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Doymus Yag" value={detailForm.saturatedFat} onChange={event => setDetailForm(prev => ({ ...prev, saturatedFat: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Lif" value={detailForm.fiber} onChange={event => setDetailForm(prev => ({ ...prev, fiber: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Seker" value={detailForm.sugar} onChange={event => setDetailForm(prev => ({ ...prev, sugar: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Sodyum" value={detailForm.sodium} onChange={event => setDetailForm(prev => ({ ...prev, sodium: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Potasyum" value={detailForm.potassium} onChange={event => setDetailForm(prev => ({ ...prev, potassium: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Kalsiyum" value={detailForm.calcium} onChange={event => setDetailForm(prev => ({ ...prev, calcium: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Demir" value={detailForm.iron} onChange={event => setDetailForm(prev => ({ ...prev, iron: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Magnezyum" value={detailForm.magnesium} onChange={event => setDetailForm(prev => ({ ...prev, magnesium: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Fosfor" value={detailForm.phosphorus} onChange={event => setDetailForm(prev => ({ ...prev, phosphorus: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Cinko" value={detailForm.zinc} onChange={event => setDetailForm(prev => ({ ...prev, zinc: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Vitamin C" value={detailForm.vitaminC} onChange={event => setDetailForm(prev => ({ ...prev, vitaminC: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Vitamin B12" value={detailForm.vitaminB12} onChange={event => setDetailForm(prev => ({ ...prev, vitaminB12: event.target.value }))} /></Grid>
              <Grid item xs={6}><TextField fullWidth label="Glisemik indeks" value={detailForm.glycemicIndex} onChange={event => setDetailForm(prev => ({ ...prev, glycemicIndex: event.target.value }))} /></Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Uygun etiketler
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Button variant={detailForm.diseaseTags.includes('diabetes') ? 'contained' : 'outlined'} onClick={() => toggleTag('diseaseTags', 'diabetes')}>Diyabet icin uygun</Button>
                  <Button variant={detailForm.diseaseTags.includes('celiac') ? 'contained' : 'outlined'} onClick={() => toggleTag('diseaseTags', 'celiac')}>Colyak icin uygun</Button>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Uygun olmayan etiketler
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Button color="error" variant={detailForm.unsuitableDiseaseTags.includes('diabetes') ? 'contained' : 'outlined'} onClick={() => toggleTag('unsuitableDiseaseTags', 'diabetes')}>Diyabet icin uygun degil</Button>
                  <Button color="error" variant={detailForm.unsuitableDiseaseTags.includes('celiac') ? 'contained' : 'outlined'} onClick={() => toggleTag('unsuitableDiseaseTags', 'celiac')}>Colyak icin uygun degil</Button>
                </Box>
              </Grid>
              <Grid item xs={12}><TextField fullWidth multiline minRows={2} label="Besin notu" value={detailForm.notes} onChange={event => setDetailForm(prev => ({ ...prev, notes: event.target.value }))} /></Grid>
              <Grid item xs={12}><TextField fullWidth multiline minRows={2} label="Admin cozum notu" value={adminNote} onChange={event => setAdminNote(event.target.value)} /></Grid>
            </Grid>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)} disabled={saving}>Vazgec</Button>
          <Button variant="contained" onClick={handleResolve} disabled={saving}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Onayla ve Guncelle'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminProblematicFoodsScreen;
