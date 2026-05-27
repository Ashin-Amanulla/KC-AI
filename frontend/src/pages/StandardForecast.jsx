import { Navigate } from 'react-router-dom';

export function StandardForecast() {
  return <Navigate to="/forecast-analysis?tab=templates" replace />;
}
