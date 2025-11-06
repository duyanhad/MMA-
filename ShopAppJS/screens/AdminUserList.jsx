// screens/AdminUserList.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  StatusBar,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

import { subscribeSettings } from "../utils/settingsBus";
import {
  resolveThemeMode,
  getGradientColors,
  getScreenBackground,
} from "../utils/theme";

// const API_URL = "http://192.168.1.103:3000";
const API_URL = "https://mma-3kpy.onrender.com";
const SETTINGS_KEY = "admin_settings_v1";

const ROLE_TABS = [
  { label: "Tất cả", value: "all" },
  { label: "Admin", value: "admin" },
  { label: "Khách", value: "customer" },
];

export default function AdminUserList({ navigation }) {
  // ===== Theme =====
  const [settings, setSettings] = useState({ theme: "system" });
  const themeMode = resolveThemeMode(settings.theme);
  const gradientColors = getGradientColors(themeMode);
  const screenBg = getScreenBackground(themeMode);

  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(SETTINGS_KEY);
        if (json) setSettings((p) => ({ ...p, ...JSON.parse(json) }));
      } catch {}
    })();
  }, []);
  useEffect(
    () => subscribeSettings((next) => setSettings((p) => ({ ...p, ...next }))),
    []
  );

  // ===== State =====
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [onlyBlocked, setOnlyBlocked] = useState(false);

  // ===== Helpers =====
  const getToken = useCallback(async () => {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) {
      Alert.alert("Phiên đăng nhập hết hạn", "Vui lòng đăng nhập lại.");
      return null;
    }
    return token;
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert("Lỗi", "Không thể tải danh sách người dùng.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers])
  );

  const filtered = useMemo(() => {
    const base = Array.isArray(users) ? users : [];
    const q = search.toLowerCase().trim();
    return base
      .filter((u) => (roleFilter === "all" ? true : (u?.role || "") === roleFilter))
      .filter((u) => (onlyBlocked ? u?.isBlocked === true : true))
      .filter((u) => {
        if (!q) return true;
        return (
          (u?.name || "").toLowerCase().includes(q) ||
          (u?.email || "").toLowerCase().includes(q)
        );
      });
  }, [users, roleFilter, search, onlyBlocked]);

  const toggleBlock = async (user) => {
    // Nếu backend chưa có API này → báo nhẹ nhàng
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/admin/users/${user.id}/block`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isBlocked: !user.isBlocked }),
      });

      // Nếu server không hỗ trợ, thường trả 404/405
      if (!res.ok) {
        let msg = "Máy chủ chưa hỗ trợ chặn/mở khóa người dùng.";
        try {
          const data = await res.json();
          if (data?.message) msg = data.message;
        } catch {}
        Alert.alert("Thông báo", msg);
        return;
      }

      const data = await res.json();
      // Cập nhật lại list local (không cần reload cả trang)
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isBlocked: !user.isBlocked } : u))
      );
      Alert.alert("Thành công", !user.isBlocked ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.");
    } catch (e) {
      Alert.alert("Lỗi", "Không thể cập nhật trạng thái tài khoản.");
    }
  };

  const renderItem = ({ item }) => {
    const isAdmin = (item?.role || "") === "admin";
    const blocked = item?.isBlocked === true;

    return (
      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {item?.name || "—"}
          </Text>
          <Text style={styles.email}>{item?.email || "—"}</Text>
          <View style={styles.row}>
            <View style={[styles.roleBadge, isAdmin ? styles.roleAdmin : styles.roleCustomer]}>
              <Ionicons
                name={isAdmin ? "shield-checkmark" : "person"}
                size={12}
                color={isAdmin ? "#1B5E20" : "#0D47A1"}
              />
              <Text
                style={[
                  styles.roleText,
                  isAdmin ? { color: "#1B5E20" } : { color: "#0D47A1" },
                ]}
              >
                {isAdmin ? "Admin" : "Khách"}
              </Text>
            </View>
            {blocked && (
              <View style={[styles.blockBadge]}>
                <Ionicons name="ban" size={12} color="#B71C1C" />
                <Text style={[styles.roleText, { color: "#B71C1C" }]}>Bị khóa</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconBtn}
            disabled={isAdmin} // ⛔ Không cho bấm với tài khoản admin
            onPress={() => {
              if (isAdmin) {
                Alert.alert("Không thể thao tác", "Bạn không thể khóa/mở khóa tài khoản admin.");
                return;
              }
              toggleBlock(item);
            }}
          >
            <Ionicons
              name={blocked ? "lock-open-outline" : "lock-closed-outline"}
              size={20}
              color={isAdmin ? "#B0BEC5" : blocked ? "#27AE60" : "#E74C3C"} // mờ khi là admin
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <LinearGradient colors={gradientColors} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Người dùng</Text>
        <TouchableOpacity onPress={loadUsers}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Tabs vai trò */}
      <View style={styles.tabRow}>
        {ROLE_TABS.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.tab, roleFilter === t.value && styles.tabActive]}
            onPress={() => setRoleFilter(t.value)}
          >
            <Text
              style={[styles.tabText, roleFilter === t.value && { color: "#fff" }]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Toggle Chỉ hiện bị khóa */}
        <TouchableOpacity
          onPress={() => setOnlyBlocked((v) => !v)}
          style={[styles.tab, onlyBlocked && styles.blockActive]}
        >
          <Text style={[styles.tabText, onlyBlocked && { color: "#fff" }]}>
            {onlyBlocked ? "Đang lọc: Khóa" : "Bị khóa"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo tên / email..."
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
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3498DB" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => String(u.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: "#888", marginTop: 40 }}>
              Không có người dùng.
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
    flexWrap: "wrap",
    gap: 6,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  tabActive: { backgroundColor: "#3498DB" },
  blockActive: { backgroundColor: "#E74C3C" },
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
  searchInput: { flex: 1, fontSize: 15, color: "#333" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    padding: 12,
    elevation: 2,
  },
  name: { fontSize: 15, fontWeight: "bold", color: "#2C3E50" },
  email: { fontSize: 13, color: "#7F8C8D", marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E3F2FD",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleAdmin: { backgroundColor: "#E8F5E9" },
  roleCustomer: { backgroundColor: "#E3F2FD" },
  roleText: { fontSize: 12, fontWeight: "700" },
  blockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFEBEE",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  actions: { marginLeft: 8, gap: 6, flexDirection: "row" },
  iconBtn: { padding: 8, alignItems: "center", justifyContent: "center" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
