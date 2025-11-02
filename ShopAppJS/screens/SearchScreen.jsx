// screens/SearchScreen.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, 
  ActivityIndicator, Dimensions, Image, Platform, StatusBar, Keyboard, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { CommonActions } from '@react-navigation/native'; 

const PRIMARY_COLOR = '#2C3E50'; 
const ACCENT_COLOR = '#3498DB'; 
const TEXT_COLOR = '#333333';
const LIGHT_TEXT_COLOR = '#FFFFFF';
const BACKGROUND_COLOR = '#F5F5F5';
const BORDER_COLOR = '#E0E0E0';
const ERROR_COLOR = '#E74C3C';
const API_URL = 'http://192.168.1.102:3000'; 

const formatPrice = (price) => {
  return price ? price.toLocaleString('vi-VN') + ' đ' : '0 đ';
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

const ProductCard = ({ product, navigation }) => {
  const hasDiscount = product.discount > 0;
  const finalPrice = product.price * (1 - product.discount / 100);
  return (
    <TouchableOpacity 
      style={styles.productCard}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('ProductDetail', { product })}
    >
      <Image 
        source={{ uri: product.image_url || 'https://via.placeholder.com/150' }} 
        style={styles.productImage}
      />
      <View style={styles.cardContent}>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.productBrand}>Hãng: {product.brand}</Text>
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

export default function SearchScreen({ navigation }) {
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false); 

  // 🚀 SỬA: Gửi Token khi gọi API
  const fetchSearchResults = async (query) => {
    setSearchAttempted(true);
    if (!query.trim()) { 
      setSearchResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await getToken(navigation); 
      if (!token) return;

      const res = await fetch(`${API_URL}/api/products/search?q=${encodeURIComponent(query.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (!res.ok) throw new Error('Lỗi khi lấy dữ liệu');
      const data = await res.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Lỗi tìm kiếm:', error);
      setSearchResults([]);
      if (error.message.includes('Token')) {
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSearchResults(searchText);
    }, 500); 
    return () => { clearTimeout(timer); };
  }, [searchText, navigation]); 

  // ... (Render và Styles giữ nguyên) ...
  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={ACCENT_COLOR} />
        </View>
      );
    }
    if (searchAttempted && searchText.trim().length > 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#888" />
          <Text style={styles.emptyText}>Không tìm thấy sản phẩm nào cho "{searchText}"</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={60} color="#888" />
        <Text style={styles.emptyText}>Gõ để tìm kiếm sản phẩm hoặc thương hiệu...</Text>
      </View>
    );
  };
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
      <View style={styles.searchHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={LIGHT_TEXT_COLOR} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Gõ để tìm kiếm..."
            placeholderTextColor="#888"
            value={searchText}
            onChangeText={setSearchText}
            autoFocus={true} 
            returnKeyType="search" 
          />
          <TouchableOpacity onPress={() => fetchSearchResults(searchText)} style={styles.searchButton}>
            <Ionicons name="search" size={24} color={PRIMARY_COLOR} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={searchResults}
        renderItem={({ item }) => <ProductCard product={item} navigation={navigation} />}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        keyboardShouldPersistTaps="handled" 
      />
    </View>
  );
}

// ... (Styles giữ nguyên)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  searchHeader: { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50, paddingHorizontal: 10, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: PRIMARY_COLOR, borderBottomLeftRadius: 15, borderBottomRightRadius: 15 },
  backButton: { padding: 5, marginRight: 5 },
  searchBar: { flex: 1, flexDirection: 'row', backgroundColor: LIGHT_TEXT_COLOR, borderRadius: 25, height: 45, paddingHorizontal: 15, alignItems: 'center', elevation: 2 },
  searchInput: { flex: 1, fontSize: 16, color: TEXT_COLOR },
  searchButton: { marginLeft: 10, padding: 5 },
  listContainer: { padding: 10, flexGrow: 1 },
  productCard: { flexDirection: 'row', backgroundColor: LIGHT_TEXT_COLOR, borderRadius: 10, padding: 10, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3 },
  productImage: { width: 80, height: 80, resizeMode: 'contain', borderRadius: 8, marginRight: 10, backgroundColor: '#f9f9f9' },
  cardContent: { flex: 1, justifyContent: 'center' },
  productName: { fontSize: 16, fontWeight: 'bold', color: TEXT_COLOR },
  productBrand: { fontSize: 13, color: '#888', marginBottom: 5 },
  priceContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  oldPrice: { textDecorationLine: 'line-through', color: '#888', fontSize: 13, marginRight: 5 },
  finalPrice: { fontSize: 15, fontWeight: '700', color: ACCENT_COLOR },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
  emptyText: { marginTop: 15, fontSize: 16, color: '#888', textAlign: 'center', paddingHorizontal: 40 }
});