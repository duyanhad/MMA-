// screens/AdminInventoryScreen.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  Image,
  StatusBar,
  Platform,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");
// const API_URL = "http://192.168.1.103:3000";
const API_URL = "https://mma-3kpy.onrender.com";
const TABS = [
  { key: "all", label: "Tất cả" },
  { key: "low", label: "Sắp hết" },    // size qty < 5
  { key: "mid", label: "Trung bình" }, // 5 <= qty <= 20
  { key: "high", label: "Nhiều" },     // qty > 20
];

const isLow  = (q) => Number(q) < 5;
const isMid  = (q) => Number(q) >= 5 && Number(q) <= 20;
const isHigh = (q) => Number(q) > 20;

/* ---------- helpers client ---------- */
const sumStockFromObj = (obj) =>
  Object.values(obj || {}).reduce((s, v) => s + Number(v || 0), 0);
const cloneSizeStocks = (obj) => JSON.parse(JSON.stringify(obj || {}));

export default function AdminInventoryScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);    // full data
  const [filtered, setFiltered] = useState([]);    // filtered by search/tab
  const [selectedTab, setSelectedTab] = useState("all");
  const [search, setSearch] = useState("");

  const [sizeModal, setSizeModal] = useState({
    visible: false,
    product: null,
    newSize: "",
    newQty: "",
  });

  // flash qty when change
  const [flashMap, setFlashMap] = useState({}); // { "pid:sizeKey": true }
  const flashQty = (pid, sizeKey) => {
    const k = `${pid}:${sizeKey}`;
    setFlashMap((m) => ({ ...m, [k]: true }));
    setTimeout(() => {
      setFlashMap((m) => {
        const n = { ...m };
        delete n[k];
        return n;
      });
    }, 300);
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = () =>
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();

  const normalize = (arr) =>
    (Array.isArray(arr) ? arr : []).map((p) => ({
      ...p,
      size_stocks: p?.size_stocks && typeof p.size_stocks === "object" ? p.size_stocks : {},
    }));

  const getSizeEntries = (item) => {
    const entries = Object.entries(item.size_stocks || {});
    if (entries.length > 0) return entries;
    return [["Tổng", Number(item.stock || 0)]];
  };

  const filterSizeEntriesByTab = (entries, tab) => {
    if (tab === "all") return entries;
    if (tab === "low")  return entries.filter(([, q]) => isLow(q));
    if (tab === "mid")  return entries.filter(([, q]) => isMid(q));
    if (tab === "high") return entries.filter(([, q]) => isHigh(q));
    return entries;
  };

  const getStockColor = (stock) => {
    if ((stock || 0) < 5) return "#E74C3C";
    if ((stock || 0) <= 20) return "#F1C40F";
    return "#27AE60";
  };

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/api/admin/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Không thể tải kho hàng.");
      const norm = normalize(data);
      setProducts(norm);
      filterProducts(norm, search, selectedTab);
      fadeIn();
    } catch (e) {
      console.log("❌ Lỗi tải kho:", e.message);
      Alert.alert("Lỗi", e.message || "Không thể tải kho hàng.");
    } finally {
      setLoading(false);
    }
  }, [search, selectedTab]);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  const filterProducts = (list, keyword, tab) => {
    const q = (keyword || "").toLowerCase();
    const out = list.filter((item) => {
      if (q) {
        const hit =
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.brand && item.brand.toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (tab === "all") return true;
      const entries = getSizeEntries(item);
      const match = filterSizeEntriesByTab(entries, tab);
      return match.length > 0;
    });
    setFiltered(out);
  };

  useEffect(() => {
    filterProducts(products, search, selectedTab);
  }, [products, search, selectedTab]);

  const sizeStats = useMemo(() => {
    let low = 0, mid = 0, high = 0;
    for (const p of products) {
      const entries = getSizeEntries(p);
      for (const [, q] of entries) {
        if (isLow(q)) low++;
        else if (isMid(q)) mid++;
        else if (isHigh(q)) high++;
      }
    }
    return { low, mid, high, totalSizes: low + mid + high };
  }, [products]);

  /* ---------- apply server result into states (list + modal) ---------- */
  const applyProductUpdate = (updatedProduct) => {
    setProducts((prev) =>
      normalize(prev.map((p) => (p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p)))
    );
    setSizeModal((prev) => {
      if (!prev.visible || !prev.product || prev.product.id !== updatedProduct.id) return prev;
      return { ...prev, product: { ...prev.product, ...updatedProduct } };
    });
  };

  /* ---------- optimistic local updates for instant UI ---------- */
  const optimisticAdjust = (product, size, delta) => {
    const before = {
      id: product.id,
      size_stocks: cloneSizeStocks(product.size_stocks),
      stock: Number(product.stock || 0),
    };

    let after = {
      ...product,
      size_stocks: cloneSizeStocks(product.size_stocks),
      stock: Number(product.stock || 0),
    };

    if (size === "__TOTAL__") {
      after.stock = Math.max(0, Number(after.stock || 0) + Number(delta || 0));
      flashQty(product.id, "__TOTAL__");
    } else {
      const cur = Number(after.size_stocks?.[size] || 0);
      const next = Math.max(0, cur + Number(delta || 0));
      if (!after.size_stocks) after.size_stocks = {};
      after.size_stocks[size] = next;
      after.stock = sumStockFromObj(after.size_stocks);
      flashQty(product.id, size);
    }

    // update modal product immediately
    setSizeModal((prev) => {
      if (!prev.visible || !prev.product || prev.product.id !== product.id) return prev;
      return { ...prev, product: { ...prev.product, ...after } };
    });

    // update list immediately
    setProducts((prev) =>
      normalize(prev.map((p) => (p.id === product.id ? { ...p, ...after } : p)))
    );

    return { before, after };
  };

  const rollbackAdjust = (snapshot) => {
    const { id, size_stocks, stock } = snapshot;
    setProducts((prev) =>
      normalize(prev.map((p) => (p.id === id ? { ...p, size_stocks, stock } : p)))
    );
    setSizeModal((prev) => {
      if (!prev.visible || !prev.product || prev.product.id !== id) return prev;
      return { ...prev, product: { ...prev.product, size_stocks, stock } };
    });
  };

  // Cập nhật size (dùng trong modal) — optimistic
  const updateSizeInline = async (productId, size, change) => {
    // lấy product hiện tại
    const product = (sizeModal.product && sizeModal.product.id === productId)
      ? sizeModal.product
      : products.find((p) => p.id === productId);
    if (!product) return;

    const snapshot = {
      id: productId,
      size_stocks: cloneSizeStocks(product.size_stocks),
      stock: Number(product.stock || 0),
    };

    // optimistic
    optimisticAdjust(product, size, change);

    try {
      const token = await AsyncStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/api/admin/inventory/update-size`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productId: Number(productId),
          size: String(size),
          change: Number(change),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Lỗi cập nhật size");
      applyProductUpdate(data.product);
    } catch (e) {
      rollbackAdjust(snapshot);
      Alert.alert("Lỗi", e.message || "Không thể cập nhật size.");
    }
  };

  // Cập nhật TỒN TỔNG (khi KHÔNG có size) — optimistic
  const updateTotalInline = async (productId, change) => {
    const product = (sizeModal.product && sizeModal.product.id === productId)
      ? sizeModal.product
      : products.find((p) => p.id === productId);
    if (!product) return;

    const snapshot = {
      id: productId,
      size_stocks: cloneSizeStocks(product.size_stocks),
      stock: Number(product.stock || 0),
    };

    optimisticAdjust(product, "__TOTAL__", change);

    try {
      const token = await AsyncStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/api/admin/inventory/update-stock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: Number(productId), change: Number(change) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Lỗi cập nhật tồn tổng");
      applyProductUpdate(data.product);
    } catch (e) {
      rollbackAdjust(snapshot);
      Alert.alert("Lỗi", e.message || "Không thể cập nhật tồn tổng.");
    }
  };

  // Modal size chi tiết (set số lượng)
  const openSizeModal = (product) =>
    setSizeModal({ visible: true, product, newSize: "", newQty: "" });
  const closeSizeModal = () =>
    setSizeModal({ visible: false, product: null, newSize: "", newQty: "" });

  const setSizeQty = async (size, qty) => {
    if (!sizeModal.product) return;
    // optimistic set
    const prev = {
      id: sizeModal.product.id,
      size_stocks: cloneSizeStocks(sizeModal.product.size_stocks),
      stock: Number(sizeModal.product.stock || 0),
    };
    const next = cloneSizeStocks(sizeModal.product.size_stocks);
    next[size] = Math.max(0, Number(qty || 0));
    const nextStock = sumStockFromObj(next);

    // apply local
    setSizeModal((s) => ({ ...s, product: { ...s.product, size_stocks: next, stock: nextStock } }));
    setProducts((prevList) =>
      normalize(prevList.map((p) =>
        p.id === sizeModal.product.id ? { ...p, size_stocks: next, stock: nextStock } : p
      ))
    );
    flashQty(sizeModal.product.id, size);

    try {
      const token = await AsyncStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/api/admin/inventory/set-size`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productId: Number(sizeModal.product.id),
          size: String(size),
          quantity: Number(qty),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Lỗi đặt số lượng size");
      applyProductUpdate(data.product);
      setSizeModal((s) => ({ ...s, newSize: "", newQty: "" }));
    } catch (e) {
      rollbackAdjust(prev);
      Alert.alert("Lỗi", e.message);
    }
  };

  // UI: hiển thị phần size theo tab (TRÊN THẺ) — không có nút cộng/trừ ở đây
  const renderSizeArea = (item) => {
    if (selectedTab === "all") {
      return (
        <TouchableOpacity
          style={[styles.sizeManageBtn, { marginTop: 8 }]}
          onPress={() => openSizeModal(item)}
        >
          <Ionicons name="build-outline" size={16} color="#fff" />
          <Text style={styles.sizeManageBtnText}>Quản lý size</Text>
        </TouchableOpacity>
      );
    }

    const allEntries = getSizeEntries(item);
    const entries = filterSizeEntriesByTab(allEntries, selectedTab);
    if (entries.length === 0) return null;

    return (
      <View style={styles.sizeWrap}>
        {entries.map(([sz, qty]) => (
          <View key={sz} style={styles.sizeChip}>
            <View style={styles.sizeLabel}>
              <Text style={styles.sizeLabelTxt}>{sz}</Text>
            </View>
            <Text style={styles.sizeQty}>SL: {qty}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const img = item.image_url || "https://via.placeholder.com/100";
    return (
      <Animated.View style={[styles.card, { borderLeftColor: getStockColor(item.stock || 0), opacity: fadeAnim }]}>
        <Image source={{ uri: img }} style={styles.image} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          {!!item.brand && <Text style={styles.brand}>{item.brand}</Text>}
          <Text style={styles.stock}>Tồn tổng: {item.stock ?? 0}</Text>

          {renderSizeArea(item)}

          {selectedTab !== "all" && (
            <TouchableOpacity
              style={[styles.sizeManageBtn, { marginTop: 8 }]}
              onPress={() => openSizeModal(item)}
            >
              <Ionicons name="build-outline" size={16} color="#fff" />
              <Text style={styles.sizeManageBtnText}>Quản lý size</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <LinearGradient colors={["#0F2027", "#203A43", "#2C5364"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <StatusBar barStyle="light-content" />
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý kho</Text>
        <TouchableOpacity onPress={loadInventory} style={{ padding: 6 }}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats theo size */}
      <View style={styles.statRow}>
        <View style={[styles.statBox, { backgroundColor: "#118AB2" }]}>
          <Text style={styles.statNum}>
            {products.reduce((acc, p) => acc + getSizeEntries(p).length, 0)}
          </Text>
          <Text style={styles.statLabel}>Tổng </Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: "#E74C3C" }]}>
          <Text style={styles.statNum}>
            {products.reduce((acc, p) => acc + getSizeEntries(p).filter(([, q]) => isLow(q)).length, 0)}
          </Text>
          <Text style={styles.statLabel}>Sắp hết</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: "#F1C40F" }]}>
          <Text style={styles.statNum}>
            {products.reduce((acc, p) => acc + getSizeEntries(p).filter(([, q]) => isMid(q)).length, 0)}
          </Text>
          <Text style={styles.statLabel}>Trung bình</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: "#27AE60" }]}>
          <Text style={styles.statNum}>
            {products.reduce((acc, p) => acc + getSizeEntries(p).filter(([, q]) => isHigh(q)).length, 0)}
          </Text>
          <Text style={styles.statLabel}>Nhiều</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#555" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo tên / thương hiệu..."
          placeholderTextColor="#888"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearch("");
              filterProducts(products, "", selectedTab);
            }}
          >
            <Ionicons name="close-circle" size={18} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const active = selectedTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem, active && styles.tabActive]}
              onPress={() => setSelectedTab(t.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color="#FFD166" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 30 }}
          ListEmptyComponent={
            <Text style={{ color: "#fff", textAlign: "center", marginTop: 30 }}>
              Không có sản phẩm.
            </Text>
          }
        />
      )}

      {/* Modal quản lý size */}
      <Modal visible={sizeModal.visible} transparent animationType="fade" onRequestClose={closeSizeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              Quản lý size – {sizeModal.product?.name || ""}
            </Text>

            <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ paddingBottom: 4 }}>
              {(
                sizeModal.product?.size_stocks &&
                Object.keys(sizeModal.product.size_stocks).length > 0
                  ? Object.entries(sizeModal.product.size_stocks)
                  : [["Tổng", Number(sizeModal.product?.stock ?? 0)]]
              ).map(([sz, qty]) => {
                const onlyTotalInModal =
                  (!sizeModal.product?.size_stocks ||
                    Object.keys(sizeModal.product.size_stocks).length === 0) &&
                  sz === "Tổng";

                const flashOn = flashMap[`${sizeModal.product?.id}:${onlyTotalInModal ? "__TOTAL__" : sz}`];

                return (
                  <View key={sz} style={styles.sizeRow}>
                    {/* Tên size */}
                    <View style={styles.sizeBadge}>
                      <Text style={{ fontWeight: "700" }}>{sz}</Text>
                    </View>

                    {/* Số lượng (có hiệu ứng flash nền) */}
                    <View style={[
                      styles.qtyBox,
                      flashOn && styles.qtyBoxFlash
                    ]}>
                      <Text style={styles.qtyText}>SL: {qty}</Text>
                    </View>

                    {/* Cụm nút bên phải: [-] [+] [+5] */}
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <LinearGradient colors={["#6C5CE7", "#4E54C8"]} style={styles.actionBtn}>
                        <TouchableOpacity
                          onPress={() =>
                            onlyTotalInModal
                              ? updateTotalInline(sizeModal.product.id, -1)
                              : updateSizeInline(sizeModal.product.id, sz, -1)
                          }
                          activeOpacity={0.85}
                          style={styles.actionInner}
                        >
                          <Ionicons name="remove" size={18} color="#fff" />
                        </TouchableOpacity>
                      </LinearGradient>

                      <LinearGradient colors={["#00B894", "#00A885"]} style={[styles.actionBtn, { marginLeft: 8 }]}>
                        <TouchableOpacity
                          onPress={() =>
                            onlyTotalInModal
                              ? updateTotalInline(sizeModal.product.id, +1)
                              : updateSizeInline(sizeModal.product.id, sz, +1)
                          }
                          activeOpacity={0.85}
                          style={styles.actionInner}
                        >
                          <Ionicons name="add" size={18} color="#fff" />
                        </TouchableOpacity>
                      </LinearGradient>

                      <LinearGradient colors={["#3498DB", "#2980B9"]} style={[styles.actionBtn, { marginLeft: 8 }]}>
                        <TouchableOpacity
                          onPress={() =>
                            onlyTotalInModal
                              ? updateTotalInline(sizeModal.product.id, +5)
                              : updateSizeInline(sizeModal.product.id, sz, +5)
                          }
                          activeOpacity={0.85}
                          style={styles.actionInner}
                        >
                          <Text style={styles.actionText}>+5</Text>
                        </TouchableOpacity>
                      </LinearGradient>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.addSizeRow}>
              <TextInput
                placeholder="Size (vd: 37)"
                placeholderTextColor="#999"
                value={sizeModal.newSize}
                onChangeText={(t) => setSizeModal((s) => ({ ...s, newSize: t }))}
                style={styles.addSizeInput}
              />
              <TextInput
                placeholder="SL"
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={sizeModal.newQty}
                onChangeText={(t) => setSizeModal((s) => ({ ...s, newQty: t }))}
                style={styles.addQtyInput}
              />
              <TouchableOpacity
                onPress={() => {
                  const sz = (sizeModal.newSize || "").trim();
                  const q = Number(sizeModal.newQty || 0);
                  if (!sz || !Number.isFinite(q)) return Alert.alert("Lỗi", "Nhập size và số lượng hợp lệ.");
                  setSizeQty(sz, q);
                }}
                style={styles.saveSizeBtn}
                activeOpacity={0.9}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Lưu</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.totalText}>Tổng tồn: {sizeModal.product?.stock ?? 0}</Text>

            <View style={{ alignItems: "flex-end", marginTop: 8 }}>
              <TouchableOpacity onPress={closeSizeModal} style={styles.closeBtn}>
                <Text style={{ color: "#E74C3C", fontWeight: "700" }}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
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
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold", letterSpacing: 0.5 },

  statRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12 },
  statBox: { flex: 1, marginHorizontal: 4, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  statNum: { color: "#fff", fontWeight: "800", fontSize: 18 },
  statLabel: { color: "#fff", opacity: 0.9, marginTop: 2, fontSize: 12 },

  searchBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    marginHorizontal: 12, marginTop: 10, borderRadius: 24,
    paddingHorizontal: 14, paddingVertical: 8, elevation: 3, gap: 8,
  },
  searchInput: { flex: 1, marginLeft: 8, color: "#333", fontSize: 15 },

  tabRow: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 10, marginTop: 10, marginBottom: 6 },
  tabItem: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: "#ffffff40" },
  tabActive: { backgroundColor: "#FFD166" },
  tabText: { color: "#fff", fontWeight: "600" },
  tabTextActive: { color: "#333" },

  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: 10,
    marginBottom: 12,
    padding: 10,
    alignItems: "flex-start",
    elevation: 2,
    borderLeftWidth: 6,
  },
  image: { width: 65, height: 65, borderRadius: 10, backgroundColor: "#ECF0F1" },
  name: { fontSize: 15, fontWeight: "bold", color: "#2C3E50" },
  brand: { fontSize: 13, color: "#7F8C8D", marginTop: 2 },
  stock: { fontSize: 13, color: "#34495E", marginTop: 4 },

  // size inline
  sizeWrap: { marginTop: 8, flexWrap: "wrap" },
  sizeChip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F7F9FC", borderWidth: 1, borderColor: "#EEF2F7",
    paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, marginTop: 6,
  },
  sizeLabel: {
    minWidth: 36, paddingVertical: 4, paddingHorizontal: 8,
    backgroundColor: "#ECF0F1", borderRadius: 8, alignItems: "center", marginRight: 8,
  },
  sizeLabelTxt: { fontWeight: "700", color: "#2C3E50" },
  sizeQty: { color: "#2C3E50", marginRight: 8, fontSize: 12 },

  sizeManageBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#8E44AD", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8
  },
  sizeManageBtnText: { color: "#fff", fontWeight: "700", marginLeft: 6, fontSize: 12 },

  // modal
  modalBackdrop: {
    position: "absolute", left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center",
  },
  modalBox: { width: width * 0.92, backgroundColor: "#fff", borderRadius: 14, padding: 14 },
  modalTitle: { fontWeight: "800", fontSize: 16, marginBottom: 6, color: "#2C3E50" },

  sizeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee"
  },
  sizeBadge: {
    minWidth: 46,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#ECF0F1",
    borderRadius: 8,
    marginRight: 10,
    alignItems: "center"
  },

  // qty flash
  qtyBox: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  qtyBoxFlash: {
    backgroundColor: "#E8FFF3", // xanh nhạt flash
  },
  qtyText: { color: "#2C3E50" },

  // Pretty action buttons
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  actionInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  addSizeRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  addSizeInput: { flex: 1, borderWidth: 1, borderColor: "#eee", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginRight: 8, color: "#2C3E50" },
  addQtyInput: { width: 80, borderWidth: 1, borderColor: "#eee", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, textAlign: "center", marginRight: 8, color: "#2C3E50" },
  saveSizeBtn: { backgroundColor: "#27AE60", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  totalText: { marginTop: 10, color: "#2C3E50", fontWeight: "700" },
  closeBtn: { paddingHorizontal: 10, paddingVertical: 8 },
});
