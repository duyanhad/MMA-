// screens/AdminProductList.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  TouchableOpacity,
  TextInput,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

// const API_URL = "http://192.168.1.103:3000";
const API_URL = "https://mma-3kpy.onrender.com";
const C = {
  header1: "#184E77",
  header2: "#1E6091",
  white: "#fff",
  bg: "#F5F8FA",
  text: "#1F2A37",
  soft: "#6B7280",
  border: "#E5E7EB",
  line: "#EEF2F7",
  ok: "#06D6A0",
  warn: "#FFA726",
  danger: "#EF4444",
  accent: "#34A0A4",
};

const price = (v) => (v ? v.toLocaleString("vi-VN") + " đ" : "0 đ");
const num = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

// ---- Helpers an toàn dữ liệu ----
const toPlainObject = (val) => {
  // Map → object
  try {
    if (val && typeof val === "object" && typeof val.entries === "function") {
      return Object.fromEntries(Array.from(val.entries()));
    }
  } catch {}
  // Array of pairs → object
  if (Array.isArray(val)) {
    try {
      return Object.fromEntries(val);
    } catch {
      return {};
    }
  }
  // object thường
  if (val && typeof val === "object") return val;
  return {};
};

const totalStockOf = (p) => {
  const ss = toPlainObject(p?.size_stocks);
  const keys = Object.keys(ss || {});
  if (keys.length > 0) {
    return keys.reduce((s, k) => s + num(ss[k], 0), 0);
  }
  return num(p?.stock ?? 0, 0);
};

export default function AdminProductList({ navigation }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState([]); // all products
  const [view, setView] = useState([]); // filtered

  const tokenHeaders = async () => {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) throw new Error("Phiên đăng nhập hết hạn.");
    return { Authorization: `Bearer ${token}` };
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await tokenHeaders();
      const res = await fetch(`${API_URL}/api/admin/inventory`, { headers });
      if (!res.ok) {
        let msg = "Không thể tải sản phẩm.";
        try {
          const err = await res.json();
          if (err?.message) msg = err.message;
        } catch {}
        throw new Error(msg);
      }
      const list = (await res.json()) ?? [];

      // Normalize từng phần tử, đảm bảo field luôn đủ để render
      const normalized = list.map((raw) => {
        const p = { ...raw };
        p.size_stocks = toPlainObject(p.size_stocks);
        p.__totalStock = totalStockOf(p);
        // đảm bảo các field text không bị undefined
        p.name = p.name ?? "";
        p.brand = p.brand ?? "";
        p.category = p.category ?? "";
        p.discount = num(p.discount, 0);
        p.price = num(p.price, 0);
        return p;
      });

      setData(normalized);
      setView(normalized);
    } catch (e) {
      console.log("❌ Load inventory error:", e);
      Alert.alert("Lỗi", e.message || "Không thể tải sản phẩm.");
      setData([]);
      setView([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchProducts(); }, [fetchProducts]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  };

  // Tìm kiếm (giữ bố cục, chỉ lọc dữ liệu)
  useEffect(() => {
    const lower = q.trim().toLowerCase();
    if (!lower) {
      setView(data);
      return;
    }
    setView(
      (data || []).filter((p) => {
        const hay = `${p.name || ""} ${p.brand || ""} ${p.category || ""}`;
        return hay.toLowerCase().includes(lower);
      })
    );
  }, [q, data]);

  const handleDelete = async (item) => {
    Alert.alert(
      "Xoá sản phẩm",
      `Bạn chắc chắn muốn xoá "${item.name}"?`,
      [
        { text: "Huỷ", style: "cancel" },
        {
          text: "Xoá",
          style: "destructive",
          onPress: async () => {
            try {
              const headers = await tokenHeaders();
              const res = await fetch(
                `${API_URL}/api/admin/inventory/${item.id}`,
                { method: "DELETE", headers }
              );
              if (!res.ok) {
                let msg = "Không thể xoá sản phẩm.";
                try {
                  const err = await res.json();
                  if (err?.message) msg = err.message;
                } catch {}
                throw new Error(msg);
              }
              setData((arr) => (arr || []).filter((p) => p.id !== item.id));
              setView((arr) => (arr || []).filter((p) => p.id !== item.id));
            } catch (e) {
              Alert.alert("Lỗi", e.message || "Không thể xoá sản phẩm.");
            }
          },
        },
      ]
    );
  };

  const renderSizeChips = (p) => {
    const entries = Object.entries(toPlainObject(p.size_stocks));
    if (entries.length === 0) return null;
    return (
      <View style={styles.sizeWrap}>
        {entries.map(([sz, qty]) => {
          const qn = num(qty, 0);
          const bg = qn <= 0 ? "#F3F4F6" : qn <= 3 ? "#FFF3E0" : "#E8FFF4";
          const col = qn <= 0 ? "#9CA3AF" : qn <= 3 ? C.warn : C.ok;
          return (
            <View key={String(sz)} style={[styles.sizeChip, { backgroundColor: bg }]}>
              <Text style={[styles.sizeChipTxt, { color: col }]}>{String(sz)}: {qn}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const Item = ({ item }) => {
    const tStock = num(item.__totalStock, totalStockOf(item));
    const low = tStock > 0 && tStock <= 5;
    const stockBg = tStock <= 0 ? "#F3F4F6" : low ? "#FFF3E0" : "#E8FFF4";
    const stockCol = tStock <= 0 ? "#9CA3AF" : low ? C.warn : C.ok;

    return (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.stockPill, { backgroundColor: stockBg }]}>
            <Ionicons name={tStock <= 0 ? "alert-circle" : low ? "alert" : "cube-outline"} size={14} color={stockCol} />
            <Text style={[styles.stockPillTxt, { color: stockCol }]}>
              {"  "}Tồn: {tStock}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.meta} numberOfLines={1}>Hãng: {item.brand || "-"}</Text>
          <Text style={styles.meta} numberOfLines={1}>Danh mục: {item.category || "-"}</Text>
        </View>

        {renderSizeChips(item)}

        <View style={styles.hr} />

        <View style={styles.rowBetween}>
          <Text style={styles.price}>
            Giá: {price(item.price)}{item.discount ? `  (-${item.discount}%)` : ""}
          </Text>
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: C.accent }]}
              onPress={() => navigation.navigate("AdminProductEdit", { product: item })}
            >
              <Ionicons name="create-outline" size={16} color="#fff" />
              <Text style={styles.btnTxt}>Sửa</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: C.danger }]}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash-outline" size={16} color="#fff" />
              <Text style={styles.btnTxt}>Xoá</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header (giữ nguyên bố cục) */}
      <LinearGradient colors={[C.header1, C.header2]} style={styles.header}>
        <StatusBar barStyle="light-content" backgroundColor={C.header1} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Danh sách sản phẩm</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("AdminProductEdit")}
          style={[styles.iconBtn, styles.addIcon]}
        >
          <Ionicons name="add" size={22} color={C.white} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Tìm kiếm (giữ nguyên bố cục) */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={C.soft} />
        <TextInput
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          placeholder="Tìm theo tên / hãng / danh mục..."
          placeholderTextColor={C.soft}
        />
        {!!q && (
          <TouchableOpacity onPress={() => setQ("")}>
            <Ionicons name="close-circle" size={18} color="#AEB6BF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Danh sách */}
      {loading ? (
        <ActivityIndicator color={C.header2} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={Array.isArray(view) ? view : []}
          keyExtractor={(it, idx) => String(it?.id ?? idx)}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => item ? <Item item={item} /> : null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.header2]} />
          }
          ListEmptyComponent={
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: C.soft }}>Không có sản phẩm.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 10 : 50,
    paddingBottom: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    elevation: 6,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  iconBtn: { padding: 6 },
  headerTitle: { flex: 1, color: C.white, fontWeight: "700" },
  addIcon: { backgroundColor: "#ffffff22", borderRadius: 10 },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, color: C.text },

  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { color: C.text, fontWeight: "800", flex: 1, marginRight: 10 },
  stockPill: { flexDirection: "row", alignItems: "center", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  stockPillTxt: { fontWeight: "800" },

  metaRow: { flexDirection: "row", gap: 12, marginTop: 6 },
  meta: { color: C.soft, flex: 1 },

  sizeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  sizeChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  sizeChipTxt: { fontWeight: "800" },

  hr: { height: 1, backgroundColor: C.line, marginVertical: 10 },

  price: { color: C.text, fontWeight: "700" },
  btnRow: { flexDirection: "row", gap: 8 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnTxt: { color: "#fff", fontWeight: "800" },
});
