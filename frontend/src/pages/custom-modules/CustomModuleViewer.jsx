import { useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { QueryErrorState } from '../../components/QueryErrorState';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { useCustomModule } from '../../api/customModules';
import { ModuleFrameHost } from './components/ModuleFrameHost';

export function CustomModuleViewer() {
  const { slug } = useParams();
  const { data: module, isLoading, error, refetch } = useCustomModule(slug);

  if (isLoading) return <LoadingSpinner />;
  if (error || !module) return <QueryErrorState error={error} onRetry={refetch} />;

  return (
    <div className="page-stack">
      <PageHeader
        title={module.name}
        description={module.description || 'Custom tool module.'}
      />
      <ModuleFrameHost slug={module.slug} version={module.version} source={module.sourceCode} />
    </div>
  );
}
