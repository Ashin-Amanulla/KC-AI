import { Navigate } from 'react-router-dom';

export function StandardVsForecast() {
  return <Navigate to="/forecast-analysis?tab=standard-vs-forecast" replace />;
}
