import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import theme from './theme';
import { authService } from './services/api';

// Screens
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import BodyAnalysisScreen from './screens/BodyAnalysisScreen';
import NutritionPage from './screens/NutritionPage';
import ExerciseListScreen from './screens/ExerciseListScreen';
import RegisterScreen from './screens/RegisterScreen';
import MealPlanScreen from './screens/MealPlanScreen';
import ExercisePlanScreen from './screens/ExercisePlanScreen';
import WaterTrackingPage from './screens/WaterTrackingPage';
import ProfileSetupScreen from './screens/ProfileSetupScreen';
import AdminFoodReviewScreen from './screens/AdminFoodReviewScreen';
import AdminFoodDatabaseScreen from './screens/AdminFoodDatabaseScreen';
import AdminProblematicFoodsScreen from './screens/AdminProblematicFoodsScreen';

// Components
import Layout from './components/Layout';

const RequireAuth = ({ children }) => {
  const user = authService.getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const RequireCompleteProfile = ({ children }) => {
  const user = authService.getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!authService.isProfileComplete(user)) return <Navigate to="/profile-setup" replace />;
  return children;
};

const RedirectIfAuthenticated = ({ children }) => {
  const user = authService.getCurrentUser();
  if (!user) return children;
  if (authService.isProfileComplete(user)) return <Navigate to="/" replace />;
  return <Navigate to="/profile-setup" replace />;
};

const RequireAdmin = ({ children }) => {
  const user = authService.getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          background: `linear-gradient(135deg, ${theme.palette.primary.light}15, ${theme.palette.secondary.light}15)`,
        }}
      >
        <Routes>
          <Route path="/login" element={<RedirectIfAuthenticated><LoginScreen /></RedirectIfAuthenticated>} />
          <Route path="/register" element={<RedirectIfAuthenticated><RegisterScreen /></RedirectIfAuthenticated>} />
          <Route
            path="/profile-setup"
            element={
              <RequireAuth>
                <ProfileSetupScreen />
              </RequireAuth>
            }
          />
          <Route path="/" element={<RequireCompleteProfile><Layout /></RequireCompleteProfile>}>
            <Route index element={<HomeScreen />} />
            <Route path="body-analysis" element={<BodyAnalysisScreen />} />
            <Route path="nutrition" element={<NutritionPage />} />
            <Route path="exercises" element={<ExerciseListScreen />} />
            <Route path="meal-plan" element={<MealPlanScreen />} />
            <Route path="exercise-plan" element={<ExercisePlanScreen />} />
            <Route path="water-tracking" element={<WaterTrackingPage />} />
            <Route
              path="admin/food-review"
              element={
                <RequireAdmin>
                  <AdminFoodReviewScreen />
                </RequireAdmin>
              }
            />
            <Route
              path="admin/food-database"
              element={
                <RequireAdmin>
                  <AdminFoodDatabaseScreen />
                </RequireAdmin>
              }
            />
            <Route
              path="admin/problematic-foods"
              element={
                <RequireAdmin>
                  <AdminProblematicFoodsScreen />
                </RequireAdmin>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </ThemeProvider>
  );
}

export default App; 