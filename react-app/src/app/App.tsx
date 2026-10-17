import { RouterProvider } from 'react-router-dom';
import { router } from '../routes/routeConfig';
import { Providers } from './providers';

/**
 * Main App Component
 * 
 * Provides routing and global providers for the application.
 */
export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
