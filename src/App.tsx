import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { TextField, Button, Table, Text, SelectField, TopNav, Spinner, Pagination, EmptyState, defineColumns } from '@capra/core';
import { type AppConfig, loadConfig, saveConfig, clearConfig } from './config';
import { executeSearch, cancelSearch, type SearchResult } from './api';
import { Settings } from './Settings';

interface FirewallLog {
  id: number;
  timestamp: string;
  srcIp: string;
  dstIp: string;
  srcPort: string;
  dstPort: string;
  protocol: string;
  action: string;
  rule: string;
  application: string;
  [key: string]: unknown;
}

function formatTimestamp(value: unknown): string {
  if (!value) return '';
  const v = typeof value === 'number' ? value : Number(value);
  if (!isNaN(v) && v > 1000000000) {
    const ms = v > 9999999999 ? v : v * 1000;
    return new Date(ms).toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
  }
  return String(value);
}

function CopyCell({ value, onClick }: { value: string; onClick?: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <span className={`copy-cell ${onClick ? 'copy-cell-clickable' : ''}`} title="Click to copy, double-click to filter">
      <span className="copy-cell-value" onDoubleClick={onClick}>{value}</span>
      <span className={`copy-icon ${copied ? 'copied' : ''}`} onClick={handleCopy}>
        {copied ? '✓' : '⧉'}
      </span>
    </span>
  );
}

const buildColumns = (onFilter: (field: string, value: string) => void) => defineColumns<FirewallLog>([
  { id: 'timestamp', label: 'Timestamp', render: (value) => <CopyCell value={value as string} /> },
  { id: 'srcIp', label: 'Source IP', render: (value) => <CopyCell value={value as string} onClick={() => onFilter('srcIp', value as string)} /> },
  { id: 'srcPort', label: 'Src Port', render: (value) => <CopyCell value={value as string} /> },
  { id: 'dstIp', label: 'Destination IP', render: (value) => <CopyCell value={value as string} onClick={() => onFilter('dstIp', value as string)} /> },
  { id: 'dstPort', label: 'Dst Port', render: (value) => <CopyCell value={value as string} onClick={() => onFilter('dstPort', value as string)} /> },
  { id: 'protocol', label: 'Protocol', render: (value) => <CopyCell value={value as string} onClick={() => onFilter('protocol', value as string)} /> },
  { id: 'action', label: 'Action', render: (value) => (
    <span className={`action-badge action-${value}`} onClick={() => onFilter('action', value as string)} style={{ cursor: 'pointer' }}>
      {(value as string).toUpperCase()}
    </span>
  )},
  { id: 'rule', label: 'Rule', render: (value) => <CopyCell value={value as string} /> },
  { id: 'application', label: 'Application', render: (value) => <CopyCell value={value as string} /> },
]);

const visibleColumns = ['timestamp', 'srcIp', 'srcPort', 'dstIp', 'dstPort', 'protocol', 'action', 'rule', 'application'] as Array<'timestamp' | 'srcIp' | 'srcPort' | 'dstIp' | 'dstPort' | 'protocol' | 'action' | 'rule' | 'application'>;

const actionOptions = [
  { id: 'all', label: 'All Actions' },
  { id: 'allow', label: 'Allow' },
  { id: 'deny', label: 'Deny' },
];

const protocolOptions = [
  { id: 'all', label: 'All Protocols' },
  { id: 'TCP', label: 'TCP' },
  { id: 'UDP', label: 'UDP' },
];

function getDefaultDates() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return {
    fromDate: yesterday.toISOString().slice(0, 10),
    toDate: now.toISOString().slice(0, 10),
    fromTime: yesterday.toISOString().slice(11, 19),
    toTime: now.toISOString().slice(11, 19),
  };
}

const PAGE_SIZE = 100;

function exportCsv(logs: FirewallLog[]) {
  const headers = ['Timestamp', 'Source IP', 'Src Port', 'Destination IP', 'Dst Port', 'Protocol', 'Action', 'Rule', 'Application'];
  const rows = logs.map(l => [l.timestamp, l.srcIp, l.srcPort, l.dstIp, l.dstPort, l.protocol, l.action, l.rule, l.application]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `firewall-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    loadConfig().then((c) => {
      setConfig(c);
      setConfigLoaded(true);
    });
  }, []);

  const [easterEgg, setEasterEgg] = useState(false);
  const titleClickRef = useRef(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [page, setPage] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [srcIp, setSrcIp] = useState('');
  const [dstIp, setDstIp] = useState('');
  const [dstPort, setDstPort] = useState('');
  const [action, setAction] = useState<string | null>('all');
  const [protocol, setProtocol] = useState<string | null>('all');
  const defaults = useMemo(() => getDefaultDates(), []);
  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [fromTime, setFromTime] = useState(defaults.fromTime);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [toTime, setToTime] = useState(defaults.toTime);

  const handleFilterFromCell = useCallback((field: string, value: string) => {
    if (field === 'srcIp') setSrcIp(value);
    else if (field === 'dstIp') setDstIp(value);
    else if (field === 'dstPort') setDstPort(value);
    else if (field === 'protocol') setProtocol(value === 'TCP' ? 'TCP' : value === 'UDP' ? 'UDP' : 'all');
    else if (field === 'action') setAction(value === 'allow' ? 'allow' : value === 'deny' ? 'deny' : 'all');
  }, []);

  const tableColumns = useMemo(() => buildColumns(handleFilterFromCell), [handleFilterFromCell]);

  const isConfigured = configLoaded && config !== null;

  const displayLogs: FirewallLog[] = useMemo(() => {
    return results.map((r, i) => ({
      id: i,
      timestamp: formatTimestamp(r._time ?? r.timestamp),
      srcIp: String(r.source_ip ?? r.src_ip ?? ''),
      dstIp: String(r.destination_ip ?? r.dst_ip ?? ''),
      srcPort: String(r.source_port ?? r.src_port ?? ''),
      dstPort: String(r.destination_port ?? r.dst_port ?? ''),
      protocol: String(r.protocol ?? ''),
      action: String(r.action ?? ''),
      rule: String(r.rule_name ?? r.rule ?? ''),
      application: String(r.application ?? r.app ?? ''),
    }));
  }, [results]);

  const filteredLogs = useMemo(() => {
    return displayLogs.filter((log) => {
      if (srcIp && !log.srcIp.includes(srcIp)) return false;
      if (dstIp && !log.dstIp.includes(dstIp)) return false;
      if (dstPort && !log.dstPort.includes(dstPort)) return false;
      if (action && action !== 'all' && log.action !== action) return false;
      if (protocol && protocol !== 'all' && log.protocol !== protocol) return false;
      return true;
    });
  }, [displayLogs, srcIp, dstIp, dstPort, action, protocol]);

  const pagedLogs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, page]);

  useEffect(() => { setPage(1); }, [filteredLogs.length]);

  const startTimer = useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const handleSearch = async () => {
    if (!isConfigured || !config) return;
    setSearching(true);
    setSearchError(null);
    setPage(1);
    startTimer();
    abortRef.current = new AbortController();

    const earliestEpoch = String(Math.floor(new Date(`${fromDate}T${fromTime}`).getTime() / 1000));
    const latestEpoch = String(Math.floor(new Date(`${toDate}T${toTime}`).getTime() / 1000));
    const query = config.query
      .replace('$FROM', earliestEpoch)
      .replace('$TO', latestEpoch);

    try {
      const res = await executeSearch(query, earliestEpoch, latestEpoch, abortRef.current.signal);
      setResults(res);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setSearchError(e instanceof Error ? e.message : 'Search failed');
      }
    } finally {
      setSearching(false);
      stopTimer();
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortRef.current) abortRef.current.abort();
    cancelSearch();
    setSearching(false);
    stopTimer();
  };

  const handleClear = () => {
    setSrcIp(''); setDstIp(''); setDstPort('');
    setAction('all'); setProtocol('all');
    const d = getDefaultDates();
    setFromDate(d.fromDate); setFromTime(d.fromTime);
    setToDate(d.toDate); setToTime(d.toTime);
  };

  const handleSaveConfig = async (c: AppConfig) => {
    setConfig(c);
    await saveConfig(c);
  };

  const handleClearConfig = async () => {
    setConfig(null);
    setResults([]);
    await clearConfig();
  };

  if (!configLoaded) {
    return <div className="loading-screen"><Spinner size="md" /></div>;
  }

  if (!isConfigured) {
    return (
      <div className="setup-screen">
        <EmptyState title="Configure Data Source" description="Select a Cribl Lake dataset to get started.">
          <Button variant="primary" onClick={() => setSettingsOpen(true)}>Configure</Button>
        </EmptyState>
        <Settings
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          config={config}
          onSave={handleSaveConfig}
          onClear={handleClearConfig}
        />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <TopNav>
        <TopNav.Start>
          <span className="app-title" onClick={() => {
            titleClickRef.current++;
            if (titleClickRef.current >= 5) { setEasterEgg(true); titleClickRef.current = 0; }
            setTimeout(() => { titleClickRef.current = 0; }, 2000);
          }}><Text as="span" variant="heading">Firewall Monitor</Text></span>
          <Text variant="body-xs-normal" color="secondary">{config.dataset}</Text>
        </TopNav.Start>
        <TopNav.Center>
          <div className="nav-filters">
            <TextField value={srcIp} onChange={setSrcIp} placeholder="Source IP" />
            <TextField value={dstIp} onChange={setDstIp} placeholder="Destination IP" />
            <TextField value={dstPort} onChange={setDstPort} placeholder="Port" />
            <SelectField items={actionOptions} value={action} onChange={(key) => setAction(key as string)} placeholder="Action" />
            <SelectField items={protocolOptions} value={protocol} onChange={(key) => setProtocol(key as string)} placeholder="Protocol" />
            <div className="time-picker">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="time-input" />
              <input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} step="1" className="time-input" />
              <span className="time-sep">→</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="time-input" />
              <input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} step="1" className="time-input" />
            </div>
            {!searching ? (
              <Button variant="primary" onClick={handleSearch}>Search</Button>
            ) : (
              <Button variant="secondary" appearance="danger" onClick={handleStop}>Stop</Button>
            )}
            <Button variant="secondary" onClick={handleClear}>Clear</Button>
          </div>
        </TopNav.Center>
        <TopNav.End>
          <Button variant="secondary" onClick={() => exportCsv(filteredLogs)} disabled={filteredLogs.length === 0}>Export</Button>
          <Button variant="secondary" onClick={() => setSettingsOpen(true)}>Configure</Button>
        </TopNav.End>
      </TopNav>

      <div className="content">
        {searchError && <div className="search-error"><Text variant="body-sm-normal" color="warning">{searchError}</Text></div>}
        <div className="results-bar">
          <div className="results-info">
            {searching && <Spinner size="sm" />}
            <Text variant="body-sm-semibold" color="secondary">
              {searching ? `Searching... ${elapsed}s` : `${filteredLogs.length} results`}
            </Text>
            {!searching && elapsed > 0 && (
              <Text variant="body-xs-normal" color="secondary">({elapsed}s)</Text>
            )}
          </div>
          {filteredLogs.length > PAGE_SIZE && (
            <Pagination
              aria-label="Results pagination"
              total={filteredLogs.length}
              current={page}
              pageSize={PAGE_SIZE}
              onChange={(p) => setPage(p)}
            />
          )}
        </div>
        <div className="results-panel">
          {results.length > 0 ? (
            <Table
              aria-label="Firewall logs"
              columns={tableColumns}
              items={pagedLogs}
              visibleColumns={visibleColumns}
              density="compact"
              isLoading={searching}
            />
          ) : (
            !searching && <EmptyState title="No results" description="Click Search to query your firewall logs." size="md" />
          )}
        </div>
      </div>

      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        onSave={handleSaveConfig}
        onClear={handleClearConfig}
      />

      {easterEgg && <PacketGame onClose={() => setEasterEgg(false)} />}
    </div>
  );
}

function PacketGame({ onClose }: { onClose: () => void }) {
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState(0);
  const [packets, setPackets] = useState<Array<{ id: number; x: number; y: number; bad: boolean }>>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const spawn = setInterval(() => {
      setPackets(p => [...p, {
        id: nextId.current++,
        x: Math.random() * 280,
        y: -20,
        bad: Math.random() > 0.3,
      }]);
    }, 800);

    const tick = setInterval(() => {
      setPackets(p => {
        const alive: typeof p = [];
        let newMissed = 0;
        for (const pkt of p) {
          const next = { ...pkt, y: pkt.y + 3 };
          if (next.y > 300) {
            if (next.bad) newMissed++;
          } else {
            alive.push(next);
          }
        }
        if (newMissed > 0) setMissed(m => m + newMissed);
        return alive;
      });
    }, 30);

    return () => { clearInterval(spawn); clearInterval(tick); };
  }, []);

  const handleClick = (id: number, bad: boolean) => {
    if (bad) setScore(s => s + 1);
    else setScore(s => s - 2);
    setPackets(p => p.filter(pkt => pkt.id !== id));
  };

  const gameOver = missed >= 5;

  return (
    <div className="game-overlay" onClick={gameOver ? onClose : undefined}>
      <div className="game-container" onClick={e => e.stopPropagation()}>
        <div className="game-header">
          <span>Block the bad packets! (red = block, green = let pass)</span>
          <button className="game-close" onClick={onClose}>✕</button>
        </div>
        <div className="game-score">
          Score: {score} | Missed: {missed}/5
        </div>
        {gameOver ? (
          <div className="game-over">
            <div className="game-over-text">FIREWALL BREACHED</div>
            <div>Final score: {score}</div>
            <button className="game-restart" onClick={() => { setScore(0); setMissed(0); setPackets([]); }}>Play Again</button>
          </div>
        ) : (
          <div className="game-field">
            {packets.map(p => (
              <div
                key={p.id}
                className={`game-packet ${p.bad ? 'game-packet-bad' : 'game-packet-good'}`}
                style={{ left: p.x, top: p.y }}
                onClick={() => handleClick(p.id, p.bad)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
