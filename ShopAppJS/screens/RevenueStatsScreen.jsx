// screens/RevenueStatsScreen.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  StatusBar, Platform, ScrollView, Alert, Dimensions
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import moment from "moment";
import "moment/locale/vi";
import Svg, { Polyline, Line, G, Text as SvgText, Circle, Rect, Polygon } from "react-native-svg";
import io from "socket.io-client";
import { useFocusEffect } from "@react-navigation/native";

import { subscribeSettings } from "../utils/settingsBus";
import { resolveThemeMode, getGradientColors, getScreenBackground } from "../utils/theme";

moment.locale("vi");

// const API_URL = "http://192.168.1.103:3000";
// const SOCKET_URL = "http://192.168.1.103:3000";

const API_URL = "https://mma-3kpy.onrender.com";
const SOCKET_URL = "https://mma-3kpy.onrender.com";
const SETTINGS_KEY = "admin_settings_v1";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_HPAD = 12;
const CHART_W = Math.max(300, Math.min(360, SCREEN_W - CARD_HPAD * 2 - 12));
const CHART_H = 180;

const GRANULARITIES = [
  { key: "day", label: "Ngày", icon: "calendar" },
  { key: "month", label: "Tháng", icon: "calendar-number" },
  { key: "year", label: "Năm", icon: "calendar-outline" },
];

const METRICS = [
  { key: "revenue", label: "Doanh thu", icon: "cash-outline" },
  { key: "orders", label: "Số đơn", icon: "receipt-outline" },
  { key: "products", label: "SP mới", icon: "cube-outline" },
  { key: "users", label: "User mới", icon: "people-outline" },
];

// ===== Buckets =====
function daysOfMonth(m) {
  const start = m.clone().startOf("month");
  const end = m.clone().endOf("month");
  const keys = [];
  const cur = start.clone();
  while (cur.isSameOrBefore(end, "day")) {
    keys.push(cur.format("YYYY-MM-DD"));
    cur.add(1, "day");
  }
  return keys;
}
function monthsOfYear(y) {
  return [...Array(12)].map((_, m) => moment({ year: y, month: m, day: 1 }).format("YYYY-MM"));
}
function yearsSpan(endYear, span = 5) {
  const arr = [];
  for (let y = endYear - (span - 1); y <= endYear; y++) arr.push(String(y));
  return arr;
}

// ===== Build series =====
function buildSeries(data, { metric, granularity, period }) {
  let buckets = [];
  if (granularity === "day") buckets = daysOfMonth(period.month);
  else if (granularity === "month") buckets = monthsOfYear(period.year);
  else buckets = yearsSpan(period.endYear, 5);

  const map = new Map(buckets.map((k) => [k, 0]));
  const pushVal = (key, val) => { if (map.has(key)) map.set(key, map.get(key) + val); };

  if (metric === "revenue") {
    (data.orders || []).forEach((o) => {
      if (o?.status !== "Delivered") return;
      const d = moment(o.created_at);
      if (!d.isValid()) return;
      if (granularity === "day") pushVal(d.format("YYYY-MM-DD"), o.total_amount || 0);
      else if (granularity === "month") pushVal(d.format("YYYY-MM"), o.total_amount || 0);
      else pushVal(d.format("YYYY"), o.total_amount || 0);
    });
  } else if (metric === "orders") {
    (data.orders || []).forEach((o) => {
      const d = moment(o.created_at);
      if (!d.isValid()) return;
      if (granularity === "day") pushVal(d.format("YYYY-MM-DD"), 1);
      else if (granularity === "month") pushVal(d.format("YYYY-MM"), 1);
      else pushVal(d.format("YYYY"), 1);
    });
  } else if (metric === "products") {
    (data.products || []).forEach((p) => {
      const d = moment(p.created_at);
      if (!d.isValid()) return;
      if (granularity === "day") pushVal(d.format("YYYY-MM-DD"), 1);
      else if (granularity === "month") pushVal(d.format("YYYY-MM"), 1);
      else pushVal(d.format("YYYY"), 1);
    });
  } else {
    (data.users || []).forEach((u) => {
      const d = moment(u.created_at);
      if (!d.isValid()) return;
      if (granularity === "day") pushVal(d.format("YYYY-MM-DD"), 1);
      else if (granularity === "month") pushVal(d.format("YYYY-MM"), 1);
      else pushVal(d.format("YYYY"), 1);
    });
  }

  return buckets.map((k) => ({ x: k, y: map.get(k) || 0 }));
}

const formatMoney = (v) => (v || 0).toLocaleString("vi-VN") + " đ";

// ===== Main =====
export default function RevenueStatsScreen({ navigation }) {
  // Theme
  const [settings, setSettings] = useState({ theme: "system" });
  const themeMode = resolveThemeMode(settings.theme);
  const gradientColors = getGradientColors(themeMode);
  const screenBg = getScreenBackground(themeMode);

  // Data
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);

  // Realtime
  const socketRef = useRef(null);
  const refreshDebounceRef = useRef(null);

  // UI
  const [loading, setLoading] = useState(true);

  // Chart 1
  const [metric1, setMetric1] = useState("revenue");
  const [gran1, setGran1] = useState("day");
  const [period1, setPeriod1] = useState({
    type: "day",
    month: moment(),
    year: moment().year(),
    endYear: moment().year(),
  });

  // Chart 2
  const [metric2, setMetric2] = useState("orders");
  const [gran2, setGran2] = useState("month");
  const [period2, setPeriod2] = useState({
    type: "month",
    month: moment(),
    year: moment().year(),
    endYear: moment().year(),
  });

  // Settings live
  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(SETTINGS_KEY);
        if (json) setSettings((p) => ({ ...p, ...JSON.parse(json) }));
      } catch {}
    })();
  }, []);
  useEffect(() => subscribeSettings((next) => setSettings((p) => ({ ...p, ...next }))), []);

  // Fetch
  const getToken = useCallback(async () => {
    const t = await AsyncStorage.getItem("userToken");
    if (!t) {
      Alert.alert("Phiên đăng nhập hết hạn", "Vui lòng đăng nhập lại.");
      return null;
    }
    return t;
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const [oRes, pRes, uRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/orders`, { headers }),
        fetch(`${API_URL}/api/admin/inventory`, { headers }),
        fetch(`${API_URL}/api/admin/users`, { headers }),
      ]);
      const [o, p, u] = await Promise.all([oRes.json(), pRes.json(), uRes.json()]);
      setOrders(Array.isArray(o) ? o : []);
      setProducts(Array.isArray(p) ? p : []);
      setUsers(Array.isArray(u) ? u : []);
    } catch (e) {
      Alert.alert("Lỗi", "Không thể tải dữ liệu tài chính.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  // Socket realtime
  const triggerRefresh = useCallback(() => {
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = setTimeout(() => loadAll(), 700);
  }, [loadAll]);

  useEffect(() => {
    const s = io(SOCKET_URL);
    socketRef.current = s;
    s.on("newOrder", triggerRefresh);
    s.on("orderUpdated", triggerRefresh);
    s.on("inventoryChanged", triggerRefresh);
    s.on("userCreated", triggerRefresh);
    return () => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      s.disconnect();
    };
  }, [triggerRefresh]);

  // Series
  const dataObj = useMemo(() => ({ orders, products, users }), [orders, products, users]);
  const series1 = useMemo(
    () => buildSeries(dataObj, { metric: metric1, granularity: gran1, period: normalizePeriod(period1, gran1) }),
    [dataObj, metric1, gran1, period1]
  );
  const series2 = useMemo(
    () => buildSeries(dataObj, { metric: metric2, granularity: gran2, period: normalizePeriod(period2, gran2) }),
    [dataObj, metric2, gran2, period2]
  );

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <LinearGradient colors={gradientColors} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tài chính & Doanh thu</Text>
        <TouchableOpacity onPress={loadAll}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#3498DB" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
          {/* CHART 1 */}
          <CardBlock
            title="Biểu đồ 1"
            badge={prettyPeriod(normalizePeriod(period1, gran1), gran1)}
          >
            <TinyRow>
              <MetricPicker value={metric1} onChange={setMetric1} compact />
              <GranularityPicker gran={gran1} setGran={setGran1} setPeriod={setPeriod1} compact />
            </TinyRow>
            <PeriodPicker gran={gran1} period={normalizePeriod(period1, gran1)} setPeriod={setPeriod1} compact />

            <Chart
              series={series1}
              width={CHART_W}
              height={CHART_H}
              padding={{ left: 40, right: 10, top: 14, bottom: 28 }}
              color="#2D9CDB"
              areaFill="rgba(45,156,219,0.10)"
              metric={metric1}
              granularity={gran1}
              xLabel={(k, g) => xLabel(k, g)}
              valueFormatter={(val, metric) => metric === "revenue" ? formatMoney(val) : String(val)}
            />
          </CardBlock>

          {/* CHART 2 */}
          <CardBlock
            title="Biểu đồ 2"
            badge={prettyPeriod(normalizePeriod(period2, gran2), gran2)}
          >
            <TinyRow>
              <MetricPicker value={metric2} onChange={setMetric2} compact />
              <GranularityPicker gran={gran2} setGran={setGran2} setPeriod={setPeriod2} compact />
            </TinyRow>
            <PeriodPicker gran={gran2} period={normalizePeriod(period2, gran2)} setPeriod={setPeriod2} compact />

            <Chart
              series={series2}
              width={CHART_W}
              height={CHART_H}
              padding={{ left: 40, right: 10, top: 14, bottom: 28 }}
              color="#7E57C2"
              areaFill="rgba(126,87,194,0.10)"
              metric={metric2}
              granularity={gran2}
              xLabel={(k, g) => xLabel(k, g)}
              valueFormatter={(val, metric) => metric === "revenue" ? formatMoney(val) : String(val)}
            />
          </CardBlock>
        </ScrollView>
      )}
    </View>
  );
}

// ===== Atoms =====
function TinyRow({ children }) {
  return <View style={styles.tinyRow}>{children}</View>;
}

function CardBlock({ title, badge, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.badge}>
          <Ionicons name="time-outline" size={12} color="#0F172A" />
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      </View>
      {/* body căn giữa toàn bộ nội dung điều khiển + chart */}
      <View style={styles.cardBody}>
        {children}
      </View>
    </View>
  );
}

function normalizePeriod(p, gran) {
  if (gran === "day") return { type: "day", month: (p.month?.clone?.() || moment()).startOf("month") };
  if (gran === "month") return { type: "month", year: p.year || moment().year() };
  return { type: "year", endYear: p.endYear || moment().year() };
}

function prettyPeriod(p, gran) {
  if (gran === "day") return `Tháng ${p.month.format("MM/YYYY")}`;
  if (gran === "month") return `Năm ${p.year}`;
  return `5 năm đến ${p.endYear}`;
}

const MetricPicker = ({ value, onChange, compact }) => (
  <View style={[styles.segmentRow, compact && styles.segmentRowCompact]}>
    {METRICS.map((m) => {
      const active = value === m.key;
      return (
        <TouchableOpacity
          key={m.key}
          style={[styles.segment, active && styles.segmentActive, compact && styles.segmentCompact]}
          onPress={() => onChange(m.key)}
          activeOpacity={0.9}
        >
          <Ionicons name={m.icon} size={12} color={active ? "#fff" : "#334155"} />
          <Text style={[styles.segmentText, compact && styles.segmentTextCompact, active && { color: "#fff" }]}>
            {m.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const GranularityPicker = ({ gran, setGran, setPeriod, compact }) => (
  <View style={[styles.segmentRow, compact && styles.segmentRowCompact]}>
    {GRANULARITIES.map((g) => {
      const active = gran === g.key;
      return (
        <TouchableOpacity
          key={g.key}
          style={[styles.segment, active && styles.segmentActiveBlue, compact && styles.segmentCompact]}
          onPress={() => {
            setGran(g.key);
            if (g.key === "day") setPeriod((p) => ({ ...p, type: "day", month: moment() }));
            else if (g.key === "month") setPeriod((p) => ({ ...p, type: "month", year: moment().year() }));
            else setPeriod((p) => ({ ...p, type: "year", endYear: moment().year() }));
          }}
          activeOpacity={0.9}
        >
          <Ionicons name={g.icon} size={12} color={active ? "#fff" : "#334155"} />
          <Text style={[styles.segmentText, compact && styles.segmentTextCompact, active && { color: "#fff" }]}>
            {g.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const PeriodPicker = ({ gran, period, setPeriod, compact }) => {
  const badgeStyle = [styles.periodBadge, compact && styles.periodBadgeCompact];
  const textStyle = [styles.periodText, compact && styles.periodTextCompact];

  if (gran === "day") {
    const label = period.month.format("MM/YYYY");
    return (
      <View style={[styles.periodRow, compact && styles.periodRowCompact]}>
        <NudgeButton onPress={() => setPeriod((prev) => ({ ...prev, month: prev.month.clone().subtract(1, "month") }))} />
        <View style={badgeStyle}>
          <Ionicons name="calendar" size={12} color="#0F172A" />
          <Text style={textStyle}>Tháng {label}</Text>
        </View>
        <NudgeButton dir="forward" onPress={() => setPeriod((prev) => ({ ...prev, month: prev.month.clone().add(1, "month") }))} />
      </View>
    );
  }
  if (gran === "month") {
    const label = String(period.year);
    return (
      <View style={[styles.periodRow, compact && styles.periodRowCompact]}>
        <NudgeButton onPress={() => setPeriod((prev) => ({ ...prev, year: prev.year - 1 }))} />
        <View style={badgeStyle}>
          <Ionicons name="calendar-number" size={12} color="#0F172A" />
          <Text style={textStyle}>Năm {label}</Text>
        </View>
        <NudgeButton dir="forward" onPress={() => setPeriod((prev) => ({ ...prev, year: prev.year + 1 }))} />
      </View>
    );
  }
  const label = String(period.endYear);
  return (
    <View style={[styles.periodRow, compact && styles.periodRowCompact]}>
      <NudgeButton onPress={() => setPeriod((prev) => ({ ...prev, endYear: prev.endYear - 1 }))} />
      <View style={badgeStyle}>
        <Ionicons name="trending-up-outline" size={12} color="#0F172A" />
        <Text style={textStyle}>Kết thúc: {label} (5 năm)</Text>
      </View>
      <NudgeButton dir="forward" onPress={() => setPeriod((prev) => ({ ...prev, endYear: prev.endYear + 1 }))} />
    </View>
  );
};

function NudgeButton({ dir = "back", onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.nudgeBtn} activeOpacity={0.85}>
      <Ionicons name={dir === "back" ? "chevron-back-circle" : "chevron-forward-circle"} size={20} color="#2563EB" />
    </TouchableOpacity>
  );
}

// ===== Chart (compact + tooltip) =====
function Chart({ series, width, height, padding, color, areaFill, metric, granularity, xLabel, valueFormatter }) {
  const maxYRaw = series.length ? Math.max(...series.map((p) => p.y)) : 0;
  const roundUnit = metric === "revenue" ? 100000 : 5;
  const maxY = Math.max(1, Math.ceil(maxYRaw / roundUnit) * roundUnit);

  const yToSvg = (y) => {
    const h = height - padding.top - padding.bottom;
    const t = y / maxY;
    return padding.top + (1 - t) * h;
  };
  const xToSvg = (i) => {
    const w = width - padding.left - padding.right;
    const N = Math.max(1, series.length - 1);
    return padding.left + (w * i) / N;
  };

  const points = series.map((p, i) => ({ cx: xToSvg(i), cy: yToSvg(p.y), raw: p }));
  const polyPoints = points.map((p) => `${p.cx},${p.cy}`).join(" ");
  const areaPoints = `${padding.left},${height - padding.bottom} ${polyPoints} ${width - padding.right},${height - padding.bottom}`;

  const yTicks = (() => {
    const steps = 4;
    const arr = [];
    for (let i = 0; i <= steps; i++) arr.push(Math.round((maxY * i) / steps));
    return arr;
  })();

  const [tip, setTip] = useState(null);

  const nearestIndexFromX = (x) => {
    let bestI = 0, bestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(x - p.cx);
      if (d < bestDist) { bestDist = d; bestI = i; }
    });
    return bestI;
  };
  const showTipAtIndex = (i) => {
    const p = points[i];
    if (!p) return setTip(null);
    const label =
      granularity === "day"
        ? moment(p.raw.x, "YYYY-MM-DD").format("DD/MM/YYYY")
        : granularity === "month"
        ? moment(p.raw.x, "YYYY-MM").format("MM/YYYY")
        : p.raw.x;
    setTip({
      x: p.cx, y: p.cy,
      label,
      value: valueFormatter(p.raw.y, metric),
    });
  };
  const handleTouch = (evt) => {
    const { locationX, locationY } = evt.nativeEvent;
    if (
      locationX < padding.left ||
      locationX > width - padding.right ||
      locationY < padding.top ||
      locationY > height - padding.bottom
    ) return;
    showTipAtIndex(nearestIndexFromX(locationX));
  };

  return (
    <View style={styles.chartWrap}>
      <Svg width={width} height={height}>
        {/* overlay touch */}
        <Rect
          x={padding.left}
          y={padding.top}
          width={width - padding.left - padding.right}
          height={height - padding.top - padding.bottom}
          fill="transparent"
          onPress={handleTouch}
          onResponderMove={handleTouch}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
        />

        {/* grid */}
        {yTicks.map((v, idx) => {
          const y = yToSvg(v);
          return (
            <G key={`grid-${idx}`}>
              <Line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#EFF3F7" strokeWidth={1} />
              <SvgText x={padding.left - 6} y={y + 4} fontSize="9" fill="#667085" textAnchor="end">
                {metric !== "revenue"
                  ? String(v)
                  : v >= 1_000_000
                  ? `${v / 1_000_000}tr`
                  : v >= 1000
                  ? `${Math.round(v / 1000)}k`
                  : String(v)}
              </SvgText>
            </G>
          );
        })}
        {/* axes */}
        <Line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#E5E7EB" strokeWidth={1} />
        <Line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#E5E7EB" strokeWidth={1} />

        {/* area + line */}
        {points.length > 1 && <Polygon points={areaPoints} fill={areaFill} />}
        {points.length > 1 && <Polyline points={polyPoints} fill="none" stroke={color} strokeWidth="2" />}

        {/* points */}
        {points.map((p, i) => (
          <G key={`pt-${i}`}>
            <Circle cx={p.cx} cy={p.cy} r={2.6} fill={color} onPress={() => showTipAtIndex(i)} />
            <Circle cx={p.cx} cy={p.cy} r={10} fill="transparent" onPress={() => showTipAtIndex(i)} />
          </G>
        ))}

        {/* x labels: 3 mốc để gọn */}
        {[0, Math.floor(points.length * 0.5), points.length - 1]
          .filter((i, idx, arr) => i >= 0 && i < points.length && arr.indexOf(i) === idx)
          .map((i) => (
            <SvgText key={`xl-${i}`} x={points[i].cx} y={height - 8} fontSize="9" fill="#667085" textAnchor="middle">
              {granularity === "day"
                ? moment(points[i].raw.x, "YYYY-MM-DD").format("DD")
                : granularity === "month"
                ? moment(points[i].raw.x, "YYYY-MM").format("MM")
                : points[i].raw.x}
            </SvgText>
          ))}

        {/* tooltip compact */}
        {tip && (
          <G>
            <Line x1={tip.x} y1={padding.top} x2={tip.x} y2={height - padding.bottom} stroke="#94A3B8" strokeDasharray="3,3" strokeWidth={1} />
            <G
              x={Math.min(Math.max(tip.x - 62, padding.left + 4), width - padding.right - 124)}
              y={Math.max(tip.y - 42, padding.top + 4)}
            >
              <Rect width={124} height={36} rx={8} ry={8} fill="#FFFFFFEE" stroke="#E2E8F0" />
              <SvgText x={8} y={15} fontSize="10" fill="#0F172A">{tip.label}</SvgText>
              <SvgText x={8} y={28} fontSize="11" fill="#0EA5E9" fontWeight="bold">{tip.value}</SvgText>
            </G>
            <Circle cx={tip.x} cy={tip.y} r={4} fill={color} />
            <Circle cx={tip.x} cy={tip.y} r={8} fill="rgba(0,0,0,0.06)" />
          </G>
        )}
      </Svg>

      {(!tip && series.length > 0) ? (
        <Text style={styles.hint}>Chạm vào điểm để xem chi tiết</Text>
      ) : null}
    </View>
  );
}

// ===== Utils for labels =====
function xLabel(key, gran) {
  if (gran === "day") return moment(key, "YYYY-MM-DD").format("DD");
  if (gran === "month") return moment(key, "YYYY-MM").format("MM");
  return key;
}

// ===== Styles =====
const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 8 : 56,
    paddingBottom: 12, paddingHorizontal: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

  centerBox: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    marginTop: 10, marginHorizontal: CARD_HPAD,
    backgroundColor: "#FFFFFF",
    borderRadius: 12, padding: 10,
    elevation: 2,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardTitle: { fontWeight: "700", color: "#1F2937", fontSize: 14.5 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText: { color: "#0F172A", fontSize: 11, fontWeight: "600" },

  cardBody: { alignItems: "center" },       // căn giữa nội dung card
  tinyRow: {
    flexDirection: "row", gap: 8, alignItems: "center",
    justifyContent: "center",                // căn giữa 2 cụm picker
    flexWrap: "wrap",
  },

  segmentRow: {
    flexDirection: "row", flexWrap: "wrap",
    backgroundColor: "#F8FAFC",
    borderRadius: 10, padding: 6, gap: 6, marginTop: 4, marginBottom: 6,
    justifyContent: "center",                // căn giữa các pill
  },
  segmentRowCompact: { padding: 4, gap: 4, marginTop: 2, marginBottom: 4 },
  segment: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#EAEFF5",
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 999,
  },
  segmentCompact: { paddingVertical: 5, paddingHorizontal: 8, gap: 5 },
  segmentActive: { backgroundColor: "#7E57C2" },
  segmentActiveBlue: { backgroundColor: "#3498DB" },
  segmentText: { color: "#334155", fontWeight: "700", fontSize: 12 },
  segmentTextCompact: { fontSize: 11 },

  periodRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center",                // căn giữa cụm điều hướng thời gian
    gap: 12, marginBottom: 6, marginTop: 2,
  },
  periodRowCompact: { marginBottom: 4 },
  periodBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  periodBadgeCompact: { paddingHorizontal: 8, paddingVertical: 4 },
  periodText: { color: "#0F172A", fontWeight: "700", fontSize: 12 },
  periodTextCompact: { fontSize: 11 },
  nudgeBtn: { padding: 2 },

  chartWrap: {
    marginTop: 4,
    alignItems: "center",
    alignSelf: "center",
  },
  hint: { color: "#94A3B8", fontSize: 11, marginTop: 6, textAlign: "center" },
});
