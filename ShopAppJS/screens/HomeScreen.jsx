// screens/HomeScreen.jsx (Đã sửa lỗi bảo mật và cú pháp)
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, Dimensions, Alert, StatusBar, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, CommonActions } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const numColumns = 2; 
const PRIMARY_COLOR = '#2C3E50'; 
const SECONDARY_COLOR = '#34495E'; 
const ACCENT_COLOR = '#3498DB'; 
const ERROR_COLOR = '#E74C3C'; 
const TEXT_COLOR = '#333333';
const LIGHT_TEXT_COLOR = '#FFFFFF';
const BORDER_COLOR = '#E0E0E0'; 
const BACKGROUND_COLOR = '#F5F5F5';

// IP này đã ĐÚNG (theo ảnh của bạn)
const API_URL = 'http://192.168.1.102:3000'; 

const formatPrice = (price) => {
  return price ? price.toLocaleString('vi-VN') + ' đ' : '0 đ';
};

const ProductCard = ({ product, navigation }) => {
  const hasDiscount = product.discount > 0;
  const finalPrice = product.price * (1 - product.discount / 100);
  return (
    <TouchableOpacity 
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('ProductDetail', { product })}
    >
      <View style={styles.cardContent}>
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{product.discount}%</Text>
          </View>
        )}
        <Image
          source={{ uri: product.image_url || 'https://via.placeholder.com/150' }}
          style={styles.image}
        />
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.productBrand} numberOfLines={1}>{product.brand}</Text>
        <View style={styles.priceContainer}>
          {hasDiscount && (
            <Text style={styles.oldPrice}>{formatPrice(product.price)}</Text>
          )}
          <Text style={styles.finalPrice}>{formatPrice(finalPrice)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function HomeScreen({ navigation, route }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]); 
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [cartCount, setCartCount] = useState(0);

  // 🚀 BẮT BUỘC: Hàm trợ giúp lấy Token
  const getToken = useCallback(async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      Alert.alert('Phiên đăng nhập hết hạn', 'Vui lòng đăng nhập lại.');
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
      return null;
    }
    return token;
  }, [navigation]);

  const loadCartCount = useCallback(async () => {
    try {
      const cartString = await AsyncStorage.getItem('cart');
      const cart = cartString ? JSON.parse(cartString) : [];
      const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
      setCartCount(totalCount);
    } catch (err) { /* Lỗi không quan trọng */ }
  }, []);

  // 🚀 SỬA: Gửi Token khi gọi API
  const loadCategories = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return; 
      
      const res = await fetch(`${API_URL}/api/brands`, {
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (!res.ok) throw new Error('Không thể tải danh mục hãng.');
      const data = await res.json();
      setCategories(['Tất cả', ...data]);
    } catch (err) {
      if (categories.length === 0) setCategories(['Tất cả']);
    }
  }, [getToken, categories.length]);

  // 🚀 SỬA: Gửi Token khi gọi API
  const loadProducts = useCallback(async (brand) => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return; 

      let url = `${API_URL}/api/products`;
      if (brand && brand !== 'Tất cả') {
        url = `${API_URL}/api/products?brand=${encodeURIComponent(brand)}`;
      }
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` } 
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Không thể tải dữ liệu sản phẩm.');
      }
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      setError(err.message || 'Không thể tải sản phẩm.');
      if (err.message.includes('Token')) {
         navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
      }
    } finally {
      setLoading(false);
    }
  }, [getToken]);
  
  // 🚀 SỬA: Cú pháp useFocusEffect
  useFocusEffect(
    useCallback(() => {
      const fetchData = () => {
        loadCategories(); 
        loadProducts(selectedCategory); 
        loadCartCount();
      }
      fetchData(); 
      
      return () => {};
    }, [selectedCategory, loadCategories, loadProducts, loadCartCount]) 
  );
  
  const handleSelectCategory = (brand) => {
    setSelectedCategory(brand);
  };
  
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <LinearGradient
        colors={[PRIMARY_COLOR, SECONDARY_COLOR]}
        style={styles.headerGradient}
      >
        <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
        
        <TouchableOpacity 
          style={styles.searchBar} 
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Search')}
        >
          <Ionicons name="search" size={20} color="#888" />
          <Text style={styles.searchText}>Tìm kiếm...</Text>
        </TouchableOpacity>

        <View style={styles.iconGroup}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Account')} 
          >
            <Ionicons name="person-circle-outline" size={28} color={LIGHT_TEXT_COLOR} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('OrderHistory')} 
          >
            <Ionicons name="receipt-outline" size={26} color={LIGHT_TEXT_COLOR} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Cart')}
          >
            <Ionicons name="cart-outline" size={30} color={LIGHT_TEXT_COLOR} />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  const renderCategoryBar = () => (
    <View style={styles.categoryBar}>
      <FlatList
        data={categories}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const isSelected = selectedCategory === item;
          return (
            <TouchableOpacity 
              style={[
                  styles.categoryButton, 
                  isSelected && styles.categoryButtonSelected
              ]} 
              onPress={() => handleSelectCategory(item)}
            >
                <Text style={[
                    styles.categoryText,
                    isSelected && styles.categoryTextSelected
                ]}>
                    {item}
                </Text>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.categoryListContent}
      />
    </View>
  );

  if (loading && products.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        {renderCategoryBar()}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ACCENT_COLOR} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      {renderHeader()}
      {renderCategoryBar()} 
      
      {error ? (
        <View style={styles.centered}>
          <Text style={{ color: ERROR_COLOR, fontSize: 16, textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity onPress={() => loadProducts(selectedCategory)} style={styles.retryButton}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={({ item }) => <ProductCard product={item} navigation={navigation} />}
          keyExtractor={(item) => item.id.toString()}
          numColumns={numColumns}
          contentContainerStyle={styles.productList}
          ListEmptyComponent={() => (
            !loading && (
              <View style={styles.centered}>
                <Text style={{ color: TEXT_COLOR, fontSize: 16 }}>Không có sản phẩm nào.</Text>
              </View>
            )
          )}
        />
      )}
    </View>
  );
}

// ... (Toàn bộ Styles giữ nguyên)
const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BACKGROUND_COLOR, padding: 20 },
  headerContainer: { width: '100%', paddingBottom: 5, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  headerGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50, paddingHorizontal: 15, paddingBottom: 15 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: LIGHT_TEXT_COLOR, borderRadius: 25, paddingHorizontal: 15, paddingVertical: 10 },
  searchText: { marginLeft: 10, color: '#888', fontSize: 16 },
  iconGroup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginLeft: 10 },
  headerButton: { padding: 5, marginLeft: 10, position: 'relative' },
  cartBadge: { position: 'absolute', right: -4, top: -2, backgroundColor: ERROR_COLOR, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  cartBadgeText: { color: LIGHT_TEXT_COLOR, fontSize: 10, fontWeight: 'bold' },
  categoryBar: { paddingVertical: 10, backgroundColor: LIGHT_TEXT_COLOR, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  categoryListContent: { paddingHorizontal: 15 },
  categoryButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, backgroundColor: BACKGROUND_COLOR, borderWidth: 1, borderColor: BORDER_COLOR },
  categoryButtonSelected: { backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR },
  categoryText: { fontSize: 14, fontWeight: '500', color: TEXT_COLOR },
  categoryTextSelected: { color: LIGHT_TEXT_COLOR, fontWeight: 'bold' },
  productList: { paddingHorizontal: 5, paddingTop: 10, paddingBottom: 20 },
  retryButton: { marginTop: 15, backgroundColor: ACCENT_COLOR, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  retryText: { color: LIGHT_TEXT_COLOR, fontWeight: 'bold' },
  card: { flex: 0.5, margin: 5, backgroundColor: LIGHT_TEXT_COLOR, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 3, marginBottom: 10 },
  cardContent: { padding: 10, position: 'relative' },
  image: { width: '100%', height: 120, resizeMode: 'contain', marginBottom: 10 },
  discountBadge: { position: 'absolute', top: 0, left: 0, backgroundColor: PRIMARY_COLOR, paddingHorizontal: 8, paddingVertical: 4, borderTopLeftRadius: 15, borderBottomRightRadius: 15, zIndex: 1 },
  discountText: { color: LIGHT_TEXT_COLOR, fontSize: 12, fontWeight: 'bold' },
  productName: { fontSize: 14, fontWeight: 'bold', textAlign: 'left', marginBottom: 2, color: TEXT_COLOR },
  productBrand: { fontSize: 12, color: '#888', textAlign: 'left', marginBottom: 5 },
  priceContainer: { flexDirection: 'column', alignItems: 'flex-start', marginTop: 5, width: '100%' },
  oldPrice: { textDecorationLine: 'line-through', color: '#888', fontSize: 12, marginBottom: 2 },
  finalPrice: { fontSize: 15, color: ACCENT_COLOR, fontWeight: 'bold' },
});