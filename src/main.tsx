import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppQueryProvider } from './app/providers/AppQueryProvider';
import { AuthenticationProvider } from './app/providers/AuthenticationProvider';
import { getVehicleUseCases } from './app/vehicleComposition';
import { VehicleProvider } from './features/vehicles/VehicleProvider';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Application root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppQueryProvider>
      <BrowserRouter>
        <AuthenticationProvider>
          <VehicleProvider operations={getVehicleUseCases()}>
            <App />
          </VehicleProvider>
        </AuthenticationProvider>
      </BrowserRouter>
    </AppQueryProvider>
  </StrictMode>,
);
