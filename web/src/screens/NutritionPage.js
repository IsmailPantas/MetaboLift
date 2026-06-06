import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocalDiningIcon from '@mui/icons-material/LocalDining';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { nutritionService } from '../services/nutritionService';
import { authService } from '../services/api';
import { foodSubmissionService } from '../services/foodSubmissionService';

const NutritionPage = () => {
  const [nutritionData, setNutritionData] = useState(nutritionService.getFallbackFoods());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailFood, setDetailFood] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportFood, setReportFood] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [submissionForm, setSubmissionForm] = useState({
    name: '',
    brandName: '',
    serving: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    saturatedFat: '',
    fiber: '',
    sugar: '',
    sodium: '',
    potassium: '',
    calcium: '',
    iron: '',
    magnesium: '',
    phosphorus: '',
    zinc: '',
    vitaminC: '',
    vitaminB12: '',
    glycemicIndex: '',
    diseaseTags: [],
    unsuitableDiseaseTags: [],
    notes: '',
  });
  const setup = useMemo(() => nutritionService.getSetupState(), []);
  const currentUser = useMemo(() => authService.getCurrentUser(), []);
  const diseases = Array.isArray(currentUser?.diseases) ? currentUser.diseases : [];

  const theme = useTheme();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const defaults = await nutritionService.getInitialFoods();
        if (mounted) setNutritionData(defaults);
      } catch {
        if (mounted) setNutritionData(nutritionService.getFallbackFoods());
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const searchNutrition = async () => {
    if (!searchQuery.trim()) {
      const defaults = await nutritionService.getInitialFoods().catch(() => nutritionService.getFallbackFoods());
      setNutritionData(defaults);
      setError('');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const results = await nutritionService.searchFoods(searchQuery);
      setNutritionData(results);
      if (results.length === 0) {
        setError('Sonuc bulunamadi. Farkli bir besin adi deneyin.');
      } else {
        setError('');
      }
    } catch (err) {
      setError(err.message || 'Besin verileri su anda alinamiyor.');
    } finally {
      setLoading(false);
    }
  };

  const getDiseaseSignals = item => {
    const signals = [];
    const name = String(item?.name || '').toLowerCase();
    const glutenKeywords = ['wheat', 'barley', 'rye', 'bulgur', 'spelt', 'bread'];
    const glutenFreeKeywords = ['gluten free', 'gf'];
    const diseaseTags = Array.isArray(item?.diseaseTags) ? item.diseaseTags : [];
    const unsuitableDiseaseTags = Array.isArray(item?.unsuitableDiseaseTags) ? item.unsuitableDiseaseTags : [];
    const hasTag = (list, tag) => list.includes(tag);

    if (diseases.includes('diabetes')) {
      if (hasTag(unsuitableDiseaseTags, 'diabetes')) {
        signals.push({ label: 'Diyabet icin dikkat', color: 'warning' });
      } else if (hasTag(diseaseTags, 'diabetes')) {
        signals.push({ label: 'Diyabet icin daha uygun', color: 'success' });
      } else if (item.sugar <= 5 && item.fiber >= 3 && item.carbs <= 25) {
        signals.push({ label: 'Diyabet icin daha uygun', color: 'success' });
      } else if (item.sugar > 10 || item.carbs > 40) {
        signals.push({ label: 'Diyabet icin dikkat', color: 'warning' });
      }
    }

    if (diseases.includes('celiac')) {
      if (hasTag(unsuitableDiseaseTags, 'celiac')) {
        signals.push({ label: 'Colyak icin gluten riski', color: 'error' });
      } else if (hasTag(diseaseTags, 'celiac')) {
        signals.push({ label: 'Glutensiz secenek', color: 'success' });
      } else if (glutenKeywords.some(keyword => name.includes(keyword))) {
        signals.push({ label: 'Colyak icin gluten riski', color: 'error' });
      } else if (glutenFreeKeywords.some(keyword => name.includes(keyword))) {
        signals.push({ label: 'Glutensiz secenek', color: 'success' });
      }
    }

    return signals;
  };

  const handleOpenDetail = async food => {
    setDetailOpen(true);
    setDetailFood(food);
    setDetailData(null);
    setDetailError('');

    if (!food?.fdcId) {
      setDetailData({
        fdcId: null,
        description: food?.name || '',
        calories: Number(food?.calories || 0),
        protein: Number(food?.protein || 0),
        carbs: Number(food?.carbs || 0),
        fat: Number(food?.fat || 0),
        saturatedFat: Number(food?.saturatedFat || 0),
        fiber: Number(food?.fiber || 0),
        sugar: Number(food?.sugar || 0),
        sodium: Number(food?.sodium || 0),
        potassium: Number(food?.potassium || 0),
        micronutrients: {
          calcium: Number(food?.calcium || 0),
          iron: Number(food?.iron || 0),
          magnesium: Number(food?.magnesium || 0),
          phosphorus: Number(food?.phosphorus || 0),
          zinc: Number(food?.zinc || 0),
          vitaminC: Number(food?.vitaminC || 0),
          vitaminB12: Number(food?.vitaminB12 || 0),
        },
        glycemicIndex: food?.glycemicIndex ?? null,
      });
      return;
    }

    setDetailLoading(true);
    try {
      const detail = await nutritionService.getFoodDetails(food.fdcId);
      setDetailData(detail);
    } catch (err) {
      setDetailError(err.message || 'Detay verisi alinamadi.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setDetailFood(null);
    setDetailData(null);
    setDetailError('');
  };

  const handleSubmissionField = (field, value) => {
    setSubmissionForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmissionDiseaseToggle = (field, disease) => {
    setSubmissionForm(prev => {
      const currentTags = Array.isArray(prev[field]) ? prev[field] : [];
      const otherField = field === 'diseaseTags' ? 'unsuitableDiseaseTags' : 'diseaseTags';
      const otherTags = Array.isArray(prev[otherField]) ? prev[otherField] : [];
      const isRemoving = currentTags.includes(disease);
      const nextTags = isRemoving
        ? currentTags.filter(item => item !== disease)
        : [...currentTags, disease];
      const nextOtherTags = isRemoving
        ? otherTags
        : otherTags.filter(item => item !== disease);

      return {
        ...prev,
        [field]: nextTags,
        [otherField]: nextOtherTags,
      };
    });
  };

  const handleOpenSubmission = () => {
    if (!currentUser?.uid) {
      setError('Besin onerisi gonderebilmek icin once giris yapmalisin.');
      return;
    }
    setSubmissionOpen(true);
  };

  const resetSubmissionForm = () => {
    setSubmissionForm({
      name: '',
      brandName: '',
      serving: '',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      saturatedFat: '',
      fiber: '',
      sugar: '',
      sodium: '',
      potassium: '',
      calcium: '',
      iron: '',
      magnesium: '',
      phosphorus: '',
      zinc: '',
      vitaminC: '',
      vitaminB12: '',
      glycemicIndex: '',
      diseaseTags: [],
      unsuitableDiseaseTags: [],
      notes: '',
    });
  };

  const handleSubmitFoodSuggestion = async () => {
    setSubmissionLoading(true);
    try {
      await foodSubmissionService.submitSuggestion(submissionForm);
      setSubmissionOpen(false);
      resetSubmissionForm();
      setError('');
      window.alert('Besin onerisi admin onay kuyruğuna eklendi.');
    } catch (err) {
      window.alert(err.message || 'Besin onerisi gonderilirken bir hata olustu.');
    } finally {
      setSubmissionLoading(false);
    }
  };

  const handleOpenIssueReport = food => {
    if (!food?.submissionId) {
      window.alert('Bu besin harici kaynaktan geldigi icin su an bildirilemez.');
      return;
    }
    setReportFood(food);
    setReportReason('');
    setReportDialogOpen(true);
  };

  const handleSubmitIssueReport = async () => {
    if (!String(reportReason || '').trim()) {
      window.alert('Lutfen kisaca neden sorunlu oldugunu yaz.');
      return;
    }
    if (!reportFood?.submissionId) {
      window.alert('Gecersiz besin kaydi.');
      return;
    }
    setReportLoading(true);
    try {
      await foodSubmissionService.submitFoodIssueReport({
        foodSubmissionId: reportFood.submissionId,
        foodName: reportFood.name,
        reportReason,
      });
      setReportDialogOpen(false);
      setReportFood(null);
      setReportReason('');
      window.alert('Tesekkurler. Bildirimin admin inceleme listesine eklendi.');
    } catch (err) {
      window.alert(err.message || 'Bildirimin gonderilemedi.');
    } finally {
      setReportLoading(false);
    }
  };

  const renderFoodCard = item => {
    const diseaseSignals = getDiseaseSignals(item);

    return (
    <Grid item xs={12} sm={6} md={4} key={item.id}>
      <Card 
        elevation={0}
        sx={{ 
          mb: 2, 
          height: '100%',
          transition: 'all 0.3s ease',
          borderRadius: 3,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          background: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(10px)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme.shadows[4],
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          }
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center">
              <LocalDiningIcon color="primary" sx={{ mr: 1 }} />
              <Typography 
                variant="h6" 
                color="primary"
                sx={{ 
                  fontWeight: 600,
                  fontSize: '1.1rem',
                  lineHeight: 1.2
                }}
              >
                {item.name}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => handleOpenIssueReport(item)}
              sx={{ color: 'error.main' }}
              title="Sorun bildir"
            >
              <ReportProblemOutlinedIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box display="flex" flexWrap="wrap" gap={1} mb={1}>
            {item.isTrusted ? (
              <Chip
                size="small"
                label="Guvenli"
                deleteIcon={<VerifiedRoundedIcon sx={{ color: '#2D5A27 !important' }} />}
                onDelete={() => {}}
                sx={{
                  bgcolor: 'rgba(77, 140, 140, 0.18)',
                  color: '#2D5A27',
                  fontWeight: 700,
                  '& .MuiChip-deleteIcon': {
                    marginRight: '4px',
                    marginLeft: '-2px',
                  },
                }}
              />
            ) : null}
            {item.isRecommended && <Chip size="small" color="success" label="Onerilen" />}
            {item.dataType ? <Chip size="small" variant="outlined" label={item.dataType} /> : null}
            {item.brandOwner ? <Chip size="small" variant="outlined" label={item.brandOwner} /> : null}
          </Box>

          {diseaseSignals.length > 0 && (
            <Box display="flex" flexWrap="wrap" gap={1} mb={1}>
              {diseaseSignals.map(signal => (
                <Chip key={`${item.id}-${signal.label}`} size="small" color={signal.color} label={signal.label} />
              ))}
            </Box>
          )}
          
          {item.serving && (
            <Typography 
              variant="subtitle2" 
              color="text.secondary" 
              gutterBottom
              sx={{ mb: 2, fontStyle: 'italic' }}
            >
              Porsiyon: {item.serving}
            </Typography>
          )}
          
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                textAlign: 'center'
              }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Kalori
                </Typography>
                <Typography variant="h6" color="primary" sx={{ fontWeight: 600 }}>
                  {item.calories}
                  <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                    kcal
                  </Typography>
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: alpha(theme.palette.success.main, 0.1),
                textAlign: 'center'
              }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Protein
                </Typography>
                <Typography variant="h6" color="success.main" sx={{ fontWeight: 600 }}>
                  {item.protein}
                  <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                    g
                  </Typography>
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: alpha(theme.palette.warning.main, 0.1),
                textAlign: 'center'
              }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Karbonhidrat
                </Typography>
                <Typography variant="h6" color="warning.main" sx={{ fontWeight: 600 }}>
                  {item.carbs}
                  <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                    g
                  </Typography>
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: alpha(theme.palette.info.main, 0.1),
                textAlign: 'center'
              }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Yağ
                </Typography>
                <Typography variant="h6" color="info.main" sx={{ fontWeight: 600 }}>
                  {item.fat}
                  <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                    g
                  </Typography>
                </Typography>
              </Box>
            </Grid>
            {(item.sugar > 0 || item.fiber > 0 || item.sodium > 0 || item.potassium > 0 || item.saturatedFat > 0) && (
              <>
                <Grid item xs={6}>
                  <Box sx={{ 
                    p: 1.5, 
                    borderRadius: 2, 
                    bgcolor: alpha(theme.palette.error.main, 0.1),
                    textAlign: 'center'
                  }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Şeker
                    </Typography>
                    <Typography variant="h6" color="error.main" sx={{ fontWeight: 600 }}>
                      {item.sugar}
                      <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                        g
                      </Typography>
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ 
                    p: 1.5, 
                    borderRadius: 2, 
                    bgcolor: alpha(theme.palette.success.light, 0.1),
                    textAlign: 'center'
                  }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Lif
                    </Typography>
                    <Typography variant="h6" color="success.light" sx={{ fontWeight: 600 }}>
                      {item.fiber}
                      <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                        g
                      </Typography>
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.warning.light, 0.12), textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Sodyum
                    </Typography>
                    <Typography variant="h6" color="warning.dark" sx={{ fontWeight: 600 }}>
                      {item.sodium}
                      <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                        mg
                      </Typography>
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.secondary.main, 0.1), textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Potasyum
                    </Typography>
                    <Typography variant="h6" color="secondary.main" sx={{ fontWeight: 600 }}>
                      {item.potassium}
                      <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                        mg
                      </Typography>
                    </Typography>
                  </Box>
                </Grid>
              </>
            )}
          </Grid>

          <Box mt={2}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => handleOpenDetail(item)}
            >
              Besin Detaylari
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Grid>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box textAlign="center" mb={6}>
        <Typography 
          variant="h3" 
          component="h1" 
          gutterBottom 
          sx={{ 
            fontWeight: 700,
            background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            backgroundClip: 'text',
            textFillColor: 'transparent',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Besin Degerleri
        </Typography>
      </Box>

      {!setup.hasApiKey && (
        <Alert severity="info" sx={{ mb: 4 }}>
          USDA API key henuz girilmedi. Su an fallback veriyle calisiyor. `web/.env` dosyasina `REACT_APP_USDA_API_KEY` eklediginde canli sonuclar gelecek.
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        En uygun 3 sonuc ustte gosterilir. Daha dogru sonuc icin marka veya urun turu ekleyin (ornek: whole wheat bread).
      </Alert>

      <Divider sx={{ 
        my: 8,
        '&::before, &::after': {
          borderColor: alpha(theme.palette.primary.main, 0.2),
        }
      }} />

      <Box textAlign="center" mb={6}>
        <Typography 
          variant="h3" 
          component="h2" 
          gutterBottom
          sx={{ 
            fontWeight: 700,
            background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            backgroundClip: 'text',
            textFillColor: 'transparent',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Besin Ara (USDA)
        </Typography>
      </Box>

      <Box 
        sx={{ 
          maxWidth: 800,
          mx: 'auto',
          mb: 6
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={9}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Ornek: banana, chicken breast, oatmeal"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="primary" />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 3,
                  bgcolor: 'background.paper',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                  },
                }
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="contained"
              onClick={searchNutrition}
              disabled={loading}
              sx={{
                borderRadius: 3,
                py: 1.7,
                boxShadow: 2,
                '&:hover': {
                  boxShadow: 4,
                }
              }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Ara'
              )}
            </Button>
          </Grid>
        </Grid>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
        <Button variant="outlined" onClick={handleOpenSubmission}>
          Aradigin besin yoksa bize ekle
        </Button>
      </Box>

      {error && (
        <Box 
          sx={{ 
            mb: 4, 
            p: 2, 
            borderRadius: 2, 
            bgcolor: alpha(theme.palette.error.main, 0.1),
            border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
            textAlign: 'center'
          }}
        >
          <Typography color="error">
            {error}
          </Typography>
        </Box>
      )}

      <Grid container spacing={3}>
        {nutritionData.map(item => renderFoodCard(item))}
      </Grid>

      <Dialog open={detailOpen} onClose={handleCloseDetail} fullWidth maxWidth="sm">
        <DialogTitle>{detailFood?.name || 'Besin Detayi'}</DialogTitle>
        <DialogContent dividers>
          {detailLoading && (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress size={28} />
            </Box>
          )}

          {!detailLoading && detailError && (
            <Alert severity="warning">{detailError}</Alert>
          )}

          {!detailLoading && !detailError && detailData && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography>
                  <b>Glisemik Indeks:</b>{' '}
                  {Number.isFinite(Number(detailData.glycemicIndex)) ? Number(detailData.glycemicIndex) : '-'}
                </Typography>
              </Grid>
              <Grid item xs={6}><Typography><b>Kalori:</b> {detailData.calories} kcal</Typography></Grid>
              <Grid item xs={6}><Typography><b>Protein:</b> {detailData.protein} g</Typography></Grid>
              <Grid item xs={6}><Typography><b>Karbonhidrat:</b> {detailData.carbs} g</Typography></Grid>
              <Grid item xs={6}><Typography><b>Yag:</b> {detailData.fat} g</Typography></Grid>
              <Grid item xs={6}><Typography><b>Lif:</b> {detailData.fiber} g</Typography></Grid>
              <Grid item xs={6}><Typography><b>Seker:</b> {detailData.sugar} g</Typography></Grid>
              <Grid item xs={6}><Typography><b>Sodyum:</b> {detailData.sodium} mg</Typography></Grid>
              <Grid item xs={6}><Typography><b>Potasyum:</b> {detailData.potassium} mg</Typography></Grid>
              <Grid item xs={6}><Typography><b>Kalsiyum:</b> {detailData.micronutrients.calcium} mg</Typography></Grid>
              <Grid item xs={6}><Typography><b>Demir:</b> {detailData.micronutrients.iron} mg</Typography></Grid>
              <Grid item xs={6}><Typography><b>Magnezyum:</b> {detailData.micronutrients.magnesium} mg</Typography></Grid>
              <Grid item xs={6}><Typography><b>Fosfor:</b> {detailData.micronutrients.phosphorus} mg</Typography></Grid>
              <Grid item xs={6}><Typography><b>Cinko:</b> {detailData.micronutrients.zinc} mg</Typography></Grid>
              <Grid item xs={6}><Typography><b>Vitamin C:</b> {detailData.micronutrients.vitaminC} mg</Typography></Grid>
              <Grid item xs={6}><Typography><b>Vitamin B12:</b> {detailData.micronutrients.vitaminB12} ug</Typography></Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetail}>Kapat</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={submissionOpen} onClose={() => setSubmissionOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Besin Onerisi Gonder</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Besin adi"
                value={submissionForm.name}
                onChange={event => handleSubmissionField('name', event.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Marka (opsiyonel)"
                value={submissionForm.brandName}
                onChange={event => handleSubmissionField('brandName', event.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Porsiyon aciklamasi"
                placeholder="100 g, 1 adet, 1 su bardagi"
                value={submissionForm.serving}
                onChange={event => handleSubmissionField('serving', event.target.value)}
                required
              />
            </Grid>
            <Grid item xs={6}><TextField fullWidth label="Kalori" value={submissionForm.calories} onChange={event => handleSubmissionField('calories', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Protein (g)" value={submissionForm.protein} onChange={event => handleSubmissionField('protein', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Karbonhidrat (g)" value={submissionForm.carbs} onChange={event => handleSubmissionField('carbs', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Yag (g)" value={submissionForm.fat} onChange={event => handleSubmissionField('fat', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Doymus yag (g)" value={submissionForm.saturatedFat} onChange={event => handleSubmissionField('saturatedFat', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Lif (g)" value={submissionForm.fiber} onChange={event => handleSubmissionField('fiber', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Seker (g)" value={submissionForm.sugar} onChange={event => handleSubmissionField('sugar', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Sodyum (mg)" value={submissionForm.sodium} onChange={event => handleSubmissionField('sodium', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Potasyum (mg)" value={submissionForm.potassium} onChange={event => handleSubmissionField('potassium', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Kalsiyum (mg)" value={submissionForm.calcium} onChange={event => handleSubmissionField('calcium', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Demir (mg)" value={submissionForm.iron} onChange={event => handleSubmissionField('iron', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Magnezyum (mg)" value={submissionForm.magnesium} onChange={event => handleSubmissionField('magnesium', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Fosfor (mg)" value={submissionForm.phosphorus} onChange={event => handleSubmissionField('phosphorus', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Cinko (mg)" value={submissionForm.zinc} onChange={event => handleSubmissionField('zinc', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Vitamin C (mg)" value={submissionForm.vitaminC} onChange={event => handleSubmissionField('vitaminC', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Vitamin B12 (ug)" value={submissionForm.vitaminB12} onChange={event => handleSubmissionField('vitaminB12', event.target.value)} /></Grid>
            <Grid item xs={6}><TextField fullWidth label="Glisemik indeks" value={submissionForm.glycemicIndex} onChange={event => handleSubmissionField('glycemicIndex', event.target.value)} /></Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Uygun hastalik etiketleri
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                <Chip
                  clickable
                  color={submissionForm.diseaseTags.includes('diabetes') ? 'primary' : 'default'}
                  label="Diyabet icin uygun"
                  onClick={() => handleSubmissionDiseaseToggle('diseaseTags', 'diabetes')}
                />
                <Chip
                  clickable
                  color={submissionForm.diseaseTags.includes('celiac') ? 'primary' : 'default'}
                  label="Colyak icin uygun"
                  onClick={() => handleSubmissionDiseaseToggle('diseaseTags', 'celiac')}
                />
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Uygun olmayan hastalik etiketleri
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                <Chip
                  clickable
                  color={submissionForm.unsuitableDiseaseTags.includes('diabetes') ? 'error' : 'default'}
                  label="Diyabet icin uygun degil"
                  onClick={() => handleSubmissionDiseaseToggle('unsuitableDiseaseTags', 'diabetes')}
                />
                <Chip
                  clickable
                  color={submissionForm.unsuitableDiseaseTags.includes('celiac') ? 'error' : 'default'}
                  label="Colyak icin uygun degil"
                  onClick={() => handleSubmissionDiseaseToggle('unsuitableDiseaseTags', 'celiac')}
                />
              </Box>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Not"
                value={submissionForm.notes}
                onChange={event => handleSubmissionField('notes', event.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmissionOpen(false)} disabled={submissionLoading}>
            Vazgec
          </Button>
          <Button variant="contained" onClick={handleSubmitFoodSuggestion} disabled={submissionLoading}>
            {submissionLoading ? <CircularProgress size={18} color="inherit" /> : 'Gonder'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reportDialogOpen} onClose={() => setReportDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Sorun Bildir</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            {reportFood?.name || '-'}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={4}
            label="Neden duzeltilmeli?"
            value={reportReason}
            onChange={event => setReportReason(event.target.value)}
            placeholder="Ornek: Kalori veya protein degerinin hatali oldugunu dusunuyorum..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialogOpen(false)} disabled={reportLoading}>
            Vazgec
          </Button>
          <Button variant="contained" onClick={handleSubmitIssueReport} disabled={reportLoading}>
            {reportLoading ? <CircularProgress size={18} color="inherit" /> : 'Bildir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default NutritionPage; 