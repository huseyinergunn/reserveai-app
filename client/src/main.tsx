import React from 'react';
import ReactDOM from 'react-dom/client';
import { PortalPage }      from './components/screens/PortalPage';
import { LandingPage }     from './components/screens/LandingPage';
import { ApprovalPage }    from './components/screens/ApprovalPage';
import { AdminLogin }      from './components/screens/AdminLogin';
import { AdminDashboard }  from './components/screens/AdminDashboard';
import { PrivacyPage }     from './components/screens/PrivacyPage';
import './index.css';

// ---------------------------------------------------------------------------
// Path-based routing — no React Router needed.
//
//   /                 → PortalPage   (giriş portalı — rol seçimi)
//   /randevu          → LandingPage  (müşteri: randevu al + sorgula)
//   /approve/:token   → ApprovalPage (e-posta onay linki)
//   /admin/login      → AdminLogin
//   /admin            → AdminLogin   (shortcut)
//   /admin/dashboard  → AdminDashboard (session-gated)
//   /gizlilik         → PrivacyPage  (gizlilik politikası)
// ---------------------------------------------------------------------------

const path          = window.location.pathname;
const approvalMatch = path.match(/^\/approve\/([^/]+)$/);

function resolveRoute(): React.ReactElement {
  if (approvalMatch)               return <ApprovalPage token={approvalMatch[1]} />;
  if (path === '/admin/dashboard') return <AdminDashboard />;
  if (path.startsWith('/admin'))   return <AdminLogin />;
  if (path === '/randevu')         return <LandingPage />;
  if (path === '/gizlilik')        return <PrivacyPage />;
  return <PortalPage />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {resolveRoute()}
  </React.StrictMode>,
);
