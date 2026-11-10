import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/Modal';
import { RestaurantForm } from '@/components/RestaurantForm';
import { MapPicker } from '@/components/MapPicker';
import { api, errorMessage } from '@/lib/api';
import { validateRestaurantFields, type FieldErrors } from '@/lib/validate';
import type { GeoPoint, Restaurant, RestaurantFieldsInput } from '@/types';

function toFields(restaurant: Restaurant): RestaurantFieldsInput {
  return {
    name: restaurant.name,
    direction: restaurant.direction,
    address: restaurant.address,
    signature: [...restaurant.signature],
    perCapita: restaurant.perCapita,
    driveTime: restaurant.driveTime,
    note: restaurant.note,
    dp: restaurant.dp || '',
    imageUrl: restaurant.imageUrl || '',
  };
}

export function RestaurantManager() {
  const [items, setItems] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [fields, setFields] = useState<RestaurantFieldsInput | null>(null);
  const [alert, setAlert] = useState('');
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [office, setOffice] = useState<(GeoPoint & { name: string; calibrated?: boolean }) | null>(null);
  const [officeDraft, setOfficeDraft] = useState<GeoPoint | null>(null);
  const [officeOpen, setOfficeOpen] = useState(false);
  const [geoDraft, setGeoDraft] = useState<GeoPoint | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.admin.restaurants());
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api.admin
      .getSettings()
      .then((payload) => setOffice(payload.office))
      .catch(() => {
        // 设置读取失败不阻塞店铺列表
      });
  }, []);

  const saveOffice = async () => {
    if (!officeDraft) {
      toast.error('先在地图上点一下公司位置');
      return;
    }
    try {
      const payload = await api.admin.updateSettings({ ...officeDraft, name: office?.name || '麓坊中心' });
      setOffice(payload.office);
      setOfficeOpen(false);
      toast.success('公司位置已更新，新通过的店会按它换算到示意图');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const estimateDriveTime = async () => {
    const point = geoDraft || (editing && typeof editing.lat === 'number' && typeof editing.lng === 'number'
      ? { lat: editing.lat, lng: editing.lng }
      : null);
    if (!point) {
      toast.error('先在地图上标一下真实位置');
      return;
    }
    try {
      const est = await api.geoEstimate(point.lat, point.lng);
      setFields((prev) => (prev ? { ...prev, driveTime: est.minutes + '分钟' } : prev));
      toast.success('直线约 ' + (est.meters / 1000).toFixed(1) + ' 公里，估 ' + est.minutes + ' 分钟车程');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const openEditor = (restaurant: Restaurant) => {
    setEditing(restaurant);
    setFields(toFields(restaurant));
    setAlert(restaurant.alert || '');
    setX(restaurant.x);
    setY(restaurant.y);
    setGeoDraft(
      typeof restaurant.lat === 'number' && typeof restaurant.lng === 'number'
        ? { lat: restaurant.lat, lng: restaurant.lng }
        : null,
    );
    setErrors({});
  };

  const toggleStatus = async (restaurant: Restaurant) => {
    const nextStatus = restaurant.status === 'published' ? 'offline' : 'published';
    try {
      await api.admin.updateRestaurant(restaurant.id, { status: nextStatus });
      toast.success(nextStatus === 'published' ? '已重新上架' : '已下架');
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const save = async () => {
    if (!editing || !fields) return;
    const result = validateRestaurantFields(fields);
    setErrors(result.errors);
    if (!result.ok) {
      toast.error('字段还没填好');
      return;
    }
    setBusy(true);
    try {
      await api.admin.updateRestaurant(editing.id, {
        ...result.value,
        alert: alert.trim(),
        x,
        y,
        ...(geoDraft ? { lat: geoDraft.lat, lng: geoDraft.lng } : {}),
      });
      toast.success('已保存');
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-stone-700">公司位置（换算基准）</p>
            <p className="mt-1 text-[11px] text-stone-500">
              {office
                ? office.name + ' · ' + office.lat.toFixed(5) + ', ' + office.lng.toFixed(5) + (office.calibrated ? '（已校准）' : '（默认值，建议校准）')
                : '加载中…'}
            </p>
          </div>
          <button
            onClick={() => {
              setOfficeDraft(office ? { lat: office.lat, lng: office.lng } : null);
              setOfficeOpen(true);
            }}
            className="flex-none rounded-lg border border-stone-300 px-2.5 py-1.5 text-[11px] text-stone-600"
          >
            校准
          </button>
        </div>
      </div>

      {loading ? <p className="mt-4 text-center text-sm text-stone-400">加载中…</p> : null}

      <div className="space-y-2">
        {items.map((restaurant) => (
          <div key={restaurant.id} className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-800 px-1 text-[10px] font-semibold text-[#faf7f0]">
                    {restaurant.id}
                  </span>
                  <span className="font-medium">{restaurant.name}</span>
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-[10px] ' +
                      (restaurant.status === 'published'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-stone-200 text-stone-600')
                    }
                  >
                    {restaurant.status === 'published' ? '在架' : '已下架'}
                  </span>
                  {restaurant.source === 'submission' ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">用户报送</span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[11px] text-stone-500">
                  {restaurant.direction} · {restaurant.address}
                </p>
              </div>
              <div className="flex flex-none flex-col gap-1.5">
                <button
                  onClick={() => openEditor(restaurant)}
                  className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-[11px] text-stone-600"
                >
                  编辑
                </button>
                <button
                  onClick={() => void toggleStatus(restaurant)}
                  className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-[11px] text-stone-600"
                >
                  {restaurant.status === 'published' ? '下架' : '上架'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={officeOpen}
        title="校准公司位置"
        subtitle="新店通过审核后，会按真实坐标相对这里的方向与距离，换算到首页示意图上的位置"
        onClose={() => setOfficeOpen(false)}
        footer={
          <button
            onClick={() => void saveOffice()}
            className="w-full rounded-xl bg-stone-800 py-2.5 text-sm font-medium text-[#faf7f0]"
          >
            保存
          </button>
        }
      >
        <MapPicker value={officeDraft} onChange={(point) => setOfficeDraft(point)} heightClass="h-[240px]" />
        {officeDraft ? (
          <p className="mt-2 text-[11px] text-stone-500">
            已选：{officeDraft.lat.toFixed(5)}, {officeDraft.lng.toFixed(5)}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(editing && fields)}
        title={'编辑 · ' + (editing?.name || '')}
        subtitle="修改后立即生效；坐标可用来微调地图上的圆点"
        onClose={() => setEditing(null)}
        footer={
          <button
            onClick={() => void save()}
            disabled={busy}
            className="w-full rounded-xl bg-stone-800 py-2.5 text-sm font-medium text-[#faf7f0] disabled:opacity-60"
          >
            保存
          </button>
        }
      >
        {fields ? (
          <div className="space-y-4">
            <RestaurantForm
              value={fields}
              errors={errors}
              disabled={busy}
              driveTimeAction={
                <button
                  type="button"
                  onClick={() => void estimateDriveTime()}
                  className="mt-1.5 text-[11px] text-orange-700 underline underline-offset-2"
                >
                  按定位估算车程（直线距离）
                </button>
              }
              onChange={(patch) => {
                setFields((prev) => (prev ? { ...prev, ...patch } : prev));
                setErrors({});
              }}
            />

            <div>
              <p className="mb-1.5 text-xs font-medium text-stone-700">提醒（可选，会在地图页与详情里标黄）</p>
              <input
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-400"
                value={alert}
                onChange={(event) => setAlert(event.target.value)}
                placeholder="例：拆迁中，去前请确认地址"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-stone-700">
                真实位置（决定详情页的「导航过去」）
              </p>
              <p className="mb-2 text-[11px] text-stone-400">
                {geoDraft
                  ? '已标记 ' + geoDraft.lat.toFixed(5) + ', ' + geoDraft.lng.toFixed(5) + '，保存后会同时换算示意图位置'
                  : '还没标记，这家店不会有导航按钮'}
              </p>
              <MapPicker
                value={geoDraft}
                onChange={(point) => setGeoDraft(point)}
                onAddress={(address) => {
                  if (!fields.address) setFields((prev) => (prev ? { ...prev, address } : prev));
                }}
                heightClass="h-[200px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-stone-700">地图 X（45-635）</span>
                <input
                  type="number"
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-400"
                  value={x}
                  onChange={(event) => setX(Number(event.target.value))}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-stone-700">地图 Y（45-285）</span>
                <input
                  type="number"
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-400"
                  value={y}
                  onChange={(event) => setY(Number(event.target.value))}
                />
              </label>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}