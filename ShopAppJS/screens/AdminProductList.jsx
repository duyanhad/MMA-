// screens/AdminProductList.jsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Định nghĩa màu
const PRIMARY_COLOR = '#2C3E50';
const SECONDARY_COLOR = '#34495E';
const ACCENT_COLOR = '#3498DB';
const ERROR_COLOR = '#E74C3C';
const LIGHT_TEXT_COLOR = '#FFFFFF';
const TEXT_COLOR = '#333333';
const BACKGROUND_COLOR = '#F5F5F5';
const BORDER_COLOR = '#BDC3C7';

// 🚨 Đảm bảo IP chính xác (của bạn là .102)
const API_URL = 'http://192.168.1.102:3000';

const formatPrice = (price) => {
  return price ? price.toLocaleString('vi-VN') + ' đ' : '0 đ';
};

export default function AdminProductList({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Lấy Token
  const getToken = useCallback(async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
      return null;
    }
    return token;
  }, [navigation]);

  // Lấy tất cả sản phẩm
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/products`, { // Dùng API public (đã có verifyToken)
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setProducts(data);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể tải sản phẩm');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // 🚀 FIX: Sửa lại cấu trúc useFocusEffect
  useFocusEffect(
    useCallback(() => {
      loadProducts();
      
      return () => {
        // Hàm cleanup (nếu cần)
      };
    }, [loadProducts])
  );

  // Xử lý Xóa
  const handleDelete = (productId) => {
    Alert.alert(
      "Xác nhận Xóa",
      "Bạn có chắc chắn muốn xóa sản phẩm này? (Không thể hoàn tác)",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) return;

              const res = await fetch(`${API_URL}/api/admin/products/${productId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              const data = await res.json();
              if (res.ok) {
                Alert.alert('Thành công', 'Đã xóa sản phẩm.');
                loadProducts(); // Tải lại danh sách
              } else {
                throw new Error(data.message);
              }
            } catch (error) {
              Alert.alert('Lỗi', error.message || 'Không thể xóa sản phẩm.');
            }
          }
        }
      ]
    );
  };

  // Render
  const renderProductItem = ({ item }) => (
    <View style={styles.productCard}>
      <Image source={{ uri: item.image_url }} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.productBrand}>{item.brand}</Text>
        <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
      </View>
      <View style={styles.productActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('AdminProductEdit', { product: item })} // Chuyển sang trang Sửa
        >
          <Ionicons name="create-outline" size={24} color={ACCENT_COLOR} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDelete(item.id)}
        >
          <Ionicons name="trash-outline" size={24} color={ERROR_COLOR} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={[PRIMARY_COLOR, SECONDARY_COLOR]} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={LIGHT_TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý Sản phẩm</Text>
        {/* Nút Thêm Mới */}
        <TouchableOpacity 
          onPress={() => navigation.navigate('AdminProductEdit', { product: null })} // Chuyển sang trang Tạo
          style={styles.addButton}
        >
          <Ionicons name="add" size={32} color={LIGHT_TEXT_COLOR} />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color={LIGHT_TEXT_COLOR} style={{ marginTop: 20 }}/>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text style={styles.emptyText}>Chưa có sản phẩm nào.</Text>}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingHorizontal: 15,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PRIMARY_COLOR,
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: LIGHT_TEXT_COLOR },
  addButton: { padding: 5 },
  listContainer: { padding: 15 },
  emptyText: { color: LIGHT_TEXT_COLOR, textAlign: 'center', marginTop: 30, fontSize: 16 },
  
  productCard: {
    backgroundColor: LIGHT_TEXT_COLOR,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    resizeMode: 'contain',
    marginRight: 10,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  productBrand: {
    fontSize: 14,
    color: '#888',
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '500',
    color: ACCENT_COLOR,
  },
  productActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 5,
  },
});