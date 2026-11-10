import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { wgs84ToGcj02 } from '@/lib/geo';
import type { GeoPoint, PlaceItem } from '@/types';

const TILE_URL =
  'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}';
const FALLBACK_CENTER: GeoPoint = { lat: 30.4185, lng: 104.0706 };

const pinIcon = L.divIcon({
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  html:
    '<div style="width:20px;height:20px;border-radius:9999px;background:#ea580c;border:3px solid #fff;box-shadow:0 0 0 6px rgba(234,88,12,.18)"></div>',
});

interface Props {
  value: GeoPoint | null;
  onChange: (value: GeoPoint) => void;
  onAddress?: (address: string) => void;
  heightClass?: string;
}

export function MapPicker({ value, onChange, onAddress, heightClass = 'h-[260px]' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [center, setCenter] = useState<GeoPoint | null>(null);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const reverseTimer = useRef<number | null>(null);

  // 1) 拿默认中心与搜索能力
  useEffect(() => {
    let alive = true;
    api
      .geoConfig()
      .then((config) => {
        if (!alive) return;
        setSearchEnabled(Boolean(config.searchEnabled));
        setCenter(config.office ? { lat: config.office.lat, lng: config.office.lng } : FALLBACK_CENTER);
      })
      .catch(() => {
        if (alive) setCenter(FALLBACK_CENTER);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 2) 初始化地图
  useEffect(() => {
    if (!center || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 14,
      minZoom: 10,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer(TILE_URL, { subdomains: '1234', maxZoom: 18 }).addTo(map);
    map.on('click', (event: L.LeafletMouseEvent) => {
      onChangeRef.current({ lat: event.latlng.lat, lng: event.latlng.lng });
    });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 60);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [center]);

  // 3) 维护大头针
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }
    if (!markerRef.current) {
      markerRef.current = L.marker([value.lat, value.lng], { icon: pinIcon, keyboard: false }).addTo(map);
    } else {
      markerRef.current.setLatLng([value.lat, value.lng]);
    }
  }, [value]);

  // 4) 落点后自动反查地址
  useEffect(() => {
    if (!value || !searchEnabled || !onAddress) return;
    if (reverseTimer.current) window.clearTimeout(reverseTimer.current);
    reverseTimer.current = window.setTimeout(() => {
      api
        .geoReverse(value.lng, value.lat)
        .then((result) => {
          const address = result.result?.address;
          if (address) onAddress(address);
        })
        .catch(() => {
          // 反查失败不打扰用户，地址仍可手填
        });
    }, 500);
    return () => {
      if (reverseTimer.current) window.clearTimeout(reverseTimer.current);
    };
  }, [value, searchEnabled, onAddress]);

  const flyTo = useCallback((point: GeoPoint, zoom = 16) => {
    const map = mapRef.current;
    if (map) map.flyTo([point.lat, point.lng], zoom, { duration: 0.6 });
  }, []);

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error('这个浏览器不支持定位，直接点地图吧');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        // GPS 是 WGS-84，底图是 GCJ-02
        const converted = wgs84ToGcj02(point.lat, point.lng);
        flyTo(converted);
        onChange(converted);
        setLocating(false);
      },
      () => {
        toast.error('拿不到当前位置（可能没授权），直接点地图吧');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  const runSearch = async () => {
    const keyword = query.trim();
    if (!keyword) return;
    setSearching(true);
    try {
      const payload = await api.geoSearch(keyword);
      setResults(payload.items);
      if (payload.items.length === 0) toast.error('没搜到，换个关键词或直接点地图');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const pickPlace = (place: PlaceItem) => {
    const point = { lat: place.lat, lng: place.lng };
    setResults([]);
    setQuery(place.name);
    flyTo(point);
    onChange(point);
    if (onAddress) {
      const district = place.district.split(' ').filter(Boolean).pop() || '';
      const composed = [district, place.address].filter(Boolean).join('');
      onAddress(composed || place.name);
    }
  };

  return (
    <div>
      {searchEnabled ? (
        <div className="mb-2">
          <div className="flex gap-2">
            <input
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-stone-400"
              placeholder="搜店名，比如「江油肥肠」"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void runSearch();
                }
              }}
            />
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={searching}
              className="flex-none rounded-xl bg-stone-800 px-3 text-xs font-medium text-[#faf7f0] disabled:opacity-50"
            >
              {searching ? '搜…' : '搜索'}
            </button>
          </div>
          {results.length > 0 ? (
            <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-sm">
              {results.map((place) => (
                <button
                  key={place.id || place.name + place.lat}
                  type="button"
                  onClick={() => pickPlace(place)}
                  className="block w-full border-b border-stone-100 px-3 py-2 text-left last:border-0 active:bg-stone-50"
                >
                  <span className="block text-sm text-stone-800">{place.name}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-stone-400">
                    {place.district} {place.address}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-xl border border-stone-200">
        <div ref={containerRef} className={heightClass + ' w-full bg-stone-100'} />
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="absolute bottom-2 right-2 z-[400] flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-stone-700 shadow-md active:bg-stone-50 disabled:opacity-60"
        >
          {locating ? '定位中…' : '◎ 我的位置'}
        </button>
        {!value ? (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-[400] flex justify-center">
            <span className="rounded-full bg-stone-900/80 px-3 py-1 text-[11px] text-white">
              点地图选位置，或点「我的位置」
            </span>
          </div>
        ) : null}
      </div>

      <p className="mt-1 text-[10px] text-stone-400">
        地图数据 © 高德 · 点哪里算哪里，选完可以再拖动
      </p>
    </div>
  );
}