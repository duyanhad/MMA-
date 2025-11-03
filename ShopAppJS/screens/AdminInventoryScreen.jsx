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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const API_URL = "http://192.168.1.102:3000";

export default function AdminInventoryScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("Tất cả");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fadeIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  };

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStock: 0,
    lowStock: 0,
  });

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

      setProducts(data);
      filterByTab(selectedTab, data);
      calculateStats(data);
      fadeIn();
    } catch (err) {
      console.log("❌ Lỗi tải kho:", err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedTab]);

  const calculateStats = (data) => {
    const totalStock = data.reduce((sum, p) => sum + (p.stock || 0), 0);
    const lowStock = data.filter((p) => p.stock < 5).length;
    setStats({
      totalProducts: data.length,
      totalStock,
      lowStock,
    });
  };

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const getStockColor = (stock) => {
    if (stock < 5) return "#E74C3C"; // đỏ
    if (stock < 20) return "#F1C40F"; // vàng
    return "#27AE60"; // xanh
  };

  const filterByTab = (tab, list = products) => {
    setSelectedTab(tab);
    let filteredData = list;
    if (tab === "Sắp hết") filteredData = list.filter((p) => p.stock < 5);
    else if (tab === "Trung bình") filteredData = list.filter((p) => p.stock >= 5 && p.stock < 20);
    else if (tab === "Nhiều") filteredData = list.filter((p) => p.stock >= 20);
    setFiltered(filteredData);
  };

  const handleSearch = (text) => {
    setSearch(text);
    const filteredList = products.filter(
      (item) =>
        item.name.toLowerCase().includes(text.toLowerCase()) ||
        item.brand.toLowerCase().includes(text.toLowerCase())
    );
    setFiltered(filteredList);
  };

  // ✅ Cập nhật tồn kho
  const updateStock = async (id, change) => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/api/admin/inventory/update-stock`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId: id, change }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      const updated = products.map((p) =>
        p.id === id ? { ...p, stock: Math.max(0, p.stock + change) } : p
      );
      setProducts(updated);
      filterByTab(selectedTab, updated);
    } catch (err) {
      console.log("❌ Lỗi cập nhật tồn kho:", err.message);
    }
  };

  const renderItem = ({ item }) => (
    <Animated.View
      style={[
        styles.card,
        { borderLeftColor: getStockColor(item.stock || 0), opacity: fadeAnim },
      ]}
    >
      <Image
        source={{ uri: item.image_url || "https://via.placeholder.com/100" }}
        style={styles.image}
      />
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.brand}>{item.brand}</Text>
        <Text style={styles.stock}>Tồn kho: {item.stock}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.minus]}
          onPress={() => updateStock(item.id, -1)}
        >
          <Ionicons name="remove" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.plus]}
          onPress={() => updateStock(item.id, 1)}
        >
          <Ionicons name="add" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const TABS = ["Tất cả", "Sắp hết", "Trung bình", "Nhiều"];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#2C3E50", "#34495E"]} style={styles.header}>
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
            style={[
              styles.tabButton,
              selectedTab === tab && styles.tabSelected,
            ]}
            onPress={() => filterByTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === tab && { color: "#fff" },
              ]}
            >
              {tab}
            </Text>
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
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
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
  tabSelected: {
    backgroundColor: "#3498DB",
  },
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
  image: {
    width: 65,
    height: 65,
    borderRadius: 10,
    marginRight: 10,
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "bold", color: "#2C3E50" },
  brand: { fontSize: 13, color: "#7F8C8D" },
  stock: { fontSize: 14, color: "#34495E", marginTop: 3 },
  actions: { flexDirection: "row", alignItems: "center", gap: 5 },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  plus: { backgroundColor: "#27AE60" },
  minus: { backgroundColor: "#E74C3C" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
});
