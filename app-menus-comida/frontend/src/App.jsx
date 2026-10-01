import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import { useProfile } from './context/ProfileContext.jsx';
import MenuPage from './pages/MenuPage.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';
import PantryPage from './pages/PantryPage.jsx';
import PurchasePage from './pages/PurchasePage.jsx';
import RecipeDetailPage from './pages/RecipeDetailPage.jsx';
import RecipeFormPage from './pages/RecipeFormPage.jsx';
import RecipesPage from './pages/RecipesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ShoppingListPage from './pages/ShoppingListPage.jsx';

export default function App() {
  const { profile, error, reload } = useProfile();

  if (error) {
    return (
      <div className="center-screen">
        <p className="notice error">{error}</p>
        <button className="button" onClick={reload}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="center-screen muted" role="status">
        Cargando…
      </div>
    );
  }

  // Until the first interview is confirmed, everything leads to it.
  const needsOnboarding = !profile.onboardingCompletedAt;

  return (
    <Routes>
      <Route path="/bienvenida" element={<OnboardingPage />} />
      <Route element={needsOnboarding ? <Navigate to="/bienvenida" replace /> : <Layout />}>
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/despensa" element={<PantryPage />} />
        <Route path="/despensa/compra" element={<PurchasePage />} />
        <Route path="/lista" element={<ShoppingListPage />} />
        <Route path="/recetas" element={<RecipesPage />} />
        <Route path="/recetas/nueva" element={<RecipeFormPage key="new" />} />
        <Route path="/recetas/:id" element={<RecipeDetailPage />} />
        <Route path="/recetas/:id/editar" element={<RecipeFormPage key="edit" />} />
        <Route path="/ajustes" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/menu" replace />} />
    </Routes>
  );
}
