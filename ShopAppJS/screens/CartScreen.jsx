// screens/CartScreen.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

// 🚀 ĐÃ SỬA: Định nghĩa màu chủ đạo BLUE
const PRIMARY_COLOR = '#2C3E50'; // Dark Blue
const SECONDARY_COLOR = '#34495E'; // Darker Blue
const ACCENT_COLOR = '#3498DB'; // Bright Blue
const ERROR_COLOR = '#E74C3C'; // Red for errors/removal
const TEXT_COLOR = '#333333';
const LIGHT_TEXT_COLOR = '#FFFFFF';
const BORDER_COLOR = '#BDC3C7';
const BACKGROUND_COLOR = '#F5F5F5';


export default function CartScreen({ navigation }) {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const saveCart = async (items) => {
    try {
      await AsyncStorage.setItem('cart', JSON.stringify(items));
    } catch (err) {
      console.error(err);
    }
  };

  const loadCart = async () => {
    setLoading(true);
    try {
      const data = await AsyncStorage.getItem('cart');
      if (data) setCartItems(JSON.parse(data));
      else setCartItems([]);
    } catch (err) {
      console.error(err);
    } finally {
        setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCart();
    }, [])
  );

  const increaseQuantity = (id, selectedSize) => {
    const updated = cartItems.map((item) =>
      item.id === id && item.selectedSize === selectedSize
        ? { ...item, quantity: item.quantity + 1 }
        : item
    );
    setCartItems(updated);
    saveCart(updated);
  };

  const decreaseQuantity = (id, selectedSize) => {
    const updated = cartItems.map((item) =>
      item.id === id && item.selectedSize === selectedSize
        ? { ...item, quantity: item.quantity > 1 ? item.quantity - 1 : 1 }
        : item
    );
    setCartItems(updated);
    saveCart(updated);
  };

  const removeItem = (id, selectedSize) => {
    Alert.alert(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa sản phẩm này khỏi giỏ hàng?",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xóa", 
          onPress: () => {
            const updated = cartItems.filter(
              (item) => !(item.id === id && item.selectedSize === selectedSize)
            );
            setCartItems(updated);
            saveCart(updated);
          }
        },
      ],
      { cancelable: true }
    );
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + item.final_price * item.quantity, 0);
  };

  const handleCheckout = () => {
    navigation.navigate('Checkout', { 
      cartItems: cartItems, 
      totalAmount: calculateTotal() 
    });
  };

  const renderItem = ({ item }) => (
    <View style={styles.cartItem}>
        <Image source={{ uri: item.image_url }} style={styles.itemImage} />
        
        <View style={styles.cartItemDetails}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.itemSize}>Size: {item.selectedSize}</Text>
            
            <View style={styles.priceContainer}>
                {/* 🚀 ĐÃ SỬA: Giảm font size cho giá cũ */}
                {item.price > item.final_price && (
                    <Text style={styles.oldPrice}>
                        {item.price.toLocaleString()} VNĐ
                    </Text>
                )}
                <Text style={styles.finalPrice}>
                    {item.final_price.toLocaleString()} VNĐ
                </Text>
            </View>

            <TouchableOpacity 
                onPress={() => removeItem(item.id, item.selectedSize)}
                style={styles.removeButton}
            >
                <Text style={styles.removeText}>Xóa</Text>
            </TouchableOpacity>
        </View>
        
        <View style={styles.quantityControl}>
            <TouchableOpacity onPress={() => decreaseQuantity(item.id, item.selectedSize)}>
                <Ionicons name="remove-circle-outline" size={24} color={ACCENT_COLOR} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity onPress={() => increaseQuantity(item.id, item.selectedSize)}>
                <Ionicons name="add-circle-outline" size={24} color={ACCENT_COLOR} />
            </TouchableOpacity>
        </View>
    </View>
  );

  if (loading) {
    return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ACCENT_COLOR} />
            <Text style={{ marginTop: 10, color: TEXT_COLOR }}>Đang tải giỏ hàng...</Text>
        </View>
    );
  }

  return (
    <View style={styles.container}>
        <LinearGradient
            colors={[PRIMARY_COLOR, SECONDARY_COLOR]} // 🚀 ĐÃ SỬA: Màu xanh
            style={styles.header}
        >
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={26} color={LIGHT_TEXT_COLOR} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Giỏ Hàng ({cartItems.length})</Text>
        </LinearGradient>
        
        {cartItems.length === 0 ? (
            <View style={styles.emptyCartContainer}>
                <Ionicons name="cart-outline" size={80} color={BORDER_COLOR} />
                <Text style={styles.emptyCartText}>Giỏ hàng của bạn đang trống.</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.shopButton}>
                    <Text style={styles.shopButtonText}>Tiếp tục mua sắm</Text>
                </TouchableOpacity>
            </View>
        ) : (
            <FlatList
                data={cartItems}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString() + item.selectedSize}
                contentContainerStyle={styles.list}
            />
        )}

        {/* Checkout Bar */}
        {cartItems.length > 0 && (
            <View style={styles.checkoutContainer}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalText}>Tổng cộng:</Text>
                    <Text style={styles.totalPrice}>{calculateTotal().toLocaleString()} VNĐ</Text>
                </View>
                <TouchableOpacity 
                    style={styles.checkoutButton}
                    onPress={handleCheckout}
                >
                    <LinearGradient
                        colors={[PRIMARY_COLOR, ACCENT_COLOR]} // 🚀 ĐÃ SỬA: Màu xanh
                        style={styles.checkoutButtonGradient} 
                    >
                        <Text style={styles.checkoutText}>THANH TOÁN</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BACKGROUND_COLOR },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BACKGROUND_COLOR },
    header: {
        paddingTop: 50,
        paddingHorizontal: 15,
        paddingBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    backButton: { marginRight: 15 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: LIGHT_TEXT_COLOR },
    emptyCartContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyCartText: {
        fontSize: 18,
        color: TEXT_COLOR,
        marginTop: 15,
        marginBottom: 20,
    },
    shopButton: {
        backgroundColor: ACCENT_COLOR, // 🚀 ĐÃ SỬA: Màu xanh
        paddingHorizontal: 25,
        paddingVertical: 10,
        borderRadius: 30,
    },
    shopButtonText: {
        color: LIGHT_TEXT_COLOR,
        fontSize: 16,
        fontWeight: 'bold',
    },
    list: { padding: 15, paddingBottom: 100 }, 
    cartItem: {
        flexDirection: 'row',
        marginBottom: 15,
        backgroundColor: LIGHT_TEXT_COLOR,
        borderRadius: 15,
        padding: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
    },
    itemImage: {
        width: 80,
        height: 80,
        borderRadius: 10,
        marginRight: 10,
        resizeMode: 'contain',
        backgroundColor: BACKGROUND_COLOR,
    },
    cartItemDetails: {
        flex: 1, 
        justifyContent: 'space-between',
        paddingRight: 10, 
    },
    itemName: { fontSize: 16, fontWeight: 'bold', color: TEXT_COLOR },
    itemSize: { fontSize: 14, color: TEXT_COLOR, marginBottom: 5 },
    priceContainer: { 
        flexDirection: 'column', 
        alignItems: 'flex-start',
        marginBottom: 5,
    },
    oldPrice: { 
        textDecorationLine: 'line-through', 
        color: '#888', 
        fontSize: 12, 
    },
    finalPrice: { 
        fontSize: 14, 
        fontWeight: 'bold', 
        color: ACCENT_COLOR, // 🚀 ĐÃ SỬA: Màu xanh
    },
    removeButton: {
        marginTop: 5,
        alignSelf: 'flex-start',
        backgroundColor: ERROR_COLOR, // 🚀 ĐÃ SỬA: Màu đỏ
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    removeText: { color: LIGHT_TEXT_COLOR, fontWeight: 'bold', fontSize: 12 },
    
    quantityControl: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 10,
    },
    quantityText: { marginHorizontal: 0, fontSize: 16, fontWeight: '600', marginVertical: 5, color: TEXT_COLOR },
    
    checkoutContainer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        padding: 15,
        backgroundColor: LIGHT_TEXT_COLOR,
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: -5 },
        shadowRadius: 6,
        elevation: 5,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    totalText: { fontSize: 18, fontWeight: '600', color: TEXT_COLOR },
    totalPrice: { fontSize: 20, fontWeight: 'bold', color: ACCENT_COLOR }, // 🚀 ĐÃ SỬA: Màu xanh
    checkoutButton: {
        borderRadius: 30,
        overflow: 'hidden',
    },
    checkoutButtonGradient: {
        paddingVertical: 15,
        alignItems: 'center',
    },
    checkoutText: { color: LIGHT_TEXT_COLOR, fontSize: 16, fontWeight: 'bold' },
});