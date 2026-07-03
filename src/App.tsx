import { HashRouter, Route, Routes } from 'react-router-dom';
import { RoleProvider } from './contexts/RoleContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { RequireRole } from './components/RequireRole';
import { Layout } from './components/Layout/Layout';
import { P00_RoleSwitch } from './pages/P00_RoleSwitch/P00_RoleSwitch';
import { P01_Home } from './pages/P01_Home/P01_Home';
import { P10_LanConfig } from './pages/P10_LanConfig/P10_LanConfig';
import { P11_Subsets } from './pages/P11_Subsets/P11_Subsets';
import { NotImplemented } from './pages/NotImplemented';

export function App() {
  return (
    <HashRouter>
      <RoleProvider>
        <ProjectProvider>
          <Routes>
            <Route path="/role" element={<P00_RoleSwitch />} />
            <Route element={<RequireRole />}>
              <Route element={<Layout />}>
                <Route path="/" element={<P01_Home />} />
                <Route path="/lan-config" element={<P10_LanConfig />} />
                <Route path="/subsets" element={<P11_Subsets />} />
                <Route path="*" element={<NotImplemented />} />
              </Route>
            </Route>
          </Routes>
        </ProjectProvider>
      </RoleProvider>
    </HashRouter>
  );
}
