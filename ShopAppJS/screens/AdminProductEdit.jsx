// screens/AdminProductEdit.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  StatusBar,
  Platform,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "https://mma-3kpy.onrender.com";
// const API_URL = "http://192.168.1.103:3000";
const C = {
  header1: "#184E77",
  header2: "#1E6091",
  white: "#fff",
  bg: "#F5F8FA",
  text: "#1F2A37",
  soft: "#6B7280",
  border: "#E5E7EB",
  accent: "#34A0A4",
  danger: "#EF4444",
  warn: "#FFA726",
  ok: "#06D6A0",
};

const num = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export default function AdminProductEdit({ route, navigation }) {
  const editing = route?.params?.product || null;

  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    price: "",
    discount: "",
    description: "",
    image_url: "",
    sizesText: "", // nhập nhanh "37,38,39"
  });

  const [rows, setRows] = useState([]); // [{size:'37', qty:5}, ...]
  const [loading, setLoading] = useState(false);

  // Load data khi sửa
  useEffect(() => {
    if (!editing) return;
    setForm({
      name: editing.name || "",
      brand: editing.brand || "",
      category: editing.category || "",
      price: String(editing.price ?? ""),
      discount: String(editing.discount ?? ""),
      description: editing.description || "",
      image_url: editing.image_url || "",
      sizesText: (editing.sizes || []).join(","),
    });

    // Ưu tiên size_stocks nếu có
    if (editing.size_stocks && typeof editing.size_stocks === "object") {
      const arr = Object.entries(editing.size_stocks).map(([k, v]) => ({
        size: String(k),
        qty: String(v ?? 0),
      }));
      setRows(arr);
    } else {
      // Không có size_stocks → nếu có sizes thì khởi tạo qty=0
      const arr = (editing.sizes || []).map((s) => ({ size: String(s), qty: "0" }));
      setRows(arr);
    }
  }, [editing]);

  // tổng tồn kho theo rows
  const totalStock = useMemo(
    () =>
      rows.reduce((s, r) => s + num(r.qty, 0), 0),
    [rows]
  );

  // đồng bộ từ input "sizesText" sang rows nhanh
  const explodeSizes = () => {
    if (!form.sizesText?.trim()) {
      Alert.alert("Thiếu size", "Nhập danh sách size, ví dụ: 37,38,39");
      return;
    }
    const list = form.sizesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Giữ số lượng cũ nếu đã tồn tại
    const mapOld = new Map(rows.map((r) => [r.size, r.qty]));
    const newRows = list.map((sz) => ({
      size: sz,
      qty: mapOld.has(sz) ? String(mapOld.get(sz)) : "0",
    }));
    setRows(newRows);
  };

  const addRow = () => {
    setRows((r) => [...r, { size: "", qty: "0" }]);
  };

  const removeRow = (idx) => {
    setRows((r) => r.filter((_, i) => i !== idx));
  };

  const setRow = (idx, patch) => {
    setRows((r) => r.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const save = async () => {
    try {
      // Validate
      if (!form.name.trim()) {
        Alert.alert("Thiếu tên", "Vui lòng nhập tên sản phẩm.");
        return;
      }
      const body = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        category: form.category.trim(),
        price: num(form.price, 0),
        discount: num(form.discount, 0),
        description: form.description.trim(),
        image_url: form.image_url.trim(),
      };

      // chuyển rows -> size_stocks object (bỏ size rỗng, qty < 0 => 0)
      const cleanRows = rows
        .filter((r) => r.size?.trim())
        .map((r) => ({ size: r.size.trim(), qty: Math.max(0, num(r.qty, 0)) }));

      if (cleanRows.length > 0) {
        const sMap = {};
        cleanRows.forEach((r) => (sMap[r.size] = r.qty));
        body.size_stocks = sMap;
        // không cần gửi stock & sizes, server sẽ tự tính
      } else {
        // Không quản lý theo size → có thể cho phép nhập stock tổng qua sizesText rỗng
        // Ở UI này, mình không thêm ô "stock tổng" để tránh rối;
        // nếu muốn, có thể set body.stock = num(form.stock, 0);
      }

      setLoading(true);
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        Alert.alert("Lỗi", "Phiên đăng nhập hết hạn.");
        return;
      }
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const url = editing
        ? `${API_URL}/api/admin/inventory/${editing.id}`
        : `${API_URL}/api/admin/inventory`;

      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Không thể lưu sản phẩm.");
      }

      Alert.alert("Thành công", editing ? "Đã cập nhật sản phẩm." : "Đã tạo sản phẩm.");
      navigation.goBack();
    } catch (e) {
      console.error("❌ Lưu sản phẩm lỗi:", e);
      Alert.alert("Lỗi", e.message || "Không thể lưu sản phẩm.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={[C.header1, C.header2]} style={styles.header}>
        <StatusBar barStyle="light-content" backgroundColor={C.header1} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {editing ? "Sửa sản phẩm" : "Thêm sản phẩm"}
        </Text>
        <View style={{ width: 32 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>
        {/* Thông tin cơ bản */}
        <View style={styles.card}>
          <Text style={styles.label}>Tên sản phẩm</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
            placeholder="Ví dụ: Nike Air ..."
            placeholderTextColor={C.soft}
          />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Thương hiệu</Text>
              <TextInput
                style={styles.input}
                value={form.brand}
                onChangeText={(t) => setForm((f) => ({ ...f, brand: t }))}
                placeholder="Nike / Adidas ..."
                placeholderTextColor={C.soft}
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Danh mục</Text>
              <TextInput
                style={styles.input}
                value={form.category}
                onChangeText={(t) => setForm((f) => ({ ...f, category: t }))}
                placeholder="Shoes ..."
                placeholderTextColor={C.soft}
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Giá (đ)</Text>
              <TextInput
                style={styles.input}
                value={form.price}
                onChangeText={(t) => setForm((f) => ({ ...f, price: t.replace(/\D/g, "") }))}
                keyboardType="numeric"
                placeholder="1990000"
                placeholderTextColor={C.soft}
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Giảm (%)</Text>
              <TextInput
                style={styles.input}
                value={form.discount}
                onChangeText={(t) => setForm((f) => ({ ...f, discount: t.replace(/\D/g, "") }))}
                keyboardType="numeric"
                placeholder="10"
                placeholderTextColor={C.soft}
              />
            </View>
          </View>

          <Text style={styles.label}>Ảnh (URL)</Text>
          <TextInput
            style={styles.input}
            value={form.image_url}
            onChangeText={(t) => setForm((f) => ({ ...f, image_url: t }))}
            placeholder="https://..."
            placeholderTextColor={C.soft}
          />

          <Text style={styles.label}>Mô tả</Text>
          <TextInput
            style={[styles.input, { height: 90, textAlignVertical: "top" }]}
            value={form.description}
            onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
            placeholder="Mô tả ngắn..."
            placeholderTextColor={C.soft}
            multiline
          />
        </View>

        {/* Quản lý size & tồn theo size */}
        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Tồn kho theo size</Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="cube-outline" size={18} color={C.ok} />
              <Text style={[styles.totalStock, { color: C.ok }]}>
                {"  "}Tổng: {totalStock}
              </Text>
            </View>
          </View>

          <Text style={styles.sublabel}>Nhập nhanh danh sách size (phân tách dấu phẩy)</Text>
          <View style={styles.row2}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={form.sizesText}
              onChangeText={(t) => setForm((f) => ({ ...f, sizesText: t }))}
              placeholder="VD: 37,38,39"
              placeholderTextColor={C.soft}
            />
            <View style={{ width: 10 }} />
            <TouchableOpacity style={styles.smallBtn} onPress={explodeSizes}>
              <Ionicons name="sparkles-outline" size={16} color="#fff" />
              <Text style={styles.smallBtnTxt}>Tạo size</Text>
            </TouchableOpacity>
          </View>

          {/* Bảng size_stocks */}
          <View style={{ marginTop: 10 }}>
            {rows.map((r, idx) => (
              <View key={`${idx}-${r.size}`} style={styles.sizeRowItem}>
                <TextInput
                  style={[styles.input, styles.sizeInput]}
                  value={r.size}
                  onChangeText={(t) => setRow(idx, { size: t })}
                  placeholder="Size"
                  placeholderTextColor={C.soft}
                />
                <TextInput
                  style={[styles.input, styles.qtyInput]}
                  value={String(r.qty)}
                  onChangeText={(t) => setRow(idx, { qty: t.replace(/\D/g, "") })}
                  placeholder="SL"
                  keyboardType="numeric"
                  placeholderTextColor={C.soft}
                />
                <TouchableOpacity onPress={() => removeRow(idx)} style={styles.delBtn}>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addBtn} onPress={addRow}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addBtnTxt}>Thêm size</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Lưu */}
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.saveText}>{editing ? "Cập nhật" : "Tạo mới"}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  headerTitle: { flex: 1, color: C.white, fontWeight: "700", fontSize: 16 },
  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginTop: 12,
  },
  label: { color: C.text, fontWeight: "700", marginBottom: 6 },
  sublabel: { color: C.soft, marginBottom: 6 },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.text,
    marginBottom: 10,
  },
  row2: { flexDirection: "row", alignItems: "center" },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionTitle: { color: C.text, fontWeight: "800" },
  totalStock: { fontWeight: "800" },

  sizeRowItem: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  sizeInput: { flex: 1, marginRight: 8 },
  qtyInput: { width: 90, marginRight: 8, textAlign: "right" },
  delBtn: {
    backgroundColor: C.danger,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addBtn: {
    backgroundColor: C.accent,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    flexDirection: "row",
    gap: 6,
  },
  addBtnTxt: { color: "#fff", fontWeight: "800" },
  smallBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  smallBtnTxt: { color: "#fff", fontWeight: "800" },

  saveBtn: {
    backgroundColor: "#1E6091",
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveText: { color: "#fff", fontWeight: "800" },
});
