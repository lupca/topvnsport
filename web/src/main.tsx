import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import SystemPopupProvider from './components/ui/SystemPopupProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemPopupProvider>
      <App />
    </SystemPopupProvider>
  </StrictMode>,
);
