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
  const [notifications, setNotifications] = useState([]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Hiệu ứng chuyển đổi đơn hàng
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

  // Tự động chạy đơn hàng gần đây
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

  // Lấy dữ liệu
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

  // Tính toán thống kê
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

  // Thông báo checkout
  useEffect(() => {
    const newDelivered = orders.filter((o) => o.status === "Delivered");
    if (newDelivered.length > notifications.length) {
      setNotifications(newDelivered);
    }
  }, [orders]);

  // Xử lý tìm kiếm
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
      <View style={styles.topBar}>
        <Text style={styles.headerTitle}>BẢNG ĐIỀU KHIỂN</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Notifications")}
          style={styles.notifyBtn}
        >
          <Ionicons
            name={notifications.length > 0 ? "notifications" : "notifications-outline"}
            size={28}
            color="#FFD166"
          />
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
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingTop: 55,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  notifyBtn: {
    position: "absolute",
    top: 55,
    right: 20,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
    textShadowColor: "#FFFFFF",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 20,
    letterSpacing: 1,
    marginBottom: 10,
  },
  content: { marginTop: 65 },
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
  emptyText: { color: "#FFF", textAlign: "center", marginTop: 10 },
});
