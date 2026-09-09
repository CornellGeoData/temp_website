import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { RESIPLE, MANTI } from '../../styles/theme';
import SensorMap from './SensorMap';
import { VisualizationList } from './VisualizationList';
import WeatherForecast from './WeatherForecast';
import ViewLauncher from './ViewLauncher';
import type { ViewId } from '../../data/visualizations';
import {
  AIR, SOIL, WEATHER, EGGS, SOILMOTES, ARCHIVE, RETIRED, NEWA_STATIONS, RANGES,
  eggSeries, newaSeries, eggTable, soilTable, newaTable, downloadCsv, fmtTime, thin, clip, dm,
  type MapSite, type SensorPoint, type SensorTable, type TimeRange,
} from './sensorData';
import { SensorChart, SoilCharts, WeatherCharts, EggCharts } from './SensorCharts';

// square utility button, shared by the card headers and the static sheet
const BTN: CSSProperties = { appearance: 'none', cursor: 'pointer', padding: '5px 11px', border: '1px solid rgba(255,255,255,0.22)', background: 'transparent', color: '#a9bcc6', fontFamily: RESIPLE, fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 };

// empty state for a window with no samples; the page only fetches on load
const OFFLINE = 'No readings came back for this window. Reload the page to try again.';

// hard minimums the corner grip can shrink to (one chart plate exactly)
const EGG_MIN = { w: 420, h: 309 };

const SOIL_MIN = { w: 420, h: 309 };

// opening sizes: two charts wide, two tall, so a card lands showing four
// plates - for the eggs that's AQI, PM2.5, CO2, and Temperature
const EGG_OPEN = { w: 700, h: 580 };

const SOIL_OPEN = { w: 700, h: 560 };

// retired probes carry a single lifetime plate - one-chart height, just wide
// enough that the header row (name, coords, buttons) fits untruncated
const RET_OPEN = { w: 500, h: 309 };

// the static sheet's tabs wear their family's tone
const TAB_TONE = { air: AIR, soil: SOIL, weather: WEATHER } as const;

export function VisualizationsPage() {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error' } | { status: 'ready'; raw: Record<string, unknown> }
  >({ status: 'loading' });
  const [unit, setUnit] = useState<'C' | 'F'>('F');
  // stages come from the hash: #/sensors/<map|air|soil|weather|forecast|lidar>.
  // Bare #/sensors is the landing page
  const stageFromHash = () => window.location.hash.split('/')[2];
  const [mapView, setMapView] = useState(() => stageFromHash() === 'map');
  // the globe is the whole page; readings exist only for picked sensors.
  // Several can be open at once - each gets its own floating card.
  const [open, setOpen] = useState<string[]>([]);
  // phones run the same stages; isMobile only reshapes the chrome (insets,
  // the bottom-sheet card) rather than forking the page
  const [isMobile] = useState(() => window.matchMedia('(max-width: 720px)').matches);
  // the page footer goes away under a full-screen stage - scrolling onto it
  // reads as jarring. It lives in App, so it's toggled directly.
  // the static sheet: the pre-globe sensors page (Air Quality / Soil Moisture
  // tabs, every chart with its lifetime twin) laid over the map stage. Holds
  // the open tab, or null while closed.
  const tabFromHash = () => { const t = stageFromHash(); return t === 'air' || t === 'soil' || t === 'weather' ? t : null; };
  const [staticView, setStaticView] = useState<'air' | 'soil' | 'weather' | null>(tabFromHash);
  // the forecast stage: regional weather maps over a light basemap, fed by the
  // lab's render pipeline. A full-screen sheet like staticView.
  const [forecastView, setForecastView] = useState(stageFromHash() === 'forecast');
  const [lidarView, setLidarView] = useState(stageFromHash() === 'lidar');
  const lidarFrame = useRef<HTMLIFrameElement>(null);
  // the landing's links change the hash without remounting this page
  useEffect(() => {
    const onHash = () => {
      setMapView(stageFromHash() === 'map');
      setStaticView(tabFromHash());
      setForecastView(stageFromHash() === 'forecast');
      setLidarView(stageFromHash() === 'lidar');
      setOpen([]);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const home = !mapView && !staticView && !forecastView && !lidarView;
  useEffect(() => {
    if (home) return;
    const f = document.getElementById('partners');
    if (f) f.style.display = 'none';
    return () => { if (f) f.style.display = ''; };
  }, [home]);
  // a card's "Show all data" lands on that sensor's section, not the sheet top
  const [staticFocus, setStaticFocus] = useState<string | null>(null);
  const openStatic = (id: string) => {
    setStaticView(EGGS.some((e) => e.id === id) ? 'air' : NEWA_STATIONS.some((s) => s.id === id) ? 'weather' : 'soil');
    setStaticFocus(id);
  };
  useEffect(() => {
    if (!staticView || !staticFocus) return;
    document.getElementById(`static-${staticFocus}`)?.scrollIntoView({ block: 'start' });
    // scrollIntoView also drags the window; the sheet owns the scrolling
    window.scrollTo(0, 0);
    setStaticFocus(null);
  }, [staticView, staticFocus]);
  // the static sheet's time window
  const [range, setRange] = useState<TimeRange>('month');
  // the fixed site header stays for the globe stage and slides away while the
  // imagery (and the static sheet over it) has the screen. It lives in App,
  // so it's styled directly.
  // ...but peeks back while the mouse sits at the top edge, for navigation.
  // The charts sheet is a page, not a map, so it keeps the header outright
  const headerHidden = !staticView && (mapView || forecastView || lidarView);
  const [headerPeek, setHeaderPeek] = useState(false);
  useEffect(() => {
    if (!headerHidden) { setHeaderPeek(false); return; }
    const updatePeek = (y: number) => {
      const h = (header?.offsetHeight ?? 100) + (header?.querySelector<HTMLElement>('.nav-menu')?.offsetHeight ?? 0);
      setHeaderPeek((p) => (y < 12 ? true : y > h + 24 ? false : p));
    };
    const onMove = (e: MouseEvent) => updatePeek(e.clientY);
    // Pointer events inside the LiDAR iframe do not bubble to the site window.
    const frame = lidarFrame.current;
    let frameWindow: Window | null = null;
    const onFrameMove = (e: MouseEvent) => updatePeek(e.clientY + (frame?.getBoundingClientRect().top ?? 0));
    const detachFrame = () => {
      frameWindow?.removeEventListener('mousemove', onFrameMove);
      frameWindow?.removeEventListener('pointerdown', onFrameMove);
    };
    const attachFrame = () => {
      detachFrame();
      frameWindow = frame?.contentWindow ?? null;
      frameWindow?.addEventListener('mousemove', onFrameMove);
      frameWindow?.addEventListener('pointerdown', onFrameMove);
    };
    const header = document.querySelector<HTMLElement>('.site-header');
    const onHeaderFocus = () => setHeaderPeek(true);
    window.addEventListener('mousemove', onMove);
    header?.addEventListener('focusin', onHeaderFocus);
    frame?.addEventListener('load', attachFrame);
    attachFrame();
    return () => {
      window.removeEventListener('mousemove', onMove);
      header?.removeEventListener('focusin', onHeaderFocus);
      frame?.removeEventListener('load', attachFrame);
      detachFrame();
    };
  }, [headerHidden, lidarView]);
  useEffect(() => {
    const bar = document.querySelector('.site-header')?.parentElement as HTMLElement | null;
    if (!bar) return;
    bar.style.transition = 'transform 300ms ease';
    bar.style.transform = headerHidden && !headerPeek ? 'translateY(-100%)' : 'translateY(0)';
    // Close the header menu without firing the stage's hash navigation listener.
    if (headerHidden && !headerPeek) window.dispatchEvent(new Event('geodata:hide-header'));
    return () => {
      bar.style.transition = '';
      bar.style.transform = '';
    };
  }, [headerHidden, headerPeek]);
  // reflect the current stage into the hash so refresh and copied links land
  // where the reader was (replaceState fires no hashchange, so no loop)
  useEffect(() => {
    const stage = staticView ?? (lidarView ? 'lidar' : forecastView ? 'forecast' : mapView ? 'map' : null);
    history.replaceState(null, '', stage ? `#/sensors/${stage}` : '#/sensors');
  }, [mapView, staticView, forecastView, lidarView]);
  // clicking a dot toggles its card: open sensors close on a re-click. On
  // mobile only one sheet fits, so a pick replaces instead of stacking.
  const pick = (id: string | null) => {
    if (id === null) setOpen([]);
    else if (isMobile) setOpen((o) => (o.includes(id) ? [] : [id]));
    else setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  };
  const close = (id: string) => setOpen((o) => o.filter((x) => x !== id));
  // every probe on one globe - the air/soil split is carried by the pin colour
  // rather than by a tab, so the network reads as one network
  const sites: MapSite[] = useMemo(() => [
    ...EGGS.map((e) => ({ id: e.id, name: e.name, sub: e.location, tone: AIR, ...dm(e.coords) })),
    ...SOILMOTES.map((m) => ({ id: m.id, name: m.name, sub: m.location, tone: SOIL, ...dm(m.coords) })),
    ...RETIRED.map((r) => ({ id: r.name, name: r.name, sub: `Retired ${r.to}`, tone: SOIL, retired: true, labelBelow: r.labelBelow, ...dm(r.coords) })),
    ...NEWA_STATIONS.map((s) => ({ id: s.id, name: s.name, sub: s.location, tone: WEATHER, lat: s.lat, lon: s.lon })),
  ], []);
  const [soil, setSoil] = useState<
    { status: 'loading' } | { status: 'error' } | { status: 'ready'; raw: Record<string, unknown> }
  >({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    const url =
      `https://zynect.com/api/v2/messages/device/${SOILMOTES.map((m) => m.id).join(',')}` +
      `?dur=P1M&end-date=${new Date().toISOString()}&reduced=1&grouped=1`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw) => alive && setSoil({ status: 'ready', raw: (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown> }))
      .catch(() => alive && setSoil({ status: 'error' }));
    return () => {
      alive = false;
    };
  }, []);

  // NEWA stations, one POST each - absent id = still fetching, [] = offline.
  // station-local (NY) YYYYMMDDHH; the API rejects an edate past the current hour
  const stamp = (t: number) => new Date(t).toLocaleString('sv', { timeZone: 'America/New_York' }).replace(/\D/g, '').slice(0, 10);
  const loadWx = (sdate: string, set: React.Dispatch<React.SetStateAction<Record<string, { key: string; points: SensorPoint[] }[]>>>, aliveRef: { current: boolean }) => NEWA_STATIONS.forEach((st) => {
    fetch('https://hrly.nrcc.cornell.edu/stnHrly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid: st.sid, sdate, edate: stamp(Date.now()) }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw) => aliveRef.current && set((m) => ({ ...m, [st.id]: newaSeries(raw) })))
      .catch(() => aliveRef.current && set((m) => ({ ...m, [st.id]: [] })));
  });
  const [wx, setWx] = useState<Record<string, { key: string; points: SensorPoint[] }[]>>({});
  useEffect(() => {
    const alive = { current: true };
    loadWx(stamp(Date.now() - 31 * 86_400_000), setWx, alive);
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Lifetime is a set 5 years of hourly rows - ~4MB per station uncompressed,
  // so the archive fetch waits until someone actually picks Lifetime on the
  // weather tab, then runs once; charts show the month feed until it lands.
  // The server proxy keeps the bundle warm and gzipped (~2MB for all five
  // stations vs ~20MB straight from NRCC), so it lands in seconds.
  const [wxLife, setWxLife] = useState<Record<string, { key: string; points: SensorPoint[] }[]>>({});
  const wxLifeStarted = useRef(false);
  useEffect(() => {
    if (staticView !== 'weather' || range !== 'life' || wxLifeStarted.current) return;
    wxLifeStarted.current = true;
    const alive = { current: true };
    fetch('/api/wx-lifetime')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw) => alive.current && setWxLife(Object.fromEntries(
        NEWA_STATIONS.map((st) => [st.id, newaSeries((raw as Record<string, unknown>)[st.id])]),
      )))
      // no proxy running (plain vite dev): pull each station straight from NRCC
      .catch(() => loadWx(stamp(Date.now() - 5 * 365 * 86_400_000), setWxLife, alive));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticView, range]);

  const [soilLife, setSoilLife] = useState<Record<string, unknown>>({});
  useEffect(() => {
    let alive = true;
    // the lifetime archive takes Zynect ~a minute to assemble, so it comes through
    // the server proxy (long cache) and the charts pop in when it lands
    fetch('/api/soil-lifetime')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .catch(() => {
        // no proxy running (plain vite dev): fetch the slow archive straight from
        // Zynect. Takes upstream ~a minute; the chart pops in when it lands.
        const url =
          `https://zynect.com/api/v2/messages/device/${SOILMOTES.map((m) => m.id).join(',')}` +
          `?dur=P2Y&end-date=${new Date().toISOString()}&reduced=1&grouped=1`;
        return fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
      })
      .then((raw) => alive && setSoilLife((raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/api/aqi')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw) => alive && setState({ status: 'ready', raw: (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown> }))
      .catch(() => alive && setState({ status: 'error' }));
    return () => {
      alive = false;
    };
  }, []);

  // The eggs' year-long archive for the history charts.
  const [eggLife, setEggLife] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/aqi-lifetime')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw) => alive && setEggLife((raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>))
      .catch(() => alive && setEggLife({}));
    return () => {
      alive = false;
    };
  }, []);

  // parsing the multi-MB feed is expensive - do it once per fetch, not per render
  const parsed = useMemo(
    () => Object.fromEntries(EGGS.map((egg) => [egg.id, state.status === 'ready' ? eggSeries(state.raw[egg.id]) : []])),
    [state],
  );
  const soilParsed = useMemo(
    () => Object.fromEntries(SOILMOTES.map((m) => [m.id, soil.status === 'ready' ? eggSeries(soil.raw[m.id]) : []])),
    [soil],
  );
  const soilLifeParsed = useMemo(
    () => Object.fromEntries(SOILMOTES.map((m) => [m.id, eggSeries(soilLife[m.id])])),
    [soilLife],
  );
  const eggLifeParsed = useMemo(
    () => Object.fromEntries(EGGS.map((egg) => [egg.id, eggLife ? eggSeries(eggLife[egg.id]) : []])),
    [eggLife],
  );

  // everything one sensor's card (or the mobile panel) needs, from its id -
  // several cards can be open at once, so this cannot live in page-level consts
  const deriveFor = (id: string | null) => {
    const site = sites.find((x) => x.id === id) ?? null;
    const egg = EGGS.find((e) => e.id === id) ?? null;
    const mote = SOILMOTES.find((m) => m.id === id) ?? null;
    const ret = RETIRED.find((r) => r.name === id) ?? null;
    const wxSt = NEWA_STATIONS.find((s) => s.id === id) ?? null;
    const accent = ret || mote ? SOIL : wxSt ? WEATHER : AIR;
    // decimal degrees read cleaner than the field notebook's DDM strings
    const metaLines = site
      ? [`${Math.abs(site.lat).toFixed(2)}° ${site.lat >= 0 ? 'N' : 'S'}, ${Math.abs(site.lon).toFixed(2)}° ${site.lon >= 0 ? 'E' : 'W'}`]
      : [];
    // last report time + liveness, shown in the card header
    let status: { live: boolean; t: number } | null = null;
    if (egg) {
      const ss = parsed[egg.id];
      if (ss.length) {
        const newest = Math.max(...ss.map((s) => s.points[s.points.length - 1].t));
        status = { live: Date.now() - newest < 45 * 60_000, t: newest };
      }
    } else if (mote) {
      const pts = soilParsed[mote.id].find((x) => x.key === 'soilmoisture')?.points.filter((q) => q.v !== 0);
      // ~30 min LoRa cadence, 2 missed reports = offline
      if (pts?.length) status = { live: Date.now() - pts[pts.length - 1].t < 75 * 60_000, t: pts[pts.length - 1].t };
    } else if (wxSt) {
      const ss = wx[wxSt.id];
      if (ss?.length) {
        const newest = Math.max(...ss.map((s) => s.points[s.points.length - 1].t));
        // NRCC serves hourly with a 1-2 h lag, so 3 h of silence = offline
        status = { live: Date.now() - newest < 3 * 3600_000, t: newest };
      }
    }
    const readings = !site ? null : (
      <>
        {egg && (
          state.status === 'loading' ? <Note>Contacting the egg&hellip;</Note>
          : parsed[egg.id].length === 0 ? <Note>{OFFLINE}</Note>
          : <EggCharts series={parsed[egg.id]} unit={unit} />
        )}
        {mote && (() => {
          // 0% is a non-reading (probe out of soil), not data
          const pts = soilParsed[mote.id].find((x) => x.key === 'soilmoisture')?.points.filter((q) => q.v !== 0);
          return soil.status === 'loading' ? <Note>Contacting the probe&hellip;</Note>
            : !pts || pts.length < 2 ? <Note>{OFFLINE}</Note>
            : <SoilCharts points={pts} lifetime={soilLifeParsed[mote.id].find((x) => x.key === 'soilmoisture')?.points.filter((q) => q.v !== 0 && q.t >= mote.lifeFrom)} />;
        })()}
        {ret && <SensorChart label="Lifetime" unit="% VWC" points={ARCHIVE[ret.name]} y0={0} minSpan={20} />}
        {wxSt && (() => {
          // the floating card answers "what's it like out": the last day, with
          // the full month behind Show all data
          const day = wxSeriesFor(wxSt.id, 'day');
          return !(wxSt.id in wx) ? <Note>Contacting the station&hellip;</Note>
            : day.length === 0 ? <Note>{OFFLINE}</Note>
            : <WeatherCharts series={day} unit={unit} />;
        })()}
      </>
    );
    return { site, accent, metaLines, readings, isEgg: !!egg, status };
  };

  // one egg's series at a time window: the day feed is densest for Day, the
  // year archive for everything longer; each falls back to the other while
  // its fetch is still out
  const eggSeriesFor = (id: string, r: TimeRange) => {
    const life = eggLifeParsed[id];
    const day = parsed[id];
    const src = r === 'day' ? (day.length ? day : life) : (life.length ? life : day);
    return src.map((s) => ({ key: s.key, points: clip(s.points, r) })).filter((s) => s.points.length > 1);
  };
  // one mote's soilmoisture points at a window (0% is a non-reading, not data)
  const soilPtsFor = (id: string, r: TimeRange) => {
    const mote = SOILMOTES.find((m) => m.id === id)!;
    const month = soilParsed[id].find((x) => x.key === 'soilmoisture')?.points.filter((q) => q.v !== 0) ?? [];
    if (r !== 'life') return clip(month, r);
    const life = soilLifeParsed[id].find((x) => x.key === 'soilmoisture')?.points.filter((q) => q.v !== 0 && q.t >= mote.lifeFrom);
    return life?.length ? life : month;
  };

  // one station's channels at a window; Lifetime uses the 5-year archive,
  // falling back to the month feed while that fetch is still out
  const wxSeriesFor = (id: string, r: TimeRange) => {
    const src = r === 'life' && wxLife[id]?.length ? wxLife[id] : wx[id];
    return (src ?? []).map((s) => ({ key: s.key, points: clip(s.points, r) })).filter((s) => s.points.length > 1);
  };

  // all of one sensor's data as rows at a window - feeds the log and the CSV
  const tableFor = (id: string, r: TimeRange): { name: string; table: SensorTable } | null => {
    const s = sites.find((x) => x.id === id);
    if (!s) return null;
    let table: SensorTable | null = null;
    if (EGGS.some((e) => e.id === id)) table = eggTable(eggSeriesFor(id, r), unit);
    else if (SOILMOTES.some((m) => m.id === id)) table = soilTable(soilPtsFor(id, r));
    else if (NEWA_STATIONS.some((s) => s.id === id)) table = newaTable(wxSeriesFor(id, r), unit);
    // retired probes are all history - the window doesn't apply
    else if (RETIRED.some((x) => x.name === id)) table = soilTable(ARCHIVE[id]);
    return table ? { name: s.name, table } : null;
  };
  const download = (id: string, r: TimeRange = range) => {
    const t = tableFor(id, r);
    if (t) downloadCsv(r === 'life' ? t.name : `${t.name} ${r}`, t.table);
  };

  // ---- the globe is the page; each open sensor floats its own card
  // (desktop) or docks as a bottom sheet over the imagery (mobile) ----
  const cardFor = (id: string) => {
    const d = deriveFor(id);
    if (!d.site) return null;
    const size = d.site.retired ? RET_OPEN : d.isEgg ? EGG_OPEN : SOIL_OPEN;
    return (
      <div style={{
        // opens showing four plates (one for retired probes) and the corner
        // grip resizes it to taste; the drag handle is the header bar
        width: size.w, height: size.h,
        maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100dvh - 120px)', display: 'flex', flexDirection: 'column',
        // native corner grip: the card resizes and the charts remeasure to fit
        resize: 'both', overflow: 'hidden', minWidth: (d.isEgg ? EGG_MIN : SOIL_MIN).w, minHeight: (d.isEgg ? EGG_MIN : SOIL_MIN).h,
        // the bottom sheet: full width, map still visible above, no grip
        // the sheet hugs its content and never takes more than 45dvh, so the
        // map stays visible above
        ...(isMobile && { width: '100%', maxWidth: '100%', minWidth: 0, height: 'auto', maxHeight: '45dvh', minHeight: 0, resize: 'none' as const }),
        background: 'rgba(16,23,32,0.95)', backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
      }}>
        <div data-drag-handle style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.09)', cursor: 'grab', userSelect: 'none', touchAction: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 21, letterSpacing: '-0.015em', margin: 0, whiteSpace: 'nowrap', flexShrink: 0 }}>{d.site.name}</h3>
            {/* coords and last-updated ride the title's row, one line; on a
                shrunk card the coords give way first, never the buttons */}
            <span style={{ fontFamily: RESIPLE, fontSize: 11.5, letterSpacing: '0.06em', color: '#7c909b', whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.metaLines[0]}</span>
            {d.status && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: RESIPLE, fontSize: 11.5, color: d.status.live ? '#4fae7d' : '#7c909b', whiteSpace: 'nowrap' }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: d.status.live ? '#4fae7d' : '#5f7078' }} />
                {fmtTime(d.status.t)}
              </span>
            )}
            <span style={{ flex: 1 }} />
            <button onClick={() => openStatic(id)} style={BTN}>Show all data</button>
            <button onClick={() => close(id)} aria-label="Close readings" style={{ appearance: 'none', cursor: 'pointer', width: 26, height: 26, lineHeight: 1, flexShrink: 0, border: '1px solid rgba(255,255,255,0.22)', background: 'transparent', color: '#a9bcc6', fontFamily: RESIPLE, fontSize: 14 }}>
              &times;
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>{d.readings}</div>
      </div>
    );
  };
  const cards = open.flatMap((id) => {
    const node = cardFor(id);
    return node ? [{ id, node }] : [];
  });

  // the launcher's destinations. Switching stages is a fresh start: any open
  // sensor cards close too
  const currentStage: ViewId = staticView ? 'charts' : lidarView ? 'lidar' : forecastView ? 'forecast' : mapView ? 'map' : 'home';
  const goStage = (id: ViewId) => {
    setOpen([]);
    setStaticView(id === 'charts' ? 'air' : null);
    setForecastView(id === 'forecast');
    setLidarView(id === 'lidar');
    setMapView(id === 'map');
  };

  if (home) return <VisualizationList />;

  return (
    <section style={{ position: 'relative', zIndex: 2, background: '#0e141c', height: '100dvh', overflow: 'hidden' }}>
      {/* the map has the full screen; the header lives above it (z 50) and
          slides in only when summoned to the top edge */}
      {/* zIndex 0 makes this a stacking context, so the cards' ever-growing
          bring-to-front z-indexes can never climb over the page chrome or the
          tabular sheet */}
      {mapView && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <SensorMap sites={sites} selectedIds={open} onSelect={pick} cards={cards} />
        </div>
      )}
      {/* one temperature unit for every card, parked beside Back - white on
          the imagery so it reads at a glance */}
      {mapView && (
        // phones: the launcher drops to a second row, so the bar takes the corner
        <div style={{ position: 'absolute', top: 24, right: isMobile ? 24 : 66, zIndex: 4, display: 'flex', gap: 10 }}>
          <span style={{
            display: 'inline-flex',
            border: '1px solid #ffffff', overflow: 'hidden',
            background: 'rgba(14,20,28,0.72)', backdropFilter: 'blur(6px)',
          }}>
            {(['F', 'C'] as const).map((u) => (
              // height pinned so the bar sits exactly as tall as the launcher beside it
              <button key={u} onClick={() => setUnit(u)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 13px', fontFamily: RESIPLE, fontSize: 12, letterSpacing: '0.1em', background: unit === u ? '#ffffff' : 'transparent', color: unit === u ? '#0e141c' : '#ffffff' }}>
                &deg;{u}
              </button>
            ))}
          </span>
        </div>
      )}
      {/* ---- the static sheet: the pre-globe sensors page over the stage ---- */}
      {staticView && (
        // top padding clears the fixed site header, which stays for this sheet
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: '#0e141c', overflowY: 'auto', padding: `${((document.querySelector('.site-header') as HTMLElement | null)?.offsetHeight ?? 102) + 26}px clamp(16px,5vw,48px) 96px` }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            {/* one line, even at 390px: unlabeled dropdowns (Month / °F speak
                for themselves), compact tabs, launcher on the right */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: isMobile ? 6 : 12 }}>
              <div style={{ display: 'inline-flex', border: `2px solid ${TAB_TONE[staticView]}`, overflow: 'hidden' }}>
                {([['air', isMobile ? 'AQ Egg' : 'Air Quality'], ['weather', 'Weather'], ['soil', isMobile ? 'Soil' : 'Soil Moisture']] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setStaticView(id)} style={{ appearance: 'none', border: 'none', cursor: 'pointer', padding: isMobile ? '9px 9px' : '10px 14px', fontFamily: RESIPLE, fontSize: isMobile ? 11 : 13, letterSpacing: isMobile ? '0.06em' : '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap', background: staticView === id ? TAB_TONE[id] : 'transparent', color: staticView === id ? '#0e141c' : '#7c909b' }}>
                    {label}
                  </button>
                ))}
              </div>
              <span style={{ flex: 1 }} />
              {/* the °C/°F pick leads the cluster; it applies to the egg and
                  weather panels, so it sits out the soil tab */}
              {staticView !== 'soil' && (
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as 'C' | 'F')}
                  style={{ appearance: 'none', cursor: 'pointer', height: 33, padding: isMobile ? '0 8px' : '0 14px', border: '1px solid rgba(255,255,255,0.22)', background: '#141c26', color: '#e6ecf0', fontFamily: RESIPLE, fontSize: 12.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}
                >
                  {(['F', 'C'] as const).map((u) => <option key={u} value={u}>&deg;{u}</option>)}
                </select>
              )}
              {/* the window every chart and Download share */}
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as TimeRange)}
                style={{ appearance: 'none', cursor: 'pointer', height: 33, padding: isMobile ? '0 8px' : '0 14px', border: '1px solid rgba(255,255,255,0.22)', background: '#141c26', color: '#e6ecf0', fontFamily: RESIPLE, fontSize: 12.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {/* the sheet's launcher rides the row's right end, styled and
                  sized like the dropdowns beside it */}
              <ViewLauncher current={currentStage} onGo={goStage} buttonStyle={{ height: 33, width: 33, border: '1px solid rgba(255,255,255,0.22)', background: '#141c26', backdropFilter: 'none' }} />
            </div>
            {staticView === 'air' && EGGS.map((egg) => (
              <details key={egg.id} id={`static-${egg.id}`} open style={{ background: '#141c26', border: `1px solid ${AIR}`, padding: 'clamp(20px,3.5vw,36px)', marginTop: 24, scrollMarginTop: 16 }}>
                <summary style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 18px' }}>
                  <span className="chev" style={{ color: '#7c909b', alignSelf: 'center' }} />
                  <h3 style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 'clamp(24px,3vw,32px)', letterSpacing: '-0.015em', margin: 0 }}>{egg.name}</h3>
                  <span style={{ fontFamily: RESIPLE, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c909b' }}>{egg.location}</span>
                  <span style={{ flex: 1 }} />
                  <button onClick={(e) => { e.preventDefault(); download(egg.id); }} style={BTN}>Download</button>
                </summary>
                <div style={{ marginTop: 28 }}>
                  {(() => {
                    const series = eggSeriesFor(egg.id, range);
                    return state.status === 'loading' ? <Note>Contacting the egg&hellip;</Note>
                      : series.length === 0 ? <Note>{OFFLINE}</Note>
                      : <EggCharts series={series} unit={unit} />;
                  })()}
                </div>
              </details>
            ))}
            {staticView === 'soil' && SOILMOTES.map((mote) => {
              const pts = soilPtsFor(mote.id, range);
              return (
                <details key={mote.id} id={`static-${mote.id}`} open style={{ background: '#141c26', border: `1px solid ${SOIL}`, padding: 'clamp(20px,3.5vw,36px)', marginTop: 24, scrollMarginTop: 16 }}>
                  <summary style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 18px' }}>
                    <span className="chev" style={{ color: '#7c909b', alignSelf: 'center' }} />
                    <h3 style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 'clamp(24px,3vw,32px)', letterSpacing: '-0.015em', margin: 0 }}>{mote.name}</h3>
                    {/* coords are dead weight on a phone-width summary line */}
                    <span style={{ fontFamily: RESIPLE, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c909b' }}>{isMobile ? mote.location : `${mote.location} ${mote.coords}`}</span>
                    <span style={{ flex: 1 }} />
                    <button onClick={(e) => { e.preventDefault(); download(mote.id); }} style={BTN}>Download</button>
                  </summary>
                  <div style={{ marginTop: 28 }}>
                    {soil.status === 'loading' ? <Note>Contacting the probe&hellip;</Note>
                      : pts.length < 2 ? <Note>{OFFLINE}</Note>
                      : <SensorChart label={RANGES.find(([v]) => v === range)![1]} unit="% VWC" points={thin(pts)} y0={0} minSpan={20} />}
                  </div>
                </details>
              );
            })}
            {staticView === 'soil' && (
              <div style={{ marginTop: 40 }}>
                <div style={{ fontFamily: RESIPLE, fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7c909b' }}>Inactive Sensors</div>
                {RETIRED.map((r) => (
                  <details key={r.name} id={`static-${r.name}`} open style={{ background: '#141c26', border: `1px solid ${SOIL}`, padding: 'clamp(20px,3.5vw,36px)', marginTop: 24, scrollMarginTop: 16 }}>
                    <summary style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 18px' }}>
                      <span className="chev" style={{ color: '#7c909b', alignSelf: 'center' }} />
                      <h3 style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 'clamp(24px,3vw,32px)', letterSpacing: '-0.015em', margin: 0 }}>{r.name}</h3>
                      {/* phones: bare date range, so name + dates + Download share one line */}
                      <span style={{ fontFamily: RESIPLE, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c909b' }}>{isMobile ? `(${r.from} - ${r.to})` : `Active: (${r.from} - ${r.to}) | Coords: ${r.coords}`}</span>
                      <span style={{ flex: 1 }} />
                      <button onClick={(e) => { e.preventDefault(); download(r.name); }} style={BTN}>Download</button>
                    </summary>
                    <div style={{ marginTop: 28 }}>
                      {/* retired probes are all history - the window doesn't apply */}
                      <SensorChart label="Lifetime" unit="% VWC" points={ARCHIVE[r.name]} y0={0} minSpan={20} />
                    </div>
                  </details>
                ))}
              </div>
            )}
            {staticView === 'weather' && NEWA_STATIONS.map((st) => {
              const series = wxSeriesFor(st.id, range);
              return (
                <details key={st.id} id={`static-${st.id}`} open style={{ background: '#141c26', border: `1px solid ${WEATHER}`, padding: 'clamp(20px,3.5vw,36px)', marginTop: 24, scrollMarginTop: 16 }}>
                  <summary style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 18px' }}>
                    <span className="chev" style={{ color: '#7c909b', alignSelf: 'center' }} />
                    <h3 style={{ fontFamily: MANTI, fontWeight: 700, fontSize: 'clamp(24px,3vw,32px)', letterSpacing: '-0.015em', margin: 0 }}>{st.name}</h3>
                    <span style={{ fontFamily: RESIPLE, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c909b' }}>{isMobile ? st.location : `${st.location} ${Math.abs(st.lat).toFixed(2)}° N, ${Math.abs(st.lon).toFixed(2)}° W`}</span>
                    <span style={{ flex: 1 }} />
                    <button onClick={(e) => { e.preventDefault(); download(st.id); }} style={BTN}>Download</button>
                  </summary>
                  <div style={{ marginTop: 28 }}>
                    {!(st.id in wx) ? <Note>Contacting the station&hellip;</Note>
                      : series.length === 0 ? <Note>{OFFLINE}</Note>
                      : (
                        <>
                          {/* the month feed stands in while the archive is out - say so */}
                          {range === 'life' && !(st.id in wxLife) && <Note>Loading the 5-year archive&hellip; showing the last month until it lands.</Note>}
                          <WeatherCharts series={series} unit={unit} />
                        </>
                      )}
                  </div>
                </details>
              );
            })}
            {staticView === 'weather' && (
              <div style={{ fontFamily: RESIPLE, fontSize: 11.5, letterSpacing: '0.06em', color: '#7c909b', marginTop: 28 }}>
                Regional stations courtesy of NEWA and the Northeast Regional Climate Center at Cornell. Hourly readings, typically 1-2 hours behind.
              </div>
            )}
          </div>
        </div>
      )}
      {lidarView && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30 }}>
          <iframe ref={lidarFrame} src="/lidar/" title="Ithaca semantic LiDAR viewer" allow="fullscreen" style={{ width: '100%', height: '100%', border: 0 }} />
          <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 5 }}>
            <ViewLauncher current={currentStage} onGo={goStage} />
          </div>
        </div>
      )}
      {forecastView && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30 }}>
          <WeatherForecast />
          <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 5 }}>
            <ViewLauncher current={currentStage} onGo={goStage} />
          </div>
        </div>
      )}
      {/* the launcher IS the way between the views. Top right in white on the
          imagery, sized to the temp bar. The forecast stage and the charts
          sheet carry their own copies. */}
      {mapView && (
        // phones: the temp bar owns the top row, the launcher sits under it
        <div style={{ position: 'absolute', zIndex: 40, top: isMobile ? 62 : 24, right: 24 }}>
          <ViewLauncher current={currentStage} onGo={goStage} ink="#ffffff" buttonStyle={{ border: '1px solid #ffffff', background: 'rgba(14,20,28,0.72)' }} />
        </div>
      )}
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: RESIPLE, fontSize: 14.5, color: '#7c909b' }}>{children}</div>;
}
