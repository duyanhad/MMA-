// screens/ProductDetailScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// 🚀 ĐỊNH NGHĨA LẠI MÀU XANH LÀM MÀU CHỦ ĐẠO (ACCENT_COLOR)
const BACKGROUND_COLOR = '#f9f9f9'; 
const TEXT_COLOR = '#333';
const ACCENT_COLOR = '#3498DB'; // Xanh dương sáng - Dùng cho nút tăng giảm, size được chọn, và giá
const ACCENT_COLOR_DARK = '#2980B9'; // Xanh dương đậm - Dùng cho gradient nút giỏ hàng

// 1. Phải là "export default"
export default function ProductDetailScreen({ route, navigation }) {
  // Đảm bảo product có giá trị mặc định là một object rỗng để tránh lỗi
  const { product } = route.params || { product: {} }; 
  
  const [selectedSize, setSelectedSize] = useState(null);
  const [quantity, setQuantity] = useState(1); // State số lượng
  const [scaleAnim] = useState(new Animated.Value(1));

  // Logic giỏ hàng
  const [cart, setCart] = useState([]);

  useEffect(() => {
    (async () => {
      const storedCart = await AsyncStorage.getItem('cart');
      if (storedCart) setCart(JSON.parse(storedCart));
    })();
  }, []);

  const saveCart = async (items) => {
    try {
      await AsyncStorage.setItem('cart', JSON.stringify(items));
    } catch (err) {
      console.error(err);
    }
  };

  // Hàm tăng giảm số lượng
  const increaseQuantity = () => {
    setQuantity(prev => prev + 1);
  };

  const decreaseQuantity = () => {
    setQuantity(prev => (prev > 1 ? prev - 1 : 1));
  };
  // END Quantity

  const handleAddToCart = async () => {
    if (!selectedSize) {
      Alert.alert('Vui lòng chọn size!');
      return;
    }

    // Xử lý logic thêm 
    const existingItemIndex = cart.findIndex(
      (item) => item.id === product.id && item.selectedSize === selectedSize
    );

    let updatedCart = [];

    if (existingItemIndex > -1) {
      // Nếu có, tăng số lượng
      updatedCart = cart.map((item, index) => 
        index === existingItemIndex ? { ...item, quantity: item.quantity + quantity } : item
      );
    } else {
      // Nếu chưa có, thêm sản phẩm mới
      updatedCart = [...cart, { 
        ...product, 
        selectedSize, 
        quantity,
      }];
    }

    await saveCart(updatedCart);
    setCart(updatedCart); // Cập nhật state cart

    // Hiệu ứng và thông báo
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Alert.alert('Thành công', `Đã thêm ${quantity} sản phẩm vào giỏ hàng!`);
      // 🚀 QUAY VỀ TRANG TRƯỚC
      navigation.goBack(); 
    });
  };

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      
      {/* ScrollView chứa nội dung chi tiết */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Image source={{ uri: product.image_url }} style={styles.image} />
        <View style={styles.info}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.brand}>Thương hiệu: {product.brand}</Text>

          <View style={styles.priceContainer}>
            {product.discount > 0 && (
              <Text style={styles.oldPrice}>{product.price.toLocaleString('vi-VN')} đ</Text>
            )}
            <Text style={styles.finalPrice}>{product.final_price.toLocaleString('vi-VN')} đ</Text>
          </View>

          <View style={styles.rating}>
            <FontAwesome name="star" size={16} color="#FFC72C" />
            <Text style={styles.reviewText}>4.5 (150 đánh giá)</Text>
          </View>

          <Text style={styles.sizeTitle}>Chọn Size:</Text>
          <View style={styles.sizeContainer}>
            {product.sizes && product.sizes.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {product.sizes.map((size) => {
                        const isSelected = selectedSize === size;

                        return (
                            <TouchableOpacity
                                key={size}
                                style={[
                                    styles.sizeButton,
                                    // 🚀 SỬA MÀU: Áp dụng ACCENT_COLOR cho size được chọn
                                    isSelected && styles.sizeButtonSelected,
                                ]}
                                onPress={() => setSelectedSize(size)}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.sizeText,
                                        isSelected && styles.sizeTextSelected,
                                    ]}
                                >
                                    {size}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ) : (
              <Text style={styles.material}>Sản phẩm này không có tùy chọn size cụ thể.</Text>
            )}
          </View>
          
          {/* Quantity Counter */}
          <Text style={styles.sizeTitle}>Số lượng:</Text>
          <View style={styles.quantityControl}>
            <TouchableOpacity 
              onPress={decreaseQuantity}
              style={styles.quantityButton}
            >
              {/* 🚀 SỬA MÀU: Áp dụng ACCENT_COLOR cho icon */}
              <Ionicons name="remove-outline" size={24} color={ACCENT_COLOR} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity 
              onPress={increaseQuantity}
              style={styles.quantityButton}
            >
              {/* 🚀 SỬA MÀU: Áp dụng ACCENT_COLOR cho icon */}
              <Ionicons name="add-outline" size={24} color={ACCENT_COLOR} />
            </TouchableOpacity>
          </View>
          {/* END Quantity Counter */}

          <Text style={styles.sizeTitle}>Chọn Màu:</Text>
          <View style={styles.colorContainer}>
            {/* Logic chọn màu (giữ nguyên) */}
          </View>

          <Text style={styles.sizeTitle}>Chi tiết sản phẩm:</Text>
          <Text style={styles.description}>{product.description}</Text>
          <Text style={styles.material}>Chất liệu: {product.material}</Text>
          
          {/* Đảm bảo có đủ padding ở cuối ScrollView */}
          <View style={{ height: 100 }} /> 
        </View>
      </ScrollView>

      {/* Thanh thêm giỏ hàng ở dưới cùng */}
      <View style={styles.bottomBar}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity 
            onPress={handleAddToCart}
            activeOpacity={0.8}
            style={{ width: '100%' }}
            disabled={!product.sizes || product.sizes.length === 0}
          >
            <LinearGradient
              // 🚀 NÚT GIỎ HÀNG VẪN LÀ MÀU XANH
              colors={[ACCENT_COLOR, ACCENT_COLOR_DARK]} 
              style={styles.addToCartButton}
            >
              <Ionicons name="cart" size={24} color="#fff" />
              <Text style={styles.buttonText}>Thêm vào giỏ hàng</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  scrollContent: { paddingBottom: 100 }, 
  backButton: {
    position: 'absolute',
    top: 40,
    left: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  image: { width, height: width, resizeMode: 'contain' },
  info: { padding: 20 },
  name: { fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  brand: { fontSize: 16, color: '#555', marginBottom: 10 },
  priceContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  oldPrice: { textDecorationLine: 'line-through', color: '#888', marginRight: 10 },
  finalPrice: { fontSize: 20, color: ACCENT_COLOR, fontWeight: 'bold' }, // Màu xanh
  rating: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  reviewText: { marginLeft: 5, color: '#555' },
  sizeTitle: { fontSize: 18, fontWeight: 'bold', color: TEXT_COLOR, marginBottom: 10 },
  description: { fontSize: 16, color: TEXT_COLOR, marginBottom: 5 },
  material: { fontSize: 14, color: '#555', marginBottom: 15 },
  
  // Size Buttons
  sizeContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  sizeButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  // 🚀 SỬA MÀU: Size được chọn là màu xanh
  sizeButtonSelected: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  sizeText: { fontSize: 16, color: TEXT_COLOR, fontWeight: '500' },
  sizeTextSelected: { color: '#fff' },

  // Style cho Quantity Counter
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20, 
    marginTop: 5,
  },
  quantityButton: {
    padding: 5,
    borderRadius: 50,
    backgroundColor: '#fff',
    borderWidth: 1,
    // 🚀 SỬA MÀU: Viền nút tăng giảm là màu xanh
    borderColor: ACCENT_COLOR, 
  },
  quantityText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 15,
    color: TEXT_COLOR,
    minWidth: 30,
    textAlign: 'center',
  },
  
  // Color Buttons (placeholder)
  colorContainer: { flexDirection: 'row', marginBottom: 20 },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 20,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -5 },
    shadowRadius: 6,
    elevation: 5,
    zIndex: 99, 
  },
  addToCartButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});