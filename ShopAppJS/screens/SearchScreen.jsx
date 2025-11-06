// screens/SearchScreen.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, StatusBar, Platform, TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';

const C = {
  header1: '#184E77', header2: '#1E6091',
  white: '#FFFFFF', bg: '#F5F8FA', text: '#1F2A37', soft: '#6B7280',
  border: '#E5E7EB', accent: '#34A0A4', sale: '#FF5C5C'
};
// const API_URL = 'http://192.168.1.103:3000';
const API_URL = 'https://mma-3kpy.onrender.com';
const price = v => (v ? v.toLocaleString('vi-VN') + ' đ' : '0 đ');

export default function SearchScreen({ navigation }) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const [err, setErr] = useState('');

  const getToken = useCallback(async () => {
    const t = await AsyncStorage.getItem('userToken');
    if (!t) {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
      return null;
    }
    return t;
  }, [navigation]);

  const fetchData = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const token = await getToken(); if (!token) return;
      // Reuse /api/products then filter client-side theo từ khóa (tối giản, giữ logic cũ của bạn)
      const res = await fetch(`${API_URL}/api/products`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const k = q.trim().toLowerCase();
      const filtered = k ? data.filter(p =>
        (p.name || '').toLowerCase().includes(k) ||
        (p.brand || '').toLowerCase().includes(k) ||
        (p.category || '').toLowerCase().includes(k)
      ) : data;
      setList(filtered);
    } catch (e) { setErr('Không thể tải dữ liệu.'); }
    finally { setLoading(false); }
  }, [q, getToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const Item = ({ item }) => {
    const hasDiscount = item.discount > 0;
    const final = item.price * (1 - item.discount / 100);
    return (
      <TouchableOpacity
        style={styles.item}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('ProductDetail', { product: item })}
      >
        <View style={styles.thumbWrap}>
          {hasDiscount && (
            <View style={styles.badge}>
              <Ionicons name="flash" size={12} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.badgeText}>-{item.discount}%</Text>
            </View>
          )}
          <Image source={{ uri: item.image_url || 'https://via.placeholder.com/200' }} style={styles.thumb} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.brand} numberOfLines={1}>{item.brand}</Text>
          <View style={styles.priceRow}>
            {hasDiscount && <Text style={styles.old}>{price(item.price)}</Text>}
            <Text style={styles.final}>{price(final)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrap}>
      <LinearGradient colors={[C.header1, C.header2]} style={styles.header}>
        <StatusBar barStyle="light-content" backgroundColor={C.header1} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navIcon}>
          <Ionicons name="chevron-back" size={24} color={C.white} />
        </TouchableOpacity>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={18} color="#CFE7F7" />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Tìm tên, hãng, danh mục…"
            placeholderTextColor="#E5F2FB"
            returnKeyType="search"
            onSubmitEditing={fetchData}
            style={styles.input}
          />
          {!!q && (
            <TouchableOpacity onPress={() => setQ('')}>
              <Ionicons name="close-circle" size={18} color="#E5F2FB" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={fetchData} style={styles.navIcon}>
          <Ionicons name="arrow-forward-circle" size={26} color={C.white} />
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={C.accent} /></View>
      ) : err ? (
        <View style={styles.center}>
          <Text style={{ color: C.sale }}>{err}</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(i) => i.id?.toString()}
          renderItem={Item}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50,
    paddingBottom: 12, paddingHorizontal: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 6,
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
  },
  navIcon: { padding: 6 },
  searchInput: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 24,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  input: { flex: 1, color: '#E5F2FB', marginLeft: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  item: {
    flexDirection: 'row', backgroundColor: C.white, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  thumbWrap: { width: 110, aspectRatio: 1, backgroundColor: '#F4F8FA', position: 'relative', alignItems: 'center', justifyContent: 'center' },
  thumb: { width: '80%', height: '80%', resizeMode: 'contain' },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: C.sale, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', zIndex: 5, elevation: 5 },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  info: { flex: 1, padding: 10, justifyContent: 'center' },
  name: { color: C.text, fontWeight: '700' },
  brand: { color: C.soft, fontSize: 12, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  old: { color: '#9CA3AF', textDecorationLine: 'line-through', fontSize: 12 },
  final: { color: C.header2, fontWeight: 'bold', fontSize: 15 },
});
