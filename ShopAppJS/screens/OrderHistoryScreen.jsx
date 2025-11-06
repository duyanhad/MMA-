// screens/OrderHistoryScreen.jsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Platform, StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { MotiView } from 'moti';
import moment from 'moment';
import 'moment/locale/vi';

moment.locale('vi');

// 🎨 Màu sắc
const PRIMARY_COLOR = '#2C3E50';
const SECONDARY_COLOR = '#34495E';
const ACCENT_COLOR = '#3498DB';
const ERROR_COLOR = '#E74C3C';
const SUCCESS_COLOR = '#2ECC71';
const WARNING_COLOR = '#F1C40F';
const TEXT_COLOR = '#333333';
const LIGHT_TEXT_COLOR = '#FFFFFF';
const BORDER_COLOR = '#BDC3C7';
const BACKGROUND_COLOR = '#F5F5F5';

// const API_URL = 'http://192.168.1.103:3000';
const API_URL = 'https://mma-3kpy.onrender.com';

// 💰 Định dạng tiền
const formatPrice = (price) => {
  return price ? price.toLocaleString('vi-VN') + ' đ' : '0 đ';
};

// 🔐 Hàm lấy Token
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

  // 📦 Lấy danh sách đơn hàng khi mở màn hình
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

  // 🎨 Trạng thái đơn hàng (màu + icon + text)
  const getStatusInfo = (status) => {
    switch (status) {
      case 'Delivered':
        return { color: SUCCESS_COLOR, icon: 'checkmark-circle', text: 'Đã giao' };
      case 'Cancelled':
        return { color: ERROR_COLOR, icon: 'close-circle', text: 'Đã hủy' };
      case 'Pending':
        return { color: WARNING_COLOR, icon: 'time', text: 'Đang xử lý' };
      case 'Shipping':
        return { color: ACCENT_COLOR, icon: 'bicycle', text: 'Đang giao hàng' };
      default:
        return { color: '#7F8C8D', icon: 'help-circle', text: 'Không xác định' };
    }
  };

  // 🧾 Hiển thị từng đơn hàng
  const renderOrderItem = ({ item, index }) => {
    const statusInfo = getStatusInfo(item.status);
    const totalItems = item.items.reduce((sum, i) => sum + i.quantity, 0);

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 150, type: 'timing', duration: 400 }}
      >
        <TouchableOpacity
          style={styles.orderCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('OrderDetail', { order: item })}
        >
          <View style={styles.headerRow}>
            <Text style={styles.orderId}>#{item.order_code}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
              <Ionicons name={statusInfo.icon} size={14} color={LIGHT_TEXT_COLOR} style={{ marginRight: 4 }} />
              <Text style={styles.statusText}>{statusInfo.text}</Text>
            </View>
          </View>

          <Text style={styles.dateText}>{moment(item.created_at).format('HH:mm - DD/MM/YYYY')}</Text>
          <Text style={styles.detailText}>Người nhận: {item.customer_name}</Text>
          <Text style={styles.detailText}>Địa chỉ: {item.shipping_address}</Text>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{totalItems} sản phẩm</Text>
            <Text style={styles.totalPrice}>{formatPrice(item.total_amount)}</Text>
          </View>
        </TouchableOpacity>
      </MotiView>
    );
  };

  // 🔝 Thanh tiêu đề
  const renderHeader = () => (
    <LinearGradient colors={[PRIMARY_COLOR, SECONDARY_COLOR]} style={styles.header}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={28} color={LIGHT_TEXT_COLOR} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Lịch sử Đơn hàng</Text>
    </LinearGradient>
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
          ListEmptyComponent={<Text style={styles.emptyText}>Bạn chưa có đơn hàng nào.</Text>}
        />
      )}
    </View>
  );
}

// 🎨 Style
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  backButton: { marginRight: 15, padding: 5 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: LIGHT_TEXT_COLOR },
  listContainer: { padding: 15 },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#888' },

  orderCard: {
    backgroundColor: LIGHT_TEXT_COLOR,
    borderRadius: 18,
    padding: 15,
    marginBottom: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
  },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  orderId: { fontSize: 16, fontWeight: 'bold', color: PRIMARY_COLOR },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  statusText: { fontSize: 13, fontWeight: '600', color: LIGHT_TEXT_COLOR },
  dateText: { fontSize: 13, color: '#888', marginBottom: 8 },
  detailText: { fontSize: 14, color: TEXT_COLOR, marginBottom: 4 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    marginTop: 8,
    paddingTop: 8,
  },
  totalLabel: { fontSize: 15, fontWeight: '600', color: TEXT_COLOR },
  totalPrice: { fontSize: 17, fontWeight: 'bold', color: ERROR_COLOR },
});
