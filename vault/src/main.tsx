import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { VaultDataProvider } from './hooks/useVaultData';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VaultDataProvider>
      <App />
    </VaultDataProvider>
  </React.StrictMode>,
);
