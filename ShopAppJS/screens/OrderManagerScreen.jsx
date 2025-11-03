import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
  StatusBar,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import moment from "moment";

const API_URL = "http://192.168.1.102:3000";

export default function OrderManagerScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/api/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setOrders(data);
    } catch (err) {
      Alert.alert("Lỗi", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const updateStatus = async (id, status) => {
    Alert.alert(
      status === "Delivered" ? "Duyệt đơn hàng" : "Hủy đơn hàng",
      status === "Delivered"
        ? "Bạn có chắc chắn muốn duyệt đơn hàng này?"
        : "Bạn có chắc chắn muốn hủy đơn hàng này?",
      [
        { text: "Không", style: "cancel" },
        {
          text: "Đồng ý",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("userToken");
              const res = await fetch(`${API_URL}/api/admin/orders/${id}/status`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.message);
              loadOrders();
            } catch (err) {
              Alert.alert("Lỗi", err.message);
            }
          },
        },
      ]
    );
  };

  const filteredOrders = orders.filter((o) => {
    const matchStatus =
      filter === "All" ? true : o.status?.toLowerCase() === filter.toLowerCase();
    const matchSearch =
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.order_code?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const getColor = (status) => {
    if (status === "Pending") return "#F1C40F";
    if (status === "Delivered") return "#27AE60";
    if (status === "Cancelled") return "#E74C3C";
    return "#3498DB";
  };

  const formatPrice = (p) => (p ? p.toLocaleString("vi-VN") + " đ" : "0 đ");

  const renderOrder = ({ item }) => (
    <View style={[styles.card, { borderLeftColor: getColor(item.status) }]}>
      <View style={styles.row}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="receipt-outline" size={18} color="#3498DB" style={{ marginRight: 6 }} />
          <Text style={styles.orderCode}>#{item.order_code}</Text>
        </View>
        <Text
          style={[
            styles.status,
            { color: getColor(item.status) },
          ]}
        >
          {item.status === "Pending"
            ? "Chờ duyệt"
            : item.status === "Delivered"
            ? "Đã giao"
            : "Đã hủy"}
        </Text>
      </View>

      <Text style={styles.customer}>
        {item.customer_name} • {item.phone_number}
      </Text>
      <Text style={styles.address} numberOfLines={1}>
        {item.shipping_address}
      </Text>

      <View style={styles.rowBetween}>
        <Text style={styles.date}>
          {moment(item.created_at).format("HH:mm DD/MM/YYYY")}
        </Text>
        <Text style={styles.price}>{formatPrice(item.total_amount)}</Text>
      </View>

      {item.status === "Pending" && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#27AE60" }]}
            onPress={() => updateStatus(item.id, "Delivered")}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
            <Text style={styles.btnText}>Duyệt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#E74C3C" }]}
            onPress={() => updateStatus(item.id, "Cancelled")}
          >
            <Ionicons name="close-circle-outline" size={16} color="#fff" />
            <Text style={styles.btnText}>Hủy</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const TABS = [
    { label: "Tất cả", value: "All" },
    { label: "Chờ duyệt", value: "Pending" },
    { label: "Đã giao", value: "Delivered" },
    { label: "Đã hủy", value: "Cancelled" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#2C3E50", "#34495E"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý đơn hàng</Text>
        <TouchableOpacity onPress={loadOrders}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.tab, filter === t.value && styles.tabActive]}
            onPress={() => setFilter(t.value)}
          >
            <Text
              style={[
                styles.tabText,
                filter === t.value && { color: "#fff" },
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm đơn hàng..."
          placeholderTextColor="#888"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3498DB" />
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrder}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadOrders} />
          }
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: "#888", marginTop: 40 }}>
              Không có đơn hàng nào.
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
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 20,
  },
  tabActive: {
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
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: 10,
    marginBottom: 10,
    padding: 12,
    elevation: 2,
    borderLeftWidth: 6,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderCode: { fontWeight: "bold", color: "#2C3E50" },
  customer: { fontSize: 14, color: "#2C3E50", fontWeight: "600" },
  address: { fontSize: 13, color: "#7F8C8D", marginBottom: 5 },
  date: { color: "#95A5A6", fontSize: 12 },
  price: { color: "#E74C3C", fontWeight: "bold", fontSize: 15 },
  status: { fontWeight: "bold", fontSize: 14 },
  actionRow: { flexDirection: "row", marginTop: 8, gap: 10 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingVertical: 6,
    flex: 1,
  },
  btnText: { color: "#fff", fontWeight: "bold", marginLeft: 5 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
