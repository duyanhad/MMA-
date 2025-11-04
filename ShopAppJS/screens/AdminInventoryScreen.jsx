// screens/AdminInventoryScreen.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Platform,
  Animated,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// 🔧 thêm: theme + bus để live update
import { subscribeSettings } from "../utils/settingsBus";
import {
  resolveThemeMode,
  getGradientColors,
  getScreenBackground,
} from "../utils/theme";

const API_URL = "http://192.168.1.102:3000";
const SETTINGS_KEY = "admin_settings_v1";

export default function AdminInventoryScreen({ navigation }) {
  // ===== Theme & Settings (live) =====
  const [settings, setSettings] = useState({ theme: "system", lowStockThreshold: 5 });
  const themeMode = resolveThemeMode(settings.theme);
  const gradientColors = getGradientColors(themeMode);
  const screenBg = getScreenBackground(themeMode);
  const lowThreshold = Number.isFinite(settings.lowStockThreshold)
    ? settings.lowStockThreshold
    : 5;

  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(SETTINGS_KEY);
        if (json) setSettings((p) => ({ ...p, ...JSON.parse(json) }));
      } catch {}
    })();
  }, []);
  useEffect(() => subscribeSettings((next) => setSettings((p) => ({ ...p, ...next }))), []);

  // ===== Data =====
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("Tất cả");

  // ===== Animation =====
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = () => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  };

  const [stats, setStats] = useState({ totalProducts: 0, totalStock: 0, lowStock: 0 });

  // ✅ Load dữ liệu kho
  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/api/admin/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Lỗi tải kho");

      setProducts(Array.isArray(data) ? data : []);
      filterByTab(selectedTab, Array.isArray(data) ? data : []);
      calculateStats(Array.isArray(data) ? data : []);
      fadeIn();
    } catch (err) {
      console.log("❌ Lỗi tải kho:", err.message);
      Alert.alert("Lỗi", "Không thể tải kho hàng.");
    } finally {
      setLoading(false);
    }
  }, [selectedTab]);

  const calculateStats = (data) => {
    const totalStock = data.reduce((sum, p) => sum + (p.stock || 0), 0);
    const lowStock = data.filter((p) => (p.stock || 0) < lowThreshold).length;
    setStats({ totalProducts: data.length, totalStock, lowStock });
  };

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // màu tồn kho
  const getStockColor = (stock) => {
    if (stock < lowThreshold) return "#E74C3C"; // đỏ
    if (stock < Math.max(lowThreshold * 4, 20)) return "#F1C40F"; // vàng
    return "#27AE60"; // xanh
  };

  // Tabs filter
  const filterByTab = (tab, list = products) => {
    setSelectedTab(tab);
    let filteredData = list;
    if (tab === "Sắp hết") filteredData = list.filter((p) => (p.stock || 0) < lowThreshold);
    else if (tab === "Trung bình")
      filteredData = list.filter((p) => (p.stock || 0) >= lowThreshold && (p.stock || 0) < Math.max(lowThreshold * 4, 20));
    else if (tab === "Nhiều") filteredData = list.filter((p) => (p.stock || 0) >= Math.max(lowThreshold * 4, 20));
    setFiltered(filteredData);
  };

  // Tìm kiếm theo tên/brand
  const handleSearch = (text) => {
    setSearch(text);
    const filteredList = products.filter((item) => {
      const name = (item.name || "").toLowerCase();
      const brand = (item.brand || "").toLowerCase();
      const q = text.toLowerCase();
      return name.includes(q) || brand.includes(q);
    });
    setFiltered(filteredList);
  };

  // ✅ Cập nhật tồn kho
  const updateStock = async (id, change) => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/api/admin/inventory/update-stock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: id, change }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Lỗi cập nhật tồn kho");

      const updated = products.map((p) =>
        p.id === id ? { ...p, stock: Math.max(0, (p.stock || 0) + change) } : p
      );
      setProducts(updated);
      filterByTab(selectedTab, updated);
      calculateStats(updated);
    } catch (err) {
      console.log("❌ Lỗi cập nhật tồn kho:", err.message);
      Alert.alert("Lỗi", err.message);
    }
  };

  const renderItem = ({ item }) => (
    <Animated.View
      style={[styles.card, { borderLeftColor: getStockColor(item.stock || 0), opacity: fadeAnim }]}
    >
      <Image
        source={{ uri: item.image_url || "https://via.placeholder.com/100" }}
        style={styles.image}
      />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.brand}>{item.brand}</Text>
        <Text style={styles.stock}>Tồn kho: {item.stock ?? 0}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.minus]} onPress={() => updateStock(item.id, -1)}>
          <Ionicons name="remove" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.plus]} onPress={() => updateStock(item.id, 1)}>
          <Ionicons name="add" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const TABS = ["Tất cả", "Sắp hết", "Trung bình", "Nhiều"];

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={gradientColors} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý kho</Text>
        <TouchableOpacity onPress={loadInventory}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, selectedTab === tab && styles.tabSelected]}
            onPress={() => filterByTab(tab)}
          >
            <Text style={[styles.tabText, selectedTab === tab && { color: "#fff" }]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tìm kiếm */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm sản phẩm..."
          placeholderTextColor="#888"
          value={search}
          onChangeText={handleSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(""); filterByTab(selectedTab); }}>
            <Ionicons name="close-circle" size={18} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3498db" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={<Text style={{ textAlign: "center", color: "#888", marginTop: 40 }}>Không có sản phẩm.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 10 : 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },

  tabRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    marginVertical: 8,
    marginHorizontal: 10,
    borderRadius: 30,
    elevation: 2,
    paddingVertical: 5,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 20,
  },
  tabSelected: { backgroundColor: "#3498DB" },
  tabText: { fontSize: 14, color: "#333", fontWeight: "500" },

  searchBox: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
    alignItems: "center",
    elevation: 3,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, marginLeft: 10, color: "#333" },

  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: 10,
    marginBottom: 10,
    padding: 10,
    alignItems: "center",
    elevation: 2,
    borderLeftWidth: 6,
  },
  image: { width: 65, height: 65, borderRadius: 10, marginRight: 10 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "bold", color: "#2C3E50" },
  brand: { fontSize: 13, color: "#7F8C8D" },
  stock: { fontSize: 14, color: "#34495E", marginTop: 3 },

  actions: { flexDirection: "row", alignItems: "center", gap: 5 },
  btn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  plus: { backgroundColor: "#27AE60" },
  minus: { backgroundColor: "#E74C3C" },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
});
