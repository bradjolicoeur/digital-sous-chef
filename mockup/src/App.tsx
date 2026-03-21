import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { TopNavBar } from './components/TopNavBar';
import { SideNavBar } from './components/SideNavBar';
import { BottomNavBar } from './components/BottomNavBar';
import { HomePage } from './pages/HomePage';
import { GalleryPage } from './pages/GalleryPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { PlannerPage } from './pages/PlannerPage';
import { GroceryListPage } from './pages/GroceryListPage';
import { cn } from './lib/utils';

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isGallery = location.pathname.startsWith('/gallery');
  const isPlanner = location.pathname === '/planner';
  const isRecipeDetail = location.pathname.startsWith('/recipe/');
  
  // Sidebar is only shown on Gallery and Planner for desktop
  const showSidebar = isGallery || isPlanner;

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <TopNavBar />
      <div className="flex">
        {showSidebar && <SideNavBar />}
        <div className={cn(
          "flex-1 transition-all",
          showSidebar ? "lg:ml-0" : ""
        )}>
          {children}
        </div>
      </div>
      {!isRecipeDetail && <BottomNavBar />}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/gallery/:category" element={<GalleryPage />} />
          <Route path="/recipe/:id" element={<RecipeDetailPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/grocery" element={<GroceryListPage />} />
          {/* Fallbacks */}
          <Route path="*" element={<HomePage />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}
