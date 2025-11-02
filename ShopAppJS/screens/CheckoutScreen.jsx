// screens/CheckoutScreen.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CustomInput from '../components/CustomInput'; 
import { CommonActions } from '@react-navigation/native';

const PRIMARY_COLOR = '#2C3E50'; 
const SECONDARY_COLOR = '#34495E'; 
const ACCENT_COLOR = '#3498DB'; 
const ERROR_COLOR = '#E74C3C'; 
const TEXT_COLOR = '#333333';
const LIGHT_TEXT_COLOR = '#FFFFFF';
const BORDER_COLOR = '#BDC3C7';
const BACKGROUND_COLOR = '#F5F5F5';
const API_URL = 'http://192.168.1.102:3000'; 

const formatPrice = (price) => {
  return price.toLocaleString('vi-VN') + ' đ';
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

export default function CheckoutScreen({ route, navigation }) {
  const { cartItems, totalAmount } = route.params;
  
  const [userInfo, setUserInfo] = useState(null);
  
  // 🚀 SỬA: Thêm state cho các trường mới
  const [recipientName, setRecipientName] = useState(''); // Tên người nhận
  const [shippingAddress, setShippingAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notes, setNotes] = useState(''); // Ghi chú
  
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('userInfo');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUserInfo(parsedUser);
          // 🚀 SỬA: Tự động điền tên người nhận bằng tên tài khoản
          setRecipientName(parsedUser.name); 
        }
      } catch (error) {
        console.error('Lỗi tải thông tin người dùng:', error);
      }
    };
    loadUserData();
  }, []);

  // 🚀 SỬA: Gửi Token và các trường mới
  const handleCheckout = async () => {
    // 🚀 SỬA: Kiểm tra Tên người nhận
    if (!shippingAddress || !phoneNumber || !recipientName) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ Tên, Địa chỉ và Số điện thoại');
      return;
    }
    if (!userInfo) {
      Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng, vui lòng đăng nhập lại.');
      return;
    }

    setLoading(true);
    
    const token = await getToken(navigation);
    if (!token) {
      setLoading(false);
      return;
    }

    const orderData = {
      userId: userInfo.id,
      customerName: recipientName, // 👈 Dùng Tên người nhận
      customerEmail: userInfo.email,
      shippingAddress: shippingAddress,
      phoneNumber: phoneNumber,
      paymentMethod: paymentMethod,
      notes: notes, // 👈 Thêm Ghi chú
      totalAmount: totalAmount,
      items: cartItems.map(item => ({
        product_id: item.product.id,
        name: item.product.name,
        size: item.selectedSize,
        price: item.product.price * (1 - item.product.discount / 100),
        quantity: item.quantity,
      })),
    };

    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(orderData),
      });

      const data = await res.json();
      
      if (res.ok) {
        await AsyncStorage.removeItem('cart'); 
        Alert.alert(
          'Thành công!',
          'Bạn đã đặt hàng thành công.',
          [
            { text: 'OK', onPress: () => navigation.dispatch(
                CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] })
              ) 
            }
          ]
        );
      } else {
        throw new Error(data.message || 'Đặt hàng thất bại');
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[PRIMARY_COLOR, SECONDARY_COLOR]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color={LIGHT_TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thanh toán</Text>
        </View>
        
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          
          {/* Thông tin khách hàng (Hiển thị Email) */}
          <Text style={styles.sectionTitle}>Thông tin khách hàng</Text>
          <View style={styles.userInfoContainer}>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color={LIGHT_TEXT_COLOR} />
              <Text style={styles.infoText}>{userInfo ? userInfo.email : 'Đang tải...'}</Text>
            </View>
          </View>
          
          {/* 🚀 SỬA: Form giao hàng */}
          <Text style={styles.sectionTitle}>Thông tin giao hàng</Text>
          <View style={styles.form}>
            <CustomInput 
              placeholder="Tên người nhận (*)"
              value={recipientName}
              onChangeText={setRecipientName}
              iconName="person-outline"
            />
            <CustomInput 
              placeholder="Địa chỉ giao hàng (*)"
              value={shippingAddress}
              onChangeText={setShippingAddress}
              iconName="location-outline"
            />
            <CustomInput 
              placeholder="Số điện thoại (*)"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              iconName="call-outline"
              keyboardType="phone-pad"
            />
            <CustomInput 
              placeholder="Ghi chú (tùy chọn)"
              value={notes}
              onChangeText={setNotes}
              iconName="document-text-outline"
            />
          </View>
          
          <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
          <View style={styles.paymentMethods}>
            <TouchableOpacity style={styles.radio} onPress={() => setPaymentMethod('COD')}>
              <Ionicons 
                name={paymentMethod === 'COD' ? 'radio-button-on' : 'radio-button-off'} 
                size={24} 
                color={LIGHT_TEXT_COLOR} 
              />
              <Text style={styles.radioText}>Thanh toán khi nhận hàng (COD)</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Tóm tắt đơn hàng</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tạm tính ({cartItems.length} sản phẩm)</Text>
              <Text style={styles.summaryValue}>{formatPrice(totalAmount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Phí vận chuyển</Text>
              <Text style={styles.summaryValue}>{formatPrice(0)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalText}>Tổng cộng</Text>
              <Text style={styles.totalPrice}>{formatPrice(totalAmount)}</Text>
            </View>
          </View>
        </ScrollView>
        
        <View style={styles.checkoutButtonContainer}>
          <TouchableOpacity 
            style={styles.checkoutButton} 
            onPress={handleCheckout}
            disabled={loading}
          >
            <LinearGradient
              colors={[ACCENT_COLOR, '#2980B9']}
              style={styles.buttonGradient}
            >
              {loading ? (
                <ActivityIndicator color={LIGHT_TEXT_COLOR} />
              ) : (
                <Text style={styles.checkoutText}>ĐẶT HÀNG</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
  },
  backButton: { marginRight: 15, padding: 5 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: LIGHT_TEXT_COLOR },
  scrollContainer: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: LIGHT_TEXT_COLOR, marginBottom: 15 },
  userInfoContainer: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 15, marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  infoText: { color: LIGHT_TEXT_COLOR, fontSize: 16, marginLeft: 10 },
  form: { marginBottom: 10 },
  checkoutButtonContainer: { padding: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  checkoutButton: { borderRadius: 30, overflow: 'hidden' },
  buttonGradient: { padding: 15, alignItems: 'center', justifyContent: 'center' },
  checkoutText: { color: LIGHT_TEXT_COLOR, fontSize: 18, fontWeight: 'bold' },
  paymentMethods: { paddingLeft: 10, marginBottom: 20 },
  radio: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  radioText: { color: LIGHT_TEXT_COLOR, marginLeft: 10, fontSize: 16 },
  summary: { backgroundColor: LIGHT_TEXT_COLOR, borderRadius: 15, padding: 20, marginBottom: 20 },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', color: TEXT_COLOR, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  summaryLabel: { fontSize: 16, color: '#555' },
  summaryValue: { fontSize: 16, fontWeight: '500', color: TEXT_COLOR },
  totalRow: { borderTopWidth: 1, borderTopColor: BORDER_COLOR, paddingTop: 10, marginTop: 5, flexDirection: 'row', justifyContent: 'space-between' },
  totalText: { fontSize: 18, fontWeight: 'bold', color: TEXT_COLOR },
  totalPrice: { fontSize: 20, fontWeight: 'bold', color: ACCENT_COLOR },
});