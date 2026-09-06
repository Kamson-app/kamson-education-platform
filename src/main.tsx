import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';

import App from './App';

import { UserProvider } from './context/UserContext';
import { DepartmentProvider } from './context/DepartmentContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserProvider>
      <DepartmentProvider>
        <App />
      </DepartmentProvider>
    </UserProvider>
  </StrictMode>
);