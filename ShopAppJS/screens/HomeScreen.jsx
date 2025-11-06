// screens/HomeScreen.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, Dimensions, Alert, StatusBar, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import CustomerBell from '../components/CustomerBell';

const { width } = Dimensions.get('window');
const numColumns = 2;

const C = {
  header1: '#184E77',
  header2: '#1E6091',
  accent:  '#34A0A4',
  accent2: '#76C893',
  white:   '#FFFFFF',
  bg:      '#F5F8FA',
  text:    '#1F2A37',
  soft:    '#6B7280',
  border:  '#E5E7EB',
  sale:    '#FF5C5C',
};

// const API_URL = 'http://192.168.1.103:3000';
const API_URL = 'https://mma-3kpy.onrender.com';
const formatPrice = (v) => (v ? v.toLocaleString('vi-VN') + ' đ' : '0 đ');

const Chip = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const ProductCard = ({ product, navigation }) => {
  const hasDiscount = product.discount > 0;
  const finalPrice = product.price * (1 - product.discount / 100);
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={styles.card}
      onPress={() => navigation.navigate('ProductDetail', { product })}
    >
      <View style={styles.imageWrap}>
        {hasDiscount && (
          <View style={styles.saleBadge}>
            <Ionicons name="flash" size={12} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.saleBadgeText}>-{product.discount}%</Text>
          </View>
        )}
        <Image
          source={{ uri: product.image_url || 'https://via.placeholder.com/200' }}
          style={styles.image}
        />
      </View>

      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
        <Text numberOfLines={1} style={styles.brand}>{product.brand}</Text>
        <View style={styles.priceRow}>
          {hasDiscount && <Text style={styles.oldPrice}>{formatPrice(product.price)}</Text>}
          <Text style={styles.finalPrice}>{formatPrice(finalPrice)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function HomeScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem('userInfo');
      if (raw) setUser(JSON.parse(raw));
    })();
  }, []);

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
      setCartCount(cart.reduce((s, i) => s + i.quantity, 0));
    } catch {}
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/brands`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Không thể tải danh mục hãng.');
      const data = await res.json();
      setCategories(['Tất cả', ...data]);
    } catch {
      setCategories((prev) => (prev?.length ? prev : ['Tất cả']));
    }
  }, [getToken]);

  const loadProducts = useCallback(async (brand) => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const url =
        brand && brand !== 'Tất cả'
          ? `${API_URL}/api/products?brand=${encodeURIComponent(brand)}`
          : `${API_URL}/api/products`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Không thể tải dữ liệu sản phẩm.');
      }
      const data = await res.json();
      setProducts(data);
    } catch (e) {
      setError(e.message || 'Không thể tải sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
      loadProducts(selectedCategory);
      loadCartCount();
    }, [selectedCategory, loadCategories, loadProducts, loadCartCount])
  );

  // ---------- UI TOP NAV ----------
  const TopNav = () => (
    <LinearGradient
      colors={[C.header1, C.header2]}
      style={styles.topNav}
      pointerEvents="box-none" // ✅ cho phép phần con tràn ra vẫn bắt sự kiện
    >
      <StatusBar barStyle="light-content" backgroundColor={C.header1} />

      {/* Menu/Hamburger trái */}
      <TouchableOpacity
        style={styles.navIconBtn}
        onPress={() => navigation.navigate('Account')}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="menu" size={24} color={C.white} />
      </TouchableOpacity>

      {/* Search giữa */}
      <TouchableOpacity
        style={styles.navSearch}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Search')}
      >
        <Ionicons name="search" size={18} color="#CFE7F7" />
        <Text style={styles.navSearchText}>Tìm kiếm...</Text>
      </TouchableOpacity>

      {/* Chuông góc phải (cao nhất) */}
      <View style={styles.bellWrap} pointerEvents="box-none">
        {/* ✅ CustomerBell nên render dropdown trong cùng View này */}
        <CustomerBell user={user} navigation={navigation} />
      </View>

      {/* Các icon khác bên phải */}
      <TouchableOpacity style={styles.navIconBtn} onPress={() => navigation.navigate('OrderHistory')}>
        <Ionicons name="receipt-outline" size={22} color={C.white} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.navIconBtn} onPress={() => navigation.navigate('Cart')}>
        <Ionicons name="cart-outline" size={24} color={C.white} />
        {cartCount > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </LinearGradient>
  );

  const CategoryBar = () => (
    <View style={styles.catWrap}>
      <FlatList
        data={categories}
        keyExtractor={(i) => i}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10 }}
        renderItem={({ item }) => (
          <Chip
            label={item}
            active={selectedCategory === item}
            onPress={() => setSelectedCategory(item)}
          />
        )}
      />
    </View>
  );

  const Grid = () => (
    <FlatList
      data={products}
      keyExtractor={(i) => i.id.toString()}
      numColumns={numColumns}
      contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 24 }}
      columnWrapperStyle={{ gap: 10 }}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => <ProductCard product={item} navigation={navigation} />}
      ListEmptyComponent={
        !loading && (
          <View style={styles.emptyBox}>
            <Ionicons name="cube-outline" size={28} color={C.soft} />
            <Text style={styles.emptyTxt}>Không có sản phẩm nào.</Text>
          </View>
        )
      }
    />
  );

  return (
    // ✅ Đảm bảo TopNav ở lớp cao nhất và không bị sibling đè
    <View style={styles.container} pointerEvents="box-none">
      <TopNav />
      <View style={styles.mainArea}>
        <CategoryBar />
        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
            <TouchableOpacity onPress={() => loadProducts(selectedCategory)} style={styles.retryBtn}>
              <Text style={styles.retryTxt}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : loading && products.length === 0 ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={C.accent} />
          </View>
        ) : (
          <Grid />
        )}
      </View>
    </View>
  );
}

// ================= Styles =================
const CARD_RADIUS = 14;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Top nav
  topNav: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50,
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,

    // ✅ Quan trọng để dropdown không bị cắt/che
    overflow: 'visible',
    zIndex: 1000,
    elevation: 20,
    position: 'relative',
  },
  // Khu vực nội dung chính luôn bên dưới lớp của topNav
  mainArea: {
    flex: 1,
    zIndex: 0,
    elevation: 0,
  },

  navIconBtn: { padding: 6, position: 'relative' },

  navSearch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  navSearchText: { marginLeft: 8, color: '#E5F2FB', fontSize: 15, letterSpacing: 0.2 },

  // ✅ Bell bọc riêng, cho phép dropdown tràn và đè lên dưới
  bellWrap: {
    position: 'relative',
    zIndex: 2000,
    elevation: 30,
    overflow: 'visible',
    paddingHorizontal: 4,
  },

  cartBadge: {
    position: 'absolute', right: -2, top: -2,
    backgroundColor: C.sale, borderRadius: 9,
    height: 18, minWidth: 18, justifyContent: 'center', alignItems: 'center',
  },
  cartBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  // Category chips
  catWrap: {
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    zIndex: 0,
    elevation: 0,
  },
  chip: {
    backgroundColor: '#EAF3F6',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#D6E6EC',
  },
  chipActive: { backgroundColor: C.header1, borderColor: C.header1 },
  chipText: { color: C.soft, fontWeight: '600' },
  chipTextActive: { color: C.white },

  // Product card
  card: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  imageWrap: {
    backgroundColor: '#F4F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1.28,
    position: 'relative',
  },
  saleBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.sale,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 5,
    elevation: 5,
  },
  saleBadgeText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  image: {
    width: '78%',
    height: '78%',
    resizeMode: 'contain',
    zIndex: 1,
  },
  cardBody: { padding: 10 },
  productName: { color: C.text, fontWeight: '700', fontSize: 14, lineHeight: 18 },
  brand: { color: C.soft, fontSize: 12, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  oldPrice: { color: '#9CA3AF', textDecorationLine: 'line-through', fontSize: 12 },
  finalPrice: { color: C.header2, fontWeight: 'bold', fontSize: 15 },

  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  emptyTxt: { color: C.soft },

  errBox: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errText: { color: C.sale, textAlign: 'center' },
  retryBtn: { backgroundColor: C.header1, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22 },
  retryTxt: { color: C.white, fontWeight: '700' },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
