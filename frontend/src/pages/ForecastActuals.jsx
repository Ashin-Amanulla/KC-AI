import { Navigate } from 'react-router-dom';

export function ForecastActuals() {
  return <Navigate to="/forecast-analysis?tab=forecast-vs-actuals" replace />;
}
