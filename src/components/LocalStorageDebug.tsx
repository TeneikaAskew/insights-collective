
// components/LocalStorageDebug.tsx
import React from 'react';
import { Button } from './ui/button';
import { LocalStorageUtils } from '../utils/localStorageUtils';

const LocalStorageDebug: React.FC = () => {
  const [items, setItems] = React.useState<{ key: string; value: string | null }[]>([]);

  const refreshItems = () => {
    const allItems = LocalStorageUtils.getAllItemsAsArray();
    setItems(allItems);
  };

  const clearResumeData = () => {
    // Replace with actual user ID from your auth context
    const userId = '47cf8181-c9a4-4cb9-8aa4-d6967e128c36';
    LocalStorageUtils.clearResumeItems(userId);
    refreshItems();
  };

  const exportData = () => {
    const data = LocalStorageUtils.exportToJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'localStorage-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  React.useEffect(() => {
    refreshItems();
  }, []);

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-lg font-bold mb-4">LocalStorage Debug</h2>
      
      <div className="flex gap-2 mb-4">
        <Button onClick={refreshItems}>Refresh</Button>
        <Button onClick={clearResumeData} variant="destructive">
          Clear Resume Data
        </Button>
        <Button onClick={exportData} variant="secondary">
          Export JSON
        </Button>
      </div>

      <div className="space-y-2">
        {items.map(({ key, value }) => (
          <div key={key} className="text-sm break-all">
            <strong>{key}:</strong> {value ? value.substring(0, 100) : 'null'}
            {value && value.length > 100 ? '...' : ''}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LocalStorageDebug;
