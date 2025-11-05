// screens/CartScreen.jsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  TouchableOpacity, Alert, StatusBar, Platform,
  Animated, Easing
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const C = {
  header1: '#184E77',
  header2: '#1E6091',
  white: '#FFFFFF',
  bg: '#F5F8FA',
  text: '#1F2A37',
  soft: '#6B7280',
  border: '#E5E7EB',
  accent: '#34A0A4',
  sale: '#FF5C5C',
};
const price = (v) => (v ? v.toLocaleString('vi-VN') + ' đ' : '0 đ');

export default function CartScreen({ navigation }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem('cart');
      setItems(raw ? JSON.parse(raw) : []);
    })();
  }, []);

  const save = async (next) => {
    setItems(next);
    await AsyncStorage.setItem('cart', JSON.stringify(next));
  };

  const plus = (idx) => {
    const next = [...items];
    next[idx].quantity = (next[idx].quantity || 1) + 1;
    save(next);
  };

  const minus = (idx) => {
    const next = [...items];
    next[idx].quantity = Math.max(1, (next[idx].quantity || 1) - 1);
    save(next);
  };

  const remove = (idx) => {
    const next = items.filter((_, i) => i !== idx);
    save(next);
  };

  const total = items.reduce(
    (s, it) => s + (it.price || 0) * (it.quantity || 1),
    0
  );

  const goCheckout = () => {
    if (!items.length) return Alert.alert('Giỏ hàng trống');
    navigation.navigate('Checkout', {
      cartItems: items,
      totalAmount: total,
    });
  };

  const Row = ({ item, index }) => {
    const itemTotal = (item.price || 0) * (item.quantity || 1);
    const scale = new Animated.Value(1);
    const handlePress = (fn) => {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.8,
          duration: 80,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 80,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ]).start();
      fn();
    };

    return (
      <View style={styles.row}>
        <View style={styles.thumbWrap}>
          <Image
            source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
            style={styles.thumb}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          {!!item.size && <Text style={styles.size}>Size: {item.size}</Text>}
          <Text style={styles.price}>
            {price(itemTotal)}{' '}
            <Text style={styles.unitPrice}>({price(item.price)} × {item.quantity})</Text>
          </Text>

          {/* thanh số lượng + nút xóa */}
          <View style={styles.qtyBar}>
            <Animated.View style={{ transform: [{ scale }] }}>
              <TouchableOpacity
                onPress={() => handlePress(() => minus(index))}
                style={[styles.qtyBtn, { backgroundColor: '#FFB703' }]}
              >
                <Ionicons name="remove-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </Animated.View>

            <Text style={styles.qtyTxt}>{item.quantity || 1}</Text>

            <Animated.View style={{ transform: [{ scale }] }}>
              <TouchableOpacity
                onPress={() => handlePress(() => plus(index))}
                style={[styles.qtyBtn, { backgroundColor: '#219EBC' }]}
              >
                <Ionicons name="add-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              onPress={() => remove(index)}
              style={styles.deleteBtn}
            >
              <Ionicons name="trash-bin" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <LinearGradient colors={[C.header1, C.header2]} style={styles.header}>
        <StatusBar barStyle="light-content" backgroundColor={C.header1} />
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.navIcon}
        >
          <Ionicons name="chevron-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Giỏ hàng</Text>
        <View style={styles.navIcon} />
      </LinearGradient>

      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        renderItem={Row}
        contentContainerStyle={{ padding: 12, paddingBottom: 110 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 24 }}>
            <Ionicons name="cart-outline" size={36} color={C.soft} />
            <Text style={{ color: C.soft, marginTop: 8 }}>Giỏ hàng trống</Text>
          </View>
        }
      />

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.totalLabel}>Tổng cộng</Text>
          <Text style={styles.totalPrice}>{price(total)}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkout}
          onPress={goCheckout}
          activeOpacity={0.9}
        >
          <Ionicons name="cash-outline" size={20} color="#fff" />
          <Text style={styles.checkoutTxt}>Thanh toán</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50,
    paddingBottom: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 6,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  navIcon: { padding: 6 },
  title: { flex: 1, color: C.white, fontWeight: '800', fontSize: 18 },

  row: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  thumbWrap: {
    width: 90,
    aspectRatio: 1,
    backgroundColor: '#F4F8FA',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: '80%', height: '80%', resizeMode: 'contain' },
  name: { color: C.text, fontWeight: '800' },
  size: { color: C.soft, marginTop: 2 },
  price: {
    color: C.header2,
    fontWeight: '700',
    marginTop: 6,
  },
  unitPrice: { fontSize: 12, color: C.soft },

  qtyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  qtyBtn: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  qtyTxt: {
    minWidth: 28,
    textAlign: 'center',
    color: C.text,
    fontWeight: '700',
    fontSize: 15,
  },
  deleteBtn: {
    backgroundColor: C.sale,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 'auto',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 10,
  },
  totalLabel: { color: C.soft, fontWeight: '600' },
  totalPrice: {
    color: C.header2,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  checkout: {
    backgroundColor: C.header2,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  checkoutTxt: { color: '#fff', fontWeight: '800' },
});
