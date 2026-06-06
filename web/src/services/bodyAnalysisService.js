const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const bodyAnalysisService = {
  analyzeBody: async (data) => {
    const response = await fetch(`${API_URL}/api/body-analysis/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw payload?.message || 'Bir hata oluştu';
    }
    return payload;
  },
}; 