// screens/CheckoutScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar, Image, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import CustomInput from '../components/CustomInput';
import { CommonActions } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';

const PRIMARY_COLOR = '#2C3E50';
const SECONDARY_COLOR = '#34495E';
const ACCENT_COLOR = '#3498DB';
const LIGHT_TEXT_COLOR = '#FFFFFF';
const BACKGROUND_COLOR = '#F5F5F5';
// const API_URL = 'http://192.168.1.103:3000'; // ⚠️ đổi thành IP backend của bạn
const API_URL = 'https://mma-3kpy.onrender.com';
// ✅ An toàn khi price undefined/null
const formatPrice = (price) => Number(price || 0).toLocaleString('vi-VN') + ' đ';

export default function CheckoutScreen({ route, navigation }) {
  // ✅ Lấy params an toàn
  const { cartItems = [], totalAmount = 0 } = route?.params ?? {};

  const [userInfo, setUserInfo] = useState(null);
  const [recipientName, setRecipientName] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState('');
  const [selectedWallet, setSelectedWallet] = useState('');

  useEffect(() => {
    const loadUserData = async () => {
      const data = await AsyncStorage.getItem('userInfo');
      if (data) {
        const parsed = JSON.parse(data);
        setUserInfo(parsed);
        setRecipientName(parsed.name || '');
      }
    };
    loadUserData();
  }, []);

  // 📞 Hàm kiểm tra số điện thoại Việt Nam
  const isValidPhoneNumber = (number) => /^0\d{9}$/.test(number);

  const handleCheckout = async () => {
    if (!recipientName || !shippingAddress || !phoneNumber) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ Tên, Địa chỉ và Số điện thoại');
      return;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      Alert.alert('Số điện thoại không hợp lệ', 'Vui lòng nhập đúng định dạng 10 chữ số, bắt đầu bằng 0');
      return;
    }

    if (!userInfo) {
      Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng.');
      return;
    }

    setLoading(true);
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      setLoading(false);
      Alert.alert('Phiên đăng nhập hết hạn');
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
      return;
    }

    const paymentDetail =
      paymentMethod === 'BANK' ? selectedBank :
      paymentMethod === 'WALLET' ? selectedWallet : 'COD';

    // ✅ Fallback an toàn cho từng field trong items
    const orderData = {
      userId: userInfo.id,
      customerName: recipientName,
      customerEmail: userInfo.email,
      shippingAddress,
      phoneNumber,
      paymentMethod,
      paymentDetail,
      notes,
      totalAmount: Number(totalAmount || 0),
      items: (cartItems || []).map(item => ({
        product_id: item?.product_id ?? item?.id,
        name: item?.name ?? '',
        size: item?.selectedSize ?? item?.size ?? '',
        price: Number(item?.final_price ?? item?.price ?? 0),
        quantity: Number(item?.quantity ?? 1),
        image_url: item?.image_url ?? '',
      })),
    };

    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(orderData),
      });
      const data = await res.json();
      if (res.ok) {
        await AsyncStorage.removeItem('cart');
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'ThankYou', params: { cartItems, totalAmount } }],
          })
        );
      } else throw new Error(data?.message || 'Không thể đặt hàng, vui lòng thử lại.');
    } catch (e) {
      Alert.alert('Lỗi', e.message || 'Không thể đặt hàng, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const openPaymentModal = (method) => {
    setPaymentMethod(method);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedBank('');
    setSelectedWallet('');
  };

  const copyToClipboard = async (text) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Đã sao chép', text);
  };

  return (
    <LinearGradient colors={[PRIMARY_COLOR, SECONDARY_COLOR]} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color={LIGHT_TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thanh toán</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.sectionTitle}>Thông tin người nhận hàng</Text>

          <CustomInput
            placeholder="Tên người nhận (*)"
            value={recipientName}
            onChangeText={setRecipientName}
            iconName="person-outline"
          />

          {/* Email không thể sửa */}
          <View style={styles.disabledField}>
            <Ionicons name="mail-outline" size={22} color="#888" style={{ marginRight: 8 }} />
            <Text style={styles.disabledText}>{userInfo?.email || 'Chưa có email'}</Text>
          </View>

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

          {/* 🛍️ Sản phẩm */}
          <View style={styles.productList}>
            <Text style={styles.sectionTitleBlack}>Sản phẩm trong đơn hàng</Text>
            <ScrollView style={styles.productScroll}>
              {(cartItems || []).map((item, i) => (
                <View key={i} style={styles.productItem}>
                  <Image source={{ uri: item?.image_url || 'https://via.placeholder.com/150' }} style={styles.productImage} />
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{item?.name || 'Sản phẩm'}</Text>
                    <Text style={styles.productDetail}>Size: {item?.selectedSize ?? item?.size ?? '-'}</Text>
                    <Text style={styles.productDetail}>
                      SL: {Number(item?.quantity ?? 1)} × {formatPrice(item?.final_price ?? item?.price)}
                    </Text>
                    <Text style={styles.productSubtotal}>
                      Thành tiền: {formatPrice(Number(item?.final_price ?? item?.price) * Number(item?.quantity ?? 1))}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* 💳 Thanh toán */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitleBlack}>Phương thức thanh toán</Text>
            {[
              { key: 'COD', label: 'Thanh toán khi nhận hàng (COD)', icon: 'cash-outline' },
              { key: 'BANK', label: 'Chuyển khoản ngân hàng', icon: 'card-outline' },
              { key: 'WALLET', label: 'Ví điện tử (Momo / ZaloPay)', icon: 'phone-portrait-outline' },
            ].map((method) => (
              <TouchableOpacity
                key={method.key}
                style={[styles.paymentOption, paymentMethod === method.key && styles.paymentOptionSelected]}
                onPress={() => openPaymentModal(method.key)}
              >
                <Ionicons
                  name={method.icon}
                  size={22}
                  color={paymentMethod === method.key ? LIGHT_TEXT_COLOR : '#555'}
                  style={{ marginRight: 10 }}
                />
                <Text style={[styles.paymentText, paymentMethod === method.key && styles.paymentTextSelected]}>
                  {method.label}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={paymentMethod === method.key ? LIGHT_TEXT_COLOR : '#555'}
                />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Tổng thanh toán</Text>
            <Text style={styles.totalPrice}>{formatPrice(totalAmount)}</Text>
          </View>
        </ScrollView>

        <View style={styles.checkoutButtonContainer}>
          <TouchableOpacity
            style={[styles.checkoutButton, (!recipientName || !shippingAddress || !phoneNumber) && { opacity: 0.5 }]}
            onPress={handleCheckout}
            disabled={!recipientName || !shippingAddress || !phoneNumber || loading}
          >
            <LinearGradient colors={[ACCENT_COLOR, '#2980B9']} style={styles.buttonGradient}>
              {loading ? <ActivityIndicator color={LIGHT_TEXT_COLOR} /> : <Text style={styles.checkoutText}>ĐẶT HÀNG</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ⚡ Modal Popup */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalInner}>
            <Text style={styles.modalTitle}>
              {paymentMethod === 'BANK' ? 'Chuyển khoản ngân hàng' : 'Thanh toán qua ví điện tử'}
            </Text>
            {/* BANK */}
            {paymentMethod === 'BANK' && (
              <View>
                {[
                  { name: 'Vietcombank', logo: require('../assets/banks/vietcombank.jpg'), stk: '0123456789', owner: 'NGUYEN DUY ANH' },
                  { name: 'Techcombank', logo: require('../assets/banks/techcombank.jpg'), stk: '19012345678910', owner: 'NGUYEN DUY ANH' },
                  { name: 'BIDV', logo: require('../assets/banks/bidv.jpg'), stk: '6123456789', owner: 'NGUYEN DUY ANH' },
                  { name: 'MB Bank', logo: require('../assets/banks/mbbank.jpg'), stk: '9704123456789123', owner: 'NGUYEN DUY ANH' },
                ].map((bank) => (
                  <TouchableOpacity
                    key={bank.name}
                    style={[styles.bankOption, selectedBank === bank.name && styles.bankOptionSelected]}
                    onPress={() => setSelectedBank(bank.name)}
                  >
                    <View style={styles.bankInfo}>
                      <Image source={bank.logo} style={styles.bankLogo} />
                      <View>
                        <Text style={styles.bankText}>{bank.name}</Text>
                        <Text style={styles.bankSub}>STK: {bank.stk}</Text>
                        <Text style={styles.bankSub}>Chủ TK: {bank.owner}</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => copyToClipboard(bank.stk)}>
                      <Ionicons name="copy-outline" size={20} color={ACCENT_COLOR} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* WALLET */}
            {paymentMethod === 'WALLET' && (
              <View style={{ alignItems: 'center' }}>
                {[
                  { name: 'Momo', logo: require('../assets/wallets/momo.png') },
                  { name: 'ZaloPay', logo: require('../assets/wallets/zalopay.jpg') },
                  { name: 'VNPay', logo: require('../assets/wallets/vnpay.jpg') },
                ].map((wallet) => (
                  <TouchableOpacity
                    key={wallet.name}
                    style={[styles.walletOption, selectedWallet === wallet.name && styles.walletOptionSelected]}
                    onPress={() => setSelectedWallet(wallet.name)}
                  >
                    <View style={styles.bankInfo}>
                      <Image source={wallet.logo} style={styles.walletLogo} />
                      <Text style={styles.bankText}>{wallet.name}</Text>
                    </View>
                    {selectedWallet === wallet.name && (
                      <Ionicons name="checkmark-circle" size={22} color={ACCENT_COLOR} />
                    )}
                  </TouchableOpacity>
                ))}
                {selectedWallet ? (
                  <View style={styles.qrContainer}>
                    <Text style={styles.qrTitle}>Quét mã QR để thanh toán</Text>
                    <QRCode
                      value={`Thanh toán ${selectedWallet}: ${formatPrice(totalAmount)}`}
                      size={180}
                      backgroundColor="white"
                      color="#000"
                    />
                    <Text style={styles.qrSubtitle}>{selectedWallet}</Text>
                  </View>
                ) : null}
              </View>
            )}

            <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal}>
              <Text style={styles.modalCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  backButton: { marginRight: 15 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: LIGHT_TEXT_COLOR },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: LIGHT_TEXT_COLOR, marginVertical: 10 },
  sectionTitleBlack: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },

  // 🧍‍♂️ Email không sửa
  disabledField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  disabledText: {
    color: '#ccc',
    fontSize: 15,
  },

  productList: { backgroundColor: 'rgba(255, 255, 255, 1)', padding: 15, borderRadius: 12, marginTop: 10 },
  productScroll: { maxHeight: 200 },
  productItem: {
    flexDirection: 'row',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    paddingBottom: 10,
  },
  productImage: { width: 70, height: 70, borderRadius: 10, marginRight: 10, backgroundColor: 'rgba(255, 252, 252, 1)', resizeMode: 'contain' },
  productInfo: { flex: 1, justifyContent: 'center' },
  productName: { fontWeight: 'bold', fontSize: 15, color: '#000000ff' },
  productDetail: { fontSize: 14, color: '#000000ff' },
  productSubtotal: { fontSize: 14, fontWeight: '600', color: '#00bfff', marginTop: 5 },

  paymentSection: { backgroundColor: 'rgba(255, 248, 248, 1)', padding: 15, borderRadius: 12, marginTop: 15 },
  paymentOption: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(14, 2, 2, 0.08)', padding: 10,
    borderRadius: 12, marginBottom: 10,
  },
  paymentOptionSelected: { backgroundColor: 'rgba(52,152,219,0.5)' },
  paymentText: { flex: 1, fontSize: 15, color: '#000000ff' },
  paymentTextSelected: { color: '#000000ff', fontWeight: 'bold' },

  summary: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 15, borderRadius: 12, marginTop: 15, alignItems: 'center' },
  summaryTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 5 },
  totalPrice: { fontSize: 18, color: '#00bfff', fontWeight: 'bold' },

  checkoutButtonContainer: { padding: 20 },
  checkoutButton: { borderRadius: 30, overflow: 'hidden' },
  buttonGradient: { padding: 15, alignItems: 'center' },
  checkoutText: { color: LIGHT_TEXT_COLOR, fontSize: 18, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalInner: { width: '88%', backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 15, color: PRIMARY_COLOR },
  bankOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fb', borderRadius: 14, padding: 10, marginBottom: 10 },
  bankOptionSelected: { backgroundColor: '#eaf4ff', shadowColor: '#3498DB', shadowOpacity: 0.2, shadowRadius: 6 },
  bankInfo: { flexDirection: 'row', alignItems: 'center' },
  bankLogo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 10 },
  bankText: { fontSize: 16, color: '#333' },
  bankSub: { fontSize: 13, color: '#555', marginTop: 2 },
  walletOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fb', borderRadius: 14, padding: 10, marginBottom: 10 },
  walletOptionSelected: { backgroundColor: '#eaf4ff', shadowColor: '#3498DB', shadowOpacity: 0.25, shadowRadius: 6 },
  walletLogo: { width: 40, height: 40, resizeMode: 'contain', marginRight: 10 },
  qrContainer: { marginTop: 15, alignItems: 'center', borderRadius: 14, backgroundColor: '#f9f9f9', padding: 15 },
  qrTitle: { fontWeight: 'bold', fontSize: 15, marginBottom: 10, color: '#333' },
  qrSubtitle: { marginTop: 8, fontSize: 14, color: ACCENT_COLOR, fontWeight: '600' },
  modalCloseButton: { marginTop: 20, backgroundColor: ACCENT_COLOR, paddingVertical: 10, borderRadius: 12 },
  modalCloseText: { color: LIGHT_TEXT_COLOR, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
});
