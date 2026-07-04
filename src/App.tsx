import { HashRouter, Route, Routes } from 'react-router-dom';
import { RoleProvider } from './contexts/RoleContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { RequireRole } from './components/RequireRole';
import { Layout } from './components/Layout/Layout';
import { P00_RoleSwitch } from './pages/P00_RoleSwitch/P00_RoleSwitch';
import { P01_Home } from './pages/P01_Home/P01_Home';
import { P10_LanConfig } from './pages/P10_LanConfig/P10_LanConfig';
import { P11_Subsets } from './pages/P11_Subsets/P11_Subsets';
import { P20_Applications } from './pages/P20_Applications/P20_Applications';
import { P21_Create } from './pages/P21_Create/P21_Create';
import { P22_Detail } from './pages/P22_Detail/P22_Detail';
import { P30_FrameSignal } from './pages/P30_FrameSignal/P30_FrameSignal';
import { P33_FrameDetail } from './pages/P33_FrameDetail/P33_FrameDetail';
import { P34_SignalDetail } from './pages/P34_SignalDetail/P34_SignalDetail';
import { NotImplemented } from './pages/NotImplemented';

export function App() {
  return (
    <HashRouter>
      <RoleProvider>
        <ProjectProvider>
          <Routes>
            <Route path="/role" element={<P00_RoleSwitch />} />
            <Route element={<RequireRole />}>
              <Route path="/frames/:frameId" element={<P33_FrameDetail />} />
              <Route path="/signals/:signalId" element={<P34_SignalDetail />} />
              <Route element={<Layout />}>
                <Route path="/" element={<P01_Home />} />
                <Route path="/lan-config" element={<P10_LanConfig />} />
                <Route path="/subsets" element={<P11_Subsets />} />
                <Route path="/applications" element={<P20_Applications />} />
                <Route path="/applications/new" element={<P21_Create />} />
                <Route path="/applications/:id" element={<P22_Detail />} />
                <Route path="/applications/:id/edit" element={<P21_Create />} />
                <Route path="/frame-signal" element={<P30_FrameSignal />} />
                <Route path="*" element={<NotImplemented />} />
              </Route>
            </Route>
          </Routes>
        </ProjectProvider>
      </RoleProvider>
    </HashRouter>
  );
}
