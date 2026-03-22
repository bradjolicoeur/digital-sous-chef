import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useFusionAuth } from '@fusionauth/react-sdk';
import TopNavBar from './components/TopNavBar';
import SideNavBar from './components/SideNavBar';
import BottomNavBar from './components/BottomNavBar';
import AuthGuard from './auth/AuthGuard';
import HomePage from './pages/HomePage';
import GalleryPage from './pages/GalleryPage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import RecipeEditPage from './pages/RecipeEditPage';
import PlannerPage from './pages/PlannerPage';
import GroceryListPage from './pages/GroceryListPage';

const SIDEBAR_ROUTES = ['/gallery', '/planner', '/grocery'];

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn } = useFusionAuth();
  const showSidebar = SIDEBAR_ROUTES.some(r => location.pathname === r || location.pathname.startsWith(r + '/'));
  const isRecipeDetail = location.pathname.startsWith('/recipe/') || location.pathname.startsWith('/recipes/new');

  // After FusionAuth redirects back, navigate to the originally requested page
  useEffect(() => {
    if (isLoggedIn) {
      const dest = sessionStorage.getItem('postLoginRedirect');
      if (dest) {
        sessionStorage.removeItem('postLoginRedirect');
        navigate(dest, { replace: true });
      }
    }
  }, [isLoggedIn, navigate]);

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <TopNavBar />
      <div className="flex">
        {showSidebar && (
          <div className="hidden lg:block">
            <SideNavBar />
          </div>
        )}
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/gallery" element={<AuthGuard><GalleryPage /></AuthGuard>} />
            <Route path="/gallery/:category" element={<AuthGuard><GalleryPage /></AuthGuard>} />
            <Route path="/recipe/:id" element={<AuthGuard><RecipeDetailPage /></AuthGuard>} />
            <Route path="/recipe/:id/edit" element={<AuthGuard><RecipeEditPage /></AuthGuard>} />
            <Route path="/recipes/new" element={<AuthGuard><RecipeEditPage /></AuthGuard>} />
            <Route path="/planner" element={<AuthGuard><PlannerPage /></AuthGuard>} />
            <Route path="/grocery" element={<AuthGuard><GroceryListPage /></AuthGuard>} />
          </Routes>
        </div>
      </div>
      {!isRecipeDetail && <BottomNavBar />}
    </div>
  );
}

export default AppLayout;