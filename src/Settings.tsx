import { useState, useEffect } from 'react';
import { Drawer, TextField, Button, Text, TextArea, SelectField, Spinner } from '@capra/core';
import { type AppConfig, buildDefaultQuery } from './config';
import { fetchDatasets } from './api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  onSave: (config: AppConfig) => void | Promise<void>;
  onClear: () => void;
}

export function Settings({ isOpen, onClose, config, onSave, onClear }: Props) {
  const [dataset, setDataset] = useState(config?.dataset ?? '');
  const [query, setQuery] = useState(config?.query ?? '');

  const [datasets, setDatasets] = useState<{ id: string; label: string }[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDataset(config?.dataset ?? '');
      setQuery(config?.query ?? '');
      setApiError(null);
      loadDatasets();
    }
  }, [isOpen, config]);

  useEffect(() => {
    if (dataset && !config) {
      setQuery(buildDefaultQuery(dataset));
    }
  }, [dataset, config]);

  async function loadDatasets() {
    setLoadingDatasets(true);
    try {
      const items = await fetchDatasets();
      setDatasets(items.map(d => ({ id: d.id, label: d.description ? `${d.id} — ${d.description}` : d.id })));
      setApiError(null);
    } catch {
      setApiError('Could not load datasets. Are you running inside Cribl Cloud?');
      setDatasets([]);
    } finally {
      setLoadingDatasets(false);
    }
  }

  const handleSave = () => {
    if (!dataset) return;
    const finalQuery = query || buildDefaultQuery(dataset);
    onSave({ dataset, query: finalQuery });
    onClose();
  };

  const handleReset = () => {
    onClear();
    setDataset('');
    setQuery('');
    onClose();
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Data Source"
      width={600}
    >
      <div className="settings-content">
        {apiError && (
          <div className="settings-error">
            <Text variant="body-sm-normal" color="warning">{apiError}</Text>
          </div>
        )}

        <div className="settings-section">
          <Text variant="heading-sm">Dataset</Text>
          {loadingDatasets ? (
            <Spinner size="sm" />
          ) : datasets.length > 0 ? (
            <SelectField
              label="Dataset"
              items={datasets}
              value={dataset || null}
              onChange={(key) => {
                const d = key as string;
                setDataset(d);
                setQuery(buildDefaultQuery(d));
              }}
              placeholder="Select a dataset..."
            />
          ) : (
            <TextField
              label="Dataset Name"
              value={dataset}
              onChange={(d) => {
                setDataset(d);
                setQuery(buildDefaultQuery(d));
              }}
              placeholder="e.g. palo-logs"
            />
          )}
        </div>

        <div className="settings-section">
          <Text variant="heading-sm">Search Query</Text>
          <Text variant="body-sm-normal" color="secondary">
            KQL query executed when you click Search. Edit to add filters, projections, or custom logic.
          </Text>
          <TextArea
            label="KQL Query"
            value={query}
            onChange={setQuery}
            autoSize={{ minRows: 8, maxRows: 20 }}
          />
        </div>

        <div className="settings-footer">
          {config && <Button variant="secondary" appearance="danger" onClick={handleReset}>Reset</Button>}
          <div className="settings-footer-right">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={!dataset}>Save</Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
