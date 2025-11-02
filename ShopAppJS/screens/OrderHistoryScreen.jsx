// screens/OrderHistoryScreen.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import moment from 'moment';
import 'moment/locale/vi'; 

moment.locale('vi');

const PRIMARY_COLOR = '#2C3E50'; 
const SECONDARY_COLOR = '#34495E'; 
const ACCENT_COLOR = '#3498DB'; 
const ERROR_COLOR = '#E74C3C'; 
const SUCCESS_COLOR = '#2ECC71'; 
const TEXT_COLOR = '#333333';
const LIGHT_TEXT_COLOR = '#FFFFFF';
const BORDER_COLOR = '#BDC3C7';
const BACKGROUND_COLOR = '#F5F5F5';
const API_URL = 'http://192.168.1.102:3000'; 

const formatPrice = (price) => {
  return price ? price.toLocaleString('vi-VN') + ' đ' : '0 đ';
};

// 🚀 BẮT BUỘC: Hàm trợ giúp lấy Token
const getToken = async (navigation) => {
  const token = await AsyncStorage.getItem('userToken');
  if (!token) {
    Alert.alert('Phiên đăng nhập hết hạn', 'Vui lòng đăng nhập lại.');
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] })
    );
    return null;
  }
  return token;
};

export default function OrderHistoryScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🚀 SỬA: Cập nhật cú pháp useFocusEffect và thêm logic Token
  useFocusEffect(
    useCallback(() => {
      const fetchOrders = async () => {
        setLoading(true);
        try {
          const token = await getToken(navigation);
          if (!token) return; 
          const userInfoString = await AsyncStorage.getItem('userInfo');
          if (!userInfoString) {
            throw new Error('Không tìm thấy thông tin người dùng');
          }
          const userInfo = JSON.parse(userInfoString);
          
          const res = await fetch(`${API_URL}/api/orders/history/${userInfo.id}`, {
            headers: { 'Authorization': `Bearer ${token}` } 
          });
          
          const data = await res.json();
          if (res.ok) {
            setOrders(data);
          } else {
            throw new Error(data.message || 'Không thể tải lịch sử đơn hàng');
          }
        } catch (error) {
          Alert.alert('Lỗi', error.message);
          if (error.message.includes('Token') || error.message.includes('Không tìm thấy')) {
            navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
          }
        } finally {
          setLoading(false);
        }
      };
      fetchOrders(); 
      return () => {};
    }, [navigation])
  );

  // ... (Render và Styles giữ nguyên) ...
  const renderHeader = () => (
    <LinearGradient
      colors={[PRIMARY_COLOR, SECONDARY_COLOR]}
      style={styles.header}
    >
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={28} color={LIGHT_TEXT_COLOR} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Lịch sử Đơn hàng</Text>
    </LinearGradient>
  );
  
  const getStatusStyle = (status) => {
    switch (status) {
      case 'Delivered': return { backgroundColor: SUCCESS_COLOR };
      case 'Cancelled': return { backgroundColor: ERROR_COLOR };
      default: return { backgroundColor: ACCENT_COLOR };
    }
  };

  const renderOrderItem = ({ item }) => (
    <View style={styles.orderCard}>
      <View style={styles.headerRow}>
        <Text style={styles.orderId}>{item.order_code}</Text>
        <Text style={[styles.statusText, getStatusStyle(item.status)]}>{item.status}</Text>
      </View>
      <Text style={styles.dateText}>{moment(item.created_at).format('HH:mm - DD/MM/YYYY')}</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.detailText}>Người nhận: {item.customer_name}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.detailText}>Địa chỉ: {item.shipping_address}</Text>
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Số lượng: {item.items.reduce((sum, i) => sum + i.quantity, 0)} sản phẩm</Text>
        <Text style={styles.totalPrice}>{formatPrice(item.total_amount)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {loading ? (
        <ActivityIndicator size="large" color={PRIMARY_COLOR} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Bạn chưa có đơn hàng nào.</Text>
          }
        />
      )}
    </View>
  );
}

// ... (Styles giữ nguyên)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  header: { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', borderBottomLeftRadius: 25, borderBottomRightRadius: 25 },
  backButton: { marginRight: 15, padding: 5 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: LIGHT_TEXT_COLOR },
  listContainer: { padding: 15 },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#888' },
  orderCard: { backgroundColor: LIGHT_TEXT_COLOR, borderRadius: 15, padding: 15, marginBottom: 15, elevation: 3 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: BACKGROUND_COLOR },
  orderId: { fontSize: 16, fontWeight: 'bold', color: PRIMARY_COLOR },
  statusText: { fontSize: 13, fontWeight: 'bold', color: LIGHT_TEXT_COLOR, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15, overflow: 'hidden' },
  dateText: { fontSize: 14, color: '#888', marginBottom: 10 },
  summaryRow: { marginBottom: 5 },
  detailText: { fontSize: 15, color: TEXT_COLOR },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: BORDER_COLOR, paddingTop: 8, marginTop: 8 },
  totalLabel: { fontSize: 16, fontWeight: '600', color: TEXT_COLOR },
  totalPrice: { fontSize: 18, fontWeight: 'bold', color: ERROR_COLOR },
});