// screens/AdminProductEdit.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, StatusBar, Platform
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { subscribeSettings } from "../utils/settingsBus";
import { resolveThemeMode, getGradientColors, getScreenBackground } from "../utils/theme";

const API_URL = "http://192.168.1.102:3000";
const SETTINGS_KEY = "admin_settings_v1";

export default function AdminProductEdit({ route, navigation }) {
  const product = route?.params?.product || null;

  const [settings, setSettings] = useState({ theme: "system" });
  const themeMode = resolveThemeMode(settings.theme);
  const gradientColors = getGradientColors(themeMode);
  const screenBg = getScreenBackground(themeMode);

  const [form, setForm] = useState({
    name: product?.name || "",
    brand: product?.brand || "",
    category: product?.category || "",
    price: product?.price != null ? String(product.price) : "",
    discount: product?.discount != null ? String(product.discount) : "0",
    sizes: Array.isArray(product?.sizes) ? product.sizes.join(",") : "",
    image_url: product?.image_url || "",
    description: product?.description || "",
    stock: product?.stock != null ? String(product.stock) : "0",
  });

  const [saving, setSaving] = useState(false);
  const isEdit = useMemo(() => !!product?.id, [product]);

  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(SETTINGS_KEY);
        if (json) setSettings((p) => ({ ...p, ...JSON.parse(json) }));
      } catch {}
    })();
  }, []);
  useEffect(() => subscribeSettings((next) => setSettings((p) => ({ ...p, ...next }))), []);

  const getToken = useCallback(async () => {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) {
      Alert.alert("Phiên đăng nhập hết hạn", "Vui lòng đăng nhập lại.");
      return null;
    }
    return token;
  }, []);

  const onChange = (patch) => setForm((f) => ({ ...f, ...patch }));

  const validate = () => {
    if (!form.name?.trim()) return "Tên sản phẩm không được bỏ trống.";
    if (!form.price || isNaN(Number(form.price))) return "Giá không hợp lệ.";
    if (isNaN(Number(form.discount))) return "Giảm giá không hợp lệ.";
    if (isNaN(Number(form.stock))) return "Tồn kho không hợp lệ.";
    return null;
    };

  const buildPayload = () => {
    const sizesArr = form.sizes
      ? form.sizes.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    return {
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category.trim(),
      price: Number(form.price),
      discount: Number(form.discount || 0),
      sizes: sizesArr,
      image_url: form.image_url.trim(),
      description: form.description.trim(),
      stock: Number(form.stock || 0),
      // giữ id cũ khi sửa (backend theo model của bạn có cả "id" auto-increment)
      ...(product?.id ? { id: product.id } : {}),
    };
  };

  const handleSave = async () => {
    const msg = validate();
    if (msg) return Alert.alert("Lỗi", msg);

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;

      const payload = buildPayload();
      const url = isEdit
        ? `${API_URL}/api/admin/inventory/${product.id}`
        : `${API_URL}/api/admin/inventory`;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Lưu sản phẩm thất bại");

      Alert.alert("Thành công", isEdit ? "Đã cập nhật sản phẩm." : "Đã thêm sản phẩm.");
      navigation.goBack(); // quay lại list
    } catch (e) {
      Alert.alert("Lỗi", e.message || "Không thể lưu sản phẩm.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <LinearGradient colors={gradientColors} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? "Sửa sản phẩm" : "Thêm sản phẩm"}</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 14 }}>
        <View style={styles.card}>
          <Text style={styles.label}>Tên sản phẩm *</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => onChange({ name: v })}
            placeholder="Nhập tên sản phẩm"
          />

          <Text style={styles.label}>Thương hiệu</Text>
          <TextInput
            style={styles.input}
            value={form.brand}
            onChangeText={(v) => onChange({ brand: v })}
            placeholder="VD: Nike, Adidas..."
          />

          <Text style={styles.label}>Danh mục</Text>
          <TextInput
            style={styles.input}
            value={form.category}
            onChangeText={(v) => onChange({ category: v })}
            placeholder="VD: Giày chạy, Sneaker..."
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Giá *</Text>
              <TextInput
                style={styles.input}
                value={form.price}
                onChangeText={(v) => onChange({ price: v })}
                keyboardType="numeric"
                placeholder="VD: 1500000"
              />
            </View>
            <View style={{ width: 110 }}>
              <Text style={styles.label}>Giảm (%)</Text>
              <TextInput
                style={styles.input}
                value={form.discount}
                onChangeText={(v) => onChange({ discount: v })}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
          </View>

          <Text style={styles.label}>Sizes (ngăn cách bằng dấu phẩy)</Text>
          <TextInput
            style={styles.input}
            value={form.sizes}
            onChangeText={(v) => onChange({ sizes: v })}
            placeholder="VD: 38,39,40,41,42"
          />

          <Text style={styles.label}>Ảnh (URL)</Text>
          <TextInput
            style={styles.input}
            value={form.image_url}
            onChangeText={(v) => onChange({ image_url: v })}
            placeholder="https://..."
          />

          <Text style={styles.label}>Mô tả</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: "top" }]}
            value={form.description}
            onChangeText={(v) => onChange({ description: v })}
            placeholder="Mô tả sản phẩm"
            multiline
          />

          <Text style={styles.label}>Tồn kho</Text>
          <TextInput
            style={styles.input}
            value={form.stock}
            onChangeText={(v) => onChange({ stock: v })}
            keyboardType="numeric"
            placeholder="0"
          />

          <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.btnText}>{isEdit ? "Cập nhật" : "Thêm mới"}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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

  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14, elevation: 2,
  },
  label: { fontSize: 13, color: "#2C3E50", marginTop: 10, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: "#F3F6F9", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: "#2C3E50",
  },
  btn: {
    marginTop: 16, backgroundColor: "#3498DB", borderRadius: 12,
    alignItems: "center", justifyContent: "center", paddingVertical: 12, flexDirection: "row", gap: 8,
  },
  btnText: { color: "#fff", fontWeight: "bold" },
});
