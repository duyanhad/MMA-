// screens/ProductDetailScreen.jsx (sửa lại: tồn theo SIZE, stepper như Cart, giá thay đổi theo số lượng)
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, StatusBar, Platform, Alert, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const C = {
  header1: '#184E77', header2: '#1E6091',
  white: '#FFFFFF', bg: '#F5F8FA', text: '#1F2A37', soft: '#6B7280',
  border: '#E5E7EB', sale: '#FF5C5C', main: '#1E6091',
  ok: '#06D6A0', warn: '#FFA726', mute: '#9CA3AF'
};
const vnd = (v=0) => `${Number(v||0).toLocaleString('vi-VN')} đ`;

export default function ProductDetailScreen({ route, navigation }) {
  const { product = {} } = route.params || {};

  // ==== Giá ==== //
  const unitPrice = Number(product?.price || 0);
  const discount = Number(product?.discount || 0);
  const hasDiscount = discount > 0;
  const unitFinal = useMemo(() => unitPrice * (1 - discount/100), [unitPrice, discount]);

  // ==== Size & tồn kho theo size ==== //
  const sizeStocksRaw = product?.size_stocks || {}; // {"38": 5, ...}
  const sizes = useMemo(() => {
    const fromProp = Array.isArray(product?.sizes) && product.sizes.length ? product.sizes : null;
    const fromMap = Object.keys(sizeStocksRaw || {});
    const arr = (fromProp && fromProp.length ? fromProp : fromMap).map(String);
    return arr.sort((a,b)=>Number(a)-Number(b));
  }, [product?.sizes, sizeStocksRaw]);

  // chọn size còn hàng đầu tiên (nếu có) => mượt hơn cho người dùng
  const firstAvail = useMemo(() => sizes.find(s=>Number(sizeStocksRaw?.[s]||0) > 0) || sizes[0] || null, [sizes, sizeStocksRaw]);
  const [size, setSize] = useState(firstAvail);
  useEffect(()=>{ setSize(firstAvail); }, [firstAvail]);

  // số lượng
  const [qty, setQty] = useState(1);
  const selectedStock = Number(size ? (sizeStocksRaw?.[size] ?? 0) : Number(product?.stock||0));
  const canBuy = selectedStock > 0;

  // clamp qty theo tồn
  const clampQty = (n) => Math.max(1, Math.min(Number(n)||1, Math.max(selectedStock, 1)));
  useEffect(()=>{ setQty(q=>clampQty(q)); }, [selectedStock]);

  // Tính tiền theo số lượng
  const totalFinal = unitFinal * qty;

  // Badge giỏ
  const [cartCount, setCartCount] = useState(0);
  const countCart = (cart=[]) => cart.reduce((s, it)=> s + (Number(it.quantity)||1), 0);
  useEffect(()=>{ (async()=>{ const raw = await AsyncStorage.getItem('cart'); setCartCount(countCart(raw?JSON.parse(raw):[])); })(); }, []);

  // Animation stepper (giống Cart)
  const scale = useRef(new Animated.Value(1)).current;
  const bounce = (fn) => Animated.sequence([
    Animated.timing(scale, { toValue: 0.86, duration: 90, easing: Easing.ease, useNativeDriver: true }),
    Animated.timing(scale, { toValue: 1, duration: 90, easing: Easing.ease, useNativeDriver: true }),
  ]).start(()=>fn && fn());

  const onAddToCart = async (goCheckout = false) => {
    try {
      if (!canBuy) { Alert.alert('Hết hàng', 'Size này đã hết.'); return; }
      if (sizes.length > 0 && !size) { Alert.alert('Chọn size', 'Vui lòng chọn size trước khi thêm vào giỏ.'); return; }
      const raw = await AsyncStorage.getItem('cart');
      const cart = raw ? JSON.parse(raw) : [];
      const idx = cart.findIndex(it => it.product_id === product.id && (it.size || null) === (size || null));
      if (idx >= 0) cart[idx].quantity = Math.min((Number(cart[idx].quantity)||1) + qty, selectedStock);
      else cart.push({ product_id: product.id, name: product.name, price: unitFinal, image_url: product.image_url || '', size: size || null, quantity: qty });
      await AsyncStorage.setItem('cart', JSON.stringify(cart));
      setCartCount(countCart(cart));
      if (goCheckout) navigation.navigate('Cart'); else Alert.alert('Thành công', 'Đã thêm vào giỏ hàng.');
    } catch (e) { Alert.alert('Lỗi', 'Không thể thêm vào giỏ.'); }
  };

  const StockChip = () => {
    if (!canBuy) {
      return (
        <View style={[styles.stockChip, { backgroundColor: '#F3F4F6' }]}>
          <Ionicons name="alert-circle" size={14} color={C.mute} />
          <Text style={[styles.stockTxtChip, { color: C.mute, marginLeft: 6 }]}>Hết hàng{size?` (size ${size})`:''}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.stockChip, { backgroundColor: '#E8FFF4' }]}>
        <Ionicons name="checkmark-circle" size={14} color={C.ok} />
        <Text style={[styles.stockTxtChip, { color: C.ok, marginLeft: 6 }]}>Còn {selectedStock} hàng{size?` (size ${size})`:''}</Text>
      </View>
    );
  };

  const canMinus = qty > 1;
  const canPlus = qty < selectedStock;

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <LinearGradient colors={[C.header1, C.header2]} style={styles.header}>
        <StatusBar barStyle="light-content" backgroundColor={C.header1} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navIcon}>
          <Ionicons name="chevron-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{product?.name || 'Chi tiết sản phẩm'}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Cart')} style={styles.navIcon}>
          <Ionicons name="cart-outline" size={24} color={C.white} />
          {cartCount > 0 && (
            <View style={styles.badgeCount}><Text style={styles.badgeCountTxt}>{cartCount>9?'9+':cartCount}</Text></View>
          )}
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 120 }}>
        {/* Ảnh + badge giảm */}
        <View style={styles.imageWrap}>
          {hasDiscount && (
            <View style={styles.badge}><Ionicons name="flash" size={12} color="#fff" style={{ marginRight: 4 }}/><Text style={styles.badgeText}>-{discount}%</Text></View>
          )}
          <Image source={{ uri: product?.image_url || 'https://via.placeholder.com/300' }} style={styles.image} />
        </View>

        {/* Thông tin + Stock chip */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{product?.name}</Text>
              {!!product?.brand && <Text style={styles.brand}>{product.brand}</Text>}
            </View>
            <StockChip />
          </View>

          {/* Giá theo số lượng */}
          <View style={styles.priceRow}>
            {hasDiscount && <Text style={styles.old}>{vnd(unitPrice * qty)}</Text>}
            <Text style={styles.final}>{vnd(totalFinal)}</Text>
            {hasDiscount && <View style={styles.percentPill}><Text style={styles.percentTxt}>-{discount}%</Text></View>}
          </View>
          <Text style={{ color: C.soft }}>({vnd(unitFinal)} × {qty})</Text>

          {!!product?.description && (<>
            <Text style={styles.section}>Mô tả</Text>
            <Text style={styles.desc}>{product.description}</Text>
          </>)}
        </View>

        {/* Size & Số lượng */}
        <View style={styles.card}>
          {!!sizes.length && <Text style={styles.section}>Chọn size</Text>}
          <View style={styles.sizeRow}>
            {sizes.map(s => {
              const sStock = Number(sizeStocksRaw?.[s] ?? 0);
              const disabled = sStock <= 0;
              const active = size === s;
              return (
                <TouchableOpacity key={s} disabled={disabled} onPress={()=>{ setSize(s); setQty(1); }} activeOpacity={0.9}
                  style={[styles.sizeBtn, active && styles.sizeActive, disabled && styles.sizeDisabled]}>
                  <Text style={[styles.sizeTxt, active && styles.sizeTxtActive, disabled && { color: C.mute }]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.qtyRow}>
            <Text style={[styles.section, { marginTop: 0 }]}>Số lượng</Text>
            <View style={styles.stepper}>
              <Animated.View style={{ transform: [{ scale }] }}>
                <TouchableOpacity disabled={!canMinus || !canBuy} onPress={()=>bounce(()=>setQty(q=>clampQty(q-1)))}
                  style={[styles.stpBtn, { backgroundColor: '#FFB703', opacity: canMinus && canBuy ? 1 : 0.5 }]}>
                  <Ionicons name="remove-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.qty}>{qty}</Text>
              <Animated.View style={{ transform: [{ scale }] }}>
                <TouchableOpacity disabled={!canPlus || !canBuy} onPress={()=>bounce(()=>setQty(q=>clampQty(q+1)))}
                  style={[styles.stpBtn, { backgroundColor: '#219EBC', opacity: canPlus && canBuy ? 1 : 0.5 }]}>
                  <Ionicons name="add-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.botIcon} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="storefront-outline" size={22} color={C.main} />
          <Text style={styles.botIconTxt}>Cửa hàng</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.botBtn, { backgroundColor: canBuy ? '#FFB703' : '#CBD5E1' }]} disabled={!canBuy} activeOpacity={0.9} onPress={()=>onAddToCart(false)}>
          <Text style={styles.botBtnTxt}>{canBuy ? 'Thêm vào giỏ' : 'Hết hàng'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.botBtn, { backgroundColor: canBuy ? '#EF233C' : '#E5E7EB' }]} disabled={!canBuy} activeOpacity={0.9} onPress={()=>onAddToCart(true)}>
          <Text style={styles.botBtnTxt}>{canBuy ? 'Mua ngay' : 'Hết hàng'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50,
    paddingBottom: 12, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 6,
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
  },
  navIcon: { padding: 6, position: 'relative' },
  title: { flex: 1, color: C.white, fontWeight: '700' },
  badgeCount: { position: 'absolute', top: 2, right: 2, backgroundColor: C.sale, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeCountTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },

  imageWrap: { backgroundColor: '#F4F8FA', borderRadius: 14, alignItems: 'center', justifyContent: 'center', aspectRatio: 1.1, position: 'relative', borderWidth: 1, borderColor: C.border },
  image: { width: '78%', height: '78%', resizeMode: 'contain' },
  badge: { position: 'absolute', top: 10, left: 10, backgroundColor: C.sale, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', zIndex: 5, elevation: 5 },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  card: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginTop: 12, padding: 14 },
  name: { color: C.text, fontWeight: '800', fontSize: 18 },
  brand: { color: C.soft, marginTop: 2 },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 8, marginBottom: 4 },
  old: { color: '#9CA3AF', textDecorationLine: 'line-through', fontSize: 16 },
  final: { color: C.header2, fontSize: 20, fontWeight: 'bold' },
  percentPill: { backgroundColor: '#FFE3E3', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  percentTxt: { color: C.sale, fontWeight: '800', fontSize: 12 },

  section: { marginTop: 10, color: C.text, fontWeight: '700' },
  desc: { color: C.soft, marginTop: 4, lineHeight: 20 },

  // Stock chip
  stockChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  stockTxtChip: { fontWeight: '800' },

  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  sizeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: '#F6FAFC' },
  sizeActive: { backgroundColor: C.header1, borderColor: C.header1 },
  sizeTxt: { color: C.text, fontWeight: '700' },
  sizeTxtActive: { color: '#fff' },
  sizeDisabled: { backgroundColor: '#F0F0F0', borderColor: '#E0E0E0' },

  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 10 },
  stpBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  qty: { minWidth: 28, textAlign: 'center', fontWeight: '800', color: C.text },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  botIcon: { alignItems: 'center', justifyContent: 'center', width: 72 },
  botIconTxt: { color: C.main, fontSize: 12, marginTop: 2 },
  botBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  botBtnTxt: { color: '#fff', fontWeight: '800' },
});