// screens/OrderDetailScreen.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import 'moment/locale/vi';
import { CommonActions } from '@react-navigation/native';

moment.locale('vi');

// const API_URL = 'http://192.168.1.103:3000';
const API_URL = 'https://mma-3kpy.onrender.com';
const PLACEHOLDER_IMG = 'https://via.placeholder.com/120x120?text=No+Image';
const HEADER_MAX_HEIGHT = 120;
const HEADER_MIN_HEIGHT = 70;

const COLORS = {
  primary: '#2C3E50',
  secondary: '#34495E',
  accent: '#3498DB',
  success: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
  text: '#2C3E50',
  light: '#FFF',
  border: '#E0E0E0',
  background: '#F5F6FA',
};

const OrderItemCard = ({ item, index, imageUrl, onImagePress }) => {
  const [imgError, setImgError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [pressed, setPressed] = useState(false);

  const onLoad = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  const uri =
    imgError || !imageUrl
      ? PLACEHOLDER_IMG
      : imageUrl.startsWith('http')
      ? imageUrl
      : `${API_URL}${imageUrl}`;

  return (
    <Pressable
      onPress={() => onImagePress(uri)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.itemCard,
        { transform: [{ scale: pressed ? 0.97 : 1 }] },
        pressed && { backgroundColor: '#EEF3F8' },
      ]}
    >
      <Animated.Image
        source={{ uri }}
        onError={() => setImgError(true)}
        onLoad={onLoad}
        style={[styles.itemImage, { opacity: fadeAnim }]}
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item?.name || 'Sản phẩm'}
        </Text>
        {item?.size ? <Text style={styles.itemSize}>Size: {item.size}</Text> : null}
        <Text style={styles.itemQuantity}>Số lượng: {item?.quantity || 0}</Text>
        <Text style={styles.itemPrice}>{((item?.price || 0)).toLocaleString('vi-VN')} đ</Text>
      </View>
    </Pressable>
  );
};

export default function OrderDetailScreen({ route, navigation }) {
  // nhận order an toàn
  const incomingOrder = route?.params?.order || null;
  const [order] = useState(incomingOrder);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const scrollY = useRef(new Animated.Value(0)).current;

  // nếu không có order → quay lại
  useEffect(() => {
    if (!order) {
      Alert.alert('Không có dữ liệu đơn hàng', 'Vui lòng thử lại.');
      navigation.goBack();
    }
  }, [order, navigation]);

  const getToken = useCallback(async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      Alert.alert('Phiên đăng nhập hết hạn', 'Vui lòng đăng nhập lại.');
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
      return null;
    }
    return token;
  }, [navigation]);

  const loadProducts = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Không thể tải danh sách sản phẩm');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Lỗi khi tải sản phẩm:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const getStatusInfo = (status) => {
    switch (status) {
      case 'Delivered':
        return { color: COLORS.success, icon: 'checkmark-circle', text: 'Đã giao hàng', bg: '#EAF9F0' };
      case 'Cancelled':
        return { color: COLORS.danger, icon: 'close-circle', text: 'Đã hủy đơn', bg: '#FDEDEC' };
      case 'Processing':
        return { color: COLORS.warning, icon: 'time', text: 'Đang xử lý', bg: '#FEF6E7' };
      default:
        return { color: COLORS.accent, icon: 'help-circle', text: 'Chờ xác nhận', bg: '#E8F3FE' };
    }
  };

  const statusInfo = getStatusInfo(order?.status || 'Pending');

  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.headerContainer, { height: headerHeight }]}>
        <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.headerGradient}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.light} />
          </TouchableOpacity>
          <Animated.View style={{ opacity: headerOpacity }}>
            <Text style={styles.headerTitle}>Chi tiết đơn hàng</Text>
          </Animated.View>
          <Ionicons name="receipt-outline" size={22} color={COLORS.light} />
        </LinearGradient>
      </Animated.View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 30 }} />
      ) : (
        <Animated.ScrollView
          contentContainerStyle={{ paddingTop: HEADER_MAX_HEIGHT + 10 }}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {/* Trạng thái */}
          <View style={[styles.statusCard, { backgroundColor: statusInfo.bg }]}>
            <Ionicons name={statusInfo.icon} size={28} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.text}</Text>
          </View>

          {/* Thông tin đơn hàng */}
          <MotiView
            from={{ opacity: 0, translateY: 15 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 100 }}
            style={styles.infoCard}
          >
            <View style={styles.infoHeader}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
              <Text style={styles.infoTitle}>Thông tin đơn hàng</Text>
            </View>
            <Text style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mã đơn: </Text>#{order?.order_code || '—'}
            </Text>
            <Text style={styles.infoRow}>
              <Text style={styles.infoLabel}>Ngày đặt: </Text>
              {order?.created_at ? moment(order.created_at).format('HH:mm - DD/MM/YYYY') : '—'}
            </Text>
            <Text style={styles.infoRow}>
              <Text style={styles.infoLabel}>Thanh toán: </Text>
              {order?.payment_method || 'COD'}
            </Text>
          </MotiView>

          {/* Giao hàng */}
          <MotiView
            from={{ opacity: 0, translateY: 15 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 200 }}
            style={styles.infoCard}
          >
            <View style={styles.infoHeader}>
              <Ionicons name="location-outline" size={18} color={COLORS.primary} />
              <Text style={styles.infoTitle}>Thông tin giao hàng</Text>
            </View>
            <Text style={styles.infoRow}>
              <Text style={styles.infoLabel}>Người nhận: </Text>
              {order?.customer_name || '—'}
            </Text>
            <Text style={styles.infoRow}>
              <Text style={styles.infoLabel}>SĐT: </Text>
              {order?.phone_number || '—'}
            </Text>
            <Text style={styles.infoRow}>
              <Text style={styles.infoLabel}>Địa chỉ: </Text>
              {order?.shipping_address || '—'}
            </Text>
          </MotiView>

          {/* Sản phẩm */}
          <Text style={styles.sectionTitle}>Sản phẩm đã mua</Text>
          <ScrollView style={{ maxHeight: 350 }} nestedScrollEnabled>
            {(Array.isArray(order?.items) ? order.items : []).map((item, index) => {
              // 🔧 Fix: chuẩn hóa kiểu để ghép đúng sản phẩm
              const matched = products.find((p) => String(p.id) === String(item.product_id));
              const imageUrl = matched?.image_url || '';
              return (
                <OrderItemCard
                  key={index}
                  item={item}
                  index={index}
                  imageUrl={imageUrl}
                  onImagePress={(uri) => {
                    setSelectedImage(uri);
                    setModalVisible(true);
                  }}
                />
              );
            })}
          </ScrollView>

          {/* Tổng tiền */}
          <MotiView
            from={{ opacity: 0, translateY: 15 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 250 }}
            style={styles.totalContainer}
          >
            <LinearGradient
              colors={['#FAD0C4', '#FFD1FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.totalBox}
            >
              <Text style={styles.totalLabel}>Tổng cộng:</Text>
              <Text style={styles.totalPrice}>
                {((order?.total_amount || 0)).toLocaleString('vi-VN')} đ
              </Text>
            </LinearGradient>
          </MotiView>
        </Animated.ScrollView>
      )}

      {/* Modal xem ảnh */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalOverlay}
            onPress={() => setModalVisible(false)}
          />
          <Animated.Image
            source={{ uri: selectedImage }}
            style={styles.modalImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  headerGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  backButton: { backgroundColor: '#ffffff33', borderRadius: 20, padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.light },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 15,
    paddingVertical: 14,
  },
  statusText: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
  infoCard: {
    backgroundColor: COLORS.light,
    marginHorizontal: 15,
    marginBottom: 12,
    borderRadius: 15,
    padding: 15,
    elevation: 2,
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginLeft: 5 },
  infoRow: { fontSize: 14, color: COLORS.text, marginBottom: 4 },
  infoLabel: { fontWeight: '600', color: COLORS.primary },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginHorizontal: 15,
    marginTop: 10,
    marginBottom: 8,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.light,
    borderRadius: 15,
    marginHorizontal: 15,
    marginBottom: 12,
    padding: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
  },
  itemImage: {
    width: 90,
    height: 90,
    borderRadius: 10,
    resizeMode: 'contain',
    backgroundColor: '#F9F9F9',
  },
  itemInfo: { flex: 1, marginLeft: 10, justifyContent: 'center' },
  itemName: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  itemSize: { fontSize: 13, color: '#777' },
  itemQuantity: { fontSize: 13, color: '#777' },
  itemPrice: { fontSize: 15, fontWeight: 'bold', color: COLORS.accent, marginTop: 4 },
  totalContainer: { marginHorizontal: 15, marginTop: 15, marginBottom: 30 },
  totalBox: {
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    elevation: 3,
  },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  totalPrice: { fontSize: 19, fontWeight: 'bold', color: COLORS.danger },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  modalImage: { width: '90%', height: '70%', borderRadius: 10 },
});
