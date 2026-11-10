
const CENTER = { x: 340, y: 170, name: '麓坊中心' };

const RESTAURANTS = [
  {
    id: 1, name: '江油肥肠', direction: '华阳',
    signature: ['红烧肥肠', '凉拌肥肠', '火爆肥肠', '肥肠豆汤'],
    perCapita: 35, driveTime: '10–13分钟', address: '双流区华阳街道广都中街255号',
    note: '华阳老街苍蝇馆子，本地人的食堂，肥肠全席闭眼点，饭点爆满要赶早。',
    dp: 'https://m.dianping.com/chengdu/ch10/g101?q=%E6%B1%9F%E6%B2%B9%E8%82%A5%E8%82%A0%20%E5%8D%8E%E9%98%B3',
    x: 268, y: 72, labelDy: -14,
  },
  {
    id: 2, name: '正兴张血旺', direction: '正兴',
    signature: ['血旺', '麻辣连肝肉', '拌白肉'],
    perCapita: 30, driveTime: '12–15分钟', address: '双流区正兴街道（拆迁片区，去前请确认）',
    note: '40年老店，血旺嫩滑入口即化，一人食30元出头。',
    alert: '正兴拆迁中，已搬过一次家，去前在大众点评确认最新地址',
    dp: 'https://m.dianping.com/chengdu/ch10/g101?q=%E6%AD%A3%E5%85%B4%E5%BC%A0%E8%A1%80%E6%97%BA',
    x: 128, y: 244, labelDy: -14,
  },
  {
    id: 3, name: '小平肥肠粉·蹄花', direction: '正兴',
    signature: ['蹄花', '红油蘸水', '豆花'],
    perCapita: 30, driveTime: '12–15分钟', address: '双流区正兴街道天府锦绣/美地小区附近',
    note: '40年老店，店名是肥肠粉，镇店之宝是蹄花，蘸水3元另算但值。',
    alert: '因拆迁已搬至天府锦绣/美地小区附近，去前确认位置',
    dp: 'https://m.dianping.com/chengdu/ch10/g101?q=%E5%B0%8F%E5%B9%B3%E8%82%A5%E8%82%A0%E7%B2%89%20%E6%AD%A3%E5%85%B4',
    x: 168, y: 282, labelDx: 12, labelDy: 14, labelAnchor: 'start',
  },
  {
    id: 4, name: '正兴耙泥鳅', direction: '正兴',
    signature: ['耙泥鳅'],
    perCapita: 50, driveTime: '12–15分钟', address: '双流区正兴街道正兴老街（锦江边）',
    note: '正兴的老招牌，泥鳅炖得软烂入味，典型的"三碗饭"菜。',
    alert: '位于拆迁片区，存活状态建议出发前电话确认',
    dp: 'https://m.dianping.com/chengdu/ch10/g101?q=%E6%AD%A3%E5%85%B4%E8%80%99%E6%B3%A5%E9%B3%85',
    x: 92, y: 286, labelDx: -12, labelDy: 14, labelAnchor: 'end',
  },
  {
    id: 5, name: '万安苍蝇馆子', direction: '万安',
    signature: ['只做7个菜', '来晚吃不到'],
    perCapita: 40, driveTime: '10–13分钟', address: '双流区万安街道万安场镇（导航搜「万安苍蝇馆子」）',
    note: '万安镇上最火的苍蝇馆子，只卖7个菜，到场镇问本地人就知道。',
    dp: 'https://m.dianping.com/chengdu/ch10/g101?q=%E4%B8%87%E5%AE%89%E8%8B%8D%E8%9D%87%E9%A6%86%E5%AD%90',
    x: 560, y: 92, labelDy: -14,
  },
  {
    id: 6, name: '高记潮汕汤粉', direction: '华阳',
    signature: ['牛肉丸汤粉', '现熬骨汤'],
    perCapita: 32, driveTime: '10–13分钟', address: '双流区华阳街道瑞祥东街397号',
    note: '双流区潮汕菜好评榜第1名，每日现熬骨汤，鲜香不腻，有停车场。',
    dp: 'https://m.dianping.com/shopinfo/l2IsrZIYvX9wco1P',
    x: 326, y: 132, labelDx: 12, labelDy: 14, labelAnchor: 'start',
  },
  {
    id: 7, name: '雅安三大爷土菜馆', direction: '华阳',
    signature: ['土菜', '血旺', '时蔬'],
    perCapita: 49, driveTime: '10–13分钟', address: '双流区华阳街道富民路四段111号',
    note: '华阳商圈川菜热门榜第10名，家常土菜下饭，人均不到五十。',
    dp: 'https://m.dianping.com/shopinfo/H31G14A3HmsaV084',
    x: 240, y: 136, labelDx: -12, labelDy: 14, labelAnchor: 'end',
  },
  {
    id: 8, name: '小春鲜切现炒土猪肉', direction: '华阳',
    signature: ['黑土猪五花回锅肉', '现炒土猪肉'],
    perCapita: 40, driveTime: '10–13分钟', address: '双流区华阳街道富阳二街55号（华阳地铁站A口）',
    note: '华阳商圈家常菜环境榜第3名，鲜切现炒，黑土猪回锅肉很下饭。',
    dp: 'https://m.dianping.com/shopinfo/G6vduDW6i37vlOsr',
    x: 366, y: 60, labelDy: -14,
  },
  {
    id: 9, name: '正弘素椒杂酱面', direction: '华阳',
    signature: ['素椒杂酱面'],
    perCapita: 14, driveTime: '10–13分钟', address: '双流区华阳街道天府大道南段2716号73栋1层18号',
    note: '一碗素椒杂酱面14块，酱香油润，赶时间的工作餐首选。',
    dp: 'https://m.dianping.com/shopinfo/k1xOEL6vqBMqCswM',
    x: 398, y: 138, labelDx: 12, labelDy: 14, labelAnchor: 'start',
  },
  {
    id: 10, name: '小黔黔贵州酸汤', direction: '华阳',
    signature: ['酸汤吊龙牛肉米粉', '贵州酸汤'],
    perCapita: 30, driveTime: '10–13分钟', address: '双流区嘉州路与青岛路西段交叉口东北140米',
    note: '天府新区米线环境榜第9名，贵州酸汤开胃，单人餐含杨梅汤35.5元，有停车场。',
    dp: 'https://m.dianping.com/shopinfo/k2icQcGmvoGATEQv',
    x: 300, y: 132, labelDx: -12, labelDy: 14, labelAnchor: 'end',
  },
  {
    id: 11, name: '再来一瓣蒜·新疆菜菜', direction: '华阳',
    signature: ['新疆菜', '烤串'],
    perCapita: 70, driveTime: '3–5分钟', address: '双流区麓坊街93号3栋2楼（麓湖店）',
    note: '双流区新疆菜好评榜第1名，就在麓坊街，下楼就到，有停车场。',
    dp: 'https://m.dianping.com/shopinfo/k49czdKlbuNTXIz5',
    x: 360, y: 196, labelDx: 12, labelDy: 16, labelAnchor: 'start',
  },
];
const DIRECTION_META = {
  '华阳': { label: '华阳老城', desc: '北边 · 约10–13分钟' },
  '正兴': { label: '正兴', desc: '西南 · 约12–15分钟' },
  '万安': { label: '万安', desc: '东北 · 约10–13分钟' },
  '略远': { label: '略超15分钟', desc: '南边 · 顺路可去' },
};

module.exports = { CENTER, RESTAURANTS, DIRECTION_META };
