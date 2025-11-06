// screens/AdminSettingsScreen.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  TextInput, Alert, StatusBar, Platform, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { emitSettings } from "../utils/settingsBus";
import { resolveThemeMode, getGradientColors, getScreenBackground } from "../utils/theme";

const SETTINGS_KEY = "admin_settings_v1";
const defaultSettings = {
  notificationsEnabled: true,
  soundEnabled: true,
  popupAutoCloseSec: 0,
  badgeMax: 9,
  lowStockThreshold: 5,
  theme: "system", // system | light | dark
};

export default function AdminSettingsScreen({ navigation }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [adminEmail, setAdminEmail] = useState("");

  const themeMode = useMemo(() => resolveThemeMode(settings.theme), [settings.theme]);
  const gradientColors = useMemo(() => getGradientColors(themeMode), [themeMode]);
  const screenBg = useMemo(() => getScreenBackground(themeMode), [themeMode]);

  const loadSettings = useCallback(async () => {
    try {
      const json = await AsyncStorage.getItem(SETTINGS_KEY);
      if (json) setSettings((prev) => ({ ...prev, ...JSON.parse(json) }));
      const profileJson = await AsyncStorage.getItem("userInfo");
      if (profileJson) {
        const info = JSON.parse(profileJson);
        setAdminEmail(info?.email || "");
      }
    } catch {}
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // áp dụng + phát + lưu (để các màn update ngay)
  const applyAndPersist = async (next) => {
    setSettings(next);
    emitSettings(next);
    try { await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
  };

  const updateField = (patch) => applyAndPersist({ ...settings, ...patch });

  const saveSettings = async () => {
    await applyAndPersist(settings);
    Alert.alert("Đã lưu", "Cài đặt đã được lưu.");
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(["userToken", "userInfo"]);
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <LinearGradient colors={gradientColors} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cài đặt Admin</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Tài khoản */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tài khoản</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{adminEmail || "—"}</Text>
          </View>
         
        </View>

        {/* Thông báo */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thông báo</Text>
          <View className="rowBetween" style={styles.rowBetween}>
            <Text style={styles.label}>Bật thông báo realtime</Text>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(v) => updateField({ notificationsEnabled: v })}
            />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Rung nhẹ khi có đơn</Text>
            <Switch
              value={settings.soundEnabled}
              onValueChange={(v) => updateField({ soundEnabled: v })}
            />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Tự đóng popup (giây, 0 = tắt)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(settings.popupAutoCloseSec)}
              onChangeText={(t) =>
                updateField({ popupAutoCloseSec: Math.max(0, parseInt(t || "0", 10) || 0) })
              }
            />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Badge tối đa trên chuông</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(settings.badgeMax)}
              onChangeText={(t) => {
                const n = Math.min(99, Math.max(1, parseInt(t || "1", 10) || 1));
                updateField({ badgeMax: n });
              }}
            />
          </View>
        </View>

        {/* Kho hàng */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kho hàng</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Ngưỡng cảnh báo tồn kho thấp</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(settings.lowStockThreshold)}
              onChangeText={(t) =>
                updateField({ lowStockThreshold: Math.max(0, parseInt(t || "0", 10) || 0) })
              }
            />
          </View>
        </View>

        {/* Giao diện (live preview) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Giao diện</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Chủ đề</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {["system", "light", "dark"].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.themeBtn, settings.theme === opt && styles.themeBtnActive]}
                  onPress={() => updateField({ theme: opt })} // đổi là áp ngay (emit + lưu)
                >
                  <Text style={[styles.themeText, settings.theme === opt && { color: "#fff" }]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={{ color: "#6b7280", marginTop: 6 }}>
          </Text>
        </View>

        {/* Hành động */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#2D9CDB" }]}
            onPress={saveSettings}
          >
            <Ionicons name="save-outline" size={18} color="#fff" />
            <Text style={styles.btnText}>Lưu cài đặt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#E74C3C" }]}
            onPress={logout}
          >
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.btnText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 10 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 10 : 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
  },
  cardTitle: { fontWeight: "bold", fontSize: 16, marginBottom: 10, color: "#2C3E50" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  label: { color: "#2C3E50", fontSize: 14, flex: 1, paddingRight: 10 },
  value: { color: "#34495E", fontWeight: "600" },
  input: {
    width: 80, backgroundColor: "#F3F6F9", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    textAlign: "center", color: "#2C3E50",
  },
  themeBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#D1D9E6",
  },
  themeBtnActive: { backgroundColor: "#2D9CDB", borderColor: "#2D9CDB" },
  themeText: { color: "#2C3E50", fontWeight: "600", textTransform: "capitalize" },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, gap: 6 },
  btnText: { color: "#fff", fontWeight: "bold" },
  btnOutline: {
    marginTop: 10, gap: 6, borderWidth: 1, borderColor: "#2C3E50", borderRadius: 10,
    paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center",
  },
  btnOutlineText: { fontWeight: "700", color: "#2C3E50", marginLeft: 6 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
});
