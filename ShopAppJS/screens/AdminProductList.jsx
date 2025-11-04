// screens/AdminProductList.jsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, Alert, Image, TextInput, StatusBar, Platform
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { subscribeSettings } from "../utils/settingsBus";
import { resolveThemeMode, getGradientColors, getScreenBackground } from "../utils/theme";

const API_URL = "http://192.168.1.102:3000";
const SETTINGS_KEY = "admin_settings_v1";

export default function AdminProductList({ navigation }) {
  const [settings, setSettings] = useState({ theme: "system" });
  const themeMode = resolveThemeMode(settings.theme);
  const gradientColors = getGradientColors(themeMode);
  const screenBg = getScreenBackground(themeMode);

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");

  const getToken = useCallback(async () => {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) {
      Alert.alert("Phiên đăng nhập hết hạn", "Vui lòng đăng nhập lại.");
      return null;
    }
    return token;
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/admin/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert("Lỗi", "Không thể tải danh sách sản phẩm.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // theme live
  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(SETTINGS_KEY);
        if (json) setSettings((p) => ({ ...p, ...JSON.parse(json) }));
      } catch {}
    })();
  }, []);
  useEffect(() => subscribeSettings((next) => setSettings((p) => ({ ...p, ...next }))), []);

  useFocusEffect(useCallback(() => { loadProducts(); }, [loadProducts]));

  const filtered = (Array.isArray(products) ? products : []).filter((p) => {
    const q = search.toLowerCase().trim();
    return !q
      ? true
      : (p?.name || "").toLowerCase().includes(q) ||
        (p?.brand || "").toLowerCase().includes(q);
  });

  const removeProduct = (productId) => {
    Alert.alert("Xoá sản phẩm", "Bạn chắc chắn muốn xoá sản phẩm này?", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xoá",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await getToken();
            if (!token) return;
            const res = await fetch(`${API_URL}/api/admin/inventory/${productId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Xoá thất bại");
            Alert.alert("Thành công", "Đã xoá sản phẩm.");
            loadProducts();
          } catch (e) {
            Alert.alert("Lỗi", e.message || "Không thể xoá sản phẩm.");
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image
        source={{ uri: item.image_url || "https://via.placeholder.com/90x90?text=No+Image" }}
        style={styles.thumbnail}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.brand}>{item.brand || "—"}</Text>
        <Text style={styles.price}>{(item.price || 0).toLocaleString("vi-VN")} đ</Text>
        <Text style={styles.stock}>Tồn kho: {item.stock ?? 0}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate("AdminProductEdit", { product: item })}
        >
          <Ionicons name="create-outline" size={20} color="#3498DB" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => removeProduct(item.id)}>
          <Ionicons name="trash-outline" size={20} color="#E74C3C" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <LinearGradient colors={gradientColors} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Danh sách sản phẩm</Text>
        <TouchableOpacity onPress={() => navigation.navigate("AdminProductEdit", { product: null })}>
          <Ionicons name="add-circle-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Search box */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo tên / brand..."
          placeholderTextColor="#888"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#3498DB" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: "#888", marginTop: 40 }}>
              Không có sản phẩm.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 10 : 60,
    paddingBottom: 15, paddingHorizontal: 20,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  searchBox: {
    flexDirection: "row", backgroundColor: "#fff", margin: 12, borderRadius: 25,
    paddingHorizontal: 15, paddingVertical: 8, alignItems: "center", elevation: 3, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#333" },

  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    marginHorizontal: 12, marginBottom: 10, borderRadius: 12, padding: 10, elevation: 2,
  },
  thumbnail: { width: 64, height: 64, borderRadius: 10, marginRight: 10 },
  name: { fontSize: 15, fontWeight: "bold", color: "#2C3E50" },
  brand: { fontSize: 13, color: "#7F8C8D", marginTop: 2 },
  price: { fontSize: 14, fontWeight: "700", color: "#3498DB", marginTop: 6 },
  stock: { fontSize: 13, color: "#2C3E50", marginTop: 2 },
  actions: { marginLeft: 8, gap: 6 },
  iconBtn: { padding: 8, alignItems: "center", justifyContent: "center" },
});
