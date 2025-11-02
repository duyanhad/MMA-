// screens/AdminDashboard.jsx (Đã sửa lỗi cú pháp useFocusEffect)
import React, { useState, useEffect, useCallback } from 'react'; 
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, CommonActions } from '@react-navigation/native'; 
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';

const PRIMARY_COLOR = '#2C3E50';
const SECONDARY_COLOR = '#34495E';
const ACCENT_COLOR = '#3498DB';
const ERROR_COLOR = '#E74C3C';
const SUCCESS_COLOR = '#2ECC71';
const TEXT_COLOR = '#333333';
const LIGHT_TEXT_COLOR = '#FFFFFF';
const BACKGROUND_COLOR = '#F5F5F5';
const BORDER_COLOR = '#BDC3C7';
const API_URL = 'http://192.168.1.102:3000';
const formatPrice = (price) => {
  return price ? price.toLocaleString('vi-VN') + ' đ' : '0 đ';
};

export default function AdminDashboard({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ revenue: 0, totalOrders: 0, totalUsers: 0 });

  // 🚀 FIX: Sửa lại cấu trúc useFocusEffect
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        Alert.alert('Lỗi', 'Không tìm thấy token. Vui lòng đăng nhập lại.');
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
        return;
      }
      const headers = { 'Authorization': `Bearer ${token}` };
      const [ordersRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/orders`, { headers }),
        fetch(`${API_URL}/api/admin/users`, { headers })
      ]);
      if (!ordersRes.ok || !usersRes.ok) {
        let errorData;
        if (!ordersRes.ok) { errorData = await ordersRes.json(); }
        else { errorData = await usersRes.json(); }
        throw new Error(errorData.message || 'Không thể tải dữ liệu Admin');
      }
      const ordersData = await ordersRes.json();
      const usersData = await usersRes.json();
      setOrders(ordersData);
      setUsers(usersData);
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể kết nối server.');
      if (error.message.includes('Token')) {
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
      }
    } finally {
      setLoading(false);
    }
  }, [navigation]);
  
  // 🚀 FIX: Sửa lại cú pháp useFocusEffect
  useFocusEffect(
    useCallback(() => {
      loadData(); 
      return () => {};
    }, [loadData]) 
  );

  useEffect(() => {
    if (orders.length > 0 || users.length > 0) {
      const totalRevenue = orders
        .filter(order => order.status === 'Delivered')
        .reduce((sum, order) => sum + order.total_amount, 0);
      setStats({
        revenue: totalRevenue,
        totalOrders: orders.length,
        totalUsers: users.length,
      });
    } else {
      setStats({ revenue: 0, totalOrders: 0, totalUsers: 0 });
    }
  }, [orders, users]);
  
  const handleLogout = () => {
    Alert.alert(
      "Đăng xuất Admin",
      "Bạn có chắc chắn muốn đăng xuất?",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Đồng ý", 
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear(); 
            navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
          }
        }
      ]
    );
  };
  
  const renderStatsCard = (icon, title, value) => (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={30} color={PRIMARY_COLOR} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  const renderMenuButton = (icon, title, screen) => (
    <TouchableOpacity 
      style={styles.menuButton} 
      onPress={() => {
        if (screen) { navigation.navigate(screen); }
        else { Alert.alert('Tính năng đang phát triển', `Chức năng "${title}" sẽ được thêm sớm.`); }
      }}
    >
      <Ionicons name={icon} size={28} color={ACCENT_COLOR} />
      <Text style={styles.menuText}>{title}</Text>
    </TouchableOpacity>
  );

  const renderOrderItem = ({ item }) => (
    <View style={styles.orderCard}>
      <Text style={styles.orderId}>ĐH: #{item.order_code} (User ID: {item.user_id})</Text>
      <Text style={styles.customerInfo}>{item.customer_name} - {item.phone_number}</Text>
      <Text style={styles.addressInfo} numberOfLines={1}>{item.shipping_address}</Text>
      <Text style={styles.dateText}>{moment(item.created_at).format('HH:mm DD/MM/YYYY')}</Text>
      <View style={styles.totalRow}>
        <Text style={[
          styles.statusText,
          item.status === 'Pending' && { color: ACCENT_COLOR },
          item.status === 'Delivered' && { color: SUCCESS_COLOR },
          item.status === 'Cancelled' && { color: ERROR_COLOR }
        ]}>{item.status}</Text>
        <Text style={styles.totalPrice}>{formatPrice(item.total_amount)}</Text>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={[PRIMARY_COLOR, SECONDARY_COLOR]} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={30} color={LIGHT_TEXT_COLOR} />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color={LIGHT_TEXT_COLOR} style={{ marginTop: 20 }}/>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={ !loading && <Text style={styles.emptyText}>Không có đơn hàng nào.</Text> }
          ListHeaderComponent={
            <>
              <View style={styles.statsContainer}>
                {renderStatsCard("cash-outline", "Doanh thu (Đã giao)", formatPrice(stats.revenue))}
                {renderStatsCard("receipt-outline", "Tổng đơn hàng", stats.totalOrders)}
                {renderStatsCard("people-outline", "Người dùng", stats.totalUsers)}
              </View>
              <View style={styles.menuContainer}>
                <Text style={styles.sectionTitle}>Quản lý</Text>
                <View style={styles.menuRow}>
                  {renderMenuButton("cube-outline", "Sản phẩm", "AdminProductList")} 
                  {renderMenuButton("people-outline", "Người dùng", "AdminUserList")}
                  {renderMenuButton("settings-outline", "Cài đặt", null)}
                </View>
              </View>
              <Text style={styles.sectionTitle}>Đơn hàng gần đây</Text>
            </>
          }
        />
      )}
    </LinearGradient>
  );
}

// ... (Toàn bộ Styles giữ nguyên) ...
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: PRIMARY_COLOR },
  logoutButton: { padding: 5 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: LIGHT_TEXT_COLOR },
  listContainer: { padding: 15 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: LIGHT_TEXT_COLOR, borderRadius: 10, padding: 15, alignItems: 'center', marginHorizontal: 5, elevation: 3 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: TEXT_COLOR, marginTop: 5 },
  statTitle: { fontSize: 12, color: '#888', marginTop: 2, textAlign: 'center' },
  menuContainer: { backgroundColor: LIGHT_TEXT_COLOR, borderRadius: 10, padding: 15, marginBottom: 20, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: LIGHT_TEXT_COLOR, marginBottom: 10, paddingHorizontal: 5 },
  menuRow: { flexDirection: 'row', justifyContent: 'space-around' },
  menuButton: { alignItems: 'center', padding: 10 },
  menuText: { color: TEXT_COLOR, marginTop: 5 },
  orderCard: { backgroundColor: LIGHT_TEXT_COLOR, borderRadius: 10, padding: 15, marginBottom: 15, elevation: 3 },
  orderId: { fontSize: 16, fontWeight: 'bold', color: PRIMARY_COLOR, marginBottom: 5 },
  customerInfo: { fontSize: 14, color: TEXT_COLOR, marginBottom: 2 },
  addressInfo: { fontSize: 14, color: '#555', fontStyle: 'italic', marginBottom: 5 },
  dateText: { fontSize: 13, color: '#888', marginBottom: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: BACKGROUND_COLOR, paddingTop: 10, marginTop: 5 },
  statusText: { fontSize: 16, fontWeight: 'bold' },
  totalPrice: { fontSize: 18, fontWeight: 'bold', color: ERROR_COLOR },
  emptyText: { color: LIGHT_TEXT_COLOR, textAlign: 'center', marginTop: 30, fontSize: 16 },
});