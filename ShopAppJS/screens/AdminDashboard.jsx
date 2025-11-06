// screens/AdminDashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Animated,
  Easing, TextInput, Dimensions, Alert, Vibration,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, CommonActions } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import moment from "moment";
import io from "socket.io-client";
import { subscribeSettings } from "../utils/settingsBus";
import { resolveThemeMode, getGradientColors } from "../utils/theme";

const { width } = Dimensions.get("window");
// const API_URL = "http://192.168.1.103:3000";
// const SOCKET_URL = "http://192.168.1.102:3000";
const API_URL = "https://mma-3kpy.onrender.com";
const SOCKET_URL = "https://mma-3kpy.onrender.com";
const SETTINGS_KEY = "admin_settings_v1";
const defaultSettings = {
  notificationsEnabled: true,
  soundEnabled: true,
  popupAutoCloseSec: 0,
  badgeMax: 9,
  lowStockThreshold: 5,
  theme: "system",
};

const formatPrice = (price) => (price ? price.toLocaleString("vi-VN") + " đ" : "0 đ");
const asArray = (v) => (Array.isArray(v) ? v : Array.isArray(v?.orders) ? v.orders : Array.isArray(v?.data) ? v.data : []);

export default function AdminDashboard({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ revenue: 0, totalOrders: 0, totalProducts: 0 });
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const themeMode = resolveThemeMode(settings.theme);
  const gradientColors = getGradientColors(themeMode);

  // đọc settings và subscribe live
  const loadSettingsFromStorage = async () => {
    try {
      const json = await AsyncStorage.getItem(SETTINGS_KEY);
      if (json) setSettings((prev) => ({ ...prev, ...JSON.parse(json) }));
    } catch {}
  };
  useEffect(() => { loadSettingsFromStorage(); }, []);
  useEffect(() => subscribeSettings((next) => setSettings((p) => ({ ...p, ...next }))), []);

  // socket theo settings
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on("connect", () => console.log("✅ Connected to Socket.IO"));
    socket.on("newOrder", (order) => {
      if (settings?.notificationsEnabled === false) return;
      const isPending = (order?.status || "Pending") === "Pending";
      if (!isPending) return;
      setNotifications((prev) => {
        const exists = prev.some((o) => (o?.id ?? -1) === (order?.id ?? -2) || o?.order_code === order?.order_code);
        const next = exists ? prev : [order, ...prev];
        return next.slice(0, 50);
      });
      setHasNew(true);
      if (settings?.soundEnabled) Vibration.vibrate(80);
    });
    return () => socket.disconnect();
  }, [settings?.notificationsEnabled, settings?.soundEnabled]);

  // auto close popup
  useEffect(() => {
    if (!showPopup) return;
    const sec = Number(settings?.popupAutoCloseSec || 0);
    if (sec <= 0) return;
    const t = setTimeout(() => setShowPopup(false), sec * 1000);
    return () => clearTimeout(t);
  }, [showPopup, settings?.popupAutoCloseSec]);

  // slider anim
  const animateChange = () => {
    fadeAnim.setValue(1);
    slideAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    });
  };
  useEffect(() => {
    const list = asArray(filtered);
    if (list.length > 1) {
      const i = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = (prev + 1) % list.length;
          animateChange();
          return next;
        });
      }, 4500);
      return () => clearInterval(i);
    }
  }, [filtered]);

  // load data
  const loadData = useCallback(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem("userToken");
        if (!token) {
          navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Login" }] }));
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };
        const [ordersRes, usersRes, productsRes] = await Promise.all([
          fetch(`${API_URL}/api/admin/orders`, { headers }),
          fetch(`${API_URL}/api/admin/users`, { headers }),
          fetch(`${API_URL}/api/products`, { headers }),
        ]);
        let ordersData = [], usersData = [], productsData = [];
        try { ordersData = await ordersRes.json(); } catch {}
        try { usersData = await usersRes.json(); } catch {}
        try { productsData = await productsRes.json(); } catch {}
        const ordersArr = asArray(ordersData);
        const usersArr = asArray(usersData);
        const productsArr = asArray(productsData);
        setOrders(ordersArr); setFiltered(ordersArr); setUsers(usersArr); setProducts(productsArr);
      } catch { Alert.alert("Lỗi", "Không thể kết nối tới máy chủ."); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [navigation]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    const list = asArray(orders);
    const totalRevenue = list.filter((o) => o?.status === "Delivered").reduce((s, o) => s + (o?.total_amount || 0), 0);
    setStats({ revenue: totalRevenue, totalOrders: list.length, totalProducts: asArray(products).length });
  }, [orders, products]);

  const handleSearch = (text) => {
    setSearch(text);
    const lower = text.toLowerCase();
    const base = asArray(orders);
    setFiltered(base.filter((o) =>
      (o?.order_code && o.order_code.toLowerCase().includes(lower)) ||
      (o?.customer_name && o.customer_name.toLowerCase().includes(lower))
    ));
    setCurrentIndex(0);
  };

  const listFiltered = asArray(filtered);
  const currentOrder = listFiltered.length > 0 ? listFiltered[currentIndex] : null;

  const openOrderDetail = (orderLike) => {
    if (!orderLike) return;
    const full = Array.isArray(orders)
      ? orders.find((o) => (o?.id ?? -1) === (orderLike?.id ?? -2) || o?.order_code === orderLike?.order_code)
      : null;
    navigation.navigate("OrderDetail", { order: full || orderLike });
  };

  const badgeCountText = (() => {
    const len = Array.isArray(notifications) ? notifications.length : 0;
    const max = Number.isFinite(settings?.badgeMax) ? settings.badgeMax : 9;
    return len > max ? `${max}+` : len > 0 ? String(len) : "";
  })();

  return (
    <LinearGradient colors={gradientColors} style={styles.container}>
      {/* 🔔 Bell */}
      <View style={styles.bellContainer}>
        <TouchableOpacity
          onPress={() => { setShowPopup(!showPopup); setHasNew(false); }}
          style={{ position: "relative" }}
        >
          <Ionicons name={hasNew ? "notifications" : "notifications-outline"} size={30} color="#FFD166" />
          {hasNew && <View style={styles.badgeDot} />}
          {!!badgeCountText && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeText}>{badgeCountText}</Text>
            </View>
          )}
        </TouchableOpacity>

        {showPopup && (
          <View style={styles.notificationPopup}>
            <Text style={styles.popupTitle}>📦 Đơn hàng mới</Text>
            {(Array.isArray(notifications) ? notifications : [])
              .filter((n) => (n?.status || "Pending") === "Pending")
              .slice(0, 10)
              .map((n, idx) => (
                <TouchableOpacity
                  key={`${n?.id || n?.order_code || idx}`}
                  style={styles.noticeItem}
                  onPress={() => {
                    setShowPopup(false);
                    navigation.navigate("OrderManager", {
                      focusOrderId: n?.id ?? null,
                      focusOrderCode: n?.order_code ?? null,
                    });
                  }}
                >
                  <Text style={styles.noticeText}>
                    #{n?.order_code || "Mã đơn"} - {n?.customer_name || "Khách hàng"}
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.noticeSub}>
                      {n?.created_at ? moment(n?.created_at).format("HH:mm DD/MM") : ""}
                    </Text>
                    <Text style={[styles.noticeSub, { fontWeight: "700", color: "#EF476F" }]}>
                      {((n?.total_amount || 0)).toLocaleString("vi-VN")} đ
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            {(!notifications || notifications.length === 0) && (
              <Text style={styles.emptyPopup}>Không có đơn mới</Text>
            )}
          </View>
        )}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BẢNG ĐIỀU KHIỂN</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FFD166" style={{ marginTop: 20 }} />
      ) : (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Đơn hàng gần đây</Text>
          <View style={styles.sliderBox}>
            {currentOrder ? (
              <TouchableOpacity activeOpacity={0.9} onPress={() => openOrderDetail(currentOrder)}>
                <Animated.View
                  style={[
                    styles.orderCard,
                    {
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }],
                      borderLeftColor:
                        currentOrder.status === "Delivered" ? "#2ECC71" :
                        currentOrder.status === "Pending" ? "#F1C40F" : "#E74C3C",
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="receipt-outline" size={20} color="#118AB2" style={{ marginRight: 6 }} />
                    <Text style={styles.orderId}>Mã đơn: {currentOrder.order_code}</Text>
                  </View>
                  <Text style={styles.customer}>Khách hàng: {currentOrder.customer_name}</Text>
                  <Text style={styles.address} numberOfLines={1}>Địa chỉ: {currentOrder.shipping_address}</Text>
                  <Text style={styles.total}>Tổng: {formatPrice(currentOrder.total_amount)}</Text>
                </Animated.View>
              </TouchableOpacity>
            ) : <Text style={styles.emptyText}>Không có đơn hàng.</Text>}
          </View>

          {/* Search */}
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color="#555" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo mã hoặc tên khách hàng..."
              placeholderTextColor="#888"
              value={search}
              onChangeText={handleSearch}
            />
          </View>

          {/* Stats */}
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.statCardBig, { backgroundColor: "#118AB2" }]}
            onPress={() => navigation.navigate("RevenueStatsScreen")}
          >
            <MaterialCommunityIcons name="cash-multiple" size={32} color="#FFF" />
            <Text style={styles.statValueBig}>{formatPrice(stats.revenue)}</Text>
            <Text style={styles.statTitleBig}>Tổng doanh thu</Text>
          </TouchableOpacity>

          {/* Quick cards */}
          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={[styles.statCard, { backgroundColor: "#06D6A0" }]}
              onPress={() => navigation.navigate("OrderManager")}
            >
              <Ionicons name="receipt-outline" size={26} color="#FFF" />
              <Text style={styles.statValue}>{stats.totalOrders}</Text>
              <Text style={styles.statTitle}>Đơn hàng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statCard, { backgroundColor: "#FFD166" }]}
              onPress={() => navigation.navigate("AdminInventoryScreen")}
            >
              <Ionicons name="cube-outline" size={26} color="#333" />
              <Text style={[styles.statValue, { color: "#333" }]}>{stats.totalProducts}</Text>
              <Text style={[styles.statTitle, { color: "#333" }]}>Kho hàng</Text>
            </TouchableOpacity>
          </View>

          {/* Menu */}
          <View style={styles.menuContainer}>
            <Text style={styles.sectionTitle}>Quản lý</Text>
            <View style={styles.menuRow}>
              <TouchableOpacity
                style={[styles.menuButton, { backgroundColor: "#EF476F" }]}
                onPress={() => navigation.navigate("AdminProductList")}
              >
                <Ionicons name="pricetag-outline" size={24} color="#FFF" />
                <Text style={styles.menuText}>Sản phẩm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuButton, { backgroundColor: "#073B4C" }]}
                onPress={() => navigation.navigate("AdminUserList")}
              >
                <Ionicons name="people-outline" size={24} color="#FFF" />
                <Text style={styles.menuText}>Người dùng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuButton, { backgroundColor: "#7E57C2" }]}
                onPress={() => navigation.navigate("AdminSettings")}
              >
                <Ionicons name="settings-outline" size={24} color="#FFF" />
                <Text style={styles.menuText}>Cài đặt</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bellContainer: { position: "absolute", top: 55, right: 25, zIndex: 1000 },
  badgeDot: { position: "absolute", top: 2, right: 3, width: 10, height: 10, backgroundColor: "#FF1744", borderRadius: 5 },
  badgeCount: {
    position: "absolute", top: -4, right: -6, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 9, backgroundColor: "#E74C3C", alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  notificationPopup: {
    position: "absolute", top: 40, right: 0, width: 260, backgroundColor: "#FFF", borderRadius: 12, padding: 10,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, elevation: 6,
  },
  popupTitle: { fontWeight: "bold", fontSize: 15, marginBottom: 6 },
  noticeItem: { borderBottomWidth: 1, borderBottomColor: "#eee", paddingVertical: 6 },
  noticeText: { fontWeight: "600", color: "#333" },
  noticeSub: { fontSize: 12, color: "#777" },
  emptyPopup: { color: "#666", textAlign: "center", marginTop: 5 },
  header: { paddingTop: 100, paddingHorizontal: 20, alignItems: "center" },
  headerTitle: {
    fontSize: 32, fontWeight: "bold", color: "#FFD166", textAlign: "center", letterSpacing: 1, marginBottom: 10,
    textShadowColor: "#FFF", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 15,
  },
  content: { marginTop: 50 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#FFF", marginBottom: 8, paddingHorizontal: 15 },
  sliderBox: { height: 150, marginBottom: 10, alignItems: "center" },
  orderCard: { width: width * 0.88, backgroundColor: "#FFF", borderRadius: 16, padding: 15, elevation: 5, borderLeftWidth: 6 },
  orderId: { fontWeight: "bold", color: "#118AB2" },
  customer: { color: "#222", fontSize: 15, fontWeight: "600" },
  address: { color: "#555", fontStyle: "italic", fontSize: 13 },
  total: { color: "#EF476F", fontWeight: "bold", fontSize: 15, textAlign: "right", marginTop: 4 },
  searchBox: {
    flexDirection: "row", backgroundColor: "#FFF", marginHorizontal: 15, borderRadius: 25,
    paddingHorizontal: 15, paddingVertical: 8, alignItems: "center", elevation: 4, marginBottom: 15,
  },
  searchInput: { flex: 1, fontSize: 15, marginLeft: 10, color: "#333" },
  statCardBig: {
    marginHorizontal: 20, borderRadius: 20, padding: 20, alignItems: "center", marginBottom: 20,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6,
  },
  statValueBig: { color: "#FFF", fontSize: 24, fontWeight: "bold" },
  statTitleBig: { color: "#FFF", fontSize: 15 },
  statsContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, paddingHorizontal: 15 },
  statCard: { borderRadius: 15, padding: 15, alignItems: "center", flex: 1, marginHorizontal: 5, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4 },
  statValue: { fontSize: 18, fontWeight: "bold", color: "#FFF" },
  statTitle: { fontSize: 12, color: "#FFF", textAlign: "center" },
  menuContainer: { marginBottom: 25, marginHorizontal: 10 },
  menuRow: { flexDirection: "row", justifyContent: "space-around" },
  menuButton: { alignItems: "center", padding: 15, flex: 1, borderRadius: 15, marginHorizontal: 5, elevation: 4 },
  menuText: { color: "#FFF", marginTop: 6, fontSize: 13, fontWeight: "500" },
  emptyText: { color: "#FFF", textAlign: "center", marginTop: 10 },
});
