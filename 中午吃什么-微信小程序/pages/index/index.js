const { RESTAURANTS, CENTER, DIRECTION_META } = require('../../data/restaurants');

const MAP_W = 680; // 与原 H5 坐标一致的画布宽度
const MAP_H = 340;

const TABS = ['地图', '列表', '抽一家'];
const FILTERS = ['全部', '华阳', '正兴', '万安', '略远'];

Page({
  data: {
    tabs: TABS,
    tab: '地图',
    filters: FILTERS,
    filter: '全部',
    restaurants: [],
    filtered: [],
    nearCount: 0,
    directionMeta: DIRECTION_META,
    center: CENTER,
    selected: null,
    // 抽奖
    rolling: false,
    current: null,
    winner: null,
    copied: false
  },

  onLoad() {
    const restaurants = RESTAURANTS.map((r) => ({
      ...r,
      left: ((r.x / MAP_W) * 100).toFixed(2) + '%',
      top: ((r.y / MAP_H) * 100).toFixed(2) + '%',
      sig3: r.signature.slice(0, 3),
      dirLabel: DIRECTION_META[r.direction].label
    }));
    this.setData({
      restaurants,
      filtered: restaurants,
      nearCount: restaurants.filter((r) => !r.far).length
    });
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  switchFilter(e) {
    const filter = e.currentTarget.dataset.f;
    this.setData({
      filter,
      filtered:
        filter === '全部'
          ? this.data.restaurants
          : this.data.restaurants.filter((r) => r.direction === filter)
    });
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    const r = this.data.restaurants.find((x) => x.id === id);
    this.setData({ selected: r, copied: false });
  },

  closeDetail() {
    this.setData({ selected: null });
  },

  stopProp() {},

  copyAddress() {
    const r = this.data.selected;
    if (!r) return;
    wx.setClipboardData({
      data: `${r.name}：${r.address}`,
      success: () => {
        this.setData({ copied: true });
        setTimeout(() => this.setData({ copied: false }), 1500);
      }
    });
  },

  openDianping() {
    const r = this.data.selected;
    if (!r || !r.dp) return;
    // 小程序无法直接打开外部网页，复制点评链接供浏览器/点评App打开
    wx.setClipboardData({
      data: r.dp,
      success: () => {
        wx.showModal({
          title: '点评链接已复制',
          content: '小程序内无法直接打开网页，链接已复制，请粘贴到浏览器或大众点评打开。',
          showCancel: false,
          confirmText: '知道了'
        });
      }
    });
  },

  roll() {
    if (this.data.rolling) return;
    const pool = this.data.restaurants.filter((r) => !r.far);
    if (pool.length === 0) return;
    this.setData({ rolling: true, winner: null });
    let ticks = 0;
    const total = 18 + Math.floor(Math.random() * 6);
    const step = () => {
      const c = pool[Math.floor(Math.random() * pool.length)];
      ticks += 1;
      if (ticks < total) {
        this.setData({ current: c });
        this._timer = setTimeout(step, 60 + ticks * 14);
      } else {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        this.setData({ current: pick, winner: pick, rolling: false, selected: pick, copied: false });
      }
    };
    step();
  },

  onUnload() {
    if (this._timer) clearTimeout(this._timer);
  }
});
