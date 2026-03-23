import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock(
  'react-router-dom',
  () => ({
    BrowserRouter: ({ children }) => <div>{children}</div>,
    Routes: ({ children }) => <div>{children}</div>,
    Route: ({ element }) => element,
    Navigate: ({ to }) => <div>Navigate to {to}</div>,
    useNavigate: () => jest.fn(),
  }),
  { virtual: true }
);

jest.mock('./pages/Home', () => () => <div>Home Page</div>);
jest.mock('./pages/Booking', () => () => <div>Booking Page</div>);
jest.mock('./pages/Admin', () => () => <div>Admin Page</div>);
jest.mock('./pages/ProtectedAdmin', () => ({ children }) => <div>{children}</div>);

test('renders configured route components', () => {
  render(<App />);
  expect(screen.getByText('Home Page')).toBeInTheDocument();
  expect(screen.getByText('Booking Page')).toBeInTheDocument();
  expect(screen.getByText('Admin Page')).toBeInTheDocument();
});
