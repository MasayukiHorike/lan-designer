import { HashRouter, Route, Routes } from 'react-router-dom';
import { RoleProvider } from './contexts/RoleContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { RequireRole } from './components/RequireRole';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout/Layout';
import { P00_RoleSwitch } from './pages/P00_RoleSwitch/P00_RoleSwitch';
import { P01_Home } from './pages/P01_Home/P01_Home';
import { P02_Projects } from './pages/P02_Projects/P02_Projects';
import { P10_LanConfig } from './pages/P10_LanConfig/P10_LanConfig';
import { P11_Subsets } from './pages/P11_Subsets/P11_Subsets';
import { P20_Applications } from './pages/P20_Applications/P20_Applications';
import { P21_Create } from './pages/P21_Create/P21_Create';
import { P22_Detail } from './pages/P22_Detail/P22_Detail';
import { P30_FrameSignal } from './pages/P30_FrameSignal/P30_FrameSignal';
import { P31_SubsetView } from './pages/P31_SubsetView/P31_SubsetView';
import { P33_FrameDetail } from './pages/P33_FrameDetail/P33_FrameDetail';
import { P34_SignalDetail } from './pages/P34_SignalDetail/P34_SignalDetail';
import { P40_EcuPort } from './pages/P40_EcuPort/P40_EcuPort';
import { P50_Snapshots } from './pages/P50_Snapshots/P50_Snapshots';
import { P51_Changelogs } from './pages/P51_Changelogs/P51_Changelogs';
import { P60_Export } from './pages/P60_Export/P60_Export';
import { P70_AccessControl } from './pages/P70_AccessControl/P70_AccessControl';
import { NotImplemented } from './pages/NotImplemented';

export function App() {
  return (
    <ErrorBoundary>
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
                  <Route path="/projects" element={<P02_Projects />} />
                  <Route path="/lan-config" element={<P10_LanConfig />} />
                  <Route path="/subsets" element={<P11_Subsets />} />
                  <Route path="/applications" element={<P20_Applications />} />
                  <Route path="/applications/new" element={<P21_Create />} />
                  <Route path="/applications/:id" element={<P22_Detail />} />
                  <Route path="/applications/:id/edit" element={<P21_Create />} />
                  <Route path="/frame-signal" element={<P30_FrameSignal />} />
                  <Route path="/frame-signal/subset" element={<P31_SubsetView />} />
                  <Route path="/ecu-port" element={<P40_EcuPort />} />
                  <Route path="/snapshots" element={<P50_Snapshots />} />
                  <Route path="/changelogs" element={<P51_Changelogs />} />
                  <Route path="/export" element={<P60_Export />} />
                  <Route path="/access-control" element={<P70_AccessControl />} />
                  <Route path="*" element={<NotImplemented />} />
                </Route>
              </Route>
            </Routes>
          </ProjectProvider>
        </RoleProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
