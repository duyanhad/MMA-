// AdminDashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
  TextInput,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, CommonActions } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import moment from "moment";

const { width } = Dimensions.get("window");
const API_URL = "http://192.168.1.102:3000";

const formatPrice = (price) =>
  price ? price.toLocaleString("vi-VN") + " đ" : "0 đ";

export default function AdminDashboard({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    revenue: 0,
    totalOrders: 0,
    totalProducts: 0,
  });
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateChange = () => {
    fadeAnim.setValue(1);
    slideAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  useEffect(() => {
    if (filtered.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = (prev + 1) % filtered.length;
          animateChange();
          return next;
        });
      }, 4500);
      return () => clearInterval(interval);
    }
  }, [filtered]);

  const loadData = useCallback(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem("userToken");
        if (!token) {
          navigation.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: "Login" }] })
          );
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };
        const [ordersRes, usersRes, productsRes] = await Promise.all([
          fetch(`${API_URL}/api/admin/orders`, { headers }),
          fetch(`${API_URL}/api/admin/users`, { headers }),
          fetch(`${API_URL}/api/products`, { headers }),
        ]);

        const ordersData = await ordersRes.json();
        const usersData = await usersRes.json();
        const productsData = await productsRes.json();

        setOrders(ordersData);
        setFiltered(ordersData);
        setUsers(usersData);
        setProducts(productsData);
      } catch {
        Alert.alert("Lỗi", "Không thể kết nối tới máy chủ.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigation]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    const totalRevenue = orders
      .filter((o) => o.status === "Delivered")
      .reduce((sum, o) => sum + o.total_amount, 0);
    setStats({
      revenue: totalRevenue,
      totalOrders: orders.length,
      totalProducts: products.length,
    });
  }, [orders, products]);

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "Login" }] })
    );
  };

  const handleSearch = (text) => {
    setSearch(text);
    const lower = text.toLowerCase();
    setFiltered(
      orders.filter(
        (o) =>
          (o.order_code && o.order_code.toLowerCase().includes(lower)) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(lower))
      )
    );
    setCurrentIndex(0);
  };

  const renderOrderItem = (item) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => navigation.navigate("OrderDetail", { order: item })}
    >
      <Animated.View
        style={[
          styles.orderCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            borderLeftColor:
              item.status === "Delivered"
                ? "#2ECC71"
                : item.status === "Pending"
                ? "#F1C40F"
                : "#E74C3C",
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="receipt-outline" size={20} color="#118AB2" style={{ marginRight: 6 }} />
          <Text style={styles.orderId}>Mã đơn: {item.order_code}</Text>
        </View>
        <Text style={styles.customer}>Khách hàng: {item.customer_name}</Text>
        <Text style={styles.address} numberOfLines={1}>
          Địa chỉ: {item.shipping_address}
        </Text>
        <View style={styles.infoRow}>
          <Text style={styles.date}>
            {moment(item.created_at).format("DD/MM/YYYY HH:mm")}
          </Text>
          <Text
            style={[
              styles.status,
              item.status === "Pending" && { color: "#F1C40F" },
              item.status === "Delivered" && { color: "#2ECC71" },
              item.status === "Cancelled" && { color: "#E74C3C" },
            ]}
          >
            {item.status === "Pending"
              ? "Đang xử lý"
              : item.status === "Delivered"
              ? "Đã giao"
              : item.status === "Cancelled"
              ? "Đã hủy"
              : item.status}
          </Text>
        </View>
        <Text style={styles.total}>Tổng: {formatPrice(item.total_amount)}</Text>
      </Animated.View>
    </TouchableOpacity>
  );

  const currentOrder = filtered.length > 0 ? filtered[currentIndex] : null;

  return (
    <LinearGradient colors={["#0F2027", "#203A43", "#2C5364"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BẢNG ĐIỀU KHIỂN</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={28} color="#FFD166" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FFD166" style={{ marginTop: 20 }} />
      ) : (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Đơn hàng gần đây</Text>
          <View style={styles.sliderBox}>
            {currentOrder ? renderOrderItem(currentOrder) : (
              <Text style={styles.emptyText}>Không có đơn hàng.</Text>
            )}
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color="#555" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo mã hoặc tên khách hàng..."
              placeholderTextColor="#888"
              value={search}
              onChangeText={handleSearch}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.statCardBig, { backgroundColor: "#118AB2" }]}
            onPress={() => navigation.navigate("RevenueStatsScreen")}
          >
            <MaterialCommunityIcons name="cash-multiple" size={32} color="#FFF" />
            <Text style={styles.statValueBig}>{formatPrice(stats.revenue)}</Text>
            <Text style={styles.statTitleBig}>Tổng doanh thu</Text>
          </TouchableOpacity>

          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={[styles.statCard, { backgroundColor: "#06D6A0" }]}
              onPress={() => navigation.navigate("OrderManager")}
            >
              <Ionicons name="receipt-outline" size={26} color="#FFF" />
              <Text style={styles.statValue}>{stats.totalOrders}</Text>
              <Text style={styles.statTitle}>Đơn hàng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statCard, { backgroundColor: "#FFD166" }]}
              onPress={() => navigation.navigate("AdminInventoryScreen")}
            >
              <Ionicons name="cube-outline" size={26} color="#333" />
              <Text style={[styles.statValue, { color: "#333" }]}>{stats.totalProducts}</Text>
              <Text style={[styles.statTitle, { color: "#333" }]}>Kho hàng</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.menuContainer}>
            <Text style={styles.sectionTitle}>Quản lý</Text>
            <View style={styles.menuRow}>
              <TouchableOpacity
                style={[styles.menuButton, { backgroundColor: "#EF476F" }]}
                onPress={() => navigation.navigate("AdminProductList")}
              >
                <Ionicons name="pricetag-outline" size={24} color="#FFF" />
                <Text style={styles.menuText}>Sản phẩm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuButton, { backgroundColor: "#073B4C" }]}
                onPress={() => navigation.navigate("AdminUserList")}
              >
                <Ionicons name="people-outline" size={24} color="#FFF" />
                <Text style={styles.menuText}>Người dùng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuButton, { backgroundColor: "#7E57C2" }]}
                onPress={() => Alert.alert("Thông báo", "Tính năng đang phát triển.")}
              >
                <Ionicons name="settings-outline" size={24} color="#FFF" />
                <Text style={styles.menuText}>Cài đặt</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 80, // Lùi xuống thêm
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 32, // To hơn
    fontWeight: "bold",
    color: "#FFD166",
    textAlign: "center",
    letterSpacing: 1,
    marginBottom: 10,
    textShadowColor: "#FFF",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 15,
  },
  content: { marginTop: 50 }, // Toàn bộ lùi xuống thêm
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFF",
    marginBottom: 8,
    paddingHorizontal: 15,
  },
  sliderBox: { height: 150, marginBottom: 10, alignItems: "center" },
  orderCard: {
    width: width * 0.88,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 15,
    elevation: 5,
    borderLeftWidth: 6,
  },
  orderId: { fontWeight: "bold", color: "#118AB2" },
  customer: { color: "#222", fontSize: 15, fontWeight: "600" },
  address: { color: "#555", fontStyle: "italic", fontSize: 13 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
  date: { color: "#888", fontSize: 12 },
  total: { color: "#EF476F", fontWeight: "bold", fontSize: 15, textAlign: "right", marginTop: 4 },
  status: { fontWeight: "bold", fontSize: 13 },
  searchBox: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    marginHorizontal: 15,
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
    alignItems: "center",
    elevation: 4,
    marginBottom: 15,
  },
  searchInput: { flex: 1, fontSize: 15, marginLeft: 10, color: "#333" },
  statCardBig: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  statValueBig: { color: "#FFF", fontSize: 24, fontWeight: "bold" },
  statTitleBig: { color: "#FFF", fontSize: 15 },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 15,
  },
  statCard: {
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 5,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  statValue: { fontSize: 18, fontWeight: "bold", color: "#FFF" },
  statTitle: { fontSize: 12, color: "#FFF", textAlign: "center" },
  menuContainer: { marginBottom: 25, marginHorizontal: 10 },
  menuRow: { flexDirection: "row", justifyContent: "space-around" },
  menuButton: {
    alignItems: "center",
    padding: 15,
    flex: 1,
    borderRadius: 15,
    marginHorizontal: 5,
    elevation: 4,
  },
  menuText: { color: "#FFF", marginTop: 6, fontSize: 13, fontWeight: "500" },
  emptyText: { color: "#FFF", textAlign: "center", marginTop: 10 },
});
